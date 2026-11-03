# Automatic knockout advancement

The `0014_automatic_knockout_advancement.sql` migration updates the `set_match_score` database function. When an administrator saves a completed knockout match, PostgreSQL now writes the winner into the corresponding next-round fixture automatically.

The mapping is based on the stored `bracket_order`:

- Match 1 winner -> next-round match 1, home slot
- Match 2 winner -> next-round match 1, away slot
- Match 3 winner -> next-round match 2, home slot
- Match 4 winner -> next-round match 2, away slot
- and so on

Semi-final winners are sent to the final. Semi-final losers are sent to the third-place fixture when one exists.

The update is transactional with the score save. If the next fixture has already started, has a result, or contains match events, the database rejects a participant change with `downstream_match_already_started` rather than silently invalidating a played match. The migration also backfills winners from already-completed knockout matches into any downstream fixtures that have not started, so existing quarter-final results are carried forward during deployment.

The public knockout view polls every five seconds so the updated participant appears without a manual refresh.

## Deploy

From the project root:

```powershell
npx supabase db push --remote
npx supabase functions deploy manage-match --yes
npm install
npm run build
```

Deploy the frontend using the project's configured hosting workflow. Redeploy `manage-match` because its status editor now routes completed knockout fixtures through `set_match_score` as well. The `generate-knockout` function does not need to be redeployed for this change.

Run the local database test suite against a disposable test database only, never production:

```powershell
# Follow the existing Supabase local test setup in the project documentation.
```
