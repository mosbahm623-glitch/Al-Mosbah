import { expect, test } from '@playwright/test'

// Public values (they are in the published site itself): the site address, the database address and its public key.
const SITE = process.env.LIVE_SITE ?? 'https://mosbahm623-glitch.github.io/Al-Mosbah/'
const API = process.env.LIVE_API ?? 'https://kytaxbhajnmdstyiorus.supabase.co'
const KEY = process.env.LIVE_KEY ?? 'sb_publishable_Er_ibOL4aGGNBKCicok17Q_MhCGB7TV'
const headers = { apikey: KEY, Authorization: `Bearer ${KEY}` }

test('the published site answers (the deploy can take a few minutes to appear)', async ({ request }) => {
  await expect.poll(async () => (await request.get(SITE)).status(), { timeout: 200_000, intervals: [5_000] }).toBe(200)
})

test('the database is reachable', async ({ request }) => {
  const res = await request.get(`${API}/auth/v1/settings`, { headers: { apikey: KEY } })
  expect(res.status()).toBe(200)
})

test('a visitor who is not signed in gets no entries', async ({ request }) => {
  const res = await request.get(`${API}/rest/v1/entries?select=id&limit=5`, { headers })
  const body = await res.json().catch(() => null)
  // either refused outright, or an empty list: never rows
  expect([200, 401, 403]).toContain(res.status())
  if (res.status() === 200) expect(body).toEqual([])
})

test('a visitor who is not signed in cannot read the dashboard figures', async ({ request }) => {
  const res = await request.post(`${API}/rest/v1/rpc/dashboard_summary`, { headers, data: {} })
  const text = await res.text()
  expect(text).not.toContain('net_cash')
})

test('a visitor who is not signed in cannot add a project', async ({ request }) => {
  const res = await request.post(`${API}/rest/v1/projects`, {
    headers: { ...headers, Prefer: 'return=minimal' },
    data: { name: '__smoke_should_never_exist', budget: 1 },
  })
  expect(res.ok()).toBe(false)
})

test('the site opens on the sign-in page without errors', async ({ page }) => {
  const errors: string[] = []
  page.on('pageerror', (e) => errors.push(e.message))
  await page.goto(SITE)
  await expect(page.locator('input[type="password"]')).toBeVisible({ timeout: 30_000 })
  expect(errors).toEqual([])
})
