import { supabase } from './supabase'
import type { Level, Module } from '../auth/permissions'

export type UserRow = {
  id: string
  full_name: string | null
  email: string | null
  role: 'admin' | 'user'
  is_active: boolean
  permissions: { module: Module; level: Level }[]
}

type Profile = Omit<UserRow, 'permissions'>

/** Every account with its page permissions (admins only; other users cannot read this). */
export async function fetchUsers(): Promise<{ data: UserRow[] | null; error: unknown }> {
  const [profiles, perms] = await Promise.all([
    supabase.from('profiles').select('id,full_name,email,role,is_active').order('created_at').returns<Profile[]>(),
    supabase.from('user_permissions').select('user_id,module,level').returns<{ user_id: string; module: Module; level: Level }[]>(),
  ])
  if (profiles.error || perms.error || !profiles.data) return { data: null, error: profiles.error ?? perms.error }
  const byUser = new Map<string, UserRow['permissions']>()
  for (const p of perms.data ?? []) byUser.set(p.user_id, [...(byUser.get(p.user_id) ?? []), { module: p.module, level: p.level }])
  return { data: profiles.data.map((u) => ({ ...u, permissions: byUser.get(u.id) ?? [] })), error: null }
}

const CREATE_ERRORS: Record<string, string> = {
  invalid_email: 'الإيميل مش مظبوط',
  weak_password: 'كلمة السر لازم 8 حروف على الأقل',
  name_required: 'اكتب اسم المستخدم',
  email_exists: 'الإيميل ده مسجّل قبل كده',
  forbidden: 'الأدمن بس هو اللي يضيف مستخدمين',
}

/** Creates the account through the `create-user` edge function. Returns an error message, or null. */
export async function createUser(input: { full_name: string; email: string; password: string }) {
  const { data, error } = await supabase.functions.invoke<{ id?: string; error?: string }>('create-user', { body: input })
  if (!error && data?.id) return null
  let code = data?.error
  if (!code && error && 'context' in error) {
    try {
      code = ((await (error as { context: Response }).context.json()) as { error?: string }).error
    } catch {
      /* no body */
    }
  }
  return (code && CREATE_ERRORS[code]) || 'ما قدرناش ننشئ المستخدم، جرّب تاني'
}
