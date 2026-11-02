import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'
import { notifyDataChanged } from '../lib/events'
import { allows, type Level, type Module, type Permissions } from './permissions'

export type Profile = {
  id: string
  full_name: string | null
  role: 'admin' | 'owner' | 'user'
  is_active: boolean
  can_edit_entries: boolean
  can_delete_entries: boolean
  can_edit_approved: boolean
  /** the admin set a temporary password: the user must choose his own on first login */
  must_change_password: boolean
}

type AuthState = {
  loading: boolean
  session: Session | null
  profile: Profile | null
  /** only the admin approves entries (and restores deleted ones) */
  isAdmin: boolean
  /** the owner only: has the quick entry page */
  isOwner: boolean
  /** admin or owner: full access to every page and to managing users */
  isStaff: boolean
  /** may edit his own entries (staff always can; the admin switches it per user) */
  canEditOwn: boolean
  /** may delete his own entries (staff always can; the admin switches it per user) */
  canDeleteOwn: boolean
  /** may open an entry in this status to edit or delete it (the admin switches the rights per user) */
  canTouch: (status: string) => boolean
  /** can the current user open (view) or change (edit) this page? */
  can: (module: Module, level?: Level) => boolean
  signIn: (email: string, password: string) => Promise<string | null>
  signOut: () => Promise<void>
  /** saves the user's own new password; returns an error message or null */
  setOwnPassword: (password: string) => Promise<string | null>
  refreshProfile: () => Promise<void>
}

const CACHE_KEY = 'mosbah-auth-cache'
type Cached = { uid: string; profile: Profile; permissions: Permissions }
// Only speeds up the first paint; the database rules still decide what the user may see or change.
function readCache(uid: string): Cached | null {
  try {
    const c = JSON.parse(localStorage.getItem(CACHE_KEY) ?? 'null') as Cached | null
    return c && c.uid === uid && c.profile?.is_active ? c : null
  } catch {
    return null
  }
}
function writeCache(c: Cached | null) {
  try {
    if (c) localStorage.setItem(CACHE_KEY, JSON.stringify(c))
    else localStorage.removeItem(CACHE_KEY)
  } catch {
    /* private mode: just no cache */
  }
}

const AuthContext = createContext<AuthState | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [loading, setLoading] = useState(true)
  const [session, setSession] = useState<Session | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [permissions, setPermissions] = useState<Permissions>({})

  // the user whose profile is loaded (or loading): stops the double fetch at start-up and on token refreshes
  const loadedFor = useRef<string | null>(null)
  // what was last loaded, so an identical reload does not re-render or refresh every page
  const lastSignature = useRef('')

  const loadProfile = useCallback(async (userId: string | null) => {
    loadedFor.current = userId
    if (!userId) {
      lastSignature.current = ''
      setProfile(null)
      setPermissions({})
      writeCache(null)
      return false
    }
    const [p, r] = await Promise.all([
      supabase
        .from('profiles')
        .select(
          'id, full_name, role, is_active, can_edit_entries, can_delete_entries, can_edit_approved, must_change_password',
        )
        .eq('id', userId)
        .maybeSingle(),
      supabase.from('user_permissions').select('module,level').eq('user_id', userId),
    ])
    const prof = (p.data as Profile | null) ?? null
    const perms = Object.fromEntries((r.data ?? []).map((x) => [x.module, x.level])) as Permissions
    const signature = JSON.stringify([prof, perms])
    const changed = signature !== lastSignature.current
    lastSignature.current = signature
    if (changed) {
      setProfile(prof)
      setPermissions(perms)
    }
    writeCache(prof ? { uid: userId, profile: prof, permissions: perms } : null)
    return changed
  }, [])

  useEffect(() => {
    let active = true
    supabase.auth.getSession().then(async ({ data }) => {
      if (!active) return
      setSession(data.session)
      const uid = data.session?.user.id ?? null
      const cached = uid ? readCache(uid) : null
      if (cached) {
        // show the app at once from the last known profile; the fresh one replaces it a moment later
        lastSignature.current = JSON.stringify([cached.profile, cached.permissions])
        setProfile(cached.profile)
        setPermissions(cached.permissions)
        setLoading(false)
        void loadProfile(uid)
        return
      }
      await loadProfile(uid)
      if (active) setLoading(false)
    })
    const { data: sub } = supabase.auth.onAuthStateChange((_event, next) => {
      setSession(next)
      // start-up is handled by getSession above
      if (_event === 'INITIAL_SESSION') return
      const uid = next?.user.id ?? null
      if (uid === loadedFor.current) return
      // Defer the query: supabase-js must not be called inside this callback.
      setTimeout(() => void loadProfile(uid), 0)
    })
    return () => {
      active = false
      sub.subscription.unsubscribe()
    }
  }, [loadProfile])

  // Permission, role or active-state changes made by the admin reach this user at once (no re-login or refresh needed)
  const uid = session?.user.id ?? null
  useEffect(() => {
    if (!uid) return
    let timer: number | undefined
    const reload = () => {
      window.clearTimeout(timer)
      timer = window.setTimeout(() => {
        // the data he may see can change too (e.g. custody access), so a real change refreshes every page
        void loadProfile(uid).then((changed) => changed && notifyDataChanged())
      }, 250)
    }
    const mine = (payload: { new: Record<string, unknown>; old: Record<string, unknown> }, key: string) => {
      const row = (payload.new?.[key] ? payload.new : payload.old) as Record<string, unknown>
      // a delete only carries the primary key, so when the owner is unknown we reload to be safe
      return !row?.[key] || row[key] === uid
    }
    const channel = supabase
      .channel(`auth-live-${uid}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'profiles' }, (e) => {
        if (mine(e, 'id')) reload()
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'user_permissions' }, (e) => {
        if (mine(e, 'user_id')) reload()
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'user_advance_access' }, (e) => {
        if (mine(e, 'user_id')) reload()
      })
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') reload() // catch up on anything missed while offline
      })
    const onVisible = () => {
      if (document.visibilityState === 'visible') reload()
    }
    document.addEventListener('visibilitychange', onVisible)
    window.addEventListener('online', reload)
    return () => {
      window.clearTimeout(timer)
      document.removeEventListener('visibilitychange', onVisible)
      window.removeEventListener('online', reload)
      void supabase.removeChannel(channel)
    }
  }, [uid, loadProfile])

  const value = useMemo<AuthState>(
    () => ({
      loading,
      session,
      profile,
      isAdmin: profile?.role === 'admin',
      isOwner: profile?.role === 'owner',
      isStaff: profile?.role === 'admin' || profile?.role === 'owner',
      canEditOwn: profile?.role === 'admin' || profile?.role === 'owner' || profile?.can_edit_entries !== false,
      canDeleteOwn: profile?.role === 'admin' || profile?.role === 'owner' || profile?.can_delete_entries !== false,
      canTouch: (status) => {
        if (profile?.role === 'admin' || profile?.role === 'owner') return true
        const edit = profile?.can_edit_entries !== false
        const del = profile?.can_delete_entries !== false
        return status === 'approved' ? edit && profile?.can_edit_approved === true : edit || del
      },
      can: (module, level = 'view') =>
        allows(profile?.role === 'admin' || profile?.role === 'owner', permissions, module, level),
      signIn: async (email, password) => {
        const { error } = await supabase.auth.signInWithPassword({ email, password })
        return error ? translateAuthError(error.message) : null
      },
      signOut: async () => {
        await supabase.auth.signOut()
      },
      setOwnPassword: async (password) => {
        const { error } = await supabase.auth.updateUser({ password })
        if (error) return translateAuthError(error.message)
        const done = await supabase.rpc('password_changed')
        if (done.error) return 'حصلت مشكلة، جرّب تاني'
        await loadProfile(session?.user.id ?? null)
        return null
      },
      refreshProfile: async () => void (await loadProfile(session?.user.id ?? null)),
    }),
    [loading, session, profile, permissions, loadProfile],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider')
  return ctx
}

function translateAuthError(message: string): string {
  const m = message.toLowerCase()
  if (m.includes('email address') && m.includes('invalid'))
    return 'الإيميل ده مش مقبول، استخدم إيميل حقيقي بيستقبل رسائل (Gmail مثلاً)'
  if (m.includes('invalid login')) return 'الإيميل أو كلمة السر غلط'
  if (m.includes('email not confirmed')) return 'لازم تأكد الإيميل الأول من الرسالة اللي وصلتك'
  if (m.includes('already registered')) return 'الإيميل ده مسجّل قبل كده'
  if (m.includes('password')) return 'كلمة السر ضعيفة، لازم 6 حروف على الأقل'
  if (m.includes('rate limit')) return 'محاولات كتير، استنى شوية وجرّب تاني'
  return 'حصلت مشكلة، جرّب تاني'
}
