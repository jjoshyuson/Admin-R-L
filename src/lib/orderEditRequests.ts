import { hasSupabaseConfig, requireSupabase } from './supabase/client'
import type { OrderEditRequestRecord, OrderEditRequestStatus, OrderRequestType } from './adminTypes'

type OrderEditRequestRow = {
  id: string
  device_order_id: string
  display_order_id: string | null
  device_id: string | null
  requested_by: string | null
  requested_at: string | null
  status: string | null
  approved_by: string | null
  approved_at: string | null
  cancelled_at: string | null
  request_type?: string | null
}

type CreateOrderEditRequestInput = {
  deviceOrderId: string
  displayOrderId: string
  deviceId: string
  requestedBy: string
  requestType: OrderRequestType
}

function assertOnlineRequestsAvailable() {
  if (!hasSupabaseConfig) {
    throw new Error('Edit order approval requires online Supabase sync.')
  }
}

function normalizeStatus(value: string | null): OrderEditRequestStatus {
  if (value === 'approved' || value === 'rejected' || value === 'cancelled' || value === 'expired') return value
  return 'pending'
}

function mapOrderEditRequest(row: OrderEditRequestRow): OrderEditRequestRecord {
  return {
    id: String(row.id),
    deviceOrderId: String(row.device_order_id),
    displayOrderId: String(row.display_order_id ?? row.device_order_id),
    deviceId: String(row.device_id ?? ''),
    requestedBy: String(row.requested_by ?? 'POS'),
    requestType: row.request_type === 'cancel' || String(row.requested_by ?? '').toLowerCase().includes('cancel order') ? 'cancel' : 'edit',
    requestedAt: String(row.requested_at ?? ''),
    status: normalizeStatus(row.status),
    approvedBy: row.approved_by ? String(row.approved_by) : null,
    approvedAt: row.approved_at ? String(row.approved_at) : null,
    cancelledAt: row.cancelled_at ? String(row.cancelled_at) : null,
  }
}

function isMissingRequestTable(error: unknown) {
  if (!error || typeof error !== 'object') return false
  const code = String(Reflect.get(error, 'code') ?? '')
  const message = String(Reflect.get(error, 'message') ?? '').toLowerCase()
  return code === '42P01'
    || code === 'PGRST205'
    || message.includes('order_edit_requests')
    || message.includes('schema cache')
    || message.includes('could not find the table')
}

export function describeOrderEditRequestError(error: unknown) {
  if (isMissingRequestTable(error)) {
    return 'Edit order approval is online-only. Run SUPABASE_ORDER_EDIT_REQUESTS.sql in Supabase first.'
  }
  if (error instanceof Error && error.message.trim()) return error.message
  if (error && typeof error === 'object') {
    const message = Reflect.get(error, 'message')
    if (typeof message === 'string' && message.trim()) return message
  }
  return 'Could not update the edit order request.'
}

export async function createOrderEditRequest(input: CreateOrderEditRequestInput) {
  assertOnlineRequestsAvailable()
  const supabase = requireSupabase()
  const requestedAt = new Date().toISOString()
  const { data, error } = await supabase
    .from('order_edit_requests')
    .insert({
      device_order_id: input.deviceOrderId,
      display_order_id: input.displayOrderId,
      device_id: input.deviceId,
      requested_by: input.requestedBy,
      request_type: input.requestType,
      requested_at: requestedAt,
      status: 'pending',
    })
    .select('id,device_order_id,display_order_id,device_id,requested_by,requested_at,status,approved_by,approved_at,cancelled_at,request_type')
    .single()
  if (error) throw error
  return mapOrderEditRequest(data as OrderEditRequestRow)
}

export async function fetchPendingOrderEditRequests() {
  if (!hasSupabaseConfig) return []
  const supabase = requireSupabase()
  const { data, error } = await supabase
    .from('order_edit_requests')
    .select('id,device_order_id,display_order_id,device_id,requested_by,requested_at,status,approved_by,approved_at,cancelled_at,request_type')
    .eq('status', 'pending')
    .order('requested_at', { ascending: true })
    .limit(20)
  if (error) {
    if (isMissingRequestTable(error)) return []
    throw error
  }
  return ((data ?? []) as OrderEditRequestRow[]).map(mapOrderEditRequest)
}

export async function approveOrderEditRequest(requestId: string, approvedBy = 'Admin Web') {
  assertOnlineRequestsAvailable()
  const supabase = requireSupabase()
  const { data, error } = await supabase
    .from('order_edit_requests')
    .update({
      status: 'approved',
      approved_by: approvedBy,
      approved_at: new Date().toISOString(),
    })
    .eq('id', requestId)
    .eq('status', 'pending')
    .select('id,device_order_id,display_order_id,device_id,requested_by,requested_at,status,approved_by,approved_at,cancelled_at,request_type')
    .single()
  if (error) throw error
  return mapOrderEditRequest(data as OrderEditRequestRow)
}

export async function cancelOrderEditRequest(requestId: string) {
  if (!hasSupabaseConfig) return
  const supabase = requireSupabase()
  const { error } = await supabase
    .from('order_edit_requests')
    .update({
      status: 'cancelled',
      cancelled_at: new Date().toISOString(),
    })
    .eq('id', requestId)
    .eq('status', 'pending')
  if (error && !isMissingRequestTable(error)) throw error
}

export async function rejectOrderEditRequest(requestId: string, approvedBy = 'Admin Web') {
  assertOnlineRequestsAvailable()
  const supabase = requireSupabase()
  const { data, error } = await supabase
    .from('order_edit_requests')
    .update({
      status: 'rejected',
      approved_by: approvedBy,
      approved_at: new Date().toISOString(),
    })
    .eq('id', requestId)
    .eq('status', 'pending')
    .select('id,device_order_id,display_order_id,device_id,requested_by,requested_at,status,approved_by,approved_at,cancelled_at,request_type')
    .single()
  if (error) throw error
  return mapOrderEditRequest(data as OrderEditRequestRow)
}

export async function fetchPendingOrderRequestsForDevice(deviceId: string) {
  const requests = await fetchPendingOrderEditRequests()
  return requests.filter((request) => request.deviceId === deviceId)
}

export async function fetchOrderEditRequest(requestId: string) {
  assertOnlineRequestsAvailable()
  const supabase = requireSupabase()
  const { data, error } = await supabase
    .from('order_edit_requests')
    .select('id,device_order_id,display_order_id,device_id,requested_by,requested_at,status,approved_by,approved_at,cancelled_at,request_type')
    .eq('id', requestId)
    .single()
  if (error) throw error
  return mapOrderEditRequest(data as OrderEditRequestRow)
}

export function subscribeToOrderEditRequests(onChange: () => void) {
  if (!hasSupabaseConfig) return () => {}
  const supabase = requireSupabase()
  const channel = supabase
    .channel(`order-edit-requests-admin-${Date.now()}`)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'order_edit_requests' }, onChange)
    .subscribe()
  return () => {
    void supabase.removeChannel(channel)
  }
}

export function subscribeToOrderEditRequest(requestId: string, onChange: (request: OrderEditRequestRecord) => void) {
  if (!hasSupabaseConfig) return () => {}
  const supabase = requireSupabase()
  const channel = supabase
    .channel(`order-edit-request-pos-${requestId}`)
    .on(
      'postgres_changes',
      { event: 'UPDATE', schema: 'public', table: 'order_edit_requests', filter: `id=eq.${requestId}` },
      (payload) => {
        onChange(mapOrderEditRequest(payload.new as OrderEditRequestRow))
      },
    )
    .subscribe()
  return () => {
    void supabase.removeChannel(channel)
  }
}
