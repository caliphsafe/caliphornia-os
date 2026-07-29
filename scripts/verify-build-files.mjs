import fs from 'node:fs';
const required = ['package.json','app/layout.tsx','app/api/stripe/webhook/route.ts','supabase/migrations/001_caliphornia_os_ecosystem.sql','.env.example','README.md','DEPLOYMENT.md','ROLLBACK.md'];
let ok = true;
for (const file of required) { if (!fs.existsSync(file)) { console.error('Missing', file); ok = false; } }
if (fs.existsSync('package-lock.json')) { console.error('package-lock.json must not be included.'); ok = false; }
process.exit(ok ? 0 : 1);
