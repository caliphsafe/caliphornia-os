import { NextRequest, NextResponse } from "next/server";
import { createTokenPair } from "@/lib/sharing/tokens";
import { supabaseAdmin } from "@/lib/supabase-admin";

function roundedCoord(value: unknown) {
  const n = Number(value);
  if (!Number.isFinite(n)) return null;
  return Math.round(n * 10000) / 10000;
}

function cleanLocation(input: any) {
  const lat = roundedCoord(input?.latitude ?? input?.lat);
  const lng = roundedCoord(input?.longitude ?? input?.lng);
  if (lat == null || lng == null) return null;

  return {
    lat,
    lng,
    accuracy:
      Number.isFinite(Number(input?.accuracy)) && Number(input?.accuracy) > 0
        ? Math.round(Number(input.accuracy))
        : null,
    captured_at: new Date().toISOString(),
    precision: "rounded_4_decimal_places",
  };
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const { token, tokenHash } = createTokenPair();
    const expires = new Date(Date.now() + 15 * 60 * 1000).toISOString();
    const location = cleanLocation(body.location || body);

    const row = await supabaseAdmin
      .from("guest_sessions")
      .insert({
        guest_token_hash: tokenHash,
        status: "active",
        expires_at: expires,
        privacy_level: "reduced",
        metadata: {
          device_label: String(body.deviceLabel || "Nearby listener"),
          receiver_location: location,
          receiver_flow: "main_page_proximity",
        },
      })
      .select("id")
      .single();

    if (row.error) {
      return NextResponse.json(
        { ok: false, error: "Could not start Receive." },
        { status: 500 }
      );
    }

    return NextResponse.json({
      ok: true,
      guestSessionId: row.data.id,
      guestToken: token,
      expiresAt: expires,
      receiverMode: "main_page_proximity",
    });
  } catch {
    return NextResponse.json(
      { ok: false, error: "Could not start Receive." },
      { status: 500 }
    );
  }
}
