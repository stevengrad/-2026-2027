-- Replace the old "يشوع النبي" saint catalog entry with the organiser-supplied
-- "اليشع النبي" portrait. The existing row is renamed in place so its UUID and
-- any teams already referencing it remain unchanged.
update saints
set name_ar = 'اليشع النبي',
    alt_spellings = array['اليشع النبي', 'إليشع النبي', 'اليشع']::text[],
    letter = 'ا',
    portrait_path = 'assets/saints/elisha.webp',
    image_rights = 'user_owned'::image_rights,
    image_rights_notes = 'أيقونة أصلية مقدمة من منظم البطولة.',
    is_approved = true,
    is_active = true,
    sort_order = 7
where name_ar = 'يشوع النبي'
  and not exists (select 1 from saints where name_ar = 'اليشع النبي');

-- If an Elisha row already exists independently, refresh it instead of
-- creating a duplicate; keep the superseded Joshua row inactive.
update saints
set alt_spellings = array['اليشع النبي', 'إليشع النبي', 'اليشع']::text[],
    letter = 'ا',
    portrait_path = 'assets/saints/elisha.webp',
    image_rights = 'user_owned'::image_rights,
    image_rights_notes = 'أيقونة أصلية مقدمة من منظم البطولة.',
    is_approved = true,
    is_active = true,
    sort_order = 7
where name_ar = 'اليشع النبي';

update saints
set is_active = false
where name_ar = 'يشوع النبي';

-- Also support databases where the old catalog row was removed manually.
insert into saints (
  name_ar, alt_spellings, letter, portrait_path, image_rights,
  image_rights_notes, is_approved, is_active, sort_order
)
select
  'اليشع النبي',
  array['اليشع النبي', 'إليشع النبي', 'اليشع']::text[],
  'ا',
  'assets/saints/elisha.webp',
  'user_owned'::image_rights,
  'أيقونة أصلية مقدمة من منظم البطولة.',
  true,
  true,
  7
where not exists (select 1 from saints where name_ar = 'اليشع النبي');
