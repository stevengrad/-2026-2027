-- Manual teams must have 4–7 players. The public form and Edge Function
-- validate this too; the database transaction is the final authority.
create or replace function register_team_tx(p_tournament uuid, p_saint uuid, p_players jsonb, p_key text)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_team uuid; v_n int; v_distinct int; r record;
begin
  if not registration_open(p_tournament) then raise exception 'registration_closed'; end if;
  if exists (select 1 from registration_requests where idempotency_key = p_key) then
    return (select team_id from registration_requests where idempotency_key = p_key);
  end if;
  v_n := jsonb_array_length(p_players);
  if v_n < 4 or v_n > 7 then raise exception 'invalid_player_count'; end if;
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

-- This prevents an administrator from approving a partial manual roster.
create or replace function approve_team(p_team uuid) returns void language plpgsql security definer set search_path = public as $$
declare t teams; roster_count int;
begin
  if not is_admin() then raise exception 'forbidden'; end if;
  select * into t from teams where id = p_team for update;
  if t.id is null or t.status <> 'pending' then raise exception 'not_pending'; end if;
  if t.saint_id is null then raise exception 'saint_required'; end if;
  select count(*) into roster_count from players where team_id = p_team;
  if roster_count not between 4 and 7 then raise exception 'invalid_player_count'; end if;
  update teams set status = 'approved', approved_at = now(), approved_by = auth.uid() where id = p_team;
  update players set pool_status = 'placed' where team_id = p_team and source = 'individual';
end $$;
