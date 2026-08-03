import { NextRequest, NextResponse } from "next/server";
import {
  idempotencyKey,
  normalizeEmail,
  sha256,
} from "@/lib/crypto";
import { createKiikuTransaction } from "@/lib/kiiku/ledger";
import { setSessionCookie } from "@/lib/session";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { getOrCreateAppUser } from "@/lib/users";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const email = normalizeEmail(String(body.email || ""));
    const guestToken = String(body.guestToken || "");

    if (!email.includes("@")) {
      return NextResponse.json(
        { ok: false, error: "Enter a valid email." },
        { status: 400 },
      );
    }

    if (!guestToken) {
      return NextResponse.json(
        { ok: false, error: "Guest session expired." },
        { status: 401 },
      );
    }

    const guestResult = await supabaseAdmin
      .from("guest_sessions")
      .select("id, status, claimed_by_user_id")
      .eq("guest_token_hash", sha256(guestToken))
      .maybeSingle();

    if (guestResult.error) {
      throw new Error(guestResult.error.message);
    }

    const guest = guestResult.data;

    if (!guest?.id) {
      return NextResponse.json(
        { ok: false, error: "Guest session expired." },
        { status: 401 },
      );
    }

    const user = await getOrCreateAppUser(email);

    /*
     * Claim every entitlement attached to the guest session. Project Shares can
     * create more than one entitlement, so this must not use maybeSingle().
     */
    const entitlementResult = await supabaseAdmin
      .from("guest_one_play_entitlements")
      .select("*")
      .eq("guest_session_id", guest.id);

    if (entitlementResult.error) {
      throw new Error(entitlementResult.error.message);
    }

    const entitlements = entitlementResult.data || [];
    const songIds = Array.from(
      new Set(
        entitlements
          .map((entitlement) => entitlement.song_id)
          .filter(Boolean),
      ),
    );

    const songResult = songIds.length
      ? await supabaseAdmin
          .from("songs")
          .select("id, slug")
          .in("id", songIds)
      : { data: [], error: null };

    if (songResult.error) {
      throw new Error(songResult.error.message);
    }

    const songSlugById = new Map(
      (songResult.data || []).map((song) => [song.id, song.slug]),
    );

    for (const entitlement of entitlements) {
      if (!entitlement.song_id) continue;

      const favoriteResult = await supabaseAdmin
        .from("user_favorite_songs")
        .upsert(
          {
            user_id: user.id,
            user_email: user.email,
            song_id: entitlement.song_id,
            song_slug:
              songSlugById.get(entitlement.song_id) || null,
            source_type: "share_claim",
            source_access_table: "guest_one_play_entitlements",
            source_access_id: entitlement.id,
            status: "active",
          },
          { onConflict: "user_id,song_id" },
        );

      if (favoriteResult.error) {
        throw new Error(favoriteResult.error.message);
      }

      const entitlementUpdate = await supabaseAdmin
        .from("guest_one_play_entitlements")
        .update({
          status: "claimed",
          claimed_at: new Date().toISOString(),
          claimed_by_user_id: user.id,
        })
        .eq("id", entitlement.id);

      if (entitlementUpdate.error) {
        throw new Error(entitlementUpdate.error.message);
      }
    }

    const shareSessionId =
      entitlements.find((item) => item.share_session_id)
        ?.share_session_id || null;

    const shareResult = shareSessionId
      ? await supabaseAdmin
          .from("nearby_share_sessions")
          .select("id, sender_user_id, project_id, song_id")
          .eq("id", shareSessionId)
          .maybeSingle()
      : { data: null, error: null };

    if (shareResult.error) {
      throw new Error(shareResult.error.message);
    }

    const guestUpdate = await supabaseAdmin
      .from("guest_sessions")
      .update({
        status: "claimed",
        claimed_at: new Date().toISOString(),
        claimed_by_user_id: user.id,
      })
      .eq("id", guest.id);

    if (guestUpdate.error) {
      throw new Error(guestUpdate.error.message);
    }

    const claimResult = await supabaseAdmin
      .from("guest_account_claims")
      .upsert(
        {
          guest_session_id: guest.id,
          user_id: user.id,
          share_session_id: shareResult.data?.id || null,
          claim_method: "email_no_verification",
          status: "completed",
          claimed_email_snapshot: email,
          completed_at: new Date().toISOString(),
          idempotency_key: idempotencyKey([
            "guest_claim",
            guest.id,
            user.id,
          ]),
        },
        { onConflict: "idempotency_key" },
      );

    if (claimResult.error) {
      throw new Error(claimResult.error.message);
    }

    const ruleResult = await supabaseAdmin
      .from("kiiku_rules")
      .select("*")
      .eq("status", "active")
      .eq("action_type", "guest_account_claim")
      .limit(1)
      .maybeSingle();

    const amount = Number(ruleResult.data?.credit_amount || 0);

    if (amount > 0 && ruleResult.data?.id) {
      await createKiikuTransaction({
        userId: user.id,
        amount,
        direction: "earn",
        transactionType: "welcome_reward",
        reason: "Guest account claim",
        idempotencyKey: idempotencyKey([
          "kiiku_guest_claim",
          guest.id,
          ruleResult.data.id,
        ]),
        ruleId: ruleResult.data.id,
        shareSessionId: shareResult.data?.id || null,
        projectId: shareResult.data?.project_id || null,
        songId: shareResult.data?.song_id || null,
      });
    }

    await setSessionCookie({
      email: user.email,
      username: user.username || undefined,
      role: user.role || undefined,
      iat: Date.now(),
    });

    return NextResponse.json({
      ok: true,
      redirectTo: "/apps/music",
      claimedSongs: entitlements.filter((item) => item.song_id).length,
    });
  } catch (error: unknown) {
    return NextResponse.json(
      {
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : "Could not create your account.",
      },
      { status: 500 },
    );
  }
}
