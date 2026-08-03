import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function cleanObjectPath(
  rawPath: string,
  bucket: string,
) {
  const clean = rawPath.replace(/^\/+/, "");
  const prefix = `${bucket}/`;

  return clean.startsWith(prefix)
    ? clean.slice(prefix.length)
    : clean;
}

function contentTypeFromPath(path: string) {
  const lower = path.toLowerCase();

  if (lower.endsWith(".png")) return "image/png";
  if (lower.endsWith(".jpg") || lower.endsWith(".jpeg")) {
    return "image/jpeg";
  }
  if (lower.endsWith(".webp")) return "image/webp";
  if (lower.endsWith(".gif")) return "image/gif";
  if (lower.endsWith(".avif")) return "image/avif";

  return "application/octet-stream";
}

export async function GET(request: NextRequest) {
  try {
    const songId =
      request.nextUrl.searchParams.get("songId");
    const songSlug =
      request.nextUrl.searchParams.get("songSlug");

    if (!songId && !songSlug) {
      return new NextResponse("Missing song identity.", {
        status: 400,
        headers: { "Cache-Control": "no-store" },
      });
    }

    const baseQuery = supabaseAdmin
      .from("songs")
      .select(
        "id,slug,cover_image_path,cover_image_bucket,cover_url",
      )
      .limit(1);

    const songResult = songId
      ? await baseQuery.eq("id", songId).maybeSingle()
      : await baseQuery
          .eq("slug", songSlug || "")
          .maybeSingle();

    if (songResult.error) {
      throw new Error(songResult.error.message);
    }

    const song = songResult.data;

    if (!song) {
      return new NextResponse("Cover not found.", {
        status: 404,
        headers: { "Cache-Control": "no-store" },
      });
    }

    const directUrl = String(song.cover_url || "").trim();

    if (
      directUrl.startsWith("https://") ||
      directUrl.startsWith("http://")
    ) {
      const response = await fetch(directUrl, {
        cache: "no-store",
      });

      if (!response.ok) {
        throw new Error(
          `Cover request failed with ${response.status}.`,
        );
      }

      return new NextResponse(await response.arrayBuffer(), {
        status: 200,
        headers: {
          "Content-Type":
            response.headers.get("content-type") ||
            "application/octet-stream",
          "Cache-Control": "private, max-age=300",
        },
      });
    }

    const rawPath = String(
      song.cover_image_path || "",
    ).trim();

    if (!rawPath) {
      return new NextResponse("Cover not found.", {
        status: 404,
        headers: { "Cache-Control": "no-store" },
      });
    }

    const bucket = String(
      song.cover_image_bucket || "cover-art",
    ).trim();
    const objectPath = cleanObjectPath(rawPath, bucket);

    /*
     * Download with the authenticated server client and return the bytes.
     * This does not expose or depend on a signed URL in the browser.
     */
    const { data, error } = await supabaseAdmin.storage
      .from(bucket)
      .download(objectPath);

    if (error || !data) {
      throw new Error(
        error?.message || "Could not download cover artwork.",
      );
    }

    return new NextResponse(await data.arrayBuffer(), {
      status: 200,
      headers: {
        "Content-Type":
          data.type || contentTypeFromPath(objectPath),
        "Content-Length": String(data.size),
        "Cache-Control": "private, max-age=300",
      },
    });
  } catch (error: unknown) {
    return new NextResponse(
      error instanceof Error
        ? error.message
        : "Could not load cover artwork.",
      {
        status: 500,
        headers: {
          "Cache-Control": "no-store",
        },
      },
    );
  }
}
