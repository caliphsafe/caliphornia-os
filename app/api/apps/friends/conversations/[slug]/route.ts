import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";

export async function GET(
  request: Request,
  context: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await context.params;

    const { data: conversation, error: conversationError } = await supabaseAdmin
      .from("conversations")
      .select(`
        id,
        slug,
        title,
        subtitle,
        avatar_letter,
        list_preview,
        last_activity_label,
        sort_order,
        is_published
      `)
      .eq("slug", slug)
      .eq("is_published", true)
      .single();

    if (conversationError || !conversation) {
      return NextResponse.json(
        { ok: false, error: conversationError?.message || "Conversation not found." },
        { status: 404 }
      );
    }

    const { data: messages, error: messagesError } = await supabaseAdmin
      .from("conversation_messages")
      .select(`
        id,
        message_type,
        sender_name,
        sender_label,
        body,
        position,
        message_side,
        display_time,
        audio_label,
        audio_kind,
        is_published,
        message_audio_clips (
          id,
          clip_title,
          start_seconds,
          end_seconds,
          display_duration,
          audio_assets (
            id,
            slug,
            title,
            storage_path,
            version_label,
            is_final_version,
            is_playlistable,
            linked_song_id
          )
        )
      `)
      .eq("conversation_id", conversation.id)
      .eq("is_published", true)
      .order("position", { ascending: true });

    if (messagesError) {
      return NextResponse.json(
        { ok: false, error: messagesError.message },
        { status: 500 }
      );
    }

    const normalizedMessages = await Promise.all(
      (messages || []).map(async (msg: any) => {
        const clip = Array.isArray(msg.message_audio_clips) ? msg.message_audio_clips[0] : null;
        const asset = clip?.audio_assets
          ? (Array.isArray(clip.audio_assets) ? clip.audio_assets[0] : clip.audio_assets)
          : null;

        let signedUrl: string | null = null;

        if (asset?.storage_path) {
          const { data: signed } = await supabaseAdmin.storage
            .from("songs")
            .createSignedUrl(asset.storage_path, 60 * 60);

          signedUrl = signed?.signedUrl || null;
        }

        return {
          id: msg.id,
          message_type: msg.message_type,
          sender_name: msg.sender_name,
          sender_label: msg.sender_label,
          body: msg.body,
          position: msg.position,
          message_side: msg.message_side,
          display_time: msg.display_time,
          audio_label: msg.audio_label,
          audio_kind: msg.audio_kind,
          clip: clip
            ? {
                id: clip.id,
                clip_title: clip.clip_title,
                start_seconds: Number(clip.start_seconds || 0),
                end_seconds: clip.end_seconds != null ? Number(clip.end_seconds) : null,
                display_duration: clip.display_duration,
                file: signedUrl,
                asset: asset
                  ? {
                      id: asset.id,
                      slug: asset.slug,
                      title: asset.title,
                      version_label: asset.version_label,
                      is_final_version: asset.is_final_version,
                      is_playlistable: asset.is_playlistable,
                      linked_song_id: asset.linked_song_id
                    }
                  : null
              }
            : null
        };
      })
    );

    return NextResponse.json({
      ok: true,
      conversation,
      messages: normalizedMessages
    });
  } catch {
    return NextResponse.json(
      { ok: false, error: "Server error." },
      { status: 500 }
    );
  }
}
