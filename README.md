# المصباح (Al Mosbah)

تطبيق محاسبة مشاريع التشطيب والفرش. React + Vite + TypeScript + Supabase، ويشتغل على الموبايل كـ PWA.

## تشغيل محلي

```
cp .env.example .env.local   # VITE_SUPABASE_URL و VITE_SUPABASE_PUBLISHABLE_KEY
npm install
npm run dev
```

أوامر: `npm test` (اختبارات الحساب والتنسيق) · `npm run build` (فحص الأنواع + بناء) · `npm run lint` · `npm run preview`.

## هيكل الكود

```
src/
  App.tsx             بوابة الدخول + مسارات الصفحات
  auth/               تسجيل الدخول والـ profile والصلاحيات
  layout/             الهيدر والسايد بار والثيم والمسارات (hash routing)
  components/         مكونات عامة (Dialog, Segmented, Progress, CreatableSelect)
  lib/                supabase، تنسيق الأرقام، useAsync، بيانات المشاريع، تصدير Excel
  pages/              لوحة التحكم + pages/projects (القايمة، التفاصيل، القيود، التقرير)
supabase/migrations/  مخطط قاعدة البيانات بالترتيب (RLS + دوال الحساب)
```

- كل الأرقام بتتحسب في قاعدة البيانات (`dashboard_summary` و`project_summaries`)، والواجهة بتعرضها بس.
- الكتابة للأدمن بس (RLS)، والقراءة للمستخدمين المفعّلين.
- التقرير بيتطبع من المتصفح (A4)، والإكسل بيتبني في المتصفح وبيتحمّل وقت الاستخدام بس.

## النشر

GitHub Pages من فرع `gh-pages` (مخرجات `dist`). الـ migrations بتتطبّق على مشروع Supabase بالترتيب.
