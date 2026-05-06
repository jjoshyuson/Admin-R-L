import { useAdminDataContext } from './AdminDataContext'

export function useDashboardData() {
  const { dashboard, loading, error, refresh } = useAdminDataContext()
  return { dashboard, loading, error, refresh }
}
