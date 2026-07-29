import { NextResponse } from "next/server";
import { getProjectProgress } from "@/lib/projects/progress";
export async function GET(_req: Request, { params }: { params: Promise<{ slug: string }> }) { const { slug } = await params; return NextResponse.json({ ok:true, progress: await getProjectProgress(slug) }); }
