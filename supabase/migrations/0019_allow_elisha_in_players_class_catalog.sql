-- 0019: Update players_class_name_catalog constraint to accept 'اليشع النبي'
-- (the canonical 7th prophet class) alongside existing records.

alter table players drop constraint if exists players_class_name_catalog;

update players
set class_name_ar = 'اليشع النبي'
where class_name_ar in ('يشع النبي', 'يشوع النبي');

alter table players
  add constraint players_class_name_catalog check (
    class_name_ar in (
      'يوحنا المعمدان',
      'صموئيل النبي',
      'يونان النبي',
      'هوشع النبي',
      'أشعياء النبي',
      'داود النبي',
      'اليشع النبي',
      'يشوع النبي',
      'إيليا النبي',
      'أرميا النبي',
      'موسى النبي',
      'حزقيال النبي',
      'دانيال النبي'
    )
  );
