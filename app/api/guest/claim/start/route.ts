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
import type { AppUser } from "@/types/domain";

export async function POST(req: NextRequest) {
  try {
    const body =
      await req.json().catch(() => ({}));
    const email = normalizeEmail(
      String(body.email || ""),
    );
    const guestToken = String(
      body.guestToken || "",
    );
    const requestedUsername = String(
      body.username || "",
    ).trim();

    if (!email.includes("@")) {
      return NextResponse.json(
        {
          ok: false,
          error: "Enter a valid email.",
        },
        { status: 400 },
      );
    }

    const guestResult = await supabaseAdmin
      .from("guest_sessions")
      .select(
        "id,status,claimed_by_user_id",
      )
      .eq(
        "guest_token_hash",
        sha256(guestToken),
      )
      .maybeSingle();

    if (guestResult.error) {
      throw new Error(
        guestResult.error.message,
      );
    }

    const guest = guestResult.data;

    if (!guest?.id) {
      return NextResponse.json(
        {
          ok: false,
          error: "Guest session expired.",
        },
        { status: 401 },
      );
    }

    /*
     * Existing accounts sign in with their stored username.
     * New accounts must deliberately choose a username rather
     * than silently inheriting the email prefix.
     */
    const existingUserResult =
      await supabaseAdmin
        .from("app_users")
        .select("id,email,username,role")
        .eq("email", email)
        .maybeSingle();

    if (existingUserResult.error) {
      throw new Error(
        existingUserResult.error.message,
      );
    }

    let user: AppUser;

    if (existingUserResult.data?.id) {
      user =
        existingUserResult.data as AppUser;
    } else {
      if (requestedUsername.length < 2) {
        return NextResponse.json(
          {
            ok: false,
            needsUsername: true,
            error:
              "Choose a username to finish creating your account.",
          },
          { status: 409 },
        );
      }

      const usernameCheck =
        await supabaseAdmin
          .from("app_users")
          .select("id")
          .eq(
            "username",
            requestedUsername,
          )
          .limit(1)
          .maybeSingle();

      if (usernameCheck.error) {
        throw new Error(
          usernameCheck.error.message,
        );
      }

      if (usernameCheck.data?.id) {
        return NextResponse.json(
          {
            ok: false,
            needsUsername: true,
            error:
              "That username is already being used. Choose another one.",
          },
          { status: 409 },
        );
      }

      user = await getOrCreateAppUser(
        email,
        requestedUsername,
      );
    }

    const entitlementResult =
      await supabaseAdmin
        .from("guest_one_play_entitlements")
        .select("*")
        .eq(
          "guest_session_id",
          guest.id,
        );

    if (entitlementResult.error) {
      throw new Error(
        entitlementResult.error.message,
      );
    }

    const entitlements =
      entitlementResult.data || [];
    const songIds = Array.from(
      new Set(
        entitlements
          .map((item) => item.song_id)
          .filter(Boolean),
      ),
    );

    const songResult = songIds.length
      ? await supabaseAdmin
          .from("songs")
          .select("id,slug")
          .in("id", songIds)
      : { data: [], error: null };

    if (songResult.error) {
      throw new Error(
        songResult.error.message,
      );
    }

    const slugById = new Map(
      (songResult.data || []).map(
        (song) => [
          song.id,
          song.slug,
        ],
      ),
    );

    for (const entitlement of entitlements) {
      if (!entitlement.song_id) continue;

      const existingAccess =
        await supabaseAdmin
          .from("user_song_access")
          .select("id")
          .eq("user_id", user.id)
          .eq(
            "song_id",
            entitlement.song_id,
          )
          .limit(1)
          .maybeSingle();

      if (existingAccess.error) {
        throw new Error(
          existingAccess.error.message,
        );
      }

      const accessValues = {
        user_id: user.id,
        user_email: user.email,
        song_id: entitlement.song_id,
        source_type: "nearby_share",
        source_share_session_id:
          entitlement.share_session_id ||
          null,
        status: "active",
        starts_at:
          new Date().toISOString(),
        expires_at: null,
        play_limit: null,
        plays_used: 0,
        can_share: false,
        can_download: false,
        idempotency_key: idempotencyKey([
          "shared_song_access",
          guest.id,
          user.id,
          entitlement.song_id,
        ]),
      };

      if (existingAccess.data?.id) {
        const update =
          await supabaseAdmin
            .from("user_song_access")
            .update(accessValues)
            .eq(
              "id",
              existingAccess.data.id,
            );

        if (update.error) {
          throw new Error(
            update.error.message,
          );
        }
      } else {
        const insert =
          await supabaseAdmin
            .from("user_song_access")
            .insert(accessValues);

        if (insert.error) {
          throw new Error(
            insert.error.message,
          );
        }
      }

      const existingFavorite =
        await supabaseAdmin
          .from("user_favorite_songs")
          .select("id")
          .eq("user_id", user.id)
          .eq(
            "song_id",
            entitlement.song_id,
          )
          .limit(1)
          .maybeSingle();

      if (existingFavorite.error) {
        throw new Error(
          existingFavorite.error.message,
        );
      }

      const favoriteValues = {
        user_id: user.id,
        user_email: user.email,
        song_id: entitlement.song_id,
        song_slug:
          slugById.get(
            entitlement.song_id,
          ) || null,
        source_type: "share_claim",
        source_access_table:
          "guest_one_play_entitlements",
        source_access_id:
          entitlement.id,
        status: "active",
      };

      if (existingFavorite.data?.id) {
        const update =
          await supabaseAdmin
            .from("user_favorite_songs")
            .update(favoriteValues)
            .eq(
              "id",
              existingFavorite.data.id,
            );

        if (update.error) {
          throw new Error(
            update.error.message,
          );
        }
      } else {
        const insert =
          await supabaseAdmin
            .from("user_favorite_songs")
            .insert(favoriteValues);

        if (insert.error) {
          throw new Error(
            insert.error.message,
          );
        }
      }

      const entitlementUpdate =
        await supabaseAdmin
          .from(
            "guest_one_play_entitlements",
          )
          .update({
            status: "claimed",
            claimed_at:
              new Date().toISOString(),
            claimed_by_user_id:
              user.id,
          })
          .eq("id", entitlement.id);

      if (entitlementUpdate.error) {
        throw new Error(
          entitlementUpdate.error.message,
        );
      }
    }

    const shareSessionId =
      entitlements.find(
        (item) => item.share_session_id,
      )?.share_session_id || null;

    const shareResult = shareSessionId
      ? await supabaseAdmin
          .from("nearby_share_sessions")
          .select(
            "id,project_id,song_id",
          )
          .eq("id", shareSessionId)
          .maybeSingle()
      : { data: null, error: null };

    if (shareResult.error) {
      throw new Error(
        shareResult.error.message,
      );
    }

    const guestUpdate =
      await supabaseAdmin
        .from("guest_sessions")
        .update({
          status: "claimed",
          claimed_at:
            new Date().toISOString(),
          claimed_by_user_id: user.id,
        })
        .eq("id", guest.id);

    if (guestUpdate.error) {
      throw new Error(
        guestUpdate.error.message,
      );
    }

    const claimKey = idempotencyKey([
      "guest_claim",
      guest.id,
      user.id,
    ]);

    const existingClaim =
      await supabaseAdmin
        .from("guest_account_claims")
        .select("id")
        .eq(
          "idempotency_key",
          claimKey,
        )
        .limit(1)
        .maybeSingle();

    if (existingClaim.error) {
      throw new Error(
        existingClaim.error.message,
      );
    }

    const claimValues = {
      guest_session_id: guest.id,
      user_id: user.id,
      share_session_id:
        shareResult.data?.id || null,
      claim_method:
        existingUserResult.data?.id
          ? "existing_account_email"
          : "email_no_verification",
      status: "completed",
      claimed_email_snapshot: email,
      completed_at:
        new Date().toISOString(),
      idempotency_key: claimKey,
    };

    if (existingClaim.data?.id) {
      const update =
        await supabaseAdmin
          .from("guest_account_claims")
          .update(claimValues)
          .eq(
            "id",
            existingClaim.data.id,
          );

      if (update.error) {
        throw new Error(
          update.error.message,
        );
      }
    } else {
      const insert =
        await supabaseAdmin
          .from("guest_account_claims")
          .insert(claimValues);

      if (insert.error) {
        throw new Error(
          insert.error.message,
        );
      }
    }

    /*
     * Kiiku welcome credit is only for a genuinely new account.
     * Existing users receiving another song should not earn another
     * account-creation reward.
     */
    if (!existingUserResult.data?.id) {
      const ruleResult =
        await supabaseAdmin
          .from("kiiku_rules")
          .select("*")
          .eq("status", "active")
          .eq(
            "action_type",
            "guest_account_claim",
          )
          .limit(1)
          .maybeSingle();

      const amount = Number(
        ruleResult.data?.credit_amount ||
          0,
      );

      if (
        amount > 0 &&
        ruleResult.data?.id
      ) {
        await createKiikuTransaction({
          userId: user.id,
          amount,
          direction: "earn",
          transactionType:
            "welcome_reward",
          reason:
            "Guest account claim",
          idempotencyKey:
            idempotencyKey([
              "kiiku_guest_claim",
              guest.id,
              ruleResult.data.id,
            ]),
          ruleId:
            ruleResult.data.id,
          shareSessionId:
            shareResult.data?.id || null,
          projectId:
            shareResult.data
              ?.project_id || null,
          songId:
            shareResult.data?.song_id ||
            null,
        });
      }
    }

    await setSessionCookie({
      email: user.email,
      username:
        user.username || undefined,
      role: user.role || undefined,
      iat: Date.now(),
    });

    return NextResponse.json({
      ok: true,
      isExistingAccount: Boolean(
        existingUserResult.data?.id,
      ),
      redirectTo: "/apps/music?received=1",
      claimedSongs:
        entitlements.filter(
          (item) => item.song_id,
        ).length,
    });
  } catch (error: unknown) {
    return NextResponse.json(
      {
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : "Could not open your account.",
      },
      { status: 500 },
    );
  }
}
