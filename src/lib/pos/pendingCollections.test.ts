import { describe, expect, it } from 'vitest'
import { mergePendingCollections, identifyCollection } from './pendingCollections'
describe('offline partial collections', () => {
  it('preserves separate 20 and 30 peso collections, including their staff shift context', () => {
    const first = { id: 'first', payment: { amount: 20 }, shiftId: 'shift-one' }
    const second = { id: 'second', payment: { amount: 30 }, shiftId: 'shift-two' }
    expect(mergePendingCollections([first], second)).toEqual([first, second])
  })
  it('does not duplicate a collection when the same operation is retried', () => {
    const payment = { method: 'cash', amount: 20 }
    const first = identifyCollection(payment, 'device-order', 20)
    const retry = identifyCollection(payment, 'device-order', 20)
    expect(retry.id).toBe(first.id)
    expect(mergePendingCollections([{ id: first.id }], { id: retry.id })).toHaveLength(1)
  })
})
