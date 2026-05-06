import { useAdminDataContext } from './AdminDataContext'

export function useOrdersSync() {
  const {
    orders,
    voids,
    orderHistory,
    syncItems,
    loading,
    error,
    lastRefreshedAt,
    refresh,
    voidOrder,
  } = useAdminDataContext()
  return {
    orders,
    voids,
    orderHistory,
    syncItems,
    loading,
    error,
    lastRefreshedAt,
    refresh,
    voidOrder,
  }
}
