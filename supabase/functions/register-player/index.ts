import { individualSchema, publicEndpoint } from '../_shared/http.ts';

// A replayed idempotency key returns null from the DB; the visitor still sees success.
Deno.serve(publicEndpoint(individualSchema, 'player', 60, (db, i, tournamentId) =>
  db.rpc('register_individual_tx', { p_tournament: tournamentId, p_name: i.name, p_class: i.class, p_key: i.idempotencyKey })));
