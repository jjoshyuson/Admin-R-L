import { describe, expect, it } from 'vitest'
import { expenseVoidTargetId, voidedExpenseIds } from './adminApi'
import type { CashMovement } from './adminTypes'

function movement(overrides: Partial<CashMovement>): CashMovement {
  return {
    id: 'expense-1',
    accountId: 'main-safe',
    accountType: 'SAFE',
    sourceAccountId: 'main-safe',
    destinationAccountId: null,
    movementKind: 'PAY_OUT',
    reasonCategory: 'Supplies',
    amount: 100,
    note: null,
    relatedBillId: null,
    createdBy: 'Admin Web',
    createdAtEpochMillis: 1,
    ...overrides,
  }
}

describe('expense void markers', () => {
  it('links an adjustment reversal to its original expense', () => {
    const reversal = movement({
      id: 'expense-void-expense-1',
      movementKind: 'ADJUSTMENT_PLUS',
      relatedBillId: 'void-expense:expense-1',
    })

    expect(expenseVoidTargetId(reversal)).toBe('expense-1')
    expect(voidedExpenseIds([movement({}), reversal])).toEqual(new Set(['expense-1']))
  })

  it('does not classify ordinary adjustments as expense voids', () => {
    expect(expenseVoidTargetId(movement({
      movementKind: 'ADJUSTMENT_PLUS',
      relatedBillId: null,
    }))).toBeNull()
  })
})
