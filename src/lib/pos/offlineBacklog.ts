type BacklogPending = { id: string; order: { id: string }; orderPending: boolean; paymentPending: boolean }
export function clearBacklogPending<T extends BacklogPending>(entries: T[], orderId: string, kind: 'order' | 'payment'): T[] {
  return entries.map(entry => entry.id === orderId ? { ...entry, orderPending: kind === 'order' ? false : entry.orderPending, paymentPending: kind === 'payment' ? false : entry.paymentPending } : entry).filter(entry => entry.orderPending || entry.paymentPending)
}
export function partitionBacklogForReset<T extends { queuedAt: string }>(entries: T[], resetAt: string | null) {
  if (!resetAt) return { active: entries, quarantined: [] as T[] }
  const cutoff = Date.parse(resetAt)
  if (!Number.isFinite(cutoff)) throw new Error('Invalid operational reset timestamp.')
  const active: T[] = [], quarantined: T[] = []
  for (const entry of entries) (Date.parse(entry.queuedAt) > cutoff ? active : quarantined).push(entry)
  return { active, quarantined }
}
