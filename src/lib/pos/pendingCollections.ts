export function mergePendingCollections<T extends { id: string }>(existing: T[], next: T): T[] {
  return existing.some(item => item.id === next.id) ? existing : [...existing, next]
}
/** Legacy entries lack operation IDs; their cumulative received amount provides a stable replay identity. */
export function identifyCollection<T extends { id?: string; amount: number }>(payment: T, orderId: string, received: number): T & { id: string } {
  return { ...payment, id: payment.id ?? `${orderId}-received-${Math.round(received * 100)}` }
}

export function acknowledgeCollection<T extends { id: string }>(collections: T[], collectionId: string): T[] {
  return collections.filter(collection => collection.id !== collectionId)
}
