import { describe, expect, it } from 'vitest'
import { createLiveRefresh } from './liveRefresh'
describe('live reconciliation', () => {
  it('serializes updates and refreshes again when changes arrive during a fetch', async () => {
    const finish: (() => void)[] = []
    let starts = 0
    const refresh = createLiveRefresh(() => { starts++; return new Promise<void>(resolve => finish.push(resolve)) })
    const first = refresh.request()
    void refresh.request()
    void refresh.request()
    expect(starts).toBe(1)
    finish.shift()!()
    await Promise.resolve()
    expect(starts).toBe(2)
    finish.shift()!()
    await first
    expect(starts).toBe(2)
  })
  it('does not start queued work after the view is disposed', async () => {
    let finish!: () => void
    let starts = 0
    const refresh = createLiveRefresh(() => { starts++; return new Promise<void>(resolve => { finish = resolve }) })
    const work = refresh.request()
    void refresh.request()
    refresh.dispose()
    finish()
    await work
    await refresh.request()
    expect(starts).toBe(1)
  })
})
