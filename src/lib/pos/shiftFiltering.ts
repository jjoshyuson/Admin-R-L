export type ShiftScopedPayment = {
  shiftId?: string | null
  shiftSessionId?: string | null
  createdAt: string
}

export type ActiveShiftIdentity = {
  id: string
  shiftId: string
  clockedInAt: string
  clockedOutAt: string | null
}

export function paymentBelongsToActiveShift(payment: ShiftScopedPayment, shift: ActiveShiftIdentity, now = Date.now()) {
  // Explicit metadata is authoritative. Never use a timestamp fallback after
  // an explicit mismatch, because that mixes First and Second Shift records.
  if (payment.shiftId) return payment.shiftId === shift.shiftId
  if (payment.shiftSessionId) return payment.shiftSessionId === shift.id

  const created = Date.parse(payment.createdAt)
  const opened = Date.parse(shift.clockedInAt)
  const closed = shift.clockedOutAt ? Date.parse(shift.clockedOutAt) : now
  return Number.isFinite(created) && Number.isFinite(opened) && created >= opened && created <= closed
}
