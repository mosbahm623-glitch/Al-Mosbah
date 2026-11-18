// @vitest-environment jsdom
import { act, useCallback } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { DATA_CHANGED } from '../core/events'
import { useAsync } from '../core/useAsync'

;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

let host: HTMLDivElement
let root: Root
beforeEach(() => {
  host = document.createElement('div')
  document.body.append(host)
  root = createRoot(host)
})
afterEach(() => {
  act(() => root.unmount())
  host.remove()
})

function Probe({ load }: { load: () => Promise<{ data: string | null; error: unknown }> }) {
  const fn = useCallback(() => load(), [load])
  const { data, failed, loading } = useAsync(fn)
  return <p>{loading ? 'loading' : failed ? 'failed' : data}</p>
}
const text = () => host.textContent

describe('useAsync', () => {
  it('shows loading, then the data', async () => {
    const load = vi.fn().mockResolvedValue({ data: 'hello', error: null })
    await act(async () => root.render(<Probe load={load} />))
    expect(text()).toBe('hello')
    expect(load).toHaveBeenCalledTimes(1)
  })

  it('reports a failure instead of showing stale data', async () => {
    const load = vi.fn().mockResolvedValue({ data: null, error: new Error('x') })
    await act(async () => root.render(<Probe load={load} />))
    expect(text()).toBe('failed')
  })

  it('refreshes quietly (no loading state) when data changed somewhere else', async () => {
    const load = vi
      .fn()
      .mockResolvedValueOnce({ data: 'one', error: null })
      .mockResolvedValueOnce({ data: 'two', error: null })
    await act(async () => root.render(<Probe load={load} />))
    expect(text()).toBe('one')
    await act(async () => {
      window.dispatchEvent(new Event(DATA_CHANGED))
    })
    expect(load).toHaveBeenCalledTimes(2)
    expect(text()).toBe('two')
  })

  it('stops listening after it is removed', async () => {
    const load = vi.fn().mockResolvedValue({ data: 'one', error: null })
    await act(async () => root.render(<Probe load={load} />))
    act(() => root.unmount())
    window.dispatchEvent(new Event(DATA_CHANGED))
    expect(load).toHaveBeenCalledTimes(1)
    root = createRoot(host)
  })
})
