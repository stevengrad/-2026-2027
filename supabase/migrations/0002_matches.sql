-- Groups, matches, events, standings/scorers/Sunday views, admin RPCs, audit triggers.

create table group_generations (            -- randomisation history
  id uuid primary key default gen_random_uuid(),
  tournament_id uuid not null references tournaments on delete restrict,
  seed bigint not null, layout jsonb not null,
  created_by uuid references auth.users, created_at timestamptz not null default now()
);
create table groups (
  id uuid primary key default gen_random_uuid(),
  tournament_id uuid not null references tournaments on delete restrict,
  group_name text not null, sort_order int not null default 0,
  generation_id uuid references group_generations,
  unique (tournament_id, group_name)
);
create table group_teams (
  group_id uuid not null references groups on delete cascade,
  tournament_id uuid not null references tournaments on delete restrict,
  team_id uuid not null references teams on delete restrict,
  primary key (group_id, team_id),
  unique (tournament_id, team_id)
);

create type match_stage as enum ('group','round_of_16','quarter_final','semi_final','third_place','final');
create type match_status as enum ('scheduled','live','completed','postponed','cancelled');
create type match_decision as enum ('regular','extra_time','penalties');

create table matches (
  id uuid primary key default gen_random_uuid(),
  tournament_id uuid not null references tournaments on delete restrict,
  stage match_stage not null,
  group_id uuid references groups on delete restrict,
  home_team_id uuid references teams on delete restrict,   -- null => slot not yet decided (bracket)
  away_team_id uuid references teams on delete restrict,
  scheduled_at timestamptz,                                -- never invented
  home_score int check (home_score >= 0), away_score int check (away_score >= 0),
  score_manual boolean not null default false,             -- true => score no longer auto-synced from events
  decision match_decision, home_pens int check (home_pens >= 0), away_pens int check (away_pens >= 0),
  winner_team_id uuid references teams,
  status match_status not null default 'scheduled',
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  constraint distinct_teams check (home_team_id is distinct from away_team_id or home_team_id is null),
  constraint group_needs_group check ((stage = 'group') = (group_id is not null)),
  constraint completed_needs_score check (status <> 'completed' or (home_score is not null and away_score is not null))
);
create index on matches (tournament_id, stage);
create index on matches (scheduled_at);
create unique index one_group_fixture on matches (group_id, least(home_team_id, away_team_id), greatest(home_team_id, away_team_id))
  where stage = 'group';

create type event_type as enum ('goal','yellow_card','red_card');
create table match_events (
  id uuid primary key default gen_random_uuid(),
  match_id uuid not null references matches on delete cascade,
  player_id uuid references players on delete restrict,    -- null => unattributed goal
  team_id uuid not null references teams on delete restrict, -- goals: team CREDITED; cards: player's team
  event_type event_type not null,
  is_own_goal boolean not null default false,
  event_minute int check (event_minute between 0 and 130),
  notes text, created_at timestamptz not null default now(), created_by uuid default auth.uid(),
  constraint own_goal_only_goal check (not is_own_goal or event_type = 'goal'),
  constraint card_needs_player check (event_type = 'goal' or player_id is not null)
);
create index on match_events (match_id);
create index on match_events (player_id) where event_type = 'goal' and not is_own_goal;

-- ---------- integrity triggers ----------
create function touch_updated_at() returns trigger language plpgsql as $$ begin new.updated_at := now(); return new; end $$;
create trigger matches_touch before update on matches for each row execute function touch_updated_at();

create function validate_match_event() returns trigger language plpgsql as $$
declare m matches; pteam uuid;
begin
  select * into m from matches where id = new.match_id;
  if new.team_id not in (m.home_team_id, m.away_team_id) then raise exception 'team_not_in_match'; end if;
  if new.player_id is not null then
    select team_id into pteam from players where id = new.player_id;
    if new.is_own_goal then
      if pteam is null or pteam = new.team_id or pteam not in (m.home_team_id, m.away_team_id) then
        raise exception 'own_goal_player_must_be_opponent'; end if;
    elsif pteam is distinct from new.team_id then raise exception 'player_not_in_team'; end if;
  end if;
  return new;
end $$;
create trigger match_events_validate before insert or update on match_events for each row execute function validate_match_event();

create function sync_match_score() returns trigger language plpgsql security definer set search_path = public as $$
declare mid uuid := coalesce(new.match_id, old.match_id); m matches;
begin
  select * into m from matches where id = mid;
  if m.id is not null and not m.score_manual then
    update matches set
      home_score = (select count(*) from match_events e where e.match_id = mid and e.event_type = 'goal' and e.team_id = m.home_team_id),
      away_score = (select count(*) from match_events e where e.match_id = mid and e.event_type = 'goal' and e.team_id = m.away_team_id)
    where id = mid;
  end if;
  return null;
end $$;
create trigger match_events_sync after insert or update or delete on match_events for each row execute function sync_match_score();

create function only_approved_teams() returns trigger language plpgsql as $$
begin
  if exists (select 1 from teams t where t.id in (new.home_team_id, new.away_team_id) and t.status <> 'approved') then
    raise exception 'team_not_approved'; end if;
  return new;
end $$;
create trigger matches_approved before insert or update of home_team_id, away_team_id on matches for each row execute function only_approved_teams();

-- Generic audit trigger (admin changes only; security definer so clients cannot write audit_logs)
create function audit_row() returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into audit_logs (admin_user_id, action, entity_type, entity_id, old_data, new_data)
  values (auth.uid(), tg_op, tg_table_name, coalesce(new.id, old.id)::text,
          case when tg_op <> 'INSERT' then to_jsonb(old) end, case when tg_op <> 'DELETE' then to_jsonb(new) end);
  return null;
end $$;
create trigger audit_teams after insert or update or delete on teams for each row when (auth.uid() is not null) execute function audit_row();
create trigger audit_matches after insert or update or delete on matches for each row when (auth.uid() is not null) execute function audit_row();
create trigger audit_events after insert or update or delete on match_events for each row when (auth.uid() is not null) execute function audit_row();

-- ---------- admin RPCs ----------
create function publish_groups(p_tournament uuid, p_seed bigint, p_groups jsonb)  -- p_groups: [[teamId,...],...]
returns void language plpgsql security definer set search_path = public as $$
declare g jsonb; gid uuid; gen uuid; i int := 0; a uuid; b uuid; ids uuid[];
begin
  if not is_admin() then raise exception 'forbidden'; end if;
  if exists (select 1 from matches where tournament_id = p_tournament and stage = 'group' and status = 'completed') then
    raise exception 'groups_locked_results_exist'; end if;
  for g in select * from jsonb_array_elements(p_groups) loop
    if jsonb_array_length(g) not in (3,4) then raise exception 'invalid_group_size'; end if;
  end loop;
  delete from match_events where match_id in (select id from matches where tournament_id = p_tournament and stage = 'group');
  delete from matches where tournament_id = p_tournament and stage = 'group';
  delete from group_teams where tournament_id = p_tournament;
  delete from groups where tournament_id = p_tournament;
  insert into group_generations (tournament_id, seed, layout, created_by) values (p_tournament, p_seed, p_groups, auth.uid()) returning id into gen;
  for g in select * from jsonb_array_elements(p_groups) loop
    i := i + 1;
    insert into groups (tournament_id, group_name, sort_order, generation_id)
      values (p_tournament, 'المجموعة ' || i, i, gen) returning id into gid;
    select array_agg(x::uuid) into ids from jsonb_array_elements_text(g) x;
    foreach a in array ids loop
      if not exists (select 1 from teams where id = a and tournament_id = p_tournament and status = 'approved') then
        raise exception 'team_not_approved'; end if;
      insert into group_teams values (gid, p_tournament, a);
    end loop;
    foreach a in array ids loop foreach b in array ids loop
      if a < b then insert into matches (tournament_id, stage, group_id, home_team_id, away_team_id) values (p_tournament, 'group', gid, a, b); end if;
    end loop; end loop;
  end loop;
end $$;

create function set_match_score(p_match uuid, p_home int, p_away int, p_complete boolean default false,
  p_decision match_decision default 'regular', p_hp int default null, p_ap int default null)
returns void language plpgsql security definer set search_path = public as $$
declare m matches; w uuid;
begin
  if not is_admin() then raise exception 'forbidden'; end if;
  select * into m from matches where id = p_match for update;
  if p_complete and m.stage <> 'group' then
    if p_home <> p_away then w := case when p_home > p_away then m.home_team_id else m.away_team_id end;
    elsif p_hp is null or p_ap is null or p_hp = p_ap then raise exception 'penalties_required';
    else w := case when p_hp > p_ap then m.home_team_id else m.away_team_id end; end if;
  end if;
  update matches set home_score = p_home, away_score = p_away, score_manual = true,
    status = case when p_complete then 'completed' else status end,
    decision = p_decision, home_pens = p_hp, away_pens = p_ap, winner_team_id = w where id = p_match;
end $$;
revoke all on function publish_groups, set_match_score from public, anon;
grant execute on function publish_groups, set_match_score to authenticated;

-- ---------- RLS ----------
alter table group_generations enable row level security;
alter table groups enable row level security;
alter table group_teams enable row level security;
alter table matches enable row level security;
alter table match_events enable row level security;
revoke all on group_generations, groups, group_teams, matches, match_events from anon, authenticated;
grant select on groups, group_teams, matches to anon, authenticated;
create policy groups_read on groups for select using (true);
create policy gt_read on group_teams for select using (true);   -- only approved teams can enter (checked in publish_groups)
create policy matches_read on matches for select using (status <> 'cancelled' or is_admin());
grant select, insert, update, delete on groups, group_teams, matches, match_events to authenticated;
grant select on group_generations to authenticated;
create policy groups_admin on groups for all to authenticated using (is_admin()) with check (is_admin());
create policy gt_admin on group_teams for all to authenticated using (is_admin()) with check (is_admin());
create policy matches_admin on matches for all to authenticated using (is_admin()) with check (is_admin());
create policy events_admin on match_events for all to authenticated using (is_admin()) with check (is_admin());
create policy gen_admin on group_generations for select to authenticated using (is_admin());
create policy matches_read_admin on matches for select to authenticated using (is_admin());

-- ---------- public views (read-only, approved data only) ----------
create view public_group_standings as
with res as (
  select group_id, home_team_id team_id, home_score gf, away_score ga from matches where stage = 'group' and status = 'completed'
  union all
  select group_id, away_team_id, away_score, home_score from matches where stage = 'group' and status = 'completed'),
agg as (
  select gt.group_id, gt.team_id,
    count(r.team_id) played, count(*) filter (where r.gf > r.ga) won, count(*) filter (where r.gf = r.ga) drawn,
    count(*) filter (where r.gf < r.ga) lost, coalesce(sum(r.gf),0) gf, coalesce(sum(r.ga),0) ga
  from group_teams gt left join res r on r.group_id = gt.group_id and r.team_id = gt.team_id
  group by gt.group_id, gt.team_id)
select g.group_name, a.group_id, a.team_id, s.name_ar saint_name_ar, s.portrait_path,
  a.played::int, a.won::int, a.drawn::int, a.lost::int, a.gf::int, a.ga::int, (a.gf - a.ga)::int gd,
  (a.won * 3 + a.drawn)::int pts,
  -- SQL ranks by pts/GD/GF; head-to-head & manual tie resolution are applied by the app (see tournament.ts)
  rank() over (partition by a.group_id order by a.won * 3 + a.drawn desc, a.gf - a.ga desc, a.gf desc)::int position
from agg a join groups g on g.id = a.group_id join teams t on t.id = a.team_id join saints s on s.id = t.saint_id;

create view public_top_scorers as
select p.id player_id, p.full_name_ar, t.id team_id, s.name_ar saint_name_ar, s.portrait_path, count(*)::int goals,
  rank() over (order by count(*) desc)::int rank
from match_events e join players p on p.id = e.player_id join teams t on t.id = p.team_id and t.status = 'approved'
join saints s on s.id = t.saint_id
where e.event_type = 'goal' and not e.is_own_goal group by p.id, p.full_name_ar, t.id, s.name_ar, s.portrait_path;

create view public_matches as
select m.id, m.stage, m.group_id, m.scheduled_at, m.status, m.home_score, m.away_score, m.decision, m.home_pens, m.away_pens, m.winner_team_id,
  m.home_team_id, hs.name_ar home_saint, hs.portrait_path home_portrait,
  m.away_team_id, as_.name_ar away_saint, as_.portrait_path away_portrait,
  coalesce((select count(*) from match_events e where e.match_id = m.id and e.event_type='goal' and e.team_id = m.home_team_id),0)::int events_home,
  coalesce((select count(*) from match_events e where e.match_id = m.id and e.event_type='goal' and e.team_id = m.away_team_id),0)::int events_away,
  (m.status = 'completed' or m.score_manual) and (
    coalesce(m.home_score,0) <> (select count(*) from match_events e where e.match_id = m.id and e.event_type='goal' and e.team_id = m.home_team_id)
    or coalesce(m.away_score,0) <> (select count(*) from match_events e where e.match_id = m.id and e.event_type='goal' and e.team_id = m.away_team_id)
  ) score_discrepancy,
  (extract(dow from m.scheduled_at at time zone 'Africa/Cairo') = 0) is_sunday_cairo
from matches m
left join teams ht on ht.id = m.home_team_id left join saints hs on hs.id = ht.saint_id
left join teams awt on awt.id = m.away_team_id left join saints as_ on as_.id = awt.saint_id
where m.status <> 'cancelled';

create view public_match_events as
select e.id, e.match_id, e.team_id, e.event_type, e.is_own_goal, e.event_minute, p.full_name_ar player_name
from match_events e join matches m on m.id = e.match_id and m.status <> 'cancelled' left join players p on p.id = e.player_id;

grant select on public_group_standings, public_top_scorers, public_matches, public_match_events to anon, authenticated;
