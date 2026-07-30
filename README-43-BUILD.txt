CALIPHORNIA OS — UX, SHARE, MUSIC & ADMIN 43 BUILD

THIS BUILD ADDRESSES

- Admin header content no longer floats over dashboard content.
- Admin utility links are integrated into a structured header.
- Admin section navigation stays readable without covering content.
- Music library no longer depends on the optional songs.position column.
- Song data failures are displayed rather than silently appearing as an empty app.
- Share buttons follow one consistent UX:
  choose content -> open Share app -> review selection -> request location -> start transfer.
- songs.id remains the canonical database identifier.
- songSlug remains only a lookup/navigation fallback.
- Share Stats is positioned before Rankings.
- Rankings remains the final Stats navigation destination.
- Share rankings use actual shareStats data, not listening totals.
- No package-lock.json is included.

UPLOAD

1. Upload the app, components, and lib folders from this ZIP, preserving paths.
2. Complete the exact replacements in PATCH-REQUIRED-EXISTING-FILES.txt.
3. Commit all changes together to main.
4. Let Vercel redeploy.

There is no SQL migration in this build.
