import { NextResponse } from "next/server";
import { requireCurrentAppUser } from "@/lib/users";
import { getKiikuWallet } from "@/lib/kiiku/ledger";
export async function GET() { const user = await requireCurrentAppUser(); return NextResponse.json({ ok:true, wallet: await getKiikuWallet(user.id) }); }
