import { supabase } from './supabase'
import type { Level, Module } from '../auth/permissions'

export type UserRow = {
  id: string
  full_name: string | null
  email: string | null
  role: 'admin' | 'owner' | 'user'
  is_active: boolean
  permissions: { module: Module; level: Level }[]
  /** custodies this user may see (matters only when he has the العهد page) */
  advanceIds: string[]
}

type Profile = Omit<UserRow, 'permissions' | 'advanceIds'>
export type AdvanceOption = { id: string; holder_name: string }

export const fetchAdvanceOptions = () =>
  supabase.from('advances').select('id,holder_name').order('holder_name').returns<AdvanceOption[]>()

/** Every account with its page permissions (admins only; other users cannot read this). */
export async function fetchUsers(): Promise<{ data: UserRow[] | null; error: unknown }> {
  const [profiles, perms, access] = await Promise.all([
    supabase.from('profiles').select('id,full_name,email,role,is_active').order('created_at').returns<Profile[]>(),
    supabase.from('user_permissions').select('user_id,module,level').returns<{ user_id: string; module: Module; level: Level }[]>(),
    supabase.from('user_advance_access').select('user_id,advance_id').returns<{ user_id: string; advance_id: string }[]>(),
  ])
  if (profiles.error || perms.error || access.error || !profiles.data) return { data: null, error: profiles.error ?? perms.error ?? access.error }
  const byUser = new Map<string, UserRow['permissions']>()
  for (const p of perms.data ?? []) byUser.set(p.user_id, [...(byUser.get(p.user_id) ?? []), { module: p.module, level: p.level }])
  const advByUser = new Map<string, string[]>()
  for (const a of access.data ?? []) advByUser.set(a.user_id, [...(advByUser.get(a.user_id) ?? []), a.advance_id])
  return { data: profiles.data.map((u) => ({ ...u, permissions: byUser.get(u.id) ?? [], advanceIds: advByUser.get(u.id) ?? [] })), error: null }
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
