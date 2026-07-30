CALIPHORNIA OS — HOME, STATS, FRIENDS & SHARE 43 BUILD

THIS BUILD

- Removes the framed phone container from Home.
- Makes Home fill the viewport like an actual iPhone Home Screen.
- Replaces the Home Share/Account text pills with an unobtrusive profile entry
  and the existing app/dock structure.
- Prevents onboarding tips from opening automatically.
- Makes the ? control smaller and less intrusive.
- Standardizes universal Home, Music, Share, and Account navigation.
- Keeps universal navigation in normal document flow instead of over content.
- Makes all five Stats links fit on one line.
- Places Share before Rankings and keeps Rankings last.
- Restructures Friends so the top bar and composer reserve their own space.
- Removes the oversized fake bottom spacer in Friends.
- Adds one reusable song-level Share link design.
- Defines Share placement for every song in Friends, FarTHErHOOD, and Milia.
- Includes no package-lock.json and no SQL migration.

UPLOAD COMPLETE FILES

- components/HomeScreen.tsx
- components/OnboardingTips.tsx
- components/GlobalQuickActions.tsx
- components/music/InlineSongShareLink.tsx
- lib/share-navigation.ts

THEN COMPLETE

- Append APPEND-TO-app-globals.css to app/globals.css
- Follow PATCH-REQUIRED-EXISTING-FILES.txt exactly

Commit all changes together to main and allow Vercel to redeploy.
