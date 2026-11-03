# دوري كرة القدم لأسرة أنبياء 2026/2027

منصة بطولة عربية RTL لإدارة تسجيل الفرق، اللاعبين الأفراد، القرعة، المجموعات، الأدوار الإقصائية، المباريات والإحصاءات. الواجهة تعمل على GitHub Pages، بينما تكون قاعدة البيانات والمصادقة والدوال الآمنة في Supabase.

## ما تم تنفيذه

- موقع عام عربي متجاوب: الرئيسية، التسجيل، الفرق المعتمدة، تفاصيل الفرق، المجموعات، الأدوار الإقصائية، مباريات الأحد، الهدافون وتفاصيل المباراة.
- تسجيل فرق ولاعبين أفراد عبر Supabase Edge Functions، مع Turnstile، تحديد معدل الطلبات، وidempotency والتحقق من المهلة من الخادم.
- فرق آلية متوازنة من 4 إلى 7 لاعبين مع seed قابل للمراجعة، واعتماد/رفض وإعادة اللاعبين إلى قائمة الانتظار.
- لوحة إدارة محمية بـ Supabase Auth + `admin_users` + RLS لإدارة الفرق والقديسين والقرعة والمباريات والأحداث.
- أدوار وصلاحيات قاعدة بيانات، public views للبيانات المعتمدة فقط، سجل تدقيق، وحماية خصوصية اللاعبين والطلبات المعلقة.
- مقارنة عادلة لأصحاب المركز الثالث بين مجموعات من 3 و4 فرق باستخدام النقاط لكل مباراة، وشجرة إقصائية ثابتة تعتمد على ترتيب المجموعة والأداء، مع إظهار مسار التأهل للمباريات التالية.
- انتقال تلقائي للفائز من كل مباراة إقصائية إلى خانته الصحيحة في الدور التالي فور اعتماد النتيجة، مع انتقال خاسري نصف النهائي إلى مباراة المركز الثالث، وحماية المباريات التالية التي بدأت بالفعل من تغيير أطرافها.
- خيار إعادة ضبط مخفي داخل إعدادات الأدوار الإقصائية، محمي بصلاحية المشرف وتأكيد مزدوج، لمسح النتائج والأحداث والهدافين والمجموعات دون حذف الفرق أو اللاعبين.
- كتالوج قديسين مع فحص الحقوق، نسب المصدر، رفع صور مقيّد بالمشرفين، وإطار بديل عند غياب صورة مرخّصة.
- GitHub Actions للبناء والاختبارات والنشر، وPWA خفيفة تصلح للتثبيت في المتصفحات المدعومة على Android وiOS وmacOS وWindows.

## المتطلبات المحلية

- Node.js 20+
- حساب Supabase مجاني وCloudflare Turnstile مجاني للنشر الفعلي

```powershell
npm install
npm run typecheck
npm test
npm run build
npm run dev
```

إذا منع PowerShell تشغيل `npm.ps1`، استخدم `npm.cmd` بدلاً من `npm` في هذا الجهاز.

## الإعداد والنشر

اتبع [دليل النشر](docs/DEPLOYMENT.md) بالترتيب؛ فهو يشمل Supabase وTurnstile ورفع المستودع وGitHub Pages. راجع أيضاً [دليل الإدارة](docs/ADMIN_SETUP.md) و[تفاصيل الخطة المجانية](docs/FREE_STACK.md).

انسخ `.env.example` إلى `.env` للتشغيل المحلي فقط. هذا الملف يحتوي قيم متصفح عامة فقط؛ لا تضع Service Role key أو قاعدة كلمات المرور أو Turnstile secret فيه.

## الاختبارات

```powershell
npm run typecheck
npm test
npm run build
```

تغطي الاختبارات القرعة والمجموعات والترتيب والهدافين والأهداف العكسية والمهلة والتدفقات الأساسية، بالإضافة إلى تطبيع النقاط والترتيب الثابت لشجرة الإقصائيات. اختبارات SQL موجودة في `supabase/tests/` ويجب تشغيلها على قاعدة اختبار منفصلة، لا على مشروع الإنتاج.
## Official champion display

When the final is recorded as completed with a valid winner, the public site automatically displays a championship announcement with the winning team's saint portrait, official champion badge, final score (champion listed first), opponent name, and trophy artwork across all public pages. See [the champion display notes](docs/OFFICIAL_CHAMPION_DISPLAY.md). This is frontend-only and needs no additional Supabase migration.
