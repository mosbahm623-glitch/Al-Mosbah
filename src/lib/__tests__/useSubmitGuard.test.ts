import { describe, expect, it } from 'vitest'
import { createSubmitGuard } from '../core/useSubmitGuard'

describe('createSubmitGuard', () => {
  it('runs a second call only after the first one has finished', async () => {
    const run = createSubmitGuard()
    let calls = 0
    let release: () => void = () => {}
    const first = run(
      () =>
        new Promise<string>((resolve) => {
          calls++
          release = () => resolve('done')
        }),
    )
    // the double click: same instant, first one still running
    const second = run(async () => {
      calls++
      return 'again'
    })
    expect(await second).toBeUndefined()
    release()
    expect(await first).toBe('done')
    expect(calls).toBe(1)
    // after it finished, a new try is allowed
    expect(await run(async () => 'next')).toBe('next')
  })

  it('opens again after a failure', async () => {
    const run = createSubmitGuard()
    await expect(
      run(async () => {
        throw new Error('network')
      }),
    ).rejects.toThrow('network')
    expect(await run(async () => 'retry')).toBe('retry')
  })
})
