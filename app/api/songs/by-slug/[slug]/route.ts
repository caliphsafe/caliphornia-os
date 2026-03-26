import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params;

    const { data: song, error } = await supabaseAdmin
      .from("songs")
      .select(`
        id,
        slug,
        title,
        artist_name,
        cover_image_path,
        cover_image_bucket
      `)
      .eq("slug", slug)
      .maybeSingle();

    if (error) {
      return NextResponse.json(
        { ok: false, error: error.message },
        { status: 500 }
      );
    }

    if (!song) {
      return NextResponse.json(
        { ok: false, error: "Song not found." },
        { status: 404 }
      );
    }

    let coverUrl: string | null = null;

    if (song.cover_image_path) {
      const bucket = song.cover_image_bucket || "cover-art";
      const { data } = supabaseAdmin.storage
        .from(bucket)
        .getPublicUrl(song.cover_image_path);

      coverUrl = data?.publicUrl || null;
    }

    return NextResponse.json({
      ok: true,
      song: {
        id: song.id,
        slug: song.slug,
        title: song.title,
        artist_name: song.artist_name,
        cover_image_path: song.cover_image_path,
        cover_image_bucket: song.cover_image_bucket,
        coverUrl
      }
    });
  } catch (error: any) {
    return NextResponse.json(
      { ok: false, error: error?.message || "Server error." },
      { status: 500 }
    );
  }
}
