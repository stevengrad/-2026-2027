-- Fair cross-group comparison and a protected, atomic reset of tournament match data.

-- Preserve seeded match order in the public bracket (scheduled_at is often NULL).
alter table matches add column if not exists bracket_order integer check (bracket_order is null or bracket_order > 0);

with ranked_matches as (
  select id, row_number() over (partition by tournament_id, stage order by created_at, id)::integer as slot
  from matches where stage <> 'group'
)
update matches m set bracket_order = r.slot
from ranked_matches r where m.id = r.id and m.bracket_order is null;

create index if not exists matches_bracket_order_idx on matches (tournament_id, stage, bracket_order);

create or replace view public_matches as
select m.id, m.stage, m.group_id, m.scheduled_at, m.status, m.home_score, m.away_score, m.decision, m.home_pens, m.away_pens, m.winner_team_id,
  m.home_team_id, hs.name_ar home_saint, hs.portrait_path home_portrait,
  m.away_team_id, as_.name_ar away_saint, as_.portrait_path away_portrait,
  coalesce((select count(*) from match_events e where e.match_id = m.id and e.event_type='goal' and e.team_id = m.home_team_id),0)::int events_home,
  coalesce((select count(*) from match_events e where e.match_id = m.id and e.event_type='goal' and e.team_id = m.away_team_id),0)::int events_away,
  (m.status = 'completed' or m.score_manual) and (
    coalesce(m.home_score,0) <> (select count(*) from match_events e where e.match_id = m.id and e.event_type='goal' and e.team_id = m.home_team_id)
    or coalesce(m.away_score,0) <> (select count(*) from match_events e where e.match_id = m.id and e.event_type='goal' and e.team_id = m.away_team_id)
  ) score_discrepancy,
  (extract(dow from m.scheduled_at at time zone 'Africa/Cairo') = 0) is_sunday_cairo,
  m.bracket_order
from matches m
left join teams ht on ht.id = m.home_team_id left join saints hs on hs.id = ht.saint_id
left join teams awt on awt.id = m.away_team_id left join saints as_ on as_.id = awt.saint_id
where m.status <> 'cancelled';

-- Team registrations, teams, players and saints are intentionally preserved.

create or replace function reset_tournament_competition_data()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tournament uuid;
  v_events bigint := 0;
  v_matches bigint := 0;
  v_group_teams bigint := 0;
  v_groups bigint := 0;
  v_generations bigint := 0;
begin
  if not is_admin() then
    raise exception 'forbidden';
  end if;

  select id into v_tournament from tournaments limit 1;
  if v_tournament is null then
    raise exception 'tournament_not_found';
  end if;

  -- Explicit order documents the dependencies; the function runs in one transaction.
  delete from match_events e
  using matches m
  where e.match_id = m.id and m.tournament_id = v_tournament;
  get diagnostics v_events = row_count;

  delete from matches where tournament_id = v_tournament;
  get diagnostics v_matches = row_count;

  delete from group_teams where tournament_id = v_tournament;
  get diagnostics v_group_teams = row_count;

  delete from groups where tournament_id = v_tournament;
  get diagnostics v_groups = row_count;

  delete from group_generations where tournament_id = v_tournament;
  get diagnostics v_generations = row_count;

  return jsonb_build_object(
    'ok', true,
    'eventsDeleted', v_events,
    'matchesDeleted', v_matches,
    'groupTeamsDeleted', v_group_teams,
    'groupsDeleted', v_groups,
    'groupGenerationsDeleted', v_generations
  );
end;
$$;

revoke all on function reset_tournament_competition_data() from public, anon;
grant execute on function reset_tournament_competition_data() to authenticated;
