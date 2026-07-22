import {
  createContext,
  startTransition,
  useContext,
  useEffect,
  useRef,
  useState,
  type PropsWithChildren,
} from 'react'
import {
  adjustCash,
  cashPull,
  fetchDailyAccountingRecords,
  loadAdminDataset,
  resetOperationalData,
  saveDailyLogMissingStartDate,
  saveIngredientPriceLog,
  saveIngredientRegistry,
  saveMenuCatalog,
  savePayable,
  saveRecipeSet,
  transferCash,
  uploadMenuItemImage,
  voidOrder,
  zeroSellableStockInCloud,
} from '../lib/adminApi'
import { hasSupabaseConfig, requireSupabase } from '../lib/supabase/client'
import {
  buildBillViews,
  buildCashAccounts,
  buildDashboardSnapshot,
  buildLogViews,
  buildOrderHistoryViews,
  buildProfitData,
  buildRecipeViews,
  buildSyncItems,
} from '../lib/mappers'
import type {
  AdjustCashInput,
  BillRecordView,
  CashAccountView,
  CashMovement,
  DailyAccountingRecord,
  DashboardSnapshot,
  IngredientCategory,
  IngredientPriceLog,
  IngredientRegistryItem,
  LogRecordView,
  MenuCategory,
  MenuProduct,
  OrderHistoryView,
  OrderRecord,
  OrderVoidRecord,
  Payable,
  ProfitDataView,
  Recipe,
  RecipeIngredient,
  RecipeView,
  ResetOperationalDataInput,
  SaveIngredientPriceLogInput,
  SaveIngredientRegistryInput,
  SaveMenuCatalogInput,
  SavePayableInput,
  SaveRecipeSetInput,
  SyncListItem,
  TransferCashInput,
  VoidOrderInput,
  CashPullInput,
} from '../lib/adminTypes'

type AdminState = {
  loading: boolean
  error: string | null
  lastRefreshedAt: string | null
  halfOrderPriceSupported: boolean
  orders: OrderRecord[]
  voids: OrderVoidRecord[]
  categories: MenuCategory[]
  products: MenuProduct[]
  recipes: Recipe[]
  recipeIngredients: RecipeIngredient[]
  ingredientLogs: IngredientPriceLog[]
  ingredientCategories: IngredientCategory[]
  ingredientRegistry: IngredientRegistryItem[]
  dailyLogMissingStartDate: string | null
  accounting: DailyAccountingRecord[]
  cashMovements: CashMovement[]
  payables: Payable[]
  dashboard: DashboardSnapshot
  orderHistory: OrderHistoryView[]
  recipeViews: RecipeView[]
  logViews: LogRecordView[]
  cashAccounts: CashAccountView[]
  billViews: BillRecordView[]
  profitData: ProfitDataView
  syncItems: SyncListItem[]
}

type AdminContextValue = AdminState & {
  refresh: () => Promise<void>
  setCategoriesAndProducts: (input: SaveMenuCatalogInput) => Promise<void>
  uploadProductImage: (file: File, nameHint: string) => Promise<string | null>
  voidOrder: (input: VoidOrderInput) => Promise<void>
  saveRecipes: (input: SaveRecipeSetInput) => Promise<void>
  saveIngredientLogs: (input: SaveIngredientPriceLogInput) => Promise<void>
  saveIngredientRegistry: (input: SaveIngredientRegistryInput) => Promise<void>
  saveDailyLogMissingStartDate: (startDate: string) => Promise<void>
  transferCash: (input: TransferCashInput) => Promise<void>
  adjustCash: (input: AdjustCashInput) => Promise<void>
  cashPull: (input: CashPullInput) => Promise<void>
  savePayable: (input: SavePayableInput) => Promise<void>
  resetOperationalData: (input?: ResetOperationalDataInput) => Promise<void>
  zeroSellableStock: () => Promise<void>
}

const emptyDashboard: DashboardSnapshot = {
  metrics: [],
  salesTrendPrimary: [],
  salesTrendSecondary: [],
  paymentBreakdown: { cash: 0, gcash: 0 },
  deviceBreakdown: { tablet1: 0, tablet2: 0 },
  devices: [],
  alerts: [],
  topProducts: [],
  activity: [],
  syncBannerTitle: 'Loading sync data',
  syncBannerSubtitle: 'Loading sync data',
  financialMetrics: [],
}

const initialState: AdminState = {
  loading: true,
  error: null,
  lastRefreshedAt: null,
  halfOrderPriceSupported: false,
  orders: [],
  voids: [],
  categories: [],
  products: [],
  recipes: [],
  recipeIngredients: [],
  ingredientLogs: [],
  ingredientCategories: [],
  ingredientRegistry: [],
  dailyLogMissingStartDate: null,
  accounting: [],
  cashMovements: [],
  payables: [],
  dashboard: emptyDashboard,
  orderHistory: [],
  recipeViews: [],
  logViews: [],
  cashAccounts: [],
  billViews: [],
  profitData: { revenue: 0, cogs: 0 },
  syncItems: [],
}

const AdminDataContext = createContext<AdminContextValue | null>(null)

function describeMutationError(error: unknown) {
  if (error instanceof Error && error.message.trim()) {
    return error.message
  }
  if (error && typeof error === 'object') {
    const parts = ['message', 'details', 'hint', 'code']
      .map((key) => {
        const value = Reflect.get(error, key)
        return typeof value === 'string' && value.trim() ? `${key}: ${value.trim()}` : null
      })
      .filter((value): value is string => value !== null)
    if (parts.length > 0) {
      return parts.join(' | ')
    }
  }
  return 'Mutation failed.'
}

function buildState(
  input: Omit<AdminState, 'loading' | 'error' | 'dashboard' | 'orderHistory' | 'recipeViews' | 'logViews' | 'cashAccounts' | 'billViews' | 'profitData' | 'syncItems'>,
  prev: Pick<AdminState, 'loading' | 'error' | 'lastRefreshedAt'>,
): AdminState {
  return {
    ...prev,
    ...input,
    dashboard: buildDashboardSnapshot(input.orders, input.voids, input.accounting, input.products, input.ingredientLogs, input.cashMovements),
    orderHistory: buildOrderHistoryViews(input.orders, input.voids),
    recipeViews: buildRecipeViews(input.recipes, input.recipeIngredients, input.products),
    logViews: buildLogViews(input.ingredientLogs),
    cashAccounts: buildCashAccounts(input.orders, input.cashMovements),
    billViews: buildBillViews(input.payables),
    profitData: buildProfitData(input.accounting),
    syncItems: buildSyncItems(input.orders, input.voids, input.accounting),
  }
}

export function AdminDataProvider({ children }: PropsWithChildren) {
  const [state, setState] = useState<AdminState>(initialState)
  const mountedRef = useRef(true)

  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
    }
  }, [])

  async function refresh() {
    setState((current) => ({ ...current, loading: true, error: null }))
    try {
      const dataset = await loadAdminDataset()
      if (!mountedRef.current) return
      setState((current) =>
        buildState(
          {
            lastRefreshedAt: new Date().toISOString(),
            halfOrderPriceSupported: dataset.halfOrderPriceSupported,
            orders: dataset.orders,
            voids: dataset.voids,
            categories: dataset.categories,
            products: dataset.products,
            recipes: dataset.recipes,
            recipeIngredients: dataset.recipeIngredients,
            ingredientLogs: dataset.ingredientLogs,
            ingredientCategories: dataset.ingredientCategories,
            ingredientRegistry: dataset.ingredientRegistry,
            dailyLogMissingStartDate: dataset.dailyLogMissingStartDate,
            accounting: dataset.accounting,
            cashMovements: dataset.cashMovements,
            payables: dataset.payables,
          },
          { loading: false, error: null, lastRefreshedAt: current.lastRefreshedAt },
        ),
      )
    } catch (error) {
      if (!mountedRef.current) return
      setState((current) => ({
        ...current,
        loading: false,
        error: error instanceof Error ? error.message : 'Failed to load admin data.',
      }))
    }
  }

  useEffect(() => {
    void refresh()
  }, [])

  useEffect(() => {
    if (!hasSupabaseConfig) return
    const supabase = requireSupabase()
    const channel = supabase
      .channel('admin-shared-menu')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'products' }, () => void refresh())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'categories' }, () => void refresh())
      .subscribe()
    return () => {
      void supabase.removeChannel(channel)
    }
  }, [])

  async function withOptimisticMutation(mutator: (draft: AdminState) => AdminState, task: () => Promise<void>) {
    const previous = state
    startTransition(() => {
      setState((current) => mutator({ ...current }))
    })
    try {
      await task()
      await refresh()
    } catch (error) {
      const message = describeMutationError(error)
      if (mountedRef.current) {
        setState({
          ...previous,
          loading: false,
          error: message,
        })
      }
      throw new Error(message)
    }
  }

  const value: AdminContextValue = {
    ...state,
    refresh,
    async setCategoriesAndProducts(input) {
      await withOptimisticMutation(
        (draft) => buildState({ ...draft, categories: input.categories, products: input.products }, draft),
        () => saveMenuCatalog(input),
      )
    },
    async uploadProductImage(file, nameHint) {
      return uploadMenuItemImage(file, nameHint)
    },
    async voidOrder(input) {
      await withOptimisticMutation(
        (draft) =>
          buildState(
            {
              ...draft,
              voids: [
                {
                  deviceOrderId: input.deviceOrderId,
                  voidReason: input.voidReason ?? 'Voided from Admin Web',
                  voidedBy: input.voidedBy ?? 'Admin Web',
                  voidedAt: new Date().toISOString(),
                },
                ...draft.voids,
              ],
            },
            draft,
          ),
        () => voidOrder(input),
      )
    },
    async saveRecipes(input) {
      await withOptimisticMutation(
        (draft) => buildState({ ...draft, recipes: input.recipes, recipeIngredients: input.ingredients }, draft),
        () => saveRecipeSet(input),
      )
    },
    async saveIngredientLogs(input) {
      await withOptimisticMutation(
        (draft) => buildState({ ...draft, ingredientLogs: input.logs }, draft),
        () => saveIngredientPriceLog(input),
      )
      const accounting = await fetchDailyAccountingRecords()
      if (!mountedRef.current) return
      setState((current) => buildState({ ...current, accounting }, current))
    },
    async saveIngredientRegistry(input) {
      await withOptimisticMutation(
        (draft) => buildState({ ...draft, ingredientCategories: input.categories, ingredientRegistry: input.ingredients }, draft),
        () => saveIngredientRegistry(input),
      )
    },
    async saveDailyLogMissingStartDate(startDate) {
      await withOptimisticMutation(
        (draft) => buildState({ ...draft, dailyLogMissingStartDate: startDate }, draft),
        () => saveDailyLogMissingStartDate(startDate),
      )
    },
    async transferCash(input) {
      await withOptimisticMutation((draft) => draft, () => transferCash(input))
    },
    async adjustCash(input) {
      await withOptimisticMutation((draft) => draft, () => adjustCash(input))
    },
    async cashPull(input) {
      await withOptimisticMutation((draft) => draft, () => cashPull(input))
    },
    async savePayable(input) {
      const nextPayables = [...state.payables.filter((item) => item.id !== input.payable.id), input.payable]
        .sort((left, right) => left.dueDateEpochMillis - right.dueDateEpochMillis)
      await withOptimisticMutation(
        (draft) => buildState({ ...draft, payables: nextPayables }, draft),
        () => savePayable(input),
      )
    },
    async resetOperationalData(input) {
      await withOptimisticMutation(
        () =>
          buildState(
            {
              lastRefreshedAt: state.lastRefreshedAt,
              halfOrderPriceSupported: state.halfOrderPriceSupported,
              orders: [],
              voids: [],
              categories: input?.clearMenuCatalog ? [] : state.categories,
              products: input?.clearMenuCatalog ? [] : state.products,
              recipes: [],
              recipeIngredients: [],
              ingredientLogs: [],
              ingredientCategories: state.ingredientCategories,
              ingredientRegistry: state.ingredientRegistry,
              dailyLogMissingStartDate: state.dailyLogMissingStartDate,
              accounting: [],
              cashMovements: [],
              payables: [],
            },
            state,
          ),
        () => resetOperationalData(input),
      )
    },
    async zeroSellableStock() {
      const nextProducts = state.products.map((product) =>
        product.isActive ? { ...product, stockCount: 0, isLowStock: true } : product,
      )
      await withOptimisticMutation(
        (draft) => buildState({ ...draft, products: nextProducts }, draft),
        () => zeroSellableStockInCloud(),
      )
    },
  }

  return <AdminDataContext.Provider value={value}>{children}</AdminDataContext.Provider>
}

export function useAdminDataContext() {
  const value = useContext(AdminDataContext)
  if (!value) {
    throw new Error('AdminDataProvider is missing from the React tree.')
  }
  return value
}
