import { NextRequest, NextResponse } from "next/server";
import { sha256 } from "@/lib/crypto";
import { supabaseAdmin } from "@/lib/supabase-admin";

type LatLng = {
  lat: number;
  lng: number;
  accuracy?: number | null;
};

function roundedCoord(value: unknown) {
  const n = Number(value);
  if (!Number.isFinite(n)) return null;
  return Math.round(n * 10000) / 10000;
}

function locationFromSearch(req: NextRequest): LatLng | null {
  const url = new URL(req.url);
  const lat = roundedCoord(url.searchParams.get("lat"));
  const lng = roundedCoord(url.searchParams.get("lng"));
  if (lat == null || lng == null) return null;

  const accuracyValue = Number(url.searchParams.get("accuracy"));
  return {
    lat,
    lng,
    accuracy: Number.isFinite(accuracyValue) && accuracyValue > 0 ? accuracyValue : null,
  };
}

function extractLocation(value: any): LatLng | null {
  const loc = value?.metadata?.sender_location || value?.metadata?.receiver_location || value;
  const lat = roundedCoord(loc?.lat ?? loc?.latitude);
  const lng = roundedCoord(loc?.lng ?? loc?.longitude);
  if (lat == null || lng == null) return null;

  return {
    lat,
    lng,
    accuracy:
      Number.isFinite(Number(loc?.accuracy)) && Number(loc.accuracy) > 0
        ? Number(loc.accuracy)
        : null,
  };
}

function distanceMeters(a: LatLng, b: LatLng) {
  const radius = 6371000;
  const toRad = (n: number) => (n * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);

  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;

  return 2 * radius * Math.asin(Math.sqrt(h));
}

function proximityLabel(meters: number) {
  if (meters <= 25) return "Right next to you";
  if (meters <= 80) return "Nearby";
  return "Close enough";
}

function allowedRadius(receiver: LatLng, sender: LatLng) {
  const receiverAccuracy = receiver.accuracy || 35;
  const senderAccuracy = sender.accuracy || 35;
  return Math.min(700, Math.max(120, receiverAccuracy + senderAccuracy + 60));
}

export async function GET(req: NextRequest) {
  try {
    const token = new URL(req.url).searchParams.get("guestToken") || "";
    const receiverLocationFromRequest = locationFromSearch(req);

    const guest = await supabaseAdmin
      .from("guest_sessions")
      .select("id,status,expires_at,metadata")
      .eq("guest_token_hash", sha256(token))
      .maybeSingle();

    if (!guest.data?.id) {
      return NextResponse.json(
        { ok: false, error: "Receive session expired." },
        { status: 401 }
      );
    }

    const receiverLocation =
      receiverLocationFromRequest || extractLocation({ metadata: guest.data.metadata });

    if (!receiverLocation) {
      return NextResponse.json({
        ok: true,
        candidates: [],
        needsLocation: true,
        message: "Allow location on the main page to receive nearby Share sessions.",
      });
    }

    const rows = await supabaseAdmin
      .from("nearby_share_sessions")
      .select(
        "id,song_id,project_id,share_scope,song_title_snapshot,project_name_snapshot,sender_user_id,metadata,expires_at,status,created_at"
      )
      .eq("status", "searching")
      .gt("expires_at", new Date().toISOString())
      .order("created_at", { ascending: false })
      .limit(12);

    const candidates = (rows.data || [])
      .map((row: any) => {
        const senderLocation = extractLocation({ metadata: row.metadata });
        if (!senderLocation) return null;

        const meters = distanceMeters(receiverLocation, senderLocation);
        if (meters > allowedRadius(receiverLocation, senderLocation)) return null;

        const songCount = Number(row.metadata?.share_count || row.metadata?.share_song_ids?.length || 1);
        const scope = row.share_scope === "project" ? "project" : "song";
        const title =
          scope === "project"
            ? row.project_name_snapshot || row.song_title_snapshot || "Project Share"
            : row.song_title_snapshot || "Song Share";

        return {
          id: row.id,
          scope,
          title,
          song_title: title,
          sender_label: row.metadata?.sender_label || "Nearby listener",
          songCount,
          summary:
            scope === "project"
              ? `${songCount} songs, 1 guest listen each`
              : "1 guest listen",
          distance_meters: Math.round(meters),
          proximity_label: proximityLabel(meters),
        };
      })
      .filter(Boolean)
      .sort((a: any, b: any) => a.distance_meters - b.distance_meters)
      .slice(0, 3);

    return NextResponse.json({ ok: true, candidates });
  } catch {
    return NextResponse.json(
      { ok: false, error: "Could not find nearby shares." },
      { status: 500 }
    );
  }
}
