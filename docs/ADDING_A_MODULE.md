# إضافة صفحة / موديول جديد

المثال هنا موديول افتراضي اسمه **الموردين** (`suppliers`). نفس الخطوات اتعملت مع **البنوك**، وتقدر تفتح `supabase/migrations/20261027_012_banks.sql` و`src/pages/banks` كمرجع حقيقي.

> الترتيب مهم: قاعدة البيانات الأول (لأنها اللي بتحمي فعلاً)، بعدين `lib`، بعدين الواجهة.

## 1) قاعدة البيانات: migration جديدة

اسم الملف: `supabase/migrations/YYYYMMDD_NNN_suppliers.sql` (الرقم بعد آخر migration).

```sql
-- 1) اسمح بالموديول الجديد في الصلاحيات (نفس طريقة migration 012)
alter table public.user_permissions drop constraint user_permissions_module_check;
alter table public.user_permissions add constraint user_permissions_module_check
  check (module in ('dashboard','projects','advances','banks','contractors','reports','tools','suppliers'));

-- 2) الجدول + RLS
create table public.suppliers (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  created_at timestamptz not null default now()
);
alter table public.suppliers enable row level security;

create policy suppliers_read  on public.suppliers for select using ((select private.can_view('suppliers')));
create policy suppliers_write on public.suppliers for all
  using ((select private.can_edit('suppliers'))) with check ((select private.can_edit('suppliers')));
```

- كل جدول **لازم** يتفعّل عليه RLS، وإلا أي مستخدم مسجّل يقدر يقراه.
- لو فيه حسابات (أرصدة، إجماليات) اعملها **دالة** في قاعدة البيانات (`security definer` + `set search_path = ''` + `revoke execute ... from public, anon`) والواجهة تناديها بـ `rpc`.
- لو الجدول بيتغيّر وعايز الصفحات المفتوحة تتحدث لوحدها: ضيفه في `supabase_realtime` (شوف migration 018) وفي قايمة `TABLES` في `src/lib/live.ts`.
- جدّد `src/lib/database.types.ts` بعد تطبيق الـ migration.
- ضيف حالات للاختبار التكاملي `supabase/tests/rls_and_totals.sql` (مين يشوف ومين يعدّل).

## 2) `src/lib`: دوال البيانات

```ts
// src/lib/suppliers.ts
import { supabase } from './supabase'

export type Supplier = { id: string; name: string }
export type SupplierInput = { name: string }

export const fetchSuppliers = () => supabase.from('suppliers').select('id,name').order('name').returns<Supplier[]>()

/** مورد جديد، أو (مع id) تعديل مورد موجود. */
export const saveSupplier = (row: SupplierInput, id?: string) =>
  id ? supabase.from('suppliers').update(row).eq('id', id) : supabase.from('suppliers').insert(row)
```

القواعد: كل كلام مع Supabase هنا، والدالة بترجّع نتيجة Supabase زي ما هي، والحسابات (جمع، نسب، ترتيب) دوال صافية في `lib` عشان تتختبر.

## 3) الصلاحية والقايمة والمسار

```ts
// src/auth/permissions.ts: ضيف في MODULES
{ id: 'suppliers', label: 'الموردين' },
```

شاشة صلاحيات المستخدم بتقرا `MODULES` فالموديول هيظهر فيها لوحده.

```ts
// src/layout/nav.ts: ضيف عنصر (واستورد الأيقونة من lucide-react)
{ path: 'suppliers', label: 'الموردين', icon: Truck, module: 'suppliers' },
```

```tsx
// src/App.tsx
const Suppliers = lazy(() => import('./pages/suppliers/Suppliers'))
// داخل Content():
if (route === 'suppliers') return <Suppliers />
```

فحص الصلاحية (`sectionItem.module` و`can(...)`) بيتعمل لوحده من عنصر القايمة، مش محتاج كود إضافي.

## 4) الصفحة

الصفحة بتستورد من `../../lib/suppliers` **مش** من `lib/supabase` (الفحص المعماري هيفشل لو عملت كده). خد `src/pages/banks/Banks.tsx` و`BankDialog.tsx` كقالب:

- القراءة: `useAsync(fetchSuppliers)` (بيتحدّث لحظياً مع `live.ts`).
- الكتابة: `await saveSupplier(row, supplier?.id)`، ورسالة الخطأ للمستخدم بتتكتب في الصفحة.
- الأزرار اللي بتعدّل تتظهر بس لو `can('suppliers', 'edit')`.

## 5) الاختبارات

- دوال الحساب: اختبار مباشر.
- دوال البيانات: استخدم `query()` من `src/lib/__tests__/supabaseMock.ts` عشان تتأكد من الجدول والفلاتر (شوف `dataLayer.test.ts`).

## 6) قبل الدمج

```
npm run quality
```

لازم يخضر. بعد الدمج: طبّق الـ migration على Supabase بالترتيب، وانشر الموقع (`gh-pages`) لما تراجع الشاشة.
