-- Caliphornia OS 43 Build Patch
-- Admin control, iOS Music, favorite ordering, invites, blasts, and access grants.

alter table app_users add column if not exists status text not null default 'active';
alter table app_users add column if not exists role text not null default 'user';

alter table songs add column if not exists status text not null default 'active';
alter table songs add column if not exists is_shareable boolean not null default true;
alter table songs add column if not exists audio_path text;
alter table songs add column if not exists preview_audio_path text;
alter table songs add column if not exists cover_image_path text;
alter table songs add column if not exists duration_label text;
alter table songs add column if not exists position integer default 0;
alter table songs add column if not exists artist_name text;
alter table songs add column if not exists updated_at timestamptz default now();

alter table user_favorite_songs add column if not exists favorite_order integer;
alter table user_favorite_songs add column if not exists status text not null default 'active';
alter table user_favorite_songs add column if not exists removed_at timestamptz;
alter table user_favorite_songs add column if not exists source_type text default 'manual';

alter table user_project_access add column if not exists user_id uuid;
alter table user_project_access add column if not exists project_id uuid;
alter table user_project_access add column if not exists status text not null default 'active';
alter table user_project_access add column if not exists idempotency_key text;
alter table user_project_access add column if not exists metadata jsonb not null default '{}'::jsonb;

alter table user_access_passes add column if not exists user_id uuid;
alter table user_access_passes add column if not exists app_id uuid;
alter table user_access_passes add column if not exists status text not null default 'active';
alter table user_access_passes add column if not exists source_type text;
alter table user_access_passes add column if not exists idempotency_key text;
alter table user_access_passes add column if not exists metadata jsonb not null default '{}'::jsonb;

create table if not exists user_song_access (
  id uuid primary key default gen_random_uuid(),
  user_id uuid,
  user_email text,
  song_id uuid,
  song_slug text,
  project_id uuid,
  app_id uuid,
  access_type text not null default 'admin_grant',
  source_type text,
  source_purchase_id uuid,
  starts_at timestamptz not null default now(),
  expires_at timestamptz,
  status text not null default 'active',
  idempotency_key text unique,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists admin_invite_links (
  id uuid primary key default gen_random_uuid(),
  token text unique not null,
  email text,
  role text not null default 'user',
  status text not null default 'active',
  created_by_user_id uuid,
  accepted_by_user_id uuid,
  accepted_at timestamptz,
  expires_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists admin_email_blasts (
  id uuid primary key default gen_random_uuid(),
  subject text not null,
  body text not null,
  recipient_count integer not null default 0,
  status text not null default 'queued',
  created_by_user_id uuid,
  sent_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists admin_audit_logs (
  id uuid primary key default gen_random_uuid(),
  admin_user_id uuid,
  action_type text not null,
  target_type text,
  target_id text,
  reason text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create unique index if not exists uniq_user_project_admin_idempotency on user_project_access(idempotency_key) where idempotency_key is not null;
create unique index if not exists uniq_user_pass_admin_idempotency on user_access_passes(idempotency_key) where idempotency_key is not null;
create index if not exists idx_user_song_access_user_song on user_song_access(user_id, song_id);
create index if not exists idx_user_song_access_email_slug on user_song_access(user_email, song_slug);
create index if not exists idx_favorite_order_user on user_favorite_songs(user_id, favorite_order);
create index if not exists idx_admin_invites_token on admin_invite_links(token);
create index if not exists idx_admin_blasts_status on admin_email_blasts(status);

update app_users
set role = 'owner', status = 'active'
where lower(email) = 'caliph.safe@gmail.com';

create unique index if not exists uniq_user_favorite_song_active
on user_favorite_songs(user_id, song_id)
where user_id is not null and song_id is not null;
