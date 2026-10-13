import { describe, expect, it } from 'vitest'
import { aggregateSalePaymentEvents, buildPaymentRows, type SalePayment } from './PosApp'

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

describe('partial payment replay', () => {
  it('keeps collection IDs and amounts unchanged when replaying a later paid snapshot', () => {
    const order: Parameters<typeof buildPaymentRows>[0] = { id: 'Table 1', deviceOrderId: 'unique-device-order', items: [], status: 'paid', paid: true, readyForPayment: true, paymentReceived: 50, paymentMethod: 'cash', paymentReference: '', paymentNotes: '', orderType: 'DINE IN', createdAt: 1780000000000, shiftId: 'first', shiftSessionId: 'session' }
    const payments = [20,30].map((amount, index) => ({ id: `collection-${index}`, method: 'cash' as const, amount, reference: '', notes: '', collectedAt: '2026-10-13T01:00:00Z' }))
    const rows = payments.flatMap(payment => buildPaymentRows(order, payment))
    expect(rows.map(row => row.amount)).toEqual([20,30])
    expect(rows.map(row => row.id)).toEqual(['collection-0','collection-1'])
    expect(buildPaymentRows(order, payments[0])).toEqual(buildPaymentRows(order, payments[0]))
  })
})
