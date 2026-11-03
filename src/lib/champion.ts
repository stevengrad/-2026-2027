import type { PublicMatch } from './types';
import type { PublicTeam } from '../hooks/useTournament';

export interface TournamentChampion {
  teamId: string;
  teamName: string;
  portraitPath: string | null;
  teamNumber: number | null;
  finalMatch: PublicMatch;
  wonAtHome: boolean;
}

/**
 * A champion is only official after the final itself is marked completed and
 * the database has recorded a winner that is one of the two finalists.
 * Earlier knockout winners never trigger the site-wide champion treatment.
 */
export function getTournamentChampion(
  matches: PublicMatch[],
  teams: PublicTeam[],
): TournamentChampion | null {
  const completedFinals = matches
    .filter((match) => match.stage === 'final' && match.status === 'completed' && match.winner_team_id)
    .sort((a, b) => {
      const aTime = a.scheduled_at ? new Date(a.scheduled_at).getTime() : 0;
      const bTime = b.scheduled_at ? new Date(b.scheduled_at).getTime() : 0;
      return bTime - aTime || (b.bracket_order ?? 0) - (a.bracket_order ?? 0);
    });

  const finalMatch = completedFinals[0];
  if (!finalMatch?.winner_team_id) return null;

  const wonAtHome = finalMatch.winner_team_id === finalMatch.home_team_id;
  const wonAway = finalMatch.winner_team_id === finalMatch.away_team_id;
  if (!wonAtHome && !wonAway) return null;

  const teamId = finalMatch.winner_team_id;
  const team = teams.find((candidate) => candidate.id === teamId);
  const teamName = team?.saint_name_ar ?? (wonAtHome ? finalMatch.home_saint : finalMatch.away_saint);
  if (!teamName) return null;

  return {
    teamId,
    teamName,
    portraitPath: team?.portrait_path ?? (wonAtHome ? finalMatch.home_portrait : finalMatch.away_portrait),
    teamNumber: team?.team_number ?? null,
    finalMatch,
    wonAtHome,
  };
}
