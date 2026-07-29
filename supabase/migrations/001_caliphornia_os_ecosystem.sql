create extension if not exists pgcrypto;

-- Canonical ID extensions, additive only.
alter table app_users add column if not exists auth_user_id uuid unique;
alter table app_users add column if not exists status text not null default 'active';
alter table app_users add column if not exists last_seen_at timestamptz;
alter table app_users add column if not exists profile_completed_at timestamptz;
alter table app_users add column if not exists metadata jsonb not null default '{}'::jsonb;

alter table songs add column if not exists project_id uuid references projects(id) on delete set null;
alter table songs add column if not exists app_id uuid references apps(id) on delete set null;
alter table songs add column if not exists is_shareable boolean not null default true;
alter table songs add column if not exists share_access_mode text not null default 'one_full_play';
alter table songs add column if not exists default_share_play_limit integer not null default 1;
alter table songs add column if not exists default_share_expires_hours integer not null default 24;
alter table songs add column if not exists qualified_listen_seconds integer not null default 30;
alter table songs add column if not exists qualified_listen_percent integer not null default 50;
alter table songs add column if not exists download_enabled boolean not null default false;
alter table songs add column if not exists position integer not null default 0;
alter table songs add column if not exists status text not null default 'active';

alter table projects add column if not exists primary_app_id uuid references apps(id) on delete set null;
alter table projects add column if not exists status text not null default 'active';
alter table projects add column if not exists release_timezone text not null default 'America/New_York';
alter table projects add column if not exists metadata jsonb not null default '{}'::jsonb;

alter table apps add column if not exists slug text;
alter table apps add column if not exists icon_path text;
alter table apps add column if not exists route_path text;
alter table apps add column if not exists sort_order integer not null default 0;
alter table apps add column if not exists is_visible_on_home boolean not null default true;
alter table apps add column if not exists is_free boolean not null default true;
alter table apps add column if not exists status text not null default 'active';
create unique index if not exists apps_slug_unique on apps(slug) where slug is not null;
create unique index if not exists apps_route_path_unique on apps(route_path) where route_path is not null;

alter table app_songs add column if not exists song_id uuid references songs(id) on delete cascade;
alter table app_songs add column if not exists app_id uuid references apps(id) on delete cascade;
alter table app_songs add column if not exists status text not null default 'active';
create unique index if not exists app_songs_app_id_song_id_unique on app_songs(app_id, song_id) where app_id is not null and song_id is not null;

alter table lyrics add column if not exists song_id uuid references songs(id) on delete cascade;
alter table lyrics add column if not exists lyric_type text not null default 'lyrics';
alter table lyrics add column if not exists language_code text not null default 'en';
alter table lyrics add column if not exists status text not null default 'active';
create unique index if not exists lyrics_song_type_language_unique on lyrics(song_id, lyric_type, language_code) where song_id is not null and status = 'active';

alter table purchases add column if not exists user_id uuid references app_users(id) on delete set null;
alter table purchases add column if not exists project_id uuid references projects(id) on delete set null;
alter table purchases add column if not exists app_id uuid references apps(id) on delete set null;
alter table purchases add column if not exists payment_provider text not null default 'stripe';
alter table purchases add column if not exists payment_status text;
alter table purchases add column if not exists receipt_status text not null default 'pending';
alter table purchases add column if not exists refunded_at timestamptz;
alter table purchases add column if not exists disputed_at timestamptz;
alter table purchases add column if not exists reversed_at timestamptz;
alter table purchases add column if not exists idempotency_key text unique;
alter table purchases add column if not exists metadata jsonb not null default '{}'::jsonb;
create index if not exists purchases_user_id_created_at_idx on purchases(user_id, created_at);
create index if not exists purchases_project_id_idx on purchases(project_id);

alter table user_project_access add column if not exists user_id uuid references app_users(id) on delete cascade;
alter table user_project_access add column if not exists project_id uuid references projects(id) on delete cascade;
alter table user_project_access add column if not exists source_type text not null default 'migration';
alter table user_project_access add column if not exists source_purchase_id uuid references purchases(id) on delete set null;
alter table user_project_access add column if not exists source_kiiku_transaction_id uuid;
alter table user_project_access add column if not exists source_share_session_id uuid;
alter table user_project_access add column if not exists status text not null default 'active';
alter table user_project_access add column if not exists can_share boolean not null default false;
alter table user_project_access add column if not exists can_download boolean not null default false;
alter table user_project_access add column if not exists revoked_at timestamptz;
alter table user_project_access add column if not exists revoked_reason text;
alter table user_project_access add column if not exists idempotency_key text unique;
alter table user_project_access add column if not exists created_by_admin_id uuid references app_users(id) on delete set null;
create index if not exists user_project_access_user_id_idx on user_project_access(user_id);
create index if not exists user_project_access_project_id_idx on user_project_access(project_id);

alter table user_access_passes add column if not exists user_id uuid references app_users(id) on delete cascade;
alter table user_access_passes add column if not exists source_type text not null default 'migration';
alter table user_access_passes add column if not exists source_purchase_id uuid references purchases(id) on delete set null;
alter table user_access_passes add column if not exists source_kiiku_transaction_id uuid;
alter table user_access_passes add column if not exists stripe_subscription_id text;
alter table user_access_passes add column if not exists status text not null default 'active';
alter table user_access_passes add column if not exists can_share boolean not null default false;
alter table user_access_passes add column if not exists can_download boolean not null default false;
alter table user_access_passes add column if not exists revoked_at timestamptz;
alter table user_access_passes add column if not exists revoked_reason text;
alter table user_access_passes add column if not exists idempotency_key text unique;
alter table user_access_passes add column if not exists created_by_admin_id uuid references app_users(id) on delete set null;
create index if not exists user_access_passes_user_id_idx on user_access_passes(user_id);

alter table user_favorite_songs add column if not exists user_id uuid references app_users(id) on delete cascade;
alter table user_favorite_songs add column if not exists source_type text not null default 'manual';
alter table user_favorite_songs add column if not exists source_purchase_id uuid references purchases(id) on delete set null;
alter table user_favorite_songs add column if not exists source_access_table text;
alter table user_favorite_songs add column if not exists source_access_id uuid;
alter table user_favorite_songs add column if not exists status text not null default 'active';
alter table user_favorite_songs add column if not exists removed_at timestamptz;
create unique index if not exists user_favorite_songs_user_song_unique on user_favorite_songs(user_id, song_id) where user_id is not null and song_id is not null;
create index if not exists user_favorite_songs_user_id_idx on user_favorite_songs(user_id);

alter table event_logs add column if not exists user_id uuid references app_users(id) on delete set null;
alter table event_logs add column if not exists guest_session_id uuid;
alter table event_logs add column if not exists app_id uuid references apps(id) on delete set null;
alter table event_logs add column if not exists project_id uuid references projects(id) on delete set null;
alter table event_logs add column if not exists playback_session_id uuid;
alter table event_logs add column if not exists share_session_id uuid;
alter table event_logs add column if not exists kiiku_transaction_id uuid;
alter table event_logs add column if not exists purchase_id uuid references purchases(id) on delete set null;
alter table event_logs add column if not exists idempotency_key text unique;
alter table event_logs add column if not exists qualification_status text not null default 'not_applicable';
alter table event_logs add column if not exists qualified_at timestamptz;
alter table event_logs add column if not exists privacy_level text not null default 'reduced';
alter table event_logs add column if not exists retention_until timestamptz;
create index if not exists event_logs_user_id_created_at_idx on event_logs(user_id, created_at);
create index if not exists event_logs_song_id_created_at_idx on event_logs(song_id, created_at);

alter table calendar_events add column if not exists project_id uuid references projects(id) on delete set null;
alter table calendar_events add column if not exists app_id uuid references apps(id) on delete set null;
alter table calendar_events add column if not exists song_id uuid references songs(id) on delete set null;
alter table calendar_events add column if not exists display_date date;
alter table calendar_events add column if not exists display_timezone text not null default 'America/New_York';
alter table calendar_events add column if not exists status text not null default 'scheduled';

-- New commerce, access, sharing, guest, Kiiku, contribution, stats, and admin tables.
create table if not exists commerce_products (
  id uuid primary key default gen_random_uuid(),
  product_key text unique not null,
  name text not null,
  product_type text not null,
  song_id uuid references songs(id) on delete set null,
  project_id uuid references projects(id) on delete set null,
  app_id uuid references apps(id) on delete set null,
  price_cents integer not null check (price_cents >= 0),
  currency text not null default 'usd',
  status text not null default 'draft',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists purchase_line_items (
  id uuid primary key default gen_random_uuid(),
  purchase_id uuid references purchases(id) on delete cascade,
  product_key text,
  product_type text not null,
  song_id uuid references songs(id) on delete set null,
  project_id uuid references projects(id) on delete set null,
  app_id uuid references apps(id) on delete set null,
  quantity integer not null default 1 check (quantity > 0),
  unit_amount_cents integer not null default 0 check (unit_amount_cents >= 0),
  gross_amount_cents integer not null default 0 check (gross_amount_cents >= 0),
  discount_amount_cents integer not null default 0 check (discount_amount_cents >= 0),
  tax_amount_cents integer not null default 0 check (tax_amount_cents >= 0),
  fee_amount_cents integer not null default 0 check (fee_amount_cents >= 0),
  net_amount_cents integer not null default 0 check (net_amount_cents >= 0),
  eligible_amount_cents integer not null default 0 check (eligible_amount_cents >= 0),
  currency text not null default 'usd',
  status text not null default 'confirmed',
  idempotency_key text unique not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists user_song_access (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references app_users(id) on delete cascade,
  user_email text,
  song_id uuid references songs(id) on delete cascade,
  source_type text not null default 'purchase',
  source_purchase_id uuid references purchases(id) on delete set null,
  source_kiiku_transaction_id uuid,
  source_share_session_id uuid,
  status text not null default 'active',
  starts_at timestamptz not null default now(),
  expires_at timestamptz,
  play_limit integer,
  plays_used integer not null default 0,
  can_share boolean not null default false,
  can_download boolean not null default false,
  revoked_at timestamptz,
  revoked_reason text,
  idempotency_key text unique,
  created_by_admin_id uuid references app_users(id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists user_song_access_user_song_idx on user_song_access(user_id, song_id);

create table if not exists sharing_rules (
  id uuid primary key default gen_random_uuid(),
  rule_key text unique not null,
  product_type text,
  song_id uuid references songs(id) on delete cascade,
  project_id uuid references projects(id) on delete cascade,
  subscription_tier text,
  shares_included integer not null default 0 check (shares_included >= 0),
  consumption_point text not null default 'qualified_listen',
  status text not null default 'draft',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists sharing_allowances (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references app_users(id) on delete cascade,
  user_email_snapshot text,
  project_id uuid references projects(id) on delete cascade,
  song_id uuid references songs(id) on delete cascade,
  purchase_id uuid references purchases(id) on delete set null,
  kiiku_transaction_id uuid,
  created_by_admin_id uuid references app_users(id) on delete set null,
  allowance_type text not null,
  scope text not null,
  total_allowed integer not null default 0 check (total_allowed >= 0),
  used_count integer not null default 0 check (used_count >= 0),
  reserved_count integer not null default 0 check (reserved_count >= 0),
  remaining_count integer not null default 0 check (remaining_count >= 0),
  status text not null default 'active',
  starts_at timestamptz not null default now(),
  expires_at timestamptz,
  idempotency_key text unique,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists sharing_allowances_user_scope_idx on sharing_allowances(user_id, scope, status);

create table if not exists guest_sessions (
  id uuid primary key default gen_random_uuid(),
  guest_token_hash text unique not null,
  status text not null default 'active',
  expires_at timestamptz not null,
  claimed_at timestamptz,
  claimed_by_user_id uuid references app_users(id) on delete set null,
  last_seen_at timestamptz,
  privacy_level text not null default 'reduced',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists guest_sessions_status_expires_idx on guest_sessions(status, expires_at);

create table if not exists nearby_share_sessions (
  id uuid primary key default gen_random_uuid(),
  sender_user_id uuid references app_users(id) on delete cascade,
  recipient_user_id uuid references app_users(id) on delete set null,
  recipient_guest_session_id uuid references guest_sessions(id) on delete set null,
  song_id uuid references songs(id) on delete cascade,
  project_id uuid references projects(id) on delete set null,
  app_id uuid references apps(id) on delete set null,
  allowance_id uuid references sharing_allowances(id) on delete set null,
  guest_entitlement_id uuid,
  qualified_share_id uuid,
  share_token_hash text unique,
  fallback_phrase_hash text,
  status text not null default 'created',
  share_scope text not null default 'song',
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  matched_at timestamptz,
  sender_confirmed_at timestamptz,
  recipient_confirmed_at timestamptz,
  accepted_at timestamptz,
  qualified_at timestamptz,
  rejected_at timestamptz,
  fraud_review_at timestamptz,
  location_data_delete_at timestamptz,
  location_data_deleted_at timestamptz,
  idempotency_key text unique,
  sender_email_snapshot text,
  recipient_email_snapshot text,
  song_slug_snapshot text,
  song_title_snapshot text,
  project_slug_snapshot text,
  project_name_snapshot text,
  app_slug_snapshot text,
  share_method_snapshot text,
  metadata jsonb not null default '{}'::jsonb
);
create index if not exists nearby_share_sender_created_idx on nearby_share_sessions(sender_user_id, created_at);
create index if not exists nearby_share_status_expires_idx on nearby_share_sessions(status, expires_at);

create table if not exists nearby_share_events (
  id uuid primary key default gen_random_uuid(),
  share_session_id uuid references nearby_share_sessions(id) on delete cascade,
  actor_user_id uuid references app_users(id) on delete set null,
  actor_guest_session_id uuid references guest_sessions(id) on delete set null,
  event_type text not null,
  event_status text not null default 'ok',
  idempotency_key text unique,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists guest_one_play_entitlements (
  id uuid primary key default gen_random_uuid(),
  guest_session_id uuid references guest_sessions(id) on delete cascade,
  share_session_id uuid references nearby_share_sessions(id) on delete cascade,
  song_id uuid references songs(id) on delete cascade,
  project_id uuid references projects(id) on delete set null,
  claimed_by_user_id uuid references app_users(id) on delete set null,
  play_limit integer not null default 1 check (play_limit >= 0),
  plays_used integer not null default 0 check (plays_used >= 0),
  status text not null default 'active',
  expires_at timestamptz not null,
  first_played_at timestamptz,
  last_played_at timestamptz,
  claimed_at timestamptz,
  revoked_at timestamptz,
  revoked_reason text,
  idempotency_key text unique,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists guest_account_claims (
  id uuid primary key default gen_random_uuid(),
  guest_session_id uuid references guest_sessions(id) on delete cascade,
  user_id uuid references app_users(id) on delete cascade,
  share_session_id uuid references nearby_share_sessions(id) on delete set null,
  claim_method text not null,
  status text not null default 'pending',
  claimed_email_snapshot text,
  idempotency_key text unique,
  completed_at timestamptz,
  rejected_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique(guest_session_id, user_id)
);

create table if not exists guest_claim_codes (
  id uuid primary key default gen_random_uuid(),
  guest_session_id uuid references guest_sessions(id) on delete cascade,
  email text not null,
  code_hash text not null,
  status text not null default 'active',
  expires_at timestamptz not null,
  used_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists playback_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references app_users(id) on delete set null,
  guest_session_id uuid references guest_sessions(id) on delete set null,
  song_id uuid references songs(id) on delete cascade,
  project_id uuid references projects(id) on delete set null,
  app_id uuid references apps(id) on delete set null,
  access_project_id uuid references user_project_access(id) on delete set null,
  access_pass_id uuid references user_access_passes(id) on delete set null,
  guest_entitlement_id uuid references guest_one_play_entitlements(id) on delete set null,
  share_session_id uuid references nearby_share_sessions(id) on delete set null,
  access_mode text not null,
  is_preview boolean not null default false,
  started_at timestamptz not null default now(),
  last_heartbeat_at timestamptz,
  ended_at timestamptz,
  seconds_played integer not null default 0,
  percent_played numeric,
  qualified_at timestamptz,
  qualification_status text not null default 'pending',
  play_limit_consumed boolean not null default false,
  idempotency_key text unique,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists playback_sessions_user_started_idx on playback_sessions(user_id, started_at);

create table if not exists qualified_listens (
  id uuid primary key default gen_random_uuid(),
  playback_session_id uuid unique references playback_sessions(id) on delete cascade,
  user_id uuid references app_users(id) on delete set null,
  guest_session_id uuid references guest_sessions(id) on delete set null,
  song_id uuid references songs(id) on delete cascade,
  project_id uuid references projects(id) on delete set null,
  share_session_id uuid references nearby_share_sessions(id) on delete set null,
  kiiku_transaction_id uuid,
  qualification_rule text not null,
  seconds_played integer,
  percent_played numeric,
  status text not null default 'qualified',
  qualified_at timestamptz,
  reversed_at timestamptz,
  reversal_reason text,
  idempotency_key text unique,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists kiiku_rules (
  id uuid primary key default gen_random_uuid(),
  rule_key text unique not null,
  rule_type text not null,
  action_type text not null,
  credit_amount integer not null default 0 check (credit_amount >= 0),
  spend_cost integer not null default 0 check (spend_cost >= 0),
  max_per_user integer,
  max_per_period integer,
  period_window text,
  pending_period_hours integer not null default 0,
  status text not null default 'draft',
  starts_at timestamptz,
  ends_at timestamptz,
  created_by_admin_id uuid references app_users(id) on delete set null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists kiiku_campaigns (
  id uuid primary key default gen_random_uuid(),
  campaign_key text unique not null,
  name text not null,
  description text,
  status text not null default 'draft',
  project_id uuid references projects(id) on delete set null,
  app_id uuid references apps(id) on delete set null,
  song_id uuid references songs(id) on delete set null,
  starts_at timestamptz,
  ends_at timestamptz,
  budget_credits integer,
  credits_awarded integer not null default 0,
  created_by_admin_id uuid references app_users(id) on delete set null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists kiiku_transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references app_users(id) on delete cascade,
  rule_id uuid references kiiku_rules(id) on delete set null,
  campaign_id uuid references kiiku_campaigns(id) on delete set null,
  purchase_id uuid references purchases(id) on delete set null,
  share_session_id uuid references nearby_share_sessions(id) on delete set null,
  qualified_share_id uuid,
  playback_session_id uuid references playback_sessions(id) on delete set null,
  project_id uuid references projects(id) on delete set null,
  song_id uuid references songs(id) on delete set null,
  app_id uuid references apps(id) on delete set null,
  created_by_admin_id uuid references app_users(id) on delete set null,
  reversal_of_transaction_id uuid references kiiku_transactions(id) on delete set null,
  direction text not null,
  transaction_type text not null,
  amount integer not null check (amount > 0),
  status text not null default 'pending',
  available_at timestamptz,
  expires_at timestamptz,
  approved_at timestamptz,
  reversed_at timestamptz,
  expired_at timestamptz,
  idempotency_key text unique not null,
  reason text not null,
  admin_notes text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists kiiku_transactions_user_created_idx on kiiku_transactions(user_id, created_at);

create table if not exists kiiku_unlocks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references app_users(id) on delete cascade,
  kiiku_transaction_id uuid references kiiku_transactions(id) on delete set null,
  song_access_id uuid references user_song_access(id) on delete set null,
  project_access_id uuid references user_project_access(id) on delete set null,
  access_pass_id uuid references user_access_passes(id) on delete set null,
  song_id uuid references songs(id) on delete set null,
  project_id uuid references projects(id) on delete set null,
  unlock_type text not null,
  status text not null default 'active',
  revoked_at timestamptz,
  reversal_transaction_id uuid references kiiku_transactions(id) on delete set null,
  idempotency_key text unique,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists share_qualifications (
  id uuid primary key default gen_random_uuid(),
  share_session_id uuid unique references nearby_share_sessions(id) on delete cascade,
  sender_user_id uuid references app_users(id) on delete set null,
  recipient_user_id uuid references app_users(id) on delete set null,
  recipient_guest_session_id uuid references guest_sessions(id) on delete set null,
  song_id uuid references songs(id) on delete set null,
  project_id uuid references projects(id) on delete set null,
  playback_session_id uuid references playback_sessions(id) on delete set null,
  kiiku_transaction_id uuid references kiiku_transactions(id) on delete set null,
  qualification_rule_id uuid references kiiku_rules(id) on delete set null,
  status text not null default 'pending',
  qualified_at timestamptz,
  reversed_at timestamptz,
  reversal_reason text,
  idempotency_key text unique,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists project_release_goals (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references projects(id) on delete cascade,
  created_by_admin_id uuid references app_users(id) on delete set null,
  goal_key text unique not null,
  goal_type text not null default 'streaming_release',
  goal_currency text not null default 'USD',
  goal_amount_cents integer not null check (goal_amount_cents >= 0),
  eligible_amount_cents integer not null default 0,
  gross_amount_cents integer not null default 0,
  net_amount_cents integer not null default 0,
  status text not null default 'draft',
  starts_at timestamptz,
  ends_at timestamptz,
  goal_reached_at timestamptz,
  actual_release_date date,
  target_date date,
  streaming_release_date date,
  celebration_state text not null default 'none',
  contribution_basis text not null default 'eligible_amount',
  project_explanation text,
  milestones jsonb not null default '[]'::jsonb,
  post_goal_behavior text not null default 'record_post_goal',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists project_contributions (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references projects(id) on delete cascade,
  goal_id uuid references project_release_goals(id) on delete set null,
  user_id uuid references app_users(id) on delete set null,
  guest_session_id uuid references guest_sessions(id) on delete set null,
  purchase_id uuid references purchases(id) on delete set null,
  purchase_line_item_id uuid references purchase_line_items(id) on delete set null,
  subscription_purchase_id uuid references purchases(id) on delete set null,
  kiiku_transaction_id uuid references kiiku_transactions(id) on delete set null,
  reversal_of_contribution_id uuid references project_contributions(id) on delete set null,
  currency text not null default 'usd',
  gross_amount_cents integer not null default 0,
  net_amount_cents integer not null default 0,
  eligible_amount_cents integer not null default 0,
  platform_fee_cents integer not null default 0,
  payment_fee_cents integer not null default 0,
  refunded_amount_cents integer not null default 0,
  contribution_type text not null,
  contribution_basis text not null,
  status text not null default 'pending',
  idempotency_key text unique,
  confirmed_at timestamptz,
  reversed_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists project_contribution_reversals (
  id uuid primary key default gen_random_uuid(),
  contribution_id uuid references project_contributions(id) on delete cascade,
  purchase_id uuid references purchases(id) on delete set null,
  created_by_admin_id uuid references app_users(id) on delete set null,
  reversal_type text not null,
  currency text not null default 'usd',
  gross_reversed_cents integer not null default 0,
  net_reversed_cents integer not null default 0,
  eligible_reversed_cents integer not null default 0,
  reason text,
  status text not null default 'completed',
  idempotency_key text unique,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists stats_aggregation_runs (
  id uuid primary key default gen_random_uuid(),
  aggregation_key text not null,
  status text not null default 'running',
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  failed_at timestamptz,
  error_message text,
  rows_processed integer not null default 0,
  idempotency_key text unique,
  metadata jsonb not null default '{}'::jsonb
);

create table if not exists stats_daily_rollups (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references app_users(id) on delete cascade,
  song_id uuid references songs(id) on delete cascade,
  project_id uuid references projects(id) on delete cascade,
  app_id uuid references apps(id) on delete cascade,
  rollup_date date not null,
  metric_scope text not null,
  metric_name text not null,
  metric_value numeric not null default 0,
  source_count integer not null default 0,
  aggregation_run_id uuid references stats_aggregation_runs(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index if not exists stats_daily_rollups_unique on stats_daily_rollups(rollup_date, metric_scope, metric_name, coalesce(user_id,'00000000-0000-0000-0000-000000000000'::uuid), coalesce(song_id,'00000000-0000-0000-0000-000000000000'::uuid), coalesce(project_id,'00000000-0000-0000-0000-000000000000'::uuid), coalesce(app_id,'00000000-0000-0000-0000-000000000000'::uuid));

create table if not exists admin_audit_logs (
  id uuid primary key default gen_random_uuid(),
  admin_user_id uuid references app_users(id) on delete set null,
  target_user_id uuid references app_users(id) on delete set null,
  target_song_id uuid references songs(id) on delete set null,
  target_project_id uuid references projects(id) on delete set null,
  target_purchase_id uuid references purchases(id) on delete set null,
  action_type text not null,
  target_table text,
  target_id text,
  before_snapshot jsonb,
  after_snapshot jsonb,
  reason text,
  ip_country_snapshot text,
  idempotency_key text unique,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists admin_overrides (
  id uuid primary key default gen_random_uuid(),
  admin_user_id uuid references app_users(id) on delete set null,
  target_user_id uuid references app_users(id) on delete set null,
  project_access_id uuid references user_project_access(id) on delete set null,
  access_pass_id uuid references user_access_passes(id) on delete set null,
  kiiku_transaction_id uuid references kiiku_transactions(id) on delete set null,
  purchase_id uuid references purchases(id) on delete set null,
  override_type text not null,
  status text not null default 'active',
  reason text not null,
  starts_at timestamptz not null default now(),
  expires_at timestamptz,
  revoked_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists abuse_flags (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references app_users(id) on delete set null,
  guest_session_id uuid references guest_sessions(id) on delete set null,
  share_session_id uuid references nearby_share_sessions(id) on delete set null,
  playback_session_id uuid references playback_sessions(id) on delete set null,
  kiiku_transaction_id uuid references kiiku_transactions(id) on delete set null,
  purchase_id uuid references purchases(id) on delete set null,
  project_contribution_id uuid references project_contributions(id) on delete set null,
  reviewed_by_admin_id uuid references app_users(id) on delete set null,
  flag_type text not null,
  severity text not null default 'medium',
  status text not null default 'open',
  reason text,
  reviewed_at timestamptz,
  resolved_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

-- Backfills, safe and additive.
update purchases p set user_id = u.id from app_users u where p.user_id is null and lower(p.user_email) = lower(u.email);
update user_project_access a set user_id = u.id from app_users u where a.user_id is null and lower(a.user_email) = lower(u.email);
update user_access_passes a set user_id = u.id from app_users u where a.user_id is null and lower(a.user_email) = lower(u.email);
update user_favorite_songs f set user_id = u.id from app_users u where f.user_id is null and lower(f.user_email) = lower(u.email);
update event_logs e set user_id = u.id from app_users u where e.user_id is null and lower(e.user_email) = lower(u.email);
update purchases p set project_id = pr.id from projects pr where p.project_id is null and p.project_slug = pr.slug;
update user_project_access a set project_id = pr.id from projects pr where a.project_id is null and a.project_slug = pr.slug;
update calendar_events c set project_id = pr.id from projects pr where c.project_id is null and c.project_slug = pr.slug;
update user_favorite_songs f set song_id = s.id from songs s where f.song_id is null and f.song_slug = s.slug;
update event_logs e set song_id = s.id from songs s where e.song_id is null and e.song_slug = s.slug;
update lyrics l set song_id = s.id from songs s where l.song_id is null and l.song_slug = s.slug;
update app_songs aps set song_id = s.id from songs s where aps.song_id is null and aps.song_slug = s.slug;
update songs s set project_id = pr.id from projects pr where s.project_id is null and s.source_app_slug = pr.slug;

-- RLS. Service-role server routes perform privileged writes. Direct client access stays restrictive.
alter table app_users enable row level security;
alter table purchases enable row level security;
alter table purchase_line_items enable row level security;
alter table user_project_access enable row level security;
alter table user_access_passes enable row level security;
alter table user_song_access enable row level security;
alter table user_favorite_songs enable row level security;
alter table kiiku_transactions enable row level security;
alter table sharing_allowances enable row level security;
alter table nearby_share_sessions enable row level security;
alter table guest_sessions enable row level security;
alter table guest_one_play_entitlements enable row level security;
alter table project_contributions enable row level security;
alter table admin_audit_logs enable row level security;
alter table abuse_flags enable row level security;

drop policy if exists "own app user read" on app_users;
create policy "own app user read" on app_users for select using (auth.uid() = auth_user_id);

drop policy if exists "own purchases read" on purchases;
create policy "own purchases read" on purchases for select using (exists (select 1 from app_users u where u.id = purchases.user_id and u.auth_user_id = auth.uid()));

drop policy if exists "own favorites read" on user_favorite_songs;
create policy "own favorites read" on user_favorite_songs for select using (exists (select 1 from app_users u where u.id = user_favorite_songs.user_id and u.auth_user_id = auth.uid()));

drop policy if exists "own kiiku read" on kiiku_transactions;
create policy "own kiiku read" on kiiku_transactions for select using (exists (select 1 from app_users u where u.id = kiiku_transactions.user_id and u.auth_user_id = auth.uid()));
