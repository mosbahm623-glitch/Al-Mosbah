// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'
import { shareTokenOf, shareUrl } from '../projects/shares'

const TOKEN = 'a'.repeat(64)

describe('client share link', () => {
  it('recognises a client route and returns its token', () => {
    expect(shareTokenOf(`share/${TOKEN}`)).toBe(TOKEN)
  })
  it('ignores every other route, so no page opens without signing in by accident', () => {
    expect(shareTokenOf('dashboard')).toBeNull()
    expect(shareTokenOf('projects/123')).toBeNull()
    expect(shareTokenOf('share/')).toBeNull()
    expect(shareTokenOf(`share/${TOKEN}/extra`)).toBeNull()
  })
  it('rejects a token of the wrong length or alphabet', () => {
    expect(shareTokenOf(`share/${'a'.repeat(63)}`)).toBeNull()
    expect(shareTokenOf(`share/${'g'.repeat(64)}`)).toBeNull()
    expect(shareTokenOf(`share/${'A'.repeat(64)}`)).toBeNull()
  })
  it('builds a hash-route address that the router reads back', () => {
    const url = shareUrl(TOKEN)
    expect(url.endsWith(`#/share/${TOKEN}`)).toBe(true)
    expect(shareTokenOf(url.split('#/')[1])).toBe(TOKEN)
  })
})
