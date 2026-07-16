import { describe, expect, it } from 'vitest'
import {
  buildBillViews,
  buildCashAccounts,
  buildDashboardSnapshot,
  buildOrderHistoryViews,
  resolveCashOrderAmount,
  resolveOrderSalesAmount,
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

  it('shows workflow status until the order is served, then payment status', () => {
    const baseOrder: OrderRecord = {
      deviceOrderId: 'A-100',
      deviceId: 'tablet-1',
      paymentMethod: 'UNPAID',
      paymentReference: null,
      cashAmount: null,
      gcashAmount: null,
      subtotal: 195,
      tax: 0,
      total: 195,
      createdAt: '2026-05-02T10:00:00.000Z',
      items: [{ name: 'Lomi', quantity: 1, lineTotal: 65 }],
    }

    expect(buildOrderHistoryViews([{ ...baseOrder, workflowStatus: 'PREPARING', paymentStatus: 'UNPAID' }], [])[0].displayStatus).toBe('Preparing')
    expect(buildOrderHistoryViews([{ ...baseOrder, workflowStatus: 'SERVED', paymentStatus: 'UNPAID' }], [])[0].displayStatus).toBe('Pending Payment')
    expect(buildOrderHistoryViews([{ ...baseOrder, workflowStatus: 'PENDING_PAYMENT', paymentStatus: 'UNPAID' }], [])[0].displayStatus).toBe('Pending Payment')
    expect(buildOrderHistoryViews([{ ...baseOrder, workflowStatus: 'SERVED', paymentStatus: 'PARTIAL' }], [])[0].displayStatus).toBe('Partial Payment')
    expect(buildOrderHistoryViews([{ ...baseOrder, workflowStatus: 'PAID', paymentStatus: 'PAID' }], [])[0].displayStatus).toBe('Paid')
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

describe('split payment totals', () => {
  it('does not count GCash twice when cash amount stores the full collected value', () => {
    const order: OrderRecord = {
      deviceOrderId: 'SPLIT-1',
      deviceId: 'tablet-1',
      paymentMethod: 'CASH',
      paymentReference: null,
      cashAmount: 1040,
      gcashAmount: 195,
      subtotal: 928.57,
      tax: 111.43,
      total: 1040,
      createdAt: new Date().toISOString(),
      items: [{ name: 'Mixed Payment', quantity: 1, lineTotal: 1040 }],
    }

    expect(resolveCashOrderAmount(order)).toBe(845)
    expect(resolveOrderSalesAmount(order)).toBe(1040)

    const snapshot = buildDashboardSnapshot([order], [], [], [], [], [])
    expect(snapshot.paymentBreakdown.cash).toBe(845)
    expect(snapshot.paymentBreakdown.gcash).toBe(195)
    expect(snapshot.financialMetrics.find((item) => item.label === 'Total Sales')?.value).toContain('1,040')
    expect(snapshot.financialMetrics.find((item) => item.label === 'Cash Sales')?.value).toContain('845')
    expect(snapshot.financialMetrics.find((item) => item.label === 'GCash Sales')?.value).toContain('195')

    const accounts = buildCashAccounts([order], [])
    expect(accounts.find((account) => account.id === 'tablet-1')?.salesToday).toBe(845)
    expect(accounts.find((account) => account.id === 'bank-gcash')?.salesToday).toBe(195)
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
