-- Optional check if a shared guest track still cannot be found.
-- This shows the exact audio_path values the receiver player will try to sign.
select
  s.id,
  s.slug,
  s.title,
  s.audio_path,
  s.source_app_slug,
  s.status
from songs s
where s.audio_path is null
   or s.audio_path = ''
   or s.audio_path like '/%'
order by s.source_app_slug, s.slug;
