import type { Page, Route } from '@playwright/test'

const ADMIN = { id: '11111111-1111-4111-8111-111111111111', email: 'admin@test.local' }

const PROFILE = {
  id: ADMIN.id,
  full_name: 'محمود',
  role: 'admin',
  is_active: true,
  can_edit_entries: true,
  can_delete_entries: true,
  can_edit_approved: true,
  must_change_password: false,
}

export const P1 = '22222222-2222-4222-8222-222222222221'
const P2 = '22222222-2222-4222-8222-222222222222'
const P3 = '22222222-2222-4222-8222-222222222223'

const PROJECTS = [
  { id: P1, name: 'فرش الحج مبروك', type: 'فرش', status: 'active', budget: 0, income: 500000, expenses: 427290 },
  { id: P2, name: 'شقة مدينتي', type: 'تشطيب', status: 'active', budget: 0, income: 150000, expenses: 116213 },
  { id: P3, name: 'فيلا شامل', type: 'تشطيب', status: 'active', budget: 0, income: 660000, expenses: 666422 },
]

const SESSION = {
  access_token: 'e2e.access.token',
  token_type: 'bearer',
  expires_in: 3600,
  expires_at: Math.floor(Date.now() / 1000) + 3600,
  refresh_token: 'e2e-refresh',
  user: {
    id: ADMIN.id,
    aud: 'authenticated',
    role: 'authenticated',
    email: ADMIN.email,
    app_metadata: {},
    user_metadata: {},
  },
}

export type Sent = { method: string; path: string; body: unknown }

const json = (route: Route, data: unknown, status = 200) =>
  route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(data) })

/** Fakes the whole database API. Returns every write the app sent so a test can check it. */
export async function mockApi(page: Page): Promise<Sent[]> {
  const sent: Sent[] = []
  await page.route('https://mock.supabase.co/**', async (route) => {
    const req = route.request()
    const url = new URL(req.url())
    const path = url.pathname
    const method = req.method()
    const single = (req.headers()['accept'] ?? '').includes('vnd.pgrst.object')
    if (path.startsWith('/auth/v1/token')) return json(route, SESSION)
    if (path.startsWith('/auth/v1/user')) return json(route, SESSION.user)
    if (path.startsWith('/auth/v1/')) return json(route, {})
    if (path.endsWith('/profiles')) return json(route, single ? PROFILE : [PROFILE])
    if (path.endsWith('/backup_log') && req.method() === 'GET') return json(route, [{ at: new Date().toISOString() }])
    if (path.endsWith('/rpc/project_summaries')) return json(route, PROJECTS)
    if (path.endsWith('/rpc/dashboard_summary')) {
      return json(route, {
        total_income: 1_310_000,
        total_expenses: 1_209_925,
        total_advances: 0,
        advances_balance: 0,
        contractor_dues: 0,
        active_projects: 3,
        net_cash: 100_075,
        over_count: 0,
        budget_rows: [],
      })
    }
    if (path.includes('/rpc/')) return json(route, [])
    if (method !== 'GET' && method !== 'HEAD') {
      let body: unknown = null
      try {
        body = req.postDataJSON()
      } catch {
        /* no body */
      }
      sent.push({ method, path, body })
      // an insert answers with the new row, which always has an id
      const row = { id: '33333333-3333-4333-8333-333333333333', ...(Array.isArray(body) ? body[0] : (body as object)) }
      return json(route, single ? row : [row], method === 'POST' ? 201 : 200)
    }
    return json(route, single ? null : [])
  })
  return sent
}

/** Signs in through the real sign-in form. */
export async function signIn(page: Page) {
  await page.goto('/#/')
  await page.getByRole('textbox').first().fill(ADMIN.email)
  await page.locator('input[type="password"]').fill('password123')
  await page.getByRole('button', { name: /دخول/ }).click()
  await page.getByRole('link', { name: 'لوحة التحكم' }).first().waitFor()
}
