import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'
import { allows, type Level, type Module, type Permissions } from './permissions'

export type Profile = {
  id: string
  full_name: string | null
  role: 'admin' | 'user'
  is_active: boolean
}

type AuthState = {
  loading: boolean
  session: Session | null
  profile: Profile | null
  /** can the current user open (view) or change (edit) this page? */
  can: (module: Module, level?: Level) => boolean
  signIn: (email: string, password: string) => Promise<string | null>
  signOut: () => Promise<void>
  refreshProfile: () => Promise<void>
}

const AuthContext = createContext<AuthState | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [loading, setLoading] = useState(true)
  const [session, setSession] = useState<Session | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [permissions, setPermissions] = useState<Permissions>({})

  const loadProfile = useCallback(async (userId: string | null) => {
    if (!userId) {
      setProfile(null)
      setPermissions({})
      return
    }
    const { data } = await supabase
      .from('profiles')
      .select('id, full_name, role, is_active')
      .eq('id', userId)
      .maybeSingle()
    setProfile((data as Profile | null) ?? null)
    const { data: rows } = await supabase.from('user_permissions').select('module,level').eq('user_id', userId)
    setPermissions(Object.fromEntries((rows ?? []).map((r) => [r.module, r.level])) as Permissions)
  }, [])

  useEffect(() => {
    let active = true
    supabase.auth.getSession().then(async ({ data }) => {
      if (!active) return
      setSession(data.session)
      await loadProfile(data.session?.user.id ?? null)
      if (active) setLoading(false)
    })
    const { data: sub } = supabase.auth.onAuthStateChange((_event, next) => {
      setSession(next)
      // Defer the query: supabase-js must not be called inside this callback.
      setTimeout(() => void loadProfile(next?.user.id ?? null), 0)
    })
    return () => {
      active = false
      sub.subscription.unsubscribe()
    }
  }, [loadProfile])

  const value = useMemo<AuthState>(
    () => ({
      loading,
      session,
      profile,
      can: (module, level = 'view') => allows(profile?.role === 'admin', permissions, module, level),
      signIn: async (email, password) => {
        const { error } = await supabase.auth.signInWithPassword({ email, password })
        return error ? translateAuthError(error.message) : null
      },
      signOut: async () => {
        await supabase.auth.signOut()
      },
      refreshProfile: async () => loadProfile(session?.user.id ?? null),
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
  if (m.includes('email address') && m.includes('invalid')) return 'الإيميل ده مش مقبول، استخدم إيميل حقيقي بيستقبل رسائل (Gmail مثلاً)'
  if (m.includes('invalid login')) return 'الإيميل أو كلمة السر غلط'
  if (m.includes('email not confirmed')) return 'لازم تأكد الإيميل الأول من الرسالة اللي وصلتك'
  if (m.includes('already registered')) return 'الإيميل ده مسجّل قبل كده'
  if (m.includes('password')) return 'كلمة السر ضعيفة، لازم 6 حروف على الأقل'
  if (m.includes('rate limit')) return 'محاولات كتير، استنى شوية وجرّب تاني'
  return 'حصلت مشكلة، جرّب تاني'
}
