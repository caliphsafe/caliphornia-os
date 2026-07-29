import { NextRequest, NextResponse } from "next/server";
import { requireCurrentAppUser } from "@/lib/users";
import { getStats } from "@/lib/stats/queries";
export async function GET(req: NextRequest) { const user = await requireCurrentAppUser(); const range = new URL(req.url).searchParams.get("range") || "30d"; return NextResponse.json({ ok:true, stats: await getStats(user.id, range) }); }
