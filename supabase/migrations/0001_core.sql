-- Core schema: tournaments, saints (+image rights), teams, players, admins, audit.
-- Matches/groups/events come in the next migration.
create extension if not exists pgcrypto;

create table tournaments (
  id uuid primary key default gen_random_uuid(),
  name_ar text not null,
  description_ar text,
  registration_deadline timestamptz not null
    default (timestamp '2026-11-07 23:59:00' at time zone 'Africa/Cairo'),
  timezone text not null default 'Africa/Cairo',
  bible_verse_text text, bible_verse_reference text,   -- admin-supplied only
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);

create type image_rights as enum ('public_domain','licensed','permission_granted','user_owned','unknown');

create table saints (
  id uuid primary key default gen_random_uuid(),
  name_ar text not null unique,
  alt_spellings text[] not null default '{}',
  description_ar text,
  letter text not null,                      -- أ ب ت ...
  portrait_path text,                        -- Supabase Storage path; null => branded placeholder
  image_source_site text, image_original_url text, image_creator text, image_attribution text,
  image_rights image_rights not null default 'unknown',
  image_rights_notes text,
  is_approved boolean not null default false,
  is_active boolean not null default true,
  sort_order int not null default 0,
  -- unknown-rights images can never be published
  constraint portrait_requires_rights check (portrait_path is null or image_rights <> 'unknown' or not is_approved)
);

create type team_status as enum ('pending','approved','rejected');
create type team_source as enum ('manual','automatic');

create table teams (
  id uuid primary key default gen_random_uuid(),
  tournament_id uuid not null references tournaments on delete restrict,
  team_number serial,
  saint_id uuid references saints on delete restrict,   -- null => automatic team awaiting admin saint assignment
  status team_status not null default 'pending',
  source team_source not null default 'manual',
  rejection_reason text,
  batch_seed bigint,                                     -- audit of randomisation
  submitted_at timestamptz not null default now(),
  approved_at timestamptz, approved_by uuid references auth.users
);
-- One saint per ACTIVE (pending/approved) team; rejection releases it.
create unique index one_active_team_per_saint on teams (tournament_id, saint_id)
  where status in ('pending','approved') and saint_id is not null;

create type pool_status as enum ('not_applicable','waiting','assigned_pending','placed');
create table players (
  id uuid primary key default gen_random_uuid(),
  tournament_id uuid not null references tournaments on delete restrict,
  team_id uuid references teams on delete restrict,
  full_name_ar text not null check (char_length(trim(full_name_ar)) between 2 and 80),
  class_name_ar text not null check (char_length(trim(class_name_ar)) between 1 and 60),
  source text not null check (source in ('team_registration','individual')),
  pool_status pool_status not null default 'not_applicable',
  created_at timestamptz not null default now()
);
create index on players (team_id);
create index on players (tournament_id, pool_status);

create table registration_requests (   -- idempotency
  idempotency_key text primary key, created_at timestamptz not null default now(), team_id uuid
);

create table admin_users (
  user_id uuid primary key references auth.users on delete cascade,
  enabled boolean not null default true, created_at timestamptz not null default now()
);
create table audit_logs (
  id bigint generated always as identity primary key,
  admin_user_id uuid references auth.users, action text not null,
  entity_type text not null, entity_id text, old_data jsonb, new_data jsonb,
  created_at timestamptz not null default now()
);

-- ---------- helpers ----------
create function is_admin() returns boolean language sql stable security definer set search_path = public as
$$ select exists (select 1 from admin_users where user_id = auth.uid() and enabled) $$;

create function registration_open(t uuid) returns boolean language sql stable security definer set search_path = public as
$$ select now() < registration_deadline from tournaments where id = t $$;   -- server clock only

-- ---------- registration (called ONLY by Edge Functions with the service role) ----------
create function register_team_tx(p_tournament uuid, p_saint uuid, p_players jsonb, p_key text)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_team uuid; v_n int; v_distinct int; r record;
begin
  if not registration_open(p_tournament) then raise exception 'registration_closed'; end if;
  if exists (select 1 from registration_requests where idempotency_key = p_key) then
    return (select team_id from registration_requests where idempotency_key = p_key);
  end if;
  v_n := jsonb_array_length(p_players);
  if v_n < 1 or v_n > 7 then raise exception 'invalid_player_count'; end if;
  select count(distinct lower(trim(x->>'name'))) into v_distinct from jsonb_array_elements(p_players) x;
  if v_distinct <> v_n then raise exception 'duplicate_players'; end if;
  if not exists (select 1 from saints where id = p_saint and is_approved and is_active) then raise exception 'saint_unavailable'; end if;
  begin
    insert into teams (tournament_id, saint_id, source) values (p_tournament, p_saint, 'manual') returning id into v_team;
  exception when unique_violation then raise exception 'saint_taken'; end;
  for r in select x->>'name' n, x->>'class' c from jsonb_array_elements(p_players) x loop
    insert into players (tournament_id, team_id, full_name_ar, class_name_ar, source, pool_status)
    values (p_tournament, v_team, trim(r.n), trim(r.c), 'team_registration', 'not_applicable');
  end loop;
  insert into registration_requests values (p_key, now(), v_team);
  return v_team;
end $$;

create function register_individual_tx(p_tournament uuid, p_name text, p_class text, p_key text)
returns uuid language plpgsql security definer set search_path = public as $$
declare v uuid;
begin
  if not registration_open(p_tournament) then raise exception 'registration_closed'; end if;
  insert into registration_requests (idempotency_key) values (p_key) on conflict do nothing;
  if not found then return null; end if;   -- replayed request
  insert into players (tournament_id, full_name_ar, class_name_ar, source, pool_status)
  values (p_tournament, trim(p_name), trim(p_class), 'individual', 'waiting') returning id into v;
  return v;
end $$;

revoke all on function register_team_tx, register_individual_tx from public, anon, authenticated;
grant execute on function register_team_tx, register_individual_tx to service_role;

-- ---------- RLS: deny by default ----------
alter table tournaments enable row level security;
alter table saints enable row level security;
alter table teams enable row level security;
alter table players enable row level security;
alter table registration_requests enable row level security;
alter table admin_users enable row level security;
alter table audit_logs enable row level security;
revoke all on tournaments, saints, teams, players, registration_requests, admin_users, audit_logs from anon, authenticated;

-- Public: tournament info + approved saints only (no direct access to teams/players)
grant select on tournaments, saints to anon, authenticated;
create policy tournaments_read on tournaments for select using (true);
create policy saints_read on saints for select using (is_approved and is_active);

-- Public views expose ONLY approved teams / their rosters (no class names, no pending/rejected/waiting rows)
create view public_teams with (security_invoker = false) as
  select t.id, t.team_number, s.id saint_id, s.name_ar saint_name_ar, s.portrait_path,
         (select count(*) from players p where p.team_id = t.id) players_count
  from teams t join saints s on s.id = t.saint_id where t.status = 'approved';
create view public_team_players with (security_invoker = false) as
  select p.id, p.team_id, p.full_name_ar from players p join teams t on t.id = p.team_id where t.status = 'approved';
grant select on public_teams, public_team_players to anon, authenticated;

-- Admin: full access, authorised via admin_users (not via the hidden URL)
grant select, insert, update, delete on teams, players, saints, tournaments to authenticated;
grant select on admin_users, audit_logs to authenticated;
create policy teams_admin on teams for all to authenticated using (is_admin()) with check (is_admin());
create policy players_admin on players for all to authenticated using (is_admin()) with check (is_admin());
create policy saints_admin on saints for all to authenticated using (is_admin()) with check (is_admin());
create policy tournaments_admin on tournaments for update to authenticated using (is_admin()) with check (is_admin());
create policy admin_self on admin_users for select to authenticated using (user_id = auth.uid());
create policy audit_admin on audit_logs for select to authenticated using (is_admin());

-- Authorise the first admin AFTER creating them in Supabase Auth (no default account exists):
-- insert into admin_users (user_id) select id from auth.users where email = 'you@example.com';
