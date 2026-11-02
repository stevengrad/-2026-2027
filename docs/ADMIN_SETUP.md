# إعداد الإدارة والتشغيل

## حماية رابط الإدارة

المتغير `VITE_ADMIN_ROUTE_SEGMENT` يغيّر رابط الإدارة، مثال: إذا كانت قيمته `control-9k2p` يصبح الرابط `/#/control-9k2p/login`.

هذا المسار ليس حمايةً بحد ذاته. الحماية الفعلية هي حساب Supabase Auth المسجّل في `public.admin_users`، وسياسات RLS، والتحقق داخل الدوال وقواعد البيانات. لا يوجد تسجيل عام للمشرفين ولا كلمة مرور افتراضية.

## التسلسل التشغيلي المقترح

1. أضف القديسين المرخّصين ووافق عليهم قبل فتح التسجيل.
2. راجع طلبات الفرق واعتمدها أو ارفضها. عند رفض فريق مولّد تلقائياً، اختر إعادة لاعبيه إلى قائمة الانتظار عند الحاجة.
3. بعد تجمع 4 لاعبين أفراد على الأقل، استخدم **توليد الفرق**: عاين القرعة أولاً، ثم نفّذها. يسجّل النظام seed للقرعة في سجل التدقيق.
4. اعتمد الفرق، ثم أنشئ المجموعات والقرعة. لا تعِد إنشاء المجموعات بعد تسجيل نتائج فيها.
5. أنشئ أدوار خروج المغلوب، وأدخل المواعيد والنتائج والأهداف والبطاقات من **إدارة المباريات**.
6. راقب الموقع العام؛ الترتيب والهدافون ومباريات الأحد تُحسب من البيانات المعتمدة فقط.

## قواعد مهمة للصور

- لا تستخدم صور St-Takla أو Pinterest تلقائياً لمجرد أنها مرجع بصري؛ تحقق من الأصل والترخيص لكل صورة.
- احتفظ بالرابط والمصدر واسم المصمم والاعتماد وملاحظة الحق في شاشة القديس.
- الصورة ذات الحقوق غير المعروفة لا يمكن اعتمادها كصورة منشورة.
- لا تحذف قديساً مرتبطاً بسجل تاريخي؛ عطّله بدلاً من ذلك.

## Editing and deleting teams (before and after acceptance)

Two admin tabs manage teams:

| Tab | Teams shown | Actions |
|---|---|---|
| اعتماد الفرق | new requests (قيد الانتظار) and rejected | accept, reject, **edit**, **delete** |
| الفرق المقبولة | accepted teams (visible to the public) | **edit**, **delete** |

* **Edit** changes the saint and the roster (4–7 players, name + class, add/remove). Works at every stage, even after groups and fixtures exist. A player who already has a goal or card recorded cannot be removed (rename them instead). Removing an individually registered player sends them back to the waiting pool.
* **Delete** removes the team and frees its saint. Individually registered players return to the waiting pool; team-registration players are deleted.
  * If the team is already in a group, a second confirmation is required: its unplayed group fixtures are deleted too, and you should redraw the groups afterwards.
  * A team with finished matches, or one inside a knockout bracket, cannot be deleted (regenerate the bracket first).
* Every edit and delete is written to `audit_logs`.

Requires migration `0012_edit_delete_accepted_teams.sql` (run it in the Supabase SQL editor after 0011).
