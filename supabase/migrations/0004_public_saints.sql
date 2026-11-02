-- Saints that can still be chosen by a new team (pending/approved teams hold their saint). No team data is exposed.
create view public_available_saints as
select s.id, s.name_ar, s.letter, s.description_ar, s.portrait_path
from saints s
where s.is_approved and s.is_active
  and not exists (select 1 from teams t where t.saint_id = s.id and t.status in ('pending','approved'));
grant select on public_available_saints to anon, authenticated;
