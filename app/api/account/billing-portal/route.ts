import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { verifySession } from "@/lib/session";
import { stripe } from "@/lib/stripe";
import { supabaseAdmin } from "@/lib/supabase-admin";

function normalizeEmail(value: string | null | undefined) {
  return String(value || "").trim().toLowerCase();
}

function getBaseUrl(req: Request) {
  const envUrl = process.env.NEXT_PUBLIC_SITE_URL;
  const originUrl = req.headers.get("origin");
  let baseUrl = envUrl || originUrl || "http://localhost:3000";

  if (!/^https?:\/\//i.test(baseUrl)) {
    baseUrl = `https://${baseUrl}`;
  }

  return baseUrl.replace(/\/$/, "");
}

export async function POST(req: Request) {
  const cookieStore = await cookies();
  const session = verifySession(cookieStore.get("caliph_os_session")?.value);

  if (!session?.email) {
    return NextResponse.json(
      { ok: false, error: "You need to sign in first." },
      { status: 401 }
    );
  }

  const email = normalizeEmail(session.email);
  const baseUrl = getBaseUrl(req);

  const purchaseRes = await supabaseAdmin
    .from("purchases")
    .select("stripe_customer_id")
    .eq("user_email", email)
    .not("stripe_customer_id", "is", null)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (purchaseRes.error) {
    return NextResponse.json(
      { ok: false, error: purchaseRes.error.message },
      { status: 500 }
    );
  }

  let customerId = purchaseRes.data?.stripe_customer_id || null;

  if (!customerId) {
    const customers = await stripe.customers.list({
      email,
      limit: 1,
    });

    customerId = customers.data[0]?.id || null;
  }

  if (!customerId) {
    return NextResponse.json(
      {
        ok: false,
        error:
          "No Stripe billing profile was found for this account yet. This usually appears after the first subscription purchase.",
      },
      { status: 404 }
    );
  }

  const portalSession = await stripe.billingPortal.sessions.create({
    customer: customerId,
    return_url: `${baseUrl}/apps/account`,
  });

  return NextResponse.json({
    ok: true,
    url: portalSession.url,
  });
}
