import { describe, expect, it } from 'vitest'
import { clearBacklogPending, partitionBacklogForReset } from './offlineBacklog'
describe('offline backlog recovery', () => {
  it('clears only the synchronized device order, not another order at the same table', () => {
    const entries = ['device-order-one', 'device-order-two'].map(id => ({ id, order: { id: 'Table 1', deviceOrderId: id }, orderPending: true, paymentPending: true, queuedAt: '2026-10-13T02:00:00Z' }))
    expect(clearBacklogPending(entries, 'device-order-one', 'order').map(entry => entry.orderPending)).toEqual([false, true])
  })
  it('quarantines entries from before a reset, including malformed timestamps', () => {
    const entries = ['2026-10-12T00:00:00Z', '2026-10-13T02:00:00Z', 'invalid'].map((queuedAt, index) => ({ id: String(index), queuedAt }))
    const result = partitionBacklogForReset(entries, '2026-10-13T01:00:00Z')
    expect(result.active.map(entry => entry.id)).toEqual(['1'])
    expect(result.quarantined.map(entry => entry.id)).toEqual(['0', '2'])
  })
})
