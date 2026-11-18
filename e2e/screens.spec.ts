import { expect, test, type Page } from '@playwright/test'
import { mockApi, P1, PENDING_SEQ, signIn, type Sent } from './mockApi.ts'

test('sign in lands on the dashboard', async ({ page }) => {
  await mockApi(page)
  await signIn(page)
  await expect(page.getByText('لوحة التحكم').first()).toBeVisible()
})

test('projects list shows the projects and the search filters them', async ({ page }) => {
  await mockApi(page)
  await signIn(page)
  await page.goto('/#/projects')
  await expect(page.getByRole('link', { name: 'فرش الحج مبروك' })).toBeVisible()
  await expect(page.getByRole('link', { name: 'شقة مدينتي' })).toBeVisible()
  await page.getByPlaceholder('ابحث باسم المشروع').fill('فيلا')
  await expect(page.getByRole('link', { name: 'فيلا شامل' })).toBeVisible()
  await expect(page.getByRole('link', { name: 'شقة مدينتي' })).toHaveCount(0)
})

test('a focused search box shows one ring, not two', async ({ page }) => {
  await mockApi(page)
  await signIn(page)
  await page.goto('/#/projects')
  const input = page.getByPlaceholder('ابحث باسم المشروع')
  await input.click()
  await expect(input).toBeFocused()
  // the box around it shows the ring; the field inside must not add a second one (its shadow fades out, so wait for it)
  await expect.poll(() => input.evaluate((el) => getComputedStyle(el).boxShadow)).toBe('none')
  const inner = await input.evaluate((el) => {
    const s = getComputedStyle(el)
    return {
      border: s.borderTopWidth,
      outline: s.outlineStyle,
      box: getComputedStyle(el.parentElement as Element).outlineStyle,
    }
  })
  expect(inner).toEqual({ border: '0px', outline: 'none', box: 'solid' })
})

test('adding an income entry to a project sends it to the database', async ({ page }) => {
  const sent = await mockApi(page)
  await signIn(page)
  await page.goto(`/#/projects/${P1}`)
  await page.getByRole('button', { name: 'قيد جديد' }).click()
  const dialog = page.getByRole('dialog')
  await dialog.waitFor()
  await dialog.getByRole('button', { name: 'وارد', exact: true }).click()
  await dialog.getByPlaceholder('مثلاً: دفعة عميل').fill('دفعة عميل')
  await dialog.getByPlaceholder('اتودّع في أنهي بنك').fill('CIB')
  await dialog.getByLabel('المبلغ (ج.م)').fill('1500')
  await dialog.getByRole('button', { name: /حفظ/ }).click()
  await expect.poll(() => sent.some((r) => r.path.endsWith('/entries'))).toBe(true)
  const row = sent.find((r) => r.path.endsWith('/entries'))?.body as Record<string, unknown>
  const body = Array.isArray(row) ? row[0] : row
  expect(body).toMatchObject({ kind: 'income', amount: 1500, project_id: P1 })
})

test('the reports page opens with its report choices', async ({ page }) => {
  await mockApi(page)
  await signIn(page)
  await page.goto('/#/reports')
  await expect(page.getByRole('heading', { name: /التقارير/ }).first()).toBeVisible()
  await expect(page.getByRole('button', { name: 'عرض التقرير' })).toBeVisible()
})

async function addExpenseOrRefund(page: Page, sent: Sent[], kind: 'مصروف' | 'مرتجع') {
  await signIn(page)
  await page.goto(`/#/projects/${P1}`)
  await page.getByRole('button', { name: 'قيد جديد' }).click()
  const dialog = page.getByRole('dialog')
  await dialog.waitFor()
  await dialog.getByRole('button', { name: kind, exact: true }).click()
  await dialog.getByRole('textbox', { name: 'البند', exact: true }).fill('عمالة')
  await dialog.getByRole('option', { name: 'عمالة' }).click()
  await dialog.getByRole('textbox', { name: 'البيان', exact: true }).fill('نجارة')
  await dialog.getByRole('option', { name: 'نجارة' }).click()
  await dialog.getByPlaceholder(kind === 'مرتجع' ? 'اتودّع في أنهي بنك' : 'مدفوع من أنهي بنك').fill('CIB')
  await dialog.getByLabel('المبلغ (ج.م)').fill('700')
  await dialog.getByRole('button', { name: /حفظ/ }).click()
  await expect.poll(() => sent.some((r) => r.path.endsWith('/entries'))).toBe(true)
  const body = sent.find((r) => r.path.endsWith('/entries'))?.body
  return (Array.isArray(body) ? body[0] : body) as Record<string, unknown>
}

test('an expense entry is saved with a positive amount', async ({ page }) => {
  const sent = await mockApi(page)
  const row = await addExpenseOrRefund(page, sent, 'مصروف')
  expect(row).toMatchObject({ kind: 'expense', amount: 700, category: 'عمالة', item: 'نجارة', project_id: P1 })
})

test('a refund entry is saved as an expense with a negative amount', async ({ page }) => {
  const sent = await mockApi(page)
  const row = await addExpenseOrRefund(page, sent, 'مرتجع')
  expect(row).toMatchObject({ kind: 'expense', amount: -700, category: 'عمالة', item: 'نجارة' })
})

test('the admin approves a pending entry', async ({ page }) => {
  const sent = await mockApi(page)
  await signIn(page)
  await page.goto('/#/approvals')
  await page.getByRole('button', { name: `موافقة على القيد ${PENDING_SEQ}` }).click()
  await expect.poll(() => sent.some((r) => r.method === 'PATCH' && r.path.endsWith('/entries'))).toBe(true)
  expect(sent.find((r) => r.method === 'PATCH')?.body).toEqual({ status: 'approved' })
})

test('the admin rejects a pending entry with a reason', async ({ page }) => {
  const sent = await mockApi(page)
  await signIn(page)
  await page.goto('/#/approvals')
  await page.getByRole('button', { name: `رفض القيد ${PENDING_SEQ}` }).click()
  await page.getByLabel(`سبب رفض القيد ${PENDING_SEQ}`).fill('المبلغ غلط')
  await page.getByRole('button', { name: 'تأكيد الرفض' }).click()
  await expect.poll(() => sent.some((r) => r.method === 'PATCH' && r.path.endsWith('/entries'))).toBe(true)
  expect(sent.find((r) => r.method === 'PATCH')?.body).toEqual({ status: 'rejected', reject_reason: 'المبلغ غلط' })
})
