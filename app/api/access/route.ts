import { NextRequest, NextResponse } from "next/server";
import { getOrCreateAppUser } from "@/lib/users";
import { normalizeEmail } from "@/lib/crypto";
import { setSessionCookie } from "@/lib/session";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const email = normalizeEmail(String(body.email || ""));
    const username = String(body.username || "").trim() || email.split("@")[0];
    if (!email.includes("@")) return NextResponse.json({ ok:false, error:"Enter a valid email." }, { status:400 });
    const user = await getOrCreateAppUser(email, username);
    await setSessionCookie({ email: user.email, username: user.username || username, role: user.role || undefined, iat: Date.now() });
    return NextResponse.json({ ok:true, user: { id: user.id, email: user.email, username: user.username } });
  } catch {
    return NextResponse.json({ ok:false, error:"Could not sign in." }, { status:500 });
  }
}
