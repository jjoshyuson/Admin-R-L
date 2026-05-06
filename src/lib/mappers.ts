import type {
  BillRecordView,
  CashAccountView,
  CashMovement,
  DailyAccountingRecord,
  DashboardAlert,
  DashboardMetric,
  DashboardPoint,
  DashboardSnapshot,
  DashboardActivity,
  DeviceStatus,
  DeviceSalesBreakdown,
  IngredientPriceLog,
  LogRecordView,
  MenuProduct,
  OrderHistoryView,
  OrderItemRecord,
  OrderRecord,
  OrderVoidRecord,
  Payable,
  PaymentBreakdown,
  ProductRank,
  ProfitDataView,
  Recipe,
  RecipeIngredient,
  RecipeView,
  SyncListItem,
} from './adminTypes'

const peso = new Intl.NumberFormat('en-PH', {
  style: 'currency',
  currency: 'PHP',
  maximumFractionDigits: 2,
})

const compactPeso = new Intl.NumberFormat('en-PH', {
  style: 'currency',
  currency: 'PHP',
  notation: 'compact',
  maximumFractionDigits: 1,
})

export function formatPhp(value: number) {
  return peso.format(Number.isFinite(value) ? value : 0)
}

export function formatCompactPhp(value: number) {
  return compactPeso.format(Number.isFinite(value) ? value : 0)
}

export function normalizeProductStatus(value: string | null | undefined): MenuProduct['status'] {
  switch ((value ?? '').toUpperCase()) {
    case 'UNAVAILABLE':
      return 'UNAVAILABLE'
    case 'HIDDEN':
      return 'HIDDEN'
    default:
      return 'AVAILABLE'
  }
}

export function safeNumber(value: unknown, fallback = 0) {
  const next = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(next) ? next : fallback
}

export function parseOrderItems(rawItems: unknown): OrderItemRecord[] {
  if (!Array.isArray(rawItems)) return []
  return rawItems
    .map((raw) => {
      const row = typeof raw === 'object' && raw !== null ? raw as Record<string, unknown> : null
      if (!row) return null
      return {
        name: String(row.name ?? '').trim(),
        quantity: safeNumber(row.quantity),
        lineTotal: safeNumber(row.lineTotal ?? row.line_total),
      }
    })
    .filter((item): item is OrderItemRecord => Boolean(item && item.name))
}

export function orderSortTimestamp(order: OrderRecord) {
  const ts = Date.parse(order.createdAt)
  return Number.isFinite(ts) ? ts : 0
}

export function normalizeAccountId(rawValue: string | null | undefined) {
  const normalized = (rawValue ?? '')
    .trim()
    .toLowerCase()
    .replaceAll('_', '-')
    .replaceAll(' ', '-')
  switch (normalized) {
    case 'tablet1':
    case 'tablet-a':
    case 'tableta':
      return 'tablet-1'
    case 'tablet2':
    case 'tablet-b':
    case 'tabletb':
      return 'tablet-2'
    case 'safe':
    case 'cash-safe':
    case 'mainsafe':
      return 'main-safe'
    case 'bank':
    case 'bank-deposit':
    case 'gcash':
    case 'bank/gcash':
      return 'bank-gcash'
    default:
      return normalized || 'tablet-1'
  }
}

export function accountLabel(accountId: string) {
  switch (normalizeAccountId(accountId)) {
    case 'tablet-1':
      return 'Tablet 1'
    case 'tablet-2':
      return 'Tablet 2'
    case 'main-safe':
      return 'Main Safe'
    case 'bank-gcash':
      return 'Bank/GCash'
    default:
      return accountId
  }
}

export function movementSignedAmount(movement: CashMovement) {
  switch (movement.movementKind) {
    case 'OPENING_FLOAT':
    case 'PAY_IN':
    case 'TRANSFER_IN':
    case 'ADJUSTMENT_PLUS':
      return movement.amount
    default:
      return -movement.amount
  }
}

export function buildOrderHistoryViews(orders: OrderRecord[], voids: OrderVoidRecord[]): OrderHistoryView[] {
  const voidById = new Map(voids.map((item) => [item.deviceOrderId, item]))
  return [...orders]
    .sort((left, right) => orderSortTimestamp(right) - orderSortTimestamp(left))
    .map((order) => {
      const voidRecord = voidById.get(order.deviceOrderId)
      return {
        id: order.deviceOrderId,
        itemCount: order.items.length,
        total: formatPhp(order.total),
        table: order.deviceOrderId.slice(-4).padStart(4, '0'),
        payment: order.paymentMethod || 'Unknown',
        device: accountLabel(order.deviceId),
        time: new Date(order.createdAt).toLocaleString(),
        status: voidRecord ? 'voided' : 'synced',
      }
    })
}

export function buildRecipeViews(
  recipes: Recipe[],
  recipeIngredients: RecipeIngredient[],
  products: MenuProduct[],
): RecipeView[] {
  const ingredientsByRecipe = recipeIngredients.reduce<Map<string, RecipeIngredient[]>>((acc, ingredient) => {
    const current = acc.get(ingredient.recipeId) ?? []
    current.push(ingredient)
    acc.set(ingredient.recipeId, current)
    return acc
  }, new Map())
  const productByName = new Map(products.map((product) => [product.name.trim().toLowerCase(), product]))
  return recipes.map((recipe) => {
    const lines = ingredientsByRecipe.get(recipe.id) ?? []
    const totalCost = lines.reduce((sum, line) => sum + safeNumber(line.purchaseQuantity) * line.recipeQuantity, 0)
    const product = productByName.get(recipe.recipeName.trim().toLowerCase())
    return {
      id: recipe.id,
      name: recipe.recipeName,
      category: recipe.menuCategory || 'Uncategorized',
      ingredients: lines.length,
      servings: recipe.servings ?? 1,
      totalCost: formatPhp(totalCost),
      perServing: formatPhp(recipe.pricePerServing ?? 0),
      image: product?.imagePath ?? '',
      status: 'synced',
    }
  })
}

export function buildLogViews(logs: IngredientPriceLog[]): LogRecordView[] {
  const groups = logs.reduce<Map<string, IngredientPriceLog[]>>((acc, log) => {
    const current = acc.get(log.businessDate) ?? []
    current.push(log)
    acc.set(log.businessDate, current)
    return acc
  }, new Map())
  return [...groups.entries()]
    .sort(([left], [right]) => Date.parse(right) - Date.parse(left))
    .map(([businessDate, entries]) => ({
      id: businessDate,
      title: `Daily Log ${businessDate}`,
      detail: `${entries.length} ingredient price entries`,
      relativeDate: new Date(businessDate).toLocaleDateString(),
      fullDate: businessDate,
      status: 'synced',
    }))
}

function groupOrdersByDay(orders: OrderRecord[]) {
  const totals = new Map<string, number>()
  for (const order of orders) {
    const ts = orderSortTimestamp(order)
    if (!ts) continue
    const key = new Date(ts).toISOString().slice(0, 10)
    totals.set(key, (totals.get(key) ?? 0) + order.total)
  }
  return totals
}

function lastSevenDayKeys(now = Date.now()) {
  return Array.from({ length: 7 }, (_, index) => {
    const date = new Date(now - (6 - index) * 24 * 60 * 60 * 1000)
    return date.toISOString().slice(0, 10)
  })
}

export function buildDashboardSnapshot(
  orders: OrderRecord[],
  voids: OrderVoidRecord[],
  accounting: DailyAccountingRecord[],
  products: MenuProduct[],
  logs: IngredientPriceLog[],
  movements: CashMovement[],
): DashboardSnapshot {
  const voidedIds = new Set(voids.map((item) => item.deviceOrderId))
  const activeOrders = orders.filter((order) => !voidedIds.has(order.deviceOrderId))
  const salesByDay = groupOrdersByDay(activeOrders)
  const trendKeys = lastSevenDayKeys()
  const salesTrendPrimary: DashboardPoint[] = trendKeys.map((key) => ({
    day: new Date(key).toLocaleDateString('en-US', { weekday: 'short' }),
    value: salesByDay.get(key) ?? 0,
  }))
  const salesTrendSecondary: DashboardPoint[] = trendKeys.map((key) => ({
    day: new Date(key).toLocaleDateString('en-US', { weekday: 'short' }),
    value: (salesByDay.get(key) ?? 0) * 0.75,
  }))

  const totalSales = activeOrders.reduce((sum, order) => sum + order.total, 0)
  const cashSales = activeOrders.reduce((sum, order) => sum + (order.cashAmount ?? 0), 0)
  const gcashSales = activeOrders.reduce((sum, order) => sum + (order.gcashAmount ?? 0), 0)
  const latestAccounting = [...accounting].sort((left, right) => Date.parse(right.businessDate) - Date.parse(left.businessDate))[0]
  const today = new Date().toISOString().slice(0, 10)
  const todayOrders = activeOrders.filter((order) => order.createdAt.startsWith(today))

  const metrics: DashboardMetric[] = [
    {
      label: "Today's Sales",
      value: formatPhp(todayOrders.reduce((sum, order) => sum + order.total, 0)),
      hint: 'Today from synced orders',
      hintTone: 'positive',
    },
    {
      label: "Today's Orders",
      value: String(todayOrders.length),
      hint: 'Non-voided orders in selected period',
      hintTone: 'positive',
    },
    {
      label: 'Latest Food Cost',
      value: latestAccounting ? formatPhp(latestAccounting.totalCost) : 'Not calculated',
      hint: latestAccounting?.businessDate ?? 'Run Finance > Calculate Day',
      hintTone: 'muted',
    },
    {
      label: 'Latest Gross Profit',
      value: latestAccounting ? formatPhp(latestAccounting.grossProfit) : 'Not calculated',
      hint: latestAccounting?.businessDate ?? 'Run Finance > Calculate Day',
      hintTone: 'muted',
    },
  ]

  const paymentBreakdown: PaymentBreakdown = { cash: cashSales, gcash: gcashSales }
  const deviceBreakdown: DeviceSalesBreakdown = {
    tablet1: activeOrders.filter((order) => normalizeAccountId(order.deviceId) === 'tablet-1').reduce((sum, order) => sum + order.total, 0),
    tablet2: activeOrders.filter((order) => normalizeAccountId(order.deviceId) === 'tablet-2').reduce((sum, order) => sum + order.total, 0),
  }

  const devices: DeviceStatus[] = ['tablet-1', 'tablet-2'].map((deviceId) => {
    const matchingOrders = activeOrders.filter((order) => normalizeAccountId(order.deviceId) === deviceId)
    const latestOrder = [...matchingOrders].sort((left, right) => orderSortTimestamp(right) - orderSortTimestamp(left))[0]
    return {
      name: accountLabel(deviceId),
      syncTime: latestOrder ? `Last Sync ${new Date(latestOrder.createdAt).toLocaleTimeString()}` : 'Waiting for sync',
      pendingSales: `${matchingOrders.length} sales`,
      health: matchingOrders.length > 0 ? 'Healthy' : 'Pending Sales',
    }
  })

  const lowStockCount = products.filter((product) => product.isLowStock || product.stockCount <= 5).length
  const alerts: DashboardAlert[] = [
    { title: 'Low stock ingredients', action: `${lowStockCount} items need review`, icon: '!' },
    { title: 'Price logs', action: `${logs.length} price logs in sync`, icon: 'P' },
    { title: 'Cloud orders', action: `${activeOrders.length} synced orders`, icon: 'S' },
  ]

  const topProducts: ProductRank[] = Array.from(
    [...activeOrders.flatMap((order) => order.items)]
    .reduce<Map<string, { quantity: number; lineTotal: number }>>((acc, item) => {
      const current = acc.get(item.name) ?? { quantity: 0, lineTotal: 0 }
      current.quantity += item.quantity
      current.lineTotal += item.lineTotal
      acc.set(item.name, current)
      return acc
    }, new Map()).entries(),
  )
    .sort((left, right) => right[1].lineTotal - left[1].lineTotal)
    .slice(0, 5)
    .map(([name, stats], index) => ({
      rank: index + 1,
      name,
      revenue: formatPhp(stats.lineTotal),
      quantity: `${stats.quantity.toFixed(stats.quantity % 1 === 0 ? 0 : 1)} sold`,
      secondaryRevenue: formatCompactPhp(stats.lineTotal),
      secondaryQuantity: `${stats.quantity} qty`,
    }))

  const activity: DashboardActivity[] = [
    {
      actor: 'Sync',
      detail: `Pulled ${orders.length} rows and ${voids.length} void records from Supabase.`,
      ago: 'Just now',
    },
    ...movements.slice(0, 4).map((movement) => ({
      actor: accountLabel(movement.accountId),
      detail: `${movement.reasonCategory} ${formatPhp(movementSignedAmount(movement))}`,
      ago: new Date(movement.createdAtEpochMillis).toLocaleString(),
    })),
  ]

  return {
    metrics,
    salesTrendPrimary,
    salesTrendSecondary,
    paymentBreakdown,
    deviceBreakdown,
    devices,
    alerts,
    topProducts,
    activity,
    syncBannerTitle: activeOrders.length > 0 ? 'Orders synchronized from Supabase' : 'No synced orders yet',
    syncBannerSubtitle: activeOrders.length > 0 ? `${activeOrders.length} live orders available in cloud sync` : 'Check tablet sync and Supabase config',
    financialMetrics: [
      { label: 'Total Sales', value: formatPhp(totalSales) },
      { label: 'Cash Sales', value: formatPhp(cashSales) },
      { label: 'GCash Sales', value: formatPhp(gcashSales) },
      { label: 'Net Profit', value: latestAccounting ? formatPhp(latestAccounting.netProfit) : 'Not calculated', tone: latestAccounting && latestAccounting.netProfit < 0 ? 'danger' : 'default' },
    ],
  }
}

export function buildCashAccounts(orders: OrderRecord[], movements: CashMovement[]): CashAccountView[] {
  const orderedIds = ['main-safe', 'tablet-1', 'tablet-2', 'bank-gcash']
  return orderedIds.map((id) => {
    const matchingMovements = movements.filter((movement) => normalizeAccountId(movement.accountId) === id)
    const currentBalance = matchingMovements.reduce((sum, movement) => sum + movementSignedAmount(movement), 0)
    const salesToday = orders
      .filter((order) => normalizeAccountId(order.deviceId) === id || (id === 'bank-gcash' && (order.gcashAmount ?? 0) > 0))
      .reduce((sum, order) => sum + (id === 'bank-gcash' ? order.gcashAmount ?? 0 : order.cashAmount ?? order.total), 0)
    const latestMovement = matchingMovements[0]
    return {
      id,
      name: accountLabel(id),
      type: id === 'main-safe' ? 'safe' : id === 'bank-gcash' ? 'bank' : 'tablet',
      currentBalance,
      expectedBalance: currentBalance,
      salesToday,
      lastActivityNote: latestMovement?.reasonCategory ?? 'No activity yet',
      lastActivityAt: latestMovement ? new Date(latestMovement.createdAtEpochMillis).toLocaleString() : 'No activity yet',
    }
  })
}

export function buildBillViews(payables: Payable[]): BillRecordView[] {
  return payables.map((payable) => ({
    id: payable.id,
    vendor: payable.vendorName || payable.title,
    dueDate: new Date(payable.dueDateEpochMillis).toISOString().slice(0, 10),
    amount: payable.amount,
    paid: payable.status === 'PAID',
  }))
}

export function buildProfitData(accounting: DailyAccountingRecord[]): ProfitDataView {
  const totalRevenue = accounting.reduce((sum, record) => sum + record.totalSales, 0)
  const totalCost = accounting.reduce((sum, record) => sum + record.totalCost, 0)
  return {
    revenue: totalRevenue,
    cogs: totalCost,
  }
}

export function buildSyncItems(orders: OrderRecord[], voids: OrderVoidRecord[], accounting: DailyAccountingRecord[]): SyncListItem[] {
  const items: SyncListItem[] = []
  items.push({
    title: 'Orders sync',
    detail: `Fetched ${orders.length} orders from Supabase`,
    relativeDate: 'Current session',
    fullDate: new Date().toISOString(),
    status: 'synced',
  })
  items.push({
    title: 'Void authority sync',
    detail: `Fetched ${voids.length} order void records`,
    relativeDate: 'Current session',
    fullDate: new Date().toISOString(),
    status: 'completed',
  })
  if (accounting[0]) {
    items.push({
      title: 'Daily accounting',
      detail: `Latest accounting ${accounting[0].businessDate}`,
      relativeDate: accounting[0].businessDate,
      fullDate: accounting[0].calculatedAt,
      status: 'synced',
    })
  }
  return items
}
