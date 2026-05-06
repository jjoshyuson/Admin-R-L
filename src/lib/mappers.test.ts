import { describe, expect, it } from 'vitest'
import {
  buildBillViews,
  buildDashboardSnapshot,
  buildOrderHistoryViews,
} from './mappers'
import type {
  CashMovement,
  DailyAccountingRecord,
  MenuProduct,
  OrderRecord,
  OrderVoidRecord,
  Payable,
} from './adminTypes'

describe('buildOrderHistoryViews', () => {
  it('marks voided orders as voided', () => {
    const orders: OrderRecord[] = [
      {
        deviceOrderId: 'A-100',
        deviceId: 'tablet-1',
        paymentMethod: 'Cash',
        paymentReference: null,
        cashAmount: 200,
        gcashAmount: null,
        subtotal: 180,
        tax: 20,
        total: 200,
        createdAt: '2026-05-02T10:00:00.000Z',
        items: [{ name: 'Sisig', quantity: 1, lineTotal: 200 }],
      },
    ]
    const voids: OrderVoidRecord[] = [
      {
        deviceOrderId: 'A-100',
        voidReason: 'Duplicate',
        voidedBy: 'Admin Web',
        voidedAt: '2026-05-02T10:05:00.000Z',
      },
    ]

    const result = buildOrderHistoryViews(orders, voids)

    expect(result).toHaveLength(1)
    expect(result[0].status).toBe('voided')
  })
})

describe('buildDashboardSnapshot', () => {
  it('excludes voided orders from the dashboard sync banner and totals', () => {
    const orders: OrderRecord[] = [
      {
        deviceOrderId: 'A-100',
        deviceId: 'tablet-1',
        paymentMethod: 'Cash',
        paymentReference: null,
        cashAmount: 200,
        gcashAmount: null,
        subtotal: 180,
        tax: 20,
        total: 200,
        createdAt: new Date().toISOString(),
        items: [{ name: 'Sisig', quantity: 1, lineTotal: 200 }],
      },
      {
        deviceOrderId: 'A-101',
        deviceId: 'tablet-2',
        paymentMethod: 'GCash',
        paymentReference: 'ABC',
        cashAmount: null,
        gcashAmount: 100,
        subtotal: 90,
        tax: 10,
        total: 100,
        createdAt: new Date().toISOString(),
        items: [{ name: 'Tea', quantity: 1, lineTotal: 100 }],
      },
    ]
    const voids: OrderVoidRecord[] = [
      {
        deviceOrderId: 'A-101',
        voidReason: 'Duplicate',
        voidedBy: 'Admin Web',
        voidedAt: new Date().toISOString(),
      },
    ]
    const accounting: DailyAccountingRecord[] = [
      {
        businessDate: '2026-05-02',
        calculatedAt: new Date().toISOString(),
        totalSales: 200,
        netSales: 178.57,
        totalCost: 80,
        grossProfit: 120,
        netProfit: 120,
        orderCount: 1,
        sourceLabel: 'Test',
        missingRecipeCount: 0,
        hasFallbackPricing: false,
        hasConversionIssue: false,
      },
    ]
    const products: MenuProduct[] = []
    const movements: CashMovement[] = []

    const snapshot = buildDashboardSnapshot(orders, voids, accounting, products, [], movements)

    expect(snapshot.syncBannerTitle).toContain('Orders synchronized')
    expect(snapshot.financialMetrics[0].value).toContain('200')
  })
})

describe('buildBillViews', () => {
  it('maps payable status to paid flag', () => {
    const payables: Payable[] = [
      {
        id: 'pay-1',
        title: 'Rent',
        vendorName: 'Landlord',
        category: 'Rent',
        cashFlowClass: 'OPERATING',
        amount: 5000,
        dueDateEpochMillis: Date.parse('2026-05-09T00:00:00.000Z'),
        status: 'PAID',
        paymentSource: 'main-safe',
        paidAtEpochMillis: Date.now(),
        note: null,
        createdBy: 'Admin Web',
        createdAtEpochMillis: Date.now(),
      },
    ]

    const result = buildBillViews(payables)

    expect(result[0].paid).toBe(true)
  })
})
