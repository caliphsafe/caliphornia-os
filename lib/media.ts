import { supabaseAdmin } from "@/lib/supabase-admin";
import { optionalIntEnv } from "@/lib/env";

export function parseStoragePath(path: string) {
  const clean = path.replace(/^\/+/, "");
  const parts = clean.split("/");
  const bucket = parts.shift() || "songs";
  const objectPath = parts.join("/");
  if (!objectPath || objectPath.includes("..")) throw new Error("Invalid media path.");
  return { bucket, objectPath };
}

export async function createSignedMediaUrl(path: string, seconds = optionalIntEnv("SIGNED_AUDIO_URL_SECONDS", 900)) {
  const { bucket, objectPath } = parseStoragePath(path);
  const { data, error } = await supabaseAdmin.storage.from(bucket).createSignedUrl(objectPath, seconds, { download: false });
  if (error || !data?.signedUrl) throw new Error(error?.message || "Could not sign media URL.");
  return data.signedUrl;
}
