CALIPHORNIA OS — CANONICAL INVITE SYSTEM 43 BUILD

WHAT THIS BUILD FIXES

1. Removes the duplicate /invite/[token] route that conflicts with /invite/[code].
2. Removes the older API that queries the nonexistent admin_invite_links.token column.
3. Keeps one database model: invite_code + token_hash.
4. Makes invite use-count updates concurrency-safe.
5. Standardizes admin audit logging on action_type.
6. Adds one repair migration for clean, partially migrated, and legacy databases.

UPLOAD STEPS

1. Open the ZIP.
2. In GitHub, delete every file listed in DELETE_THESE_FILES.txt.
3. Upload the app, components, and supabase folders from this ZIP, preserving paths.
4. In Supabase SQL Editor, run:
   supabase/migrations/012_canonical_invite_system.sql
5. Commit the GitHub changes.
6. Vercel will redeploy automatically.

IMPORTANT

Do not rerun the old conflicting 011 migration after applying this build.
Do not add a token column.
Do not keep both [token] and [code] routes.
No package-lock.json is included.
