import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { registerSW } from 'virtual:pwa-register'

// a new version installs in the background and reloads the app by itself, so the installed phone app never keeps showing an old one
registerSW({ immediate: true })

// after a new version goes live, a tab opened on the old one asks for page files that no longer exist (blank page):
// clear the old cached copy and reload once so the user gets the new version without doing anything
const KEY = 'reloaded-for-new-version'
async function recover() {
  try {
    const last = Number(sessionStorage.getItem(KEY) ?? 0)
    if (Date.now() - last < 30_000) return
    sessionStorage.setItem(KEY, String(Date.now()))
  } catch {
    // storage blocked: still try once below
  }
  try {
    const regs = await navigator.serviceWorker?.getRegistrations()
    await Promise.all((regs ?? []).map((r) => r.unregister()))
    const keys = await caches?.keys()
    await Promise.all((keys ?? []).map((k) => caches.delete(k)))
  } catch {
    // reload anyway
  }
  window.location.reload()
}
window.addEventListener('vite:preloadError', (e) => {
  e.preventDefault()
  void recover()
})
window.addEventListener('unhandledrejection', (e) => {
  if (
    /dynamically imported module|Importing a module script failed|error loading dynamically/i.test(
      String(e.reason?.message ?? e.reason),
    )
  ) {
    e.preventDefault()
    void recover()
  }
})

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
