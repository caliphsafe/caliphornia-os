import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { verifySession } from "@/lib/session";
import { stripe } from "@/lib/stripe";

type CheckoutPlan = "project" | "supporter";
type ProjectSlug = "fartherhood" | "friends" | "milia" | "music";

const PROJECTS: Record<
  ProjectSlug,
  {
    name: string;
    description: string;
  }
> = {
  fartherhood: {
    name: "FarTHErHOOD",
    description: "Full FarTHErHOOD project access, songs, lyrics, and experience.",
  },
  friends: {
    name: "Fri.ends",
    description: "Full Fri.ends conversation, song, and audio bubble experience.",
  },
  milia: {
    name: "Milia",
    description: "Full Milia weather-based music experience.",
  },
  music: {
    name: "Music",
    description: "Full Caliphornia music library experience.",
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

export async function POST(req: Request) {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get("caliph_os_session")?.value ?? "";
    const session = verifySession(token);

    if (!session?.email) {
      return NextResponse.json(
        { ok: false, error: "Unauthorized." },
        { status: 401 }
      );
    }

    const body = await req.json().catch(() => null);

    const plan = body?.plan as CheckoutPlan | undefined;
    const projectSlug = body?.projectSlug as ProjectSlug | undefined;

    if (plan !== "project" && plan !== "supporter") {
      return NextResponse.json(
        { ok: false, error: "Invalid checkout plan." },
        { status: 400 }
      );
    }

    if (plan === "project" && (!projectSlug || !PROJECTS[projectSlug])) {
      return NextResponse.json(
        { ok: false, error: "Invalid project." },
        { status: 400 }
      );
    }

    const siteUrl = getSiteUrl();
    const userEmail = session.email.trim().toLowerCase();

    const successUrl = `${siteUrl}/access/success?session_id={CHECKOUT_SESSION_ID}`;
    const cancelUrl = `${siteUrl}/access/cancel`;

    if (plan === "project") {
      const project = PROJECTS[projectSlug as ProjectSlug];

      const checkoutSession = await stripe.checkout.sessions.create({
        mode: "payment",
        customer_email: userEmail,
        client_reference_id: userEmail,
        success_url: successUrl,
        cancel_url: cancelUrl,
        allow_promotion_codes: true,
        line_items: [
          {
            quantity: 1,
            price_data: {
              currency: "usd",
              unit_amount: 499,
              product_data: {
                name: `${project.name} Access`,
                description: project.description,
              },
            },
          },
        ],
        metadata: {
          user_email: userEmail,
          purchase_type: "project",
          project_slug: projectSlug as string,
          access_key: "",
        },
      });

      return NextResponse.json({
        ok: true,
        url: checkoutSession.url,
      });
    }

    const checkoutSession = await stripe.checkout.sessions.create({
      mode: "subscription",
      customer_email: userEmail,
      client_reference_id: userEmail,
      success_url: successUrl,
      cancel_url: cancelUrl,
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
              name: "Caliphornia OS Supporter Pass",
              description:
                "Unlock all current Caliphornia OS projects while subscribed.",
            },
          },
        },
      ],
      metadata: {
        user_email: userEmail,
        purchase_type: "subscription",
        project_slug: "",
        access_key: "all_access",
      },
      subscription_data: {
        metadata: {
          user_email: userEmail,
          purchase_type: "subscription",
          access_key: "all_access",
        },
      },
    });

    return NextResponse.json({
      ok: true,
      url: checkoutSession.url,
    });
  } catch (error: any) {
    return NextResponse.json(
      { ok: false, error: error?.message || "Checkout error." },
      { status: 500 }
    );
  }
}
