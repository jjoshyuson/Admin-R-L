import { describe, expect, it } from 'vitest'
import { calculateAuditVariance, calculateShiftTotals, resolveShiftWindow, validateShiftSchedule } from './shiftService'
import type { ShiftReport } from './shiftService'
import type { ShiftSchedule } from './adminTypes'

const schedule: ShiftSchedule = { firstShiftStart: '06:00', secondShiftStart: '14:00', timezone: 'UTC' }

describe('shift schedule', () => {
  it('assigns boundaries and the overnight business date', () => {
    expect(resolveShiftWindow(new Date('2026-07-18T06:00:00Z'), schedule)).toMatchObject({ shiftType: 'FIRST', businessDate: '2026-07-18' })
    expect(resolveShiftWindow(new Date('2026-07-18T14:00:00Z'), schedule)).toMatchObject({ shiftType: 'SECOND', businessDate: '2026-07-18' })
    expect(resolveShiftWindow(new Date('2026-07-19T02:00:00Z'), schedule)).toMatchObject({ shiftType: 'SECOND', businessDate: '2026-07-18' })
  })
  it('rejects equal starts', () => expect(validateShiftSchedule({ ...schedule, secondShiftStart: '06:00' })).toBeTruthy())
})

describe('shift totals', () => {
  it('deducts a cash expense without changing gross sales', () => {
    const report: ShiftReport = {
      sessions: [], adjustments: [], audit: null,
      orders: [{ deviceOrderId: 'o1', deviceId: 'd', paymentMethod: 'CASH', paymentReference: null, cashAmount: 500, gcashAmount: 0, subtotal: 500, tax: 0, total: 500, createdAt: '', items: [] }],
      payments: [{ id: 'p1', orderId: 'o1', originShiftId: 's', collectionShiftId: 's', shiftSessionId: 'x', method: 'CASH', amount: 500, collectedBy: 'Josh', collectedAt: '' }],
      expenses: [{ id: 'e1', accountId: 'tablet-1', accountType: 'TABLET_DRAWER', sourceAccountId: 'tablet-1', destinationAccountId: null, movementKind: 'PAY_OUT', reasonCategory: 'Tube ice', amount: 130, note: null, relatedBillId: null, createdBy: 'Josh', createdAtEpochMillis: 0 }],
    }
    expect(calculateShiftTotals(report)).toMatchObject({ totalSales: 500, grossCash: 500, cashExpenses: 130, netCash: 370 })
  })

  it('counts cash and GCash collected in this shift as total sales', () => {
    const report: ShiftReport = {
      sessions: [{ id: 'session-2', shiftId: '2026-07-18-second', businessDate: '2026-07-18', shiftType: 'SECOND', employeeId: 'e1', employeeName: 'Josh', deviceId: 'd', clockedInAt: '', clockedOutAt: null, status: 'OPEN', scheduleSnapshot: schedule }],
      orders: [], expenses: [], adjustments: [], audit: null,
      payments: [
        { id: 'p1', orderId: 'older-cash-order', originShiftId: '2026-07-18-first', collectionShiftId: '2026-07-18-second', shiftSessionId: 'session-2', method: 'CASH', amount: 300, collectedBy: 'Josh', collectedAt: '' },
        { id: 'p2', orderId: 'older-gcash-order', originShiftId: '2026-07-18-first', collectionShiftId: '2026-07-18-second', shiftSessionId: 'session-2', method: 'GCASH', amount: 125, collectedBy: 'Josh', collectedAt: '' },
      ],
    }
    expect(calculateShiftTotals(report)).toMatchObject({ totalSales: 425, grossCash: 300, grossGcash: 125 })
  })
})

describe('shift audit', () => {
  it('records cash and GCash over/short independently', () => {
    expect(calculateAuditVariance(370, 365, 125, 130)).toEqual({ cashVariance: -5, gcashVariance: 5 })
  })
})
