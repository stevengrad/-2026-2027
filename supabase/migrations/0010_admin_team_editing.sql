-- Admin-only team editing and deletion. Both operations are blocked once a
-- team appears in a published group or match, protecting tournament history.
create function update_team_roster(p_team uuid, p_saint uuid, p_players jsonb)
returns void language plpgsql security definer set search_path = public as $$
declare
  t teams;
  roster_size int;
  distinct_names int;
  supplied_ids int;
  distinct_ids int;
begin
  if not is_admin() then raise exception 'forbidden'; end if;
  if jsonb_typeof(p_players) is distinct from 'array' then raise exception 'invalid_player_count'; end if;

  select * into t from teams where id = p_team for update;
  if t.id is null then raise exception 'team_not_found'; end if;
  if t.status not in ('pending', 'approved') then raise exception 'team_not_editable'; end if;
  if exists (select 1 from group_teams where team_id = p_team)
    or exists (select 1 from matches where home_team_id = p_team or away_team_id = p_team or winner_team_id = p_team) then
    raise exception 'team_in_competition';
  end if;
  if p_saint is null or not exists (select 1 from saints where id = p_saint and is_approved and is_active) then
    raise exception 'saint_unavailable';
  end if;

  roster_size := jsonb_array_length(p_players);
  if roster_size not between 4 and 7 then raise exception 'invalid_player_count'; end if;
  if exists (
    select 1 from jsonb_array_elements(p_players) x
    where char_length(btrim(coalesce(x->>'name', ''))) not between 2 and 80
       or btrim(coalesce(x->>'class', '')) = ''
  ) then raise exception 'invalid_player_data'; end if;
  select count(distinct lower(btrim(x->>'name'))) into distinct_names from jsonb_array_elements(p_players) x;
  if distinct_names <> roster_size then raise exception 'duplicate_players'; end if;

  select count(*), count(distinct x->>'id') into supplied_ids, distinct_ids
  from jsonb_array_elements(p_players) x where nullif(x->>'id', '') is not null;
  if supplied_ids <> distinct_ids then raise exception 'duplicate_players'; end if;
  if exists (
    select 1 from jsonb_array_elements(p_players) x
    where nullif(x->>'id', '') is not null
      and not exists (select 1 from players p where p.id = (x->>'id')::uuid and p.team_id = p_team)
  ) then raise exception 'player_not_in_team'; end if;

  -- Lock current roster before reconciling the requested roster.
  perform 1 from players where team_id = p_team for update;
  begin
    update teams set saint_id = p_saint where id = p_team;
  exception when unique_violation then raise exception 'saint_taken'; end;

  update players p set
    full_name_ar = btrim(x->>'name'),
    class_name_ar = btrim(x->>'class')
  from jsonb_array_elements(p_players) x
  where p.team_id = p_team and nullif(x->>'id', '') is not null and p.id = (x->>'id')::uuid;

  -- Removing an individually registered player returns them to the waiting pool.
  update players p set team_id = null, pool_status = 'waiting'
  where p.team_id = p_team and p.source = 'individual'
    and not exists (
      select 1 from jsonb_array_elements(p_players) x
      where nullif(x->>'id', '') is not null and (x->>'id')::uuid = p.id
    );

  -- Registration-team players that are removed from the editor are deleted.
  delete from players p
  where p.team_id = p_team and p.source = 'team_registration'
    and not exists (
      select 1 from jsonb_array_elements(p_players) x
      where nullif(x->>'id', '') is not null and (x->>'id')::uuid = p.id
    );

  insert into players (tournament_id, team_id, full_name_ar, class_name_ar, source, pool_status)
  select t.tournament_id, p_team, btrim(x->>'name'), btrim(x->>'class'), 'team_registration', 'not_applicable'
  from jsonb_array_elements(p_players) x
  where nullif(x->>'id', '') is null;

  if (select count(*) from players where team_id = p_team) <> roster_size then raise exception 'roster_update_failed'; end if;
  insert into audit_logs (admin_user_id, action, entity_type, entity_id, new_data)
  values (auth.uid(), 'edit_team_roster', 'teams', p_team::text,
    jsonb_build_object('saint_id', p_saint, 'players_count', roster_size));
end $$;

create function delete_team(p_team uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  t teams;
  returned_individuals int := 0;
  removed_registered int := 0;
begin
  if not is_admin() then raise exception 'forbidden'; end if;
  select * into t from teams where id = p_team for update;
  if t.id is null then raise exception 'team_not_found'; end if;
  if exists (select 1 from group_teams where team_id = p_team)
    or exists (select 1 from matches where home_team_id = p_team or away_team_id = p_team or winner_team_id = p_team) then
    raise exception 'team_in_competition';
  end if;

  update players set team_id = null, pool_status = 'waiting'
  where team_id = p_team and source = 'individual';
  get diagnostics returned_individuals = row_count;
  delete from players where team_id = p_team;
  get diagnostics removed_registered = row_count;
  delete from teams where id = p_team;

  insert into audit_logs (admin_user_id, action, entity_type, entity_id, old_data)
  values (auth.uid(), 'delete_team', 'teams', p_team::text,
    jsonb_build_object('saint_id', t.saint_id, 'returned_individuals', returned_individuals, 'removed_registered_players', removed_registered));
end $$;

revoke all on function update_team_roster(uuid, uuid, jsonb), delete_team(uuid) from public, anon;
grant execute on function update_team_roster(uuid, uuid, jsonb), delete_team(uuid) to authenticated;
