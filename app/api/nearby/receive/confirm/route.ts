import { NextRequest, NextResponse } from "next/server";
import {
  sha256,
  idempotencyKey,
} from "@/lib/crypto";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { getCurrentAppUser } from "@/lib/users";

function normalizeSongIds(share: any) {
  const fromMetadata = Array.isArray(
    share?.metadata?.share_song_ids,
  )
    ? share.metadata.share_song_ids
    : [];

  return Array.from(
    new Set(
      [...fromMetadata, share?.song_id]
        .map((value) => String(value || "").trim())
        .filter(Boolean),
    ),
  );
}

async function grantSongsToExistingUser({
  user,
  guestSessionId,
  shareSessionId,
  songIds,
}: {
  user: {
    id: string;
    email: string;
  };
  guestSessionId: string;
  shareSessionId: string;
  songIds: string[];
}) {
  const songResult = await supabaseAdmin
    .from("songs")
    .select("id,slug")
    .in("id", songIds);

  if (songResult.error) {
    throw new Error(songResult.error.message);
  }

  const slugById = new Map(
    (songResult.data || []).map((song) => [
      song.id,
      song.slug,
    ]),
  );

  for (const songId of songIds) {
    const existingAccess = await supabaseAdmin
      .from("user_song_access")
      .select("id")
      .eq("user_id", user.id)
      .eq("song_id", songId)
      .limit(1)
      .maybeSingle();

    if (existingAccess.error) {
      throw new Error(existingAccess.error.message);
    }

    const accessValues = {
      user_id: user.id,
      user_email: user.email,
      song_id: songId,
      source_type: "nearby_share",
      source_share_session_id: shareSessionId,
      status: "active",
      starts_at: new Date().toISOString(),
      expires_at: null,
      play_limit: null,
      plays_used: 0,
      can_share: false,
      can_download: false,
      idempotency_key: idempotencyKey([
        "shared_song_access",
        guestSessionId,
        user.id,
        songId,
      ]),
    };

    if (existingAccess.data?.id) {
      const update = await supabaseAdmin
        .from("user_song_access")
        .update(accessValues)
        .eq("id", existingAccess.data.id);

      if (update.error) {
        throw new Error(update.error.message);
      }
    } else {
      const insert = await supabaseAdmin
        .from("user_song_access")
        .insert(accessValues);

      if (insert.error) {
        throw new Error(insert.error.message);
      }
    }

    const existingFavorite = await supabaseAdmin
      .from("user_favorite_songs")
      .select("id")
      .eq("user_id", user.id)
      .eq("song_id", songId)
      .limit(1)
      .maybeSingle();

    if (existingFavorite.error) {
      throw new Error(existingFavorite.error.message);
    }

    const favoriteValues = {
      user_id: user.id,
      user_email: user.email,
      song_id: songId,
      song_slug: slugById.get(songId) || null,
      source_type: "share_claim",
      source_access_table:
        "guest_one_play_entitlements",
      source_access_id: null,
      status: "active",
    };

    if (existingFavorite.data?.id) {
      const update = await supabaseAdmin
        .from("user_favorite_songs")
        .update(favoriteValues)
        .eq("id", existingFavorite.data.id);

      if (update.error) {
        throw new Error(update.error.message);
      }
    } else {
      const insert = await supabaseAdmin
        .from("user_favorite_songs")
        .insert(favoriteValues);

      if (insert.error) {
        throw new Error(insert.error.message);
      }
    }

    const entitlementUpdate = await supabaseAdmin
      .from("guest_one_play_entitlements")
      .update({
        status: "claimed",
        claimed_at: new Date().toISOString(),
        claimed_by_user_id: user.id,
      })
      .eq("guest_session_id", guestSessionId)
      .eq("share_session_id", shareSessionId)
      .eq("song_id", songId);

    if (entitlementUpdate.error) {
      throw new Error(entitlementUpdate.error.message);
    }
  }

  const guestUpdate = await supabaseAdmin
    .from("guest_sessions")
    .update({
      status: "claimed",
      claimed_at: new Date().toISOString(),
      claimed_by_user_id: user.id,
    })
    .eq("id", guestSessionId);

  if (guestUpdate.error) {
    throw new Error(guestUpdate.error.message);
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    const guest = await supabaseAdmin
      .from("guest_sessions")
      .select("id")
      .eq(
        "guest_token_hash",
        sha256(String(body.guestToken || "")),
      )
      .maybeSingle();

    if (!guest.data?.id) {
      return NextResponse.json(
        {
          ok: false,
          error: "Receive session expired.",
        },
        { status: 401 },
      );
    }

    const share = await supabaseAdmin
      .from("nearby_share_sessions")
      .select("*")
      .eq("id", body.shareSessionId)
      .eq("status", "searching")
      .gt("expires_at", new Date().toISOString())
      .maybeSingle();

    if (!share.data?.id) {
      return NextResponse.json(
        {
          ok: false,
          error: "Share expired or already accepted.",
        },
        { status: 404 },
      );
    }

    const songIds = normalizeSongIds(share.data);

    if (!songIds.length) {
      return NextResponse.json(
        {
          ok: false,
          error: "This Share has no songs attached.",
        },
        { status: 404 },
      );
    }

    await supabaseAdmin
      .from("nearby_share_sessions")
      .update({
        recipient_guest_session_id: guest.data.id,
        recipient_confirmed_at:
          new Date().toISOString(),
        accepted_at: new Date().toISOString(),
        status: "accepted",
        metadata: {
          ...(share.data.metadata || {}),
          receiver_flow: "main_page_proximity",
          receiver_location:
            body.location &&
            typeof body.location === "object"
              ? {
                  lat: Number(
                    body.location.latitude ||
                      body.location.lat ||
                      0,
                  ),
                  lng: Number(
                    body.location.longitude ||
                      body.location.lng ||
                      0,
                  ),
                  accuracy:
                    Number(body.location.accuracy || 0) ||
                    null,
                  captured_at:
                    new Date().toISOString(),
                  precision: "rounded_by_browser",
                }
              : null,
        },
      })
      .eq("id", share.data.id);

    const expiresAt = new Date(
      Date.now() + 60 * 60 * 1000,
    ).toISOString();

    const entitlementRows = await Promise.all(
      songIds.map((songId) =>
        supabaseAdmin
          .from("guest_one_play_entitlements")
          .upsert(
            {
              guest_session_id: guest.data.id,
              share_session_id: share.data.id,
              song_id: songId,
              project_id:
                share.data.project_id || null,
              play_limit: 1,
              plays_used: 0,
              status: "active",
              expires_at: expiresAt,
              idempotency_key: idempotencyKey([
                "guest_entitlement",
                share.data.id,
                guest.data.id,
                songId,
              ]),
            },
            { onConflict: "idempotency_key" },
          )
          .select("id")
          .single(),
      ),
    );

    const entitlementError =
      entitlementRows.find((row) => row.error)?.error;

    if (entitlementError) {
      throw new Error(entitlementError.message);
    }

    await supabaseAdmin
      .from("nearby_share_events")
      .insert({
        share_session_id: share.data.id,
        actor_guest_session_id: guest.data.id,
        event_type:
          share.data.share_scope === "project"
            ? "project_share_accepted"
            : "song_share_accepted",
        event_status: "ok",
        metadata: {
          song_count: songIds.length,
          receiver_flow: "main_page_proximity",
        },
      });

    /*
     * If the receiver is already signed in, receiving should finish
     * inside that account. We reuse the existing user_song_access and
     * user_favorite_songs contracts instead of forcing an authenticated
     * user through the guest-account creation screen.
     */
    const currentUser = await getCurrentAppUser();

    if (currentUser?.id && currentUser.email) {
      await grantSongsToExistingUser({
        user: {
          id: currentUser.id,
          email: currentUser.email,
        },
        guestSessionId: guest.data.id,
        shareSessionId: share.data.id,
        songIds,
      });

      return NextResponse.json({
        ok: true,
        accountClaimed: true,
        claimedSongs: songIds.length,
        guestEntitlementIds: entitlementRows
          .map((row) => row.data?.id)
          .filter(Boolean),
        /*
         * ShareClient and ProximityReceivePrompt already follow guestUrl.
         * Returning Music here lets existing users land directly in their
         * account without changing those working client components.
         */
        guestUrl: "/apps/music?received=1",
        redirectTo: "/apps/music?received=1",
        songCount: songIds.length,
      });
    }

    return NextResponse.json({
      ok: true,
      accountClaimed: false,
      guestEntitlementIds: entitlementRows
        .map((row) => row.data?.id)
        .filter(Boolean),
      guestUrl: `/guest/${encodeURIComponent(
        body.guestToken,
      )}`,
      songCount: songIds.length,
    });
  } catch (error: unknown) {
    return NextResponse.json(
      {
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : "Could not accept Share.",
      },
      { status: 500 },
    );
  }
}
