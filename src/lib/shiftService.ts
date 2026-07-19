import { hasSupabaseConfig, requireSupabase } from './supabase/client'
import type { CashMovement, OrderRecord, ShiftAdjustment, ShiftAudit, ShiftPaymentEvent, ShiftSchedule, ShiftSession, ShiftType } from './adminTypes'

export const defaultShiftSchedule: ShiftSchedule = {
  firstShiftStart: '06:00',
  secondShiftStart: '14:00',
  timezone: 'Asia/Manila',
}

function minuteOfDay(value: string) {
  const match = /^(\d{2}):(\d{2})$/.exec(value)
  if (!match) return -1
  const hour = Number(match[1]); const minute = Number(match[2])
  return hour < 24 && minute < 60 ? hour * 60 + minute : -1
}

export function validateShiftSchedule(schedule: ShiftSchedule) {
  const first = minuteOfDay(schedule.firstShiftStart)
  const second = minuteOfDay(schedule.secondShiftStart)
  if (first < 0 || second < 0) return 'Shift start times must use HH:MM.'
  if (first === second) return 'First and Second Shift must start at different times.'
  if (!schedule.timezone.trim()) return 'Business timezone is required.'
  return null
}

function zonedParts(now: Date, timezone: string) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  }).formatToParts(now)
  const get = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value ?? ''
  return { date: `${get('year')}-${get('month')}-${get('day')}`, minute: Number(get('hour')) * 60 + Number(get('minute')) }
}

export function resolveShiftWindow(now: Date, schedule: ShiftSchedule): { shiftType: ShiftType; businessDate: string; shiftId: string } {
  const { date, minute } = zonedParts(now, schedule.timezone)
  const first = minuteOfDay(schedule.firstShiftStart)
  const second = minuteOfDay(schedule.secondShiftStart)
  const firstActive = first < second ? minute >= first && minute < second : minute >= first || minute < second
  const shiftType: ShiftType = firstActive ? 'FIRST' : 'SECOND'
  // The business date follows the First Shift start, including businesses whose First Shift starts later than Second.
  const dateObject = new Date(`${date}T12:00:00Z`)
  if (minute < first) dateObject.setUTCDate(dateObject.getUTCDate() - 1)
  const businessDate = dateObject.toISOString().slice(0, 10)
  return { shiftType, businessDate, shiftId: `${businessDate}-${shiftType.toLowerCase()}` }
}

export async function fetchShiftSchedule(): Promise<ShiftSchedule> {
  if (!hasSupabaseConfig) return defaultShiftSchedule
  const { data, error } = await requireSupabase().from('admin_settings').select('value').eq('key', 'turnover_settings').maybeSingle()
  if (error) throw error
  const value = (data as { value?: Partial<ShiftSchedule> } | null)?.value ?? {}
  return { ...defaultShiftSchedule, ...value }
}

export async function saveShiftSchedule(schedule: ShiftSchedule) {
  const validation = validateShiftSchedule(schedule); if (validation) throw new Error(validation)
  if (!hasSupabaseConfig) throw new Error('Turnover settings require Supabase.')
  const { error } = await requireSupabase().from('admin_settings').upsert({ key: 'turnover_settings', value: schedule, updated_at: new Date().toISOString() }, { onConflict: 'key' })
  if (error) throw error
}

export async function openShiftSession(input: { employeeId: string; employeeName: string; deviceId: string; schedule: ShiftSchedule }) {
  if (!hasSupabaseConfig) throw new Error('Clock-in requires an online Supabase connection.')
  await closeOpenShiftSession(input.deviceId)
  const window = resolveShiftWindow(new Date(), input.schedule)
  const payload = { shift_id: window.shiftId, business_date: window.businessDate, shift_type: window.shiftType, employee_id: input.employeeId, employee_name: input.employeeName, device_id: input.deviceId, clocked_in_at: new Date().toISOString(), status: 'OPEN', schedule_snapshot: input.schedule }
  const { data, error } = await requireSupabase().from('shift_sessions').insert(payload).select('*').single()
  if (error) throw error
  return mapSession(data as Record<string, unknown>)
}

export async function closeOpenShiftSession(deviceId: string) {
  if (!hasSupabaseConfig) return
  const { error } = await requireSupabase().from('shift_sessions').update({ status: 'CLOSED', clocked_out_at: new Date().toISOString() }).eq('device_id', deviceId).eq('status', 'OPEN')
  if (error) throw error
}

export async function fetchOpenShiftSession(deviceId: string) {
  if (!hasSupabaseConfig) return null
  const { data, error } = await requireSupabase().from('shift_sessions').select('*').eq('device_id', deviceId).eq('status', 'OPEN').order('clocked_in_at', { ascending: false }).limit(1).maybeSingle()
  if (error) throw error
  return data ? mapSession(data as Record<string, unknown>) : null
}

function mapSession(row: Record<string, unknown>): ShiftSession {
  return { id: String(row.id), shiftId: String(row.shift_id), businessDate: String(row.business_date), shiftType: String(row.shift_type) as ShiftType, employeeId: String(row.employee_id), employeeName: String(row.employee_name), deviceId: String(row.device_id), clockedInAt: String(row.clocked_in_at), clockedOutAt: row.clocked_out_at ? String(row.clocked_out_at) : null, status: String(row.status) as ShiftSession['status'], scheduleSnapshot: row.schedule_snapshot as ShiftSchedule }
}

export type ShiftReport = { sessions: ShiftSession[]; orders: OrderRecord[]; payments: ShiftPaymentEvent[]; expenses: CashMovement[]; adjustments: ShiftAdjustment[]; audit: ShiftAudit | null }
export async function fetchShiftReport(businessDate: string, shiftType: ShiftType): Promise<ShiftReport> {
  if (!hasSupabaseConfig) return { sessions: [], orders: [], payments: [], expenses: [], adjustments: [], audit: null }
  const shiftId = `${businessDate}-${shiftType.toLowerCase()}`
  const supabase = requireSupabase()
  const [sessionsResult, ordersResult, paymentsResult, expensesResult, adjustmentsResult, auditResult] = await Promise.all([
    supabase.from('shift_sessions').select('*').eq('shift_id', shiftId).order('clocked_in_at'),
    supabase.from('orders').select('device_order_id,device_id,payment_method,payment_reference,cash_amount,gcash_amount,payment_status,workflow_status,subtotal,tax,total,created_at,items_json,shift_id,shift_session_id').eq('shift_id', shiftId).order('created_at'),
    supabase.from('shift_payment_events').select('*').or(`origin_shift_id.eq.${shiftId},collection_shift_id.eq.${shiftId}`).order('collected_at'),
    supabase.from('cash_movements').select('*').eq('shift_id', shiftId).eq('movement_kind', 'PAY_OUT').order('created_at'),
    supabase.from('shift_adjustments').select('*').eq('shift_id', shiftId).order('requested_at'),
    supabase.from('shift_audits').select('*').eq('shift_id', shiftId).maybeSingle(),
  ])
  const failed = [sessionsResult, ordersResult, paymentsResult, expensesResult, adjustmentsResult, auditResult].find((item) => item.error)
  if (failed?.error) throw failed.error
  const orders = (ordersResult.data ?? []).map((row) => ({
    deviceOrderId: String(row.device_order_id), deviceId: String(row.device_id), paymentMethod: String(row.payment_method), paymentReference: row.payment_reference ? String(row.payment_reference) : null,
    cashAmount: row.cash_amount == null ? null : Number(row.cash_amount), gcashAmount: row.gcash_amount == null ? null : Number(row.gcash_amount), paymentStatus: String(row.payment_status ?? ''), workflowStatus: String(row.workflow_status ?? ''),
    subtotal: Number(row.subtotal ?? 0), tax: Number(row.tax ?? 0), total: Number(row.total ?? 0), createdAt: String(row.created_at), items: Array.isArray(row.items_json) ? row.items_json as OrderRecord['items'] : [], shiftId: String(row.shift_id), shiftSessionId: row.shift_session_id ? String(row.shift_session_id) : null,
  }))
  const rawPayments = (paymentsResult.data ?? []).map((row) => ({ id: String(row.id), orderId: String(row.order_id), originShiftId: row.origin_shift_id ? String(row.origin_shift_id) : null, collectionShiftId: String(row.collection_shift_id), shiftSessionId: String(row.shift_session_id), method: String(row.method) as ShiftPaymentEvent['method'], amount: Number(row.amount), collectedBy: String(row.collected_by), collectedAt: String(row.collected_at) }))
  // A collection is auditable only while its source order exists. This prevents stale
  // payment events from inflating cash after an order is removed or replaced.
  let payments = rawPayments
  if (rawPayments.length > 0) {
    const { data: paymentOrders, error: paymentOrdersError } = await supabase.from('orders').select('device_order_id').in('device_order_id', [...new Set(rawPayments.map((item) => item.orderId))])
    if (paymentOrdersError) throw paymentOrdersError
    const existingOrderIds = new Set((paymentOrders ?? []).map((row) => String(row.device_order_id)))
    payments = rawPayments.filter((item) => existingOrderIds.has(item.orderId))
  }
  const expenses = (expensesResult.data ?? []).map((row) => ({ id: String(row.id), accountId: String(row.account_id), accountType: String(row.account_type) as CashMovement['accountType'], sourceAccountId: row.source_account_id ? String(row.source_account_id) : null, destinationAccountId: null, movementKind: 'PAY_OUT' as const, reasonCategory: String(row.reason_category), amount: Number(row.amount), note: row.note ? String(row.note) : null, relatedBillId: null, createdBy: String(row.created_by), createdAtEpochMillis: Date.parse(String(row.created_at)), shiftId: String(row.shift_id), shiftSessionId: row.shift_session_id ? String(row.shift_session_id) : null }))
  const adjustments = (adjustmentsResult.data ?? []).map(mapAdjustment)
  return { sessions: (sessionsResult.data ?? []).map((row) => mapSession(row as Record<string, unknown>)), orders, payments, expenses, adjustments, audit: auditResult.data ? mapShiftAudit(auditResult.data as Record<string, unknown>) : null }
}

function mapShiftAudit(row: Record<string, unknown>): ShiftAudit {
  return { id: String(row.id), shiftId: String(row.shift_id), businessDate: String(row.business_date), shiftType: String(row.shift_type) as ShiftType, expectedCash: Number(row.expected_cash), countedCash: Number(row.counted_cash), cashVariance: Number(row.cash_variance), expectedGcash: Number(row.expected_gcash), verifiedGcash: Number(row.verified_gcash), gcashVariance: Number(row.gcash_variance), notes: row.notes ? String(row.notes) : null, varianceReason: row.variance_reason ? String(row.variance_reason) : null, status: 'AUDITED', auditedBy: String(row.audited_by), auditedAt: String(row.audited_at), safeMovementId: String(row.safe_movement_id) }
}

export async function approveShiftAudit(input: { businessDate: string; shiftType: ShiftType; countedCash: number; verifiedGcash: number; notes: string; varianceReason: string; auditedBy: string }) {
  if (!hasSupabaseConfig) throw new Error('Shift audit approval requires Supabase.')
  const { data, error } = await requireSupabase().rpc('approve_shift_audit', {
    p_shift_id: `${input.businessDate}-${input.shiftType.toLowerCase()}`,
    p_business_date: input.businessDate, p_shift_type: input.shiftType,
    p_counted_cash: input.countedCash, p_verified_gcash: input.verifiedGcash,
    p_notes: input.notes || null, p_variance_reason: input.varianceReason || null,
    p_audited_by: input.auditedBy,
  })
  if (error) throw error
  return mapShiftAudit(data as Record<string, unknown>)
}

export function calculateAuditVariance(expectedCash: number, countedCash: number, expectedGcash: number, verifiedGcash: number) {
  return { cashVariance: countedCash - expectedCash, gcashVariance: verifiedGcash - expectedGcash }
}

function mapAdjustment(row: Record<string, unknown>): ShiftAdjustment {
  return { id: String(row.id), shiftId: String(row.shift_id), shiftSessionId: row.shift_session_id ? String(row.shift_session_id) : null, account: String(row.account) as ShiftAdjustment['account'], direction: String(row.direction) as ShiftAdjustment['direction'], amount: Number(row.amount), reason: String(row.reason), requestedBy: String(row.requested_by), requestedAt: String(row.requested_at), status: String(row.status) as ShiftAdjustment['status'], approvedBy: row.approved_by ? String(row.approved_by) : null, approvedAt: row.approved_at ? String(row.approved_at) : null }
}

export async function createShiftAdjustment(input: Omit<ShiftAdjustment, 'id' | 'requestedAt' | 'status' | 'approvedBy' | 'approvedAt'>, approveImmediately = false) {
  if (!hasSupabaseConfig) throw new Error('Adjustments require Supabase.')
  const now = new Date().toISOString(); const id = `shift-adjustment-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
  const payload = { id, shift_id: input.shiftId, shift_session_id: input.shiftSessionId, account: input.account, direction: input.direction, amount: input.amount, reason: input.reason, requested_by: input.requestedBy, requested_at: now, status: approveImmediately ? 'APPROVED' : 'PENDING', approved_by: approveImmediately ? input.requestedBy : null, approved_at: approveImmediately ? now : null }
  const { data, error } = await requireSupabase().from('shift_adjustments').insert(payload).select('*').single(); if (error) throw error
  return mapAdjustment(data as Record<string, unknown>)
}

export async function fetchShiftAdjustments(shiftId: string) {
  if (!hasSupabaseConfig) return []
  const { data, error } = await requireSupabase().from('shift_adjustments').select('*').eq('shift_id', shiftId).order('requested_at')
  if (error) throw error
  return (data ?? []).map((row) => mapAdjustment(row as Record<string, unknown>))
}

export async function fetchPendingShiftAdjustments() {
  if (!hasSupabaseConfig) return []
  const { data, error } = await requireSupabase().from('shift_adjustments').select('*').eq('status', 'PENDING').order('requested_at').limit(50)
  if (error) throw error
  return (data ?? []).map((row) => mapAdjustment(row as Record<string, unknown>))
}

export function subscribeToShiftAdjustments(onChange: () => void) {
  if (!hasSupabaseConfig) return () => {}
  const supabase = requireSupabase()
  const channel = supabase.channel(`shift-adjustments-admin-${Date.now()}`).on('postgres_changes', { event: '*', schema: 'public', table: 'shift_adjustments' }, onChange).subscribe()
  return () => { void supabase.removeChannel(channel) }
}

export async function decideShiftAdjustment(id: string, decision: 'APPROVED' | 'REJECTED', approvedBy = 'Admin Web') {
  const { data, error } = await requireSupabase().from('shift_adjustments').update({ status: decision, approved_by: approvedBy, approved_at: new Date().toISOString() }).eq('id', id).eq('status', 'PENDING').select('*').single()
  if (error) throw error
  return mapAdjustment(data as Record<string, unknown>)
}
export function calculateShiftTotals(report: ShiftReport) {
  const shiftId = report.sessions[0]?.shiftId ?? report.orders[0]?.shiftId ?? report.payments[0]?.collectionShiftId ?? ''
  const collectedHere = report.payments.filter((item) => !shiftId || item.collectionShiftId === shiftId)
  const grossCash = collectedHere.filter((item) => item.method === 'CASH').reduce((sum, item) => sum + item.amount, 0)
  const grossGcash = collectedHere.filter((item) => item.method === 'GCASH').reduce((sum, item) => sum + item.amount, 0)
  // Sales in a shift report are collections received during that shift. An order
  // may have originated in an earlier shift, so summing only this shift's orders
  // can disagree with the cash and GCash actually collected at the register.
  const totalSales = grossCash + grossGcash
  const cashExpenses = report.expenses.filter((item) => item.accountType !== 'BANK').reduce((sum, item) => sum + item.amount, 0)
  const gcashExpenses = report.expenses.filter((item) => item.accountType === 'BANK').reduce((sum, item) => sum + item.amount, 0)
  const approved = report.adjustments.filter((item) => item.status === 'APPROVED')
  const adjustment = (account: 'CASH' | 'GCASH') => approved.filter((item) => item.account === account).reduce((sum, item) => sum + (item.direction === 'ADD' ? item.amount : -item.amount), 0)
  const totalUnpaid = report.orders.reduce((sum, item) => sum + Math.max(item.total - report.payments.filter((payment) => payment.orderId === item.deviceOrderId).reduce((paid, payment) => paid + payment.amount, 0), 0), 0)
  return { totalSales, grossCash, cashExpenses, netCash: grossCash - cashExpenses + adjustment('CASH'), grossGcash, gcashExpenses, netGcash: grossGcash - gcashExpenses + adjustment('GCASH'), totalUnpaid }
}
