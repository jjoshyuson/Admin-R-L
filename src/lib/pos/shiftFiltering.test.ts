import { describe, expect, it } from 'vitest'
import { paymentBelongsToActiveShift } from './shiftFiltering'

const secondShift = {
  id: 'session-second',
  shiftId: '2026-07-22-second',
  clockedInAt: '2026-07-22T06:00:00.000Z',
  clockedOutAt: null,
}

describe('paymentBelongsToActiveShift', () => {
  it('rejects a different explicit shift even when its timestamp overlaps the active session', () => {
    expect(paymentBelongsToActiveShift({
      shiftId: '2026-07-22-first',
      shiftSessionId: 'session-first',
      createdAt: '2026-07-22T07:00:00.000Z',
    }, secondShift, Date.parse('2026-07-22T08:00:00.000Z'))).toBe(false)
  })

  it('accepts records explicitly assigned to the active shift', () => {
    expect(paymentBelongsToActiveShift({
      shiftId: '2026-07-22-second',
      shiftSessionId: 'another-session-in-second-shift',
      createdAt: '2026-07-22T05:00:00.000Z',
    }, secondShift)).toBe(true)
  })

  it('uses time only for legacy records without shift metadata', () => {
    expect(paymentBelongsToActiveShift({
      createdAt: '2026-07-22T07:00:00.000Z',
    }, secondShift, Date.parse('2026-07-22T08:00:00.000Z'))).toBe(true)
  })
})
