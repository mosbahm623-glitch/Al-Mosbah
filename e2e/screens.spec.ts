import { expect, test } from '@playwright/test'
import { mockApi, P1, signIn } from './mockApi.ts'

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
