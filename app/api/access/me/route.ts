import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { verifySession } from "@/lib/session";
import { getUserAccess } from "@/lib/access";

function normalizeValue(value: string | null | undefined) {
  return String(value || "").trim().toLowerCase();
}

export async function GET(req: Request) {
  const cookieStore = await cookies();
  const session = verifySession(cookieStore.get("caliph_os_session")?.value);

  if (!session?.email) {
    return NextResponse.json(
      {
        ok: false,
        signedIn: false,
        hasKiikuPass: false,
        hasProjectAccess: false,
      },
      { status: 401 }
    );
  }

  const url = new URL(req.url);
  const projectSlug = normalizeValue(url.searchParams.get("projectSlug"));
  const access = await getUserAccess(session.email);

  const hasKiikuPass = Boolean(access.hasAllAccess || access.isFounder);

  const hasProjectAccess = Boolean(
    projectSlug &&
      (hasKiikuPass || access.projectAccess.includes(projectSlug))
  );

  return NextResponse.json({
    ok: true,
    signedIn: true,
    email: normalizeValue(session.email),
    hasKiikuPass,
    hasProjectAccess,
    hasAllAccess: access.hasAllAccess,
    hasMusicFull: access.hasMusicFull,
    isFounder: access.isFounder,
    projectAccess: access.projectAccess,
  });
}
