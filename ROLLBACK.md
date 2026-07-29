# Rollback Guide

This build is additive. Do not delete production rows to roll back.

Safe rollback order:

1. Hide or disable Nearby Sharing in UI/Admin.
2. Stop creating guest entitlements.
3. Disable Kiiku spending rules.
4. Pause Kiiku earning rules.
5. Hide project progress modules.
6. Use old Music flows if needed.
7. Keep Stripe webhook active for purchases, refunds, and disputes.
8. Keep all additive schema and historical rows.

Run `supabase/verification/rollback_verification.sql` and compare with pre-migration counts.

Never roll back by deleting:

- purchases
- entitlements
- Kiiku transactions
- project contributions
- share sessions
- guest claims
- audit logs
