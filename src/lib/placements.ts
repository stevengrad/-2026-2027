import type { PublicMatch } from './types';

export type FinalPlacement = 'winner' | 'second' | 'third' | 'fourth';
export interface MatchPlacements {
  home: FinalPlacement | null;
  away: FinalPlacement | null;
}

/**
 * Return official finishing-position badges only when the relevant knockout
 * match is completed and the recorded winner belongs to one of its teams.
 * A final decides 1st/2nd; the third-place match decides 3rd/4th.
 */
export function getMatchPlacements(match: PublicMatch): MatchPlacements {
  const empty: MatchPlacements = { home: null, away: null };
  if (
    match.status !== 'completed' ||
    !match.winner_team_id ||
    !match.home_team_id ||
    !match.away_team_id ||
    match.home_team_id === match.away_team_id
  ) return empty;

  if (match.stage !== 'final' && match.stage !== 'third_place') return empty;

  const winnerIsHome = match.winner_team_id === match.home_team_id;
  const winnerIsAway = match.winner_team_id === match.away_team_id;
  if (!winnerIsHome && !winnerIsAway) return empty;

  if (match.stage === 'final') {
    return winnerIsHome
      ? { home: 'winner', away: 'second' }
      : { home: 'second', away: 'winner' };
  }

  return winnerIsHome
    ? { home: 'third', away: 'fourth' }
    : { home: 'fourth', away: 'third' };
}
