import { Component, type ReactNode } from 'react'

async function clearAndReload() {
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

// a page that fails to load shows a message and a button instead of a blank screen
export default class PageErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false }
  static getDerivedStateFromError() {
    return { failed: true }
  }
  render() {
    if (!this.state.failed) return this.props.children
    return (
      <main className="center">
        <p>الصفحة معلّقة ومش بتفتح. دوس تحديث وهتفتح.</p>
        <button className="btn" onClick={() => void clearAndReload()}>
          تحديث التطبيق
        </button>
      </main>
    )
  }
}
