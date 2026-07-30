Caliphornia OS Share Link Receiver 43 Patch

Purpose:
- Fix the receiver flow so a recipient does not need an account or access to /apps/share.
- Keep the signed-in Share app for senders.
- Create a public /unlock?share=... activation screen for recipients.
- Prevent duplicate Share/Account buttons on Share, Account, Guest, Unlock, Home, and root screens.

Files included:
- app/api/share/start/route.ts
- app/api/share/claim/route.ts
- app/unlock/page.tsx
- components/share/ShareClient.tsx
- components/share/ShareUnlockClient.tsx
- components/GlobalQuickActions.tsx
- components/guest/GuestPlayer.tsx
- app/globals.css
- app/apps/share/share.css

Upload instructions:
1. Upload these files to the same paths in GitHub.
2. Do not upload package-lock.json.
3. Let Vercel redeploy.
4. Test with one signed-in sender and one incognito receiver.

Test:
- Sender signs in, opens Share, starts a song or project Share.
- Sender sends the /unlock?share=... link.
- Receiver opens the link without signing in.
- Receiver is routed to the guest player.
- Share and Account shortcut buttons should not appear twice on Share or Account pages.
