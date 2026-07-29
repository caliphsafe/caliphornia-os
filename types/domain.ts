export type Json = Record<string, unknown> | unknown[] | string | number | boolean | null;

export type AccessMode =
  | "none"
  | "preview"
  | "free_full_play"
  | "global_release"
  | "purchased_song"
  | "purchased_project"
  | "subscription"
  | "kiiku_unlock"
  | "promotional_access"
  | "admin_grant"
  | "nearby_guest_one_play"
  | "nearby_claimed_access";

export type EffectiveAccessResult = {
  allowed: boolean;
  accessType: AccessMode;
  accessSource: string;
  playbackMode: "full" | "preview" | "blocked";
  expiresAt: string | null;
  playLimit: number | null;
  playsUsed: number | null;
  sharingEligible: boolean;
  sharesRemaining: number;
  downloadPermission: boolean;
  librarySavePermission: boolean;
  refundSensitive: boolean;
  highestPriorityEntitlement: Record<string, unknown> | null;
  allContributingSources: Record<string, unknown>[];
  blockedReason: string | null;
  displayLabel: string;
  playbackPath: string | null;
  previewStartSeconds: number | null;
  previewEndSeconds: number | null;
};

export type AppUser = {
  id: string;
  email: string;
  username?: string | null;
  role?: string | null;
};
