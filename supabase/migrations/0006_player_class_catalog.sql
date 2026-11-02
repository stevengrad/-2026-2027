-- The public form and Edge Functions already validate this list. Enforcing it
-- in PostgreSQL makes the rule impossible to bypass through a direct request.
alter table players
  add constraint players_class_name_catalog check (
    class_name_ar in (
      'يوحنا المعمدان',
      'صموئيل النبي',
      'يونان النبي',
      'هوشع النبي',
      'أشعياء النبي',
      'داود النبي',
      'يشع النبي',
      'إيليا النبي',
      'أرميا النبي',
      'موسى النبي',
      'حزقيال النبي',
      'دانيال النبي'
    )
  );
