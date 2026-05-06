import { useAdminDataContext } from './AdminDataContext'

export function useFinanceData() {
  const {
    cashMovements,
    cashAccounts,
    payables,
    billViews,
    profitData,
    loading,
    error,
    refresh,
    transferCash,
    adjustCash,
    cashPull,
    savePayable,
    resetOperationalData,
    zeroSellableStock,
  } = useAdminDataContext()
  return {
    cashMovements,
    cashAccounts,
    payables,
    billViews,
    profitData,
    loading,
    error,
    refresh,
    transferCash,
    adjustCash,
    cashPull,
    savePayable,
    resetOperationalData,
    zeroSellableStock,
  }
}
