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

export async function GET(request: NextRequest) {
  try {
    const songId =
      request.nextUrl.searchParams.get("songId");
    const songSlug =
      request.nextUrl.searchParams.get("songSlug");

    if (!songId && !songSlug) {
      return new NextResponse("Missing song identity.", {
        status: 400,
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
      });
    }

    const directUrl = String(song.cover_url || "").trim();

    if (
      directUrl.startsWith("https://") ||
      directUrl.startsWith("http://")
    ) {
      return NextResponse.redirect(directUrl, {
        status: 307,
        headers: {
          "Cache-Control": "no-store",
        },
      });
    }

    const rawPath = String(
      song.cover_image_path || "",
    ).trim();

    if (!rawPath) {
      return new NextResponse("Cover not found.", {
        status: 404,
      });
    }

    const bucket = String(
      song.cover_image_bucket || "cover-art",
    ).trim();
    const objectPath = cleanObjectPath(rawPath, bucket);

    const { data, error } = await supabaseAdmin.storage
      .from(bucket)
      .createSignedUrl(objectPath, 60 * 60);

    if (error || !data?.signedUrl) {
      throw new Error(
        error?.message || "Could not sign cover artwork.",
      );
    }

    return NextResponse.redirect(data.signedUrl, {
      status: 307,
      headers: {
        "Cache-Control": "no-store, max-age=0",
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
