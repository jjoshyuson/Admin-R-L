import { describe, expect, it } from 'vitest'
import { appendTransaction, calculateShiftAmount, employeeBalance, hasEmployeeOnDate } from './workVault'
import type { WorkVaultShift } from './workVault'

describe('WorkVault salary rules', () => {
  it('always calculates a full day plus hourly overtime', () => {
    expect(calculateShiftAmount(800, 'full', 0)).toBe(800)
    expect(calculateShiftAmount(800, 'half', 0)).toBe(800)
    expect(calculateShiftAmount(800, 'full', 2)).toBe(1000)
  })

  it('adds shifts and subtracts advances and payments without rewriting history', () => {
    let ledger = appendTransaction([], { id: '1', employeeId: 'e1', date: '2026-07-21', type: 'shift', amount: 800, shiftId: 's1', note: '', createdAt: '' })
    ledger = appendTransaction(ledger, { id: '2', employeeId: 'e1', date: '2026-07-21', type: 'advance', amount: -150, shiftId: null, note: '', createdAt: '' })
    ledger = appendTransaction(ledger, { id: '3', employeeId: 'e1', date: '2026-07-22', type: 'payment', amount: -250, shiftId: null, note: '', createdAt: '' })
    expect(ledger.map((item) => item.resultingBalance)).toEqual([800, 650, 400])
    expect(employeeBalance(ledger, 'e1')).toBe(400)
    expect(ledger).toHaveLength(3)
  })

  it('detects duplicate employee dates across shift types', () => {
    const shifts = [{ employeeId: 'e1', businessDate: '2026-07-21' }] as WorkVaultShift[]
    expect(hasEmployeeOnDate(shifts, 'e1', '2026-07-21')).toBe(true)
    expect(hasEmployeeOnDate(shifts, 'e1', '2026-07-22')).toBe(false)
  })
})
