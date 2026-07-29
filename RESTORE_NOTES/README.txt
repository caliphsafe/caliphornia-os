Caliphornia OS Restoration Merge 43 Build

Purpose:
- Restore the original app-specific visual experiences.
- Keep the new payment, access, Kiiku, Nearby Sharing, guest one-play, project goal, stats, and signed audio functionality.

Files included:
- app/home/page.tsx
- components/HomeScreen.tsx
- components/GlobalPlayer.tsx
- app/globals.css
- app/apps/fartherhood/page.tsx
- app/apps/friends/page.tsx
- app/apps/friends/[slug]/page.tsx
- components/FriendsInboxLoader.tsx
- components/FriendsThreadLoader.tsx
- app/apps/milia/page.tsx
- app/apps/stats/page.tsx

Upload instructions:
1. Upload these files to the same paths in GitHub.
2. Do not upload package-lock.json.
3. Let Vercel redeploy.
4. Test in an incognito/private window.

What this restores:
- FarTHErHOOD returns to the Notes-style app using FartherhoodClient and style.css.
- Fri.ends returns to the Messages-style app using FriendsInboxClient, FriendsThreadClient, and friends.css.
- Milia returns to the Weather-style listing and keeps the existing detail weather pages.
- Stats returns to the Activity-style ring/card experience using stats.module.css.
- Home returns to an Apple-style OS screen with original app icons and a dock.
- GlobalPlayer supports the original app player messages plus the new /api/playback/start secure access route.
