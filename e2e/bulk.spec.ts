import { expect, test } from '@playwright/test'
import { mockApi, signIn } from './mockApi.ts'

const ENTRY = {
  id: '77777777-7777-4777-8777-777777777799',
  seq: 20261031,
  rev: 1,
  kind: 'expense',
  category: 'عمالة',
  item: 'أجرة نجار',
  amount: 6200,
  entry_date: '2026-11-18',
  created_at: '2026-11-18T09:00:00Z',
  notes: null,
  advance_id: null,
  status: 'approved',
  invoices: [{ count: 0 }],
  contractor: null,
  bank: { name: 'CIB' },
  creator: { full_name: 'محمود' },
  project_id: '22222222-2222-4222-8222-222222222221',
  project: { name: 'فيلا النرجس' },
}

const answer = (path: string) => (path.endsWith('/entries') ? [ENTRY] : undefined)

test('the admin picks a photo for an entry and uploads it', async ({ page }) => {
  const sent = await mockApi(page, { answer })
  await page.route('**/storage/v1/object/**', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ Key: 'invoices/x.png' }) }),
  )
  await signIn(page)
  await page.goto('/#/bulk-invoices')
  await page.getByLabel('المشروع', { exact: true }).selectOption({ index: 1 })
  await expect(page.getByText('أجرة نجار')).toBeVisible()

  const png = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
    'base64',
  )
  await page
    .getByLabel('اختيار فواتير القيد 20261031')
    .setInputFiles({ name: 'inv.png', mimeType: 'image/png', buffer: png })
  await expect(page.getByText('اخترت 1 قيد')).toBeVisible()
  await page.getByRole('button', { name: /ارفع الكل/ }).click()
  await expect.poll(() => sent.some((r) => r.path.endsWith('/entry_attachments'))).toBe(true)
  expect(sent.find((r) => r.path.endsWith('/entry_attachments'))?.body).toMatchObject({ entry_id: ENTRY.id })
})

test('an ordinary user does not get the page', async ({ page }) => {
  await mockApi(page, { user: [{ module: 'projects', level: 'edit' }] })
  await signIn(page)
  await page.goto('/#/bulk-invoices')
  await expect(page.getByText('الصفحة مش موجودة')).toBeVisible()
  await expect(page.getByRole('link', { name: 'رفع فواتير بالجملة' })).toHaveCount(0)
})
