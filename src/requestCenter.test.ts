import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { RequestCenterScreen } from './App'
import type { OrderEditRequestRecord, OrderRecord } from './lib/adminTypes'

const request: OrderEditRequestRecord = {
  id: 'request-1', deviceOrderId: 'tablet-1-order-42', displayOrderId: '42', deviceId: 'tablet-1',
  requestedBy: 'Cashier', requestType: 'cancel', requestedAt: '2026-10-12T09:00:00+08:00',
  status: 'pending', approvedBy: null, approvedAt: null, cancelledAt: null,
}
const order: OrderRecord = {
  deviceOrderId: 'tablet-1-order-42', deviceId: 'tablet-1', serviceMode: 'DINE IN',
  paymentMethod: 'CASH', paymentReference: null, cashAmount: 170, gcashAmount: null,
  paymentStatus: 'PAID', workflowStatus: 'PREPARING', subtotal: 170, tax: 0, total: 170,
  createdAt: '2026-10-12T08:50:00+08:00', orderNote: 'No onions',
  items: [{ name: 'Adobong Baboy', quantity: 2, lineTotal: 170 }],
}
function render(orders: OrderRecord[], requested = request) {
  return renderToStaticMarkup(createElement(RequestCenterScreen, {
    orderRequests: [requested], orders, shiftAdjustments: [], orderBusyId: null,
    adjustmentBusyId: null, error: '', onOrderDecision: () => {}, onAdjustmentDecision: () => {}, onBack: () => {},
  }))
}
describe('admin approval context', () => {
  it('shows the current order contents and amount before a cancellation decision', () => {
    const html = render([order])
    expect(html).toContain('Adobong Baboy')
    expect(html).toContain('170.00')
    expect(html).toContain('No onions')
    expect(html).toContain('PAID')
  })
  it('resolves the same device when request and order use legacy device labels', () => {
    expect(render([order], { ...request, deviceId: 'Tablet 1' })).toContain('Adobong Baboy')
  })
  it('does not attach another order by a reused display number', () => {
    const html = render([{ ...order, deviceOrderId: 'tablet-2-order-42', deviceId: 'tablet-2' }])
    expect(html).toContain('Order details unavailable')
    expect(html).not.toContain('Adobong Baboy')
  })
  it('describes an edit request as permission rather than an unrecorded change preview', () => {
    expect(render([order], { ...request, requestType: 'edit' })).toContain('unlocks editing')
  })
})
