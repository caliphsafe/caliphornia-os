import { NextRequest, NextResponse } from "next/server";
import { getCurrentAppUser } from "@/lib/users";
import { resolveEffectiveAccess } from "@/lib/access/effective-access";

export async function GET(req: NextRequest) {
  const user = await getCurrentAppUser();
  const url = new URL(req.url);
  const access = await resolveEffectiveAccess({ userId: user?.id, userEmail: user?.email, songId: url.searchParams.get("songId"), songSlug: url.searchParams.get("songSlug") });
  return NextResponse.json({ ok:true, access });
}
