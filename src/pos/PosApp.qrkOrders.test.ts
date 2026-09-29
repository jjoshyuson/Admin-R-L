import { describe, expect, it } from 'vitest'
import type { OrderRecord } from '../lib/adminTypes'
import { mapAdminOrderToRestaurantOrder } from './PosApp'

function order(workflowStatus: string, deviceId = 'QRK MENU'): OrderRecord {
  return {
    deviceOrderId: 'QRK-TEST-001',
    deviceId,
    serviceMode: 'DINE IN',
    paymentMethod: 'counter',
    paymentReference: null,
    cashAmount: null,
    gcashAmount: null,
    paymentStatus: 'UNPAID',
    workflowStatus,
    subtotal: 85,
    tax: 0,
    total: 85,
    createdAt: '2026-09-30T00:00:00Z',
    items: [{
      productId: 'product-1',
      name: 'ADOBONG BABOY',
      quantity: 1,
      price: 85,
      lineTotal: 85,
      kitchenStatus: 'PENDING',
      isChecked: false,
    }],
  }
}

describe('QRK incoming order mapping', () => {
  it('keeps a new QRK order behind acceptance instead of treating it as preparing', () => {
    const mapped = mapAdminOrderToRestaurantOrder(order('PENDING_ACCEPTANCE'))

    expect(mapped.requiresAcceptance).toBe(true)
    expect(mapped.items[0]?.served).toBe(false)
  })

  it('clears the notification state after the workflow moves to preparing', () => {
    expect(mapAdminOrderToRestaurantOrder(order('PREPARING')).requiresAcceptance).toBe(false)
  })

  it('does not classify a non-QRK order as an incoming notification', () => {
    expect(mapAdminOrderToRestaurantOrder(order('PENDING_ACCEPTANCE', 'TABLET-1')).requiresAcceptance).toBe(false)
  })
})
