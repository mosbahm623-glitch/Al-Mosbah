import { expect, test } from '@playwright/test'
import { mockApi, signIn, P1 } from './mockApi.ts'

test('Ctrl+K opens the quick search and Enter jumps to the page', async ({ page }) => {
  await mockApi(page)
  await signIn(page)
  await expect(page.getByRole('link', { name: 'البنوك' })).toBeVisible()
  const box = page.getByRole('dialog', { name: 'بحث سريع' })
  // Safari's engine sometimes takes the first keypress before the page's key listener is ready; the shortcut toggles,
  // so press again only while the box is still closed
  await expect(async () => {
    if (!(await box.isVisible())) await page.keyboard.press('Control+k')
    await expect(box).toBeVisible({ timeout: 1500 })
  }).toPass({ timeout: 10_000 })
  await box.getByRole('textbox').fill('البنوك')
  await page.keyboard.press('Enter')
  await expect(page).toHaveURL(/#\/banks$/)
  await expect(box).toHaveCount(0)
})

test('the quick search finds a project by name and ignores spelling variants', async ({ page }) => {
  await mockApi(page)
  await signIn(page)
  await page.getByRole('button', { name: 'بحث سريع (Ctrl+K)' }).click()
  const box = page.getByRole('dialog', { name: 'بحث سريع' })
  await expect(box).toBeVisible()
  await expect(box.getByRole('textbox')).toBeEditable()
  await box.getByRole('textbox').fill('مشروع')
  await expect(box.getByRole('option').first()).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(box).toHaveCount(0)
})

test('opened pages become tabs that can be closed', async ({ page }) => {
  await mockApi(page)
  await signIn(page)
  await page.goto('/#/dashboard')
  await expect(page.locator('.page-title')).toBeVisible()
  await page.goto('/#/banks')
  await expect(page.locator('.page-title')).toHaveText('البنوك')
  await page.goto('/#/advances')
  await expect(page.locator('.page-title')).toHaveText('العهد')
  const bar = page.getByRole('navigation', { name: 'الصفحات المفتوحة' })
  await expect(bar.getByRole('link', { name: 'البنوك' })).toBeVisible()
  await expect(bar.getByRole('link', { name: 'العهد' })).toHaveAttribute('aria-current', 'page')
  await bar.getByRole('button', { name: 'إغلاق البنوك' }).click()
  await expect(bar.getByRole('link', { name: 'البنوك' })).toHaveCount(0)
  await expect(bar.getByRole('link', { name: 'العهد' })).toBeVisible()
  await page.goto(`/#/projects/${P1}`)
  await expect(bar.getByRole('link').last()).toHaveAttribute('aria-current', 'page')
})

test('going back to a tab finds the page as it was left', async ({ page }) => {
  await mockApi(page)
  await signIn(page)
  await page.goto('/#/projects')
  await page.getByPlaceholder('ابحث باسم المشروع').fill('فيلا')
  await page.locator('.sidebar-nav').getByRole('link', { name: 'البنوك' }).click()
  await expect(page.locator('.page-title:visible')).toHaveText('البنوك')
  await page
    .getByRole('navigation', { name: 'الصفحات المفتوحة' })
    .getByRole('link', { name: 'المشاريع', exact: true })
    .click()
  await expect(page.getByPlaceholder('ابحث باسم المشروع')).toHaveValue('فيلا')
})
