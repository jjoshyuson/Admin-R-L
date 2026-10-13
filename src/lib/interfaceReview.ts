/** Compact elapsed times for kitchen queues; invalid data must remain explicit. */
export function formatOrderAge(timestamp: number, now = Date.now()) {
  if (!Number.isFinite(timestamp)) return 'Time unavailable'
  const minutes = Math.max(0, Math.floor((now - timestamp) / 60_000))
  if (minutes < 1) return 'Just now'
  if (minutes < 60) return `${minutes} min ago`
  if (minutes < 1440) {
    const remainder = minutes % 60
    return `${Math.floor(minutes / 60)}h${remainder ? ` ${remainder}m` : ''} ago`
  }
  const days = Math.floor(minutes / 1440)
  return `${days} ${days === 1 ? 'day' : 'days'} ago`
}

/** The restaurant's service date is in the Philippines, regardless of device zone. */
export function isEarlierServiceDay(timestamp: number, now = Date.now()) {
  if (!Number.isFinite(timestamp)) return false
  const date = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Manila', year: 'numeric', month: '2-digit', day: '2-digit' })
  return date.format(timestamp) < date.format(now)
}

export function productMatchesSearch(product: { name: string; categoryName: string }, query: string) {
  const haystack = `${product.name} ${product.categoryName}`.toLocaleLowerCase()
  return query.trim().toLocaleLowerCase().split(/\s+/).every((term) => haystack.includes(term))
}
