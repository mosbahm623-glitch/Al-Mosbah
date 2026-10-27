import { useEffect, useState } from 'react'
import { supabase } from './lib/supabase'

type Status = 'checking' | 'ok' | 'error'

export default function App() {
  const [status, setStatus] = useState<Status>('checking')

  useEffect(() => {
    supabase.auth
      .getSession()
      .then(({ error }) => setStatus(error ? 'error' : 'ok'))
      .catch(() => setStatus('error'))
  }, [])

  const label =
    status === 'checking' ? 'جارٍ فحص الاتصال...' : status === 'ok' ? 'متصل بقاعدة البيانات' : 'فشل الاتصال بقاعدة البيانات'

  return (
    <main className="page">
      <h1>المصباح</h1>
      <p className={`status status-${status}`}>{label}</p>
    </main>
  )
}
