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
    expect(sent.find((r) => r.method === 'POST' && r.path.endsWith('/entries'))?.body).toMatchObject({
      amount: 5000,
      item: 'نجارة',
    })
  })
}

test('a report asked for by voice opens ready on the reports page', async ({ page }) => {
  const bank = { id: '99999999-9999-4999-8999-999999999991', name: 'CIB' }
  const answer = (path: string) => {
    if (path.endsWith('/bank_accounts')) return [bank]
    if (path.endsWith('/rpc/bank_summaries')) return [{ ...bank, opening_balance: 0, balance: 0 }]
    return undefined
  }
  await mockApi(page, { answer })
  await page.route('**/functions/v1/voice-entry', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      headers: { 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({ token: 'auth_tokens/x', model: 'live-model', demo: false }),
    }),
  )
  await page.routeWebSocket(/generativelanguage/, (socket) => {
    socket.onMessage((raw) => {
      if (!String(raw).includes('"setup"')) return
      socket.send(JSON.stringify({ setupComplete: {} }))
      const args = { kind: 'bank', name: 'CIB', from: '2026-11-01' }
      socket.send(JSON.stringify({ toolCall: { functionCalls: [{ id: '1', name: 'open_report', args }] } }))
    })
  })
  await signIn(page)
  await page.goto('/#/voice-entry')
  await page.getByRole('button', { name: /مكالمة لحظية/ }).click()
  await page.getByRole('button', { name: /افتح كشف حساب بنك: CIB/ }).click()
  const form = page.getByRole('region', { name: 'خيارات التقرير' })
  await expect(form.getByLabel('نوع التقرير')).toHaveValue('bank')
  await expect(form.getByLabel('من تاريخ')).toHaveValue('2026-11-01')
  // the statement is drawn without pressing "عرض التقرير"
  await expect(page.locator('.reports-preview').getByText('CIB').first()).toBeVisible()
  await page.screenshot({ path: 'test-results/voice-report.png', fullPage: true })
})
