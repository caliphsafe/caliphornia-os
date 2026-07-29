import { NextRequest, NextResponse } from "next/server";
import { getCurrentAppUser } from "@/lib/users";
import { getUserAccess } from "@/lib/access";
import { getKiikuWallet } from "@/lib/kiiku/ledger";

function normalizeValue(value: string | null | undefined) {
  return String(value || "").trim().toLowerCase();
}

export async function GET(req: NextRequest) {
  const user = await getCurrentAppUser();

  if (!user) {
    return NextResponse.json(
      {
        ok: false,
        signedIn: false,
        hasKiikuPass: false,
        hasProjectAccess: false,
        hasAllAccess: false,
        hasMusicFull: false,
        isFounder: false,
        projectAccess: []
      },
      { status: 401 }
    );
  }

  const url = new URL(req.url);
  const projectSlug = normalizeValue(url.searchParams.get("projectSlug"));
  const access = await getUserAccess(user.email);
  const wallet = await getKiikuWallet(user.id).catch(() => null);
  const hasKiikuPass = Boolean(access.hasAllAccess || access.isFounder || access.hasMusicFull);
  const hasProjectAccess = Boolean(
    projectSlug &&
      (hasKiikuPass || access.projectAccess.includes(projectSlug))
  );

  return NextResponse.json({
    ok: true,
    signedIn: true,
    user,
    email: user.email,
    hasKiikuPass,
    hasProjectAccess,
    hasAllAccess: access.hasAllAccess,
    hasMusicFull: access.hasMusicFull,
    isFounder: access.isFounder,
    projectAccess: access.projectAccess,
    wallet
  });
}
