# نشر مجاني على GitHub Pages وSupabase

هذه الخطوات مطلوبة مرة واحدة من مالك المشروع. لا تُضف أي مفتاح سري إلى GitHub أو إلى ملف `.env` الخاص بالواجهة.

## 1. أنشئ مشروع Supabase

1. أنشئ مشروعاً على خطة Supabase Free وسجّل `Project URL` و`Publishable key` من **Connect**.
2. ثبّت Supabase CLI وسجّل الدخول، ثم اربط مجلد المشروع:

   ```powershell
   supabase login
   supabase link --project-ref YOUR_PROJECT_REF
   supabase db push
   ```

   أو نفّذ ملفات `supabase/migrations/0001_core.sql` حتى `0005_saint_storage.sql` بالترتيب داخل SQL Editor، ثم نفّذ `supabase/seed.sql`.

3. أنشئ حساب المشرف من **Authentication → Users → Add user**. بعد إنشائه، نفّذ هذا الاستعلام مع بريد الحساب الحقيقي:

   ```sql
   insert into public.admin_users (user_id)
   select id from auth.users where email = 'admin@example.com';
   ```

4. أنشئ موقع Cloudflare Turnstile المجاني وأضف عنوان GitHub Pages النهائي إلى allowed hostnames. احتفظ بـ Site Key وSecret Key.
5. انشر كل الدوال وأضف الأسرار للخادم فقط:

   ```powershell
   supabase functions deploy register-team
   supabase functions deploy register-player
   supabase functions deploy generate-teams
   supabase functions deploy generate-groups
   supabase functions deploy generate-knockout
   supabase functions deploy manage-match

   supabase secrets set TURNSTILE_SECRET_KEY=YOUR_TURNSTILE_SECRET
   supabase secrets set ALLOWED_ORIGINS=https://YOUR_GITHUB_NAME.github.io
   ```

   بعد معرفة اسم المستودع، أضف أيضاً عنوان المشروع الكامل إلى `ALLOWED_ORIGINS`، مفصولاً بفاصلة:

   ```text
   https://YOUR_GITHUB_NAME.github.io,https://YOUR_GITHUB_NAME.github.io/YOUR_REPOSITORY
   ```

## 2. أضف قائمة القديسين والصور المرخّصة

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
3. أضف قديساً مرخّصاً، أرسل طلب فريق تجريبي، ثم اعتمده وتحقق من ظهوره في الموقع العام.
4. احذف بيانات الاختبار من لوحة المشرف قبل فتح التسجيل الحقيقي.

> GitHub Pages يستضيف الواجهة فقط. قاعدة البيانات والمصادقة والدوال تبقى في Supabase المجاني، ولا يوجد مفتاح Service Role في الموقع أو GitHub.
