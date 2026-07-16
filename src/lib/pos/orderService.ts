import { hasSupabaseConfig, requireSupabase } from '../supabase/client'
import type { CompletedOrder, KitchenOrderItem, SaveOrderInput } from './posTypes'

type OrderPayload = Record<string, unknown>
let kitchenColumnSupport: boolean | null = null

export function buildCompletedOrder(input: SaveOrderInput): CompletedOrder {
  const createdAt = input.createdAt ?? new Date()
  const items = input.lines.map<KitchenOrderItem>((line) => ({
    productId: line.product.id,
    name: line.product.name,
    serviceMode: line.serviceMode,
    isHalfOrder: line.isHalfOrder,
    quantity: line.quantity,
    price: line.unitPrice,
    lineTotal: line.lineTotal,
    kitchenStatus: 'PENDING',
    isChecked: false,
  }))
  return {
    deviceOrderId: createDeviceOrderId(input.deviceId, createdAt),
    deviceId: input.deviceId,
    createdAt: createdAt.toISOString(),
    serviceMode: resolveOrderMode(items),
    payment: input.payment,
    orderNote: input.orderNote?.trim() || null,
    totals: input.totals,
    items,
  }
}

export function buildOrderPayload(order: CompletedOrder, includeKitchenColumns: boolean): OrderPayload {
  const basePayload: OrderPayload = {
    device_order_id: order.deviceOrderId,
    device_id: order.deviceId,
    service_mode: order.serviceMode,
    payment_method: order.payment.method,
    payment_reference: order.payment.paymentReference,
    cash_amount: order.payment.cashAmount,
    gcash_amount: order.payment.gcashAmount,
    subtotal: order.totals.subtotal,
    tax: order.totals.tax,
    total: order.totals.total,
    items_json: order.items,
    created_at: order.createdAt,
    uploaded_at: new Date().toISOString(),
  }

  if (!includeKitchenColumns) {
    return basePayload
  }

  return {
    ...basePayload,
    payment_status: 'PAID',
    workflow_status: 'PAID',
    item_checklist_json: order.items.map(() => false),
    completed_at: null,
    order_note: order.orderNote,
    gcash_reference_last4: order.payment.gcashReferenceLast4,
  }
}

export async function savePaidOrder(input: SaveOrderInput): Promise<CompletedOrder> {
  const order = buildCompletedOrder(input)
  if (!hasSupabaseConfig) {
    saveLocalPreview(order)
    return order
  }

  const supabase = requireSupabase()
  const supportsKitchenColumns = await detectKitchenColumnSupport()
  const payload = buildOrderPayload(order, supportsKitchenColumns)
  const result = await supabase.from('orders').upsert(payload, { onConflict: 'device_order_id' })
  if (result.error) throw result.error
  return order
}

function createDeviceOrderId(deviceId: string, createdAt: Date) {
  const compactTime = createdAt.toISOString().replace(/[-:.TZ]/g, '').slice(0, 14)
  const random = Math.random().toString(36).slice(2, 7).toUpperCase()
  return `${deviceId.trim().replace(/\s+/g, '-').toUpperCase()}-${compactTime}-${random}`
}

function resolveOrderMode(items: KitchenOrderItem[]) {
  const modes = Array.from(new Set(items.map((item) => item.serviceMode)))
  return modes.length === 1 ? modes[0] : 'MIXED'
}

function saveLocalPreview(order: CompletedOrder) {
  if (typeof window === 'undefined') return
  const key = 'pos-web-preview-orders'
  const existing = JSON.parse(window.localStorage.getItem(key) ?? '[]') as CompletedOrder[]
  window.localStorage.setItem(key, JSON.stringify([order, ...existing].slice(0, 30)))
}

async function detectKitchenColumnSupport() {
  if (kitchenColumnSupport != null) {
    return kitchenColumnSupport
  }
  const supabase = requireSupabase()
  const { data, error } = await supabase.from('orders').select('*').limit(1)
  if (error) throw error
  const row = data?.[0] as Record<string, unknown> | undefined
  kitchenColumnSupport = Boolean(row && 'workflow_status' in row && 'item_checklist_json' in row)
  return kitchenColumnSupport
}
