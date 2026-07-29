import { NextResponse } from "next/server";
import { getCurrentAppUser } from "@/lib/users";
import { getKiikuWallet } from "@/lib/kiiku/ledger";

export async function GET() {
  const user = await getCurrentAppUser();
  if (!user) return NextResponse.json({ ok:false, error:"Not signed in." }, { status:401 });
  const wallet = await getKiikuWallet(user.id);
  return NextResponse.json({ ok:true, user, wallet });
}
