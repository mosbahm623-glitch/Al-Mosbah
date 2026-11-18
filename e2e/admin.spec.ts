import { expect, test } from '@playwright/test'
import { mockApi, signIn } from './mockApi.ts'

const BANK_ID = 'a0000000-0000-4000-8000-000000000001'
const SARA = {
  id: 'd0000000-0000-4000-8000-000000000001',
  full_name: 'سارة',
  email: 'sara@test.local',
  role: 'user',
  is_active: true,
  can_edit_entries: true,
  can_delete_entries: true,
  can_edit_approved: false,
  project_types: ['finishing'],
}

const answers = (path: string) => {
  if (path.endsWith('/rpc/bank_summaries')) {
    return [
      {
        id: BANK_ID,
        name: 'CIB',
        logo: null,
        opening_balance: 1000,
        income: 0,
        expenses: 0,
        transfers_in: 0,
        transfers_out: 300,
      },
    ]
  }
  if (path.endsWith('/rpc/bank_movements')) {
    return [
      {
        id: 'e0000000-0000-4000-8000-000000000001',
        seq: null,
        kind: 'transfer_out',
        entry_date: '2026-11-12',
        category: 'تحويل',
        item: null,
        notes: null,
        amount: 300,
        project_id: null,
        project_name: '',
        contractor: null,
      },
    ]
  }
  return undefined
}

test('the admin creates a new user', async ({ page }) => {
  const sent = await mockApi(page, { others: [SARA] })
  await signIn(page)
  await page.goto('/#/users')
  await page.getByRole('button', { name: 'مستخدم جديد' }).click()
  const dialog = page.getByRole('dialog')
  await dialog.getByLabel('الاسم').fill('هدى')
  await dialog.getByLabel('الإيميل').fill('hoda@test.local')
  await dialog.getByLabel(/كلمة سر مؤقتة/).fill('temp12345')
  await dialog.getByRole('button', { name: 'إنشاء' }).click()
  await expect.poll(() => sent.some((r) => r.path.endsWith('/functions/v1/create-user'))).toBe(true)
  expect(sent.find((r) => r.path.endsWith('/functions/v1/create-user'))?.body).toEqual({
    full_name: 'هدى',
    email: 'hoda@test.local',
    password: 'temp12345',
  })
})

test('the admin turns off a user account', async ({ page }) => {
  const sent = await mockApi(page, { others: [SARA] })
  await signIn(page)
  await page.goto('/#/users')
  await page.getByRole('button', { name: 'صلاحيات سارة' }).click()
  const dialog = page.getByRole('dialog')
  await dialog.getByLabel('الحساب مفعّل').uncheck()
  await dialog.getByRole('button', { name: 'حفظ', exact: true }).click()
  await expect
    .poll(() =>
      sent.some(
        (r) => r.method === 'PATCH' && r.path.endsWith('/profiles') && JSON.stringify(r.body).includes('is_active'),
      ),
    )
    .toBe(true)
  const patch = sent.find((r) => r.method === 'PATCH' && JSON.stringify(r.body).includes('is_active'))
  expect(patch?.body).toEqual({ role: 'user', is_active: false })
})

test('the admin removes a wrong bank transfer', async ({ page }) => {
  const sent = await mockApi(page, { answer: answers })
  page.on('dialog', (d) => void d.accept())
  await signIn(page)
  await page.goto(`/#/banks/${BANK_ID}`)
  await page.getByRole('button', { name: 'مسح التحويل' }).click()
  await expect.poll(() => sent.some((r) => r.method === 'DELETE' && r.path.endsWith('/bank_transfers'))).toBe(true)
})
