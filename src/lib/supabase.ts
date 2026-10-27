import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined

if (!url || !key) {
  throw new Error('ناقص VITE_SUPABASE_URL أو VITE_SUPABASE_PUBLISHABLE_KEY في ملف .env.local')
}

export const supabase = createClient(url, key)
