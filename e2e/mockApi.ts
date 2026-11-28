import type { Page, Route } from '@playwright/test'

const ADMIN = { id: '11111111-1111-4111-8111-111111111111', email: 'admin@test.local' }

const ADMIN_PROFILE = {
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

const CATEGORIES = [
  {
    id: '44444444-4444-4444-8444-444444444441',
    name: 'عمالة',
    expense_items: [{ id: '55555555-5555-4555-8555-555555555551', name: 'نجارة' }],
  },
]

export const PENDING_SEQ = 101

const pendingEntry = {
  id: '66666666-6666-4666-8666-666666666661',
  project_id: P1,
  seq: PENDING_SEQ,
  rev: 1,
  kind: 'expense',
  category: 'عمالة',
  item: 'نجارة',
  amount: 2500,
  entry_date: '2026-11-17',
  notes: null,
  advance_id: null,
  status: 'pending',
  created_at: '2026-11-17T10:00:00Z',
  reject_reason: null,
  edit_reason: null,
  invoices: [{ count: 1 }],
  project: { name: 'فرش الحج مبروك' },
  contractor: null,
  bank: { name: 'CIB' },
  creator: { full_name: 'أحمد' },
}

export type Sent = { method: string; path: string; body: unknown }

type Options = {
  /** who is signed in: the admin (default), or an ordinary user with these page permissions */
  user?: { module: string; level: 'view' | 'edit' }[]
  /** the signed in staff member is an owner, not the admin */
  owner?: boolean
  /** extra answers for reads: return a value to answer, or undefined to leave it to the defaults */
  answer?: (path: string, search: string) => unknown
  /** other accounts shown in the users list */
  others?: Record<string, unknown>[]
}

// database functions that only read: they are not "writes" a test needs to see
const READ_RPCS = new Set([
  'project_summaries',
  'dashboard_summary',
  'bank_summaries',
  'advance_summaries',
  'bank_movements',
  'deleted_entries',
  'project_deleted_entries',
  'entry_history_of',
])

export const APPROVED_ENTRY = {
  id: '77777777-7777-4777-8777-777777777771',
  seq: 55,
  rev: 3,
  kind: 'expense',
  category: 'عمالة',
  item: 'نجارة',
  amount: 1000,
  entry_date: '2026-11-10',
  created_at: '2026-11-10T09:00:00Z',
  notes: null,
  advance_id: null,
  status: 'approved',
  invoices: [{ count: 1 }],
  contractor: null,
  bank: { name: 'CIB' },
  creator: { full_name: 'محمود' },
}

export const DELETED_ENTRY = {
  id: '88888888-8888-4888-8888-888888888881',
  seq: 56,
  rev: 2,
  kind: 'expense',
  category: 'عمالة',
  item: 'سباكة',
  amount: 300,
  entry_date: '2026-11-09',
  notes: null,
  status_before_delete: 'approved',
  deleted_at: '2026-11-11T09:00:00Z',
  delete_reason: 'غلط',
  project: 'فرش الحج مبروك',
  contractor: null,
  deleted_by_name: 'محمود',
  created_by_name: 'محمود',
}

const json = (route: Route, data: unknown, status = 200) =>
  route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(data) })

/** Fakes the whole database API. Returns every write the app sent so a test can check it. */
export async function mockApi(page: Page, options: Options = {}): Promise<Sent[]> {
  const sent: Sent[] = []
  const PROFILE = options.owner
    ? { ...ADMIN_PROFILE, role: 'owner' }
    : options.user
      ? { ...ADMIN_PROFILE, role: 'user' }
      : ADMIN_PROFILE
  await page.route('https://mock.supabase.co/**', async (route) => {
    const req = route.request()
    const url = new URL(req.url())
    const path = url.pathname
    const method = req.method()
    const single = (req.headers()['accept'] ?? '').includes('vnd.pgrst.object')
    if (path.startsWith('/auth/v1/token')) return json(route, SESSION)
    if (path.startsWith('/auth/v1/user')) return json(route, SESSION.user)
    if (path.startsWith('/auth/v1/')) return json(route, {})
    if (path.endsWith('/profiles') && method === 'GET') {
      // the signed-in user's own record is one row; the users page asks for all of them
      if (url.search.includes('id=eq.')) return json(route, single ? PROFILE : [PROFILE])
      return json(route, [PROFILE, ...(options.others ?? [])])
    }
    if (path.endsWith('/user_permissions')) return json(route, options.user ?? [])
    const custom = options.answer?.(path, url.search)
    if (custom !== undefined) return json(route, custom)
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
    if (path.startsWith('/functions/v1/')) {
      let body: unknown = null
      try {
        body = req.postDataJSON()
      } catch {
        /* no body */
      }
      sent.push({ method, path, body })
      return json(route, { id: '99999999-9999-4999-8999-999999999991', ok: true })
    }
    if (path.includes('/rpc/')) {
      const name = path.split('/rpc/')[1]
      if (!READ_RPCS.has(name)) {
        let body: unknown = null
        try {
          body = req.postDataJSON()
        } catch {
          /* no body */
        }
        sent.push({ method, path, body })
        return json(route, [{ ok: true }])
      }
      return json(route, [])
    }
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
    if (path.endsWith('/expense_categories')) return json(route, CATEGORIES)
    if (path.endsWith('/entries') && url.search.includes('status=eq.pending')) return json(route, [pendingEntry])
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
  await page.getByRole('button', { name: 'تسجيل الخروج' }).waitFor()
}
