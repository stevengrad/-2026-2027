\set ON_ERROR_STOP on
-- helpers: run a statement as a role/user, return rows affected; t_fail asserts it errors (optionally with text)
create or replace function t_exec(r text, uid uuid, q text) returns bigint language plpgsql as $$
declare n bigint; begin
  perform set_config('request.jwt.claim.sub', coalesce(uid::text,''), true);
  execute 'set local role ' || r; execute q; get diagnostics n = row_count; reset role; return n;
exception when others then reset role; raise; end $$;
create or replace function t_fail(r text, uid uuid, q text, expect text default null) returns void language plpgsql as $$
declare ok boolean := false; begin
  begin perform t_exec(r, uid, q); ok := true; exception when others then
    if expect is not null and sqlerrm not like '%'||expect||'%' then raise exception 'wrong error [%] for: %', sqlerrm, q; end if; end;
  if ok then raise exception 'EXPECTED FAILURE BUT SUCCEEDED: %', q; end if; end $$;
create or replace function t_eq(label text, got anyelement, want anyelement) returns void language plpgsql as $$
begin if got is distinct from want then raise exception 'FAIL % : got % want %', label, got, want; end if; raise notice 'ok  %', label; end $$;

-- seed
insert into tournaments (id, name_ar) values ('00000000-0000-0000-0000-0000000000aa', 'بطولة');
insert into auth.users (id, email) values ('00000000-0000-0000-0000-00000000ad01','admin@x'), ('00000000-0000-0000-0000-00000000bb01','user@x');
insert into admin_users (user_id) values ('00000000-0000-0000-0000-00000000ad01');
insert into saints (name_ar, letter, is_approved, image_rights) select 'قديس ' || i, 'أ', true, 'user_owned' from generate_series(1,8) i;

do $$
declare T constant uuid := '00000000-0000-0000-0000-0000000000aa'; ADM constant uuid := '00000000-0000-0000-0000-00000000ad01';
  USR constant uuid := '00000000-0000-0000-0000-00000000bb01'; i int; tid uuid; sid uuid[]; gid uuid; mid uuid; p1 uuid; p2 uuid; a uuid; b uuid; ids uuid[]; qf1 uuid; qf2 uuid; sf1 uuid; sf2 uuid; final_match uuid; third_match uuid;
begin
  select array_agg(id order by name_ar) into sid from saints;
  -- 6 manual teams via the service-role registration function
  for i in 1..6 loop
    tid := (select register_team_tx(T, sid[i], jsonb_build_array(jsonb_build_object('name','لاعب '||i||'أ','class','فصل 1'), jsonb_build_object('name','لاعب '||i||'ب','class','فصل 2')), 'k'||i));
  end loop;
  perform t_eq('6 pending teams', (select count(*) from teams where status='pending'), 6::bigint);
  -- idempotent replay returns same team, no duplicate
  perform register_team_tx(T, sid[1], '[{"name":"لاعب 1أ","class":"x"}]'::jsonb, 'k1');
  perform t_eq('idempotent replay', (select count(*) from teams), 6::bigint);
  perform t_fail('service_role', null, format($q$select register_team_tx(%L,%L,'[{"name":"س","class":"x"}]','z1')$q$, T, sid[1]), 'saint_taken');
  perform t_fail('service_role', null, format($q$select register_team_tx(%L,%L,'[{"name":"abc","class":"x"},{"name":"ABC ","class":"y"}]','z2')$q$, T, sid[7]), 'duplicate_players');
  perform t_fail('service_role', null, format($q$select register_team_tx(%L,%L,'[1,2,3,4,5,6,7,8]','z3')$q$, T, sid[7]));

  -- public cannot see or write anything private
  perform t_fail('anon', null, 'select * from teams');
  perform t_fail('anon', null, 'select * from players');
  perform t_fail('anon', null, 'select * from admin_users');
  perform t_fail('anon', null, 'select * from audit_logs');
  perform t_fail('anon', null, 'insert into matches (tournament_id, stage) values (null, ''final'')');
  perform t_fail('anon', null, 'update tournaments set name_ar = ''x''');
  perform t_fail('anon', null, format('select register_team_tx(%L,%L,''[]'',''q'')', T, sid[8]));
  perform t_fail('authenticated', USR, format('select register_team_tx(%L,%L,''[]'',''q'')', T, sid[8]));
  perform t_eq('anon sees 0 pending in public_teams', t_exec('anon', null, 'select * from public_teams'), 0::bigint);
  perform t_eq('non-admin update touches 0 rows', t_exec('authenticated', USR, 'update teams set status = ''approved'''), 0::bigint);
  perform t_fail('authenticated', USR, format('select publish_groups(%L, 1, ''[]'')', T), 'forbidden');
  perform t_fail('authenticated', USR, 'select set_match_score(gen_random_uuid(), 1, 0)', 'forbidden');

  -- admin approves 6 teams -> public sees them, roster has names only
  perform t_eq('admin approves', t_exec('authenticated', ADM, 'update teams set status = ''approved'', approved_at = now()'), 6::bigint);
  perform t_eq('public_teams shows approved', t_exec('anon', null, 'select * from public_teams'), 6::bigint);
  perform t_eq('public roster', t_exec('anon', null, 'select * from public_team_players'), 12::bigint);
  perform t_fail('anon', null, 'select class_name_ar from public_team_players');

  -- rejection releases saint
  update teams set status = 'rejected' where saint_id = sid[6];
  perform register_team_tx(T, sid[6], '[{"name":"جديد","class":"x"}]'::jsonb, 'again');
  update teams set status = 'approved' where saint_id = sid[6] and status = 'pending';
  perform t_eq('saint reusable after rejection', (select count(*) from teams where saint_id = sid[6] and status='approved'), 1::bigint);

  -- groups: 6 teams -> 3+3, 6 fixtures, no dates invented
  select array_agg(id order by team_number) into ids from teams where status = 'approved';
  perform set_config('request.jwt.claim.sub', ADM::text, true);
  set local role authenticated;
  perform publish_groups(T, 99, jsonb_build_array(to_jsonb(ids[1:3]), to_jsonb(ids[4:6])));
  reset role;
  perform t_eq('2 groups', (select count(*) from groups), 2::bigint);
  perform t_eq('6 group fixtures', (select count(*) from matches where stage='group'), 6::bigint);
  perform t_eq('no invented dates', (select count(*) from matches where scheduled_at is not null), 0::bigint);
  perform t_fail('authenticated', ADM, format('select publish_groups(%L, 1, ''[["%s","%s"]]'')', T, ids[1], ids[2]), 'invalid_group_size');

  -- events: goals sync score, own goal excluded from scorers
  select m.id, m.home_team_id, m.away_team_id into mid, a, b from matches m where stage='group' order by id limit 1;
  select id into p1 from players where team_id = a limit 1; select id into p2 from players where team_id = b limit 1;
  perform t_eq('goal inserted by admin', t_exec('authenticated', ADM, format('insert into match_events (match_id,player_id,team_id,event_type,event_minute) values (%L,%L,%L,''goal'',10)', mid, p1, a)), 1::bigint);
  perform t_eq('own goal credited to a', t_exec('authenticated', ADM, format('insert into match_events (match_id,player_id,team_id,event_type,is_own_goal) values (%L,%L,%L,''goal'',true)', mid, p2, a)), 1::bigint);
  perform t_eq('home score synced', (select home_score from matches where id = mid), case when (select home_team_id from matches where id=mid)=a then 2 else 0 end);
  perform t_fail('authenticated', ADM, format('insert into match_events (match_id,player_id,team_id,event_type) values (%L,%L,%L,''goal'')', mid, p2, a), 'player_not_in_team');
  perform t_fail('authenticated', ADM, format('insert into match_events (match_id,player_id,team_id,event_type,is_own_goal) values (%L,%L,%L,''goal'',true)', mid, p1, a), 'own_goal_player_must_be_opponent');
  perform t_eq('scorer count excludes own goal', (select goals from public_top_scorers where player_id = p1), 1);
  perform t_eq('own-goal player not a scorer', (select count(*) from public_top_scorers where player_id = p2), 0::bigint);
  perform t_eq('public can read events', t_exec('anon', null, 'select * from public_match_events'), 2::bigint);
  perform t_fail('anon', null, format('insert into match_events (match_id,team_id,event_type) values (%L,%L,''goal'')', mid, a));
  perform t_fail('anon', null, 'delete from match_events');

  -- manual score differing from events -> discrepancy flag
  perform t_exec('authenticated', ADM, format('select set_match_score(%L, 5, 0, true)', mid));
  perform t_eq('discrepancy flagged', (select score_discrepancy from public_matches where id = mid), true);
  perform t_eq('standings use completed result', (select max(pts) from public_group_standings), 3);
  perform t_fail('authenticated', ADM, format('select publish_groups(%L, 2, ''[]'')', T), 'groups_locked_results_exist');
  perform t_eq('audit trail written', (select count(*) > 0 from audit_logs), true);

  -- knockout draw needs penalties
  insert into matches (tournament_id, stage, home_team_id, away_team_id) values (T,'final',ids[1],ids[4]) returning id into mid;
  perform t_fail('authenticated', ADM, format('select set_match_score(%L,1,1,true)', mid), 'penalties_required');
  perform t_exec('authenticated', ADM, format('select set_match_score(%L,1,1,true,''penalties'',4,3)', mid));
  perform t_eq('penalty winner', (select winner_team_id from matches where id = mid), ids[1]);

  -- Knockout advancement: quarter-final winners feed the matching semi-final slots;
  -- the semi-final winner enters the final and its loser enters the third-place match.
  insert into matches (tournament_id, stage, bracket_order, home_team_id, away_team_id)
    values (T, 'quarter_final', 1, ids[1], ids[2]) returning id into qf1;
  insert into matches (tournament_id, stage, bracket_order, home_team_id, away_team_id)
    values (T, 'quarter_final', 2, ids[3], ids[4]) returning id into qf2;
  insert into matches (tournament_id, stage, bracket_order)
    values (T, 'semi_final', 1) returning id into sf1;
  insert into matches (tournament_id, stage, bracket_order, home_team_id, away_team_id)
    values (T, 'semi_final', 2, ids[5], ids[6]) returning id into sf2;
  insert into matches (tournament_id, stage, bracket_order)
    values (T, 'final', 1) returning id into final_match;
  insert into matches (tournament_id, stage)
    values (T, 'third_place') returning id into third_match;

  perform t_exec('authenticated', ADM, format('select set_match_score(%L,2,0,true)', qf1));
  perform t_eq('quarter-final 1 winner advances to semi home slot', (select home_team_id from matches where id = sf1), ids[1]);
  perform t_exec('authenticated', ADM, format('select set_match_score(%L,0,1,true)', qf2));
  perform t_eq('quarter-final 2 winner advances to semi away slot', (select away_team_id from matches where id = sf1), ids[4]);
  perform t_exec('authenticated', ADM, format('select set_match_score(%L,3,0,true)', sf1));
  perform t_eq('semi-final 1 winner advances to final home slot', (select home_team_id from matches where id = final_match), ids[1]);
  perform t_eq('semi-final 1 loser advances to third-place home slot', (select home_team_id from matches where id = third_match), ids[4]);
  perform t_exec('authenticated', ADM, format('select set_match_score(%L,0,2,true)', sf2));
  perform t_eq('semi-final 2 winner advances to final away slot', (select away_team_id from matches where id = final_match), ids[6]);
  perform t_eq('semi-final 2 loser advances to third-place away slot', (select away_team_id from matches where id = third_match), ids[5]);

  -- deadline enforced by DB clock
  update tournaments set registration_deadline = now() - interval '1 second';
  perform t_fail('service_role', null, format($q$select register_team_tx(%L,%L,'[{"name":"م","class":"x"}]','late')$q$, T, sid[8]), 'registration_closed');
  perform t_fail('service_role', null, format($q$select register_individual_tx(%L,'ماريا','x','late2')$q$, T), 'registration_closed');
  raise notice 'ALL DATABASE TESTS PASSED';
end $$;
