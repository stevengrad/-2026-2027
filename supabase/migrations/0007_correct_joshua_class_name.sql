-- Normalize the displayed class name to the standard spelling used by the UI.
-- This replaces (rather than edits) the deployed 0006 constraint, preserving
-- Supabase migration history.
alter table players drop constraint players_class_name_catalog;

update players
set class_name_ar = 'يشوع النبي'
where class_name_ar = 'يشع النبي';

alter table players
  add constraint players_class_name_catalog check (
    class_name_ar in (
      'يوحنا المعمدان',
      'صموئيل النبي',
      'يونان النبي',
      'هوشع النبي',
      'أشعياء النبي',
      'داود النبي',
      'يشوع النبي',
      'إيليا النبي',
      'أرميا النبي',
      'موسى النبي',
      'حزقيال النبي',
      'دانيال النبي'
    )
  );
