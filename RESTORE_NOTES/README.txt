Caliphornia OS Share System 43 Build Patch

Purpose:
- Keep the restored Apple/iOS app world intact.
- Upgrade Share into a signature Caliphornia OS experience.
- Let signed-in users browse projects, share one song, or share a full project.
- A full project Share gives the guest one full listen per song in that project.
- Give the recipient clear instructions: open Caliphornia OS, go to Share, tap Receive, then accept the transfer.
- Keep account/settings and Share accessible everywhere through non-overlapping global quick actions.
- Continue using the current Stripe commerce product checkout system for locked projects.
- Normalize major app page widths and spacing so desktop and mobile feel more uniform.

Files included:
- app/layout.tsx
- app/globals.css
- lib/app-registry.ts
- components/HomeScreen.tsx
- components/GlobalQuickActions.tsx
- app/apps/share/page.tsx
- app/apps/share/share.css
- components/share/ShareClient.tsx
- lib/share/share-access.ts
- app/api/share/library/route.ts
- app/api/share/start/route.ts
- app/api/nearby/receive/candidates/route.ts
- app/api/nearby/receive/confirm/route.ts
- app/api/guest/audio-url/route.ts
- app/api/guest/playback/complete/route.ts
- app/guest/[token]/page.tsx
- components/guest/GuestPlayer.tsx

Also retained from the previous functional restore patch:
- Calendar restore files
- Stats restore files
- Account/Wallet settings files
- FarTHErHOOD/Fri.ends restore loaders
- restored GlobalPlayer

Upload instructions:
1. Upload every file to the exact same GitHub path.
2. Do not upload package-lock.json.
3. Let Vercel redeploy.
4. Test in an incognito/private window.

QA order:
1. Home screen dock labels.
2. Global Share and Account quick actions on each app page.
3. Share Send, song mode.
4. Share Send, full project mode.
5. Share Receive from another browser/device.
6. Guest player one listen per song.
7. Claim guest listen into Music.
8. Locked project unlock button opens Stripe checkout.
9. Calendar, Stats, Account, Music, Fri.ends, FarTHErHOOD, and Milia still keep their restored iOS personalities.
