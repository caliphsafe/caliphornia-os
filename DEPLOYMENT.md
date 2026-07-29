# Deployment Guide

## 1. Upload files to GitHub

Replace the project files with this build. Do not upload `package-lock.json`.

## 2. Supabase setup

Open Supabase SQL Editor and run:

1. `supabase/migrations/000_preflight_schema_report.sql`
2. Save the counts for rollback comparison.
3. `supabase/migrations/001_caliphornia_os_ecosystem.sql`
4. `supabase/migrations/002_seed_defaults.sql`
5. `supabase/verification/post_migration_checks.sql`

Review any missing canonical IDs before launching new features.

## 3. Storage buckets

Create private buckets as needed:

- `songs`
- `cover-art`
- `visuals`
- `admin-uploads`

Audio should not be public. The app creates short-lived signed URLs after server-side access checks.

## 4. Vercel environment variables

Set all required variables from `.env.example`.

Required for production:

- `NEXT_PUBLIC_SITE_URL`
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `SESSION_SECRET`
- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`

Optional for guest claim emails:

- `EMAIL_PROVIDER_WEBHOOK_URL`
- `EMAIL_FROM`

## 5. Stripe webhook

Point Stripe to:

`https://your-domain.com/api/stripe/webhook`

Listen for:

- `checkout.session.completed`
- `invoice.paid`
- `invoice.payment_failed`
- `customer.subscription.updated`
- `customer.subscription.deleted`
- `charge.refunded`
- `charge.dispute.created`

## 6. Admin setup

Set an admin user in Supabase:

- Find the user in `app_users`
- Set `role = 'admin'`

Then visit `/dashboard`.

## 7. Launch order

1. Deploy with new migrations.
2. Smoke test login, Music, playback, Stats, dashboard.
3. Create commerce products in `commerce_products`.
4. Create project goals in Admin/Supabase.
5. Test Stripe checkout with a small product.
6. Test Nearby Sharing with QA accounts.
7. Enable public sharing gradually.
