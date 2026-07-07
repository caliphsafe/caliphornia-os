import Stripe from "stripe";
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { verifySession } from "@/lib/session";
import { stripe } from "@/lib/stripe";

type AccessPlan = "project" | "kiiku_pass_30d" | "supporter_subscription";

const PROJECT_NAMES: Record<string, string> = {
  friends: "Fri.ends",
  fartherhood: "FarTHErHOOD",
  fatherhood: "FarTHErHOOD",
  milia: "Milia",
  music: "Music",
};

function normalizeEmail(value: string | null | undefined) {
  return String(value || "").trim().toLowerCase();
}

function normalizeValue(value: string | null | undefined) {
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

function isAccessPlan(value: unknown): value is AccessPlan {
  return (
    value === "project" ||
    value === "kiiku_pass_30d" ||
    value === "supporter_subscription"
  );
}

export async function POST(req: Request) {
  try {
    const cookieStore = await cookies();
    const session = verifySession(cookieStore.get("caliph_os_session")?.value);

    if (!session?.email) {
      return NextResponse.json(
        { ok: false, error: "You need to sign in first." },
        { status: 401 }
      );
    }

    const body = await req.json();
    const plan = body?.plan;

    if (!isAccessPlan(plan)) {
      return NextResponse.json(
        { ok: false, error: "Invalid access plan." },
        { status: 400 }
      );
    }

    const userEmail = normalizeEmail(session.email);
    const projectSlug = normalizeValue(body?.projectSlug);
    const baseUrl = getBaseUrl(req);

    if (plan === "project" && !projectSlug) {
      return NextResponse.json(
        { ok: false, error: "Missing project." },
        { status: 400 }
      );
    }

    const successUrl = `${baseUrl}/apps/account?checkout=success`;
    const cancelUrl = `${baseUrl}/home?checkout=cancelled`;

    if (plan === "project") {
      const projectName = PROJECT_NAMES[projectSlug] || "Album Experience";

      const metadata = {
        user_email: userEmail,
        purchase_type: "project",
        project_slug: projectSlug,
        access_key: "",
        duration_days: "",
        kiiku_credits: "5",
      };

      const checkoutSession = await stripe.checkout.sessions.create({
        mode: "payment",
        customer_email: userEmail,
        client_reference_id: userEmail,
        line_items: [
          {
            quantity: 1,
            price_data: {
              currency: "usd",
              unit_amount: 499,
              product_data: {
                name: `${projectName} Unlock`,
                description:
                  "Permanent access to this album experience inside Caliphornia OS.",
                metadata,
              },
            },
          },
        ],
        metadata,
        payment_intent_data: {
          metadata,
        },
        allow_promotion_codes: true,
        success_url: successUrl,
        cancel_url: cancelUrl,
      } satisfies Stripe.Checkout.SessionCreateParams);

      return NextResponse.json({
        ok: true,
        url: checkoutSession.url,
      });
    }

    if (plan === "kiiku_pass_30d") {
      const metadata = {
        user_email: userEmail,
        purchase_type: "kiiku_pass_30d",
        project_slug: "",
        access_key: "all_access",
        duration_days: "30",
        kiiku_credits: "4",
      };

      const checkoutSession = await stripe.checkout.sessions.create({
        mode: "payment",
        customer_email: userEmail,
        client_reference_id: userEmail,
        line_items: [
          {
            quantity: 1,
            price_data: {
              currency: "usd",
              unit_amount: 399,
              product_data: {
                name: "30-Day Kiiku Pass",
                description:
                  "30 days of full access across current Caliphornia OS apps.",
                metadata,
              },
            },
          },
        ],
        metadata,
        payment_intent_data: {
          metadata,
        },
        allow_promotion_codes: true,
        success_url: successUrl,
        cancel_url: cancelUrl,
      } satisfies Stripe.Checkout.SessionCreateParams);

      return NextResponse.json({
        ok: true,
        url: checkoutSession.url,
      });
    }

    const metadata = {
      user_email: userEmail,
      purchase_type: "subscription",
      project_slug: "",
      access_key: "all_access",
      duration_days: "",
      kiiku_credits: "4",
    };

    const checkoutSession = await stripe.checkout.sessions.create({
      mode: "subscription",
      customer_email: userEmail,
      client_reference_id: userEmail,
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: "usd",
            unit_amount: 399,
            recurring: {
              interval: "month",
            },
            product_data: {
              name: "Monthly Kiiku Pass",
              description:
                "Monthly full access across current Caliphornia OS apps.",
              metadata,
            },
          },
        },
      ],
      metadata,
      subscription_data: {
        metadata,
      },
      allow_promotion_codes: true,
      success_url: successUrl,
      cancel_url: cancelUrl,
    } satisfies Stripe.Checkout.SessionCreateParams);

    return NextResponse.json({
      ok: true,
      url: checkoutSession.url,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Checkout could not be started.";

    return NextResponse.json(
      { ok: false, error: message },
      { status: 500 }
    );
  }
}
