import { getStorageBucket, hasSupabaseConfig, requireSupabase } from './supabase/client'
import type {
  AdjustCashInput,
  CashMovement,
  DailyAccountingRecord,
  InventoryCountRecord,
  InventoryItem,
  IngredientCategory,
  IngredientPriceLog,
  IngredientRegistryItem,
  MenuCategory,
  MenuProduct,
  OrderRecord,
  OrderVoidRecord,
  Payable,
  Recipe,
  RecipeIngredient,
  ResetOperationalDataInput,
  SaveIngredientPriceLogInput,
  SaveIngredientRegistryInput,
  SaveMenuCatalogInput,
  SavePayableInput,
  SaveRecipeSetInput,
  SeedTroubleshootingDataInput,
  TransferCashInput,
  VoidOrderInput,
  CashPullInput,
} from './adminTypes'

const OPERATIONAL_RESET_MARKER = '__RESET_OPERATIONAL_DATA__'
import { normalizeAccountId } from './mappers'
import { createRandomId } from './randomId'

type AdminDataset = {
  categories: MenuCategory[]
  products: MenuProduct[]
  orders: OrderRecord[]
  voids: OrderVoidRecord[]
  accounting: DailyAccountingRecord[]
  ingredientLogs: IngredientPriceLog[]
  ingredientCategories: IngredientCategory[]
  ingredientRegistry: IngredientRegistryItem[]
  dailyLogMissingStartDate: string | null
  recipes: Recipe[]
  recipeIngredients: RecipeIngredient[]
  cashMovements: CashMovement[]
  payables: Payable[]
  halfOrderPriceSupported: boolean
}

function maybeConfigured<T>(fallback: T, task: () => Promise<T>) {
  if (!hasSupabaseConfig) return Promise.resolve(fallback)
  return task()
}

function asIsoDate(epochMillis: number) {
  return new Date(epochMillis).toISOString().slice(0, 10)
}

function asIsoTimestamp(epochMillis: number) {
  return new Date(epochMillis).toISOString()
}

function slugify(value: string) {
  return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'menu-item'
}

function normalizeImagePathValue(rawValue: unknown) {
  if (rawValue == null) {
    return null
  }

  const normalized = String(rawValue).trim()
  if (
    normalized.length === 0 ||
    normalized.toLowerCase() === 'null' ||
    normalized.toLowerCase() === 'undefined'
  ) {
    return null
  }

  if (
    /^https?:\/\//i.test(normalized) ||
    normalized.startsWith('data:') ||
    normalized.startsWith('blob:') ||
    normalized.startsWith('/')
  ) {
    return normalized
  }

  const supabase = requireSupabase()
  const { data } = supabase.storage.from(getStorageBucket()).getPublicUrl(normalized)
  return data.publicUrl
}

function normalizeImagePathForWrite(rawValue: string | null) {
  if (!rawValue) {
    return null
  }

  const normalized = rawValue.trim()
  if (
    normalized.length === 0 ||
    normalized.toLowerCase() === 'null' ||
    normalized.toLowerCase() === 'undefined' ||
    normalized.startsWith('data:')
  ) {
    return null
  }

  return normalized
}

function isMissingTableError(error: unknown) {
  if (!error || typeof error !== 'object') return false
  const message = String(Reflect.get(error, 'message') ?? '').toLowerCase()
  const code = String(Reflect.get(error, 'code') ?? '')
  return code === '42P01' || message.includes('could not find the table') || message.includes('does not exist')
}

async function detectProductHalfPriceColumn() {
  const supabase = requireSupabase()
  const halfOrderProbe = await supabase.from('products').select('half_order_price').limit(1)
  if (!halfOrderProbe.error) {
    return 'half_order_price' as const
  }

  const halfPriceProbe = await supabase.from('products').select('half_price').limit(1)
  if (!halfPriceProbe.error) {
    return 'half_price' as const
  }

  return null
}

async function hasTable(tableName: string) {
  const supabase = requireSupabase()
  const { error } = await supabase.from(tableName).select('*').limit(1)
  return !error
}

export async function loadAdminDataset(): Promise<AdminDataset> {
  const [
    categories,
    products,
    orders,
    voids,
    accounting,
    ingredientLogs,
    ingredientCategories,
    ingredientRegistry,
    dailyLogMissingStartDate,
    recipes,
    recipeIngredients,
    cashMovements,
    payables,
    halfPriceColumn,
  ] = await Promise.all([
    fetchMenuCategories(),
    fetchMenuProducts(),
    fetchOrders(),
    fetchOrderVoids(),
    fetchDailyAccountingRecords(),
    fetchIngredientPriceLogs(),
    fetchIngredientCategories(),
    fetchIngredients(),
    fetchDailyLogMissingStartDate(),
    fetchRecipes(),
    fetchRecipeIngredients(),
    fetchCashMovements(),
    fetchPayables(),
    maybeConfigured<Awaited<ReturnType<typeof detectProductHalfPriceColumn>>>(null, () => detectProductHalfPriceColumn()),
  ])
  return {
    categories,
    products,
    orders,
    voids,
    accounting,
    ingredientLogs,
    ingredientCategories,
    ingredientRegistry,
    dailyLogMissingStartDate,
    recipes,
    recipeIngredients,
    cashMovements,
    payables,
    halfOrderPriceSupported: halfPriceColumn !== null,
  }
}

export async function fetchMenuCategories(): Promise<MenuCategory[]> {
  return maybeConfigured([], async () => {
    const supabase = requireSupabase()
    const { data, error } = await supabase
      .from('categories')
      .select('id,name,sort_order,is_active')
      .order('sort_order', { ascending: true })
      .limit(200)
    if (error) throw error
    return (data ?? []).map((row) => ({
      id: String(row.id),
      name: String(row.name),
      sortOrder: Number(row.sort_order ?? 0),
      isActive: row.is_active !== false,
    }))
  })
}

export async function fetchMenuProducts(): Promise<MenuProduct[]> {
  return maybeConfigured([], async () => {
    const supabase = requireSupabase()
    const { data, error } = await supabase
      .from('products')
      .select('*')
      .order('updated_at', { ascending: false })
      .limit(1200)
    if (error) throw error
    return (data ?? []).map((row) => ({
      id: String(row.id),
      categoryId: String(row.category_id),
      name: String(row.name),
      price: Number(row.price ?? 0),
      halfOrderPrice: normalizeHalfOrderPrice(row.half_order_price ?? row.half_price),
      status: String(row.status ?? 'AVAILABLE').toUpperCase() as MenuProduct['status'],
      imagePath: normalizeImagePathValue(row.image_path),
      stockCount: Number(row.stock_count ?? 0),
      isLowStock: Boolean(row.is_low_stock),
      isActive: row.is_active !== false,
    }))
  })
}

export async function fetchOrders(): Promise<OrderRecord[]> {
  return maybeConfigured([], async () => {
    const supabase = requireSupabase()
    const { data, error } = await supabase
      .from('orders')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(800)

    if (error) throw error
    return ((data ?? []) as Array<Record<string, unknown>>).map((row) => {
      const order: OrderRecord = {
        deviceOrderId: String(row.device_order_id),
        deviceId: String(row.device_id),
        paymentMethod: String(row.payment_method ?? ''),
        paymentReference: row.payment_reference ? String(row.payment_reference) : null,
        cashAmount: row.cash_amount == null ? null : Number(row.cash_amount),
        gcashAmount: row.gcash_amount == null ? null : Number(row.gcash_amount),
        subtotal: Number(row.subtotal ?? 0),
        tax: Number(row.tax ?? 0),
        total: Number(row.total ?? 0),
        createdAt: String(row.created_at ?? ''),
        items: Array.isArray(row.items_json)
          ? row.items_json.map((rawItem: unknown) => {
              const item = typeof rawItem === 'object' && rawItem !== null ? rawItem as Record<string, unknown> : {}
              const mapped: OrderRecord['items'][number] = {
                name: String(item.name ?? ''),
                quantity: Number(item.quantity ?? 0),
                lineTotal: Number(item.lineTotal ?? item.line_total ?? 0),
              }
              if (item.productId != null) mapped.productId = String(item.productId)
              if (item.categoryName != null) mapped.categoryName = String(item.categoryName)
              if (item.category_name != null) mapped.categoryName = String(item.category_name)
              if (item.serviceMode != null) mapped.serviceMode = String(item.serviceMode)
              if (item.isHalfOrder != null) mapped.isHalfOrder = Boolean(item.isHalfOrder)
              if (item.price != null) mapped.price = Number(item.price)
              if (item.kitchenStatus != null) mapped.kitchenStatus = String(item.kitchenStatus)
              if (item.isChecked != null) mapped.isChecked = Boolean(item.isChecked)
              return mapped
            })
          : [],
      }
      if (row.service_mode != null) order.serviceMode = String(row.service_mode)
      if (row.gcash_reference_last4 != null) order.gcashReferenceLast4 = String(row.gcash_reference_last4)
      if (row.payment_status != null) order.paymentStatus = String(row.payment_status)
      if (row.workflow_status != null) order.workflowStatus = String(row.workflow_status)
      if (row.order_note != null) order.orderNote = String(row.order_note)
      return order
    })
  })
}

function normalizeHalfOrderPrice(value: unknown) {
  if (value == null || value === '') return null
  const amount = Number(value)
  return Number.isFinite(amount) && amount > 0 ? amount : null
}

export async function fetchOrderVoids(): Promise<OrderVoidRecord[]> {
  return maybeConfigured([], async () => {
    const supabase = requireSupabase()
    const { data, error } = await supabase
      .from('order_voids')
      .select('device_order_id,void_reason,voided_by,voided_at')
      .order('voided_at', { ascending: false })
      .limit(250)
    if (error) throw error
    return (data ?? []).map((row) => ({
      deviceOrderId: String(row.device_order_id),
      voidReason: String(row.void_reason ?? 'Voided from admin'),
      voidedBy: String(row.voided_by ?? 'Admin 3.0'),
      voidedAt: String(row.voided_at ?? ''),
    }))
  })
}

export async function fetchDailyAccountingRecords(): Promise<DailyAccountingRecord[]> {
  return maybeConfigured([], async () => {
    const supabase = requireSupabase()
    const { data, error } = await supabase
      .from('daily_accounting')
      .select('business_date,calculated_at,total_sales,net_sales,total_cost,gross_profit,net_profit,order_count,source_label,missing_recipe_count,has_fallback_pricing,has_conversion_issue')
      .order('business_date', { ascending: false })
      .limit(120)
    if (error) throw error
    return (data ?? []).map((row) => ({
      businessDate: String(row.business_date),
      calculatedAt: String(row.calculated_at ?? ''),
      totalSales: Number(row.total_sales ?? 0),
      netSales: Number(row.net_sales ?? 0),
      totalCost: Number(row.total_cost ?? 0),
      grossProfit: Number(row.gross_profit ?? 0),
      netProfit: Number(row.net_profit ?? 0),
      orderCount: Number(row.order_count ?? 0),
      sourceLabel: String(row.source_label ?? ''),
      missingRecipeCount: Number(row.missing_recipe_count ?? 0),
      hasFallbackPricing: Boolean(row.has_fallback_pricing),
      hasConversionIssue: Boolean(row.has_conversion_issue),
    }))
  })
}

export async function fetchInventoryItems(): Promise<InventoryItem[]> {
  return maybeConfigured([], async () => {
    const supabase = requireSupabase()
    const { data, error } = await supabase
      .from('inventory_items')
      .select('id,name,category,unit,on_hand,reorder_level,counting_enabled,counting_frequency,overdue,updated_at')
      .order('name', { ascending: true })
      .limit(1000)
    if (error) throw error
    return (data ?? []).map((row) => ({
      id: String(row.id),
      name: String(row.name ?? row.id),
      category: String(row.category ?? 'General'),
      unit: String(row.unit ?? 'kg'),
      onHand: Number(row.on_hand ?? 0),
      reorderLevel: Number(row.reorder_level ?? 0),
      countingEnabled: row.counting_enabled !== false,
      countingFrequency:
        row.counting_frequency === 'Daily' || row.counting_frequency === 'Weekly' || row.counting_frequency === 'Monthly'
          ? row.counting_frequency
          : 'Weekly',
      overdue: row.overdue === true,
      updatedAt: String(row.updated_at ?? ''),
    }))
  })
}

export async function fetchInventoryCounts(): Promise<InventoryCountRecord[]> {
  return maybeConfigured([], async () => {
    const supabase = requireSupabase()
    const { data, error } = await supabase
      .from('inventory_counts')
      .select('id,item_id,counted_quantity,counted_at,counted_by,note')
      .order('counted_at', { ascending: false })
      .limit(2000)
    if (error) throw error
    return (data ?? []).map((row) => ({
      id: String(row.id),
      itemId: String(row.item_id),
      countedQuantity: Number(row.counted_quantity ?? 0),
      countedAt: String(row.counted_at ?? ''),
      countedBy: String(row.counted_by ?? 'Admin Web'),
      note: row.note ? String(row.note) : null,
    }))
  })
}

export async function fetchIngredientPriceLogs(): Promise<IngredientPriceLog[]> {
  return maybeConfigured([], async () => {
    const supabase = requireSupabase()
    const { data, error } = await supabase
      .from('ingredient_price_logs')
      .select('ingredient_id,ingredient_name,business_date,price,unit,source_log_id,source_log_title')
      .order('business_date', { ascending: false })
      .limit(800)
    if (error) throw error
    return (data ?? []).map((row) => ({
      ingredientId: String(row.ingredient_id),
      ingredientName: String(row.ingredient_name ?? row.ingredient_id),
      businessDate: String(row.business_date),
      price: Number(row.price ?? 0),
      unit: String(row.unit ?? 'kg'),
      sourceLogId: row.source_log_id ? String(row.source_log_id) : null,
      sourceLogTitle: row.source_log_title ? String(row.source_log_title) : null,
    }))
  })
}

export async function fetchIngredientCategories(): Promise<IngredientCategory[]> {
  return maybeConfigured([], async () => {
    const supabase = requireSupabase()
    const { data, error } = await supabase
      .from('ingredient_categories')
      .select('id,name,sort_order,is_active')
      .order('sort_order', { ascending: true })
      .limit(300)
    if (error) {
      if (isMissingTableError(error)) return []
      throw error
    }
    return (data ?? []).map((row) => ({
      id: String(row.id),
      name: String(row.name ?? 'General'),
      sortOrder: Number(row.sort_order ?? 0),
      isActive: row.is_active !== false,
    }))
  })
}

export async function fetchIngredients(): Promise<IngredientRegistryItem[]> {
  return maybeConfigured([], async () => {
    const supabase = requireSupabase()
    const { data, error } = await supabase
      .from('ingredients')
      .select('id,name,category_id,default_unit,is_active')
      .order('name', { ascending: true })
      .limit(1500)
    if (error) {
      if (isMissingTableError(error)) return []
      throw error
    }
    return (data ?? []).map((row) => ({
      id: String(row.id),
      name: String(row.name ?? row.id),
      categoryId: row.category_id == null ? null : String(row.category_id),
      defaultUnit: String(row.default_unit ?? 'unit'),
      isActive: row.is_active !== false,
    }))
  })
}

export async function fetchAdminSetting(key: string): Promise<Record<string, unknown> | null> {
  return maybeConfigured(null, async () => {
    const supabase = requireSupabase()
    const { data, error } = await supabase
      .from('admin_settings')
      .select('value')
      .eq('key', key)
      .maybeSingle()
    if (error) {
      if (isMissingTableError(error)) return null
      throw error
    }
    return data?.value && typeof data.value === 'object' ? data.value as Record<string, unknown> : null
  })
}

export async function fetchDailyLogMissingStartDate(): Promise<string | null> {
  const setting = await fetchAdminSetting('daily_log_missing_start_date')
  const value = setting?.startDate
  return typeof value === 'string' && value.trim() ? value.trim() : null
}

export async function saveAdminSetting(key: string, value: Record<string, unknown>) {
  return maybeConfigured(undefined, async () => {
    if (!(await hasTable('admin_settings'))) return
    const supabase = requireSupabase()
    const { error } = await supabase.from('admin_settings').upsert({
      key,
      value,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'key' })
    if (error) {
      if (isMissingTableError(error)) return
      throw error
    }
  })
}

export async function saveDailyLogMissingStartDate(startDate: string) {
  return saveAdminSetting('daily_log_missing_start_date', { startDate })
}

export async function fetchRecipes(): Promise<Recipe[]> {
  return maybeConfigured([], async () => {
    const supabase = requireSupabase()
    const { data, error } = await supabase
      .from('recipes')
      .select('id,recipe_name,recipe_type,menu_category,servings,price_per_serving,yield_quantity,yield_unit,tax_rate_percent')
      .order('recipe_name', { ascending: true })
      .limit(600)
    if (error) throw error
    return (data ?? []).map((row) => ({
      id: String(row.id),
      recipeName: String(row.recipe_name),
      recipeType: String(row.recipe_type ?? 'MENU_ITEM').toUpperCase() as Recipe['recipeType'],
      menuCategory: String(row.menu_category ?? ''),
      servings: row.servings == null ? null : Number(row.servings),
      pricePerServing: row.price_per_serving == null ? null : Number(row.price_per_serving),
      yieldQuantity: row.yield_quantity == null ? null : Number(row.yield_quantity),
      yieldUnit: row.yield_unit ? String(row.yield_unit) : null,
      taxRatePercent: Number(row.tax_rate_percent ?? 12),
    }))
  })
}

export async function fetchRecipeIngredients(): Promise<RecipeIngredient[]> {
  return maybeConfigured([], async () => {
    const supabase = requireSupabase()
    const { data, error } = await supabase
      .from('recipe_ingredients')
      .select('id,recipe_id,ingredient_ref_id,ingredient_ref_type,ingredient_name,purchase_quantity,purchase_unit,recipe_quantity,recipe_unit,sort_order')
      .order('recipe_id', { ascending: true })
      .order('sort_order', { ascending: true })
      .limit(2000)
    if (error) throw error
    return (data ?? []).map((row) => ({
      id: String(row.id),
      recipeId: String(row.recipe_id),
      ingredientRefId: String(row.ingredient_ref_id),
      ingredientRefType: String(row.ingredient_ref_type ?? 'ingredient'),
      ingredientName: String(row.ingredient_name ?? ''),
      purchaseQuantity: row.purchase_quantity == null ? null : Number(row.purchase_quantity),
      purchaseUnit: String(row.purchase_unit ?? 'kg'),
      recipeQuantity: Number(row.recipe_quantity ?? 0),
      recipeUnit: String(row.recipe_unit ?? 'g'),
      sortOrder: Number(row.sort_order ?? 0),
    }))
  })
}

export async function fetchCashMovements(): Promise<CashMovement[]> {
  return maybeConfigured([], async () => {
    const supabase = requireSupabase()
    const { data, error } = await supabase
      .from('cash_movements')
      .select('id,account_id,account_type,source_account_id,destination_account_id,movement_kind,reason_category,amount,note,related_bill_id,created_by,created_at,shift_id,shift_session_id')
      .order('created_at', { ascending: false })
      .limit(400)
    if (error) throw error
    return (data ?? []).map((row) => ({
      id: String(row.id),
      accountId: normalizeAccountId(String(row.account_id)),
      accountType: String(row.account_type ?? 'TABLET_DRAWER').toUpperCase() as CashMovement['accountType'],
      sourceAccountId: row.source_account_id ? normalizeAccountId(String(row.source_account_id)) : null,
      destinationAccountId: row.destination_account_id ? normalizeAccountId(String(row.destination_account_id)) : null,
      movementKind: String(row.movement_kind ?? 'PAY_OUT').toUpperCase() as CashMovement['movementKind'],
      reasonCategory: String(row.reason_category ?? 'Other'),
      amount: Number(row.amount ?? 0),
      note: row.note ? String(row.note) : null,
      relatedBillId: row.related_bill_id ? String(row.related_bill_id) : null,
      createdBy: String(row.created_by ?? 'Admin 3.0'),
      createdAtEpochMillis: Date.parse(String(row.created_at ?? '')) || Date.now(),
      shiftId: row.shift_id ? String(row.shift_id) : null,
      shiftSessionId: row.shift_session_id ? String(row.shift_session_id) : null,
    }))
  })
}

export async function fetchPayables(): Promise<Payable[]> {
  return maybeConfigured([], async () => {
    const supabase = requireSupabase()
    const { data, error } = await supabase
      .from('payables')
      .select('id,title,vendor_name,category,cash_flow_class,amount,due_date,status,payment_source,paid_at,note,created_by,created_at')
      .order('due_date', { ascending: true })
      .limit(300)
    if (error) throw error
    return (data ?? []).map((row) => ({
      id: String(row.id),
      title: String(row.title ?? ''),
      vendorName: String(row.vendor_name ?? ''),
      category: String(row.category ?? ''),
      cashFlowClass: String(row.cash_flow_class ?? 'OPERATING').toUpperCase() as Payable['cashFlowClass'],
      amount: Number(row.amount ?? 0),
      dueDateEpochMillis: Date.parse(`${row.due_date}T00:00:00`) || Date.now(),
      status: String(row.status ?? 'OPEN').toUpperCase() as Payable['status'],
      paymentSource: row.payment_source ? String(row.payment_source) : null,
      paidAtEpochMillis: row.paid_at ? Date.parse(String(row.paid_at)) : null,
      note: row.note ? String(row.note) : null,
      createdBy: String(row.created_by ?? 'Admin 3.0'),
      createdAtEpochMillis: Date.parse(String(row.created_at ?? '')) || Date.now(),
    }))
  })
}

export async function voidOrder(input: VoidOrderInput) {
  return maybeConfigured(undefined, async () => {
    const supabase = requireSupabase()
    const { error } = await supabase.from('order_voids').upsert({
      device_order_id: input.deviceOrderId,
      void_reason: input.voidReason ?? 'Voided from Admin Web',
      voided_by: input.voidedBy ?? 'Admin Web',
      voided_at: new Date().toISOString(),
    }, { onConflict: 'device_order_id' })
    if (error) throw error
  })
}

async function publishOperationalResetMarker() {
  const supabase = requireSupabase()
  const { error } = await supabase.from('order_voids').upsert({
    device_order_id: OPERATIONAL_RESET_MARKER,
    void_reason: 'Operational data reset from Admin Web',
    voided_by: 'Admin Web',
    voided_at: new Date().toISOString(),
  }, { onConflict: 'device_order_id' })
  if (error) throw error
}

export async function saveMenuCatalog(input: SaveMenuCatalogInput) {
  return maybeConfigured(undefined, async () => {
    const supabase = requireSupabase()
    const now = new Date().toISOString()
    const halfPriceColumn = await detectProductHalfPriceColumn()
    const desiredCategories = input.categories.map((category, index) => ({
      id: category.id,
      name: category.name.trim() || 'Uncategorized',
      sort_order: category.sortOrder ?? index,
      is_active: category.isActive !== false,
      updated_at: now,
    }))
    const desiredProducts = input.products.map((product) => ({
      id: product.id,
      category_id: product.categoryId,
      name: product.name.trim(),
      price: product.price,
      ...(halfPriceColumn ? { [halfPriceColumn]: product.halfOrderPrice } : {}),
      status: String(product.status).toLowerCase(),
      image_path: normalizeImagePathForWrite(product.imagePath),
      stock_count: product.stockCount,
      is_low_stock: product.isLowStock,
      is_active: product.isActive,
      updated_at: now,
    }))
    const categoryResult = await supabase.from('categories').upsert(desiredCategories, { onConflict: 'id' })
    if (categoryResult.error) throw categoryResult.error
    const productResult = await supabase.from('products').upsert(desiredProducts, { onConflict: 'id' })
    if (productResult.error) throw productResult.error
  })
}

export async function deactivateMenuProduct(productId: string) {
  return maybeConfigured(undefined, async () => {
    const supabase = requireSupabase()
    const { error } = await supabase
      .from('products')
      .update({ is_active: false, updated_at: new Date().toISOString() })
      .eq('id', productId)
    if (error) throw error
  })
}

export async function deactivateMenuCategory(categoryId: string) {
  return maybeConfigured(undefined, async () => {
    const supabase = requireSupabase()
    const { error } = await supabase
      .from('categories')
      .update({ is_active: false, updated_at: new Date().toISOString() })
      .eq('id', categoryId)
    if (error) throw error
  })
}

export async function uploadMenuItemImage(file: File, nameHint: string) {
  return maybeConfigured<string | null>(null, async () => {
    const supabase = requireSupabase()
    const extension = file.name.split('.').pop()?.toLowerCase() || 'jpg'
    const fileName = `${slugify(nameHint)}-${Date.now()}.${extension}`
    const path = `products/${fileName}`
    const uploadResult = await supabase.storage.from(getStorageBucket()).upload(path, file, {
      contentType: file.type || 'image/jpeg',
      upsert: true,
    })
    if (uploadResult.error) {
      if (uploadResult.error.message.toLowerCase().includes('bucket not found')) {
        throw new Error(`The Supabase Storage bucket "${getStorageBucket()}" does not exist. Run SUPABASE_MENU_IMAGES.sql in the Supabase SQL Editor, then try again.`)
      }
      throw uploadResult.error
    }
    const { data } = supabase.storage.from(getStorageBucket()).getPublicUrl(path)
    return data.publicUrl
  })
}

export async function saveRecipeSet(input: SaveRecipeSetInput) {
  return maybeConfigured(undefined, async () => {
    const supabase = requireSupabase()
    const now = new Date().toISOString()
    const existingRecipes = await fetchRecipes()
    const existingIngredients = await fetchRecipeIngredients()
    const recipesPayload = input.recipes.map((recipe) => ({
      id: recipe.id,
      recipe_name: recipe.recipeName,
      normalized_recipe_name: recipe.recipeName.trim().toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim(),
      recipe_type: recipe.recipeType,
      menu_category: recipe.menuCategory,
      servings: recipe.servings,
      price_per_serving: recipe.pricePerServing,
      yield_quantity: recipe.yieldQuantity,
      yield_unit: recipe.yieldUnit,
      tax_rate_percent: recipe.taxRatePercent,
      updated_at: now,
    }))
    const ingredientPayload = input.ingredients.map((ingredient) => ({
      id: ingredient.id,
      recipe_id: ingredient.recipeId,
      ingredient_ref_id: ingredient.ingredientRefId,
      ingredient_ref_type: ingredient.ingredientRefType,
      ingredient_name: ingredient.ingredientName,
      purchase_quantity: ingredient.purchaseQuantity,
      purchase_unit: ingredient.purchaseUnit,
      recipe_quantity: ingredient.recipeQuantity,
      recipe_unit: ingredient.recipeUnit,
      sort_order: ingredient.sortOrder,
      updated_at: now,
    }))
    const desiredRecipeIds = new Set(input.recipes.map((recipe) => recipe.id))
    const desiredIngredientIds = new Set(input.ingredients.map((ingredient) => ingredient.id))
    const recipeIdsToDelete = existingRecipes
      .map((recipe) => recipe.id)
      .filter((recipeId) => !desiredRecipeIds.has(recipeId))
    const ingredientIdsToDelete = existingIngredients
      .map((ingredient) => ingredient.id)
      .filter((ingredientId) => !desiredIngredientIds.has(ingredientId))
    const recipeResult = await supabase.from('recipes').upsert(recipesPayload, { onConflict: 'id' })
    if (recipeResult.error) throw recipeResult.error
    const ingredientResult = await supabase.from('recipe_ingredients').upsert(ingredientPayload, { onConflict: 'id' })
    if (ingredientResult.error) throw ingredientResult.error
    if (ingredientIdsToDelete.length > 0) {
      const deleteIngredientsResult = await supabase.from('recipe_ingredients').delete().in('id', ingredientIdsToDelete)
      if (deleteIngredientsResult.error) throw deleteIngredientsResult.error
    }
    if (recipeIdsToDelete.length > 0) {
      const deleteRecipesResult = await supabase.from('recipes').delete().in('id', recipeIdsToDelete)
      if (deleteRecipesResult.error) throw deleteRecipesResult.error
    }
  })
}

export async function saveIngredientPriceLog(input: SaveIngredientPriceLogInput) {
  return maybeConfigured(undefined, async () => {
    const supabase = requireSupabase()
    const payload = input.logs.map((log) => ({
      ingredient_id: log.ingredientId,
      ingredient_name: log.ingredientName,
      business_date: log.businessDate,
      price: log.price,
      unit: log.unit,
      source_log_id: log.sourceLogId,
      source_log_title: log.sourceLogTitle,
      updated_at: new Date().toISOString(),
    }))
    const result = await supabase
      .from('ingredient_price_logs')
      .upsert(payload, { onConflict: 'ingredient_id,business_date' })
    if (result.error) throw result.error
  })
}

export async function saveIngredientRegistry(input: SaveIngredientRegistryInput) {
  return maybeConfigured(undefined, async () => {
    if (!(await hasTable('ingredient_categories')) || !(await hasTable('ingredients'))) return
    const supabase = requireSupabase()
    const now = new Date().toISOString()
    const categoryPayload = input.categories.map((category, index) => ({
      id: category.id,
      name: category.name.trim() || 'General',
      sort_order: category.sortOrder ?? index,
      is_active: category.isActive !== false,
      updated_at: now,
    }))
    const ingredientPayload = input.ingredients.map((ingredient) => ({
      id: ingredient.id,
      name: ingredient.name.trim(),
      category_id: ingredient.categoryId,
      default_unit: ingredient.defaultUnit.trim() || 'unit',
      is_active: ingredient.isActive !== false,
      updated_at: now,
    }))
    if (categoryPayload.length > 0) {
      const categoryResult = await supabase.from('ingredient_categories').upsert(categoryPayload, { onConflict: 'id' })
      if (categoryResult.error) {
        if (isMissingTableError(categoryResult.error)) return
        throw categoryResult.error
      }
    }
    if (ingredientPayload.length > 0) {
      const ingredientResult = await supabase.from('ingredients').upsert(ingredientPayload, { onConflict: 'id' })
      if (ingredientResult.error) {
        if (isMissingTableError(ingredientResult.error)) return
        throw ingredientResult.error
      }
    }
  })
}

export async function upsertInventoryItems(items: InventoryItem[]) {
  return maybeConfigured(undefined, async () => {
    if (items.length === 0) return
    const supabase = requireSupabase()
    const payload = items.map((item) => ({
      id: item.id,
      name: item.name,
      category: item.category,
      unit: item.unit,
      on_hand: item.onHand,
      reorder_level: item.reorderLevel,
      counting_enabled: item.countingEnabled,
      counting_frequency: item.countingFrequency,
      overdue: item.overdue,
      updated_at: item.updatedAt,
    }))
    const { error } = await supabase.from('inventory_items').upsert(payload, { onConflict: 'id' })
    if (error) throw error
  })
}

export async function recordInventoryCount(record: InventoryCountRecord) {
  return maybeConfigured(undefined, async () => {
    const supabase = requireSupabase()
    const { error } = await supabase.from('inventory_counts').upsert({
      id: record.id,
      item_id: record.itemId,
      counted_quantity: record.countedQuantity,
      counted_at: record.countedAt,
      counted_by: record.countedBy,
      note: record.note,
    }, { onConflict: 'id' })
    if (error) throw error
  })
}

export async function upsertOrders(orders: OrderRecord[]) {
  return maybeConfigured(undefined, async () => {
    if (orders.length === 0) return
    const supabase = requireSupabase()
    const payload = orders.map((order) => ({
      device_order_id: order.deviceOrderId,
      device_id: order.deviceId,
      payment_method: order.paymentMethod,
      payment_reference: order.paymentReference,
      cash_amount: order.cashAmount,
      gcash_amount: order.gcashAmount,
      subtotal: order.subtotal,
      tax: order.tax,
      total: order.total,
      created_at: order.createdAt,
      items_json: order.items,
    }))
    const { error } = await supabase.from('orders').upsert(payload, { onConflict: 'device_order_id' })
    if (error) throw error
  })
}

export async function calculateDailyAccounting(businessDate: string) {
  return maybeConfigured(null, async () => {
    const supabase = requireSupabase()
    const { data, error } = await supabase.rpc('calculate_daily_accounting', {
      p_business_date: businessDate,
    })
    if (error) throw error
    return data
  })
}

export async function syncAccountingInputs(logInput: SaveIngredientPriceLogInput, recipeInput: SaveRecipeSetInput) {
  await saveIngredientPriceLog(logInput)
  await saveRecipeSet(recipeInput)
}

export async function seedTroubleshootingData(input: SeedTroubleshootingDataInput) {
  return maybeConfigured(undefined, async () => {
    await upsertOrders(input.orders)
    for (const voidRecord of input.voids ?? []) {
      await voidOrder({
        deviceOrderId: voidRecord.deviceOrderId,
        voidReason: voidRecord.voidReason,
        voidedBy: voidRecord.voidedBy,
      })
    }
    await syncAccountingInputs(
      { logs: input.ingredientLogs },
      { recipes: input.recipes, ingredients: input.recipeIngredients },
    )
    await upsertCashMovements(input.cashMovements)
    for (const payable of input.payables) {
      await savePayable({ payable })
    }
    if (input.calculateBusinessDate) {
      await calculateDailyAccounting(input.calculateBusinessDate)
    }
  })
}

export async function transferCash(input: TransferCashInput) {
  const createdAt = Date.now()
  return upsertCashMovements([
    {
      id: createRandomId('ingredient-log'),
      accountId: normalizeAccountId(input.fromAccountId),
      accountType: normalizeAccountId(input.fromAccountId) === 'main-safe' ? 'SAFE' : 'TABLET_DRAWER',
      sourceAccountId: normalizeAccountId(input.fromAccountId),
      destinationAccountId: normalizeAccountId(input.toAccountId),
      movementKind: 'TRANSFER_OUT',
      reasonCategory: 'Transfer',
      amount: input.amount,
      note: input.note,
      relatedBillId: null,
      createdBy: input.createdBy,
      createdAtEpochMillis: createdAt,
    },
    {
      id: createRandomId('daily-accounting'),
      accountId: normalizeAccountId(input.toAccountId),
      accountType: normalizeAccountId(input.toAccountId) === 'main-safe' ? 'SAFE' : normalizeAccountId(input.toAccountId) === 'bank-gcash' ? 'BANK' : 'TABLET_DRAWER',
      sourceAccountId: normalizeAccountId(input.fromAccountId),
      destinationAccountId: normalizeAccountId(input.toAccountId),
      movementKind: 'TRANSFER_IN',
      reasonCategory: 'Transfer',
      amount: input.amount,
      note: input.note,
      relatedBillId: null,
      createdBy: input.createdBy,
      createdAtEpochMillis: createdAt,
    },
  ])
}

export async function adjustCash(input: AdjustCashInput) {
  const accountId = normalizeAccountId(input.accountId)
  return upsertCashMovements([
    {
      id: createRandomId('cash-movement'),
      accountId,
      accountType: accountId === 'main-safe' ? 'SAFE' : accountId === 'bank-gcash' ? 'BANK' : 'TABLET_DRAWER',
      sourceAccountId: input.adjustmentType === 'remove' ? accountId : null,
      destinationAccountId: input.adjustmentType === 'add' ? accountId : null,
      movementKind: input.adjustmentType === 'add' ? 'ADJUSTMENT_PLUS' : 'ADJUSTMENT_MINUS',
      reasonCategory: 'Adjustment',
      amount: input.amount,
      note: input.note,
      relatedBillId: null,
      createdBy: input.createdBy,
      createdAtEpochMillis: Date.now(),
    },
  ])
}

export async function cashPull(input: CashPullInput) {
  const createdAt = Date.now()
  return upsertCashMovements([
    {
      id: createRandomId('payable'),
      accountId: normalizeAccountId(input.fromAccountId),
      accountType: 'TABLET_DRAWER',
      sourceAccountId: normalizeAccountId(input.fromAccountId),
      destinationAccountId: 'main-safe',
      movementKind: 'TRANSFER_OUT',
      reasonCategory: 'Cash Pull',
      amount: input.amount,
      note: input.note,
      relatedBillId: null,
      createdBy: input.createdBy,
      createdAtEpochMillis: createdAt,
    },
    {
      id: createRandomId('sync-seed'),
      accountId: 'main-safe',
      accountType: 'SAFE',
      sourceAccountId: normalizeAccountId(input.fromAccountId),
      destinationAccountId: 'main-safe',
      movementKind: 'TRANSFER_IN',
      reasonCategory: 'Cash Pull',
      amount: input.amount,
      note: input.note,
      relatedBillId: null,
      createdBy: input.createdBy,
      createdAtEpochMillis: createdAt,
    },
  ])
}

export async function upsertCashMovements(movements: CashMovement[]) {
  return maybeConfigured(undefined, async () => {
    const supabase = requireSupabase()
    const payload = movements.map((movement) => ({
      id: movement.id,
      account_id: normalizeAccountId(movement.accountId),
      account_type: movement.accountType,
      source_account_id: movement.sourceAccountId,
      destination_account_id: movement.destinationAccountId,
      movement_kind: movement.movementKind,
      reason_category: movement.reasonCategory,
      amount: movement.amount,
      note: movement.note,
      related_bill_id: movement.relatedBillId,
      created_by: movement.createdBy,
      created_at: asIsoTimestamp(movement.createdAtEpochMillis),
      shift_id: movement.shiftId ?? null,
      shift_session_id: movement.shiftSessionId ?? null,
    }))
    const { error } = await supabase.from('cash_movements').upsert(payload, { onConflict: 'id' })
    if (error) throw error
  })
}

export async function savePayable(input: SavePayableInput) {
  return maybeConfigured(undefined, async () => {
    const supabase = requireSupabase()
    const payable = input.payable
    const { error } = await supabase.from('payables').upsert({
      id: payable.id,
      title: payable.title,
      vendor_name: payable.vendorName,
      category: payable.category,
      cash_flow_class: payable.cashFlowClass,
      amount: payable.amount,
      due_date: asIsoDate(payable.dueDateEpochMillis),
      status: payable.status,
      payment_source: payable.paymentSource,
      paid_at: payable.paidAtEpochMillis ? asIsoTimestamp(payable.paidAtEpochMillis) : null,
      note: payable.note,
      created_by: payable.createdBy,
      created_at: asIsoTimestamp(payable.createdAtEpochMillis),
    }, { onConflict: 'id' })
    if (error) throw error
  })
}

async function deleteAll(table: string) {
  const supabase = requireSupabase()
  const { error } = await supabase.from(table).delete().gte('created_at', '1900-01-01')
  if (error && !String(error.message).includes('created_at')) {
    throw error
  }
  if (error) {
    const { error: fallbackError } = await supabase.from(table).delete().not('id', 'is', null)
    if (fallbackError) throw fallbackError
  }
}

export async function clearOrdersData() {
  return maybeConfigured(undefined, async () => {
    await deleteAll('daily_accounting')
    await deleteAll('order_voids')
    await deleteAll('orders')
    await publishOperationalResetMarker()
  })
}

export async function clearRecipesData() {
  return maybeConfigured(undefined, async () => {
    await deleteAll('daily_accounting')
    await deleteAll('recipe_ingredients')
    await deleteAll('recipes')
  })
}

export async function clearDailyLogsData() {
  return maybeConfigured(undefined, async () => {
    await deleteAll('daily_accounting')
    await deleteAll('ingredient_price_logs')
  })
}

export async function clearExpensesLogData() {
  return maybeConfigured(undefined, async () => {
    const supabase = requireSupabase()
    const { error } = await supabase.from('cash_movements').delete().eq('movement_kind', 'PAY_OUT')
    if (error) throw error
  })
}

export async function clearInventoryData() {
  return maybeConfigured(undefined, async () => {
    await deleteAll('inventory_counts')
    await deleteAll('inventory_items')
  })
}

export async function clearMenuCatalogData() {
  return maybeConfigured(undefined, async () => {
    await deleteAll('products')
    await deleteAll('categories')
  })
}

export async function resetOperationalData(input: ResetOperationalDataInput = {}) {
  return maybeConfigured(undefined, async () => {
    await deleteAll('cash_movements')
    await deleteAll('payables')
    await deleteAll('inventory_counts')
    await deleteAll('inventory_items')
    await deleteAll('daily_accounting')
    await deleteAll('ingredient_price_logs')
    await deleteAll('recipe_ingredients')
    await deleteAll('recipes')
    await deleteAll('order_voids')
    await deleteAll('orders')
    await publishOperationalResetMarker()
    if (input.clearMenuCatalog) {
      await deleteAll('products')
      await deleteAll('categories')
    }
  })
}

export async function zeroSellableStockInCloud() {
  return maybeConfigured(undefined, async () => {
    const products = await fetchMenuProducts()
    const supabase = requireSupabase()
    const payload = products
      .filter((product) => product.isActive && product.stockCount !== 0)
      .map((product) => ({
        id: product.id,
        category_id: product.categoryId,
        name: product.name,
        price: product.price,
        status: product.status,
        image_path: product.imagePath,
        stock_count: 0,
        is_low_stock: true,
        is_active: product.isActive,
        updated_at: new Date().toISOString(),
      }))
    if (payload.length === 0) return
    const { error } = await supabase.from('products').upsert(payload, { onConflict: 'id' })
    if (error) throw error
  })
}
