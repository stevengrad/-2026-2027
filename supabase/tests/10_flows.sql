\set ON_ERROR_STOP on
do $$
declare T constant uuid := '00000000-0000-0000-0000-0000000000aa'; ADM constant uuid := '00000000-0000-0000-0000-00000000ad01';
  USR constant uuid := '00000000-0000-0000-0000-00000000bb01'; i int; pl uuid[]; ts uuid[]; s1 uuid; s2 uuid; tm uuid; pids jsonb;
begin
  update tournaments set registration_deadline = now() + interval '1 day';
  perform t_eq('rate limit allows then blocks', (select array_agg(rate_limit_hit('ip1', 2, '1 hour') order by g) from generate_series(1,3) g), array[true,true,false]);
  for i in 1..9 loop perform register_individual_tx(T, 'لاعب فردي ' || i, 'فصل', 'ind' || i); end loop;
  perform t_eq('replayed individual ignored', register_individual_tx(T, 'x y', 'f', 'ind1'), null::uuid);
  perform t_eq('9 waiting', (select count(*) from players where pool_status = 'waiting'), 9::bigint);
  perform t_eq('waiting players hidden from public', t_exec('anon', null, 'select 1 from public_team_players'), 11::bigint); -- approved rosters only (rejected team + waiting pool hidden)
  select array_agg(id order by full_name_ar) into pl from players where pool_status = 'waiting';
  insert into saints (name_ar, letter, is_approved, image_rights) values ('قديس حر 1','ب',true,'user_owned'), ('قديس حر 2','ب',true,'user_owned');
  select id into s1 from saints where name_ar = 'قديس حر 1'; select id into s2 from saints where name_ar = 'قديس حر 2';
  pids := jsonb_build_array(to_jsonb(pl[1:5]), to_jsonb(pl[6:9]));
  perform t_fail('authenticated', USR, format('select create_generated_teams(%L, 7, %L, %L)', T, pids, jsonb_build_array(s1, s2)), 'forbidden');
  perform t_fail('authenticated', ADM, format('select create_generated_teams(%L, 7, %L, %L)', T, jsonb_build_array(to_jsonb(pl[1:3])), jsonb_build_array(s1)), 'invalid_team_size');
  perform t_fail('authenticated', ADM, format('select create_generated_teams(%L, 7, %L, %L)', T, pids, jsonb_build_array(s1, (select id from saints where name_ar = 'قديس 1'))), 'saint_taken');
  perform t_eq('failed batch rolled back', (select count(*) from players where pool_status = 'waiting'), 9::bigint);
  perform t_exec('authenticated', ADM, format('select create_generated_teams(%L, 7, %L, %L)', T, pids, jsonb_build_array(s1, null)));
  perform t_eq('2 automatic pending teams', (select count(*) from teams where source = 'automatic' and status = 'pending'), 2::bigint);
  perform t_eq('players assigned_pending', (select count(*) from players where pool_status = 'assigned_pending'), 9::bigint);
  perform t_fail('authenticated', ADM, format('select create_generated_teams(%L, 8, %L, %L)', T, jsonb_build_array(to_jsonb(pl[1:4])), jsonb_build_array(s2)), 'player_not_waiting');
  select id into tm from teams where source = 'automatic' and saint_id is null;
  perform t_fail('authenticated', ADM, format('select approve_team(%L)', tm), 'saint_required');
  perform t_exec('authenticated', ADM, format('select assign_team_saint(%L, %L)', tm, s2));
  perform t_exec('authenticated', ADM, format('select approve_team(%L)', tm));
  perform t_eq('approved + placed', (select count(*) from players where team_id = tm and pool_status = 'placed'), 4::bigint);
  perform t_eq('generated team now public', t_exec('anon', null, format('select * from public_teams where id = %L', tm)), 1::bigint);
  select id into tm from teams where source = 'automatic' and status = 'pending';
  perform t_fail('authenticated', USR, format('select reject_team(%L, ''x'', true)', tm), 'forbidden');
  perform t_exec('authenticated', ADM, format('select reject_team(%L, ''لا يصلح'', true)', tm));
  perform t_eq('rejected players back in pool', (select count(*) from players where pool_status = 'waiting' and team_id is null), 5::bigint);
  perform t_eq('return audited', (select count(*) from audit_logs where action = 'return_players_to_pool'), 1::bigint);
  raise notice 'FLOW TESTS PASSED';
end $$;
