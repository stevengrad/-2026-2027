# نشر مجاني على GitHub Pages وSupabase

هذه الخطوات مطلوبة مرة واحدة من مالك المشروع. لا تُضف أي مفتاح سري إلى GitHub أو إلى ملف `.env` الخاص بالواجهة.

## 1. أنشئ مشروع Supabase

1. أنشئ مشروعاً على خطة Supabase Free وسجّل `Project URL` و`Publishable key` من **Connect**.
2. ثبّت المشروع محلياً مرة واحدة عبر `npm install`؛ فهو يحتوي الآن على Supabase CLI. سجّل الدخول، ثم اربط مجلد المشروع:

   ```powershell
   npx supabase login
   npx supabase projects list
   npx supabase link --project-ref YOUR_PROJECT_REF
   npx supabase db push --dry-run --remote
   npx supabase db push --include-seed --remote
   ```

   أو نفّذ **كل** ملفات `supabase/migrations/0001_*.sql` حتى `0015_*.sql` بالترتيب داخل SQL Editor، ثم نفّذ `supabase/seed.sql`. لا تتوقف عند `0005`؛ فالهجرات اللاحقة تضيف صلاحيات الإدارة والمباريات وشجرة الإقصائيات ومقارنة المجموعات ذات الأحجام المختلفة وأداة إعادة الضبط، وتحدّث اختيار القديس إلى **اليشع النبي** مع أيقونته الجديدة.

3. أنشئ حساب المشرف من **Authentication → Users → Add user**. بعد إنشائه، نفّذ هذا الاستعلام مع بريد الحساب الحقيقي:

   ```sql
   insert into public.admin_users (user_id)
   select id from auth.users where email = 'admin@example.com';
   ```

4. أنشئ موقع Cloudflare Turnstile المجاني وأضف عنوان GitHub Pages النهائي إلى allowed hostnames. احتفظ بـ Site Key وSecret Key.
5. انشر كل الدوال وأضف الأسرار للخادم فقط:

   ```powershell
   npx supabase functions deploy register-team --yes
   npx supabase functions deploy register-player --yes
   npx supabase functions deploy generate-teams --yes
   npx supabase functions deploy generate-groups --yes
   npx supabase functions deploy generate-knockout --yes
   npx supabase functions deploy manage-match --yes

   npx supabase secrets set TURNSTILE_SECRET_KEY=YOUR_TURNSTILE_SECRET --yes
   npx supabase secrets set ALLOWED_ORIGINS=https://YOUR_GITHUB_NAME.github.io --yes
   ```

   مهم: استخدم origin فقط، ولا تضف اسم المستودع إلى `ALLOWED_ORIGINS`. المتصفح يرسل `https://YOUR_GITHUB_NAME.github.io` كـ Origin حتى عندما يكون الموقع داخل مسار مستودع.

## 2. أضف قائمة القديسين والصور المرخّصة

أيقونة **اليشع النبي** مضمّنة داخل ملفات الموقع، وتُفعّلها الهجرة `0015_elisha_prophet_saint.sql` تلقائياً؛ لا تحتاج إلى رفعها يدوياً إلى Storage.

1. ادخل إلى لوحة المشرف في `/#/YOUR_PRIVATE_ADMIN_PATH/login` بعد النشر.
2. أضف كل قديس وأدخل المصدر والحقوق والاعتماد. لا تنشر صورة بحقوق `unknown`.
3. من شاشة **إدارة القديسين** ارفع JPEG أو PNG أو WebP بحجم أقصى 5 MB، ثم وافق على السجل والصورة عند تحقق الحقوق.

## 3. أنشئ مستودع GitHub وارفع المشروع

أنشئ مستودعاً فارغاً على GitHub، ثم نفّذ داخل هذا المجلد. استبدل القيم بين الأقواس ولا تنفّذ `git init` مرة أخرى إذا كان المجلد أصبح مستودعاً بالفعل.

```powershell
git init
git branch -M main
git add .
git commit -m "Initial tournament platform"
git remote add origin https://github.com/YOUR_GITHUB_NAME/YOUR_REPOSITORY.git
git push -u origin main
```

## 4. أضف إعدادات GitHub الآمنة

في المستودع افتح **Settings → Secrets and variables → Actions → Variables** وأضف هذه المتغيرات (وليست Secrets لأنها قيم آمنة للمتصفح):

| Variable | القيمة |
| --- | --- |
| `VITE_SUPABASE_URL` | Project URL من Supabase |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Publishable key من Supabase |
| `VITE_TURNSTILE_SITE_KEY` | Site Key من Cloudflare |
| `VITE_ADMIN_ROUTE_SEGMENT` | مسار خاص يصعب تخمينه، مثل `control-9k2p` |

ثم افتح **Settings → Pages** واختر **Source: GitHub Actions**. سيشغّل ملف `.github/workflows/deploy.yml` الفحص والاختبارات والبناء ثم ينشر الموقع عند كل push إلى `main`.

عنوان الموقع سيكون:

```text
https://YOUR_GITHUB_NAME.github.io/YOUR_REPOSITORY/
```

## 5. فحص ما بعد النشر

1. افتح الموقع على هاتف وعلى حاسوب وتأكد من عمل التسجيل بعد إكمال Turnstile.
2. افتح رابط الإدارة الخاص وسجّل بالحساب المصرّح به فقط.
3. بعد تطبيق جميع الهجرات، افتح **الأدوار الإقصائية** وتأكد من ظهور إعدادات إعادة الضبط المطوية أسفل الصفحة. هذا الإجراء يمسح بيانات المباريات والمجموعات فقط، ويحتفظ بالفرق واللاعبين.
4. أضف قديساً مرخّصاً، أرسل طلب فريق تجريبي، ثم اعتمده وتحقق من ظهوره في الموقع العام.
5. احذف بيانات الاختبار من لوحة المشرف قبل فتح التسجيل الحقيقي.

> GitHub Pages يستضيف الواجهة فقط. قاعدة البيانات والمصادقة والدوال تبقى في Supabase المجاني، ولا يوجد مفتاح Service Role في الموقع أو GitHub.
