CALIPHORNIA OS — MILIA SONG CARD 43 PATCH

Upload components/MiliaSongCard.tsx to the same path in GitHub and replace the existing file.

This patch:
- fixes the TypeScript union error;
- keeps songs.id as the canonical song identifier;
- retains songSlug only as the API lookup fallback;
- sends the browser location required by /api/share/start;
- adds safer error handling;
- includes no package-lock.json.
