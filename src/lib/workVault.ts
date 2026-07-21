export type VaultTransactionType = 'shift' | 'advance' | 'payment' | 'adjustment'

export type VaultTransaction = {
  id: string
  employeeId: string
  date: string
  type: VaultTransactionType
  amount: number
  shiftId: string | null
  note: string
  resultingBalance: number
  createdAt: string
}

export type WorkVaultShift = {
  id: string
  businessDate: string
  employeeId: string
  employeeName: string
  role: string
  dailyRate: number
  shiftLength: 'full'
  overtimeHours: number
  notes: string
  hours: string
  amount: number
  confirmedAt: string
  attendanceStatus: 'scheduled' | 'attended'
  attendedAt: string | null
}

export function calculateShiftAmount(dailyRate: number, _shiftLength: 'full' | 'half', overtimeHours: number) {
  const base = Math.max(0, dailyRate)
  const overtime = Math.max(0, overtimeHours) * (Math.max(0, dailyRate) / 8)
  return Math.round((base + overtime) * 100) / 100
}

export function employeeBalance(transactions: VaultTransaction[], employeeId: string) {
  return Math.round(transactions.filter((item) => item.employeeId === employeeId).reduce((sum, item) => sum + item.amount, 0) * 100) / 100
}

export function appendTransaction(
  transactions: VaultTransaction[],
  transaction: Omit<VaultTransaction, 'resultingBalance'>,
) {
  const resultingBalance = Math.round((employeeBalance(transactions, transaction.employeeId) + transaction.amount) * 100) / 100
  return [...transactions, { ...transaction, resultingBalance }]
}

export function hasEmployeeOnDate(shifts: WorkVaultShift[], employeeId: string, businessDate: string) {
  return shifts.some((shift) => shift.employeeId === employeeId && shift.businessDate === businessDate)
}
