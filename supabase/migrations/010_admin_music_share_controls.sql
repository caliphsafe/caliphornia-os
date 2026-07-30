-- Caliphornia OS 43 Build patch
-- Admin control center, invite links, blast records, and editable Music favorites.

alter table if exists app_users
add column if not exists role text not null default 'user';

alter table if exists app_users
add column if not exists status text not null default 'active';

alter table if exists user_favorite_songs
add column if not exists favorite_order integer;

alter table if exists songs
add column if not exists is_shareable boolean not null default true;

alter table if exists songs
add column if not exists status text not null default 'active';

create table if not exists admin_invite_links (
  id uuid primary key default gen_random_uuid(),
  name text,
  invite_code text unique not null,
  token_hash text unique not null,
  role text not null default 'user',
  max_uses integer not null default 1,
  uses integer not null default 0,
  status text not null default 'active',
  created_by_user_id uuid,
  expires_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists admin_email_blasts (
  id uuid primary key default gen_random_uuid(),
  subject text not null,
  body text not null,
  status text not null default 'draft',
  recipient_count integer not null default 0,
  created_by_user_id uuid,
  sent_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_admin_invite_links_status on admin_invite_links(status);
create index if not exists idx_admin_email_blasts_status on admin_email_blasts(status);
create index if not exists idx_user_favorite_songs_order on user_favorite_songs(user_id, favorite_order);

-- Make the primary owner account an owner if it already exists.
update app_users
set role = 'owner', status = coalesce(status, 'active')
where lower(email) = 'caliph.safe@gmail.com';
