-- Caliphornia OS 43 Build
-- Canonical invite-system repair.
--
-- This migration converges partially migrated and clean databases on ONE
-- invite model:
--   invite_code = the human-readable code displayed once to an admin
--   token_hash  = the lookup/security value used by the claim endpoint
--
-- The application must never query a legacy "token" column.

create extension if not exists pgcrypto;

alter table if exists app_users
  add column if not exists role text not null default 'user';

alter table if exists app_users
  add column if not exists status text not null default 'active';

create table if not exists admin_invite_links (
  id uuid primary key default gen_random_uuid(),
  name text,
  invite_code text,
  token_hash text,
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

alter table admin_invite_links add column if not exists name text;
alter table admin_invite_links add column if not exists invite_code text;
alter table admin_invite_links add column if not exists token_hash text;
alter table admin_invite_links add column if not exists role text not null default 'user';
alter table admin_invite_links add column if not exists max_uses integer not null default 1;
alter table admin_invite_links add column if not exists uses integer not null default 0;
alter table admin_invite_links add column if not exists status text not null default 'active';
alter table admin_invite_links add column if not exists created_by_user_id uuid;
alter table admin_invite_links add column if not exists expires_at timestamptz;
alter table admin_invite_links add column if not exists metadata jsonb not null default '{}'::jsonb;
alter table admin_invite_links add column if not exists created_at timestamptz not null default now();
alter table admin_invite_links add column if not exists updated_at timestamptz not null default now();

-- Migrate data only when a legacy token column is actually present.
do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'admin_invite_links'
      and column_name = 'token'
  ) then
    execute $migration$
      update public.admin_invite_links
      set
        invite_code = coalesce(invite_code, token),
        token_hash = coalesce(
          token_hash,
          encode(digest(upper(trim(token)), 'sha256'), 'hex')
        )
      where token is not null
    $migration$;
  end if;
end
$$;

-- Keep already-created canonical rows internally consistent.
update admin_invite_links
set
  invite_code = upper(trim(invite_code)),
  token_hash = encode(digest(upper(trim(invite_code)), 'sha256'), 'hex'),
  updated_at = now()
where invite_code is not null
  and (
    token_hash is null
    or token_hash <> encode(digest(upper(trim(invite_code)), 'sha256'), 'hex')
  );

update admin_invite_links
set
  role = case when role in ('owner', 'admin', 'user') then role else 'user' end,
  max_uses = greatest(coalesce(max_uses, 1), 1),
  uses = greatest(coalesce(uses, 0), 0),
  status = case
    when status in ('active', 'used', 'revoked', 'expired') then status
    else 'active'
  end,
  metadata = coalesce(metadata, '{}'::jsonb),
  updated_at = coalesce(updated_at, now());

update admin_invite_links
set status = 'used', updated_at = now()
where status = 'active'
  and uses >= max_uses;

update admin_invite_links
set status = 'expired', updated_at = now()
where status = 'active'
  and expires_at is not null
  and expires_at <= now();

-- Remove legacy indexes before removing the legacy column.
drop index if exists idx_admin_invites_token;
drop index if exists admin_invite_links_token_key;

-- The application no longer uses the legacy token field.
alter table admin_invite_links drop column if exists token;
alter table admin_invite_links drop column if exists email;
alter table admin_invite_links drop column if exists accepted_by_user_id;
alter table admin_invite_links drop column if exists accepted_at;

-- Canonical constraints and indexes.
delete from admin_invite_links
where invite_code is null or token_hash is null;

alter table admin_invite_links
  alter column invite_code set not null;

alter table admin_invite_links
  alter column token_hash set not null;

create unique index if not exists uniq_admin_invite_links_invite_code
  on admin_invite_links(invite_code);

create unique index if not exists uniq_admin_invite_links_token_hash
  on admin_invite_links(token_hash);

create index if not exists idx_admin_invite_links_status
  on admin_invite_links(status);

create index if not exists idx_admin_invite_links_expires_at
  on admin_invite_links(expires_at);

-- Canonical audit table used by invite creation, claims, and revocation.
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

alter table admin_audit_logs add column if not exists admin_user_id uuid;
alter table admin_audit_logs add column if not exists action_type text;
alter table admin_audit_logs add column if not exists target_type text;
alter table admin_audit_logs add column if not exists target_id text;
alter table admin_audit_logs add column if not exists reason text;
alter table admin_audit_logs add column if not exists metadata jsonb not null default '{}'::jsonb;
alter table admin_audit_logs add column if not exists created_at timestamptz not null default now();

-- Migrate a legacy "action" column into the canonical "action_type" column.
do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'admin_audit_logs'
      and column_name = 'action'
  ) then
    execute $migration$
      update public.admin_audit_logs
      set action_type = coalesce(action_type, action)
      where action is not null
    $migration$;
  end if;
end
$$;

update admin_audit_logs
set action_type = 'legacy.unknown'
where action_type is null;

alter table admin_audit_logs
  alter column action_type set not null;

alter table admin_audit_logs
  drop column if exists action;

update app_users
set role = 'owner', status = 'active'
where lower(email) = 'caliph.safe@gmail.com';
