export type SyncState = 'LOCAL_ONLY' | 'SYNCING' | 'SYNCED' | 'PENDING'

export type ProductStatus = 'AVAILABLE' | 'UNAVAILABLE' | 'HIDDEN'
export type FinanceAccountType = 'TABLET_DRAWER' | 'SAFE' | 'BANK'
export type CashMovementKind =
  | 'OPENING_FLOAT'
  | 'PAY_IN'
  | 'PAY_OUT'
  | 'TRANSFER_IN'
  | 'TRANSFER_OUT'
  | 'ADJUSTMENT_PLUS'
  | 'ADJUSTMENT_MINUS'
  | 'BILL_PAYMENT'
export type CashFlowClass = 'OPERATING' | 'FINANCING' | 'INVESTING'
export type PayableStatus = 'OPEN' | 'PAID' | 'CANCELLED'
export type RecipeType = 'MENU_ITEM' | 'PREP'
export type InventoryFrequency = 'Daily' | 'Weekly' | 'Monthly'
export type InventoryStatus = 'healthy' | 'low' | 'critical'

export type SyncMeta = {
  deviceId: string
  updatedAt: string
  version: number
  syncState: SyncState
}

export type OrderItemRecord = {
  productId?: string
  name: string
  serviceMode?: string
  isHalfOrder?: boolean
  quantity: number
  price?: number
  lineTotal: number
  kitchenStatus?: string
  isChecked?: boolean
}

export type OrderRecord = {
  deviceOrderId: string
  deviceId: string
  serviceMode?: string
  paymentMethod: string
  paymentReference: string | null
  cashAmount: number | null
  gcashAmount: number | null
  gcashReferenceLast4?: string | null
  paymentStatus?: string
  workflowStatus?: string
  orderNote?: string | null
  subtotal: number
  tax: number
  total: number
  createdAt: string
  items: OrderItemRecord[]
}

export type OrderVoidRecord = {
  deviceOrderId: string
  voidReason: string
  voidedBy: string
  voidedAt: string
}

export type OrderEditRequestStatus = 'pending' | 'approved' | 'cancelled' | 'expired'

export type OrderEditRequestRecord = {
  id: string
  deviceOrderId: string
  displayOrderId: string
  deviceId: string
  requestedBy: string
  requestedAt: string
  status: OrderEditRequestStatus
  approvedBy: string | null
  approvedAt: string | null
  cancelledAt: string | null
}

export type MenuCategory = {
  id: string
  name: string
  sortOrder: number
  isActive: boolean
}

export type MenuProduct = {
  id: string
  categoryId: string
  name: string
  price: number
  halfOrderPrice: number | null
  status: ProductStatus
  imagePath: string | null
  stockCount: number
  isLowStock: boolean
  isActive: boolean
}

export type Recipe = {
  id: string
  recipeName: string
  recipeType: RecipeType
  menuCategory: string
  servings: number | null
  pricePerServing: number | null
  yieldQuantity: number | null
  yieldUnit: string | null
  taxRatePercent: number
}

export type RecipeIngredient = {
  id: string
  recipeId: string
  ingredientRefId: string
  ingredientRefType: string
  ingredientName: string
  purchaseQuantity: number | null
  purchaseUnit: string
  recipeQuantity: number
  recipeUnit: string
  sortOrder: number
}

export type IngredientPriceLog = {
  ingredientId: string
  ingredientName: string
  businessDate: string
  price: number
  unit: string
  sourceLogId: string | null
  sourceLogTitle: string | null
}

export type IngredientCategory = {
  id: string
  name: string
  sortOrder: number
  isActive: boolean
}

export type IngredientRegistryItem = {
  id: string
  name: string
  categoryId: string | null
  defaultUnit: string
  isActive: boolean
}

export type AdminSetting = {
  key: string
  value: Record<string, unknown>
  updatedAt: string
}

export type DailyAccountingRecord = {
  businessDate: string
  calculatedAt: string
  totalSales: number
  netSales: number
  totalCost: number
  grossProfit: number
  netProfit: number
  orderCount: number
  sourceLabel: string
  missingRecipeCount: number
  hasFallbackPricing: boolean
  hasConversionIssue: boolean
}

export type InventoryItem = {
  id: string
  name: string
  category: string
  unit: string
  onHand: number
  reorderLevel: number
  countingEnabled: boolean
  countingFrequency: InventoryFrequency
  overdue: boolean
  updatedAt: string
}

export type InventoryCountRecord = {
  id: string
  itemId: string
  countedQuantity: number
  countedAt: string
  countedBy: string
  note: string | null
}

export type CashMovement = {
  id: string
  accountId: string
  accountType: FinanceAccountType
  sourceAccountId: string | null
  destinationAccountId: string | null
  movementKind: CashMovementKind
  reasonCategory: string
  amount: number
  note: string | null
  relatedBillId: string | null
  createdBy: string
  createdAtEpochMillis: number
}

export type Payable = {
  id: string
  title: string
  vendorName: string
  category: string
  cashFlowClass: CashFlowClass
  amount: number
  dueDateEpochMillis: number
  status: PayableStatus
  paymentSource: string | null
  paidAtEpochMillis: number | null
  note: string | null
  createdBy: string
  createdAtEpochMillis: number
}

export type DashboardMetric = {
  label: string
  value: string
  hint: string
  hintTone: 'positive' | 'muted'
}

export type DashboardPoint = {
  day: string
  value: number
}

export type PaymentBreakdown = {
  cash: number
  gcash: number
}

export type DeviceSalesBreakdown = {
  tablet1: number
  tablet2: number
}

export type DeviceStatus = {
  name: string
  syncTime: string
  pendingSales: string
  health: string
}

export type DashboardActivity = {
  actor: string
  detail: string
  ago: string
}

export type ProductRank = {
  rank: number
  name: string
  revenue: string
  quantity: string
  secondaryRevenue: string
  secondaryQuantity: string
}

export type DashboardAlert = {
  title: string
  action: string
  icon: string
}

export type DashboardSnapshot = {
  metrics: DashboardMetric[]
  salesTrendPrimary: DashboardPoint[]
  salesTrendSecondary: DashboardPoint[]
  paymentBreakdown: PaymentBreakdown
  deviceBreakdown: DeviceSalesBreakdown
  devices: DeviceStatus[]
  alerts: DashboardAlert[]
  topProducts: ProductRank[]
  activity: DashboardActivity[]
  syncBannerTitle: string
  syncBannerSubtitle: string
  financialMetrics: Array<{ label: string; value: string; tone?: 'default' | 'danger' }>
}

export type OrderHistoryView = {
  id: string
  itemCount: number
  total: string
  table: string
  payment: string
  displayStatus: string
  device: string
  time: string
  status: 'completed' | 'voided' | 'synced'
}

export type RecipeView = {
  id: string
  name: string
  category: string
  ingredients: number
  servings: number
  totalCost: string
  perServing: string
  image: string
  status: 'synced'
}

export type LogRecordView = {
  id: string
  title: string
  detail: string
  relativeDate: string
  fullDate: string
  status: 'completed' | 'voided' | 'synced'
}

export type CashAccountView = {
  id: string
  name: string
  type: 'safe' | 'tablet' | 'bank'
  currentBalance: number
  expectedBalance: number
  salesToday: number
  lastActivityNote: string
  lastActivityAt: string
}

export type BillRecordView = {
  id: string
  vendor: string
  dueDate: string
  amount: number
  paid: boolean
}

export type ProfitDataView = {
  revenue: number
  cogs: number
}

export type SyncListItem = {
  title: string
  detail: string
  relativeDate: string
  fullDate: string
  status: 'synced' | 'completed'
}

export type VoidOrderInput = {
  deviceOrderId: string
  voidReason?: string
  voidedBy?: string
}

export type SaveMenuCatalogInput = {
  categories: MenuCategory[]
  products: MenuProduct[]
}

export type SaveRecipeSetInput = {
  recipes: Recipe[]
  ingredients: RecipeIngredient[]
}

export type SaveIngredientPriceLogInput = {
  logs: IngredientPriceLog[]
}

export type SaveIngredientRegistryInput = {
  categories: IngredientCategory[]
  ingredients: IngredientRegistryItem[]
}

export type TransferCashInput = {
  fromAccountId: string
  toAccountId: string
  amount: number
  note: string
  createdBy: string
}

export type AdjustCashInput = {
  accountId: string
  adjustmentType: 'add' | 'remove'
  amount: number
  note: string
  createdBy: string
}

export type CashPullInput = {
  fromAccountId: string
  amount: number
  note: string
  createdBy: string
}

export type SavePayableInput = {
  payable: Payable
}

export type SeedTroubleshootingDataInput = {
  orders: OrderRecord[]
  voids?: OrderVoidRecord[]
  ingredientLogs: IngredientPriceLog[]
  recipes: Recipe[]
  recipeIngredients: RecipeIngredient[]
  cashMovements: CashMovement[]
  payables: Payable[]
  calculateBusinessDate?: string | null
}

export type ResetOperationalDataInput = {
  resetMenuToDefaults?: boolean
  clearMenuCatalog?: boolean
}
