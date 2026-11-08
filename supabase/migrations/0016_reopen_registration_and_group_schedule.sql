-- 0016: (1) reopen team registration until Friday 13 Nov 2026 00:00 (Africa/Cairo) and let admins change the deadline
--           from the admin panel; (2) apply an automatic group-stage schedule in one atomic step.

-- ---------- 1. registration deadline ----------
-- Extend the original deadline (7 Nov 2026 23:59). Only ever moves the deadline LATER than what is stored.
update tournaments set registration_deadline = timestamptz '2026-11-13 00:00:00+02'
where registration_deadline < timestamptz '2026-11-13 00:00:00+02';

create or replace function set_registration_deadline(p_deadline timestamptz) returns timestamptz
language plpgsql security definer set search_path = public as $$
declare old_deadline timestamptz;
begin
  if not is_admin() then raise exception 'forbidden'; end if;
  if p_deadline is null then raise exception 'invalid_deadline'; end if;
  select registration_deadline into old_deadline from tournaments limit 1;
  update tournaments set registration_deadline = p_deadline where true;
  insert into audit_logs (admin_user_id, action, entity_type, entity_id, old_data, new_data)
  values (auth.uid(), 'set_registration_deadline', 'tournaments', 'registration_deadline',
    jsonb_build_object('registration_deadline', old_deadline), jsonb_build_object('registration_deadline', p_deadline));
  return p_deadline;
end $$;
revoke all on function set_registration_deadline(timestamptz) from public, anon;
grant execute on function set_registration_deadline(timestamptz) to authenticated;

-- ---------- 2. group schedule ----------
-- p_items: [{"id": "<match uuid>", "at": "<ISO instant>"}, ...]. Only group matches that are not finished can be (re)scheduled.
create or replace function apply_group_schedule(p_items jsonb) returns int
language plpgsql security definer set search_path = public as $$
declare n int;
begin
  if not is_admin() then raise exception 'forbidden'; end if;
  if jsonb_typeof(p_items) is distinct from 'array' or jsonb_array_length(p_items) = 0 then raise exception 'invalid_schedule'; end if;
  update matches m set scheduled_at = (x->>'at')::timestamptz
  from jsonb_array_elements(p_items) x
  where m.id = (x->>'id')::uuid and m.stage = 'group' and m.status in ('scheduled', 'postponed');
  get diagnostics n = row_count;
  insert into audit_logs (admin_user_id, action, entity_type, entity_id, new_data)
  values (auth.uid(), 'apply_group_schedule', 'matches', 'group', jsonb_build_object('matches_scheduled', n));
  return n;
end $$;
revoke all on function apply_group_schedule(jsonb) from public, anon;
grant execute on function apply_group_schedule(jsonb) to authenticated;
