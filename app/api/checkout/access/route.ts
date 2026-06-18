import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { stripe } from "@/lib/stripe";
import { verifySession } from "@/lib/session";

type AccessPlan = "project" | "kiiku_pass_30d" | "supporter_subscription";

type ProjectCheckoutCopy = {
  name: string;
  creditCost: number;
  amountCents: number;
};

const PROJECTS: Record<string, ProjectCheckoutCopy> = {
  friends: {
    name: "Fri.ends",
    creditCost: 5,
    amountCents: 499,
  },
  fartherhood: {
    name: "FarTHErHOOD",
    creditCost: 5,
    amountCents: 499,
  },
  fatherhood: {
    name: "FarTHErHOOD",
    creditCost: 5,
    amountCents: 499,
  },
  milia: {
    name: "Milia",
    creditCost: 5,
    amountCents: 499,
  },
  music: {
    name: "Music",
    creditCost: 5,
    amountCents: 499,
  },
};

function normalizeSiteUrl(value: string) {
  const trimmed = value.trim().replace(/\/$/, "");

  if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) {
    return trimmed;
  }

  return `https://${trimmed}`;
}

function getSiteUrl() {
  const explicit = process.env.NEXT_PUBLIC_SITE_URL;

  if (explicit) {
    return normalizeSiteUrl(explicit);
  }

  if (process.env.VERCEL_PROJECT_PRODUCTION_URL) {
    return normalizeSiteUrl(process.env.VERCEL_PROJECT_PRODUCTION_URL);
  }

  if (process.env.VERCEL_URL) {
    return normalizeSiteUrl(process.env.VERCEL_URL);
  }

  return "http://localhost:3000";
}

function normalizeValue(value: unknown) {
  return String(value || "").trim().toLowerCase();
}

export async function POST(req: Request) {
  try {
    const cookieStore = await cookies();
    const session = verifySession(cookieStore.get("caliph_os_session")?.value);

    if (!session?.email) {
      return NextResponse.json(
        { ok: false, error: "You need to sign in before checkout." },
        { status: 401 }
      );
    }

    const body = await req.json();
    const plan = normalizeValue(body?.plan) as AccessPlan;
    const requestedProjectSlug = normalizeValue(body?.projectSlug);
    const siteUrl = getSiteUrl();
    const userEmail = normalizeValue(session.email);

    if (plan === "project") {
      const project = PROJECTS[requestedProjectSlug];

      if (!project) {
        return NextResponse.json(
          { ok: false, error: "Unknown project." },
          { status: 400 }
        );
      }

      const metadata = {
        user_email: userEmail,
        purchase_type: "project",
        project_slug: requestedProjectSlug,
        access_key: "",
        kiiku_credits: String(project.creditCost),
      };

      const checkoutSession = await stripe.checkout.sessions.create({
        mode: "payment",
        customer_email: userEmail,
        client_reference_id: userEmail,
        allow_promotion_codes: true,
        line_items: [
          {
            quantity: 1,
            price_data: {
              currency: "usd",
              unit_amount: project.amountCents,
              product_data: {
                name: `${project.name} Kiiku Unlock`,
                description: `${project.creditCost} Kiiku Credits unlock the full ${project.name} album experience.`,
              },
            },
          },
        ],
        metadata,
        payment_intent_data: {
          metadata,
        },
        success_url: `${siteUrl}/access/success?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${siteUrl}/access/cancel`,
      });

      return NextResponse.json({ ok: true, url: checkoutSession.url });
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
        allow_promotion_codes: true,
        line_items: [
          {
            quantity: 1,
            price_data: {
              currency: "usd",
              unit_amount: 399,
              product_data: {
                name: "Kiiku Pass - 30 Days",
                description:
                  "4 Kiiku Credits unlock full Caliphornia OS access for 30 days.",
              },
            },
          },
        ],
        metadata,
        payment_intent_data: {
          metadata,
        },
        success_url: `${siteUrl}/access/success?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${siteUrl}/access/cancel`,
      });

      return NextResponse.json({ ok: true, url: checkoutSession.url });
    }

    if (plan === "supporter_subscription") {
      const metadata = {
        user_email: userEmail,
        purchase_type: "subscription",
        project_slug: "",
        access_key: "all_access",
        kiiku_credits: "4",
      };

      const checkoutSession = await stripe.checkout.sessions.create({
        mode: "subscription",
        customer_email: userEmail,
        client_reference_id: userEmail,
        allow_promotion_codes: true,
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
                name: "Kiiku Pass - Monthly",
                description:
                  "Monthly full Caliphornia OS access with auto-renew turned on.",
              },
            },
          },
        ],
        metadata,
        subscription_data: {
          metadata,
        },
        success_url: `${siteUrl}/access/success?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${siteUrl}/access/cancel`,
      });

      return NextResponse.json({ ok: true, url: checkoutSession.url });
    }

    return NextResponse.json(
      { ok: false, error: "Unknown access plan." },
      { status: 400 }
    );
  } catch (error) {
    console.error("Checkout error:", error);

    return NextResponse.json(
      { ok: false, error: "Checkout could not be started." },
      { status: 500 }
    );
  }
}
