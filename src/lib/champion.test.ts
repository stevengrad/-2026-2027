import { describe, expect, it } from 'vitest';
import { getTournamentChampion } from './champion';
import type { PublicMatch } from './types';
import type { PublicTeam } from '../hooks/useTournament';

const baseMatch: PublicMatch = {
  id: 'final-1', stage: 'final', group_id: null, scheduled_at: '2026-11-20T19:00:00+02:00',
  status: 'completed', bracket_order: 1, home_score: 2, away_score: 1, decision: 'regular',
  home_pens: null, away_pens: null, winner_team_id: 'team-a', home_team_id: 'team-a', home_saint: 'القديس مارمرقس',
  home_portrait: 'saints/mark.png', away_team_id: 'team-b', away_saint: 'القديس بطرس', away_portrait: 'saints/peter.png',
  events_home: 2, events_away: 1, score_discrepancy: false, is_sunday_cairo: false,
};
const teams: PublicTeam[] = [
  { id: 'team-a', team_number: 4, saint_id: 'saint-a', saint_name_ar: 'القديس مارمرقس', portrait_path: 'saints/mark.png', players_count: 7 },
  { id: 'team-b', team_number: 2, saint_id: 'saint-b', saint_name_ar: 'القديس بطرس', portrait_path: 'saints/peter.png', players_count: 7 },
];

describe('official tournament champion', () => {
  it('does not announce a champion before the final is completed', () => {
    expect(getTournamentChampion([{ ...baseMatch, status: 'live', winner_team_id: null }], teams)).toBeNull();
    expect(getTournamentChampion([{ ...baseMatch, status: 'scheduled', winner_team_id: null }], teams)).toBeNull();
  });

  it('announces only the winner recorded in the completed final', () => {
    expect(getTournamentChampion([baseMatch], teams)).toMatchObject({
      teamId: 'team-a', teamName: 'القديس مارمرقس', teamNumber: 4, wonAtHome: true,
    });
  });

  it('supports a winner away from home and preserves the recorded final result', () => {
    const awayWin = { ...baseMatch, winner_team_id: 'team-b', home_score: 0, away_score: 1, home_team_id: 'team-a' };
    expect(getTournamentChampion([awayWin], teams)).toMatchObject({ teamId: 'team-b', teamName: 'القديس بطرس', wonAtHome: false });
  });

  it('does not announce a winner that is not one of the finalists', () => {
    expect(getTournamentChampion([{ ...baseMatch, winner_team_id: 'unrelated-team' }], teams)).toBeNull();
  });

  it('selects the latest completed final if the feed contains more than one', () => {
    const newer = { ...baseMatch, id: 'final-2', scheduled_at: '2026-12-20T19:00:00+02:00', winner_team_id: 'team-b' };
    expect(getTournamentChampion([baseMatch, newer], teams)?.teamId).toBe('team-b');
  });
});
