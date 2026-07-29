import { NextResponse } from "next/server";
import { requireCurrentAppUser } from "@/lib/users";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { stripe } from "@/lib/stripe";
import { requiredEnv } from "@/lib/env";
export async function POST() {
  try {
    const user = await requireCurrentAppUser();
    const purchase = await supabaseAdmin.from("purchases").select("stripe_customer_id").eq("user_id", user.id).not("stripe_customer_id", "is", null).order("created_at", { ascending:false }).limit(1).maybeSingle();
    if (!purchase.data?.stripe_customer_id) return NextResponse.json({ ok:false, error:"No billing customer found." }, { status:404 });
    const portal = await stripe.billingPortal.sessions.create({ customer: purchase.data.stripe_customer_id, return_url: `${requiredEnv("NEXT_PUBLIC_SITE_URL")}/apps/account` });
    return NextResponse.json({ ok:true, url: portal.url });
  } catch { return NextResponse.json({ ok:false, error:"Could not open billing portal." }, { status:500 }); }
}
