# Caliphornia OS 43 Build

This build implements the approved Caliphornia OS architecture as an additive, canonical-ID-safe Next.js/Supabase/Stripe project.

Included systems:

- Canonical ID extensions and backfills
- Effective access resolver
- Music library compatibility
- Verified Stripe webhook processing
- Idempotent purchase effects
- Project release goals and contributions
- Kiiku ledger, wallet, and rule framework
- Sharing allowances
- Nearby Sharing without QR codes
- Guest one-play listening and resume-safe entitlement model
- Guest account claim with one-time code
- Qualified shares and Kiiku share rewards
- Personal and global Stats
- Admin dashboard foundation
- Audit logs and security protections

No `package-lock.json` is included.

## Important

Run the SQL files in order and review verification outputs before enabling public Nearby Sharing or Kiiku rewards.

1. `supabase/migrations/000_preflight_schema_report.sql`
2. `supabase/migrations/001_caliphornia_os_ecosystem.sql`
3. `supabase/migrations/002_seed_defaults.sql`
4. `supabase/verification/post_migration_checks.sql`

The frontend success page is read-only. Payment completion is driven only by the verified Stripe webhook.
