import { describe, expect, it } from 'vitest'
import { buildPrintHtml } from './printService'
import type { CompletedOrder } from './posTypes'

describe('printService', () => {
  it('prints per-item service modes for mixed kitchen tickets', () => {
    const order: CompletedOrder = {
      deviceOrderId: 'TABLET-20260720124500-0001',
      deviceId: 'Tablet 1',
      createdAt: '2026-07-20T04:45:00.000Z',
      serviceMode: 'MIXED',
      payment: {
        method: 'CASH',
        paymentReference: null,
        cashAmount: null,
        gcashAmount: null,
        gcashReferenceLast4: null,
        amountReceived: null,
        changeAmount: 0,
      },
      orderNote: null,
      totals: { subtotal: 180, tax: 0, total: 180 },
      items: [
        {
          productId: 'meal-1',
          name: 'Pancit Canton',
          serviceMode: 'DINE IN',
          isHalfOrder: false,
          quantity: 1,
          price: 100,
          lineTotal: 100,
          kitchenStatus: 'PENDING',
          isChecked: false,
        },
        {
          productId: 'drink-1',
          name: 'Coke',
          serviceMode: 'TAKE OUT',
          isHalfOrder: false,
          quantity: 2,
          price: 40,
          lineTotal: 80,
          kitchenStatus: 'PENDING',
          isChecked: false,
        },
      ],
    }

    const html = buildPrintHtml(order, 'kitchen-ticket')

    expect(html).toContain('Dine In - 1x Pancit Canton')
    expect(html).toContain('Take Out - 2x Coke')
    expect(html).not.toContain('MIXED')
    expect(html).not.toContain('Per-item mode')
  })
})
