import { supabaseAdmin } from "@/lib/supabase-admin";
import { optionalIntEnv } from "@/lib/env";

type MediaCandidate = {
  bucket: string;
  objectPath: string;
};

const KNOWN_MEDIA_BUCKETS = new Set([
  "songs",
  "audio",
  "music",
  "cover-art",
  "visuals",
  "admin-uploads",
]);

function cleanStoragePath(path: string) {
  const raw = String(path || "").trim();
  if (!raw) throw new Error("Missing media path.");

  if (/^https?:\/\//i.test(raw)) {
    try {
      const url = new URL(raw);
      const markers = [
        "/storage/v1/object/public/",
        "/storage/v1/object/sign/",
        "/storage/v1/object/authenticated/",
      ];

      for (const marker of markers) {
        const index = url.pathname.indexOf(marker);
        if (index >= 0) {
          return decodeURIComponent(url.pathname.slice(index + marker.length)).replace(/^\/+/, "");
        }
      }
    } catch {
      return raw;
    }
  }

  return raw
    .replace(/^\/+/, "")
    .replace(/^public\//, "")
    .replace(/^storage\/v1\/object\/(public|sign|authenticated)\//, "");
}

function pushCandidate(candidates: MediaCandidate[], bucket: string, objectPath: string) {
  const cleanBucket = String(bucket || "").trim();
  const cleanObjectPath = String(objectPath || "").replace(/^\/+/, "").trim();

  if (!cleanBucket || !cleanObjectPath || cleanObjectPath.includes("..")) return;

  const key = `${cleanBucket}/${cleanObjectPath}`;
  if (candidates.some((candidate) => `${candidate.bucket}/${candidate.objectPath}` === key)) return;

  candidates.push({ bucket: cleanBucket, objectPath: cleanObjectPath });
}

export function getMediaPathCandidates(path: string): MediaCandidate[] {
  const clean = cleanStoragePath(path);
  const parts = clean.split("/").filter(Boolean);
  const first = parts[0] || "";
  const rest = parts.slice(1).join("/");
  const candidates: MediaCandidate[] = [];

  if (!parts.length) throw new Error("Missing media path.");

  if (KNOWN_MEDIA_BUCKETS.has(first) && rest) {
    pushCandidate(candidates, first, rest);
  }

  // Most Caliphornia OS song rows store paths like:
  // fartherhood/storytime.mp3 or friends/song-name.mp3.
  // Those are object paths inside the private `songs` bucket, not bucket names.
  pushCandidate(candidates, "songs", clean);

  // Compatibility fallback for older rows that accidentally treated the first
  // folder as a bucket name.
  if (rest) {
    pushCandidate(candidates, first, rest);
  }

  return candidates;
}

export function parseStoragePath(path: string) {
  const [firstCandidate] = getMediaPathCandidates(path);
  if (!firstCandidate) throw new Error("Invalid media path.");
  return firstCandidate;
}

export async function createSignedMediaUrl(
  path: string,
  seconds = optionalIntEnv("SIGNED_AUDIO_URL_SECONDS", 900)
) {
  const raw = String(path || "").trim();

  if (!raw) throw new Error("This song does not have an audio file connected yet.");

  if (/^https?:\/\//i.test(raw) && !raw.includes("/storage/v1/object/")) {
    return raw;
  }

  const candidates = getMediaPathCandidates(raw);
  const errors: string[] = [];

  for (const candidate of candidates) {
    const { data, error } = await supabaseAdmin.storage
      .from(candidate.bucket)
      .createSignedUrl(candidate.objectPath, seconds, { download: false });

    if (!error && data?.signedUrl) return data.signedUrl;

    errors.push(`${candidate.bucket}/${candidate.objectPath}: ${error?.message || "not found"}`);
  }

  throw new Error(
    `Audio file not found in Supabase Storage. Checked ${errors.join(" | ")}. Update songs.audio_path to match the private songs bucket object path.`
  );
}
