import { expect, test } from '@playwright/test'
import { APPROVED_ENTRY, DELETED_ENTRY, mockApi, P1, signIn } from './mockApi.ts'

const BANKS = [
  {
    id: 'a0000000-0000-4000-8000-000000000001',
    name: 'CIB',
    logo: null,
    opening_balance: 1000,
    income: 5000,
    expenses: 500,
    transfers_in: 0,
    transfers_out: 0,
  },
  {
    id: 'a0000000-0000-4000-8000-000000000002',
    name: 'Al Ahly',
    logo: null,
    opening_balance: 200,
    income: 0,
    expenses: 0,
    transfers_in: 0,
    transfers_out: 0,
  },
]
const ADVANCES = [
  {
    id: 'b0000000-0000-4000-8000-000000000001',
    holder_name: 'خالد',
    status: 'open',
    notes: null,
    given: 20000,
    spent: 5000,
    returned: 0,
  },
]
const answers = (path: string, search: string) => {
  if (path.endsWith('/rpc/bank_summaries')) return BANKS
  if (path.endsWith('/rpc/advance_summaries')) return ADVANCES
  if (path.endsWith('/rpc/project_deleted_entries')) return [DELETED_ENTRY]
  if (path.endsWith('/entries') && search.includes(`project_id=eq.${P1}`)) return [APPROVED_ENTRY]
  if (path.endsWith('/contractors')) return [{ id: 'c0000000-0000-4000-8000-000000000001', name: 'المعلم سعيد' }]
  return undefined
}

test('an ordinary user does not see the admin pages and is told the entry waits for approval', async ({ page }) => {
  await mockApi(page, { user: [{ module: 'projects', level: 'edit' }] })
  await signIn(page)
  await expect(page.getByRole('link', { name: 'المستخدمين' })).toHaveCount(0)
  await expect(page.getByRole('link', { name: 'النسخة الاحتياطية' })).toHaveCount(0)
  await page.goto(`/#/projects/${P1}`)
  await page.getByRole('button', { name: 'قيد جديد' }).click()
  await expect(page.getByRole('dialog').getByText('القيد هيروح للأدمن للموافقة')).toBeVisible()
})

test('the admin edits an entry and the change goes with its reason', async ({ page }) => {
  const sent = await mockApi(page, { answer: answers })
  await signIn(page)
  await page.goto(`/#/projects/${P1}`)
  await page.getByRole('button', { name: 'تعديل القيد 55' }).click()
  const dialog = page.getByRole('dialog')
  await dialog.getByLabel('المبلغ (ج.م)').fill('1200')
  await dialog.getByPlaceholder('مثلًا: المبلغ كان مكتوب غلط').fill('المبلغ كان غلط')
  await dialog.getByRole('button', { name: 'حفظ التعديل' }).click()
  await expect.poll(() => sent.some((r) => r.path.endsWith('/rpc/edit_entry'))).toBe(true)
  const body = sent.find((r) => r.path.endsWith('/rpc/edit_entry'))?.body as Record<string, unknown>
  expect(body).toMatchObject({ p_id: APPROVED_ENTRY.id, p_rev: 3, p_reason: 'المبلغ كان غلط' })
  expect(body.p_row).toMatchObject({ amount: 1200 })
})

test('the admin deletes an entry with a reason', async ({ page }) => {
  const sent = await mockApi(page, { answer: answers })
  await signIn(page)
  await page.goto(`/#/projects/${P1}`)
  await page.getByRole('button', { name: 'تعديل القيد 55' }).click()
  const dialog = page.getByRole('dialog')
  await dialog.getByRole('button', { name: 'حذف القيد' }).click()
  await dialog.getByPlaceholder('مثلًا: القيد اتسجل بالغلط').fill('اتسجل بالغلط')
  await dialog.getByRole('button', { name: 'تأكيد حذف القيد' }).click()
  await expect.poll(() => sent.some((r) => r.path.endsWith('/rpc/delete_entry'))).toBe(true)
  expect(sent.find((r) => r.path.endsWith('/rpc/delete_entry'))?.body).toMatchObject({
    p_id: APPROVED_ENTRY.id,
    p_reason: 'اتسجل بالغلط',
  })
})

test('the admin restores a deleted entry', async ({ page }) => {
  const sent = await mockApi(page, { answer: answers })
  await signIn(page)
  await page.goto(`/#/projects/${P1}`)
  await page.getByRole('button', { name: 'استرجاع القيد 56' }).click()
  await expect.poll(() => sent.some((r) => r.path.endsWith('/rpc/restore_entry'))).toBe(true)
  expect(sent.find((r) => r.path.endsWith('/rpc/restore_entry'))?.body).toEqual({ p_id: DELETED_ENTRY.id })
})

test('the banks page lists the banks and a transfer between two banks is saved', async ({ page }) => {
  const sent = await mockApi(page, { answer: answers })
  await signIn(page)
  await page.goto('/#/banks')
  await expect(page.getByRole('link', { name: 'CIB' }).first()).toBeVisible()
  await page.getByRole('button', { name: 'تحويل بين بنكين' }).click()
  const dialog = page.getByRole('dialog')
  await dialog.getByLabel('من بنك').selectOption({ label: 'CIB' })
  await dialog.getByLabel('إلى بنك').selectOption({ label: 'Al Ahly' })
  await dialog.getByLabel('المبلغ (ج.م)').fill('300')
  await dialog.getByRole('button', { name: /حفظ/ }).click()
  await expect.poll(() => sent.some((r) => r.path.endsWith('/bank_transfers'))).toBe(true)
  const row = sent.find((r) => r.path.endsWith('/bank_transfers'))?.body as Record<string, unknown>
  expect(row).toMatchObject({ amount: 300, from_bank: BANKS[0].id, to_bank: BANKS[1].id })
})

test('the custody page lists the holders', async ({ page }) => {
  await mockApi(page, { answer: answers })
  await signIn(page)
  await page.goto('/#/advances')
  await expect(page.getByRole('link', { name: 'خالد' }).first()).toBeVisible()
})

test('the contractors page lists the contractors', async ({ page }) => {
  await mockApi(page, { answer: answers })
  await signIn(page)
  await page.goto('/#/contractors')
  await expect(page.getByRole('link', { name: 'المعلم سعيد' }).first()).toBeVisible()
})

test('the users page and the backup page open for the admin', async ({ page }) => {
  await mockApi(page, { answer: answers })
  await signIn(page)
  await page.goto('/#/users')
  await expect(page.getByRole('heading', { name: 'المستخدمين' }).first()).toBeVisible()
  await page.goto('/#/backup')
  await expect(page.getByRole('heading', { name: /النسخة الاحتياطية/ }).first()).toBeVisible()
})

test('an entry made without internet is kept on the device and not sent', async ({ page }) => {
  const sent = await mockApi(page, { answer: answers })
  await signIn(page)
  await page.goto(`/#/projects/${P1}`)
  await page.getByRole('button', { name: 'قيد جديد' }).click()
  const dialog = page.getByRole('dialog')
  await dialog.waitFor()
  await dialog.getByRole('button', { name: 'وارد', exact: true }).click()
  await dialog.getByPlaceholder('مثلاً: دفعة عميل').fill('دفعة عميل')
  await dialog.getByPlaceholder('اتودّع في أنهي بنك').fill('CIB')
  await dialog.getByLabel('المبلغ (ج.م)').fill('900')
  await page.context().setOffline(true)
  await dialog.getByRole('button', { name: /حفظ/ }).click()
  await expect(page.getByText('القيود اللي على جهازك (1)')).toBeVisible()
  expect(sent.some((r) => r.path.endsWith('/entries'))).toBe(false)
})

test('the project report exports an Excel file', async ({ page }) => {
  await mockApi(page, { answer: answers })
  await signIn(page)
  await page.goto(`/#/projects/${P1}/report`)
  const download = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Excel' }).click()
  const file = await (await download).path()
  const { readFileSync } = await import('node:fs')
  expect(readFileSync(file).subarray(0, 2).toString()).toBe('PK') // an .xlsx is a zip file
})
