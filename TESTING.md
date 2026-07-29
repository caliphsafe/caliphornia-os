# Testing Utilities

Run:

`npm run verify:files`

Manual QA matrix:

- Sign in with email
- Open Music library
- Play preview
- Play owned song
- Create commerce product
- Start checkout
- Complete Stripe test payment
- Confirm webhook creates purchase, line item, access, Kiiku, contribution, and share allowance
- Start Nearby Share
- Receive Nearby without email
- Complete guest play
- Claim account with email code
- Confirm Music shows Shared with you
- Confirm Stats shows My Activity and Global Activity
- Confirm normal user cannot access `/dashboard`
- Confirm admin can view dashboard
- Test refund webhook and verify access/Kiiku/contribution reversal
