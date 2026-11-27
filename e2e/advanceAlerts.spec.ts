import { expect, test } from '@playwright/test'
import { mockApi, signIn } from './mockApi.ts'

const SETTINGS = {
  to_admin: true,
  to_holder: true,
  to_owner: true,
  advances: [
    { id: 'a1', holder_name: 'احمد عبدالله 2', balance: -4814, enabled: false, threshold: null },
    { id: 'a2', holder_name: 'ابراهيم', balance: 12500, enabled: true, threshold: 3000 },
  ],
}

test('the admin sets who hears about a low custody, and each limit', async ({ page }) => {
  await mockApi(page)
  let saved: unknown
  await page.route('**/rpc/advance_alert_settings*', (r) => r.fulfill({ json: SETTINGS }))
  await page.route('**/rpc/save_advance_alert_settings*', (r) => {
    saved = r.request().postDataJSON()
    return r.fulfill({ status: 204 })
  })
  await page.setViewportSize({ width: 390, height: 844 })
  await signIn(page)
  await page.goto('/#/advances')
  await page.getByRole('button', { name: 'إعدادات التنبيه' }).click()
  const dialog = page.getByRole('dialog')
  await dialog.getByRole('checkbox', { name: 'المالك' }).uncheck()
  await dialog.getByRole('checkbox', { name: /احمد عبدالله 2/ }).check()
  await dialog.getByLabel('حد التنبيه لعهدة احمد عبدالله 2').fill('5000')
  if (process.env.SHOT) await page.screenshot({ path: process.env.SHOT })
  await dialog.getByRole('button', { name: 'حفظ' }).click()
  await expect(dialog).toBeHidden()
  expect(saved).toEqual({
    p_admin: true,
    p_holder: true,
    p_owner: false,
    p_rows: [
      { id: 'a1', enabled: true, threshold: 5000 },
      { id: 'a2', enabled: true, threshold: 3000 },
    ],
  })
})
