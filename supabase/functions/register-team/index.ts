import { publicEndpoint, teamSchema } from '../_shared/http.ts';

Deno.serve(publicEndpoint(teamSchema, 'team', 40, (db, i, tournamentId) =>
  db.rpc('register_team_tx', { p_tournament: tournamentId, p_saint: i.saintId, p_players: i.players, p_key: i.idempotencyKey })));
