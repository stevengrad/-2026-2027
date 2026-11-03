-- Automatically move knockout winners into the correct slot of the next round.
-- Semi-final losers are also placed into the third-place match when that match exists.
-- If a downstream match has already started, changing its participant is blocked to
-- protect results/events that would otherwise become invalid.

create or replace function set_match_score(
  p_match uuid,
  p_home int,
  p_away int,
  p_complete boolean default false,
  p_decision match_decision default 'regular',
  p_hp int default null,
  p_ap int default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  m matches;
  v_winner uuid := null;
  v_loser uuid := null;
  v_next_stage match_stage := null;
  v_next_order integer;
  v_next matches;
  v_target_team uuid;
  v_current_team uuid;
  v_home_slot boolean;
begin
  if not is_admin() then
    raise exception 'forbidden';
  end if;

  select * into m
  from matches
  where id = p_match
  for update;

  if m.id is null then
    raise exception 'match_not_found';
  end if;

  if p_complete and (p_home is null or p_away is null) then
    raise exception 'score_required';
  end if;

  if p_complete and m.stage <> 'group' then
    if m.home_team_id is null or m.away_team_id is null then
      raise exception 'knockout_teams_missing';
    end if;

    if p_home <> p_away then
      v_winner := case when p_home > p_away then m.home_team_id else m.away_team_id end;
    else
      if p_decision is distinct from 'penalties' or p_hp is null or p_ap is null or p_hp = p_ap then
        raise exception 'penalties_required';
      end if;
      v_winner := case when p_hp > p_ap then m.home_team_id else m.away_team_id end;
    end if;

    v_loser := case when v_winner = m.home_team_id then m.away_team_id else m.home_team_id end;
  end if;

  -- Determine the next normal knockout stage. The current match number determines
  -- both the destination match and whether the winner goes into its home or away slot:
  -- 1 -> match 1 home, 2 -> match 1 away, 3 -> match 2 home, 4 -> match 2 away, etc.
  v_next_stage := case m.stage
    when 'round_of_64' then 'round_of_32'::match_stage
    when 'round_of_32' then 'round_of_16'::match_stage
    when 'round_of_16' then 'quarter_final'::match_stage
    when 'quarter_final' then 'semi_final'::match_stage
    when 'semi_final' then 'final'::match_stage
    else null
  end;

  -- Synchronize progression when this match is completed, or when an already
  -- completed match is being reopened. This also repairs older brackets whose
  -- winners were saved before automatic advancement was installed.
  if m.stage <> 'group' and (m.winner_team_id is not null or v_winner is not null) then
    if v_next_stage is not null then
      if m.bracket_order is null or m.bracket_order < 1 then
        raise exception 'bracket_order_required';
      end if;

      v_next_order := (m.bracket_order + 1) / 2;
      v_home_slot := (m.bracket_order % 2) = 1;
      v_target_team := v_winner;

      select * into v_next
      from matches
      where tournament_id = m.tournament_id
        and stage = v_next_stage
        and bracket_order = v_next_order
      for update;

      if not found and v_target_team is not null then
        raise exception 'next_round_match_missing';
      end if;

      if found then
        v_current_team := case when v_home_slot then v_next.home_team_id else v_next.away_team_id end;
        if v_current_team is distinct from v_target_team then
          if v_next.status in ('live', 'completed')
            or v_next.home_score is not null
            or v_next.away_score is not null
            or v_next.winner_team_id is not null
            or exists (select 1 from match_events e where e.match_id = v_next.id) then
            raise exception 'downstream_match_already_started';
          end if;

          if v_home_slot then
            update matches set home_team_id = v_target_team where id = v_next.id;
          else
            update matches set away_team_id = v_target_team where id = v_next.id;
          end if;
        end if;
      end if;
    end if;

    -- The two semi-final losers play for third place. Their source match number
    -- (#1/#2) maps to the home/away slot in that single match.
    if m.stage = 'semi_final' and m.bracket_order in (1, 2) then
      v_home_slot := m.bracket_order = 1;
      v_target_team := v_loser;

      select * into v_next
      from matches
      where tournament_id = m.tournament_id
        and stage = 'third_place'
      order by created_at, id
      limit 1
      for update;

      if found then
        v_current_team := case when v_home_slot then v_next.home_team_id else v_next.away_team_id end;
        if v_current_team is distinct from v_target_team then
          if v_next.status in ('live', 'completed')
            or v_next.home_score is not null
            or v_next.away_score is not null
            or v_next.winner_team_id is not null
            or exists (select 1 from match_events e where e.match_id = v_next.id) then
            raise exception 'downstream_match_already_started';
          end if;

          if v_home_slot then
            update matches set home_team_id = v_target_team where id = v_next.id;
          else
            update matches set away_team_id = v_target_team where id = v_next.id;
          end if;
        end if;
      end if;
    end if;
  end if;

  update matches
  set home_score = p_home,
      away_score = p_away,
      score_manual = true,
      status = case
        when p_complete then 'completed'::match_status
        when m.status = 'completed' then 'scheduled'::match_status
        else m.status
      end,
      decision = p_decision,
      home_pens = p_hp,
      away_pens = p_ap,
      winner_team_id = v_winner
  where id = p_match;
end;
$$;

revoke all on function set_match_score(uuid, integer, integer, boolean, match_decision, integer, integer) from public, anon;
grant execute on function set_match_score(uuid, integer, integer, boolean, match_decision, integer, integer) to authenticated;

-- Backfill fixtures already completed before this migration. This makes existing
-- quarter-final / semi-final results advance immediately after deployment, without
-- requiring the administrator to re-enter each score.
update matches m
set winner_team_id = case
  when m.home_score > m.away_score then m.home_team_id
  when m.home_score < m.away_score then m.away_team_id
  when m.decision = 'penalties' and m.home_pens > m.away_pens then m.home_team_id
  when m.decision = 'penalties' and m.home_pens < m.away_pens then m.away_team_id
  else m.winner_team_id
end
where m.stage <> 'group'
  and m.status = 'completed'
  and m.winner_team_id is null
  and m.home_team_id is not null
  and m.away_team_id is not null
  and m.home_score is not null
  and m.away_score is not null
  and (
    m.home_score <> m.away_score
    or (m.decision = 'penalties' and m.home_pens is not null and m.away_pens is not null and m.home_pens <> m.away_pens)
  );

do $$
declare
  r record;
  v_next_stage match_stage;
  v_target_match uuid;
  v_target_team uuid;
  v_loser uuid;
  v_home_slot boolean;
begin
  for r in
    select tournament_id, stage, bracket_order, home_team_id, away_team_id, winner_team_id
    from matches
    where stage in ('round_of_64', 'round_of_32', 'round_of_16', 'quarter_final', 'semi_final')
      and status = 'completed'
      and winner_team_id is not null
      and bracket_order is not null
    order by stage, bracket_order
  loop
    v_next_stage := case r.stage
      when 'round_of_64' then 'round_of_32'::match_stage
      when 'round_of_32' then 'round_of_16'::match_stage
      when 'round_of_16' then 'quarter_final'::match_stage
      when 'quarter_final' then 'semi_final'::match_stage
      when 'semi_final' then 'final'::match_stage
      else null
    end;

    v_home_slot := (r.bracket_order % 2) = 1;
    v_target_team := r.winner_team_id;

    if v_next_stage is not null then
      select id into v_target_match
      from matches
      where tournament_id = r.tournament_id
        and stage = v_next_stage
        and bracket_order = (r.bracket_order + 1) / 2
      limit 1;

      if v_target_match is not null then
        if v_home_slot then
          update matches target
          set home_team_id = v_target_team
          where target.id = v_target_match
            and target.status not in ('live', 'completed')
            and target.home_score is null and target.away_score is null
            and target.winner_team_id is null
            and not exists (select 1 from match_events e where e.match_id = target.id)
            and target.home_team_id is distinct from v_target_team;
        else
          update matches target
          set away_team_id = v_target_team
          where target.id = v_target_match
            and target.status not in ('live', 'completed')
            and target.home_score is null and target.away_score is null
            and target.winner_team_id is null
            and not exists (select 1 from match_events e where e.match_id = target.id)
            and target.away_team_id is distinct from v_target_team;
        end if;
      end if;
    end if;

    if r.stage = 'semi_final' and r.bracket_order in (1, 2) then
      v_loser := case when r.winner_team_id = r.home_team_id then r.away_team_id else r.home_team_id end;
      v_home_slot := r.bracket_order = 1;
      select id into v_target_match
      from matches
      where tournament_id = r.tournament_id and stage = 'third_place'
      order by created_at, id
      limit 1;

      if v_target_match is not null and v_loser is not null then
        if v_home_slot then
          update matches target
          set home_team_id = v_loser
          where target.id = v_target_match
            and target.status not in ('live', 'completed')
            and target.home_score is null and target.away_score is null
            and target.winner_team_id is null
            and not exists (select 1 from match_events e where e.match_id = target.id)
            and target.home_team_id is distinct from v_loser;
        else
          update matches target
          set away_team_id = v_loser
          where target.id = v_target_match
            and target.status not in ('live', 'completed')
            and target.home_score is null and target.away_score is null
            and target.winner_team_id is null
            and not exists (select 1 from match_events e where e.match_id = target.id)
            and target.away_team_id is distinct from v_loser;
        end if;
      end if;
    end if;
  end loop;
end;
$$;
