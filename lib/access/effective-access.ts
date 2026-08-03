import { supabaseAdmin } from "@/lib/supabase-admin";
import { sha256 } from "@/lib/crypto";
import type {
  EffectiveAccessResult,
  AccessMode,
} from "@/types/domain";

type Source = Record<string, unknown> & {
  priority: number;
  accessType: AccessMode;
  accessSource: string;
  expiresAt: string | null;
  playLimit: number | null;
  playsUsed: number | null;
  sharingEligible: boolean;
  sharesRemaining: number;
  downloadPermission: boolean;
  librarySavePermission: boolean;
  refundSensitive: boolean;
  displayLabel: string;
};

function active(row: {
  status?: string | null;
  expires_at?: string | null;
  expiresAt?: string | null;
}) {
  const status = String(row.status || "active");

  if (
    [
      "revoked",
      "refunded",
      "disputed",
      "canceled",
      "expired",
      "reversed",
      "fraud_review",
    ].includes(status)
  ) {
    return false;
  }

  const expiry = row.expires_at || row.expiresAt;
  return !expiry || new Date(expiry).getTime() > Date.now();
}

function baseResult(
  song: Record<string, any> | null,
): EffectiveAccessResult {
  const previewStart = Number(
    song?.preview_starts_at ?? 0,
  );
  const previewDuration = Number(
    song?.preview_duration ?? 30,
  );

  return {
    allowed: Boolean(song),
    accessType: song ? "preview" : "none",
    accessSource: song ? "preview" : "missing_song",
    playbackMode: song ? "preview" : "blocked",
    expiresAt: null,
    playLimit: null,
    playsUsed: null,
    sharingEligible: Boolean(song?.is_shareable),
    sharesRemaining: 0,
    downloadPermission: false,
    librarySavePermission: Boolean(song),
    refundSensitive: false,
    highestPriorityEntitlement: null,
    allContributingSources: [],
    blockedReason: song ? null : "Song not found.",
    displayLabel: song ? "30-second preview" : "Unavailable",
    playbackPath:
      song?.preview_audio_path || song?.audio_path || null,
    previewStartSeconds: song ? previewStart : null,
    previewEndSeconds: song
      ? previewStart + previewDuration
      : null,
  };
}

export async function resolveEffectiveAccess(input: {
  userId?: string | null;
  userEmail?: string | null;
  guestToken?: string | null;
  songId?: string | null;
  songSlug?: string | null;
  requestedAction?:
    | "play"
    | "save"
    | "share"
    | "download"
    | "claim"
    | "unlock";
}): Promise<EffectiveAccessResult> {
  const songQuery = supabaseAdmin
    .from("songs")
    .select(
      "id,slug,title,artist,project_id,app_id,audio_path,preview_audio_path,preview_starts_at,preview_duration,is_locked,is_free_full_play,requires_project_access,requires_all_access,release_at,early_access_at,is_shareable,share_access_mode,default_share_play_limit,default_share_expires_hours,download_enabled,status",
    )
    .limit(1);

  const songResult = input.songId
    ? await songQuery
        .eq("id", input.songId)
        .maybeSingle()
    : await songQuery
        .eq("slug", input.songSlug || "")
        .maybeSingle();

  const song =
    (songResult.data as Record<string, any> | null) ||
    null;
  const fallback = baseResult(song);

  if (!song?.id) return fallback;

  const sources: Source[] = [];
  const userId = input.userId || null;
  const userEmail = input.userEmail || null;
  const projectId = song.project_id || null;
  const now = Date.now();

  if (song.is_free_full_play) {
    sources.push({
      priority: 90,
      accessType: "free_full_play",
      accessSource: "song_rule",
      expiresAt: null,
      playLimit: null,
      playsUsed: null,
      sharingEligible: Boolean(song.is_shareable),
      sharesRemaining: 999,
      downloadPermission: false,
      librarySavePermission: true,
      refundSensitive: false,
      displayLabel: "Free full play",
    });
  }

  if (
    song.release_at &&
    new Date(song.release_at).getTime() <= now &&
    !song.is_locked
  ) {
    sources.push({
      priority: 80,
      accessType: "global_release",
      accessSource: "release_rule",
      expiresAt: null,
      playLimit: null,
      playsUsed: null,
      sharingEligible: Boolean(song.is_shareable),
      sharesRemaining: 999,
      downloadPermission: Boolean(song.download_enabled),
      librarySavePermission: true,
      refundSensitive: false,
      displayLabel: "Globally released",
    });
  }

  if (userId || userEmail) {
    const identityFilter = userId
      ? `user_id.eq.${userId}`
      : `user_email.eq.${userEmail}`;

    const [songAccess, projectAccess, passes, allowances] =
      await Promise.all([
        supabaseAdmin
          .from("user_song_access")
          .select("*")
          .eq("song_id", song.id)
          .or(identityFilter),
        projectId
          ? supabaseAdmin
              .from("user_project_access")
              .select("*")
              .or(identityFilter)
              .eq("project_id", projectId)
          : Promise.resolve({
              data: [] as any[],
              error: null,
            }),
        supabaseAdmin
          .from("user_access_passes")
          .select("*")
          .or(identityFilter),
        supabaseAdmin
          .from("sharing_allowances")
          .select("*")
          .or(
            userId
              ? `user_id.eq.${userId}`
              : `user_email_snapshot.eq.${userEmail}`,
          )
          .in("status", ["active", "reserved"]) as any,
      ]);

    for (const row of songAccess.data || []) {
      if (!active(row)) continue;

      const sourceType = String(
        row.source_type || "purchase",
      );

      const isShared =
        sourceType === "nearby_share" ||
        sourceType === "share_claim";

      const accessType = isShared
        ? ("nearby_claimed_access" as AccessMode)
        : sourceType === "kiiku"
          ? ("kiiku_unlock" as AccessMode)
          : sourceType === "admin"
            ? ("admin_grant" as AccessMode)
            : sourceType === "campaign"
              ? ("promotional_access" as AccessMode)
              : ("purchased_song" as AccessMode);

      sources.push({
        priority: isShared
          ? 96
          : accessType === "admin_grant"
            ? 100
            : accessType === "purchased_song"
              ? 98
              : 94,
        accessType,
        accessSource: sourceType,
        expiresAt: row.expires_at || null,
        playLimit: row.play_limit ?? null,
        playsUsed: row.plays_used ?? null,
        sharingEligible: Boolean(
          row.can_share ?? song.is_shareable,
        ),
        sharesRemaining: countShares(
          allowances.data || [],
          song.id,
          projectId,
        ),
        downloadPermission: Boolean(row.can_download),
        librarySavePermission: true,
        refundSensitive: Boolean(
          row.source_purchase_id,
        ),
        displayLabel: isShared
          ? "Shared with you"
          : accessType === "kiiku_unlock"
            ? "Unlocked with Kiiku"
            : accessType === "admin_grant"
              ? "Admin granted"
              : "Owned",
        row,
      });
    }

    for (const row of projectAccess.data || []) {
      if (!active(row)) continue;

      const sourceType = String(
        row.source_type || row.access_type || "purchase",
      );
      const accessType =
        sourceType === "kiiku"
          ? ("kiiku_unlock" as AccessMode)
          : sourceType === "admin"
            ? ("admin_grant" as AccessMode)
            : sourceType === "campaign"
              ? ("promotional_access" as AccessMode)
              : ("purchased_project" as AccessMode);

      sources.push({
        priority:
          accessType === "admin_grant"
            ? 100
            : accessType === "purchased_project"
              ? 97
              : 93,
        accessType,
        accessSource: sourceType,
        expiresAt: row.expires_at || null,
        playLimit: null,
        playsUsed: null,
        sharingEligible: Boolean(
          row.can_share ?? song.is_shareable,
        ),
        sharesRemaining: countShares(
          allowances.data || [],
          song.id,
          projectId,
        ),
        downloadPermission: Boolean(row.can_download),
        librarySavePermission: true,
        refundSensitive: Boolean(
          row.source_purchase_id,
        ),
        displayLabel:
          accessType === "kiiku_unlock"
            ? "Project unlocked with Kiiku"
            : accessType === "admin_grant"
              ? "Admin granted"
              : "Project owned",
        row,
      });
    }

    for (const row of passes.data || []) {
      if (!active(row)) continue;
      const key = String(row.access_key || "");
      const sourceType = String(
        row.source_type || "subscription",
      );

      sources.push({
        priority: key === "founder" ? 99 : 92,
        accessType:
          sourceType === "admin"
            ? "admin_grant"
            : "subscription",
        accessSource: key || sourceType,
        expiresAt: row.expires_at || null,
        playLimit: null,
        playsUsed: null,
        sharingEligible: Boolean(
          row.can_share ?? false,
        ),
        sharesRemaining: countShares(
          allowances.data || [],
          song.id,
          projectId,
        ),
        downloadPermission: Boolean(row.can_download),
        librarySavePermission: true,
        refundSensitive: Boolean(
          row.source_purchase_id ||
            sourceType === "subscription",
        ),
        displayLabel:
          key === "founder"
            ? "Founder access"
            : "Available with pass",
        row,
      });
    }
  }

  if (input.guestToken) {
    const guest = await supabaseAdmin
      .from("guest_sessions")
      .select("id,status,expires_at")
      .eq(
        "guest_token_hash",
        sha256(input.guestToken),
      )
      .maybeSingle();

    if (guest.data?.id && active(guest.data)) {
      const entitlement = await supabaseAdmin
        .from("guest_one_play_entitlements")
        .select("*")
        .eq("guest_session_id", guest.data.id)
        .eq("song_id", song.id)
        .maybeSingle();

      if (
        entitlement.data &&
        active(entitlement.data) &&
        Number(entitlement.data.plays_used || 0) <
          Number(entitlement.data.play_limit || 1)
      ) {
        sources.push({
          priority: 60,
          accessType: entitlement.data.claimed_by_user_id
            ? "nearby_claimed_access"
            : "nearby_guest_one_play",
          accessSource: "nearby_share",
          expiresAt:
            entitlement.data.expires_at || null,
          playLimit: Number(
            entitlement.data.play_limit || 1,
          ),
          playsUsed: Number(
            entitlement.data.plays_used || 0,
          ),
          sharingEligible: false,
          sharesRemaining: 0,
          downloadPermission: false,
          librarySavePermission: Boolean(
            entitlement.data.claimed_by_user_id,
          ),
          refundSensitive: false,
          displayLabel: entitlement.data
            .claimed_by_user_id
            ? "Shared with you"
            : "One full guest play",
          row: entitlement.data,
        });
      }
    }
  }

  const winner = sources.sort(
    (a, b) => b.priority - a.priority,
  )[0];

  if (!winner) return fallback;

  return {
    allowed: true,
    accessType: winner.accessType,
    accessSource: winner.accessSource,
    playbackMode: "full",
    expiresAt: winner.expiresAt,
    playLimit: winner.playLimit,
    playsUsed: winner.playsUsed,
    sharingEligible: winner.sharingEligible,
    sharesRemaining: winner.sharesRemaining,
    downloadPermission: winner.downloadPermission,
    librarySavePermission: winner.librarySavePermission,
    refundSensitive: winner.refundSensitive,
    highestPriorityEntitlement: winner,
    allContributingSources: sources,
    blockedReason: null,
    displayLabel: winner.displayLabel,
    playbackPath: song.audio_path || null,
    previewStartSeconds: null,
    previewEndSeconds: null,
  };
}

function countShares(
  rows: any[],
  songId: string,
  projectId: string | null,
) {
  const now = Date.now();

  return rows
    .filter(
      (row) =>
        !row.expires_at ||
        new Date(row.expires_at).getTime() > now,
    )
    .filter((row) =>
      ["active", "reserved"].includes(
        String(row.status || "active"),
      ),
    )
    .filter(
      (row) =>
        row.scope === "universal" ||
        row.song_id === songId ||
        (projectId && row.project_id === projectId),
    )
    .reduce(
      (sum, row) =>
        sum +
        Math.max(
          0,
          Number(
            row.remaining_count ??
              row.total_allowed ??
              0,
          ) - Number(row.reserved_count ?? 0),
        ),
      0,
    );
}
