import { describe, expect, it } from 'vitest'
import { aggregateSalePaymentEvents, type SalePayment } from './PosApp'

function payment(amount: number, createdAt: string): SalePayment {
  return {
    id: `payment-${amount}`,
    orderId: 'TABLET-1-20260725043426-0042',
    customerName: 'MARJAE',
    amount,
    method: 'cash',
    status: 'paid',
    createdAt,
    items: [{
      name: 'LANGKA',
      quantity: 1,
      price: 35,
      isHalfOrder: true,
    }],
  }
}

describe('POS sale history payment aggregation', () => {
  it('combines multiple cash collections for one order', () => {
    const result = aggregateSalePaymentEvents([
      payment(90, '2026-07-25T04:34:26.501Z'),
      payment(115, '2026-07-25T04:41:20.435Z'),
    ])

    expect(result).toHaveLength(1)
    expect(result[0]?.amount).toBe(205)
    expect(result[0]?.items[0]?.isHalfOrder).toBe(true)
  })
})
