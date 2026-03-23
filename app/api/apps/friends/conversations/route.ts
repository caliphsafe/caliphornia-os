import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";

export async function GET() {
  try {
    const { data: appRow, error: appError } = await supabaseAdmin
      .from("apps")
      .select("id")
      .eq("slug", "friends")
      .single();

    if (appError || !appRow) {
      return NextResponse.json(
        { ok: false, error: appError?.message || "Friends app not found." },
        { status: 404 }
      );
    }

    const { data: conversations, error: conversationsError } = await supabaseAdmin
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
      .eq("app_id", appRow.id)
      .eq("is_published", true)
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: false });

    if (conversationsError) {
      return NextResponse.json(
        { ok: false, error: conversationsError.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      ok: true,
      conversations: conversations || []
    });
  } catch {
    return NextResponse.json(
      { ok: false, error: "Server error." },
      { status: 500 }
    );
  }
}
