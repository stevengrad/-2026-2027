-- Rate limiting, approve/reject, atomic automatic-team creation, manual saint assignment.
create table rate_limits (key text not null, hit_at timestamptz not null default now());
create index on rate_limits (key, hit_at);
alter table rate_limits enable row level security;
revoke all on rate_limits from anon, authenticated;

create function rate_limit_hit(p_key text, p_max int, p_window interval) returns boolean
language plpgsql security definer set search_path = public as $$
declare n int;
begin
  delete from rate_limits where hit_at < now() - interval '1 day';
  insert into rate_limits (key) values (p_key);
  select count(*) into n from rate_limits where key = p_key and hit_at > now() - p_window;
  return n <= p_max;
end $$;

create function approve_team(p_team uuid) returns void language plpgsql security definer set search_path = public as $$
declare t teams;
begin
  if not is_admin() then raise exception 'forbidden'; end if;
  select * into t from teams where id = p_team for update;
  if t.id is null or t.status <> 'pending' then raise exception 'not_pending'; end if;
  if t.saint_id is null then raise exception 'saint_required'; end if;
  update teams set status = 'approved', approved_at = now(), approved_by = auth.uid() where id = p_team;
  update players set pool_status = 'placed' where team_id = p_team and source = 'individual';
end $$;

create function reject_team(p_team uuid, p_reason text default null, p_return_players boolean default false)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not is_admin() then raise exception 'forbidden'; end if;
  update teams set status = 'rejected', rejection_reason = nullif(trim(p_reason), '') where id = p_team and status = 'pending';
  if not found then raise exception 'not_pending'; end if;
  if p_return_players then
    with r as (update players set team_id = null, pool_status = 'waiting' where team_id = p_team and source = 'individual' returning id)
    insert into audit_logs (admin_user_id, action, entity_type, entity_id, new_data)
    select auth.uid(), 'return_players_to_pool', 'teams', p_team::text, jsonb_build_object('players', coalesce(jsonb_agg(id), '[]'::jsonb)) from r;
  end if;
end $$;

create function assign_team_saint(p_team uuid, p_saint uuid) returns void language plpgsql security definer set search_path = public as $$
begin
  if not is_admin() then raise exception 'forbidden'; end if;
  if not exists (select 1 from saints where id = p_saint and is_approved and is_active) then raise exception 'saint_unavailable'; end if;
  begin update teams set saint_id = p_saint where id = p_team and status in ('pending','approved');
  exception when unique_violation then raise exception 'saint_taken'; end;
end $$;

-- p_teams: [[playerId,...],...]  p_saints: [saintId|null,...] (same length). One transaction; seed kept for audit.
create function create_generated_teams(p_tournament uuid, p_seed bigint, p_teams jsonb, p_saints jsonb)
returns uuid[] language plpgsql security definer set search_path = public as $$
declare i int; n int := jsonb_array_length(p_teams); tid uuid; made uuid[] := '{}'; pids uuid[]; sid uuid; locked int;
begin
  if not is_admin() then raise exception 'forbidden'; end if;
  if jsonb_array_length(p_saints) <> n then raise exception 'saints_mismatch'; end if;
  for i in 0 .. n - 1 loop
    select array_agg(x::uuid) into pids from jsonb_array_elements_text(p_teams -> i) x;
    if cardinality(pids) not between 4 and 7 then raise exception 'invalid_team_size'; end if;
    select count(*) into locked from (select id from players where id = any(pids) and tournament_id = p_tournament
      and team_id is null and pool_status = 'waiting' for update) s;
    if locked <> cardinality(pids) then raise exception 'player_not_waiting'; end if;
    sid := nullif(p_saints ->> i, '')::uuid;
    if sid is not null and not exists (select 1 from saints where id = sid and is_approved and is_active) then raise exception 'saint_unavailable'; end if;
    begin insert into teams (tournament_id, saint_id, source, batch_seed) values (p_tournament, sid, 'automatic', p_seed) returning id into tid;
    exception when unique_violation then raise exception 'saint_taken'; end;
    update players set team_id = tid, pool_status = 'assigned_pending' where id = any(pids);
    made := made || tid;
  end loop;
  insert into audit_logs (admin_user_id, action, entity_type, new_data)
  values (auth.uid(), 'generate_teams', 'teams', jsonb_build_object('seed', p_seed, 'teams', p_teams, 'saints', p_saints));
  return made;
end $$;

revoke all on function rate_limit_hit from public, anon, authenticated;
grant execute on function rate_limit_hit to service_role;
revoke all on function approve_team, reject_team, assign_team_saint, create_generated_teams from public, anon;
grant execute on function approve_team, reject_team, assign_team_saint, create_generated_teams to authenticated;
