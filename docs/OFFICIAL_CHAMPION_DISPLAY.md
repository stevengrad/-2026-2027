# Official champion announcement

The public website now displays the champion announcement from the shared public `Layout`, so it appears on every public route. The homepage gets the expanded feature treatment; other public pages get the compact version.

The announcement is intentionally gated by the final result:

- The match must have `stage = 'final'`.
- Its status must be `completed`.
- `winner_team_id` must match either the home or away finalist.
- Until those conditions are met, no champion banner is rendered.

The banner uses the existing approved saint portrait and public team record, shows the final score with the champion listed first, identifies the runner-up, and includes the penalty score when the title was decided by penalties. Match data is already polled every five seconds by `usePublicMatches`, so the banner appears automatically after the final result is saved.

This is a frontend-only change. No new Supabase migration or Edge Function deployment is required. Rebuild and redeploy the frontend to publish it.

## Pinned champion ribbon

After the full champion announcement scrolls out of view, the public site displays a compact fixed ribbon beneath the main navigation on every public page. It keeps the saint portrait, champion team name, official-champion label, final score, and trophy visible while the visitor scrolls. The ribbon hides while the mobile navigation drawer is open and disappears when the full announcement comes back into view. This is a frontend-only behavior and does not require a database migration or Edge Function deployment.
