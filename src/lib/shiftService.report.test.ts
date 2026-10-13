import { describe, expect, it, vi } from 'vitest'
const fixture = vi.hoisted(() => ({ tables: {} as Record<string, Record<string, unknown>[]> }))
vi.mock('./supabase/client', () => ({ hasSupabaseConfig: true, requireSupabase: () => ({ from: (table: string) => {
  let rows = fixture.tables[table] ?? []
  const query: any = {
    select: () => query, order: () => query,
    eq: (key: string, value: unknown) => { rows = rows.filter(row => row[key] === value); return query },
    in: (key: string, values: unknown[]) => { rows = rows.filter(row => values.includes(row[key])); return query },
    or: () => query,
    maybeSingle: () => Promise.resolve({ data: rows[0] ?? null, error: null }),
    then: (resolve: any, reject: any) => Promise.resolve({ data: rows, error: null }).then(resolve, reject),
  }
  return query
} }) }))
import { fetchShiftReport } from './shiftService'
describe('shift report source validity', () => {
  it('excludes voided orders, their collections, and missing source orders', async () => {
    const shift = '2026-10-12-first'
    fixture.tables = {
      orders: ['valid', 'void'].map(device_order_id => ({ device_order_id, shift_id: shift, total: 100, items_json: [] })),
      order_voids: [{ device_order_id: 'void' }],
      shift_payment_events: ['valid', 'void', 'missing'].map(order_id => ({ id: order_id, order_id, origin_shift_id: shift, collection_shift_id: shift, amount: 100, method: 'CASH' })),
    }
    const report = await fetchShiftReport('2026-10-12', 'FIRST')
    expect(report.orders.map(order => order.deviceOrderId)).toEqual(['valid'])
    expect(report.payments.map(payment => payment.orderId)).toEqual(['valid'])
  })
})
