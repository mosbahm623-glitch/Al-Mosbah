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
  App.tsx             بوابة الدخول + عرض الصفحة المطابقة للمسار
  auth/               تسجيل الدخول والـ profile، والصلاحيات (permissions.ts) وقواعد الوصول (access.ts)
  layout/             الهيدر والسايد بار والثيم، nav.ts (القايمة + مين يشوف إيه)، routes.ts (جدول الصفحات)
  components/         مكونات عامة (Dialog, DataGrid, TableReport, EntryDialog ...)
  lib/                كل التعامل مع Supabase (استعلامات وحفظ)، الحسابات، تصدير Excel، useAsync
  pages/              الصفحات، كل مجلد لقسم (projects, advances, banks, contractors, approvals, reports, users)
supabase/migrations/  مخطط قاعدة البيانات بالترتيب (RLS + دوال الحساب)
supabase/tests/       اختبار SQL للصلاحيات والإجماليات (بيتشغّل يدويًا على قاعدة تجريبية)
```

قواعد الكود:

- **الواجهة ما بتكلمش Supabase مباشرة.** كل استعلام أو حفظ في `src/lib/*` (الصفحات والمكونات بتنادي دوال زي `saveBank` و`fetchContractorLedger`). الاستثناء الوحيد `AuthProvider` لأنه بيتعامل مع جلسة الدخول نفسها.
- **صفحة جديدة** = سطر في `layout/routes.ts`، وعنصر في `layout/nav.ts` لو هي قسم جديد (هو اللي بيحدد مين يشوفها).
- **الفلوس** بتتجمع وتتطرح بالقروش من `lib/money.ts` (`addMoney` و`subMoney` و`sumMoney`) وما تتجمعش بـ `+` العادية.
- **الأنواع** `lib/database.types.ts` لازم تطابق الـ migrations، وتتحدّث بعد كل migration.
- الأرقام الكبيرة (إجماليات اللوحة وملخصات المشاريع والعهد والبنوك) بتتحسب في قاعدة البيانات (`dashboard_summary` و`project_summaries` و`advance_summaries` و`bank_summaries`) والواجهة بتعرضها. أما التقارير والكشوف فبتتجمّع في المتصفح من القيود نفسها بنفس دقة القروش.
- الصلاحيات: الكتابة والقراءة بتتحكم فيهم RLS حسب الدور (أدمن / مالك / مستخدم) والصلاحية لكل صفحة (مشاهدة / تعديل).
- التقرير بيتطبع من المتصفح (A4)، والإكسل بيتبني في المتصفح وبيتحمّل وقت الاستخدام بس.

## الفحص

`npm run lint` · `npm test` · `npm run build` — وبيتشغلوا تلقائي على كل push و pull request (`.github/workflows/ci.yml`).

## النشر

GitHub Pages من فرع `gh-pages` (مخرجات `dist`). الـ migrations بتتطبّق على مشروع Supabase بالترتيب.
