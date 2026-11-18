// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest'
import { isOnline, setReachable } from '../net/connection'

afterEach(() => setReachable(true))

describe('connection state', () => {
  it('a failed request marks the app offline', () => {
    setReachable(false)
    expect(isOnline()).toBe(false)
  })

  it('goes back to online when the browser announces the network is back', () => {
    // without this the sync loop stays blocked: nothing is sent, so nothing proves the server is reachable again
    setReachable(false)
    window.dispatchEvent(new Event('online'))
    expect(isOnline()).toBe(true)
  })
})
