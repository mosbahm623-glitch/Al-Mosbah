import { expect, test } from '@playwright/test'
import { mockApi, signIn } from './mockApi.ts'

// a fake microphone only exists in Chromium; the page logic is the same everywhere
test.use({
  launchOptions: { args: ['--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream'] },
  permissions: ['microphone'],
})
test.skip(({ browserName }) => browserName !== 'chromium', 'needs a fake microphone')

const HEARD = {
  type: 'expense',
  project: 'فرش الحج مبروك',
  category: 'عمالة',
  item: 'نجارة',
  bank: 'CIB',
  amount: 5000,
  date: '2026-11-28',
}

for (const demo of [false, true]) {
  test(
    demo ? 'trial mode shows what was heard and offers no save' : 'a spoken entry is reviewed then saved',
    async ({ page }) => {
      const answer = (path: string) =>
        path.endsWith('/bank_accounts') ? [{ id: '99999999-9999-4999-8999-999999999991', name: 'CIB' }] : undefined
      const sent = await mockApi(page, { answer })
      await page.route('**/functions/v1/voice-entry', (route) =>
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          headers: { 'Access-Control-Allow-Origin': '*' },
          body: JSON.stringify({ demo, reply: 'فهمت قيد واحد', drafts: [HEARD] }),
        }),
      )
      await signIn(page)
      await page.goto('/#/voice-entry')
      await page.getByRole('button', { name: 'سجّل' }).click()
      await page.waitForTimeout(1200)
      await page.getByRole('button', { name: /إيقاف/ }).click()
      await expect(page.getByText('فهمت قيد واحد')).toBeVisible()
      expect(sent.some((r) => r.method === 'POST' && r.path.endsWith('/entries'))).toBe(false)
      if (demo) {
        await expect(page.getByText(/وضع تجربة/)).toBeVisible()
        await expect(page.getByRole('button', { name: /حفظ/ })).toHaveCount(0)
        return
      }
      await page.screenshot({ path: 'test-results/voice.png', fullPage: true })
      await page.getByRole('button', { name: /حفظ/ }).click()
      await expect.poll(() => sent.some((r) => r.method === 'POST' && r.path.endsWith('/entries'))).toBe(true)
      expect(sent.find((r) => r.method === 'POST' && r.path.endsWith('/entries'))?.body).toMatchObject({
        amount: 5000,
        item: 'نجارة',
      })
    },
  )
}

for (const demo of [false, true]) {
  test(`a live call fills the cards (${demo ? 'trial' : 'real'})`, async ({ page }) => {
    const answer = (path: string) =>
      path.endsWith('/bank_accounts') ? [{ id: '99999999-9999-4999-8999-999999999991', name: 'CIB' }] : undefined
    const sent = await mockApi(page, { answer })
    await page.route('**/functions/v1/voice-entry', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        headers: { 'Access-Control-Allow-Origin': '*' },
        body: JSON.stringify({ token: 'auth_tokens/x', model: 'live-model', demo }),
      }),
    )
    const received: string[] = []
    await page.routeWebSocket(/generativelanguage/, (socket) => {
      socket.onMessage((raw) => {
        const text = String(raw)
        received.push(text)
        if (text.includes('"setup"')) socket.send(JSON.stringify({ setupComplete: {} }))
        if (text.includes('realtimeInput') && !received.some((m) => m.includes('asked'))) {
          received.push('asked')
          socket.send(
            JSON.stringify({
              toolCall: {
                functionCalls: [{ id: '1', name: 'set_drafts', args: { reply: 'قيد واحد', drafts: [HEARD] } }],
              },
            }),
          )
        }
      })
    })
    await signIn(page)
    await page.goto('/#/voice-entry')
    await page.getByRole('button', { name: /مكالمة لحظية/ }).click()
    await expect(page.getByText('قيد واحد', { exact: true })).toBeVisible()
    await expect.poll(() => received.some((m) => m.includes('toolResponse'))).toBe(true)
    await page.getByRole('button', { name: 'إنهاء المكالمة' }).click()
    await expect(page.getByRole('button', { name: /مكالمة لحظية/ })).toBeVisible()
    const saved = () => sent.some((r) => r.method === 'POST' && r.path.endsWith('/entries'))
    expect(saved()).toBe(false)
    if (demo) return expect(page.getByRole('button', { name: /حفظ/ })).toHaveCount(0)
    await page.getByRole('button', { name: /حفظ/ }).click()
    await expect.poll(saved).toBe(true)
  })
}
