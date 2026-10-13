import { readFileSync } from 'node:fs'
import { describe, it, expect } from 'vitest'
import { resolveShiftWindow, calculateShiftTotals, calculateAuditVariance, type ShiftReport } from '../src/lib/shiftService'
import { buildCartLine, updateLineQuantity, calculateCartTotals, buildPaymentDetails } from '../src/lib/pos/checkoutService'
import { paymentBelongsToActiveShift } from '../src/lib/pos/shiftFiltering'
import type { ShiftSchedule } from '../src/lib/adminTypes'
import type { PosMenuProduct } from '../src/lib/pos/posTypes'

const root = process.env.RNL_MENU_BACKUP ?? readFileSync('/tmp/rnl-backup-audit/backup-path.txt', 'utf8').trim()
const raw = JSON.parse(readFileSync(`${root}/products.json`, 'utf8'))
const products: PosMenuProduct[] = raw.map((row: any) => ({ id: row.id, categoryId: row.category_id, categoryName: '', name: row.name, price: Number(row.price), halfOrderPrice: row.half_order_price == null ? null : Number(row.half_order_price), status: row.status, imagePath: row.image_path, stockCount: row.stock_count, isLowStock: row.is_low_stock, isActive: row.is_active }))
const schedule: ShiftSchedule = { firstShiftStart: '08:00', secondShiftStart: '20:00', timezone: 'Asia/Manila' }
const empty = (): ShiftReport => ({ sessions: [], orders: [], payments: [], expenses: [], adjustments: [], audit: null })

describe('RNL menu-derived calculation audit', () => {
  it.each([
    ['2026-10-12T07:59:00+08:00', 'SECOND', '2026-10-11'],
    ['2026-10-12T08:00:00+08:00', 'FIRST', '2026-10-12'],
    ['2026-10-12T19:59:00+08:00', 'FIRST', '2026-10-12'],
    ['2026-10-12T20:00:00+08:00', 'SECOND', '2026-10-12'],
    ['2026-10-13T00:01:00+08:00', 'SECOND', '2026-10-12'],
  ])('assigns %s to its Philippine shift and business date', (timestamp, shiftType, businessDate) => {
    expect(resolveShiftWindow(new Date(timestamp), schedule)).toMatchObject({ shiftType, businessDate })
  })
  it('keeps an overtime collection in the shift assigned at clock-in', () => {
    expect(paymentBelongsToActiveShift({ shiftId: '2026-10-12-first', shiftSessionId: 'session-first', createdAt: '2026-10-12T21:00:00+08:00' }, { id: 'session-first', shiftId: '2026-10-12-first', clockedInAt: '2026-10-12T08:00:00+08:00', clockedOutAt: '2026-10-12T21:05:00+08:00' })).toBe(true)
  })
  it('calculates 10,000 synthetic cart lines from menu prices against an integer-cent oracle', () => {
    let expectedCents = 0
    const lines = Array.from({ length: 10_000 }, (_, index) => {
      const product = products[index % products.length]
      const quantity = index % 5 + 1
      const half = index % 3 === 0 && product.halfOrderPrice != null
      expectedCents += Math.round((half ? product.halfOrderPrice! : product.price) * 100) * quantity
      return updateLineQuantity(buildCartLine(product, 'DINE IN', half), quantity)
    })
    expect(calculateCartTotals(lines, false, 0)).toEqual({ subtotal: expectedCents / 100, tax: 0, total: expectedCents / 100 })
  })
  it('validates checkout and calculates change across the backed-up menu', () => {
    for (const product of products) {
      const due = Math.round(product.price * 100) / 100
      if (due <= 0) expect(() => buildPaymentDetails({ method: 'CASH', cashReceived: 100 }, due)).toThrow('Add items before checkout.')
      else expect(buildPaymentDetails({ method: 'CASH', cashReceived: due + 100 }, due).changeAmount).toBe(100)
    }
  })
  it('attributes cross-shift collections to the collecting shift, not the origin', () => {
    const report = empty()
    report.payments = [
      { id: 'cash', orderId: 'older-order', originShiftId: '2026-10-12-first', collectionShiftId: '2026-10-12-second', shiftSessionId: 'second', method: 'CASH', amount: 300, collectedBy: 'Synthetic', collectedAt: '2026-10-12T21:00:00+08:00' },
      { id: 'gcash', orderId: 'older-order', originShiftId: '2026-10-12-first', collectionShiftId: '2026-10-12-second', shiftSessionId: 'second', method: 'GCASH', amount: 125, collectedBy: 'Synthetic', collectedAt: '2026-10-12T21:00:00+08:00' },
    ]
    expect(calculateShiftTotals(report)).toMatchObject({ grossCash: 300, grossGcash: 125, totalSales: 425 })
  })
  it('returns cent-precise variance values for fractional peso counts', () => {
    expect(calculateAuditVariance(0.2, 0.3, 0.3, 0.2)).toEqual({ cashVariance: 0.1, gcashVariance: -0.1 })
  })
})
