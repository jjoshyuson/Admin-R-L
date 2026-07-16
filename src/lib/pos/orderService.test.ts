import { describe, expect, it } from 'vitest'
import { buildCartLine, buildPaymentDetails, calculateCartTotals } from './checkoutService'
import { buildCompletedOrder, buildOrderPayload } from './orderService'
import type { PosMenuProduct } from './posTypes'

const product: PosMenuProduct = {
  id: 'drink-1',
  categoryId: 'drinks',
  categoryName: 'Drinks',
  name: 'Iced Tea',
  price: 50,
  halfOrderPrice: null,
  status: 'AVAILABLE',
  imagePath: null,
  stockCount: 15,
  isLowStock: false,
  isActive: true,
}

describe('orderService', () => {
  it('maps completed orders to Android-compatible Supabase payload fields', () => {
    const lines = [buildCartLine(product, 'DINE IN', false)]
    const totals = calculateCartTotals(lines, false, 0)
    const payment = buildPaymentDetails({ method: 'CASH', cashReceived: 50 }, totals.total)
    const order = buildCompletedOrder({
      deviceId: 'Tablet 1',
      orderNote: 'No ice',
      lines,
      totals,
      payment,
      createdAt: new Date('2026-07-05T01:00:00.000Z'),
    })
    const payload = buildOrderPayload(order, true)

    expect(payload).toMatchObject({
      device_order_id: expect.stringContaining('TABLET-1-20260705010000'),
      device_id: 'Tablet 1',
      service_mode: 'DINE IN',
      payment_method: 'CASH',
      payment_reference: 'CASH:50.00',
      cash_amount: 50,
      gcash_amount: null,
      subtotal: 50,
      tax: 0,
      total: 50,
      workflow_status: 'PAID',
      payment_status: 'PAID',
      order_note: 'No ice',
    })
    expect(payload.items_json).toEqual([
      {
        productId: 'drink-1',
        name: 'Iced Tea',
        serviceMode: 'DINE IN',
        isHalfOrder: false,
        quantity: 1,
        price: 50,
        lineTotal: 50,
        kitchenStatus: 'PENDING',
        isChecked: false,
      },
    ])
  })

  it('can build a legacy payload without kitchen columns', () => {
    const lines = [buildCartLine(product, 'TAKE OUT', false)]
    const totals = calculateCartTotals(lines, false, 0)
    const payment = buildPaymentDetails({ method: 'GCASH', gcashReference: 'G1234' }, totals.total)
    const order = buildCompletedOrder({
      deviceId: 'Tablet 2',
      orderNote: null,
      lines,
      totals,
      payment,
      createdAt: new Date('2026-07-05T01:00:00.000Z'),
    })
    const payload = buildOrderPayload(order, false)

    expect(payload.workflow_status).toBeUndefined()
    expect(payload.item_checklist_json).toBeUndefined()
    expect(payload).toMatchObject({
      device_id: 'Tablet 2',
      payment_method: 'GCASH',
      gcash_amount: 50,
      total: 50,
    })
  })
})
