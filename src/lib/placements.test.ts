import { describe, expect, it } from 'vitest';
import { getMatchPlacements } from './placements';
import type { PublicMatch } from './types';

const baseMatch: PublicMatch = {
  id: 'match-1', stage: 'final', group_id: null, scheduled_at: null,
  status: 'completed', bracket_order: 1, home_score: 2, away_score: 1,
  decision: 'regular', home_pens: null, away_pens: null, winner_team_id: 'team-a',
  home_team_id: 'team-a', home_saint: 'القديس مارمرقس', home_portrait: null,
  away_team_id: 'team-b', away_saint: 'القديس بطرس', away_portrait: null,
  events_home: 0, events_away: 0, score_discrepancy: false, is_sunday_cairo: false,
};

describe('official knockout finishing positions', () => {
  it('marks the final winner first and the opponent second', () => {
    expect(getMatchPlacements(baseMatch)).toEqual({ home: 'winner', away: 'second' });
  });

  it('handles an away winner in the final', () => {
    expect(getMatchPlacements({ ...baseMatch, winner_team_id: 'team-b' }))
      .toEqual({ home: 'second', away: 'winner' });
  });

  it('marks the third-place match winner third and the opponent fourth', () => {
    expect(getMatchPlacements({ ...baseMatch, stage: 'third_place' }))
      .toEqual({ home: 'third', away: 'fourth' });
  });

  it('handles an away winner in the third-place match', () => {
    expect(getMatchPlacements({ ...baseMatch, stage: 'third_place', winner_team_id: 'team-b' }))
      .toEqual({ home: 'fourth', away: 'third' });
  });

  it('does not label placements before a match is completed', () => {
    expect(getMatchPlacements({ ...baseMatch, status: 'live', winner_team_id: null }))
      .toEqual({ home: null, away: null });
  });

  it('does not label a result with an unrelated winner id', () => {
    expect(getMatchPlacements({ ...baseMatch, winner_team_id: 'other-team' }))
      .toEqual({ home: null, away: null });
  });

  it('does not assign final-place labels to other knockout rounds', () => {
    expect(getMatchPlacements({ ...baseMatch, stage: 'semi_final' }))
      .toEqual({ home: null, away: null });
  });
});
