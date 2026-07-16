import { describe, expect, it } from 'vitest'
import {
  buildCartLine,
  buildPaymentDetails,
  calculateCartTotals,
  updateLineQuantity,
} from './checkoutService'
import type { PosMenuProduct } from './posTypes'

const product: PosMenuProduct = {
  id: 'meal-1',
  categoryId: 'meals',
  categoryName: 'Meals',
  name: 'Test Meal',
  price: 100,
  halfOrderPrice: 60,
  status: 'AVAILABLE',
  imagePath: null,
  stockCount: 10,
  isLowStock: false,
  isActive: true,
}

describe('checkoutService', () => {
  it('calculates totals with tax enabled', () => {
    const line = updateLineQuantity(buildCartLine(product, 'DINE IN', false), 2)
    expect(calculateCartTotals([line], true, 12)).toEqual({
      subtotal: 200,
      tax: 24,
      total: 224,
    })
  })

  it('uses half-order pricing when enabled', () => {
    const line = buildCartLine(product, 'TAKE OUT', true)
    expect(line.unitPrice).toBe(60)
    expect(line.lineTotal).toBe(60)
  })

  it('supports exact cash payment', () => {
    expect(buildPaymentDetails({ method: 'CASH', cashReceived: 150 }, 150)).toMatchObject({
      method: 'CASH',
      cashAmount: 150,
      changeAmount: 0,
    })
  })

  it('supports cash overpay and change', () => {
    expect(buildPaymentDetails({ method: 'CASH', cashReceived: 200 }, 175)).toMatchObject({
      paymentReference: 'CASH:200.00',
      amountReceived: 200,
      changeAmount: 25,
    })
  })

  it('supports GCash reference capture', () => {
    expect(buildPaymentDetails({ method: 'GCASH', gcashReference: ' 1234 5678 ' }, 90)).toMatchObject({
      paymentReference: '12345678',
      gcashAmount: 90,
      gcashReferenceLast4: '5678',
    })
  })

  it('supports split payment', () => {
    expect(buildPaymentDetails({
      method: 'SPLIT',
      splitCashAmount: 80,
      splitGcashAmount: 70,
      splitGcashReference: 'ABCD9999',
    }, 150)).toMatchObject({
      cashAmount: 80,
      gcashAmount: 70,
      gcashReferenceLast4: '9999',
      changeAmount: 0,
    })
  })
})

