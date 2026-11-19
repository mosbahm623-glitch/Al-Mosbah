import { expect, test } from '@playwright/test'
import { mockApi, signIn } from './mockApi.ts'

const ADV = 'b0000000-0000-4000-8000-000000000001'
const CONTRACTOR = 'c0000000-0000-4000-8000-000000000001'
const BANK = { id: 'a0000000-0000-4000-8000-000000000001', name: 'CIB', logo: null }

const answers = (path: string) => {
  if (path.endsWith('/rpc/advance_summaries')) {
    return [{ id: ADV, holder_name: 'خالد', status: 'open', notes: null, given: 20000, spent: 5000, returned: 0 }]
  }
  if (path.endsWith('/bank_accounts')) return [BANK]
  if (path.endsWith('/contractors')) return [{ id: CONTRACTOR, name: 'المعلم سعيد' }]
  return undefined
}

test('a new custody is created for an engineer', async ({ page }) => {
  const sent = await mockApi(page, { answer: answers })
  await signIn(page)
  await page.goto('/#/advances')
  await page.getByRole('button', { name: 'عهدة جديدة' }).click()
  const dialog = page.getByRole('dialog')
  await dialog.getByLabel('اسم المستلم (المهندس)').fill('م. كريم')
  await dialog.getByRole('button', { name: /حفظ/ }).click()
  await expect.poll(() => sent.some((r) => r.path.endsWith('/advances'))).toBe(true)
  expect(sent.find((r) => r.path.endsWith('/advances'))?.body).toMatchObject({ holder_name: 'م. كريم' })
})

test('a payment is added to a custody from a chosen bank', async ({ page }) => {
  const sent = await mockApi(page, { answer: answers })
  await signIn(page)
  await page.goto(`/#/advances/${ADV}`)
  await page.getByRole('button', { name: /الدفعات/ }).click()
  await page.getByRole('button', { name: 'دفعة جديدة' }).click()
  const dialog = page.getByRole('dialog')
  await dialog.getByLabel('المبلغ (ج.م)').fill('4000')
  await dialog.getByPlaceholder('اختار البنك').click()
  await dialog.getByRole('listbox').getByText('CIB').click()
  await dialog.getByRole('button', { name: /حفظ/ }).click()
  await expect.poll(() => sent.some((r) => r.path.endsWith('/advance_installments'))).toBe(true)
  expect(sent.find((r) => r.path.endsWith('/advance_installments'))?.body).toMatchObject({
    advance_id: ADV,
    amount: 4000,
    bank_id: BANK.id,
  })
})

test('a custody return is recorded', async ({ page }) => {
  const sent = await mockApi(page, { answer: answers })
  await signIn(page)
  await page.goto(`/#/advances/${ADV}`)
  await page.getByRole('button', { name: /المرتجعات/ }).click()
  await page.getByRole('button', { name: 'رد عهدة' }).click()
  const dialog = page.getByRole('dialog')
  await dialog.getByLabel('المبلغ (ج.م)').fill('1500')
  await dialog.getByRole('button', { name: /حفظ/ }).click()
  await expect.poll(() => sent.some((r) => r.path.endsWith('/advance_returns'))).toBe(true)
  expect(sent.find((r) => r.path.endsWith('/advance_returns'))?.body).toMatchObject({ advance_id: ADV, amount: 1500 })
})

test('a contractor payment is recorded', async ({ page }) => {
  const sent = await mockApi(page, { answer: answers })
  await signIn(page)
  await page.goto(`/#/contractors/${CONTRACTOR}`)
  await page.getByRole('button', { name: 'تسجيل دفعة' }).click()
  const dialog = page.getByRole('dialog')
  await dialog.getByLabel('المبلغ (ج.م)').fill('2500')
  await dialog.getByRole('button', { name: /حفظ/ }).click()
  await expect.poll(() => sent.some((r) => r.path.endsWith('/contractor_transactions'))).toBe(true)
  expect(sent.find((r) => r.path.endsWith('/contractor_transactions'))?.body).toMatchObject({
    contractor_id: CONTRACTOR,
    kind: 'payment',
    amount: 2500,
  })
})

test('a contractor due is recorded', async ({ page }) => {
  const sent = await mockApi(page, { answer: answers })
  await signIn(page)
  await page.goto(`/#/contractors/${CONTRACTOR}`)
  await page.getByRole('button', { name: 'مستحق جديد' }).click()
  const dialog = page.getByRole('dialog')
  await dialog.getByLabel('المبلغ (ج.م)').fill('8000')
  await dialog.getByRole('button', { name: /حفظ/ }).click()
  await expect.poll(() => sent.some((r) => r.path.endsWith('/contractor_transactions'))).toBe(true)
  expect(sent.find((r) => r.path.endsWith('/contractor_transactions'))?.body).toMatchObject({
    kind: 'due',
    amount: 8000,
  })
})

test('an entry saved offline is sent by itself when the internet is back', async ({ page }) => {
  const sent = await mockApi(page, { answer: answers })
  await signIn(page)
  await page.goto('/#/projects/22222222-2222-4222-8222-222222222221')
  await page.getByRole('button', { name: 'قيد جديد' }).click()
  const dialog = page.getByRole('dialog')
  await dialog.waitFor()
  await dialog.getByRole('button', { name: 'وارد', exact: true }).click()
  await dialog.getByPlaceholder('مثلاً: دفعة عميل').fill('دفعة عميل')
  await dialog.getByPlaceholder('اتودّع في أنهي بنك').click()
  await dialog.getByRole('option', { name: 'CIB' }).click()
  await dialog.getByLabel('المبلغ (ج.م)').fill('950')
  await page.context().setOffline(true)
  await dialog.getByRole('button', { name: /حفظ/ }).click()
  await expect(page.getByText('القيود اللي على جهازك (1)')).toBeVisible()
  expect(sent.some((r) => r.path.endsWith('/entries'))).toBe(false)
  await page.context().setOffline(false)
  // not every browser announces the return of the network at once: send the event the browser would
  await page.evaluate(() => window.dispatchEvent(new Event('online')))
  await expect.poll(() => sent.some((r) => r.path.endsWith('/entries')), { timeout: 20_000 }).toBe(true)
  const body = sent.find((r) => r.path.endsWith('/entries'))?.body
  expect((Array.isArray(body) ? body[0] : body) as object).toMatchObject({ kind: 'income', amount: 950 })
})

test('the users page lists the users', async ({ page }) => {
  await mockApi(page, { answer: answers })
  await signIn(page)
  await page.goto('/#/users')
  await expect(page.getByText('محمود').first()).toBeVisible()
})

test.describe('on a phone', () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true })

  test('projects show as cards and the menu opens', async ({ page }) => {
    await mockApi(page, { answer: answers })
    await signIn(page)
    await page.goto('/#/projects')
    await expect(page.locator('.proj-card').first()).toBeVisible()
    await expect(page.locator('.proj-table')).toBeHidden()
    await page
      .getByRole('button', { name: /القائمة/ })
      .first()
      .click()
    await expect(page.getByRole('link', { name: 'العهد' }).first()).toBeVisible()
  })
})
