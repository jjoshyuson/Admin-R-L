import { Component, useEffect, useMemo, useState } from 'react'
import type { ErrorInfo, ReactNode } from 'react'
import { AdminDataProvider } from './hooks/AdminDataContext'
import { useDashboardData } from './hooks/useDashboardData'
import { useFinanceData } from './hooks/useFinanceData'
import { useInventoryState } from './hooks/useInventoryState'
import { useMenuCatalog } from './hooks/useMenuCatalog'
import { useOrdersSync } from './hooks/useOrdersSync'
import { useRecipesAccounting } from './hooks/useRecipesAccounting'
import {
  calculateDailyAccounting,
  clearInventoryData,
  clearDailyLogsData,
  clearMenuCatalogData,
  clearOrdersData,
  clearRecipesData,
  recordInventoryCount,
  seedTroubleshootingData,
} from './lib/adminApi'
import { createRandomId } from './lib/randomId'
import { hasSupabaseConfig } from './lib/supabase/client'
import type {
  DailyAccountingRecord,
  IngredientPriceLog,
  MenuProduct,
  OrderRecord,
  OrderVoidRecord,
} from './lib/adminTypes'

type Period = 'Daily' | 'Weekly' | 'Monthly'
type InventoryRoute = 'overview' | 'configuration'
type AppTab = 'dashboard' | 'inventory' | 'daily-log' | 'more'
type IngredientStatus = 'healthy' | 'low' | 'critical'
type Frequency = 'Daily' | 'Weekly' | 'Monthly'
type AppMode = 'full-admin' | 'pos-only'
type DashboardMetricsPeriod = 'Today' | 'Week to date' | 'Month to date'
type SalesRange = 'Today' | 'Last 7 Days' | 'Week to Date' | 'Month to Date' | 'All Time'
type MoreRoute =
  | 'home'
  | 'sync'
  | 'orders'
  | 'sales-range'
  | 'menu-settings'
  | 'category-settings'
  | 'recipes'
  | 'finance-overview'
  | 'cash-drawer'
  | 'payables'
  | 'profit'
type MenuItemStatus = 'available' | 'unavailable' | 'hidden'
type CategoryIconKey =
  | 'default'
  | 'plate'
  | 'meal'
  | 'burger'
  | 'pizza'
  | 'noodles'
  | 'rice'
  | 'chicken'
  | 'meat'
  | 'seafood'
  | 'drink'
  | 'coffee'
  | 'dessert'
  | 'icecream'
  | 'bakery'
  | 'bundle'
  | 'prep'
  | 'sauce'
  | 'snack'
  | 'salad'
  | 'soup'
  | 'grill'

type MenuItem = {
  id: string
  name: string
  category: string
  description: string
  imagePath: string | null
  status: MenuItemStatus
  price: number
  halfPrice: number
}

type CategoryItem = {
  id: string
  name: string
  description: string
  icon: CategoryIconKey
  itemCount: number
  orderIndex: number
}

type ProductModalState =
  | { type: 'menu-item'; itemId: string | null }
  | { type: 'category'; categoryId: string | null }
  | null

type Ingredient = {
  id: string
  name: string
  category: string
  unit: string
  estimatedOnHand: number
  reorderLevel: number
  status: IngredientStatus
  countingEnabled: boolean
  countingFrequency: Frequency
  overdue: boolean
  usedByPeriod: Record<Period, number>
}

type PurchaseDrafts = Record<string, string>
type PurchaseErrors = Record<string, string>

type MetricCard = {
  label: string
  value: string
  hint?: string
  hintTone?: 'positive' | 'muted'
}

type FinancialMetric = {
  label: string
  value: string
  tone?: 'default' | 'danger'
}

type AlertCard = {
  title: string
  action: string
  icon: string
}

type DeviceStatus = {
  name: string
  syncTime: string
  pendingSales: string
  health: string
}

type ProductRow = {
  rank: number
  name: string
  revenue: string
  quantity: string
  secondaryRevenue: string
  secondaryQuantity: string
}

type ActivityLog = {
  actor: string
  detail: string
  ago: string
}

type SyncStatus = 'completed' | 'voided' | 'synced'

type OrderHistoryItem = {
  id: string
  itemCount: number
  total: string
  table: string
  payment: string
  device: string
  time: string
  status?: SyncStatus
}

type RecipeRecord = {
  id: string
  name: string
  category: string
  ingredients: number
  servings: number
  totalCost: string
  perServing: string
  image: string
  status?: SyncStatus
}

type MenuRecipeEntry = {
  menuItemId: string
  name: string
  category: string
  price: number
  halfPrice: number
  imagePath: string | null
  recipeId: string | null
  recipeStatusLabel: string
}

type PrepRecipeEntry = {
  id: string
  name: string
  category: string
  ingredients: number
  yieldLabel: string
  totalCost: string
}

type LogRecord = {
  id: string
  title: string
  detail: string
  relativeDate: string
  fullDate: string
  status?: SyncStatus
}

type DailyLogEntryDraft = {
  ingredientId: string
  ingredientName: string
  price: string
  unit: string
}

type DailyLogDraftState = {
  businessDate: string
  copiedFromLabel: string | null
  entries: DailyLogEntryDraft[]
  error: string
  saving: boolean
}

type ResetActionId =
  | 'testing-reset'
  | 'empty-everything'
  | 'safe-state'
  | 'clear-orders'
  | 'clear-menu'
  | 'clear-recipes'
  | 'clear-daily-logs'
  | 'clear-inventory'

type RecipeSummaryMetrics = {
  totalRecipeCost: number
  costPerServing: number
  revenue: number
  taxAmount: number
  netSales: number
  grossProfit: number
  netProfit: number
  grossMargin: number
  hasConversionIssue: boolean
}

type IngredientCatalogOption = {
  id: string
  name: string
  sourceType: 'ingredient' | 'recipe'
  unit: string
  price: number
  purchaseQuantity: number
}

type RecipeDraftLine = {
  id: string
  ingredientRefId: string
  ingredientRefType: 'ingredient' | 'recipe'
  ingredientName: string
  purchaseQuantity: string
  purchaseUnit: string
  recipeQuantity: string
  recipeUnit: string
}

type RecipeDraft = {
  id: string
  linkedMenuItemId: string | null
  recipeName: string
  recipeType: 'MENU_ITEM' | 'PREP'
  menuCategory: string
  halfOrderPrice: string
  servings: string
  pricePerServing: string
  yieldQuantity: string
  yieldUnit: string
  taxRatePercent: string
  ingredients: RecipeDraftLine[]
  summary: RecipeSummaryMetrics
}

type CashOverviewData = {
  openingCash: number
  cashSalesToday: number
  digitalPayments: number
  totalCashOnHand: number
}

type DateRangeValue = {
  start: string
  end: string
}

type SalesRangeSummary = {
  rangeLabel: string
  orderCount: number
  cashSales: number
  gcashSales: number
  otherSales: number
  totalSales: number
  averageOrder: number
}

type CashAccountType = 'safe' | 'tablet' | 'bank'

type CashAccount = {
  id: string
  name: string
  type: CashAccountType
  currentBalance: number
  expectedBalance: number
  salesToday: number
  lastActivityNote: string
  lastActivityAt: string
}

type CashMovementType = 'transfer' | 'adjustment' | 'cash_pull'

type CashMovement = {
  id: string
  type: CashMovementType
  fromAccountId: string | null
  toAccountId: string | null
  amount: number
  note: string
  createdAt: string
  createdBy: string
  deviceSource: string
  adjustmentDirection?: 'add' | 'remove'
}

type CashControlModal =
  | { type: 'transfer' }
  | { type: 'adjust' }
  | { type: 'cash_pull' }
  | { type: 'logs' }
  | { type: 'log_detail'; movementId: string }
  | null

type TransferDraft = {
  fromAccountId: string
  toAccountId: string
  amount: string
  note: string
}

type AdjustDraft = {
  accountId: string
  adjustmentType: 'add' | 'remove'
  amount: string
  note: string
}

type CashPullDraft = {
  fromAccountId: string
  amount: string
  note: string
}

type BillRecord = {
  id: string
  vendor: string
  dueDate: string
  amount: number
  paid: boolean
}

type ProfitData = {
  revenue: number
  cogs: number
}

const periods: Period[] = ['Daily', 'Weekly', 'Monthly']
const categoryOrder = ['All', 'Meat', 'Beverage', 'Dairy', 'General', 'Produce', 'Seafood']
const dashboardPeriods: DashboardMetricsPeriod[] = ['Today', 'Week to date', 'Month to date']
const salesRanges: SalesRange[] = ['Today', 'Last 7 Days', 'Week to Date', 'Month to Date', 'All Time']
const menuFilterChips = ['All']
const recipeFilterChips = ['All', 'Meals', 'Dishes', 'Drinks', 'Bundles', 'Desserts']
const paymentFilters = ['All Methods', 'GCash', 'Cash', 'Card']
const deviceFilters = ['All Devices', 'Tablet 1', 'Tablet 2', 'Bank/GCash']
const categoryIconOptions: Array<{ value: CategoryIconKey; label: string }> = [
  { value: 'default', label: 'Default' },
  { value: 'plate', label: 'Plate' },
  { value: 'meal', label: 'Meal' },
  { value: 'burger', label: 'Burger' },
  { value: 'pizza', label: 'Pizza' },
  { value: 'noodles', label: 'Noodles' },
  { value: 'rice', label: 'Rice Bowl' },
  { value: 'chicken', label: 'Chicken' },
  { value: 'meat', label: 'Meat' },
  { value: 'seafood', label: 'Seafood' },
  { value: 'drink', label: 'Drink' },
  { value: 'coffee', label: 'Coffee' },
  { value: 'dessert', label: 'Dessert' },
  { value: 'icecream', label: 'Ice Cream' },
  { value: 'bakery', label: 'Bakery' },
  { value: 'bundle', label: 'Bundle' },
  { value: 'prep', label: 'Prep' },
  { value: 'sauce', label: 'Sauce' },
  { value: 'snack', label: 'Snack' },
  { value: 'salad', label: 'Salad' },
  { value: 'soup', label: 'Soup' },
  { value: 'grill', label: 'Grill' },
]
const financeBusinessDate = new Date('2026-05-02T09:00:00+08:00')

const initialIngredients: Ingredient[] = [
  {
    id: 'ing-ribeye',
    name: 'Ribeye Steak',
    category: 'Meat',
    unit: 'KG',
    estimatedOnHand: 15.2,
    reorderLevel: 5,
    status: 'low',
    countingEnabled: true,
    countingFrequency: 'Daily',
    overdue: false,
    usedByPeriod: { Daily: 2.1, Weekly: 9.4, Monthly: 32.2 },
  },
  {
    id: 'ing-brew',
    name: 'Cold Brew Base',
    category: 'Beverage',
    unit: 'L',
    estimatedOnHand: 2.3,
    reorderLevel: 5,
    status: 'critical',
    countingEnabled: true,
    countingFrequency: 'Daily',
    overdue: true,
    usedByPeriod: { Daily: 2.1, Weekly: 8.6, Monthly: 27.8 },
  },
  {
    id: 'ing-milk',
    name: 'Fresh Milk',
    category: 'Dairy',
    unit: 'L',
    estimatedOnHand: 11.4,
    reorderLevel: 4,
    status: 'healthy',
    countingEnabled: false,
    countingFrequency: 'Weekly',
    overdue: false,
    usedByPeriod: { Daily: 1.2, Weekly: 5.8, Monthly: 18.4 },
  },
  {
    id: 'ing-pom',
    name: 'Pomfret Fillet',
    category: 'Produce',
    unit: 'KG',
    estimatedOnHand: 4.8,
    reorderLevel: 4,
    status: 'low',
    countingEnabled: true,
    countingFrequency: 'Weekly',
    overdue: true,
    usedByPeriod: { Daily: 0.8, Weekly: 4.1, Monthly: 12.6 },
  },
  {
    id: 'ing-cups',
    name: 'Soup Cups',
    category: 'General',
    unit: 'Units',
    estimatedOnHand: 88,
    reorderLevel: 20,
    status: 'healthy',
    countingEnabled: true,
    countingFrequency: 'Monthly',
    overdue: false,
    usedByPeriod: { Daily: 12, Weekly: 44, Monthly: 180 },
  },
  {
    id: 'ing-tuna',
    name: 'Tuna Loin',
    category: 'Seafood',
    unit: 'KG',
    estimatedOnHand: 3.1,
    reorderLevel: 4.5,
    status: 'critical',
    countingEnabled: true,
    countingFrequency: 'Daily',
    overdue: false,
    usedByPeriod: { Daily: 1.4, Weekly: 6.1, Monthly: 19.5 },
  },
]

function buildMenuArt(title: string, topColor: string, bottomColor: string) {
  const initials = title
    .split(' ')
    .map((part) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase()
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 160 160">
      <defs>
        <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stop-color="${topColor}" />
          <stop offset="100%" stop-color="${bottomColor}" />
        </linearGradient>
      </defs>
      <rect width="160" height="160" rx="28" fill="url(#g)" />
      <circle cx="80" cy="62" r="30" fill="rgba(255,255,255,0.24)" />
      <rect x="30" y="102" width="100" height="16" rx="8" fill="rgba(255,255,255,0.28)" />
      <text x="80" y="90" text-anchor="middle" font-family="Segoe UI, Arial, sans-serif" font-size="32" font-weight="700" fill="white">${initials}</text>
    </svg>
  `
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`
}

function normalizeMenuImagePath(imagePath: string | null | undefined) {
  if (!imagePath) {
    return null
  }

  const normalized = imagePath.trim()
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

function normalizeCategoryNameKey(value: string) {
  return value.trim().toLowerCase().replace(/\s+/g, '-')
}

function inferCategoryIcon(name: string): CategoryIconKey {
  const key = normalizeCategoryNameKey(name)
  if (key.includes('beverage') || key.includes('drink') || key.includes('coffee') || key.includes('shake')) {
    return key.includes('coffee') ? 'coffee' : 'drink'
  }
  if (key.includes('dessert') || key.includes('cake') || key.includes('sweet')) {
    return 'dessert'
  }
  if (key.includes('bundle') || key.includes('set')) {
    return 'bundle'
  }
  if (key.includes('noodle') || key.includes('pancit') || key.includes('pasta')) {
    return 'noodles'
  }
  if (key.includes('rice')) {
    return 'rice'
  }
  if (key.includes('chicken')) {
    return 'chicken'
  }
  if (key.includes('meat') || key.includes('beef') || key.includes('pork')) {
    return 'meat'
  }
  if (key.includes('seafood') || key.includes('fish') || key.includes('shrimp')) {
    return 'seafood'
  }
  if (key.includes('burger')) {
    return 'burger'
  }
  if (key.includes('pizza')) {
    return 'pizza'
  }
  if (key.includes('bread') || key.includes('bakery')) {
    return 'bakery'
  }
  if (key.includes('snack') || key.includes('side')) {
    return 'snack'
  }
  if (key.includes('salad') || key.includes('vegetable')) {
    return 'salad'
  }
  if (key.includes('soup')) {
    return 'soup'
  }
  if (key.includes('grill')) {
    return 'grill'
  }
  if (key.includes('meal')) {
    return 'meal'
  }
  if (key.includes('prep') || key.includes('sauce') || key.includes('mix')) {
    return key.includes('sauce') ? 'sauce' : 'prep'
  }
  if (key.includes('dish') || key.includes('main')) {
    return 'plate'
  }
  return 'default'
}

function readStoredCategoryIcons(): Record<string, CategoryIconKey> {
  if (typeof window === 'undefined') {
    return {}
  }
  try {
    const parsed = JSON.parse(window.localStorage.getItem('admin-web-category-icons') ?? '{}') as Record<string, string>
    return Object.fromEntries(
      Object.entries(parsed).filter(([, value]) =>
        categoryIconOptions.some((option) => option.value === value),
      ),
    ) as Record<string, CategoryIconKey>
  } catch {
    return {}
  }
}

function getCategoryIcon(iconMap: Record<string, CategoryIconKey>, name: string): CategoryIconKey {
  return iconMap[normalizeCategoryNameKey(name)] ?? inferCategoryIcon(name)
}

function safeIsoFromEpoch(value: number) {
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? '' : date.toISOString()
}

function CategoryIconBadge({ icon }: { icon: CategoryIconKey }) {
  const label = categoryIconOptions.find((option) => option.value === icon)?.label ?? 'Category'
  return (
    <span className={`category-icon-badge category-icon-${icon}`} aria-label={`${label} icon`} role="img">
      <CategoryIconSvg icon={icon} />
    </span>
  )
}

function CategoryIconSvg({ icon }: { icon: CategoryIconKey }) {
  if (icon === 'drink') {
    return <svg viewBox="0 0 24 24" className="category-icon-svg" aria-hidden="true"><path d="M7 4h10l-1.1 13.4A2.8 2.8 0 0 1 13.1 20h-2.2a2.8 2.8 0 0 1-2.8-2.6L7 4Z" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" /><path d="M8 8h8M10 12h4" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" /></svg>
  }
  if (icon === 'coffee') {
    return <svg viewBox="0 0 24 24" className="category-icon-svg" aria-hidden="true"><path d="M6 8h10v5a4 4 0 0 1-4 4h-2a4 4 0 0 1-4-4V8Z" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" /><path d="M16 10h1.4a2 2 0 0 1 0 4H16M8 4v2M12 4v2M4 20h14" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" /></svg>
  }
  if (icon === 'dessert') {
    return <svg viewBox="0 0 24 24" className="category-icon-svg" aria-hidden="true"><path d="M6 12h12v3a5 5 0 0 1-5 5h-2a5 5 0 0 1-5-5v-3Z" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" /><path d="M8 12c0-3 2-5 4-5s4 2 4 5M12 4v3" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" /></svg>
  }
  if (icon === 'icecream') {
    return <svg viewBox="0 0 24 24" className="category-icon-svg" aria-hidden="true"><path d="M8 10a4 4 0 0 1 8 0v1H8v-1ZM9 11l3 9 3-9" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" /><path d="M10 15h4" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" /></svg>
  }
  if (icon === 'bundle') {
    return <svg viewBox="0 0 24 24" className="category-icon-svg" aria-hidden="true"><path d="M5 8h14v11H5zM8 8V5h8v3" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" /><path d="M12 8v11M5 13h14" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" /></svg>
  }
  if (icon === 'meal') {
    return <svg viewBox="0 0 24 24" className="category-icon-svg" aria-hidden="true"><circle cx="12" cy="12" r="7" fill="none" stroke="currentColor" strokeWidth="1.7" /><circle cx="12" cy="12" r="3" fill="none" stroke="currentColor" strokeWidth="1.7" /></svg>
  }
  if (icon === 'plate') {
    return <svg viewBox="0 0 24 24" className="category-icon-svg" aria-hidden="true"><path d="M5 11h14M7 11a5 5 0 0 1 10 0M7 15h10" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" /></svg>
  }
  if (icon === 'burger') {
    return <svg viewBox="0 0 24 24" className="category-icon-svg" aria-hidden="true"><path d="M6 11a6 6 0 0 1 12 0H6ZM5 15h14M7 18h10" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" /><path d="M10 8h.1M14 8h.1" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" /></svg>
  }
  if (icon === 'pizza') {
    return <svg viewBox="0 0 24 24" className="category-icon-svg" aria-hidden="true"><path d="M5 5c5 0 10 2 14 6L10 20 5 5Z" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" /><path d="M8 9h.1M12 11h.1M10 15h.1" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" /></svg>
  }
  if (icon === 'noodles') {
    return <svg viewBox="0 0 24 24" className="category-icon-svg" aria-hidden="true"><path d="M6 11h12l-1.3 6.2A3.5 3.5 0 0 1 13.3 20h-2.6a3.5 3.5 0 0 1-3.4-2.8L6 11Z" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" /><path d="M8 5v6M11 4v7M14 5v6M17 4v7" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" /></svg>
  }
  if (icon === 'rice') {
    return <svg viewBox="0 0 24 24" className="category-icon-svg" aria-hidden="true"><path d="M6 12h12l-2 7H8l-2-7Z" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" /><path d="M8 12c1-3 7-3 8 0M10 8l2 2 2-2" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" /></svg>
  }
  if (icon === 'chicken') {
    return <svg viewBox="0 0 24 24" className="category-icon-svg" aria-hidden="true"><path d="M8.5 14.5a5 5 0 1 1 7-7l-7 7Z" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" /><path d="M8.5 14.5 5 18m0 0-2 2m2-2 2 2M15.5 7.5 18 5" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" /></svg>
  }
  if (icon === 'meat') {
    return <svg viewBox="0 0 24 24" className="category-icon-svg" aria-hidden="true"><path d="M7 15c-2-2-2-5 0-7 3-3 8-3 10 0s1 7-2 9c-3 2-6 1-8-2Z" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" /><circle cx="10" cy="11" r="1.6" fill="none" stroke="currentColor" strokeWidth="1.7" /></svg>
  }
  if (icon === 'seafood') {
    return <svg viewBox="0 0 24 24" className="category-icon-svg" aria-hidden="true"><path d="M4 12c3-4 8-4 12 0-4 4-9 4-12 0Z" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" /><path d="M16 12 20 8v8l-4-4ZM8 12h.1" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" /></svg>
  }
  if (icon === 'bakery') {
    return <svg viewBox="0 0 24 24" className="category-icon-svg" aria-hidden="true"><path d="M6 13c0-4 3-7 6-7s6 3 6 7v4a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2v-4Z" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" /><path d="M9 10c1 1 2 1 3 0s2-1 3 0" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" /></svg>
  }
  if (icon === 'prep') {
    return <svg viewBox="0 0 24 24" className="category-icon-svg" aria-hidden="true"><path d="M7 7h10v11a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2V7ZM9 4h6v3H9z" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" /><path d="M10 12h4M10 16h4" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" /></svg>
  }
  if (icon === 'sauce') {
    return <svg viewBox="0 0 24 24" className="category-icon-svg" aria-hidden="true"><path d="M9 5h6l1 5v8a2 2 0 0 1-2 2h-4a2 2 0 0 1-2-2v-8l1-5ZM9 10h6" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" /><path d="M11 14h2" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" /></svg>
  }
  if (icon === 'snack') {
    return <svg viewBox="0 0 24 24" className="category-icon-svg" aria-hidden="true"><path d="M7 8h10l-1 12H8L7 8ZM9 4h6l2 4H7l2-4Z" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" /><path d="M10 12h4M10 16h4" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" /></svg>
  }
  if (icon === 'salad') {
    return <svg viewBox="0 0 24 24" className="category-icon-svg" aria-hidden="true"><path d="M6 12h12l-1.2 5A4 4 0 0 1 13 20h-2a4 4 0 0 1-3.8-3L6 12Z" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" /><path d="M8 10c1-3 4-4 6-1 1-2 3-2 4 1" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" /></svg>
  }
  if (icon === 'soup') {
    return <svg viewBox="0 0 24 24" className="category-icon-svg" aria-hidden="true"><path d="M5 12h14v2a5 5 0 0 1-5 5h-4a5 5 0 0 1-5-5v-2Z" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" /><path d="M8 8c1 1 2 1 3 0s2-1 3 0M18 12l2-2" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" /></svg>
  }
  if (icon === 'grill') {
    return <svg viewBox="0 0 24 24" className="category-icon-svg" aria-hidden="true"><path d="M6 10h12v2a6 6 0 0 1-12 0v-2ZM8 20l2-4M16 20l-2-4" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" /><path d="M8 5v2M12 4v3M16 5v2" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" /></svg>
  }
  return (
    <svg viewBox="0 0 24 24" className="category-icon-svg" aria-hidden="true">
      <path d="M6 6h12v12H6z" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" />
      <path d="M9 10h6M9 14h6" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
    </svg>
  )
}

function buildMenuImageFallbackLabel(name: string) {
  return name
    .split(' ')
    .map((part) => part[0] ?? '')
    .join('')
    .slice(0, 2)
    .toUpperCase() || 'MI'
}

type SafeMenuImageProps = {
  name: string
  imagePath: string | null
  className: string
  alt?: string
}

function SafeMenuImage({ name, imagePath, className, alt }: SafeMenuImageProps) {
  const normalizedImagePath = normalizeMenuImagePath(imagePath)
  const [loadFailed, setLoadFailed] = useState(false)

  useEffect(() => {
    setLoadFailed(false)
  }, [normalizedImagePath])

  if (normalizedImagePath && !loadFailed) {
    return (
      <img
        className={className}
        src={normalizedImagePath}
        alt={alt ?? name}
        onError={() => setLoadFailed(true)}
      />
    )
  }

  return (
    <div className={`${className} thumb-fallback`} role="img" aria-label={alt ?? `${name} placeholder`}>
      <span>{buildMenuImageFallbackLabel(name)}</span>
    </div>
  )
}

type AppErrorBoundaryProps = {
  children: ReactNode
}

type AppErrorBoundaryState = {
  error: Error | null
}

class AppErrorBoundary extends Component<AppErrorBoundaryProps, AppErrorBoundaryState> {
  state: AppErrorBoundaryState = {
    error: null,
  }

  static getDerivedStateFromError(error: Error) {
    return { error }
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('AppErrorBoundary caught an error', error, errorInfo)
  }

  render() {
    if (!this.state.error) {
      return this.props.children
    }

    return (
      <main className="app-shell">
        <section className="screen-body inventory-screen" aria-label="Admin web mobile shell">
          <div className="app-content">
            <div className="placeholder-screen">
              <article className="placeholder-card">
                <p className="placeholder-label">Application Error</p>
                <h1>Something went wrong in Admin Web.</h1>
                <p>{this.state.error.message || 'An unexpected error interrupted this screen.'}</p>
                <button
                  type="button"
                  className="ghost-pill placeholder-action"
                  onClick={() => {
                    this.setState({ error: null })
                    if (typeof window !== 'undefined') {
                      window.location.reload()
                    }
                  }}
                >
                  Reload App
                </button>
              </article>
            </div>
          </div>
        </section>
      </main>
    )
  }
}

const initialMenuItems: MenuItem[] = [
  {
    id: 'menu-double-cheeseburger',
    name: 'Double Cheeseburger',
    category: 'Dishes',
    description: 'Classic Beef Patty',
    imagePath: buildMenuArt('Double Cheeseburger', '#b96e2d', '#5b3717'),
    status: 'available',
    price: 289,
    halfPrice: 169,
  },
  {
    id: 'menu-chocolate-lava-cake',
    name: 'Chocolate Lava Cake',
    category: 'Desserts',
    description: 'Warm center and dark chocolate',
    imagePath: buildMenuArt('Chocolate Lava Cake', '#5e3a2f', '#24140f'),
    status: 'available',
    price: 220,
    halfPrice: 0,
  },
  {
    id: 'menu-family-taco-bundle',
    name: 'Family Taco Bundle',
    category: 'Bundles',
    description: 'Serves four with sides',
    imagePath: buildMenuArt('Family Taco Bundle', '#d6a63c', '#7a4f14'),
    status: 'unavailable',
    price: 899,
    halfPrice: 0,
  },
  {
    id: 'menu-chef-special-pasta',
    name: "Chef's Special Pasta",
    category: 'Meals',
    description: 'Roasted garlic cream sauce',
    imagePath: buildMenuArt("Chef's Special Pasta", '#f2b269', '#b85a28'),
    status: 'hidden',
    price: 410,
    halfPrice: 235,
  },
  {
    id: 'menu-vanilla-milkshake',
    name: 'Vanilla Milkshake',
    category: 'Desserts',
    description: 'Vanilla bean and fresh cream',
    imagePath: buildMenuArt('Vanilla Milkshake', '#ebe5d0', '#b8b8a4'),
    status: 'available',
    price: 185,
    halfPrice: 0,
  },
]

const initialCategories: CategoryItem[] = [
  {
    id: 'cat-desserts',
    name: 'Desserts',
    description: 'Cakes, sweets, and after-meal options',
    icon: 'dessert',
    itemCount: 8,
    orderIndex: 0,
  },
  {
    id: 'cat-bundles',
    name: 'Bundles',
    description: 'Group meals and shared sets',
    icon: 'bundle',
    itemCount: 4,
    orderIndex: 1,
  },
  {
    id: 'cat-dishes',
    name: 'Dishes',
    description: 'Core plated dishes and mains',
    icon: 'plate',
    itemCount: 14,
    orderIndex: 2,
  },
  {
    id: 'cat-meals',
    name: 'Meals',
    description: 'Complete meal combinations',
    icon: 'meal',
    itemCount: 9,
    orderIndex: 3,
  },
  {
    id: 'cat-beverages',
    name: 'Beverages',
    description: 'Coffee, shakes, and cold drinks',
    icon: 'drink',
    itemCount: 11,
    orderIndex: 4,
  },
]

void initialMenuItems
void initialCategories

const initialCashOverview: CashOverviewData = {
  openingCash: 2875.4,
  cashSalesToday: 980.5,
  digitalPayments: 694.9,
  totalCashOnHand: 1675.4,
}

const initialCashAccounts: CashAccount[] = [
  {
    id: 'main-safe',
    name: 'Main Safe',
    type: 'safe',
    currentBalance: 5200,
    expectedBalance: 5200,
    salesToday: 0,
    lastActivityNote: 'Opening float verified',
    lastActivityAt: '2026-05-02T08:05:00+08:00',
  },
  {
    id: 'tablet-1',
    name: 'Tablet 1',
    type: 'tablet',
    currentBalance: 980,
    expectedBalance: 980,
    salesToday: 980,
    lastActivityNote: 'Cash sales posted from lunch service',
    lastActivityAt: '2026-05-02T13:12:00+08:00',
  },
  {
    id: 'tablet-2',
    name: 'Tablet 2',
    type: 'tablet',
    currentBalance: 640,
    expectedBalance: 640,
    salesToday: 640,
    lastActivityNote: 'Counter cash locked after shift handoff',
    lastActivityAt: '2026-05-02T14:45:00+08:00',
  },
  {
    id: 'bank-gcash',
    name: 'Bank / GCash',
    type: 'bank',
    currentBalance: 1725.4,
    expectedBalance: 1725.4,
    salesToday: 694.9,
    lastActivityNote: 'GCash settlement batched',
    lastActivityAt: '2026-05-02T15:02:00+08:00',
  },
]

function manilaDateOffset(daysOffset = 0) {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Manila',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  })
  const parts = formatter.formatToParts(new Date(Date.now() + daysOffset * 24 * 60 * 60 * 1000))
  const year = parts.find((part) => part.type === 'year')?.value ?? '2026'
  const month = parts.find((part) => part.type === 'month')?.value ?? '01'
  const day = parts.find((part) => part.type === 'day')?.value ?? '01'
  return `${year}-${month}-${day}`
}

function isoAtManila(date: string, hour: number, minute: number) {
  const hh = String(hour).padStart(2, '0')
  const mm = String(minute).padStart(2, '0')
  return `${date}T${hh}:${mm}:00+08:00`
}

function buildTroubleshootingSeedData() {
  const businessDate = manilaDateOffset(0)
  const previousDate = manilaDateOffset(-1)

  return {
    businessDate,
    orders: [
      {
        deviceOrderId: 'DBG-2001',
        deviceId: 'tablet-1',
        paymentMethod: 'Cash',
        paymentReference: null,
        cashAmount: 369,
        gcashAmount: 0,
        subtotal: 329.46,
        tax: 39.54,
        total: 369,
        createdAt: isoAtManila(businessDate, 10, 15),
        items: [
          { name: 'Debug Classic Burger', quantity: 1, lineTotal: 249 },
          { name: 'Debug Cold Brew', quantity: 1, lineTotal: 120 },
        ],
      },
      {
        deviceOrderId: 'DBG-2002',
        deviceId: 'tablet-2',
        paymentMethod: 'GCash',
        paymentReference: '7841',
        cashAmount: 0,
        gcashAmount: 498,
        subtotal: 444.64,
        tax: 53.36,
        total: 498,
        createdAt: isoAtManila(businessDate, 12, 40),
        items: [
          { name: 'Debug Classic Burger', quantity: 2, lineTotal: 498 },
        ],
      },
    ],
    voids: [
      {
        deviceOrderId: 'DBG-1999',
        voidReason: 'Operational test void',
        voidedBy: 'Admin Web',
        voidedAt: isoAtManila(previousDate, 21, 10),
      },
    ],
    ingredientLogs: [
      { ingredientId: 'dbg-beef', ingredientName: 'Debug Beef Patty', businessDate, price: 95, unit: 'pc', sourceLogId: 'dbg-log-1', sourceLogTitle: 'Admin Web Seed' },
      { ingredientId: 'dbg-bun', ingredientName: 'Debug Brioche Bun', businessDate, price: 18, unit: 'pc', sourceLogId: 'dbg-log-1', sourceLogTitle: 'Admin Web Seed' },
      { ingredientId: 'dbg-sauce', ingredientName: 'Debug Burger Sauce', businessDate, price: 140, unit: 'l', sourceLogId: 'dbg-log-1', sourceLogTitle: 'Admin Web Seed' },
      { ingredientId: 'dbg-coffee', ingredientName: 'Debug Coffee Grounds', businessDate, price: 900, unit: 'kg', sourceLogId: 'dbg-log-1', sourceLogTitle: 'Admin Web Seed' },
      { ingredientId: 'dbg-water', ingredientName: 'Debug Filtered Water', businessDate, price: 45, unit: 'gal', sourceLogId: 'dbg-log-1', sourceLogTitle: 'Admin Web Seed' },
    ],
    recipes: [
      {
        id: 'dbg-recipe-burger',
        recipeName: 'Debug Classic Burger',
        recipeType: 'MENU_ITEM' as const,
        menuCategory: 'Meals',
        servings: 1,
        pricePerServing: 249,
        yieldQuantity: 1,
        yieldUnit: 'pc',
        taxRatePercent: 12,
      },
      {
        id: 'dbg-recipe-cold-brew',
        recipeName: 'Debug Cold Brew',
        recipeType: 'MENU_ITEM' as const,
        menuCategory: 'Drinks',
        servings: 1,
        pricePerServing: 120,
        yieldQuantity: 1,
        yieldUnit: 'cup',
        taxRatePercent: 12,
      },
    ],
    recipeIngredients: [
      { id: 'dbg-ri-1', recipeId: 'dbg-recipe-burger', ingredientRefId: 'dbg-beef', ingredientRefType: 'ingredient', ingredientName: 'Debug Beef Patty', purchaseQuantity: 1, purchaseUnit: 'pc', recipeQuantity: 1, recipeUnit: 'pc', sortOrder: 0 },
      { id: 'dbg-ri-2', recipeId: 'dbg-recipe-burger', ingredientRefId: 'dbg-bun', ingredientRefType: 'ingredient', ingredientName: 'Debug Brioche Bun', purchaseQuantity: 1, purchaseUnit: 'pc', recipeQuantity: 1, recipeUnit: 'pc', sortOrder: 1 },
      { id: 'dbg-ri-3', recipeId: 'dbg-recipe-burger', ingredientRefId: 'dbg-sauce', ingredientRefType: 'ingredient', ingredientName: 'Debug Burger Sauce', purchaseQuantity: 1, purchaseUnit: 'l', recipeQuantity: 0.02, recipeUnit: 'l', sortOrder: 2 },
      { id: 'dbg-ri-4', recipeId: 'dbg-recipe-cold-brew', ingredientRefId: 'dbg-coffee', ingredientRefType: 'ingredient', ingredientName: 'Debug Coffee Grounds', purchaseQuantity: 1, purchaseUnit: 'kg', recipeQuantity: 0.018, recipeUnit: 'kg', sortOrder: 0 },
      { id: 'dbg-ri-5', recipeId: 'dbg-recipe-cold-brew', ingredientRefId: 'dbg-water', ingredientRefType: 'ingredient', ingredientName: 'Debug Filtered Water', purchaseQuantity: 1, purchaseUnit: 'gal', recipeQuantity: 0.063, recipeUnit: 'gal', sortOrder: 1 },
    ],
    cashMovements: [
      {
        id: 'dbg-movement-open',
        accountId: 'main-safe',
        accountType: 'SAFE' as const,
        sourceAccountId: null,
        destinationAccountId: 'main-safe',
        movementKind: 'OPENING_FLOAT' as const,
        reasonCategory: 'Opening Float',
        amount: 2500,
        note: 'Admin web troubleshooting seed',
        relatedBillId: null,
        createdBy: 'Admin Web',
        createdAtEpochMillis: Date.parse(isoAtManila(businessDate, 8, 0)),
      },
      {
        id: 'dbg-movement-transfer',
        accountId: 'tablet-1',
        accountType: 'TABLET_DRAWER' as const,
        sourceAccountId: 'main-safe',
        destinationAccountId: 'tablet-1',
        movementKind: 'TRANSFER_IN' as const,
        reasonCategory: 'Transfer',
        amount: 500,
        note: 'Seeded change fund',
        relatedBillId: null,
        createdBy: 'Admin Web',
        createdAtEpochMillis: Date.parse(isoAtManila(businessDate, 8, 20)),
      },
    ],
    payables: [
      {
        id: 'dbg-payable-1',
        title: 'Debug Produce Delivery',
        vendorName: 'Debug Supplier',
        category: 'Supplies',
        cashFlowClass: 'OPERATING' as const,
        amount: 780,
        dueDateEpochMillis: Date.parse(`${businessDate}T00:00:00+08:00`),
        status: 'OPEN' as const,
        paymentSource: null,
        paidAtEpochMillis: null,
        note: 'Troubleshooting seed payable',
        createdBy: 'Admin Web',
        createdAtEpochMillis: Date.parse(isoAtManila(previousDate, 16, 30)),
      },
    ],
  }
}

function App() {
  return (
    <AdminDataProvider>
      <AppErrorBoundary>
        <AdminShell />
      </AppErrorBoundary>
    </AdminDataProvider>
  )
}

function AdminShell() {
  const { loading, error } = useDashboardData()
  const {
    orders,
    orderHistory,
    voids,
    syncItems,
    loading: syncLoading,
    error: syncError,
    lastRefreshedAt,
    refresh: refreshSyncData,
    voidOrder: voidOrderMutation,
  } = useOrdersSync()
  const {
    categories: remoteCategories,
    products: remoteProducts,
    halfOrderPriceSupported,
    refresh: refreshMenuCatalog,
    setCategoriesAndProducts,
  } = useMenuCatalog()
  const {
    recipes,
    accounting,
    recipeViews,
    logViews,
    profitData: profitDataView,
    ingredientLogs,
    recipeIngredients,
    refresh: refreshRecipesAccounting,
    saveRecipes: saveRecipesMutation,
    saveIngredientLogs: saveIngredientLogsMutation,
  } = useRecipesAccounting()
  const {
    cashAccounts: remoteCashAccounts,
    cashMovements,
    payables,
    billViews,
    transferCash: transferCashMutation,
    adjustCash: adjustCashMutation,
    cashPull: cashPullMutation,
    refresh: refreshFinanceData,
    resetOperationalData: resetOperationalDataMutation,
    zeroSellableStock: zeroSellableStockMutation,
  } = useFinanceData()
  const { ingredients, setIngredients, persistIngredients } = useInventoryState(ingredientLogs, recipeIngredients)
  const [activeTab, setActiveTab] = useState<AppTab>('more')
  const [inventoryRoute, setInventoryRoute] = useState<InventoryRoute>('overview')
  const [moreRoute, setMoreRoute] = useState<MoreRoute>('home')
  const [menuItems, setMenuItems] = useState<MenuItem[]>([])
  const [categories, setCategories] = useState<CategoryItem[]>([])
  const [categoryIconMap, setCategoryIconMap] = useState<Record<string, CategoryIconKey>>(() => readStoredCategoryIcons())
  const [menuSearch, setMenuSearch] = useState('')
  const [activeMenuCategory, setActiveMenuCategory] = useState('All')
  const [orderPaymentFilter, setOrderPaymentFilter] = useState('All Methods')
  const [orderDeviceFilter, setOrderDeviceFilter] = useState('All Devices')
  const [orderDateRange, setOrderDateRange] = useState<DateRangeValue>(() => ({
    start: manilaDateOffset(-6),
    end: manilaDateOffset(0),
  }))
  const [salesDateRange, setSalesDateRange] = useState<DateRangeValue>(() => ({
    start: manilaDateOffset(-6),
    end: manilaDateOffset(0),
  }))
  const [activeRecipeFilter, setActiveRecipeFilter] = useState('All')
  const [dashboardMetricsPeriod, setDashboardMetricsPeriod] = useState<DashboardMetricsPeriod>('Today')
  const [salesRange, setSalesRange] = useState<SalesRange>('Last 7 Days')
  const [dailyLogDraft, setDailyLogDraft] = useState<DailyLogDraftState | null>(null)
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null)
  const [recipeDraft, setRecipeDraft] = useState<RecipeDraft | null>(null)
  const [recipeDraftError, setRecipeDraftError] = useState('')
  const [cashControlModal, setCashControlModal] = useState<CashControlModal>(null)
  const [selectedCashAccountId, setSelectedCashAccountId] = useState('main-safe')
  const [transferDraft, setTransferDraft] = useState<TransferDraft>({
    fromAccountId: 'main-safe',
    toAccountId: 'tablet-1',
    amount: '',
    note: '',
  })
  const [adjustDraft, setAdjustDraft] = useState<AdjustDraft>({
    accountId: 'tablet-2',
    adjustmentType: 'add',
    amount: '',
    note: '',
  })
  const [cashPullDraft, setCashPullDraft] = useState<CashPullDraft>({
    fromAccountId: 'tablet-1',
    amount: '',
    note: '',
  })
  const [manualRefreshBusy, setManualRefreshBusy] = useState(false)
  const [seedSyncBusy, setSeedSyncBusy] = useState(false)
  const [cashControlError, setCashControlError] = useState('')
  const [cashControlNotice, setCashControlNotice] = useState('')
  const [productModal, setProductModal] = useState<ProductModalState>(null)
  const [draggedCategoryId, setDraggedCategoryId] = useState<string | null>(null)
  const [period, setPeriod] = useState<Period>('Daily')
  const [activeCategory, setActiveCategory] = useState<string>('All')
  const [isPurchaseModalOpen, setPurchaseModalOpen] = useState(false)
  const [purchaseDrafts, setPurchaseDrafts] = useState<PurchaseDrafts>({})
  const [purchaseErrors, setPurchaseErrors] = useState<PurchaseErrors>({})
  const [activeFixCountId, setActiveFixCountId] = useState<string | null>(null)
  const [fixCountValue, setFixCountValue] = useState('')
  const [fixCountError, setFixCountError] = useState('')
  const [isSynced, setIsSynced] = useState(true)
  const [flashMessage, setFlashMessage] = useState('Connected to live admin data.')
  const [appMode, setAppMode] = useState<AppMode>(() => {
    if (typeof window === 'undefined') {
      return 'full-admin'
    }
    const saved = window.localStorage.getItem('admin-web-app-mode')
    return saved === 'pos-only' ? 'pos-only' : 'full-admin'
  })
  const [isResetModalOpen, setResetModalOpen] = useState(false)
  const [resetConfirmation, setResetConfirmation] = useState('')
  const [resetWorkingAction, setResetWorkingAction] = useState<ResetActionId | null>(null)
  const [resetStatusMessage, setResetStatusMessage] = useState('')
  const [resetErrorMessage, setResetErrorMessage] = useState('')
  const inventoryItems = ingredients.length > 0 ? ingredients : initialIngredients

  useEffect(() => {
    if (appMode !== 'pos-only') {
      return
    }
    if (activeTab === 'inventory' || activeTab === 'daily-log') {
      setActiveTab('dashboard')
    }
  }, [activeTab, appMode])

  useEffect(() => {
    if (appMode !== 'pos-only') {
      return
    }
    if (moreRoute === 'payables' || moreRoute === 'profit') {
      setMoreRoute('home')
    }
  }, [appMode, moreRoute])

  useEffect(() => {
    const activeProducts = remoteProducts.filter((product) => product.isActive)
    const categoryItemCount = activeProducts.reduce<Map<string, number>>((acc, product) => {
      const current = acc.get(product.categoryId) ?? 0
      acc.set(product.categoryId, current + 1)
      return acc
    }, new Map())
    const canonicalRemoteCategories = new Map<string, typeof remoteCategories[number]>()
    for (const category of [...remoteCategories].sort((left, right) => left.sortOrder - right.sortOrder)) {
      const normalizedKey = normalizeCategoryNameKey(category.name)
      if (!normalizedKey) {
        continue
      }
      const current = canonicalRemoteCategories.get(normalizedKey)
      if (
        !current ||
        (current.isActive === false && category.isActive !== false) ||
        category.sortOrder < current.sortOrder
      ) {
        canonicalRemoteCategories.set(normalizedKey, category)
      }
    }
    const nextCategories = Array.from(canonicalRemoteCategories.values())
      .filter((category) => category.isActive !== false || categoryItemCount.has(category.id))
      .map((category) => ({
        id: category.id,
        name: category.name,
        description: 'Synced from Android admin baseline',
        icon: getCategoryIcon(categoryIconMap, category.name),
        itemCount: categoryItemCount.get(category.id) ?? 0,
        orderIndex: category.sortOrder,
      }))
    const categoryById = new Map(Array.from(canonicalRemoteCategories.values()).map((category) => [category.id, category.name]))
    const nextMenuItems: MenuItem[] = activeProducts.map((product) => ({
      id: product.id,
      name: product.name,
      category: categoryById.get(product.categoryId) ?? 'Uncategorized',
      description: `Live ${product.status.toLowerCase()} menu item`,
      imagePath: normalizeMenuImagePath(product.imagePath),
      status:
        product.status === 'HIDDEN'
          ? 'hidden'
          : product.status === 'UNAVAILABLE'
            ? 'unavailable'
            : 'available',
      price: product.price,
      halfPrice: product.halfOrderPrice ?? 0,
    }))
    setCategories(nextCategories)
    setMenuItems(nextMenuItems)
  }, [categoryIconMap, remoteCategories, remoteProducts])

  const filteredIngredients = useMemo(() => {
    if (activeCategory === 'All') {
      return inventoryItems
    }
    return inventoryItems.filter((ingredient) => ingredient.category === activeCategory)
  }, [activeCategory, inventoryItems])

  const overviewSummary = useMemo(() => {
    const lowStock = inventoryItems.filter((ingredient) => ingredient.status === 'low').length
    const needFix = inventoryItems.filter((ingredient) => ingredient.status === 'critical').length
    const overdue = inventoryItems.filter((ingredient) => ingredient.overdue).length
    return { lowStock, needFix, overdue }
  }, [inventoryItems])

  const pendingPurchaseAlerts = overviewSummary.lowStock + overviewSummary.needFix
  const purchaseLogId = 'DL-24-11-05'
  const currentDateLabel = 'Nov 5, 2024'
  const activeFixIngredient = inventoryItems.find((ingredient) => ingredient.id === activeFixCountId) ?? null
  const orderedCategories = useMemo(
    () => [...categories].sort((left, right) => left.orderIndex - right.orderIndex),
    [categories],
  )
  const filteredMenuItems = useMemo(() => {
    return menuItems.filter((item) => {
      const matchesCategory = activeMenuCategory === 'All' || item.category === activeMenuCategory
      const searchTarget = `${item.name} ${item.category} ${item.description}`.toLowerCase()
      const matchesSearch = menuSearch.trim() === '' || searchTarget.includes(menuSearch.trim().toLowerCase())
      return matchesCategory && matchesSearch
    })
  }, [activeMenuCategory, menuItems, menuSearch])
  const activeMenuItem = productModal?.type === 'menu-item'
    ? menuItems.find((item) => item.id === productModal.itemId) ?? null
    : null
  const activeCategoryItem = productModal?.type === 'category'
    ? (productModal.categoryId
        ? categories.find((category) => category.id === productModal.categoryId) ?? null
        : null)
    : null
  const visibleOrderHistory = orderHistory
  const visibleRecipeViews = recipeViews
  const visibleLogViews = logViews
  const orderCreatedAtById = useMemo(
    () => new Map(orders.map((order) => [order.deviceOrderId, order.createdAt])),
    [orders],
  )
  const filteredOrders = useMemo(() => {
    return visibleOrderHistory.filter((item) => {
      const matchesPayment = orderPaymentFilter === 'All Methods' || item.payment === orderPaymentFilter
      const matchesDevice = orderDeviceFilter === 'All Devices' || item.device === orderDeviceFilter
      const matchesDate = isIsoInDateRange(orderCreatedAtById.get(item.id), orderDateRange)
      return matchesPayment && matchesDevice && matchesDate
    })
  }, [orderCreatedAtById, orderDateRange, orderDeviceFilter, orderPaymentFilter, visibleOrderHistory])
  const salesRangeSummary = useMemo<SalesRangeSummary>(() => {
    const voidedIds = new Set(voids.map((item) => item.deviceOrderId))
    const rangeOrders = orders.filter((order) => !voidedIds.has(order.deviceOrderId) && isIsoInDateRange(order.createdAt, salesDateRange))
    const cashSales = rangeOrders.reduce((sum, order) => sum + resolveCashOrderAmount(order), 0)
    const gcashSales = rangeOrders.reduce((sum, order) => sum + resolveGcashOrderAmount(order), 0)
    const recordedSales = rangeOrders.reduce((sum, order) => sum + resolveOrderSalesAmount(order), 0)
    const otherSales = Math.max(recordedSales - cashSales - gcashSales, 0)
    const totalSales = cashSales + gcashSales + otherSales
    return {
      rangeLabel: formatDateRangeLabel(salesDateRange),
      orderCount: rangeOrders.length,
      cashSales,
      gcashSales,
      otherSales,
      totalSales,
      averageOrder: rangeOrders.length > 0 ? totalSales / rangeOrders.length : 0,
    }
  }, [orders, salesDateRange, voids])
  const filteredRecipes = useMemo(() => {
    if (activeRecipeFilter === 'All') {
      return visibleRecipeViews.filter((item) => {
        const recipe = recipes.find((entry) => entry.id === item.id)
        return recipe?.recipeType === 'PREP'
      })
    }
    return visibleRecipeViews.filter((item) => {
      const recipe = recipes.find((entry) => entry.id === item.id)
      return recipe?.recipeType === 'PREP' && item.category === activeRecipeFilter
    })
  }, [activeRecipeFilter, recipes, visibleRecipeViews])
  const ingredientCatalog = useMemo(
    () => buildIngredientCatalog(ingredientLogs, recipes, recipeViews),
    [ingredientLogs, recipeViews, recipes],
  )
  const menuRecipeEntries = useMemo<MenuRecipeEntry[]>(() => {
    const recipeByMenuItemId = new Map(
      recipes
        .filter((recipe) => recipe.recipeType === 'MENU_ITEM')
        .map((recipe) => [recipe.id, recipe]),
    )
    const recipeByName = new Map(
      recipes
        .filter((recipe) => recipe.recipeType === 'MENU_ITEM')
        .map((recipe) => [recipe.recipeName.trim().toLowerCase(), recipe]),
    )
    return filteredMenuItems.map((item) => {
      const linkedRecipe = recipeByMenuItemId.get(item.id) ?? recipeByName.get(item.name.trim().toLowerCase()) ?? null
      return {
        menuItemId: item.id,
        name: item.name,
        category: item.category,
        price: item.price,
        halfPrice: item.halfPrice,
        imagePath: item.imagePath,
        recipeId: linkedRecipe?.id ?? null,
        recipeStatusLabel: linkedRecipe ? 'Manage Recipe' : 'Create Recipe',
      }
    })
  }, [filteredMenuItems, recipes])
  const prepRecipeEntries = useMemo<PrepRecipeEntry[]>(
    () =>
      filteredRecipes.map((item) => {
        const recipe = recipes.find((entry) => entry.id === item.id)
        const quantity = recipe?.yieldQuantity ?? 0
        const unit = recipe?.yieldUnit ?? 'unit'
        return {
          id: item.id,
          name: item.name,
          category: item.category,
          ingredients: item.ingredients,
          yieldLabel: quantity > 0 ? `${quantity} ${unit}` : `1 ${unit}`,
          totalCost: item.totalCost,
        }
      }),
    [filteredRecipes, recipes],
  )
  const selectedOrder = useMemo(
    () => (selectedOrderId ? orders.find((order) => order.deviceOrderId === selectedOrderId) ?? null : null),
    [orders, selectedOrderId],
  )
  const selectedOrderVoid = useMemo(
    () => (selectedOrderId ? voids.find((item) => item.deviceOrderId === selectedOrderId) ?? null : null),
    [selectedOrderId, voids],
  )
  const cashAccounts: CashAccount[] = useMemo(
    () =>
      remoteCashAccounts.map((account) => ({
        id: account.id,
        name: account.name,
        type: account.type,
        currentBalance: account.currentBalance,
        expectedBalance: account.expectedBalance,
        salesToday: account.salesToday,
        lastActivityNote: account.lastActivityNote,
        lastActivityAt: account.lastActivityAt,
      })),
    [remoteCashAccounts],
  )
  const visibleCashAccounts = cashAccounts
  const visibleBills = billViews
  const visibleProfitData = profitDataView
  const cashOverview = useMemo<CashOverviewData>(() => {
    if (cashAccounts.length === 0) {
      return initialCashOverview
    }
    const sourceAccounts = cashAccounts.length > 0 ? cashAccounts : initialCashAccounts
    const cashSalesToday = sourceAccounts
      .filter((account) => account.id === 'tablet-1' || account.id === 'tablet-2')
      .reduce((sum, account) => sum + account.salesToday, 0)
    const digitalPayments = sourceAccounts
      .filter((account) => account.type === 'bank')
      .reduce((sum, account) => sum + account.salesToday, 0)
    const mainSafeOpeningCash = sourceAccounts.find((account) => account.id === 'main-safe')?.currentBalance ?? 0
    const totalCashOnHand = mainSafeOpeningCash + cashSalesToday + digitalPayments
    return {
      openingCash: mainSafeOpeningCash,
      cashSalesToday,
      digitalPayments,
      totalCashOnHand,
    }
  }, [cashAccounts])
  const cashOverviewExpectedTotal = useMemo(
    () => cashOverview.openingCash + cashOverview.cashSalesToday + cashOverview.digitalPayments,
    [cashOverview],
  )
  const cashOverviewDifference = cashOverview.totalCashOnHand - cashOverviewExpectedTotal
  const selectedCashAccount = visibleCashAccounts.find((account) => account.id === selectedCashAccountId) ?? {
    id: 'main-safe',
    name: 'Main Safe',
    type: 'safe' as CashAccountType,
    currentBalance: 0,
    expectedBalance: 0,
    salesToday: 0,
    lastActivityNote: 'No activity yet',
    lastActivityAt: 'No activity yet',
  }
  const cashMovementsView: CashMovement[] = useMemo(
    () =>
      cashMovements.map((movement) => ({
        id: movement.id,
        type:
          movement.movementKind === 'ADJUSTMENT_MINUS' || movement.movementKind === 'ADJUSTMENT_PLUS'
            ? 'adjustment'
            : movement.reasonCategory.toLowerCase().includes('cash pull')
              ? 'cash_pull'
              : 'transfer',
        fromAccountId: movement.sourceAccountId,
        toAccountId: movement.destinationAccountId,
        amount: movement.amount,
        note: movement.note ?? movement.reasonCategory,
        createdAt: safeIsoFromEpoch(movement.createdAtEpochMillis),
        createdBy: movement.createdBy,
        deviceSource: movement.accountId,
        adjustmentDirection: movement.movementKind === 'ADJUSTMENT_MINUS' ? 'remove' : movement.movementKind === 'ADJUSTMENT_PLUS' ? 'add' : undefined,
      })),
    [cashMovements],
  )
  const dashboardView = useMemo(
    () =>
      buildDashboardView({
        orders,
        voids,
        accounting,
        products: remoteProducts,
        logs: ingredientLogs,
        metricsPeriod: dashboardMetricsPeriod,
        salesRange,
      }),
    [accounting, cashMovements, dashboardMetricsPeriod, ingredientLogs, orders, remoteProducts, salesRange, voids],
  )
  const activeLogMovement = cashControlModal?.type === 'log_detail'
    ? cashMovementsView.find((movement) => movement.id === cashControlModal.movementId) ?? null
    : null
  const totalOutstanding = useMemo(
    () => visibleBills.filter((bill) => !bill.paid).reduce((sum, bill) => sum + bill.amount, 0),
    [visibleBills],
  )
  const grossProfit = useMemo(() => visibleProfitData.revenue - visibleProfitData.cogs, [visibleProfitData])
  const profitMargin = useMemo(
    () => (visibleProfitData.revenue === 0 ? 0 : (grossProfit / visibleProfitData.revenue) * 100),
    [grossProfit, visibleProfitData],
  )

  function updateIngredientStatus(estimatedOnHand: number, reorderLevel: number): IngredientStatus {
    if (estimatedOnHand <= reorderLevel * 0.8) {
      return 'critical'
    }
    if (estimatedOnHand <= reorderLevel) {
      return 'low'
    }
    return 'healthy'
  }

  function persistMenuCatalog(nextCategories: CategoryItem[], nextMenuItems: MenuItem[]) {
    const remoteCategoryByName = new Map(
      [...remoteCategories]
        .sort((left, right) => left.sortOrder - right.sortOrder)
        .map((category) => [normalizeCategoryNameKey(category.name), category] as const),
    )
    const normalizedCategoryMap = new Map<string, CategoryItem>()
    for (const category of [...nextCategories].sort((left, right) => left.orderIndex - right.orderIndex)) {
      const normalizedKey = normalizeCategoryNameKey(category.name)
      if (!normalizedKey || normalizedCategoryMap.has(normalizedKey)) {
        continue
      }
      const existingRemoteCategory = remoteCategoryByName.get(normalizedKey)
      normalizedCategoryMap.set(normalizedKey, {
        ...category,
        id: existingRemoteCategory?.id ?? category.id,
        name: category.name.trim(),
      })
    }
    const remoteCategoryList = Array.from(normalizedCategoryMap.values()).map((category, index) => ({
      id: category.id,
      name: category.name,
      sortOrder: index,
      isActive: true,
    }))
    const categoryIdByName = new Map(
      Array.from(normalizedCategoryMap.values()).map((category) => [normalizeCategoryNameKey(category.name), category.id] as const),
    )
    const productById = new Map(remoteProducts.map((product) => [product.id, product]))
    const remoteProductList = nextMenuItems.map((item) => ({
      ...productById.get(item.id),
      id: item.id,
      categoryId: categoryIdByName.get(normalizeCategoryNameKey(item.category)) ?? remoteCategoryList[0]?.id ?? `cat-${item.category.toLowerCase()}`,
      name: item.name,
      price: item.price,
      halfOrderPrice: item.halfPrice > 0 ? item.halfPrice : null,
      status: (item.status === 'hidden' ? 'HIDDEN' : item.status === 'unavailable' ? 'UNAVAILABLE' : 'AVAILABLE') as 'AVAILABLE' | 'UNAVAILABLE' | 'HIDDEN',
      imagePath: normalizeMenuImagePath(item.imagePath),
      stockCount: productById.get(item.id)?.stockCount ?? 0,
      isLowStock: productById.get(item.id)?.isLowStock ?? false,
      isActive: productById.get(item.id)?.isActive ?? true,
    }))
    return setCategoriesAndProducts({
      categories: remoteCategoryList,
      products: remoteProductList,
    })
  }

  function persistAppMode(nextMode: AppMode) {
    setAppMode(nextMode)
    if (typeof window !== 'undefined') {
      window.localStorage.setItem('admin-web-app-mode', nextMode)
    }
  }

  function handleTabChange(nextTab: AppTab) {
    if (appMode === 'pos-only' && (nextTab === 'inventory' || nextTab === 'daily-log')) {
      setActiveTab('dashboard')
      setInventoryRoute('overview')
      setMoreRoute('home')
      return
    }
    setActiveTab(nextTab)
    if (nextTab !== 'inventory') {
      setInventoryRoute('overview')
    }
    if (nextTab !== 'more') {
      setMoreRoute('home')
    }
  }

  function buildDailyLogDraftEntries(businessDate: string | null) {
    const sourceEntries = businessDate
      ? ingredientLogs
          .filter((entry) => entry.businessDate === businessDate)
          .sort((left, right) => left.ingredientName.localeCompare(right.ingredientName))
      : []
    return (sourceEntries.length > 0
      ? sourceEntries.map((entry) => ({
          ingredientId: entry.ingredientId,
          ingredientName: entry.ingredientName,
          price: entry.price.toFixed(2),
          unit: entry.unit,
        }))
      : ingredientCatalog.map((entry) => ({
          ingredientId: entry.id,
          ingredientName: entry.name,
          price: entry.price > 0 ? entry.price.toFixed(2) : '',
          unit: entry.unit,
        })))
  }

  function openDailyLogCreator() {
    const latestBusinessDate = ingredientLogs[0]?.businessDate ?? null
    const templateEntries = buildDailyLogDraftEntries(latestBusinessDate)
    setDailyLogDraft({
      businessDate: manilaDateOffset(0),
      copiedFromLabel: latestBusinessDate,
      entries: templateEntries,
      error: '',
      saving: false,
    })
  }

  function openDailyLogRecord(recordId: string) {
    const existingEntries = buildDailyLogDraftEntries(recordId)
    setDailyLogDraft({
      businessDate: recordId,
      copiedFromLabel: null,
      entries: existingEntries,
      error: '',
      saving: false,
    })
    if (activeTab !== 'daily-log') {
      setActiveTab('daily-log')
    }
  }

  function handleDailyLogEntryChange(entryIndex: number, field: 'ingredientName' | 'price' | 'unit', value: string) {
    setDailyLogDraft((current) =>
      current
        ? {
            ...current,
            error: '',
            entries: current.entries.map((entry, index) =>
              index === entryIndex
                ? {
                    ...entry,
                    ingredientId:
                      field === 'ingredientName' && entry.ingredientId === ''
                        ? normalizeLogIngredientId(value)
                        : entry.ingredientId,
                    [field]: value,
                  }
                : entry,
            ),
          }
        : current,
    )
  }

  function handleAddDailyLogEntry() {
    setDailyLogDraft((current) =>
      current
        ? {
            ...current,
            error: '',
            entries: [
              ...current.entries,
              {
                ingredientId: '',
                ingredientName: '',
                price: '',
                unit: ingredientCatalog[0]?.unit ?? 'unit',
              },
            ],
          }
        : current,
    )
  }

  async function handleSaveDailyLog() {
    if (!dailyLogDraft) {
      return
    }
    if (!dailyLogDraft.businessDate) {
      setDailyLogDraft((current) => (current ? { ...current, error: 'Business date is required.' } : current))
      return
    }
    const cleanedEntries = dailyLogDraft.entries
      .map((entry) => ({
        ...entry,
        ingredientName: entry.ingredientName.trim(),
        unit: entry.unit.trim(),
        numericPrice: Number(entry.price),
      }))
      .filter((entry) => entry.ingredientName && entry.unit)
    if (cleanedEntries.length === 0) {
      setDailyLogDraft((current) => (current ? { ...current, error: 'At least one ingredient line is required.' } : current))
      return
    }
    if (cleanedEntries.some((entry) => !Number.isFinite(entry.numericPrice) || entry.numericPrice <= 0)) {
      setDailyLogDraft((current) => (current ? { ...current, error: 'Every ingredient line needs a numeric price greater than 0.' } : current))
      return
    }

    setDailyLogDraft((current) => (current ? { ...current, saving: true, error: '' } : current))
    try {
      await saveIngredientLogsMutation({
        logs: cleanedEntries.map((entry) => ({
          ingredientId: entry.ingredientId || normalizeLogIngredientId(entry.ingredientName),
          ingredientName: entry.ingredientName,
          businessDate: dailyLogDraft.businessDate,
          price: entry.numericPrice,
          unit: entry.unit,
          sourceLogId: `daily-log-${dailyLogDraft.businessDate}`,
          sourceLogTitle: `Daily Log ${dailyLogDraft.businessDate}`,
        })),
      })
      await calculateDailyAccounting(dailyLogDraft.businessDate)
      await refreshRecipesAccounting()
      setDailyLogDraft(null)
      setFlashMessage(`Daily log ${dailyLogDraft.businessDate} saved to Supabase.`)
      if (activeTab !== 'daily-log') {
        setActiveTab('daily-log')
      }
    } catch (error) {
      setDailyLogDraft((current) => (current ? { ...current, saving: false, error: error instanceof Error ? error.message : 'Failed to save daily log.' } : current))
    }
  }

  async function handleVoidOrder(orderId: string) {
    const order = orders.find((item) => item.deviceOrderId === orderId)
    if (!order) {
      setFlashMessage(`Order ${orderId} was not found in the live dataset.`)
      return
    }
    if (voids.some((item) => item.deviceOrderId === orderId)) {
      setFlashMessage(`Order ${orderId} is already voided.`)
      return
    }
    if (typeof window !== 'undefined' && !window.confirm(`Void order ${orderId} for ${formatPhp(order.total)}? This writes a void authority record and removes it from active sales totals.`)) {
      return
    }
    await voidOrderMutation({ deviceOrderId: orderId, voidReason: 'Voided from Admin Web', voidedBy: 'Admin Web' })
    setFlashMessage(`Order ${orderId} marked void in the authority sync log.`)
  }

  function openPrepRecipeEditor(recipeId?: string) {
    const draft = recipeId
      ? buildRecipeDraftFromRemote(recipeId, recipes, recipeIngredients, ingredientCatalog)
      : createBlankRecipeDraft({
          category: remoteCategories[0]?.name ?? prepRecipeEntries[0]?.category ?? 'Prep',
          taxRatePercent: '12',
          recipeType: 'PREP',
        }, ingredientCatalog)
    setRecipeDraft(draft)
    setRecipeDraftError('')
  }

  function openMenuRecipeEditor(menuItemId: string) {
    const menuItem = menuItems.find((item) => item.id === menuItemId)
    if (!menuItem) {
      setFlashMessage('Menu item not found for recipe setup.')
      return
    }
    const linkedRecipe = recipes.find((recipe) => recipe.id === menuItemId || recipe.recipeName.trim().toLowerCase() === menuItem.name.trim().toLowerCase())
    setRecipeDraft(buildRecipeDraftForMenuItem(menuItem, linkedRecipe?.id ?? null, recipes, recipeIngredients, ingredientCatalog))
    setRecipeDraftError('')
  }

  function patchRecipeDraft(update: (current: RecipeDraft) => RecipeDraft) {
    setRecipeDraft((current) => (current ? recomputeRecipeDraft(update(current), ingredientCatalog) : current))
  }

  async function handleSaveRecipeDraft() {
    if (!recipeDraft) {
      return
    }
    const recipeName = recipeDraft.recipeName.trim()
    const menuCategory = recipeDraft.menuCategory.trim()
    const servings = parseOptionalNumber(recipeDraft.servings)
    const pricePerServing = parseOptionalNumber(recipeDraft.pricePerServing)
    const yieldQuantity = parseOptionalNumber(recipeDraft.yieldQuantity)
    const taxRatePercent = Number(recipeDraft.taxRatePercent)
    if (!recipeName) {
      setRecipeDraftError('Recipe name is required.')
      return
    }
    if (!menuCategory) {
      setRecipeDraftError('Category is required.')
      return
    }
    if (!Number.isFinite(taxRatePercent)) {
      setRecipeDraftError('Tax rate must be numeric.')
      return
    }
    if (recipeDraft.ingredients.length === 0) {
      setRecipeDraftError('Add at least one ingredient line.')
      return
    }
    const normalizedIds = recipeDraft.ingredients.map((line) => line.ingredientRefId).filter(Boolean)
    if (normalizedIds.length !== new Set(normalizedIds).size) {
      setRecipeDraftError('Each ingredient can only be added once per recipe.')
      return
    }
    if (recipeDraft.ingredients.some((line) => !line.ingredientRefId || !Number.isFinite(Number(line.recipeQuantity)) || Number(line.recipeQuantity) <= 0)) {
      setRecipeDraftError('Every ingredient line needs a valid ingredient and recipe quantity.')
      return
    }

    const nextRecipe = {
      id: recipeDraft.id,
      recipeName,
      recipeType: recipeDraft.recipeType,
      menuCategory,
      servings,
      pricePerServing,
      yieldQuantity,
      yieldUnit: recipeDraft.yieldUnit.trim() || null,
      taxRatePercent,
    } as const
    const nextIngredients = recipeDraft.ingredients.map((line, index) => ({
      id: line.id,
      recipeId: recipeDraft.id,
      ingredientRefId: line.ingredientRefId,
      ingredientRefType: line.ingredientRefType,
      ingredientName: line.ingredientName,
      purchaseQuantity: parseOptionalNumber(line.purchaseQuantity),
      purchaseUnit: line.purchaseUnit.trim() || 'unit',
      recipeQuantity: Number(line.recipeQuantity),
      recipeUnit: line.recipeUnit.trim() || 'unit',
      sortOrder: index,
    }))
    const mergedRecipes = [...recipes.filter((item) => item.id !== recipeDraft.id), nextRecipe].sort((left, right) => left.recipeName.localeCompare(right.recipeName))
    const mergedIngredients = [...recipeIngredients.filter((line) => line.recipeId !== recipeDraft.id), ...nextIngredients]
    await saveRecipesMutation({ recipes: mergedRecipes, ingredients: mergedIngredients })
    await refreshRecipesAccounting()
    setRecipeDraft(null)
    setRecipeDraftError('')
    setFlashMessage(`${recipeName} saved to Supabase recipes.`)
  }

  async function syncInventoryIngredients(nextIngredients: Ingredient[], successMessage: string) {
    setIsSynced(false)
    setFlashMessage('Syncing inventory to Supabase...')
    try {
      await persistIngredients(nextIngredients)
      setIsSynced(true)
      setFlashMessage(successMessage)
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Inventory failed to sync to Supabase.'
      setIsSynced(false)
      setFlashMessage(`Inventory sync failed: ${message}`)
      throw error
    }
  }

  async function handleFrequencyChange(ingredientId: string, nextFrequency: Frequency) {
    const nextIngredients = ingredients.map((ingredient) =>
      ingredient.id === ingredientId
        ? { ...ingredient, countingFrequency: nextFrequency }
        : ingredient,
    )
    setIngredients(nextIngredients)
    try {
      await syncInventoryIngredients(nextIngredients, 'Inventory configuration synced to Supabase.')
    } catch {
      // The flash message already carries the Supabase error.
    }
  }

  async function handleCountingToggle(ingredientId: string) {
    const nextIngredients = ingredients.map((ingredient) =>
      ingredient.id === ingredientId
        ? { ...ingredient, countingEnabled: !ingredient.countingEnabled }
        : ingredient,
    )
    setIngredients(nextIngredients)
    try {
      await syncInventoryIngredients(nextIngredients, 'Inventory tracking synced to Supabase.')
    } catch {
      // The flash message already carries the Supabase error.
    }
  }

  function handlePurchaseDraftChange(ingredientId: string, value: string) {
    if (value === '' || /^\d*\.?\d*$/.test(value)) {
      setPurchaseDrafts((current) => ({ ...current, [ingredientId]: value }))
      setPurchaseErrors((current) => ({ ...current, [ingredientId]: '' }))
    } else {
      setPurchaseErrors((current) => ({ ...current, [ingredientId]: 'Quantity must be numeric.' }))
    }
  }

  async function handleSubmitPurchases() {
    const nextErrors: PurchaseErrors = {}
    let hasInvalidValue = false
    let hasAtLeastOneEntry = false

    for (const ingredient of ingredients) {
      const rawValue = purchaseDrafts[ingredient.id]?.trim() ?? ''
      if (!rawValue) {
        continue
      }
      hasAtLeastOneEntry = true
      if (!/^\d*\.?\d+$/.test(rawValue)) {
        nextErrors[ingredient.id] = 'Quantity must be numeric.'
        hasInvalidValue = true
      }
    }

    if (hasInvalidValue) {
      setPurchaseErrors(nextErrors)
      return
    }

    if (!hasAtLeastOneEntry) {
      setFlashMessage('No purchase quantities were entered.')
      return
    }

    const nextIngredients = ingredients.map((ingredient) => {
      const rawValue = purchaseDrafts[ingredient.id]?.trim() ?? ''
      const quantity = rawValue ? Number(rawValue) : 0
      const nextOnHand = ingredient.estimatedOnHand + quantity
      return quantity > 0
        ? {
            ...ingredient,
            estimatedOnHand: nextOnHand,
            overdue: false,
            status: updateIngredientStatus(nextOnHand, ingredient.reorderLevel),
          }
        : ingredient
    })

    setIngredients(nextIngredients)
    try {
      await syncInventoryIngredients(nextIngredients, 'Purchase log saved and inventory synced to Supabase.')
      setPurchaseDrafts({})
      setPurchaseErrors({})
      setPurchaseModalOpen(false)
    } catch {
      // Keep the entered quantities visible so the user can retry after fixing the sync problem.
    }
  }

  function openFixCount(ingredientId: string) {
    const ingredient = ingredients.find((entry) => entry.id === ingredientId)
    setActiveFixCountId(ingredientId)
    setFixCountValue(ingredient ? String(ingredient.estimatedOnHand) : '')
    setFixCountError('')
  }

  async function handleSaveFixCount() {
    if (!activeFixIngredient) {
      return
    }

    if (!/^\d*\.?\d+$/.test(fixCountValue.trim())) {
      setFixCountError('Enter a valid numeric quantity.')
      return
    }

    const nextValue = Number(fixCountValue)
    try {
      const nextIngredients = ingredients.map((ingredient) =>
        ingredient.id === activeFixIngredient.id
          ? {
              ...ingredient,
              estimatedOnHand: nextValue,
              overdue: false,
              status: updateIngredientStatus(nextValue, ingredient.reorderLevel),
            }
          : ingredient,
      )
      setIngredients(nextIngredients)
      await syncInventoryIngredients(nextIngredients, `${activeFixIngredient.name} count synced to Supabase.`)

      await recordInventoryCount({
        id: createRandomId('inventory-count'),
        itemId: activeFixIngredient.id,
        countedQuantity: nextValue,
        countedAt: new Date().toISOString(),
        countedBy: 'Admin Web',
        note: 'Fix count',
      })

      setActiveFixCountId(null)
      setFixCountValue('')
      setFixCountError('')
    } catch (error) {
      setFixCountError(error instanceof Error ? error.message : 'Failed to save fix count.')
    }
  }

  function closeResetModal() {
    if (resetWorkingAction) {
      return
    }
    setResetConfirmation('')
    setResetStatusMessage('')
    setResetErrorMessage('')
    setResetModalOpen(false)
  }

  async function refreshAllAdminData() {
    await Promise.all([refreshSyncData(), refreshMenuCatalog(), refreshRecipesAccounting(), refreshFinanceData()])
  }

  async function runResetAction(action: ResetActionId, task: () => Promise<void>, successMessage: string) {
    if (resetWorkingAction) {
      return
    }
    setResetWorkingAction(action)
    setResetErrorMessage('')
    setResetStatusMessage('')
    try {
      await task()
      await refreshAllAdminData()
      setResetStatusMessage(successMessage)
      setFlashMessage(successMessage)
      setIsSynced(true)
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Reset action failed.'
      setResetErrorMessage(message)
      setFlashMessage(message)
    } finally {
      setResetWorkingAction(null)
    }
  }

  async function handleTestingReset() {
    await runResetAction(
      'testing-reset',
      async () => {
        await resetOperationalDataMutation({ clearMenuCatalog: true })
        const seedData = buildTroubleshootingSeedData()
        await seedTroubleshootingData({
          orders: seedData.orders,
          voids: seedData.voids,
          ingredientLogs: seedData.ingredientLogs,
          recipes: seedData.recipes,
          recipeIngredients: seedData.recipeIngredients,
          cashMovements: seedData.cashMovements,
          payables: seedData.payables,
          calculateBusinessDate: seedData.businessDate,
        })
      },
      'Testing reset applied with troubleshooting sample data.',
    )
  }

  async function handleEmptyEverythingReset() {
    await runResetAction(
      'empty-everything',
      () => resetOperationalDataMutation({ clearMenuCatalog: true }),
      'Everything was cleared from the current workspace.',
    )
  }

  async function handleSafeStateReset() {
    await runResetAction(
      'safe-state',
      () => resetOperationalDataMutation({ clearMenuCatalog: false }),
      'Operational data cleared while keeping the current menu catalog.',
    )
  }

  async function handleClearOrdersReset() {
    await runResetAction('clear-orders', () => clearOrdersData(), 'Orders and accounting totals were cleared.')
  }

  async function handleClearMenuReset() {
    await runResetAction('clear-menu', () => clearMenuCatalogData(), 'Menu categories and products were cleared.')
  }

  async function handleClearRecipesReset() {
    await runResetAction('clear-recipes', () => clearRecipesData(), 'Recipes were cleared.')
  }

  async function handleClearDailyLogsReset() {
    await runResetAction('clear-daily-logs', () => clearDailyLogsData(), 'Daily logs were cleared.')
  }

  async function handleClearInventoryReset() {
    await runResetAction(
      'clear-inventory',
      async () => {
        await clearInventoryData()
        await zeroSellableStockMutation()
        setIngredients((current) =>
          current.map((ingredient) => ({
            ...ingredient,
            estimatedOnHand: 0,
            status: 'critical',
            overdue: false,
          })),
        )
      },
      'Inventory counts were cleared locally and active sellable stock was zeroed in Supabase.',
    )
  }

  function openMenuItemEditor(itemId: string) {
    setProductModal({ type: 'menu-item', itemId })
  }

  function openMenuItemCreator() {
    setProductModal({ type: 'menu-item', itemId: null })
  }

  function openCategoryEditor(categoryId: string | null) {
    setProductModal({ type: 'category', categoryId })
  }

  async function handleSaveMenuItem(nextItem: MenuItem) {
    const normalizedName = nextItem.name.trim()
    const normalizedCategory = nextItem.category.trim()
    const normalizedPrice = Number(nextItem.price)
    const normalizedHalfPrice = halfOrderPriceSupported ? Number(nextItem.halfPrice) : 0

    if (!normalizedName) {
      throw new Error('Name is required.')
    }

    if (!normalizedCategory) {
      throw new Error('Category is required.')
    }

    if (!Number.isFinite(normalizedPrice)) {
      throw new Error('Default price must be a valid number.')
    }

    if (!Number.isFinite(normalizedHalfPrice)) {
      throw new Error('Half order price must be a valid number.')
    }

    const normalizedItem = {
      ...nextItem,
      name: normalizedName,
      category: normalizedCategory,
      imagePath: normalizeMenuImagePath(nextItem.imagePath),
      price: normalizedPrice,
      halfPrice: normalizedHalfPrice,
    }

    const previousItem = menuItems.find((item) => item.id === normalizedItem.id)
    const nextMenuItems = previousItem
      ? menuItems.map((item) => (item.id === normalizedItem.id ? normalizedItem : item))
      : [normalizedItem, ...menuItems]
    const ensuredCategories = categories.some((category) => normalizeCategoryNameKey(category.name) === normalizeCategoryNameKey(normalizedCategory))
      ? categories
      : [
          ...categories,
          {
            id: createRandomId('category'),
            name: normalizedCategory,
            description: '',
            icon: getCategoryIcon(categoryIconMap, normalizedCategory),
            orderIndex: categories.length,
            itemCount: 0,
          },
        ]
    const nextCategories = ensuredCategories.map((category) => ({
      ...category,
      itemCount: nextMenuItems.filter((item) => item.category === category.name).length,
    }))

    try {
      await persistMenuCatalog(nextCategories, nextMenuItems)
      await refreshMenuCatalog()
      setMenuItems(nextMenuItems)
      setCategories(nextCategories)
      setProductModal(null)
      setFlashMessage(previousItem ? `${normalizedItem.name} updated in Supabase.` : `${normalizedItem.name} added to the shared menu.`)
    } catch (error) {
      console.error('handleSaveMenuItem failed', error)
      const message = error instanceof Error ? error.message : 'Failed to save menu item to Supabase.'
      setFlashMessage(message)
      throw new Error(message)
    }
  }

  async function handleRemoveMenuItem(itemId: string) {
    const item = menuItems.find((entry) => entry.id === itemId)
    if (!item || !window.confirm(`Remove ${item.name} from the menu?`)) {
      return
    }
    const nextMenuItems = menuItems.filter((entry) => entry.id !== itemId)
    const nextCategories = categories.map((category) =>
      category.name === item.category
        ? { ...category, itemCount: Math.max(category.itemCount - 1, 0) }
        : category,
    )
    try {
      await persistMenuCatalog(nextCategories, nextMenuItems)
      setMenuItems(nextMenuItems)
      setCategories(nextCategories)
      setProductModal(null)
      setFlashMessage(`${item.name} removed from the shared menu.`)
    } catch (error) {
      console.error('handleRemoveMenuItem failed', error)
      const message = error instanceof Error ? error.message : 'Failed to remove menu item from Supabase.'
      setFlashMessage(message)
      throw new Error(message)
    }
  }

  async function handleSaveCategory(input: { id: string | null; name: string; description: string; icon: CategoryIconKey }) {
    const trimmedName = input.name.trim()
    if (!trimmedName) {
      setFlashMessage('Category name is required.')
      return
    }
    const nextIcon = categoryIconOptions.some((option) => option.value === input.icon) ? input.icon : inferCategoryIcon(trimmedName)
    const nextIconMap = {
      ...categoryIconMap,
      [normalizeCategoryNameKey(trimmedName)]: nextIcon,
    }

    try {
      if (input.id) {
        const previousCategory = categories.find((category) => category.id === input.id)
        const renamedCategories = categories.map((category) =>
          category.id === input.id
            ? { ...category, name: trimmedName, description: input.description.trim(), icon: nextIcon }
            : category,
        )
        if (previousCategory && normalizeCategoryNameKey(previousCategory.name) !== normalizeCategoryNameKey(trimmedName)) {
          delete nextIconMap[normalizeCategoryNameKey(previousCategory.name)]
        }
        if (previousCategory && previousCategory.name !== trimmedName) {
          const renamedItems = menuItems.map((item) =>
            item.category === previousCategory.name ? { ...item, category: trimmedName } : item,
          )
          await persistMenuCatalog(renamedCategories, renamedItems)
          await refreshMenuCatalog()
          setMenuItems(renamedItems)
          if (activeMenuCategory === previousCategory.name) {
            setActiveMenuCategory(trimmedName)
          }
        } else {
          await persistMenuCatalog(renamedCategories, menuItems)
          await refreshMenuCatalog()
        }
        setCategories(renamedCategories)
        setFlashMessage(`${trimmedName} category saved.`)
      } else {
        const nextId = createRandomId('category')
        const nextCategories = [
          ...categories,
          {
            id: nextId,
            name: trimmedName,
            description: input.description.trim(),
            icon: nextIcon,
            itemCount: 0,
            orderIndex: categories.length,
          },
        ]
        await persistMenuCatalog(nextCategories, menuItems)
        await refreshMenuCatalog()
        setCategories(nextCategories)
        setFlashMessage(`${trimmedName} category added.`)
      }
      setCategoryIconMap(nextIconMap)
      if (typeof window !== 'undefined') {
        window.localStorage.setItem('admin-web-category-icons', JSON.stringify(nextIconMap))
      }
      setProductModal(null)
    } catch (error) {
      console.error('handleSaveCategory failed', error)
      setFlashMessage(error instanceof Error ? error.message : 'Failed to save category to Supabase.')
    }
  }

  async function handleDeleteCategory(categoryId: string) {
    const category = categories.find((entry) => entry.id === categoryId)
    if (!category) {
      return
    }
    if (categories.length <= 1) {
      setFlashMessage('At least one category must remain in the menu.')
      return
    }
    const hasItems = menuItems.some((item) => item.category === category.name)
    const confirmationMessage = hasItems
      ? `${category.name} still has menu items assigned. Delete this category anyway?`
      : `Delete ${category.name}?`
    if (!window.confirm(confirmationMessage)) {
      return
    }
    let nextCategories = categories
      .filter((entry) => entry.id !== categoryId)
      .map((entry, index) => ({ ...entry, orderIndex: index }))
    let fallbackCategoryName = nextCategories.find((entry) => normalizeCategoryNameKey(entry.name) === 'uncategorized')?.name
    if (hasItems && !fallbackCategoryName) {
      fallbackCategoryName = 'Uncategorized'
      nextCategories = [
        ...nextCategories,
        {
          id: remoteCategories.find((entry) => normalizeCategoryNameKey(entry.name) === 'uncategorized')?.id ?? 'cat-uncategorized',
          name: fallbackCategoryName,
          description: 'Fallback category for products moved during category cleanup',
          icon: 'default',
          itemCount: 0,
          orderIndex: nextCategories.length,
        },
      ]
    }
    const reassignedCategoryName = fallbackCategoryName ?? nextCategories[0]?.name ?? 'Uncategorized'
    const nextMenuItems = menuItems.map((item) =>
      item.category === category.name ? { ...item, category: reassignedCategoryName } : item,
    )
    nextCategories = nextCategories.map((entry) => ({
      ...entry,
      itemCount: nextMenuItems.filter((item) => normalizeCategoryNameKey(item.category) === normalizeCategoryNameKey(entry.name)).length,
    }))
    try {
      await persistMenuCatalog(nextCategories, nextMenuItems)
      await refreshMenuCatalog()
      setCategories(nextCategories)
      setMenuItems(nextMenuItems)
      if (activeMenuCategory === category.name) {
        setActiveMenuCategory('All')
      }
      setProductModal(null)
      setFlashMessage(`${category.name} category deleted.`)
    } catch (error) {
      console.error('handleDeleteCategory failed', error)
      setFlashMessage(error instanceof Error ? error.message : 'Failed to delete category from Supabase.')
    }
  }

  async function handleMoveCategory(sourceId: string, targetId: string) {
    if (sourceId === targetId) {
      return
    }
    const reordered = [...orderedCategories]
    const sourceIndex = reordered.findIndex((entry) => entry.id === sourceId)
    const targetIndex = reordered.findIndex((entry) => entry.id === targetId)
    if (sourceIndex < 0 || targetIndex < 0) {
      return
    }
    const [moved] = reordered.splice(sourceIndex, 1)
    reordered.splice(targetIndex, 0, moved)
    const nextCategories = reordered.map((entry, index) => ({ ...entry, orderIndex: index }))
    try {
      await persistMenuCatalog(nextCategories, menuItems)
      await refreshMenuCatalog()
      setCategories(nextCategories)
      setFlashMessage('Category order saved.')
    } catch (error) {
      console.error('handleMoveCategory failed', error)
      setFlashMessage(error instanceof Error ? error.message : 'Failed to save category order.')
    }
  }

  function resetCashControlState() {
    setCashControlError('')
    setCashControlModal(null)
  }

  function handleTransferSubmit() {
    const amount = Number(transferDraft.amount)
    const fromAccount = visibleCashAccounts.find((account) => account.id === transferDraft.fromAccountId)
    const toAccount = visibleCashAccounts.find((account) => account.id === transferDraft.toAccountId)

    if (!fromAccount || !toAccount) {
      setCashControlError('Select both source and destination accounts.')
      return
    }
    if (fromAccount.id === toAccount.id) {
      setCashControlError('Source and destination cannot be the same account.')
      return
    }
    if (!Number.isFinite(amount) || amount <= 0) {
      setCashControlError('Amount must be numeric and greater than 0.')
      return
    }
    if (!transferDraft.note.trim()) {
      setCashControlError('A note or reason is required.')
      return
    }
    if (fromAccount.currentBalance - amount < 0) {
      setCashControlError('Source balance cannot go negative.')
      return
    }

    void transferCashMutation({
      fromAccountId: fromAccount.id,
      toAccountId: toAccount.id,
      amount,
      note: transferDraft.note.trim(),
      createdBy: 'Manager Ana',
    })
    setCashControlNotice(`Transferred ${formatPhp(amount)} from ${fromAccount.name} to ${toAccount.name}.`)
    setTransferDraft((current) => ({ ...current, amount: '', note: '' }))
    resetCashControlState()
  }

  function handleAdjustSubmit() {
    const amount = Number(adjustDraft.amount)
    const account = visibleCashAccounts.find((entry) => entry.id === adjustDraft.accountId)

    if (!account) {
      setCashControlError('Select an account.')
      return
    }
    if (!Number.isFinite(amount) || amount <= 0) {
      setCashControlError('Amount must be numeric and greater than 0.')
      return
    }
    if (!adjustDraft.note.trim()) {
      setCashControlError('A note or reason is required.')
      return
    }
    const nextBalance =
      adjustDraft.adjustmentType === 'add'
        ? account.currentBalance + amount
        : account.currentBalance - amount
    if (nextBalance < 0) {
      setCashControlError('Source balance cannot go negative.')
      return
    }

    void adjustCashMutation({
      accountId: account.id,
      adjustmentType: adjustDraft.adjustmentType,
      amount,
      note: adjustDraft.note.trim(),
      createdBy: 'Manager Ana',
    })
    setCashControlNotice(
      `${adjustDraft.adjustmentType === 'add' ? 'Added' : 'Removed'} ${formatPhp(amount)} for ${account.name}.`,
    )
    setAdjustDraft((current) => ({ ...current, amount: '', note: '' }))
    resetCashControlState()
  }

  function handleCashPullSubmit() {
    const amount = Number(cashPullDraft.amount)
    const sourceAccount = visibleCashAccounts.find((entry) => entry.id === cashPullDraft.fromAccountId)
    const safeAccount = visibleCashAccounts.find((entry) => entry.id === 'main-safe')

    if (!sourceAccount || !safeAccount) {
      setCashControlError('Cash pull requires a valid tablet source and main safe.')
      return
    }
    if (!Number.isFinite(amount) || amount <= 0) {
      setCashControlError('Amount must be numeric and greater than 0.')
      return
    }
    if (!cashPullDraft.note.trim()) {
      setCashControlError('A note or reason is required.')
      return
    }
    if (sourceAccount.currentBalance - amount < 0) {
      setCashControlError('Source balance cannot go negative.')
      return
    }

    void cashPullMutation({
      fromAccountId: sourceAccount.id,
      amount,
      note: cashPullDraft.note.trim(),
      createdBy: 'Manager Ana',
    })
    setCashControlNotice(`Pulled ${formatPhp(amount)} from ${sourceAccount.name} into Main Safe.`)
    setCashPullDraft((current) => ({ ...current, amount: '', note: '' }))
    resetCashControlState()
  }

  async function handleSeedSyncData() {
    setSeedSyncBusy(true)
    try {
      const seedData = buildTroubleshootingSeedData()
      await seedTroubleshootingData({
        orders: seedData.orders,
        voids: seedData.voids,
        ingredientLogs: seedData.ingredientLogs,
        recipes: seedData.recipes,
        recipeIngredients: seedData.recipeIngredients,
        cashMovements: seedData.cashMovements,
        payables: seedData.payables,
        calculateBusinessDate: seedData.businessDate,
      })
      await refreshSyncData()
      setFlashMessage('Troubleshooting seed data pushed to Supabase.')
    } catch (error) {
      setFlashMessage(error instanceof Error ? error.message : 'Failed to seed troubleshooting data.')
    } finally {
      setSeedSyncBusy(false)
    }
  }

  async function handleManualSyncRefresh(source: 'screen' | 'navbar' = 'screen') {
    if (manualRefreshBusy) return
    setManualRefreshBusy(true)
    try {
      await refreshSyncData()
      setFlashMessage(source === 'navbar' ? 'Live admin data refreshed from the sync button.' : 'Sync data refreshed from Supabase.')
    } finally {
      setManualRefreshBusy(false)
    }
  }

  return (
    <main className="app-shell">
      <section className="screen-body inventory-screen" aria-label="Admin web mobile shell">
        <div className="app-content">
          {activeTab === 'dashboard' ? (
            <DashboardScreen
              loading={loading}
              error={error}
              period={dashboardMetricsPeriod}
              onPeriodChange={setDashboardMetricsPeriod}
              salesRange={salesRange}
              onSalesRangeChange={setSalesRange}
              metrics={dashboardView.metrics}
              financialMetrics={dashboardView.financialMetrics}
              alerts={dashboardView.alerts}
              devices={dashboardView.devices}
              topProducts={dashboardView.topProducts}
              activityLogs={dashboardView.activity}
              salesTrendPrimary={dashboardView.salesTrendPrimary}
              salesTrendSecondary={dashboardView.salesTrendSecondary}
              paymentBreakdown={dashboardView.paymentBreakdown}
              deviceBreakdown={dashboardView.deviceBreakdown}
              syncBannerTitle={dashboardView.syncBannerTitle}
              syncBannerSubtitle={dashboardView.syncBannerSubtitle}
            />
          ) : null}
          {activeTab === 'daily-log' ? (
            <LogsScreen
              records={visibleLogViews}
              onCreateNew={openDailyLogCreator}
              onOpenRecord={openDailyLogRecord}
            />
          ) : null}
          {activeTab === 'inventory' ? (
            inventoryRoute === 'overview' ? (
                <InventoryOverviewScreen
                  period={period}
                  onPeriodChange={setPeriod}
                  ingredients={inventoryItems}
                summary={overviewSummary}
                pendingPurchaseAlerts={pendingPurchaseAlerts}
                isSynced={isSynced}
                flashMessage={flashMessage}
                onOpenPurchaseLog={() => setPurchaseModalOpen(true)}
                onOpenConfiguration={() => setInventoryRoute('configuration')}
                onOpenFixCount={openFixCount}
              />
            ) : (
              <InventoryConfigurationScreen
                categories={categoryOrder}
                activeCategory={activeCategory}
                onCategoryChange={setActiveCategory}
                ingredients={filteredIngredients}
                onBack={() => setInventoryRoute('overview')}
                onCountingToggle={handleCountingToggle}
                onFrequencyChange={handleFrequencyChange}
              />
            )
          ) : null}
          {activeTab === 'more' ? (
            moreRoute === 'home' ? (
              <SettingsMoreScreen
                appMode={appMode}
                flashMessage={flashMessage}
                syncBusy={manualRefreshBusy || syncLoading}
                onAppModeChange={persistAppMode}
                onNavigate={setMoreRoute}
                onResetRequest={() => setResetModalOpen(true)}
              />
            ) : (
              <MoreDetailScreen
                route={moreRoute}
                onBack={() => setMoreRoute(moreRoute === 'category-settings' ? 'menu-settings' : 'home')}
                flashMessage={flashMessage}
                syncStatus={{
                  hasSupabaseConfig,
                  loading: syncLoading,
                  error: syncError,
                  lastRefreshedAt,
                  orderCount: orders.length,
                  voidCount: voids.length,
                  syncItemCount: syncItems.length,
                  categoryCount: remoteCategories.length,
                  productCount: remoteProducts.length,
                  recipeCount: recipes.length,
                  accountingCount: accounting.length,
                  ingredientLogCount: ingredientLogs.length,
                  payableCount: payables.length,
                  cashMovementCount: cashMovements.length,
                }}
                onRefreshSync={() => {
                  void handleManualSyncRefresh('screen')
                }}
                refreshBusy={manualRefreshBusy || syncLoading}
                onSeedSyncData={handleSeedSyncData}
                seedSyncBusy={seedSyncBusy}
                syncItems={syncItems.map((item) => ({
                  id: `${item.title}-${item.fullDate}`,
                  title: item.title,
                  detail: item.detail,
                  relativeDate: item.relativeDate,
                  fullDate: item.fullDate,
                  status: item.status,
                }))}
                menuItems={filteredMenuItems}
                categories={orderedCategories}
                menuSearch={menuSearch}
                activeMenuCategory={activeMenuCategory}
                onMenuSearchChange={setMenuSearch}
                onMenuCategoryChange={setActiveMenuCategory}
                onOpenMenuItemCreate={openMenuItemCreator}
                onOpenMenuItemEdit={openMenuItemEditor}
                onOpenCategorySettings={() => setMoreRoute('category-settings')}
                onAddCategory={() => openCategoryEditor(null)}
                onEditCategory={(categoryId) => openCategoryEditor(categoryId)}
                onDeleteCategory={handleDeleteCategory}
                orderItems={filteredOrders}
                orderPaymentFilter={orderPaymentFilter}
                orderDeviceFilter={orderDeviceFilter}
                orderDateRange={orderDateRange}
                onOrderPaymentFilterChange={setOrderPaymentFilter}
                onOrderDeviceFilterChange={setOrderDeviceFilter}
                onOrderDateRangeChange={setOrderDateRange}
                onSelectOrder={setSelectedOrderId}
                selectedOrder={selectedOrder}
                selectedOrderVoid={selectedOrderVoid}
                onCloseOrderDetail={() => setSelectedOrderId(null)}
                onVoidOrder={(orderId) => {
                  void handleVoidOrder(orderId)
                }}
                menuRecipeEntries={menuRecipeEntries}
                prepRecipeEntries={prepRecipeEntries}
                activeRecipeFilter={activeRecipeFilter}
                onRecipeFilterChange={setActiveRecipeFilter}
                onOpenMenuRecipe={openMenuRecipeEditor}
                onOpenPrepRecipe={openPrepRecipeEditor}
                onAddPrepRecipe={() => openPrepRecipeEditor()}
                hasDailyLogIngredients={ingredientCatalog.length > 0}
                halfOrderPriceSupported={halfOrderPriceSupported}
                cashOverview={cashOverview}
                cashOverviewExpectedTotal={cashOverviewExpectedTotal}
                cashOverviewDifference={cashOverviewDifference}
                salesRangeSummary={salesRangeSummary}
                salesDateRange={salesDateRange}
                onSalesDateRangeChange={setSalesDateRange}
                cashAccounts={visibleCashAccounts}
                cashMovements={cashMovementsView}
                selectedCashAccount={selectedCashAccount}
                selectedCashAccountId={selectedCashAccountId}
                onSelectCashAccount={setSelectedCashAccountId}
                cashControlNotice={cashControlNotice}
                onOpenCashControlModal={setCashControlModal}
                bills={visibleBills}
                totalOutstanding={totalOutstanding}
                profitData={visibleProfitData}
                grossProfit={grossProfit}
                profitMargin={profitMargin}
                draggedCategoryId={draggedCategoryId}
                onDragCategoryStart={setDraggedCategoryId}
                onDragCategoryEnd={() => setDraggedCategoryId(null)}
                onMoveCategory={handleMoveCategory}
              />
            )
          ) : null}
        </div>

        <BottomNavigation
          activeTab={activeTab}
          appMode={appMode}
          syncBusy={manualRefreshBusy || syncLoading}
          onTabChange={handleTabChange}
          onSync={() => {
            void handleManualSyncRefresh('navbar')
          }}
        />

        {isPurchaseModalOpen ? (
          <LogPurchasedIngredientsModal
            currentDateLabel={currentDateLabel}
            purchaseLogId={purchaseLogId}
            ingredients={inventoryItems}
            purchaseDrafts={purchaseDrafts}
            purchaseErrors={purchaseErrors}
            onClose={() => setPurchaseModalOpen(false)}
            onDraftChange={handlePurchaseDraftChange}
            onSubmit={handleSubmitPurchases}
          />
        ) : null}

        {activeFixIngredient ? (
          <FixCountModal
            ingredient={activeFixIngredient}
            value={fixCountValue}
            error={fixCountError}
            onClose={() => setActiveFixCountId(null)}
            onChange={(value) => {
              setFixCountValue(value)
              setFixCountError('')
            }}
            onSave={handleSaveFixCount}
          />
        ) : null}

        {isResetModalOpen ? (
          <ResetOptionsModal
            value={resetConfirmation}
            onChange={setResetConfirmation}
            onClose={closeResetModal}
            workingAction={resetWorkingAction}
            statusMessage={resetStatusMessage}
            errorMessage={resetErrorMessage}
            onTestingReset={() => void handleTestingReset()}
            onEmptyEverything={() => void handleEmptyEverythingReset()}
            onSafeState={() => void handleSafeStateReset()}
            onClearOrders={() => void handleClearOrdersReset()}
            onClearMenu={() => void handleClearMenuReset()}
            onClearRecipes={() => void handleClearRecipesReset()}
            onClearDailyLogs={() => void handleClearDailyLogsReset()}
            onClearInventory={() => void handleClearInventoryReset()}
          />
        ) : null}

        {productModal ? (
          <ProductEditModalV2
            key={`${productModal.type}:${productModal.type === 'menu-item' ? productModal.itemId ?? 'new' : productModal.categoryId ?? 'new'}:${orderedCategories.map((entry) => entry.id).join('|')}`}
            modal={productModal}
            menuItem={activeMenuItem}
            category={activeCategoryItem}
            categories={orderedCategories}
            halfOrderPriceSupported={halfOrderPriceSupported}
            onClose={() => setProductModal(null)}
            onSaveMenuItem={handleSaveMenuItem}
            onRemoveMenuItem={handleRemoveMenuItem}
            onSaveCategory={handleSaveCategory}
            onDeleteCategory={handleDeleteCategory}
          />
        ) : null}

        {cashControlModal ? (
          <CashControlModalSheet
            modal={cashControlModal}
            accounts={cashAccounts}
            movements={cashMovementsView}
            transferDraft={transferDraft}
            adjustDraft={adjustDraft}
            cashPullDraft={cashPullDraft}
            error={cashControlError}
            activeMovement={activeLogMovement}
            onClose={resetCashControlState}
            onTransferDraftChange={setTransferDraft}
            onAdjustDraftChange={setAdjustDraft}
            onCashPullDraftChange={setCashPullDraft}
            onSubmitTransfer={handleTransferSubmit}
            onSubmitAdjust={handleAdjustSubmit}
            onSubmitCashPull={handleCashPullSubmit}
            onOpenLogDetail={(movementId) => setCashControlModal({ type: 'log_detail', movementId })}
          />
        ) : null}

        {dailyLogDraft ? (
          <DailyLogEditorModal
            draft={dailyLogDraft}
            onClose={() => setDailyLogDraft(null)}
            onDateChange={(value) => setDailyLogDraft((current) => (current ? { ...current, businessDate: value, error: '' } : current))}
            onEntryChange={handleDailyLogEntryChange}
            onAddEntry={handleAddDailyLogEntry}
            onSave={() => {
              void handleSaveDailyLog()
            }}
          />
        ) : null}

        {recipeDraft ? (
          <RecipeEditorModalV2
            draft={recipeDraft}
            error={recipeDraftError}
            ingredientCatalog={ingredientCatalog}
        categoryOptions={uniqueNonEmptyValues([...remoteCategories.map((category) => category.name), ...recipeViews.map((item) => item.category)])}
            onClose={() => {
              setRecipeDraft(null)
              setRecipeDraftError('')
            }}
            onChange={patchRecipeDraft}
            onSave={() => {
              void handleSaveRecipeDraft()
            }}
            onAddIngredient={() =>
              patchRecipeDraft((current) => ({
                ...current,
                ingredients: [
                  ...current.ingredients,
                  {
                    id: createRandomId('recipe-ingredient'),
                    ingredientRefId: '',
                    ingredientRefType: 'ingredient',
                    ingredientName: '',
                    purchaseQuantity: '1',
                    purchaseUnit: ingredientCatalog[0]?.unit ?? 'unit',
                    recipeQuantity: '',
                    recipeUnit: ingredientCatalog[0]?.unit ?? 'unit',
                  },
                ],
              }))
            }
            onRemoveIngredient={(lineId) =>
              patchRecipeDraft((current) => ({
                ...current,
                ingredients: current.ingredients.filter((line) => line.id !== lineId),
              }))
            }
          />
        ) : null}
      </section>
    </main>
  )
}

function buildLinePath(values: number[], width: number, height: number) {
  if (values.length === 0) {
    return ''
  }
  const max = Math.max(...values)
  const min = Math.min(...values)
  const range = Math.max(max - min, 1)
  const divisor = Math.max(values.length - 1, 1)

  return values
    .map((value, index) => {
      const x = values.length === 1 ? width / 2 : (index / divisor) * width
      const y = height - ((value - min) / range) * (height - 12) - 6
      return `${index === 0 ? 'M' : 'L'} ${x.toFixed(2)} ${y.toFixed(2)}`
    })
    .join(' ')
}

function buildChartAxisLabels(points: Array<{ value: number }>) {
  const maxValue = Math.max(...points.map((point) => point.value), 0)
  const step = maxValue <= 0 ? 25 : Math.max(Math.ceil(maxValue / 5), 1)
  return Array.from({ length: 6 }, (_, index) => String(step * (5 - index)))
}

function breakdownWidth(value: number, maxValue: number) {
  if (maxValue <= 0 || value <= 0) {
    return 0
  }
  return Math.max((value / maxValue) * 100, 12)
}

function chartX(index: number, total: number, width: number) {
  if (total <= 1) {
    return width / 2
  }
  return (index / Math.max(total - 1, 1)) * width
}

function chartY(value: number, values: number[], height: number) {
  if (values.length === 0) {
    return height / 2
  }
  const max = Math.max(...values)
  const min = Math.min(...values)
  const range = Math.max(max - min, 1)
  return height - ((value - min) / range) * (height - 12) - 6
}

function buildDashboardView({
  orders,
  voids,
  accounting,
  products,
  logs,
  metricsPeriod,
  salesRange,
}: {
  orders: OrderRecord[]
  voids: OrderVoidRecord[]
  accounting: DailyAccountingRecord[]
  products: MenuProduct[]
  logs: IngredientPriceLog[]
  metricsPeriod: DashboardMetricsPeriod
  salesRange: SalesRange
}) {
  const now = new Date()
  const voidedIds = new Set(voids.map((item) => item.deviceOrderId))
  const activeOrders = orders.filter((order) => !voidedIds.has(order.deviceOrderId))
  const metricsStart = dashboardMetricsStart(metricsPeriod, now)
  const salesOrders = activeOrders.filter((order) => orderFallsInRange(order, salesRange, activeOrders, now))
  const metricOrders = activeOrders.filter((order) => {
    const ts = Date.parse(order.createdAt)
    return Number.isFinite(ts) && ts >= metricsStart.getTime()
  })
  const trend = buildSalesTrendView(salesOrders, salesRange, now)
  const paymentBreakdown = {
    cash: salesOrders.reduce((sum, order) => sum + resolveCashOrderAmount(order), 0),
    gcash: salesOrders.reduce((sum, order) => sum + resolveGcashOrderAmount(order), 0),
  }
  const metricPaymentBreakdown = {
    cash: metricOrders.reduce((sum, order) => sum + resolveCashOrderAmount(order), 0),
    gcash: metricOrders.reduce((sum, order) => sum + resolveGcashOrderAmount(order), 0),
  }
  const deviceBreakdown = {
    tablet1: salesOrders.filter((order) => normalizeDeviceId(order.deviceId) === 'tablet-1').reduce((sum, order) => sum + resolveOrderSalesAmount(order), 0),
    tablet2: salesOrders.filter((order) => normalizeDeviceId(order.deviceId) === 'tablet-2').reduce((sum, order) => sum + resolveOrderSalesAmount(order), 0),
  }
  const rangeLabel = metricsPeriodLabel(metricsPeriod)
  const accountingWindow = accounting.filter((record) => {
    const ts = Date.parse(`${record.businessDate}T00:00:00+08:00`)
    return Number.isFinite(ts) && ts >= metricsStart.getTime()
  })
  const accountingNetProfit = accountingWindow.reduce((sum, record) => sum + record.netProfit, 0)
  const latestAccounting = accounting[0] ?? null
  const topProducts = Array.from(
    salesOrders
      .flatMap((order) => order.items)
      .reduce<Map<string, { quantity: number; revenue: number }>>((acc, item) => {
        const current = acc.get(item.name) ?? { quantity: 0, revenue: 0 }
        current.quantity += item.quantity
        current.revenue += item.lineTotal
        acc.set(item.name, current)
        return acc
      }, new Map())
      .entries(),
  )
    .sort((left, right) => right[1].revenue - left[1].revenue)
    .slice(0, 5)
    .map(([name, stats], index) => ({
      rank: index + 1,
      name,
      revenue: formatPhp(stats.revenue),
      quantity: `${trimCount(stats.quantity)} sold`,
      secondaryRevenue: formatPhp(stats.revenue),
      secondaryQuantity: `${trimCount(stats.quantity)} qty`,
    }))
  const recentActivity = [
    ...salesOrders.slice().sort((left, right) => Date.parse(right.createdAt) - Date.parse(left.createdAt)).slice(0, 3).map((order) => ({
      actor: friendlyDeviceLabel(order.deviceId),
      detail: `Accepted order ${order.deviceOrderId} for ${formatPhp(resolveOrderSalesAmount(order))}`,
      ago: formatActivityStamp(order.createdAt),
    })),
    ...voids.slice().sort((left, right) => Date.parse(right.voidedAt) - Date.parse(left.voidedAt)).slice(0, 2).map((item) => ({
      actor: item.voidedBy || 'Admin Web',
      detail: `Voided order ${item.deviceOrderId}: ${item.voidReason || 'Voided from admin'}`,
      ago: formatActivityStamp(item.voidedAt),
    })),
  ].slice(0, 5)

  return {
    metrics: [
      {
        label: metricsSalesTitle(metricsPeriod),
        value: formatPhp(metricOrders.reduce((sum, order) => sum + resolveOrderSalesAmount(order), 0)),
        hint: `${rangeLabel} from synced orders`,
        hintTone: 'positive' as const,
      },
      {
        label: metricsOrdersTitle(metricsPeriod),
        value: String(metricOrders.length),
        hint: 'Non-voided orders in selected period',
        hintTone: 'positive' as const,
      },
      {
        label: 'Latest Food Cost',
        value: latestAccounting ? formatPhp(latestAccounting.totalCost) : formatPhp(0),
        hint: latestAccounting?.businessDate ?? 'No accounting records yet',
        hintTone: 'muted' as const,
      },
      {
        label: 'Latest Gross Profit',
        value: latestAccounting ? formatPhp(latestAccounting.grossProfit) : formatPhp(0),
        hint: latestAccounting?.businessDate ?? 'No accounting records yet',
        hintTone: 'muted' as const,
      },
    ],
    financialMetrics: [
      { label: `${rangeLabel} Cash`, value: formatPhp(metricPaymentBreakdown.cash) },
      { label: `${rangeLabel} GCash`, value: formatPhp(metricPaymentBreakdown.gcash) },
      { label: `${rangeLabel} Orders`, value: String(metricOrders.length) },
      { label: `${rangeLabel} Net Profit`, value: formatPhp(accountingNetProfit), tone: accountingNetProfit < 0 ? 'danger' as const : 'default' as const },
    ],
    alerts: [
      { title: 'Low Stock', action: `${products.filter((product) => product.isLowStock || product.stockCount <= 5).length} menu items need review`, icon: '!' },
      { title: 'Price Logs', action: `${logs.length} synced ingredient price rows`, icon: 'TAG' },
      { title: 'Cloud Orders', action: `${metricOrders.length} active orders in ${rangeLabel.toLowerCase()}`, icon: 'SYNC' },
    ],
    devices: ['tablet-1', 'tablet-2'].map((deviceId) => {
      const matching = salesOrders.filter((order) => normalizeDeviceId(order.deviceId) === deviceId)
      const latestOrder = matching.slice().sort((left, right) => Date.parse(right.createdAt) - Date.parse(left.createdAt))[0]
      return {
        name: friendlyDeviceLabel(deviceId),
        syncTime: latestOrder ? `Last Sync ${new Date(latestOrder.createdAt).toLocaleTimeString()}` : 'Waiting for sync',
        pendingSales: `${matching.length} orders`,
        health: matching.length > 0 ? 'Healthy' : 'No sales',
      }
    }),
    topProducts,
    activity: recentActivity,
    salesTrendPrimary: trend.primary,
    salesTrendSecondary: trend.secondary,
    paymentBreakdown,
    deviceBreakdown,
    syncBannerTitle: salesOrders.length > 0 ? `${salesOrders.length} synced orders in ${salesRange}` : `No synced orders in ${salesRange}`,
    syncBannerSubtitle: salesOrders.length > 0 ? 'Dashboard reflects live non-voided Supabase orders for the selected range.' : 'Sync tablets or seed/test live orders to populate the dashboard.',
  }
}

function metricsPeriodLabel(period: DashboardMetricsPeriod) {
  switch (period) {
    case 'Week to date':
      return 'WTD'
    case 'Month to date':
      return 'MTD'
    default:
      return 'Today'
  }
}

function metricsSalesTitle(period: DashboardMetricsPeriod) {
  switch (period) {
    case 'Week to date':
      return 'WTD Sales'
    case 'Month to date':
      return 'MTD Sales'
    default:
      return "Today's Sales"
  }
}

function metricsOrdersTitle(period: DashboardMetricsPeriod) {
  switch (period) {
    case 'Week to date':
      return 'WTD Orders'
    case 'Month to date':
      return 'MTD Orders'
    default:
      return "Today's Orders"
  }
}

function dashboardMetricsStart(period: DashboardMetricsPeriod, now: Date) {
  if (period === 'Month to date') {
    return new Date(now.getFullYear(), now.getMonth(), 1)
  }
  if (period === 'Week to date') {
    return startOfWeek(now)
  }
  return startOfDay(now)
}

function orderFallsInRange(order: OrderRecord, range: SalesRange, allOrders: OrderRecord[], now: Date) {
  const ts = Date.parse(order.createdAt)
  if (!Number.isFinite(ts)) {
    return false
  }
  switch (range) {
    case 'Today':
      return ts >= startOfDay(now).getTime()
    case 'Week to Date':
      return ts >= startOfWeek(now).getTime()
    case 'Month to Date':
      return ts >= new Date(now.getFullYear(), now.getMonth(), 1).getTime()
    case 'All Time': {
      const earliest = allOrders
        .map((item) => Date.parse(item.createdAt))
        .filter((value) => Number.isFinite(value))
        .sort((left, right) => left - right)[0]
      return !Number.isFinite(earliest) || ts >= earliest
    }
    default:
      return ts >= startOfDay(new Date(now.getTime() - 6 * 24 * 60 * 60 * 1000)).getTime() && ts <= now.getTime()
  }
}

function buildSalesTrendView(orders: OrderRecord[], range: SalesRange, now: Date) {
  const primary = buildSalesTrendPrimary(orders, range, now)
  let rolling = 0
  const secondary = primary.map((point, index) => {
    rolling += point.value
    return {
      day: point.day,
      value: rolling / (index + 1),
    }
  })
  return { primary, secondary }
}

function buildSalesTrendPrimary(orders: OrderRecord[], range: SalesRange, now: Date) {
  if (range === 'Today') {
    const buckets = [
      { label: '12AM', min: 0, max: 6 },
      { label: '6AM', min: 6, max: 12 },
      { label: '12PM', min: 12, max: 18 },
      { label: '6PM', min: 18, max: 24 },
    ]
    return buckets.map((bucket) => ({
      day: bucket.label,
      value: orders
        .filter((order) => {
          const date = new Date(order.createdAt)
          return orderFallsInRange(order, range, orders, now) && date.getHours() >= bucket.min && date.getHours() < bucket.max
        })
        .reduce((sum, order) => sum + resolveOrderSalesAmount(order), 0),
    }))
  }

  if (range === 'All Time') {
    const monthly = orders.reduce<Map<string, number>>((acc, order) => {
      const date = new Date(order.createdAt)
      const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
      acc.set(key, (acc.get(key) ?? 0) + resolveOrderSalesAmount(order))
      return acc
    }, new Map())
    return Array.from(monthly.entries())
      .sort(([left], [right]) => left.localeCompare(right))
      .slice(-6)
      .map(([key, value]) => ({
        day: new Date(`${key}-01T00:00:00+08:00`).toLocaleDateString('en-US', { month: 'short' }),
        value,
      }))
  }

  const dayKeys =
    range === 'Month to Date'
      ? Array.from({ length: Math.max(now.getDate(), 1) }, (_, index) => {
          const date = new Date(now.getFullYear(), now.getMonth(), index + 1)
          return date
        })
      : range === 'Week to Date'
        ? Array.from({ length: now.getDay() === 0 ? 7 : now.getDay() }, (_, index) => {
            const date = new Date(startOfWeek(now))
            date.setDate(date.getDate() + index)
            return date
          })
        : Array.from({ length: 7 }, (_, index) => {
            const date = new Date(now)
            date.setDate(now.getDate() - (6 - index))
            return date
          })

  return dayKeys.map((date) => {
    const dayStart = startOfDay(date).getTime()
    const dayEnd = dayStart + 24 * 60 * 60 * 1000
    return {
      day: date.toLocaleDateString('en-US', { weekday: 'short' }),
      value: orders
        .filter((order) => {
          const ts = Date.parse(order.createdAt)
          return Number.isFinite(ts) && ts >= dayStart && ts < dayEnd
        })
        .reduce((sum, order) => sum + resolveOrderSalesAmount(order), 0),
    }
  })
}

function startOfDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate())
}

function startOfWeek(date: Date) {
  const next = startOfDay(date)
  const weekdayOffset = (next.getDay() + 6) % 7
  next.setDate(next.getDate() - weekdayOffset)
  return next
}

function normalizeDeviceId(value: string) {
  const normalized = value.trim().toLowerCase().replaceAll('_', '-').replaceAll(' ', '-')
  if (normalized === 'tablet1' || normalized === 'tablet-a' || normalized === 'tableta') {
    return 'tablet-1'
  }
  if (normalized === 'tablet2' || normalized === 'tablet-b' || normalized === 'tabletb') {
    return 'tablet-2'
  }
  return normalized
}

function friendlyDeviceLabel(value: string) {
  switch (normalizeDeviceId(value)) {
    case 'tablet-1':
      return 'Tablet 1'
    case 'tablet-2':
      return 'Tablet 2'
    case 'bank-gcash':
      return 'Bank / GCash'
    default:
      return value || 'Unknown device'
  }
}

function trimCount(value: number) {
  return Number.isInteger(value) ? String(value) : value.toFixed(1)
}

function formatActivityStamp(value: string) {
  const ts = Date.parse(value)
  if (!Number.isFinite(ts)) {
    return 'Unknown time'
  }
  return new Date(ts).toLocaleString()
}

function buildIngredientCatalog(
  logs: IngredientPriceLog[],
  recipes: {
    id: string
    recipeName: string
    recipeType: 'MENU_ITEM' | 'PREP'
    yieldQuantity: number | null
    yieldUnit: string | null
  }[],
  recipeViews: RecipeRecord[],
) {
  const latestById = new Map<string, IngredientCatalogOption>()
  for (const log of [...logs].sort((left, right) => right.businessDate.localeCompare(left.businessDate))) {
    if (!latestById.has(log.ingredientId)) {
      latestById.set(log.ingredientId, {
        id: log.ingredientId,
        name: log.ingredientName,
        sourceType: 'ingredient',
        unit: log.unit || 'unit',
        price: log.price,
        purchaseQuantity: 1,
      })
    }
  }

  if (latestById.size === 0) {
    return []
  }

  const prepViewById = new Map(recipeViews.map((recipe) => [recipe.id, recipe]))
  for (const recipe of recipes) {
    if (recipe.recipeType !== 'PREP') {
      continue
    }
    const prepView = prepViewById.get(recipe.id)
    latestById.set(recipe.id, {
      id: recipe.id,
      name: recipe.recipeName,
      sourceType: 'recipe',
      unit: recipe.yieldUnit || 'unit',
      price: prepView ? Number(prepView.totalCost.replace(/[^0-9.-]+/g, '')) || 0 : 0,
      purchaseQuantity: recipe.yieldQuantity ?? 1,
    })
  }

  return Array.from(latestById.values()).sort((left, right) => left.name.localeCompare(right.name))
}

function normalizeLogIngredientId(name: string) {
  return name.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
}

function sanitizeDecimalInput(value: string) {
  return value.replace(/[^0-9.]/g, '')
}

function parseOptionalNumber(value: string) {
  if (!value.trim()) {
    return null
  }
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

function createBlankRecipeDraft(
  input: { category: string; taxRatePercent: string; recipeType?: 'MENU_ITEM' | 'PREP' },
  ingredientCatalog: IngredientCatalogOption[],
): RecipeDraft {
  return recomputeRecipeDraft(
    {
      id: createRandomId('recipe'),
      linkedMenuItemId: null,
      recipeName: '',
      recipeType: input.recipeType ?? 'MENU_ITEM',
      menuCategory: input.category,
      halfOrderPrice: '',
      servings: '1',
      pricePerServing: '',
      yieldQuantity: '1',
      yieldUnit: ingredientCatalog[0]?.unit ?? 'unit',
      taxRatePercent: input.taxRatePercent,
      ingredients: [],
      summary: emptyRecipeSummary(),
    },
    ingredientCatalog,
  )
}

function buildRecipeDraftFromRemote(
  recipeId: string,
  recipes: {
    id: string
    linkedMenuItemId?: string | null
    recipeName: string
    recipeType: 'MENU_ITEM' | 'PREP'
    menuCategory: string
    servings: number | null
    pricePerServing: number | null
    yieldQuantity: number | null
    yieldUnit: string | null
    taxRatePercent: number
  }[],
  recipeIngredients: {
    id: string
    recipeId: string
    ingredientRefId: string
    ingredientRefType?: string
    ingredientName: string
    purchaseQuantity: number | null
    purchaseUnit: string
    recipeQuantity: number
    recipeUnit: string
    sortOrder: number
  }[],
  ingredientCatalog: IngredientCatalogOption[],
) {
  const recipe = recipes.find((item) => item.id === recipeId)
  if (!recipe) {
    return createBlankRecipeDraft({ category: 'Meals', taxRatePercent: '12' }, ingredientCatalog)
  }
  return recomputeRecipeDraft(
    {
      id: recipe.id,
      linkedMenuItemId: recipe.recipeType === 'MENU_ITEM' ? recipe.linkedMenuItemId ?? recipe.id : null,
      recipeName: recipe.recipeName,
      recipeType: recipe.recipeType,
      menuCategory: recipe.menuCategory || 'Meals',
      halfOrderPrice: '',
      servings: recipe.servings?.toString() ?? '',
      pricePerServing: recipe.pricePerServing?.toString() ?? '',
      yieldQuantity: recipe.yieldQuantity?.toString() ?? '',
      yieldUnit: recipe.yieldUnit ?? 'unit',
      taxRatePercent: recipe.taxRatePercent.toString(),
      ingredients: recipeIngredients
        .filter((line) => line.recipeId === recipeId)
        .sort((left, right) => left.sortOrder - right.sortOrder)
        .map((line) => ({
          id: line.id,
          ingredientRefId: line.ingredientRefId,
          ingredientRefType: line.ingredientRefType === 'recipe' ? 'recipe' : 'ingredient',
          ingredientName: line.ingredientName,
          purchaseQuantity: (line.purchaseQuantity ?? 1).toString(),
          purchaseUnit: line.purchaseUnit,
          recipeQuantity: line.recipeQuantity.toString(),
          recipeUnit: line.recipeUnit,
        })),
      summary: emptyRecipeSummary(),
    },
    ingredientCatalog,
  )
}

function buildRecipeDraftForMenuItem(
  menuItem: MenuItem,
  recipeId: string | null,
  recipes: {
    id: string
    recipeName: string
    recipeType: 'MENU_ITEM' | 'PREP'
    menuCategory: string
    servings: number | null
    pricePerServing: number | null
    yieldQuantity: number | null
    yieldUnit: string | null
    taxRatePercent: number
  }[],
  recipeIngredients: {
    id: string
    recipeId: string
    ingredientRefId: string
    ingredientRefType?: string
    ingredientName: string
    purchaseQuantity: number | null
    purchaseUnit: string
    recipeQuantity: number
    recipeUnit: string
    sortOrder: number
  }[],
  ingredientCatalog: IngredientCatalogOption[],
) {
  const existingDraft = recipeId ? buildRecipeDraftFromRemote(recipeId, recipes, recipeIngredients, ingredientCatalog) : null
  return recomputeRecipeDraft(
    {
      id: recipeId ?? menuItem.id,
      linkedMenuItemId: menuItem.id,
      recipeName: menuItem.name,
      recipeType: 'MENU_ITEM',
      menuCategory: menuItem.category,
      halfOrderPrice: menuItem.halfPrice > 0 ? menuItem.halfPrice.toString() : '',
      servings: existingDraft?.servings ?? '1',
      pricePerServing: menuItem.price.toString(),
      yieldQuantity: existingDraft?.yieldQuantity ?? '1',
      yieldUnit: existingDraft?.yieldUnit ?? ingredientCatalog[0]?.unit ?? 'unit',
      taxRatePercent: existingDraft?.taxRatePercent ?? '12',
      ingredients: existingDraft?.ingredients ?? [],
      summary: existingDraft?.summary ?? emptyRecipeSummary(),
    },
    ingredientCatalog,
  )
}

function recomputeRecipeDraft(draft: RecipeDraft, ingredientCatalog: IngredientCatalogOption[]) {
  return {
    ...draft,
    summary: computeRecipeSummary(draft, ingredientCatalog),
  }
}

function computeRecipeSummary(draft: RecipeDraft, ingredientCatalog: IngredientCatalogOption[]): RecipeSummaryMetrics {
  let totalRecipeCost = 0
  let hasConversionIssue = false

  for (const line of draft.ingredients) {
    const lineCost = computeRecipeLineCost(line, ingredientCatalog)
    if (!line.ingredientRefId) {
      continue
    }
    if (lineCost === null) {
      hasConversionIssue = true
      continue
    }
    totalRecipeCost += lineCost
  }

  const servings = Math.max(Number(draft.servings) || 0, 0)
  const pricePerServing = Math.max(Number(draft.pricePerServing) || 0, 0)
  const taxRatePercent = Math.max(Number(draft.taxRatePercent) || 0, 0)
  const revenue = servings * pricePerServing
  const taxAmount = revenue * (taxRatePercent / 100)
  const netSales = revenue - taxAmount
  const grossProfit = revenue - totalRecipeCost
  const netProfit = netSales - totalRecipeCost

  return {
    totalRecipeCost,
    costPerServing: servings > 0 ? totalRecipeCost / servings : totalRecipeCost,
    revenue,
    taxAmount,
    netSales,
    grossProfit,
    netProfit,
    grossMargin: revenue > 0 ? (grossProfit / revenue) * 100 : 0,
    hasConversionIssue,
  }
}

function computeRecipeLineCost(line: RecipeDraftLine, ingredientCatalog: IngredientCatalogOption[]) {
  const recipeQuantity = Number(line.recipeQuantity)
  const purchaseQuantity = Number(line.purchaseQuantity || '1')
  const catalogEntry = ingredientCatalog.find((item) => item.id === line.ingredientRefId)
  const referencePrice = catalogEntry?.price ?? 0
  if (!line.ingredientRefId || !Number.isFinite(recipeQuantity) || recipeQuantity <= 0 || !Number.isFinite(purchaseQuantity) || purchaseQuantity <= 0) {
    return 0
  }
  if (normalizeUnit(line.purchaseUnit) !== normalizeUnit(line.recipeUnit)) {
    return null
  }
  return (recipeQuantity / purchaseQuantity) * referencePrice
}

function normalizeUnit(value: string) {
  return value.trim().toLowerCase()
}

function uniqueNonEmptyValues(values: string[]) {
  const seen = new Set<string>()
  const output: string[] = []

  for (const value of values) {
    const trimmed = value.trim()
    if (!trimmed) {
      continue
    }
    const normalized = normalizeCategoryNameKey(trimmed)
    if (seen.has(normalized)) {
      continue
    }
    seen.add(normalized)
    output.push(trimmed)
  }

  return output
}

function emptyRecipeSummary(): RecipeSummaryMetrics {
  return {
    totalRecipeCost: 0,
    costPerServing: 0,
    revenue: 0,
    taxAmount: 0,
    netSales: 0,
    grossProfit: 0,
    netProfit: 0,
    grossMargin: 0,
    hasConversionIssue: false,
  }
}

type DashboardScreenProps = {
  loading: boolean
  error: string | null
  period: DashboardMetricsPeriod
  onPeriodChange: (period: DashboardMetricsPeriod) => void
  salesRange: SalesRange
  onSalesRangeChange: (range: SalesRange) => void
  metrics: MetricCard[]
  financialMetrics: FinancialMetric[]
  alerts: AlertCard[]
  devices: DeviceStatus[]
  topProducts: ProductRow[]
  activityLogs: ActivityLog[]
  salesTrendPrimary: Array<{ day: string; value: number }>
  salesTrendSecondary: Array<{ day: string; value: number }>
  paymentBreakdown: { cash: number; gcash: number }
  deviceBreakdown: { tablet1: number; tablet2: number }
  syncBannerTitle: string
  syncBannerSubtitle: string
}

function DashboardScreen({
  loading,
  error,
  period,
  onPeriodChange,
  salesRange,
  onSalesRangeChange,
  metrics,
  financialMetrics,
  alerts,
  devices,
  topProducts,
  activityLogs,
  salesTrendPrimary,
  salesTrendSecondary,
  paymentBreakdown,
  deviceBreakdown,
  syncBannerTitle,
  syncBannerSubtitle,
}: DashboardScreenProps) {
  const chartWidth = 188
  const chartHeight = 108
  const primaryValues = salesTrendPrimary.map((point) => point.value)
  const secondaryValues = salesTrendSecondary.map((point) => point.value)
  const primaryPath = buildLinePath(
    primaryValues,
    chartWidth,
    chartHeight,
  )
  const secondaryPath = buildLinePath(
    secondaryValues,
    chartWidth,
    chartHeight,
  )

  return (
    <div className="dashboard-panel">
      <header className="dashboard-header">
        <h1>My Restaurant Dashboard</h1>
      </header>

      {loading ? <div className="finance-notice-banner">Loading live admin data...</div> : null}
      {error ? <div className="finance-warning-banner">{error}</div> : null}

      <section className="period-switch" aria-label="Dashboard periods">
        {dashboardPeriods.map((option) => (
          <button
            key={option}
            type="button"
            className={`period-pill dashboard-pill ${period === option ? 'is-active' : ''}`}
            onClick={() => onPeriodChange(option)}
          >
            {option}
          </button>
        ))}
      </section>

      <section className="metrics-grid">
        {metrics.map((card) => (
          <article key={card.label} className="surface-card metric-card">
            <p className="eyebrow">{card.label}</p>
            <p className="metric-value">{card.value}</p>
            <p className={`metric-hint ${card.hintTone === 'positive' ? 'positive' : 'muted'}`}>
              {card.hint ?? '\u00a0'}
            </p>
          </article>
        ))}
      </section>

      <article className="surface-card section-card">
        <div className="section-head">
          <h2>Sales Trend</h2>
          <label className="ghost-select">
            <span className="sr-only">Sales range</span>
            <select value={salesRange} onChange={(event) => onSalesRangeChange(event.target.value as SalesRange)}>
              {salesRanges.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="chart-shell">
          <div className="chart-grid" aria-hidden="true">
            {[0, 1, 2, 3, 4].map((line) => (
              <span key={line} />
            ))}
          </div>
          <div className="chart-y-axis" aria-hidden="true">
            {buildChartAxisLabels(salesTrendPrimary).map((label) => (
              <span key={label}>{label}</span>
            ))}
          </div>
          <svg viewBox={`0 0 ${chartWidth} ${chartHeight}`} className="chart-svg" role="img" aria-label="Sales trend chart">
            <path className="line secondary" d={secondaryPath} />
            <path className="line primary" d={primaryPath} />
            {salesTrendSecondary.map((point, index) => {
              const x = chartX(index, salesTrendSecondary.length, chartWidth)
              const y = chartY(point.value, secondaryValues, chartHeight)
              return <circle key={`secondary-${point.day}`} cx={x} cy={y} r="2.8" className="point secondary" />
            })}
            {salesTrendPrimary.map((point, index) => {
              const x = chartX(index, salesTrendPrimary.length, chartWidth)
              const y = chartY(point.value, primaryValues, chartHeight)
              return <circle key={`primary-${point.day}`} cx={x} cy={y} r="3.4" className="point primary" />
            })}
          </svg>
          <div className="chart-x-axis" aria-hidden="true">
            {salesTrendPrimary.map((point) => (
              <span key={point.day}>{point.day}</span>
            ))}
          </div>
        </div>
      </article>

      <button type="button" className="sync-banner">
        <span className="sync-banner-icon">SYNC</span>
        <span className="sync-banner-copy">
          <strong>{syncBannerTitle}</strong>
          <small>{syncBannerSubtitle}</small>
        </span>
        <span className="sync-banner-arrow">&gt;</span>
      </button>

      <article className="surface-card section-card">
        <div className="section-head">
          <h2>Financial Summary</h2>
        </div>
        <div className="financial-grid">
          {financialMetrics.map((item) => (
            <div key={item.label} className="financial-item">
              <p>{item.label}</p>
              <strong className={item.tone === 'danger' ? 'danger' : ''}>{item.value}</strong>
            </div>
          ))}
        </div>
      </article>

      <article className="surface-card section-card">
        <div className="section-head">
          <h2>Sales Breakdown</h2>
        </div>
        <div className="breakdown-grid">
          <div className="breakdown-block">
            <p className="eyebrow">By Payment Method</p>
            <div className="donut-chart" aria-hidden="true" />
            <div className="legend">
              <span><i className="legend-dot cash" />Cash {formatPhp(paymentBreakdown.cash)}</span>
              <span><i className="legend-dot gcash" />GCash {formatPhp(paymentBreakdown.gcash)}</span>
            </div>
          </div>
          <div className="breakdown-block">
            <p className="eyebrow">By Device</p>
            <div className="device-bars" aria-hidden="true">
              <div className="device-bar">
                <span
                  className="bar-fill bar-fill-one"
                  style={{ width: `${breakdownWidth(deviceBreakdown.tablet1, Math.max(deviceBreakdown.tablet1, deviceBreakdown.tablet2))}%` }}
                />
                <small>Tablet 1 {formatPhp(deviceBreakdown.tablet1)}</small>
              </div>
              <div className="device-bar">
                <span
                  className="bar-fill bar-fill-two"
                  style={{ width: `${breakdownWidth(deviceBreakdown.tablet2, Math.max(deviceBreakdown.tablet1, deviceBreakdown.tablet2))}%` }}
                />
                <small>Tablet 2 {formatPhp(deviceBreakdown.tablet2)}</small>
              </div>
            </div>
          </div>
        </div>
      </article>

      <section className="section-stack urgent-section">
        <div className="section-head section-head-tight">
          <h2>Urgent Alerts</h2>
        </div>
        <div className="alerts-grid">
          {alerts.map((alert) => (
            <article key={alert.title} className="alert-card">
              <span className="alert-icon" aria-hidden="true">{alert.icon}</span>
              <strong>{alert.title}</strong>
              <small>{alert.action}</small>
            </article>
          ))}
        </div>
      </section>

      <article className="surface-card section-card">
        <div className="section-head">
          <h2>Tablet &amp; Sync Management</h2>
          <button type="button" className="primary-chip">Sync New</button>
        </div>
        <div className="device-list">
          {devices.map((device) => (
            <div key={device.name} className="device-list-row">
              <div className="device-list-icon" aria-hidden="true">[]</div>
              <div className="device-list-copy">
                <strong>{device.name}</strong>
                <small>{device.syncTime}</small>
              </div>
              <div className="device-list-meta">
                <strong>{device.pendingSales}</strong>
                <small>
                  {device.health}
                  <i className="status-dot" />
                </small>
              </div>
            </div>
          ))}
        </div>
      </article>

      <section className="section-stack">
        <div className="section-head section-head-tight">
          <h2>Key Metrics</h2>
        </div>
        <div className="key-metrics-grid">
          <article className="surface-card compact-card">
            <p className="eyebrow">Latest Food Cost</p>
            <strong>--</strong>
          </article>
          <article className="surface-card compact-card">
            <p className="eyebrow">Latest Gross Profit</p>
            <strong>--</strong>
          </article>
        </div>
        <div className="action-row">
          <button type="button" className="action-button">Run Finance</button>
          <button type="button" className="action-button">Calculate Day</button>
        </div>
      </section>

      <article className="surface-card section-card">
        <div className="section-head">
          <h2>Top Selling Products</h2>
          <button type="button" className="ghost-pill">Menu Settings</button>
        </div>
        <div className="products-table">
          <div className="table-head">
            <span>#</span>
            <span>Product</span>
            <span>Revenue</span>
            <span>Quantity</span>
          </div>
          {topProducts.length > 0 ? (
            topProducts.map((product) => (
              <div key={product.rank} className="product-row">
                <span className="rank-badge">{product.rank}</span>
                <div className="product-copy">
                  <strong>{product.name}</strong>
                  <small>Product</small>
                </div>
                <div className="table-stack">
                  <strong>{product.revenue}</strong>
                  <small>{product.secondaryRevenue}</small>
                </div>
                <div className="table-stack align-right">
                  <strong>{product.quantity}</strong>
                  <small>{product.secondaryQuantity}</small>
                </div>
              </div>
            ))
          ) : (
            <div className="sync-empty-state">
              <strong>No sales yet for this range.</strong>
              <p>Top products appear after synced non-voided orders exist in the selected sales window.</p>
            </div>
          )}
        </div>
      </article>

      <article className="surface-card section-card">
        <div className="section-head">
          <h2>Activity Logs</h2>
          <span className="collapse-icons" aria-hidden="true">^ v</span>
        </div>
        <div className="activity-list">
          {activityLogs.map((item) => (
            <div key={`${item.actor}-${item.ago}`} className="activity-row">
              <span className="activity-dot" aria-hidden="true">o</span>
              <div className="activity-copy">
                <strong>{item.actor}</strong>
                <p>{item.detail}</p>
                <small>{item.ago}</small>
              </div>
            </div>
          ))}
        </div>
      </article>
    </div>
  )
}

type SettingsMoreScreenProps = {
  appMode: AppMode
  flashMessage: string
  syncBusy: boolean
  onAppModeChange: (mode: AppMode) => void
  onNavigate: (route: MoreRoute) => void
  onResetRequest: () => void
}

function SettingsMoreScreen({
  appMode,
  flashMessage,
  syncBusy,
  onAppModeChange,
  onNavigate,
  onResetRequest,
}: SettingsMoreScreenProps) {
  return (
    <div className="more-panel">
      <header className="more-header">
        <span className="more-header-label">Settings / More</span>
        <div className="restaurant-badge">
          <span className="restaurant-avatar">L</span>
          <span>La Fontana</span>
        </div>
      </header>

      <div className={`more-sync-banner ${syncBusy ? 'is-busy' : ''}`}>
        <strong>{syncBusy ? 'Refreshing live admin data...' : 'Sync Status'}</strong>
        <p>{flashMessage}</p>
      </div>

      <section className="mode-card">
        <p className="section-kicker">APPLICATION MODE</p>
        <div className="mode-card-head">
          <div>
            <h1>App Mode Selection</h1>
            <p>Application mode</p>
          </div>
          <span className="mode-card-icon" aria-hidden="true">
            <ModeSwitchIcon />
          </span>
        </div>

        <div className="mode-options">
          <button
            type="button"
            className={`mode-option ${appMode === 'full-admin' ? 'is-active' : ''}`}
            onClick={() => onAppModeChange('full-admin')}
          >
            <strong>Full Admin</strong>
            <p>Full system control, reporting, and management</p>
          </button>
          <button
            type="button"
            className={`mode-option ${appMode === 'pos-only' ? 'is-active' : ''}`}
            onClick={() => onAppModeChange('pos-only')}
          >
            <strong>POS Only</strong>
            <p>Operations only: Orders, payments, sync</p>
          </button>
        </div>
      </section>

      <MoreSection title="OPERATIONS">
        <ActionRow
          icon={<SyncLogsIcon />}
          title="Sync Data & Logs"
          subtitle="Trigger updates and view synchronization logs"
          onClick={() => onNavigate('sync')}
        />
        <ActionRow
          icon={<OrderHistoryIcon />}
          title="Order History"
          subtitle="Recent transactions, source, and device tracking"
          onClick={() => onNavigate('orders')}
        />
        <ActionRow
          icon={<FinanceOverviewIcon />}
          title="Sales Range"
          subtitle="Sales totals for a custom date range"
          onClick={() => onNavigate('sales-range')}
        />
      </MoreSection>

      <MoreSection title="PRODUCT MANAGEMENT">
        <ActionRow
          icon={<ProductSettingsIcon />}
          title="Menu Settings"
          subtitle={appMode === 'pos-only' ? 'Shared menu source for POS and admin' : 'Manage shared products, pricing, and availability'}
          onClick={() => onNavigate('menu-settings')}
        />
        <ActionRow
          icon={<RecipeBookIcon />}
          title="Recipes & Cost Management"
          subtitle="Link recipes to existing menu items and manage prep products"
          onClick={() => onNavigate('recipes')}
        />
      </MoreSection>

      <MoreSection title="FINANCE">
        <ActionRow
          icon={<FinanceOverviewIcon />}
          title="Cash Overview"
          subtitle="Tablet cash sales, GCash sales, and total sales intake"
          onClick={() => onNavigate('finance-overview')}
        />
        <ActionRow
          icon={<CashDrawerIcon />}
          title="Cash Control"
          subtitle="Opening balance, cash flow, counted cash, and discrepancies"
          onClick={() => onNavigate('cash-drawer')}
        />
        {appMode === 'full-admin' ? (
          <>
            <ActionRow
              icon={<BillsIcon />}
              title="Bills & Payables"
              subtitle="Vendor invoices, due dates, outstanding bills, and payment tracking"
              onClick={() => onNavigate('payables')}
            />
            <ActionRow
              icon={<ProfitInsightsIcon />}
              title="Profit Insights"
              subtitle="Revenue, COGS, gross profit, and margin tracking"
              onClick={() => onNavigate('profit')}
            />
          </>
        ) : null}
      </MoreSection>

      {appMode === 'full-admin' ? (
        <section className="more-section">
          <div className="more-section-head">
            <span className="section-kicker">SYSTEM</span>
            <span className="danger-kicker">Danger Zone</span>
          </div>
          <div className="surface-card action-card action-card-danger">
            <ActionRow
              icon={<ResetIcon />}
              title="Reset Data"
              subtitle="Permanently clears order history, sync logs, and cache"
              tone="danger"
              onClick={onResetRequest}
            />
          </div>
        </section>
      ) : null}
    </div>
  )
}

type MoreSectionProps = {
  title: string
  children: ReactNode
}

function MoreSection({ title, children }: MoreSectionProps) {
  return (
    <section className="more-section">
      <div className="more-section-head">
        <span className="section-kicker">{title}</span>
      </div>
      <div className="surface-card action-card-group">{children}</div>
    </section>
  )
}

type ActionRowProps = {
  icon: ReactNode
  title: string
  subtitle: string
  onClick: () => void
  tone?: 'default' | 'danger'
}

function ActionRow({ icon, title, subtitle, onClick, tone = 'default' }: ActionRowProps) {
  return (
    <button type="button" className={`action-row-card ${tone === 'danger' ? 'is-danger' : ''}`} onClick={onClick}>
      <span className={`action-row-icon ${tone === 'danger' ? 'is-danger' : ''}`} aria-hidden="true">{icon}</span>
      <span className="action-row-copy">
        <strong>{title}</strong>
        <small>{subtitle}</small>
      </span>
      <span className="action-row-chevron" aria-hidden="true">&gt;</span>
    </button>
  )
}

type SyncStatusPanel = {
  hasSupabaseConfig: boolean
  loading: boolean
  error: string | null
  lastRefreshedAt: string | null
  orderCount: number
  voidCount: number
  syncItemCount: number
  categoryCount: number
  productCount: number
  recipeCount: number
  accountingCount: number
  ingredientLogCount: number
  payableCount: number
  cashMovementCount: number
}

type SyncDetailScreenProps = {
  status: SyncStatusPanel
  items: LogRecord[]
  onRefresh: () => void
  refreshBusy: boolean
  onSeedData: () => void
  seedBusy: boolean
  onBack: () => void
}

function SyncDetailScreen({ status, items, onRefresh, refreshBusy, onSeedData, seedBusy, onBack }: SyncDetailScreenProps) {
  return (
    <div className="record-screen">
      <header className="record-header">
        <button type="button" className="back-button icon-back-button" onClick={onBack} aria-label="Back">
          <span aria-hidden="true">&lt;</span>
        </button>
        <h1>Sync Data &amp; Logs</h1>
        <button type="button" className="ghost-pill" onClick={onRefresh} disabled={refreshBusy}>
          {refreshBusy ? 'Refreshing...' : 'Refresh'}
        </button>
      </header>

      {!status.hasSupabaseConfig ? (
        <div className="finance-warning-banner">
          Supabase config is missing. Set `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` to enable live sync.
        </div>
      ) : null}

      {status.loading ? <div className="finance-notice-banner">Refreshing live sync state...</div> : null}
      {status.error ? <div className="finance-warning-banner">{status.error}</div> : null}

      <section className="surface-card sync-troubleshoot-card">
        <div className="section-head section-head-tight">
          <h2>Live Sync Status</h2>
        </div>
        <div className="sync-status-grid">
          <article className="sync-status-block">
            <span>Config</span>
            <strong>{status.hasSupabaseConfig ? 'Connected' : 'Missing'}</strong>
            <small>{status.lastRefreshedAt ? new Date(status.lastRefreshedAt).toLocaleString() : 'No successful refresh yet'}</small>
          </article>
          <article className="sync-status-block">
            <span>Orders</span>
            <strong>{status.orderCount}</strong>
            <small>{status.voidCount} void records</small>
          </article>
          <article className="sync-status-block">
            <span>Catalog</span>
            <strong>{status.productCount}</strong>
            <small>{status.categoryCount} categories</small>
          </article>
          <article className="sync-status-block">
            <span>Accounting</span>
            <strong>{status.accountingCount}</strong>
            <small>{status.ingredientLogCount} ingredient logs</small>
          </article>
          <article className="sync-status-block">
            <span>Finance</span>
            <strong>{status.cashMovementCount}</strong>
            <small>{status.payableCount} payables</small>
          </article>
          <article className="sync-status-block">
            <span>Recipes</span>
            <strong>{status.recipeCount}</strong>
            <small>{status.syncItemCount} recent sync log entries</small>
          </article>
        </div>
      </section>

      <section className="surface-card sync-troubleshoot-card">
        <div className="section-head section-head-tight">
          <div className="section-head-column">
            <h2>Troubleshooting</h2>
            <p>Use this screen to confirm whether the web app is actually reading live Supabase data.</p>
          </div>
        </div>
        <div className="sync-checklist">
          <p>If counts are zero but config is connected, the cloud tables themselves are currently empty for that feature.</p>
          <p>If config is missing, the app falls back to placeholder data and nothing is truly syncing.</p>
          <p>If an error appears above, the latest fetch failed and the data on screen may be stale.</p>
        </div>
        <div className="sync-action-row">
          <button type="button" className="ghost-pill" onClick={onSeedData} disabled={seedBusy || !status.hasSupabaseConfig}>
            {seedBusy ? 'Seeding...' : 'Seed Test Sync Data'}
          </button>
        </div>
      </section>

      <section className="surface-card sync-troubleshoot-card">
        <div className="section-head section-head-tight">
          <div className="section-head-column">
            <h2>Recent Sync Activity</h2>
            <p>These entries are generated from the live orders, voids, and accounting datasets currently loaded in the web app.</p>
          </div>
        </div>
        {items.length > 0 ? (
          <div className="shared-card-list">
            {items.map((item) => (
              <UnifiedRecordCard
                key={item.id}
                media={<SyncLogsIcon />}
                title={item.title}
                subtitle={item.detail}
                status={item.status}
                sideTop={item.relativeDate}
                sideBottom={item.fullDate}
              />
            ))}
          </div>
        ) : (
          <div className="sync-empty-state">
            <strong>No sync activity found.</strong>
            <p>
              This feed is built from orders, voids, and daily accounting rows. If you expected logs here, confirm those
              tables already contain live data for this Supabase project.
            </p>
          </div>
        )}
      </section>
    </div>
  )
}

type MoreDetailScreenProps = {
  route: MoreRoute
  onBack: () => void
  flashMessage: string
  syncStatus: SyncStatusPanel
  onRefreshSync: () => void
  refreshBusy: boolean
  onSeedSyncData: () => void
  seedSyncBusy: boolean
  syncItems: LogRecord[]
  menuItems: MenuItem[]
  categories: CategoryItem[]
  menuSearch: string
  activeMenuCategory: string
  onMenuSearchChange: (value: string) => void
  onMenuCategoryChange: (category: string) => void
  onOpenMenuItemCreate: () => void
  onOpenMenuItemEdit: (itemId: string) => void
  onOpenCategorySettings: () => void
  onAddCategory: () => void
  onEditCategory: (categoryId: string) => void
  onDeleteCategory: (categoryId: string) => void
  orderItems: OrderHistoryItem[]
  orderPaymentFilter: string
  orderDeviceFilter: string
  orderDateRange: DateRangeValue
  onOrderPaymentFilterChange: (value: string) => void
  onOrderDeviceFilterChange: (value: string) => void
  onOrderDateRangeChange: (value: DateRangeValue | ((current: DateRangeValue) => DateRangeValue)) => void
  onSelectOrder: (orderId: string) => void
  selectedOrder: OrderRecord | null
  selectedOrderVoid: OrderVoidRecord | null
  onCloseOrderDetail: () => void
  onVoidOrder: (orderId: string) => void
  menuRecipeEntries: MenuRecipeEntry[]
  prepRecipeEntries: PrepRecipeEntry[]
  hasDailyLogIngredients: boolean
  halfOrderPriceSupported: boolean
  activeRecipeFilter: string
  onRecipeFilterChange: (value: string) => void
  onOpenMenuRecipe: (menuItemId: string) => void
  onOpenPrepRecipe: (recipeId: string) => void
  onAddPrepRecipe: () => void
  cashOverview: CashOverviewData
  cashOverviewExpectedTotal: number
  cashOverviewDifference: number
  salesRangeSummary: SalesRangeSummary
  salesDateRange: DateRangeValue
  onSalesDateRangeChange: (value: DateRangeValue | ((current: DateRangeValue) => DateRangeValue)) => void
  cashAccounts: CashAccount[]
  cashMovements: CashMovement[]
  selectedCashAccount: CashAccount
  selectedCashAccountId: string
  onSelectCashAccount: (accountId: string) => void
  cashControlNotice: string
  onOpenCashControlModal: (modal: CashControlModal) => void
  bills: BillRecord[]
  totalOutstanding: number
  profitData: ProfitData
  grossProfit: number
  profitMargin: number
  draggedCategoryId: string | null
  onDragCategoryStart: (categoryId: string | null) => void
  onDragCategoryEnd: () => void
  onMoveCategory: (sourceId: string, targetId: string) => void
}

function MoreDetailScreen({
  route,
  onBack,
  flashMessage,
  syncStatus,
  onRefreshSync,
  refreshBusy,
  onSeedSyncData,
  seedSyncBusy,
  syncItems,
  menuItems,
  categories,
  menuSearch,
  activeMenuCategory,
  onMenuSearchChange,
  onMenuCategoryChange,
  onOpenMenuItemCreate,
  onOpenMenuItemEdit,
  onOpenCategorySettings,
  onAddCategory,
  onEditCategory,
  onDeleteCategory,
  orderItems,
  orderPaymentFilter,
  orderDeviceFilter,
  orderDateRange,
  onOrderPaymentFilterChange,
  onOrderDeviceFilterChange,
  onOrderDateRangeChange,
  onSelectOrder,
  selectedOrder,
  selectedOrderVoid,
  onCloseOrderDetail,
  onVoidOrder,
  menuRecipeEntries,
  prepRecipeEntries,
  hasDailyLogIngredients,
  halfOrderPriceSupported,
  activeRecipeFilter,
  onRecipeFilterChange,
  onOpenMenuRecipe,
  onOpenPrepRecipe,
  onAddPrepRecipe,
  cashOverview,
  cashOverviewExpectedTotal,
  cashOverviewDifference,
  salesRangeSummary,
  salesDateRange,
  onSalesDateRangeChange,
  cashAccounts,
  cashMovements,
  selectedCashAccount,
  selectedCashAccountId,
  onSelectCashAccount,
  cashControlNotice,
  onOpenCashControlModal,
  bills,
  totalOutstanding,
  profitData,
  grossProfit,
  profitMargin,
  draggedCategoryId,
  onDragCategoryStart,
  onDragCategoryEnd,
  onMoveCategory,
}: MoreDetailScreenProps) {
  const detailNotice = flashMessage ? <div className="finance-notice-banner">{flashMessage}</div> : null

  if (route === 'sync') {
    return (
      <SyncDetailScreen
        status={syncStatus}
        items={syncItems}
        onRefresh={onRefreshSync}
        refreshBusy={refreshBusy}
        onSeedData={onSeedSyncData}
        seedBusy={seedSyncBusy}
        onBack={onBack}
      />
    )
  }

  if (route === 'orders') {
    return (
      <>
        {detailNotice}
        <OrderHistoryScreen
          items={orderItems}
          paymentFilter={orderPaymentFilter}
          deviceFilter={orderDeviceFilter}
          dateRange={orderDateRange}
          onPaymentFilterChange={onOrderPaymentFilterChange}
          onDeviceFilterChange={onOrderDeviceFilterChange}
          onDateRangeChange={onOrderDateRangeChange}
          onSelectOrder={onSelectOrder}
          selectedOrder={selectedOrder}
          selectedOrderVoid={selectedOrderVoid}
          onCloseOrderDetail={onCloseOrderDetail}
          onVoidOrder={onVoidOrder}
          onBack={onBack}
        />
      </>
    )
  }

  if (route === 'menu-settings') {
    return (
      <>
        {detailNotice}
        <MenuSettingsScreenV2
          items={menuItems}
          categories={categories}
          halfOrderPriceSupported={halfOrderPriceSupported}
          search={menuSearch}
          activeCategory={activeMenuCategory}
          onSearchChange={onMenuSearchChange}
          onCategoryChange={onMenuCategoryChange}
          onBack={onBack}
          onAddItem={onOpenMenuItemCreate}
          onEditItem={onOpenMenuItemEdit}
          onOpenCategorySettings={onOpenCategorySettings}
        />
      </>
    )
  }

  if (route === 'recipes') {
    return (
      <RecipesManagementScreen
        menuItems={menuRecipeEntries}
        prepItems={prepRecipeEntries}
        halfOrderPriceSupported={halfOrderPriceSupported}
        activeFilter={activeRecipeFilter}
        onFilterChange={onRecipeFilterChange}
        onOpenMenuRecipe={onOpenMenuRecipe}
        onOpenPrepRecipe={onOpenPrepRecipe}
        onAddPrepRecipe={onAddPrepRecipe}
        hasDailyLogIngredients={hasDailyLogIngredients}
        onBack={onBack}
      />
    )
  }

  if (route === 'finance-overview') {
    return (
      <CashOverviewScreen
        data={cashOverview}
        expectedTotal={cashOverviewExpectedTotal}
        difference={cashOverviewDifference}
        onBack={onBack}
      />
    )
  }

  if (route === 'sales-range') {
    return (
      <SalesRangeScreen
        summary={salesRangeSummary}
        dateRange={salesDateRange}
        onDateRangeChange={onSalesDateRangeChange}
        onBack={onBack}
      />
    )
  }

  if (route === 'cash-drawer') {
    return (
      <CashControlScreen
        accounts={cashAccounts}
        movements={cashMovements}
        selectedAccount={selectedCashAccount}
        selectedAccountId={selectedCashAccountId}
        notice={cashControlNotice}
        onBack={onBack}
        onSelectAccount={onSelectCashAccount}
        onOpenAction={onOpenCashControlModal}
      />
    )
  }

  if (route === 'payables') {
    return (
      <BillsPayablesScreen
        bills={bills}
        totalOutstanding={totalOutstanding}
        onBack={onBack}
      />
    )
  }

  if (route === 'profit') {
    return (
      <ProfitInsightsScreen
        data={profitData}
        grossProfit={grossProfit}
        margin={profitMargin}
        onBack={onBack}
      />
    )
  }

  if (route === 'category-settings') {
    return (
      <CategoryManagementScreen
        categories={categories}
        draggedCategoryId={draggedCategoryId}
        onBack={onBack}
        onAddCategory={onAddCategory}
        onEditCategory={onEditCategory}
        onDeleteCategory={onDeleteCategory}
        onDragCategoryStart={onDragCategoryStart}
        onDragCategoryEnd={onDragCategoryEnd}
        onMoveCategory={onMoveCategory}
      />
    )
  }

  const detail = {
    sync: {
      title: 'Sync Data & Logs',
      body: 'This screen will manage synchronization runs, upload status, and log review.',
    },
    home: {
      title: 'Settings / More',
      body: '',
    },
  }[route]

  return (
    <div className="placeholder-screen">
      <div className="placeholder-card">
        <button type="button" className="back-button detail-back" onClick={onBack}>
          <span aria-hidden="true">&lt;</span>
          Back
        </button>
        <p className="placeholder-label">Settings / More</p>
        <h1>{detail.title}</h1>
        <p>{detail.body}</p>
      </div>
    </div>
  )
}

type OrderHistoryScreenProps = {
  items: OrderHistoryItem[]
  paymentFilter: string
  deviceFilter: string
  dateRange: DateRangeValue
  onPaymentFilterChange: (value: string) => void
  onDeviceFilterChange: (value: string) => void
  onDateRangeChange: (value: DateRangeValue | ((current: DateRangeValue) => DateRangeValue)) => void
  onSelectOrder: (orderId: string) => void
  selectedOrder: OrderRecord | null
  selectedOrderVoid: OrderVoidRecord | null
  onCloseOrderDetail: () => void
  onVoidOrder: (orderId: string) => void
  onBack: () => void
}

function OrderHistoryScreen({
  items,
  paymentFilter,
  deviceFilter,
  dateRange,
  onPaymentFilterChange,
  onDeviceFilterChange,
  onDateRangeChange,
  onSelectOrder,
  selectedOrder,
  selectedOrderVoid,
  onCloseOrderDetail,
  onVoidOrder,
  onBack,
}: OrderHistoryScreenProps) {
  return (
    <div className="record-screen">
      <header className="record-header">
        <button type="button" className="back-button icon-back-button" onClick={onBack} aria-label="Back">
          <span aria-hidden="true">&lt;</span>
        </button>
        <h1>Order History</h1>
        <span className="header-spacer" aria-hidden="true" />
      </header>

      <div className="record-filter-grid">
        <label className="control-field">
          <span>Payment Method</span>
          <select value={paymentFilter} onChange={(event) => onPaymentFilterChange(event.target.value)}>
            {paymentFilters.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </label>
        <label className="control-field">
          <span>Device Source</span>
          <select value={deviceFilter} onChange={(event) => onDeviceFilterChange(event.target.value)}>
            {deviceFilters.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="control-field control-field-full">
        <span>Date Range</span>
        <DateRangeInputs value={dateRange} onChange={onDateRangeChange} />
      </div>

      <div className="shared-card-list">
        {items.length > 0 ? (
          items.map((item) => (
            <button key={item.id} type="button" className="record-card-button" onClick={() => onSelectOrder(item.id)}>
              <UnifiedRecordCard
                media={<OrderHistoryIcon />}
                title={`Order #${formatShortOrderNumber(item.id)}`}
                subtitle={`${item.itemCount} items • ${item.total} • ${item.table}`}
                status={item.status}
                sideTop={item.payment}
                sideMiddle={item.device}
                sideBottom={item.time}
              />
            </button>
          ))
        ) : (
          <div className="sync-empty-state">
            <strong>No orders found.</strong>
            <p>The order list will populate after live Supabase orders are available for this project.</p>
          </div>
        )}
      </div>

      {selectedOrder ? (
        <OrderDetailModal
          order={selectedOrder}
          voidRecord={selectedOrderVoid}
          onClose={onCloseOrderDetail}
          onVoid={() => {
            void onVoidOrder(selectedOrder.deviceOrderId)
          }}
        />
      ) : null}
    </div>
  )
}

type RecipesScreenProps = {
  items: RecipeRecord[]
  activeFilter: string
  onFilterChange: (value: string) => void
  onOpenRecipe: (recipeId: string) => void
  onAddRecipe: () => void
  onBack: () => void
}

function RecipesScreen({ items, activeFilter, onFilterChange, onOpenRecipe, onAddRecipe, onBack }: RecipesScreenProps) {
  return (
    <div className="record-screen">
      <header className="record-header">
        <button type="button" className="back-button icon-back-button" onClick={onBack} aria-label="Back">
          <span aria-hidden="true">&lt;</span>
        </button>
        <h1>Recipes</h1>
        <button type="button" className="record-icon-button" aria-label="Search recipes">
          <SearchIcon />
        </button>
        <button type="button" className="record-icon-button" aria-label="Add recipe" onClick={onAddRecipe}>
          <PlusIcon />
        </button>
      </header>

      <div className="shared-chip-row" role="tablist" aria-label="Recipe filters">
        {recipeFilterChips.map((chip) => (
          <button
            key={chip}
            type="button"
            className={`shared-chip ${activeFilter === chip ? 'is-active' : ''}`}
            onClick={() => onFilterChange(chip)}
          >
            {chip}
          </button>
        ))}
      </div>

      <div className="shared-card-list">
        {items.length > 0 ? (
          items.map((item) => (
            <button key={item.id} type="button" className="record-card-button" onClick={() => onOpenRecipe(item.id)}>
              <UnifiedRecordCard
                media={<SafeMenuImage className="shared-thumb-image" imagePath={item.image} name={item.name} />}
                title={item.name}
                subtitle={`${item.category} • ${item.ingredients} Ingredients • ${item.servings} Servings`}
                status={item.status}
                sideTop={item.totalCost}
                sideBottom={item.perServing}
                emphasizeSideTop
              />
            </button>
          ))
        ) : (
          <div className="sync-empty-state">
            <strong>No recipes found.</strong>
            <p>Create a recipe to start syncing live cost and profit calculations.</p>
          </div>
        )}
      </div>
    </div>
  )
}

type OrderDetailModalProps = {
  order: OrderRecord
  voidRecord: OrderVoidRecord | null
  onClose: () => void
  onVoid: () => void
}

function OrderDetailModal({ order, voidRecord, onClose, onVoid }: OrderDetailModalProps) {
  const amountPaid = order.paymentMethod.toLowerCase().includes('cash') ? order.cashAmount ?? order.total : order.gcashAmount ?? order.total

  return (
    <div className="modal-overlay" role="presentation">
      <div className="sheet-backdrop" onClick={onClose} />
      <section className="bottom-sheet cash-sheet" role="dialog" aria-modal="true" aria-label="Order detail">
        <div className="sheet-handle" />
        <header className="product-modal-header">
          <h2>Order {order.deviceOrderId}</h2>
          <button type="button" className="sheet-close-button" onClick={onClose} aria-label="Close">
            <CloseIcon />
          </button>
        </header>

        <div className="product-modal-scroll">
          {voidRecord ? (
            <div className="finance-warning-banner">
              VOIDED by {voidRecord.voidedBy || 'Admin Web'} at {formatFullDateTime(voidRecord.voidedAt)}. {voidRecord.voidReason || 'Voided from admin.'}
            </div>
          ) : null}

          <article className="surface-card cash-log-detail-card">
            <div className="finance-row">
              <span>Date / Time</span>
              <strong>{formatFullDateTime(order.createdAt)}</strong>
            </div>
            <div className="finance-row">
              <span>Order Number</span>
              <strong>{order.deviceOrderId}</strong>
            </div>
            <div className="finance-row">
              <span>Payment Method</span>
              <strong>{order.paymentMethod || 'Unknown'}</strong>
            </div>
            <div className="finance-row">
              <span>Amount Paid</span>
              <strong>{formatPhp(amountPaid ?? order.total)}</strong>
            </div>
            <div className="finance-row">
              <span>Change</span>
              <strong>Not recorded</strong>
            </div>
            <div className="finance-row">
              <span>Cashier / Source</span>
              <strong>{friendlyDeviceLabel(order.deviceId)}</strong>
            </div>
            <div className="finance-row">
              <span>Tablet / Device</span>
              <strong>{friendlyDeviceLabel(order.deviceId)}</strong>
            </div>
          </article>

          <article className="surface-card finance-table-card">
            <div className="finance-table-head">
              <span>Item</span>
              <span>Qty</span>
              <span>Line Total</span>
            </div>
            {order.items.map((item, index) => (
              <div key={`${item.name}-${index}`} className="finance-table-row">
                <div className="finance-vendor-cell">
                  <strong>{item.name}</strong>
                  <small>No modifiers recorded</small>
                </div>
                <div>
                  <span>{trimCount(item.quantity)}</span>
                </div>
                <div className="align-right">
                  <strong>{formatPhp(item.lineTotal)}</strong>
                </div>
              </div>
            ))}
          </article>

          <article className="surface-card cash-log-detail-card">
            <div className="finance-row">
              <span>Subtotal</span>
              <strong>{formatPhp(order.subtotal)}</strong>
            </div>
            <div className="finance-row">
              <span>Discounts</span>
              <strong>Not recorded</strong>
            </div>
            <div className="finance-row">
              <span>Tax</span>
              <strong>{formatPhp(order.tax)}</strong>
            </div>
            <div className="finance-row total-row">
              <span>Total</span>
              <strong>{formatPhp(order.total)}</strong>
            </div>
          </article>
        </div>

        {!voidRecord ? (
          <div className="sheet-footer">
            <button type="button" className="danger-button" onClick={onVoid}>
              Void Order
            </button>
          </div>
        ) : null}
      </section>
    </div>
  )
}

type DailyLogEditorModalProps = {
  draft: DailyLogDraftState
  onClose: () => void
  onDateChange: (value: string) => void
  onEntryChange: (entryIndex: number, field: 'ingredientName' | 'price' | 'unit', value: string) => void
  onAddEntry: () => void
  onSave: () => void
}

function DailyLogEditorModal({ draft, onClose, onDateChange, onEntryChange, onAddEntry, onSave }: DailyLogEditorModalProps) {
  return (
    <div className="modal-overlay" role="presentation">
      <div className="sheet-backdrop" onClick={onClose} />
      <section className="bottom-sheet product-edit-sheet" role="dialog" aria-modal="true" aria-label="Daily log editor">
        <div className="sheet-handle" />
        <header className="product-modal-header">
          <h2>New Daily Log</h2>
          <button type="button" className="sheet-close-button" onClick={onClose} aria-label="Close">
            <CloseIcon />
          </button>
        </header>

        <div className="product-modal-scroll">
          <section className="product-modal-section">
            <label className="input-field">
              <span>Business Date</span>
              <input className="text-input" type="date" value={draft.businessDate} onChange={(event) => onDateChange(event.target.value)} />
            </label>
            <p className="field-helper">
              {draft.copiedFromLabel ? `Starting from latest log ${draft.copiedFromLabel}. Prices can be edited before saving.` : 'No prior log found. Starting from the available ingredient catalog.'}
            </p>
          </section>

          <section className="product-modal-section">
            <div className="section-head">
              <h3>Ingredient Prices</h3>
              <button type="button" className="ghost-pill" onClick={onAddEntry}>
                Add Ingredient
              </button>
            </div>
            <div className="cash-form-stack">
              {draft.entries.map((entry, index) => (
                <article key={`${entry.ingredientId}-${index}`} className="surface-card cash-log-detail-card">
                  <label className="input-field">
                    <span>Ingredient</span>
                    <input
                      className="text-input"
                      value={entry.ingredientName}
                      onChange={(event) => onEntryChange(index, 'ingredientName', event.target.value)}
                      placeholder="Ingredient name"
                    />
                  </label>
                  <label className="input-field">
                    <span>Price</span>
                    <input
                      className="text-input"
                      inputMode="decimal"
                      value={entry.price}
                      onChange={(event) => onEntryChange(index, 'price', event.target.value)}
                    />
                  </label>
                  <label className="input-field">
                    <span>Unit</span>
                    <input className="text-input" value={entry.unit} onChange={(event) => onEntryChange(index, 'unit', event.target.value)} />
                  </label>
                </article>
              ))}
            </div>
          </section>

          {draft.error ? <p className="field-error cash-form-error">{draft.error}</p> : null}
        </div>

        <div className="sheet-footer">
          <button type="button" className="finance-primary-button" onClick={onSave} disabled={draft.saving}>
            {draft.saving ? 'Saving...' : 'Save Daily Log'}
          </button>
        </div>
      </section>
    </div>
  )
}

type RecipeEditorModalProps = {
  draft: RecipeDraft
  error: string
  ingredientCatalog: IngredientCatalogOption[]
  categoryOptions: string[]
  onClose: () => void
  onChange: (update: (current: RecipeDraft) => RecipeDraft) => void
  onSave: () => void
  onAddIngredient: () => void
  onRemoveIngredient: (lineId: string) => void
}

function RecipeEditorModal({
  draft,
  error,
  ingredientCatalog,
  categoryOptions,
  onClose,
  onChange,
  onSave,
  onAddIngredient,
  onRemoveIngredient,
}: RecipeEditorModalProps) {
  const resolvedCategories = uniqueNonEmptyValues(categoryOptions.length > 0 ? categoryOptions : [draft.menuCategory || 'Meals'])

  return (
    <div className="modal-overlay" role="presentation">
      <div className="sheet-backdrop" onClick={onClose} />
      <section className="bottom-sheet product-edit-sheet" role="dialog" aria-modal="true" aria-label="Recipe editor">
        <div className="sheet-handle" />
        <header className="product-modal-header">
          <h2>{draft.recipeName.trim() ? draft.recipeName : 'Recipe Editor'}</h2>
          <button type="button" className="sheet-close-button" onClick={onClose} aria-label="Close">
            <CloseIcon />
          </button>
        </header>

        <div className="product-modal-scroll">
          <section className="product-modal-section">
            <h3>Recipe Details</h3>
            <div className="cash-form-stack">
              <label className="input-field">
                <span>Name</span>
                <input className="text-input" value={draft.recipeName} onChange={(event) => onChange((current) => ({ ...current, recipeName: event.target.value }))} />
              </label>
              <label className="input-field">
                <span>Type</span>
                <select className="cash-select" value={draft.recipeType} onChange={(event) => onChange((current) => ({ ...current, recipeType: event.target.value as 'MENU_ITEM' | 'PREP' }))}>
                  <option value="MENU_ITEM">Menu Item</option>
                  <option value="PREP">Prep</option>
                </select>
              </label>
              <label className="input-field">
                <span>Category</span>
                <select className="cash-select" value={draft.menuCategory} onChange={(event) => onChange((current) => ({ ...current, menuCategory: event.target.value }))}>
                  {resolvedCategories.map((category) => (
                    <option key={category} value={category}>
                      {category}
                    </option>
                  ))}
                </select>
              </label>
              <label className="input-field">
                <span>Servings</span>
                <input className="text-input" inputMode="decimal" value={draft.servings} onChange={(event) => onChange((current) => ({ ...current, servings: sanitizeDecimalInput(event.target.value) }))} />
              </label>
              <label className="input-field">
                <span>Price Per Serving</span>
                <input className="text-input" inputMode="decimal" value={draft.pricePerServing} onChange={(event) => onChange((current) => ({ ...current, pricePerServing: sanitizeDecimalInput(event.target.value) }))} />
              </label>
              <label className="input-field">
                <span>Yield Quantity</span>
                <input className="text-input" inputMode="decimal" value={draft.yieldQuantity} onChange={(event) => onChange((current) => ({ ...current, yieldQuantity: sanitizeDecimalInput(event.target.value) }))} />
              </label>
              <label className="input-field">
                <span>Yield Unit</span>
                <input className="text-input" value={draft.yieldUnit} onChange={(event) => onChange((current) => ({ ...current, yieldUnit: event.target.value }))} />
              </label>
              <label className="input-field">
                <span>Tax Rate (%)</span>
                <input className="text-input" inputMode="decimal" value={draft.taxRatePercent} onChange={(event) => onChange((current) => ({ ...current, taxRatePercent: sanitizeDecimalInput(event.target.value) }))} />
              </label>
            </div>
          </section>

          <section className="product-modal-section">
            <div className="section-head">
              <h3>Profit Snapshot</h3>
            </div>
            <article className="surface-card cash-log-detail-card">
              <div className="finance-row"><span>Total Recipe Cost</span><strong>{formatPhp(draft.summary.totalRecipeCost)}</strong></div>
              <div className="finance-row"><span>Cost Per Serving</span><strong>{formatPhp(draft.summary.costPerServing)}</strong></div>
              <div className="finance-row"><span>Recipe Revenue</span><strong>{formatPhp(draft.summary.revenue)}</strong></div>
              <div className="finance-row"><span>Tax</span><strong>{formatPhp(draft.summary.taxAmount)}</strong></div>
              <div className="finance-row"><span>Net Sales</span><strong>{formatPhp(draft.summary.netSales)}</strong></div>
              <div className="finance-row"><span>Gross Profit</span><strong>{formatPhp(draft.summary.grossProfit)}</strong></div>
              <div className="finance-row"><span>Net Profit</span><strong>{formatPhp(draft.summary.netProfit)}</strong></div>
              <div className="finance-row total-row"><span>Gross Margin</span><strong>{draft.summary.grossMargin.toFixed(1)}%</strong></div>
              {draft.summary.hasConversionIssue ? <p className="field-error">One or more ingredient units do not match, so cost is only partially counted.</p> : null}
            </article>
          </section>

          <section className="product-modal-section">
            <div className="section-head">
              <h3>Ingredients</h3>
              <button type="button" className="ghost-pill" onClick={onAddIngredient}>
                Add Ingredient
              </button>
            </div>
            <div className="cash-form-stack">
              {draft.ingredients.map((line) => (
                <article key={line.id} className="surface-card cash-log-detail-card">
                  <label className="input-field">
                    <span>Ingredient</span>
                    <select
                      className="cash-select"
                      value={line.ingredientRefId}
                      onChange={(event) =>
                        onChange((current) => {
                          const selected = ingredientCatalog.find((item) => item.id === event.target.value)
                          return {
                            ...current,
                            ingredients: current.ingredients.map((item) =>
                              item.id === line.id
                                ? {
                                    ...item,
                                    ingredientRefId: selected?.id ?? '',
                                    ingredientName: selected?.name ?? '',
                                    purchaseQuantity: String(selected?.purchaseQuantity ?? 1),
                                    purchaseUnit: selected?.unit ?? item.purchaseUnit,
                                    recipeUnit: selected?.unit ?? item.recipeUnit,
                                  }
                                : item,
                            ),
                          }
                        })
                      }
                    >
                      <option value="">Select ingredient</option>
                      {ingredientCatalog.map((item) => (
                        <option key={item.id} value={item.id}>
                          {item.name}
                        </option>
                      ))}
                    </select>
                  </label>
                  <div className="field-grid">
                    <label className="input-field">
                      <span>Purchase Qty</span>
                      <input className="text-input" inputMode="decimal" value={line.purchaseQuantity} onChange={(event) => onChange((current) => ({ ...current, ingredients: current.ingredients.map((item) => (item.id === line.id ? { ...item, purchaseQuantity: sanitizeDecimalInput(event.target.value) } : item)) }))} />
                    </label>
                    <label className="input-field">
                      <span>Purchase Unit</span>
                      <input className="text-input" value={line.purchaseUnit} onChange={(event) => onChange((current) => ({ ...current, ingredients: current.ingredients.map((item) => (item.id === line.id ? { ...item, purchaseUnit: event.target.value } : item)) }))} />
                    </label>
                    <label className="input-field">
                      <span>Recipe Qty</span>
                      <input className="text-input" inputMode="decimal" value={line.recipeQuantity} onChange={(event) => onChange((current) => ({ ...current, ingredients: current.ingredients.map((item) => (item.id === line.id ? { ...item, recipeQuantity: sanitizeDecimalInput(event.target.value) } : item)) }))} />
                    </label>
                    <label className="input-field">
                      <span>Recipe Unit</span>
                      <input className="text-input" value={line.recipeUnit} onChange={(event) => onChange((current) => ({ ...current, ingredients: current.ingredients.map((item) => (item.id === line.id ? { ...item, recipeUnit: event.target.value } : item)) }))} />
                    </label>
                  </div>
                  <div className="sheet-footer">
                    <button type="button" className="secondary-button" onClick={() => onRemoveIngredient(line.id)}>
                      Remove Line
                    </button>
                  </div>
                </article>
              ))}
            </div>
          </section>

          {error ? <p className="field-error cash-form-error">{error}</p> : null}
        </div>

        <div className="sheet-footer">
          <button type="button" className="finance-primary-button" onClick={onSave}>
            Save Recipe
          </button>
        </div>
      </section>
    </div>
  )
}

type CashOverviewScreenProps = {
  data: CashOverviewData
  expectedTotal: number
  difference: number
  onBack: () => void
}

function CashOverviewScreen({ data, expectedTotal, difference, onBack }: CashOverviewScreenProps) {
  const isBalanced = Math.abs(difference) < 0.001

  return (
    <div className="finance-screen">
      <header className="record-header">
        <button type="button" className="back-button icon-back-button" onClick={onBack} aria-label="Back">
          <span aria-hidden="true">&lt;</span>
        </button>
        <h1>Cash Overview</h1>
        <span className="header-spacer" aria-hidden="true" />
      </header>

      <section className={`finance-highlight-card ${isBalanced ? 'is-healthy' : 'is-warning'}`}>
        <p className="finance-highlight-label">Total Cash Available</p>
        <strong>{formatPhp(data.totalCashOnHand)}</strong>
        <div className="finance-split-grid">
          <div>
            <span>Main Safe</span>
            <strong>{formatPhp(data.openingCash)}</strong>
          </div>
          <div>
            <span>Tablet Cash</span>
            <strong>{formatPhp(data.cashSalesToday)}</strong>
          </div>
          <div>
            <span>GCash</span>
            <strong>{formatPhp(data.digitalPayments)}</strong>
          </div>
        </div>
      </section>

      {!isBalanced ? (
        <div className="finance-warning-banner">
          Expected total is {formatPhp(expectedTotal)}. Current difference: {formatSignedPhp(difference)}.
        </div>
      ) : null}

      <section className="finance-card-stack">
        <article className="surface-card finance-detail-card">
          <div className="finance-row">
            <span>Opening Cash</span>
            <strong>{formatPhp(data.openingCash)}</strong>
          </div>
          <div className="finance-row">
            <span>Tablet 1 + Tablet 2 Cash Sales</span>
            <strong>{formatPhp(data.cashSalesToday)}</strong>
          </div>
          <div className="finance-row">
            <span>GCash</span>
            <strong>{formatPhp(data.digitalPayments)}</strong>
          </div>
          <div className="finance-row total-row">
            <span>Main Safe + Cash + GCash</span>
            <strong>{formatPhp(expectedTotal)}</strong>
          </div>
        </article>
      </section>
    </div>
  )
}

type SalesRangeScreenProps = {
  summary: SalesRangeSummary
  dateRange: DateRangeValue
  onDateRangeChange: (value: DateRangeValue | ((current: DateRangeValue) => DateRangeValue)) => void
  onBack: () => void
}

function SalesRangeScreen({ summary, dateRange, onDateRangeChange, onBack }: SalesRangeScreenProps) {
  return (
    <div className="finance-screen">
      <header className="record-header">
        <button type="button" className="back-button icon-back-button" onClick={onBack} aria-label="Back">
          <span aria-hidden="true">&lt;</span>
        </button>
        <h1>Sales Range</h1>
        <span className="header-spacer" aria-hidden="true" />
      </header>

      <div className="control-field control-field-full">
        <span>Date Range</span>
        <DateRangeInputs value={dateRange} onChange={onDateRangeChange} />
      </div>

      <section className="finance-highlight-card is-healthy">
        <p className="finance-highlight-label">Total Sales Intake</p>
        <strong>{formatPhp(summary.totalSales)}</strong>
        <div className="finance-split-grid">
          <div>
            <span>Cash</span>
            <strong>{formatPhp(summary.cashSales)}</strong>
          </div>
          <div>
            <span>GCash</span>
            <strong>{formatPhp(summary.gcashSales)}</strong>
          </div>
          <div>
            <span>Orders</span>
            <strong>{summary.orderCount}</strong>
          </div>
        </div>
      </section>

      <section className="finance-card-stack">
        <article className="surface-card finance-detail-card">
          <div className="finance-row">
            <span>Date Range</span>
            <strong>{summary.rangeLabel}</strong>
          </div>
          <div className="finance-row">
            <span>Cash Sales</span>
            <strong>{formatPhp(summary.cashSales)}</strong>
          </div>
          <div className="finance-row">
            <span>GCash</span>
            <strong>{formatPhp(summary.gcashSales)}</strong>
          </div>
          {summary.otherSales > 0.001 ? (
            <div className="finance-row">
              <span>Other Payments</span>
              <strong>{formatPhp(summary.otherSales)}</strong>
            </div>
          ) : null}
          <div className="finance-row">
            <span>Average Order</span>
            <strong>{formatPhp(summary.averageOrder)}</strong>
          </div>
          <div className="finance-row total-row">
            <span>Total Sales</span>
            <strong>{formatPhp(summary.totalSales)}</strong>
          </div>
        </article>
      </section>
    </div>
  )
}

type DateRangeInputsProps = {
  value: DateRangeValue
  onChange: (value: DateRangeValue | ((current: DateRangeValue) => DateRangeValue)) => void
}

function DateRangeInputs({ value, onChange }: DateRangeInputsProps) {
  return (
    <div className="date-range-input-grid">
      <label className="date-input-shell">
        <CalendarIcon />
        <input
          type="date"
          value={value.start}
          max={value.end || undefined}
          aria-label="Start date"
          onChange={(event) => onChange((current) => ({ ...current, start: event.target.value }))}
        />
      </label>
      <label className="date-input-shell">
        <CalendarIcon />
        <input
          type="date"
          value={value.end}
          min={value.start || undefined}
          aria-label="End date"
          onChange={(event) => onChange((current) => ({ ...current, end: event.target.value }))}
        />
      </label>
    </div>
  )
}

type CashControlScreenProps = {
  accounts: CashAccount[]
  movements: CashMovement[]
  selectedAccount: CashAccount
  selectedAccountId: string
  notice: string
  onBack: () => void
  onSelectAccount: (accountId: string) => void
  onOpenAction: (modal: CashControlModal) => void
}

function CashControlScreen({
  accounts,
  movements,
  selectedAccount,
  selectedAccountId,
  notice,
  onBack,
  onSelectAccount,
  onOpenAction,
}: CashControlScreenProps) {
  return (
    <div className="finance-screen">
      <header className="record-header">
        <button type="button" className="back-button icon-back-button" onClick={onBack} aria-label="Back">
          <span aria-hidden="true">&lt;</span>
        </button>
        <h1>Cash Control</h1>
        <span className="header-spacer" aria-hidden="true" />
      </header>

      {notice ? <div className="finance-notice-banner">{notice}</div> : null}

      <section className="finance-card-stack cash-account-stack">
        {accounts.map((account) => (
          <article
            key={account.id}
            className={`surface-card cash-account-card ${selectedAccountId === account.id ? 'is-selected' : ''}`}
            onClick={() => onSelectAccount(account.id)}
          >
            <div className="cash-account-head">
              <div>
                <strong>{account.name}</strong>
                <small>{account.type === 'bank' ? 'Digital settlement account' : 'Cash handling location'}</small>
              </div>
              <span className="cash-account-balance">{formatPhp(account.currentBalance)}</span>
            </div>

            <div className="cash-account-metrics">
              <div>
                <span>Expected</span>
                <strong>{formatPhp(account.expectedBalance)}</strong>
              </div>
              <div>
                <span>{account.type === 'bank' ? 'GCash Sales Today' : 'Cash Sales Today'}</span>
                <strong>{formatPhp(account.salesToday)}</strong>
              </div>
            </div>

            <div className="cash-account-foot">
              <small>{account.lastActivityNote}</small>
              <span>{formatActivityTime(account.lastActivityAt)}</span>
            </div>
          </article>
        ))}
      </section>

      <section className="surface-card cash-control-summary">
        <div className="finance-row">
          <span>Selected Account</span>
          <strong>{selectedAccount.name}</strong>
        </div>
        <div className="finance-row">
          <span>Current Balance</span>
          <strong>{formatPhp(selectedAccount.currentBalance)}</strong>
        </div>
        <div className="finance-row">
          <span>Last Activity</span>
          <strong>{formatActivityTime(selectedAccount.lastActivityAt)}</strong>
        </div>
        <div className="finance-row total-row">
          <span>Audit Entries</span>
          <strong>{cashMovementCountForAccount(movements, selectedAccount.id)}</strong>
        </div>
      </section>

      <div className="cash-action-grid">
        <button type="button" className="finance-primary-button" onClick={() => onOpenAction({ type: 'cash_pull' })}>
          Cash Pull
        </button>
        <button type="button" className="finance-secondary-button" onClick={() => onOpenAction({ type: 'transfer' })}>
          Transfer
        </button>
        <button type="button" className="finance-secondary-button" onClick={() => onOpenAction({ type: 'adjust' })}>
          Adjust
        </button>
        <button type="button" className="finance-secondary-button" onClick={() => onOpenAction({ type: 'logs' })}>
          Logs
        </button>
      </div>
    </div>
  )
}

type CashControlModalSheetProps = {
  modal: NonNullable<CashControlModal>
  accounts: CashAccount[]
  movements: CashMovement[]
  transferDraft: TransferDraft
  adjustDraft: AdjustDraft
  cashPullDraft: CashPullDraft
  error: string
  activeMovement: CashMovement | null
  onClose: () => void
  onTransferDraftChange: (value: TransferDraft | ((current: TransferDraft) => TransferDraft)) => void
  onAdjustDraftChange: (value: AdjustDraft | ((current: AdjustDraft) => AdjustDraft)) => void
  onCashPullDraftChange: (value: CashPullDraft | ((current: CashPullDraft) => CashPullDraft)) => void
  onSubmitTransfer: () => void
  onSubmitAdjust: () => void
  onSubmitCashPull: () => void
  onOpenLogDetail: (movementId: string) => void
}

function CashControlModalSheet({
  modal,
  accounts,
  movements,
  transferDraft,
  adjustDraft,
  cashPullDraft,
  error,
  activeMovement,
  onClose,
  onTransferDraftChange,
  onAdjustDraftChange,
  onCashPullDraftChange,
  onSubmitTransfer,
  onSubmitAdjust,
  onSubmitCashPull,
  onOpenLogDetail,
}: CashControlModalSheetProps) {
  const tabletAccounts = accounts.filter((account) => account.type === 'tablet')

  if (modal.type === 'logs') {
    return (
      <div className="modal-overlay" role="presentation">
        <div className="sheet-backdrop" onClick={onClose} />
        <section className="bottom-sheet cash-sheet" role="dialog" aria-modal="true" aria-label="Cash movement logs">
          <div className="sheet-handle" />
          <header className="product-modal-header">
            <h2>Cash Movement Logs</h2>
            <button type="button" className="sheet-close-button" onClick={onClose} aria-label="Close">
              <CloseIcon />
            </button>
          </header>

          <div className="product-modal-scroll">
            <div className="cash-log-list">
              {movements.map((movement) => (
                <button
                  key={movement.id}
                  type="button"
                  className="surface-card cash-log-card"
                  onClick={() => onOpenLogDetail(movement.id)}
                >
                  <div className="cash-log-head">
                    <strong>{cashMovementLabel(movement.type)}</strong>
                    <span>{formatPhp(movement.amount)}</span>
                  </div>
                  <small>{formatCashMovementAccounts(movement, accounts)}</small>
                  <small>{formatCashMovementMeta(movement)}</small>
                </button>
              ))}
            </div>
          </div>
        </section>
      </div>
    )
  }

  if (modal.type === 'log_detail' && activeMovement) {
    return (
      <div className="modal-overlay" role="presentation">
        <div className="sheet-backdrop" onClick={onClose} />
        <section className="bottom-sheet cash-sheet" role="dialog" aria-modal="true" aria-label="Cash movement detail">
          <div className="sheet-handle" />
          <header className="product-modal-header">
            <h2>{cashMovementLabel(activeMovement.type)}</h2>
            <button type="button" className="sheet-close-button" onClick={onClose} aria-label="Close">
              <CloseIcon />
            </button>
          </header>

          <div className="product-modal-scroll">
            <article className="surface-card cash-log-detail-card">
              <div className="finance-row">
                <span>Date / Time</span>
                <strong>{formatFullDateTime(activeMovement.createdAt)}</strong>
              </div>
              <div className="finance-row">
                <span>Amount</span>
                <strong>{formatPhp(activeMovement.amount)}</strong>
              </div>
              <div className="finance-row">
                <span>Accounts</span>
                <strong>{formatCashMovementAccounts(activeMovement, accounts)}</strong>
              </div>
              <div className="finance-row">
                <span>Created By</span>
                <strong>{activeMovement.createdBy}</strong>
              </div>
              <div className="finance-row">
                <span>Device Source</span>
                <strong>{activeMovement.deviceSource}</strong>
              </div>
              <div className="finance-row">
                <span>Note</span>
                <strong>{activeMovement.note}</strong>
              </div>
            </article>
          </div>
        </section>
      </div>
    )
  }

  return (
    <div className="modal-overlay" role="presentation">
      <div className="sheet-backdrop" onClick={onClose} />
      <section className="bottom-sheet cash-sheet" role="dialog" aria-modal="true" aria-label="Cash control action">
        <div className="sheet-handle" />
        <header className="product-modal-header">
          <h2>{modal.type === 'transfer' ? 'Transfer' : modal.type === 'adjust' ? 'Adjust' : 'Cash Pull'}</h2>
          <button type="button" className="sheet-close-button" onClick={onClose} aria-label="Close">
            <CloseIcon />
          </button>
        </header>

        <div className="product-modal-scroll">
          {modal.type === 'transfer' ? (
            <div className="cash-form-stack">
              <label className="input-field">
                <span>From Account</span>
                <select
                  className="cash-select"
                  value={transferDraft.fromAccountId}
                  onChange={(event) => onTransferDraftChange((current) => ({ ...current, fromAccountId: event.target.value }))}
                >
                  {accounts.map((account) => (
                    <option key={account.id} value={account.id}>
                      {account.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="input-field">
                <span>To Account</span>
                <select
                  className="cash-select"
                  value={transferDraft.toAccountId}
                  onChange={(event) => onTransferDraftChange((current) => ({ ...current, toAccountId: event.target.value }))}
                >
                  {accounts.map((account) => (
                    <option key={account.id} value={account.id}>
                      {account.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="input-field">
                <span>Amount</span>
                <input
                  className="text-input"
                  inputMode="decimal"
                  value={transferDraft.amount}
                  onChange={(event) => onTransferDraftChange((current) => ({ ...current, amount: event.target.value }))}
                />
              </label>
              <label className="input-field">
                <span>Note / Reason</span>
                <textarea
                  className="text-area"
                  value={transferDraft.note}
                  onChange={(event) => onTransferDraftChange((current) => ({ ...current, note: event.target.value }))}
                />
              </label>
            </div>
          ) : null}

          {modal.type === 'adjust' ? (
            <div className="cash-form-stack">
              <label className="input-field">
                <span>Account</span>
                <select
                  className="cash-select"
                  value={adjustDraft.accountId}
                  onChange={(event) => onAdjustDraftChange((current) => ({ ...current, accountId: event.target.value }))}
                >
                  {accounts.map((account) => (
                    <option key={account.id} value={account.id}>
                      {account.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="input-field">
                <span>Adjustment Type</span>
                <select
                  className="cash-select"
                  value={adjustDraft.adjustmentType}
                  onChange={(event) =>
                    onAdjustDraftChange((current) => ({
                      ...current,
                      adjustmentType: event.target.value as 'add' | 'remove',
                    }))
                  }
                >
                  <option value="add">Add</option>
                  <option value="remove">Remove</option>
                </select>
              </label>
              <label className="input-field">
                <span>Amount</span>
                <input
                  className="text-input"
                  inputMode="decimal"
                  value={adjustDraft.amount}
                  onChange={(event) => onAdjustDraftChange((current) => ({ ...current, amount: event.target.value }))}
                />
              </label>
              <label className="input-field">
                <span>Note / Reason</span>
                <textarea
                  className="text-area"
                  value={adjustDraft.note}
                  onChange={(event) => onAdjustDraftChange((current) => ({ ...current, note: event.target.value }))}
                />
              </label>
            </div>
          ) : null}

          {modal.type === 'cash_pull' ? (
            <div className="cash-form-stack">
              <label className="input-field">
                <span>Tablet Source</span>
                <select
                  className="cash-select"
                  value={cashPullDraft.fromAccountId}
                  onChange={(event) => onCashPullDraftChange((current) => ({ ...current, fromAccountId: event.target.value }))}
                >
                  {tabletAccounts.map((account) => (
                    <option key={account.id} value={account.id}>
                      {account.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="input-field">
                <span>Amount</span>
                <input
                  className="text-input"
                  inputMode="decimal"
                  value={cashPullDraft.amount}
                  onChange={(event) => onCashPullDraftChange((current) => ({ ...current, amount: event.target.value }))}
                />
              </label>
              <label className="input-field">
                <span>Note / Reason</span>
                <textarea
                  className="text-area"
                  value={cashPullDraft.note}
                  onChange={(event) => onCashPullDraftChange((current) => ({ ...current, note: event.target.value }))}
                />
              </label>
            </div>
          ) : null}

          {error ? <p className="field-error cash-form-error">{error}</p> : null}
        </div>

        <div className="sheet-footer">
          <button
            type="button"
            className="finance-primary-button"
            onClick={modal.type === 'transfer' ? onSubmitTransfer : modal.type === 'adjust' ? onSubmitAdjust : onSubmitCashPull}
          >
            Save
          </button>
        </div>
      </section>
    </div>
  )
}

type BillsPayablesScreenProps = {
  bills: BillRecord[]
  totalOutstanding: number
  onBack: () => void
}

function BillsPayablesScreen({ bills, totalOutstanding, onBack }: BillsPayablesScreenProps) {
  return (
    <div className="finance-screen">
      <header className="record-header">
        <button type="button" className="back-button icon-back-button" onClick={onBack} aria-label="Back">
          <span aria-hidden="true">&lt;</span>
        </button>
        <h1>Bills & Payables</h1>
        <span className="header-spacer" aria-hidden="true" />
      </header>

      <section className="surface-card finance-highlight-card finance-neutral-card">
        <p className="finance-highlight-label">Total Outstanding</p>
        <strong>{formatPhp(totalOutstanding)}</strong>
      </section>

      <section className="finance-card-stack">
        <article className="surface-card finance-table-card">
          <div className="finance-table-head">
            <span>Vendor</span>
            <span>Due Date</span>
            <span>Amount</span>
          </div>

          {bills.map((bill) => {
            const status = getBillStatus(bill)
            return (
              <div key={bill.id} className="finance-table-row">
                <div className="finance-vendor-cell">
                  <strong>{bill.vendor}</strong>
                  <small>{status.label}</small>
                </div>
                <div>
                  <span>{formatDueDate(bill.dueDate)}</span>
                  <small className={`inline-status status-${status.tone}`}>{status.label}</small>
                </div>
                <div className="align-right">
                  <strong>{formatPhp(bill.amount)}</strong>
                </div>
              </div>
            )
          })}
        </article>
      </section>
    </div>
  )
}

type ProfitInsightsScreenProps = {
  data: ProfitData
  grossProfit: number
  margin: number
  onBack: () => void
}

function ProfitInsightsScreen({ data, grossProfit, margin, onBack }: ProfitInsightsScreenProps) {
  const isNegative = grossProfit < 0

  return (
    <div className="finance-screen">
      <header className="record-header">
        <button type="button" className="back-button icon-back-button" onClick={onBack} aria-label="Back">
          <span aria-hidden="true">&lt;</span>
        </button>
        <h1>Profit Insights</h1>
        <span className="header-spacer" aria-hidden="true" />
      </header>

      <section className={`surface-card finance-highlight-card ${isNegative ? 'is-danger' : 'finance-neutral-card'}`}>
        <div className="finance-split-grid two-column finance-profit-headline">
          <div>
            <span>Gross Profit</span>
            <strong>{formatPhp(grossProfit)}</strong>
          </div>
          <div>
            <span>Margin</span>
            <strong>{data.revenue === 0 ? 'N/A' : `${margin.toFixed(1)}%`}</strong>
          </div>
        </div>
      </section>

      <section className="finance-card-stack">
        <article className="surface-card finance-detail-card">
          <div className="finance-row">
            <span>Revenue</span>
            <strong>{formatPhp(data.revenue)}</strong>
          </div>
          <div className="finance-row">
            <span>Cost (COGS)</span>
            <strong>{formatPhp(data.cogs)}</strong>
          </div>
          <div className={`finance-row total-row ${isNegative ? 'tone-danger' : 'tone-positive'}`}>
            <span>Gross Profit</span>
            <strong>{formatPhp(grossProfit)}</strong>
          </div>
          <div className="finance-row">
            <span>Margin %</span>
            <strong>{data.revenue === 0 ? 'N/A' : `${margin.toFixed(1)}%`}</strong>
          </div>
        </article>
      </section>
    </div>
  )
}

type MenuSettingsScreenProps = {
  items: MenuItem[]
  search: string
  activeCategory: string
  onSearchChange: (value: string) => void
  onCategoryChange: (category: string) => void
  onBack: () => void
  onEditItem: (itemId: string) => void
  onOpenCategorySettings: () => void
}

function MenuSettingsScreen({
  items,
  search,
  activeCategory,
  onSearchChange,
  onCategoryChange,
  onBack,
  onEditItem,
  onOpenCategorySettings,
}: MenuSettingsScreenProps) {
  return (
    <div className="product-screen">
      <header className="product-header">
        <button type="button" className="back-button icon-back-button" onClick={onBack} aria-label="Back">
          <span aria-hidden="true">&lt;</span>
        </button>
        <h1>Menu Settings</h1>
        <span className="header-spacer" aria-hidden="true" />
      </header>

      <label className="search-shell">
        <SearchIcon />
        <input
          type="search"
          value={search}
          onChange={(event) => onSearchChange(event.target.value)}
          placeholder="Search menu items..."
          aria-label="Search menu items"
        />
      </label>

      <div className="product-chip-row" role="tablist" aria-label="Menu categories">
        {menuFilterChips.map((category) => (
          <button
            key={category}
            type="button"
            className={`product-chip ${activeCategory === category ? 'is-active' : ''}`}
            onClick={() => onCategoryChange(category)}
          >
            {category}
          </button>
        ))}
      </div>

      <button type="button" className="surface-card category-settings-entry" onClick={onOpenCategorySettings}>
        <span className="category-settings-copy">
          <strong>Category Settings</strong>
          <small>Manage category icons, order, naming, and visibility structure</small>
        </span>
        <span className="action-row-chevron" aria-hidden="true">&gt;</span>
      </button>

      <div className="menu-card-list">
        {items.map((item) => (
          <article key={item.id} className="surface-card menu-item-card">
            <SafeMenuImage className="menu-item-thumb" imagePath={item.imagePath} name={item.name} />
            <div className="menu-item-copy">
              <strong>{item.name}</strong>
              <small>{item.category} • {item.description}</small>
            </div>
            <div className="menu-item-actions">
              <span className={`status-badge status-${item.status}`}>{menuStatusLabel(item.status)}</span>
              <button
                type="button"
                className="edit-icon-button"
                onClick={() => onEditItem(item.id)}
                aria-label={`Edit ${item.name}`}
              >
                <PencilIcon />
              </button>
            </div>
          </article>
        ))}

        {items.length === 0 ? (
          <div className="surface-card empty-state-card">
            <strong>No menu items found</strong>
            <p>Adjust the filters or search terms to see matching products.</p>
          </div>
        ) : null}
      </div>
    </div>
  )
}

type CategoryManagementScreenProps = {
  categories: CategoryItem[]
  draggedCategoryId: string | null
  onBack: () => void
  onAddCategory: () => void
  onEditCategory: (categoryId: string) => void
  onDeleteCategory: (categoryId: string) => void
  onDragCategoryStart: (categoryId: string | null) => void
  onDragCategoryEnd: () => void
  onMoveCategory: (sourceId: string, targetId: string) => void
}

function CategoryManagementScreen({
  categories,
  draggedCategoryId,
  onBack,
  onAddCategory,
  onEditCategory,
  onDeleteCategory,
  onDragCategoryStart,
  onDragCategoryEnd,
  onMoveCategory,
}: CategoryManagementScreenProps) {
  return (
    <div className="product-screen">
      <header className="product-header product-header-stack">
        <div className="product-header-row">
          <button type="button" className="back-button icon-back-button" onClick={onBack} aria-label="Back">
            <span aria-hidden="true">&lt;</span>
          </button>
          <div className="product-header-copy">
            <h1>Category Settings</h1>
            <p>{categories.length} categories total</p>
          </div>
        </div>
      </header>

      <button type="button" className="add-category-button" onClick={onAddCategory}>
        + Add New Category
      </button>

      <div className="category-management-list">
        {categories.map((category) => (
          <article
            key={category.id}
            className={`surface-card category-row-card ${draggedCategoryId === category.id ? 'is-dragging' : ''}`}
            draggable
            onDragStart={() => onDragCategoryStart(category.id)}
            onDragEnd={onDragCategoryEnd}
            onDragOver={(event) => event.preventDefault()}
            onDrop={() => {
              if (draggedCategoryId) {
                onMoveCategory(draggedCategoryId, category.id)
              }
              onDragCategoryEnd()
            }}
          >
            <span className="drag-handle" aria-hidden="true">
              <DragHandleIcon />
            </span>
            <CategoryIconBadge icon={category.icon} />
            <div className="category-row-copy">
              <strong>{category.name}</strong>
              <small>{category.itemCount} items</small>
            </div>
            <div className="category-row-actions">
              <button type="button" className="row-icon-button" onClick={() => onEditCategory(category.id)} aria-label={`Edit ${category.name}`}>
                <PencilIcon />
              </button>
              <button type="button" className="row-icon-button danger-row-button" onClick={() => onDeleteCategory(category.id)} aria-label={`Delete ${category.name}`}>
                <TrashIcon />
              </button>
            </div>
          </article>
        ))}
      </div>
    </div>
  )
}

type ProductEditModalProps = {
  modal: NonNullable<ProductModalState>
  menuItem: MenuItem | null
  category: CategoryItem | null
  onClose: () => void
  onSaveMenuItem: (item: MenuItem) => void
  onRemoveMenuItem: (itemId: string) => void
  onSaveCategory: (input: { id: string | null; name: string; description: string; icon: CategoryIconKey }) => void
  onDeleteCategory: (categoryId: string) => void
}

function ProductEditModal({
  modal,
  menuItem,
  category,
  onClose,
  onSaveMenuItem,
  onRemoveMenuItem,
  onSaveCategory,
  onDeleteCategory,
}: ProductEditModalProps) {
  const [menuDraft, setMenuDraft] = useState<MenuItem | null>(menuItem)
  const [categoryDraft, setCategoryDraft] = useState({
    id: category?.id ?? null,
    name: category?.name ?? '',
    description: category?.description ?? '',
    icon: category?.icon ?? inferCategoryIcon(category?.name ?? ''),
  })

  if (modal.type === 'menu-item' && menuDraft) {
    return (
      <div className="modal-overlay" role="presentation">
        <div className="sheet-backdrop" onClick={onClose} />
        <section className="bottom-sheet product-edit-sheet" role="dialog" aria-modal="true" aria-label="Edit menu item">
          <div className="sheet-handle" />
          <header className="product-modal-header">
            <h2>Edit Menu Item</h2>
            <button type="button" className="sheet-close-button" onClick={onClose} aria-label="Close">
              <CloseIcon />
            </button>
          </header>

          <div className="product-modal-scroll">
            <section className="product-modal-section">
              <h3>Item Preview</h3>
              <div className="item-preview-row">
                <SafeMenuImage className="item-preview-thumb" imagePath={menuDraft.imagePath} name={menuDraft.name || 'Menu Item'} />
                <div className="item-preview-copy">
                  <strong>{menuDraft.name}</strong>
                  <small>Category: {menuDraft.category}</small>
                </div>
                <div className="item-preview-actions">
                  <button
                    type="button"
                    className="image-action-button"
                    onClick={() =>
                      setMenuDraft((current) =>
                        current ? { ...current, imagePath: null } : current,
                      )
                    }
                  >
                    Change Image
                  </button>
                  <button
                    type="button"
                    className="image-action-button image-action-danger"
                    onClick={() =>
                      setMenuDraft((current) =>
                        current ? { ...current, imagePath: null } : current,
                      )
                    }
                  >
                    Remove Image
                  </button>
                </div>
              </div>
            </section>

            <section className="product-modal-section">
              <h3>Pricing</h3>
              <div className="field-grid">
                <label className="input-field">
                  <span>Default Price</span>
                  <div className="currency-input">
                    <em>PHP</em>
                    <input
                      type="number"
                      min="0"
                      value={menuDraft.price}
                      onChange={(event) =>
                        setMenuDraft((current) =>
                          current ? { ...current, price: Number(event.target.value) || 0 } : current,
                        )
                      }
                    />
                  </div>
                </label>
                <label className="input-field">
                  <span>Half Portion</span>
                  <div className="currency-input">
                    <em>PHP</em>
                    <input
                      type="number"
                      min="0"
                      value={menuDraft.halfPrice}
                      onChange={(event) =>
                        setMenuDraft((current) =>
                          current ? { ...current, halfPrice: Number(event.target.value) || 0 } : current,
                        )
                      }
                    />
                  </div>
                </label>
              </div>
            </section>

            <section className="product-modal-section">
              <h3>Status Selector</h3>
              <div className="status-selector">
                {(['available', 'unavailable', 'hidden'] as MenuItemStatus[]).map((status) => (
                  <button
                    key={status}
                    type="button"
                    className={`status-choice ${menuDraft.status === status ? `is-${status}` : ''}`}
                    onClick={() => setMenuDraft((current) => (current ? { ...current, status } : current))}
                  >
                    {menuStatusLabel(status)}
                  </button>
                ))}
              </div>
            </section>
          </div>

          <div className="sheet-footer product-sheet-footer">
            <button type="button" className="save-changes-button" onClick={() => onSaveMenuItem(menuDraft)}>
              Save Changes
            </button>
            <button type="button" className="text-danger-button" onClick={() => onRemoveMenuItem(menuDraft.id)}>
              Remove Item
            </button>
          </div>
        </section>
      </div>
    )
  }

  if (modal.type === 'category') {
    return (
      <div className="modal-overlay" role="presentation">
        <div className="sheet-backdrop" onClick={onClose} />
        <section className="bottom-sheet product-edit-sheet" role="dialog" aria-modal="true" aria-label="Edit category">
          <div className="sheet-handle" />
          <header className="product-modal-header">
            <h2>{categoryDraft.id ? 'Edit Category' : 'Add Category'}</h2>
            <button type="button" className="sheet-close-button" onClick={onClose} aria-label="Close">
              <CloseIcon />
            </button>
          </header>

          <div className="product-modal-scroll">
            <section className="product-modal-section">
              <label className="input-field">
                <span>Category Name</span>
                <input
                  className="text-input"
                  type="text"
                  value={categoryDraft.name}
                  onChange={(event) => setCategoryDraft((current) => ({ ...current, name: event.target.value }))}
                />
              </label>
              <label className="input-field">
                <span>Description</span>
                <textarea
                  className="text-area"
                  value={categoryDraft.description}
                  onChange={(event) =>
                    setCategoryDraft((current) => ({ ...current, description: event.target.value }))
                  }
                />
              </label>
            </section>
          </div>

          <div className="sheet-footer product-sheet-footer">
            <button type="button" className="save-changes-button" onClick={() => onSaveCategory(categoryDraft)}>
              Save
            </button>
            {categoryDraft.id ? (
              <button type="button" className="text-danger-button" onClick={() => onDeleteCategory(categoryDraft.id as string)}>
                Delete Category
              </button>
            ) : null}
          </div>
        </section>
      </div>
    )
  }

  return null
}

type MenuSettingsScreenV2Props = {
  items: MenuItem[]
  categories: CategoryItem[]
  halfOrderPriceSupported: boolean
  search: string
  activeCategory: string
  onSearchChange: (value: string) => void
  onCategoryChange: (category: string) => void
  onBack: () => void
  onAddItem: () => void
  onEditItem: (itemId: string) => void
  onOpenCategorySettings: () => void
}

function MenuSettingsScreenV2({
  items,
  categories,
  halfOrderPriceSupported,
  search,
  activeCategory,
  onSearchChange,
  onCategoryChange,
  onBack,
  onAddItem,
  onEditItem,
  onOpenCategorySettings,
}: MenuSettingsScreenV2Props) {
  const categoryChips = ['All', ...uniqueNonEmptyValues(categories.map((category) => category.name))]
  const categoryIconByName = new Map(categories.map((category) => [category.name, category.icon]))

  return (
    <div className="product-screen">
      <header className="product-header">
        <button type="button" className="back-button icon-back-button" onClick={onBack} aria-label="Back">
          <span aria-hidden="true">&lt;</span>
        </button>
        <h1>Menu Settings</h1>
        <span className="header-spacer" aria-hidden="true" />
      </header>

      <label className="search-shell">
        <SearchIcon />
        <input
          type="search"
          value={search}
          onChange={(event) => onSearchChange(event.target.value)}
          placeholder="Search menu items..."
          aria-label="Search menu items"
        />
      </label>

      <div className="product-chip-row" role="tablist" aria-label="Menu categories">
        {categoryChips.map((category) => (
          <button
            key={category}
            type="button"
            className={`product-chip ${activeCategory === category ? 'is-active' : ''}`}
            onClick={() => onCategoryChange(category)}
          >
            {category !== 'All' ? <CategoryIconBadge icon={categoryIconByName.get(category) ?? inferCategoryIcon(category)} /> : null}
            <span>{category}</span>
          </button>
        ))}
      </div>

      <button type="button" className="surface-card category-settings-entry" onClick={onOpenCategorySettings}>
        <span className="category-settings-copy">
          <strong>Category Settings</strong>
          <small>Manage category order, naming, and visibility structure</small>
        </span>
        <span className="action-row-chevron" aria-hidden="true">&gt;</span>
      </button>

      {!halfOrderPriceSupported ? (
        <div className="sync-empty-state">
          <strong>Half-order pricing is unavailable.</strong>
          <p>The current Supabase products schema does not expose a half-price column, so web edits only save the default price.</p>
        </div>
      ) : null}

      <div className="menu-card-list">
        {items.map((item) => (
          <article key={item.id} className="surface-card menu-item-card">
            <SafeMenuImage className="menu-item-thumb" imagePath={item.imagePath} name={item.name} />
            <div className="menu-item-copy">
              <strong>{item.name}</strong>
              <small>{item.category} • {formatPhp(item.price)} default • {item.halfPrice > 0 ? `${formatPhp(item.halfPrice)} half` : 'No half-order price'}</small>
            </div>
            <div className="menu-item-actions">
              <span className={`status-badge status-${item.status}`}>{menuStatusLabel(item.status)}</span>
              <button
                type="button"
                className="edit-icon-button"
                onClick={() => onEditItem(item.id)}
                aria-label={`Edit ${item.name}`}
              >
                <PencilIcon />
              </button>
            </div>
          </article>
        ))}

        {items.length === 0 ? (
          <div className="surface-card empty-state-card">
            <strong>No menu items found</strong>
            <p>Create a product with the plus button to sync it into the shared menu.</p>
          </div>
        ) : null}
      </div>

      <button type="button" className="floating-add-button" onClick={onAddItem} aria-label="Add menu item">
        <PlusIcon />
      </button>
    </div>
  )
}

type RecipesManagementScreenProps = {
  menuItems: MenuRecipeEntry[]
  prepItems: PrepRecipeEntry[]
  halfOrderPriceSupported: boolean
  activeFilter: string
  onFilterChange: (value: string) => void
  onOpenMenuRecipe: (menuItemId: string) => void
  onOpenPrepRecipe: (recipeId: string) => void
  onAddPrepRecipe: () => void
  hasDailyLogIngredients: boolean
  onBack: () => void
}

function RecipesManagementScreen({
  menuItems,
  prepItems,
  halfOrderPriceSupported,
  activeFilter,
  onFilterChange,
  onOpenMenuRecipe,
  onOpenPrepRecipe,
  onAddPrepRecipe,
  hasDailyLogIngredients,
  onBack,
}: RecipesManagementScreenProps) {
  return (
    <div className="record-screen">
      <header className="record-header">
        <button type="button" className="back-button icon-back-button" onClick={onBack} aria-label="Back">
          <span aria-hidden="true">&lt;</span>
        </button>
        <h1>Recipes</h1>
        <button type="button" className="record-icon-button" aria-label="Add prep product" onClick={onAddPrepRecipe}>
          <PlusIcon />
        </button>
      </header>

      <div className="shared-chip-row" role="tablist" aria-label="Recipe filters">
        {recipeFilterChips.map((chip) => (
          <button
            key={chip}
            type="button"
            className={`shared-chip ${activeFilter === chip ? 'is-active' : ''}`}
            onClick={() => onFilterChange(chip)}
          >
            {chip}
          </button>
        ))}
      </div>

      {!hasDailyLogIngredients ? (
        <div className="sync-empty-state">
          <strong>No Daily Log ingredients yet.</strong>
          <p>Save a Daily Log first so recipes can pick from the approved ingredient list.</p>
        </div>
      ) : null}

      {!halfOrderPriceSupported ? (
        <div className="sync-empty-state">
          <strong>Half-order pricing is unavailable.</strong>
          <p>Recipe links still work, but the current Supabase products schema does not store half-price values.</p>
        </div>
      ) : null}

      <section className="recipe-section">
        <div className="recipe-section-head">
          <div>
            <p className="section-kicker">SELLABLE MENU ITEMS</p>
            <h2>Link Recipe to Menu Item</h2>
            <p>Create or manage recipe costing for products created in Menu Settings.</p>
          </div>
        </div>
        <div className="shared-card-list">
          {menuItems.length > 0 ? (
            menuItems.map((item) => (
              <article key={item.menuItemId} className="surface-card recipe-link-card">
                <SafeMenuImage className="shared-thumb-image" imagePath={item.imagePath} name={item.name} />
                <div className="recipe-link-copy">
                  <strong>{item.name}</strong>
                  <small>{item.category} • {formatPhp(item.price)} default • {item.halfPrice > 0 ? `${formatPhp(item.halfPrice)} half` : 'No half-order price'}</small>
                </div>
                <button type="button" className="recipe-link-action" onClick={() => onOpenMenuRecipe(item.menuItemId)}>
                  {item.recipeStatusLabel}
                </button>
              </article>
            ))
          ) : (
            <div className="sync-empty-state">
              <strong>No menu items found.</strong>
              <p>Create products in Menu Settings first, then attach recipes here.</p>
            </div>
          )}
        </div>
      </section>

      <section className="recipe-section">
        <div className="recipe-section-head">
          <div>
            <p className="section-kicker">PREP PRODUCTS</p>
            <h2>Add Prep Product</h2>
            <p>Use prep products for batches and costing inputs that feed other recipes.</p>
          </div>
          <button type="button" className="ghost-pill" onClick={onAddPrepRecipe}>
            Add Prep Product
          </button>
        </div>
        <div className="shared-card-list">
          {prepItems.length > 0 ? (
            prepItems.map((item) => (
              <button key={item.id} type="button" className="record-card-button" onClick={() => onOpenPrepRecipe(item.id)}>
                <UnifiedRecordCard
                  media={<RecipeBookIcon />}
                  title={item.name}
                  subtitle={`${item.category} • ${item.ingredients} ingredients • Yield ${item.yieldLabel}`}
                  sideTop={item.totalCost}
                  sideBottom="Prep Product"
                  emphasizeSideTop
                />
              </button>
            ))
          ) : (
            <div className="sync-empty-state">
              <strong>No prep products yet.</strong>
              <p>Use the plus button here to create sauces, mixes, and other advance-made items.</p>
            </div>
          )}
        </div>
      </section>
    </div>
  )
}

type ProductEditModalV2Props = {
  modal: NonNullable<ProductModalState>
  menuItem: MenuItem | null
  category: CategoryItem | null
  categories: CategoryItem[]
  halfOrderPriceSupported: boolean
  onClose: () => void
  onSaveMenuItem: (item: MenuItem) => Promise<void>
  onRemoveMenuItem: (itemId: string) => Promise<void>
  onSaveCategory: (input: { id: string | null; name: string; description: string; icon: CategoryIconKey }) => void
  onDeleteCategory: (categoryId: string) => void
}

function ProductEditModalV2({
  modal,
  menuItem,
  category,
  categories,
  halfOrderPriceSupported,
  onClose,
  onSaveMenuItem,
  onRemoveMenuItem,
  onSaveCategory,
  onDeleteCategory,
}: ProductEditModalV2Props) {
  const resolvedCategories = uniqueNonEmptyValues(categories.map((entry) => entry.name))
  const [menuDraft, setMenuDraft] = useState<MenuItem | null>(() =>
    modal.type === 'menu-item'
      ? menuItem ?? {
          id: createRandomId('menu-item'),
          name: '',
          category: resolvedCategories[0] ?? 'Meals',
          description: '',
          imagePath: null,
          status: 'available',
          price: 0,
          halfPrice: 0,
        }
      : null,
  )
  const [menuPriceInput, setMenuPriceInput] = useState(() =>
    modal.type === 'menu-item' && menuItem ? String(menuItem.price) : '0',
  )
  const [menuHalfPriceInput, setMenuHalfPriceInput] = useState(() =>
    modal.type === 'menu-item' && menuItem && menuItem.halfPrice > 0 ? String(menuItem.halfPrice) : '',
  )
  const [menuFormError, setMenuFormError] = useState('')
  const [menuSubmitting, setMenuSubmitting] = useState(false)
  const [categoryDraft, setCategoryDraft] = useState({
    id: category?.id ?? null,
    name: category?.name ?? '',
    description: category?.description ?? '',
    icon: category?.icon ?? inferCategoryIcon(category?.name ?? ''),
  })

  async function submitMenuDraft() {
    if (!menuDraft) {
      return
    }

    if (!menuDraft.name.trim()) {
      setMenuFormError('Name is required.')
      return
    }

    if (!menuDraft.category.trim()) {
      setMenuFormError('Category is required.')
      return
    }

    if (menuPriceInput.trim() === '' || !Number.isFinite(Number(menuPriceInput))) {
      setMenuFormError('Default price must be a valid number.')
      return
    }

    if (halfOrderPriceSupported && menuHalfPriceInput.trim() !== '' && !Number.isFinite(Number(menuHalfPriceInput))) {
      setMenuFormError('Half order price must be a valid number.')
      return
    }

    setMenuSubmitting(true)
    setMenuFormError('')
    try {
      await onSaveMenuItem({
        ...menuDraft,
        price: Number(menuPriceInput),
        halfPrice: halfOrderPriceSupported
          ? (menuHalfPriceInput.trim() === '' ? 0 : Number(menuHalfPriceInput))
          : 0,
      })
    } catch (error) {
      setMenuFormError(error instanceof Error ? error.message : 'Failed to save menu item.')
    } finally {
      setMenuSubmitting(false)
    }
  }

  async function removeMenuDraft() {
    if (!menuDraft) {
      return
    }

    setMenuSubmitting(true)
    setMenuFormError('')
    try {
      await onRemoveMenuItem(menuDraft.id)
    } catch (error) {
      setMenuFormError(error instanceof Error ? error.message : 'Failed to remove menu item.')
    } finally {
      setMenuSubmitting(false)
    }
  }

  if (modal.type === 'menu-item' && menuDraft) {
    const canSave = menuDraft.name.trim().length > 0 && menuDraft.category.trim().length > 0 && !menuSubmitting
    return (
      <div className="modal-overlay" role="presentation">
        <div className="sheet-backdrop" onClick={onClose} />
        <section className="bottom-sheet product-edit-sheet" role="dialog" aria-modal="true" aria-label="Menu item editor">
          <div className="sheet-handle" />
          <header className="product-modal-header">
            <h2>{menuItem ? 'Edit Menu Item' : 'Add Menu Item'}</h2>
            <button type="button" className="sheet-close-button" onClick={onClose} aria-label="Close">
              <CloseIcon />
            </button>
          </header>

          <form
            className="product-edit-form"
            onSubmit={(event) => {
              event.preventDefault()
              void submitMenuDraft()
            }}
          >
          <div className="product-modal-scroll">
            <section className="product-modal-section">
              <h3>Product Details</h3>
              <div className="cash-form-stack">
                <label className="input-field">
                  <span>Menu / Product Name</span>
                  <input
                    className="text-input"
                    value={menuDraft.name}
                    onChange={(event) =>
                      {
                        setMenuFormError('')
                        setMenuDraft((current) =>
                          current
                            ? {
                                ...current,
                                name: event.target.value,
                              }
                            : current,
                        )
                      }
                    }
                  />
                </label>
                <label className="input-field">
                  <span>Category</span>
                  {resolvedCategories.length > 0 ? (
                    <select className="cash-select" value={menuDraft.category} onChange={(event) => {
                      setMenuFormError('')
                      setMenuDraft((current) => (current ? { ...current, category: event.target.value } : current))
                    }}>
                      {resolvedCategories.map((entry) => (
                        <option key={entry} value={entry}>
                          {entry}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <input
                      className="text-input"
                      value={menuDraft.category}
                      onChange={(event) => {
                        setMenuFormError('')
                        setMenuDraft((current) => (current ? { ...current, category: event.target.value } : current))
                      }}
                    />
                  )}
                </label>
                <label className="input-field">
                  <span>Description</span>
                  <textarea className="text-area" value={menuDraft.description} onChange={(event) => {
                    setMenuFormError('')
                    setMenuDraft((current) => (current ? { ...current, description: event.target.value } : current))
                  }} />
                </label>
              </div>
            </section>

            <section className="product-modal-section">
              <h3>Pricing</h3>
              <div className="field-grid">
                <label className="input-field">
                  <span>Default Price</span>
                  <div className="currency-input">
                    <em>PHP</em>
                    <input
                      type="text"
                      inputMode="decimal"
                      value={menuPriceInput}
                      onChange={(event) => {
                        setMenuPriceInput(sanitizeDecimalInput(event.target.value))
                        setMenuFormError('')
                      }}
                    />
                  </div>
                </label>
                {halfOrderPriceSupported ? (
                  <label className="input-field">
                    <span>Half Order Price</span>
                    <div className="currency-input">
                      <em>PHP</em>
                      <input
                        type="text"
                        inputMode="decimal"
                        value={menuHalfPriceInput}
                        onChange={(event) => {
                          setMenuHalfPriceInput(sanitizeDecimalInput(event.target.value))
                          setMenuFormError('')
                        }}
                      />
                    </div>
                  </label>
                ) : (
                  <div className="sync-empty-state">
                    <strong>Half-order pricing is unavailable.</strong>
                    <p>This Supabase products schema does not include a half-price field yet.</p>
                  </div>
                )}
              </div>
            </section>

            <section className="product-modal-section">
              <h3>Status Selector</h3>
              <div className="status-selector">
                {(['available', 'unavailable', 'hidden'] as MenuItemStatus[]).map((status) => (
                  <button
                    key={status}
                    type="button"
                    className={`status-choice ${menuDraft.status === status ? `is-${status}` : ''}`}
                    onClick={() => {
                      setMenuFormError('')
                      setMenuDraft((current) => (current ? { ...current, status } : current))
                    }}
                  >
                    {menuStatusLabel(status)}
                  </button>
                ))}
              </div>
            </section>

            {menuFormError ? <p className="field-error cash-form-error">{menuFormError}</p> : null}
          </div>

          <div className="sheet-footer product-sheet-footer">
            <button type="submit" className="save-changes-button" disabled={!canSave}>
              {menuSubmitting ? 'Saving...' : menuItem ? 'Save Changes' : 'Add Menu Item'}
            </button>
            {menuItem ? (
              <button type="button" className="text-danger-button" onClick={() => void removeMenuDraft()} disabled={menuSubmitting}>
                Remove Item
              </button>
            ) : null}
          </div>
          </form>
        </section>
      </div>
    )
  }

  if (modal.type === 'category') {
    return (
      <div className="modal-overlay" role="presentation">
        <div className="sheet-backdrop" onClick={onClose} />
        <section className="bottom-sheet product-edit-sheet" role="dialog" aria-modal="true" aria-label="Edit category">
          <div className="sheet-handle" />
          <header className="product-modal-header">
            <h2>{categoryDraft.id ? 'Edit Category' : 'Add Category'}</h2>
            <button type="button" className="sheet-close-button" onClick={onClose} aria-label="Close">
              <CloseIcon />
            </button>
          </header>

          <div className="product-modal-scroll">
            <section className="product-modal-section">
              <label className="input-field">
                <span>Category Name</span>
                <input className="text-input" type="text" value={categoryDraft.name} onChange={(event) => setCategoryDraft((current) => ({ ...current, name: event.target.value }))} />
              </label>
              <label className="input-field">
                <span>Description</span>
                <textarea className="text-area" value={categoryDraft.description} onChange={(event) => setCategoryDraft((current) => ({ ...current, description: event.target.value }))} />
              </label>
              <label className="input-field">
                <span>Category Icon</span>
                <div className="category-icon-picker" role="radiogroup" aria-label="Category icon">
                  {categoryIconOptions.map((option) => (
                    <button
                      key={option.value}
                      type="button"
                      className={`category-icon-choice ${categoryDraft.icon === option.value ? 'is-selected' : ''}`}
                      role="radio"
                      aria-checked={categoryDraft.icon === option.value}
                      aria-label={option.label}
                      title={option.label}
                      onClick={() => setCategoryDraft((current) => ({ ...current, icon: option.value }))}
                    >
                      <CategoryIconBadge icon={option.value} />
                    </button>
                  ))}
                </div>
              </label>
            </section>
          </div>

          <div className="sheet-footer product-sheet-footer">
            <button type="button" className="save-changes-button" onClick={() => onSaveCategory(categoryDraft)}>
              Save
            </button>
            {categoryDraft.id ? (
              <button type="button" className="text-danger-button" onClick={() => onDeleteCategory(categoryDraft.id as string)}>
                Delete Category
              </button>
            ) : null}
          </div>
        </section>
      </div>
    )
  }

  return null
}

type RecipeEditorModalV2Props = {
  draft: RecipeDraft
  error: string
  ingredientCatalog: IngredientCatalogOption[]
  categoryOptions: string[]
  onClose: () => void
  onChange: (update: (current: RecipeDraft) => RecipeDraft) => void
  onSave: () => void
  onAddIngredient: () => void
  onRemoveIngredient: (lineId: string) => void
}

function RecipeEditorModalV2({
  draft,
  error,
  ingredientCatalog,
  categoryOptions,
  onClose,
  onChange,
  onSave,
  onAddIngredient,
  onRemoveIngredient,
}: RecipeEditorModalV2Props) {
  const resolvedCategories = uniqueNonEmptyValues(categoryOptions.length > 0 ? categoryOptions : [draft.menuCategory || 'Meals'])
  const isLinkedMenuItem = draft.recipeType === 'MENU_ITEM' && Boolean(draft.linkedMenuItemId)

  return (
    <div className="modal-overlay" role="presentation">
      <div className="sheet-backdrop" onClick={onClose} />
      <section className="bottom-sheet product-edit-sheet" role="dialog" aria-modal="true" aria-label="Recipe editor">
        <div className="sheet-handle" />
        <header className="product-modal-header">
          <h2>{isLinkedMenuItem ? 'Create Recipe' : draft.recipeType === 'PREP' ? 'Add Prep Product' : 'Recipe Editor'}</h2>
          <button type="button" className="sheet-close-button" onClick={onClose} aria-label="Close">
            <CloseIcon />
          </button>
        </header>

        <div className="product-modal-scroll">
          <section className="product-modal-section">
            <h3>{isLinkedMenuItem ? 'Menu Item Details' : draft.recipeType === 'PREP' ? 'Prep Product Details' : 'Recipe Details'}</h3>
            <div className="cash-form-stack">
              <label className="input-field">
                <span>{isLinkedMenuItem ? 'Linked Menu Item' : 'Name'}</span>
                <input className="text-input" value={draft.recipeName} readOnly={isLinkedMenuItem} onChange={(event) => onChange((current) => ({ ...current, recipeName: event.target.value }))} />
              </label>
              <label className="input-field">
                <span>Category</span>
                {isLinkedMenuItem ? (
                  <input className="text-input" value={draft.menuCategory} readOnly />
                ) : (
                  <select className="cash-select" value={draft.menuCategory} onChange={(event) => onChange((current) => ({ ...current, menuCategory: event.target.value }))}>
                    {resolvedCategories.map((category) => (
                      <option key={category} value={category}>
                        {category}
                      </option>
                    ))}
                  </select>
                )}
              </label>
              <div className="field-grid">
                <label className="input-field">
                  <span>{draft.recipeType === 'PREP' ? 'Yield Quantity' : 'Servings'}</span>
                  <input
                    className="text-input"
                    inputMode="decimal"
                    value={draft.recipeType === 'PREP' ? draft.yieldQuantity : draft.servings}
                    onChange={(event) =>
                      onChange((current) =>
                        current.recipeType === 'PREP'
                          ? { ...current, yieldQuantity: sanitizeDecimalInput(event.target.value) }
                          : { ...current, servings: sanitizeDecimalInput(event.target.value) },
                      )
                    }
                  />
                </label>
                <label className="input-field">
                  <span>{draft.recipeType === 'PREP' ? 'Yield Unit' : 'Default Price'}</span>
                  {draft.recipeType === 'PREP' ? (
                    <input className="text-input" value={draft.yieldUnit} onChange={(event) => onChange((current) => ({ ...current, yieldUnit: event.target.value }))} />
                  ) : (
                    <div className="currency-input">
                      <em>PHP</em>
                      <input type="number" min="0" value={draft.pricePerServing} readOnly={isLinkedMenuItem} onChange={(event) => onChange((current) => ({ ...current, pricePerServing: sanitizeDecimalInput(event.target.value) }))} />
                    </div>
                  )}
                </label>
                {draft.recipeType === 'MENU_ITEM' ? (
                  <label className="input-field">
                    <span>Half Order Price</span>
                    <div className="currency-input">
                      <em>PHP</em>
                      <input type="number" min="0" value={draft.halfOrderPrice} readOnly />
                    </div>
                  </label>
                ) : null}
                {draft.recipeType === 'MENU_ITEM' ? (
                  <label className="input-field">
                    <span>Tax Rate (%)</span>
                    <input className="text-input" inputMode="decimal" value={draft.taxRatePercent} onChange={(event) => onChange((current) => ({ ...current, taxRatePercent: sanitizeDecimalInput(event.target.value) }))} />
                  </label>
                ) : null}
              </div>
              {isLinkedMenuItem ? <p className="field-helper">Sellable products are created in Menu Settings. This screen only manages recipe and costing for the selected menu item.</p> : null}
              {draft.recipeType === 'PREP' ? <p className="field-helper">Prep products are internal batches used by recipes. They are not created as sellable menu products here.</p> : null}
            </div>
          </section>

          <section className="product-modal-section">
            <div className="section-head">
              <h3>Profit Snapshot</h3>
            </div>
            <article className="surface-card cash-log-detail-card">
              <div className="finance-row"><span>Total Recipe Cost</span><strong>{formatPhp(draft.summary.totalRecipeCost)}</strong></div>
              <div className="finance-row"><span>Cost Per Serving</span><strong>{formatPhp(draft.summary.costPerServing)}</strong></div>
              <div className="finance-row"><span>Recipe Revenue</span><strong>{formatPhp(draft.summary.revenue)}</strong></div>
              <div className="finance-row"><span>Tax</span><strong>{formatPhp(draft.summary.taxAmount)}</strong></div>
              <div className="finance-row"><span>Net Sales</span><strong>{formatPhp(draft.summary.netSales)}</strong></div>
              <div className="finance-row"><span>Gross Profit</span><strong>{formatPhp(draft.summary.grossProfit)}</strong></div>
              <div className="finance-row"><span>Net Profit</span><strong>{formatPhp(draft.summary.netProfit)}</strong></div>
              <div className="finance-row total-row"><span>Gross Margin</span><strong>{draft.summary.grossMargin.toFixed(1)}%</strong></div>
              {draft.summary.hasConversionIssue ? <p className="field-error">One or more ingredient units do not match, so cost is only partially counted.</p> : null}
            </article>
          </section>

          <section className="product-modal-section">
            <div className="section-head">
              <h3>{draft.recipeType === 'PREP' ? 'Ingredients' : 'Ingredients From Daily Log'}</h3>
              <button type="button" className="ghost-pill" onClick={onAddIngredient} disabled={ingredientCatalog.length === 0}>
                Add Ingredient
              </button>
            </div>
            {ingredientCatalog.length === 0 ? (
              <div className="sync-empty-state">
                <strong>No Daily Log ingredients found.</strong>
                <p>Ingredients become available here after they are added through the Daily Log flow.</p>
              </div>
            ) : (
              <div className="cash-form-stack">
                {draft.ingredients.map((line) => (
                  <article key={line.id} className="surface-card cash-log-detail-card">
                    <label className="input-field">
                      <span>Select Ingredient / Prep Item</span>
                      <select
                        className="cash-select"
                        value={line.ingredientRefId}
                        onChange={(event) =>
                          onChange((current) => {
                            const selected = ingredientCatalog.find((item) => item.id === event.target.value)
                            return {
                              ...current,
                              ingredients: current.ingredients.map((item) =>
                                item.id === line.id
                                  ? {
                                      ...item,
                                      ingredientRefId: selected?.id ?? '',
                                      ingredientRefType: selected?.sourceType ?? 'ingredient',
                                      ingredientName: selected?.name ?? '',
                                      purchaseQuantity: String(selected?.purchaseQuantity ?? 1),
                                      purchaseUnit: selected?.unit ?? item.purchaseUnit,
                                      recipeUnit: selected?.unit ?? item.recipeUnit,
                                    }
                                  : item,
                              ),
                            }
                          })
                        }
                      >
                        <option value="">Select ingredient</option>
                        {ingredientCatalog.map((item) => (
                          <option key={item.id} value={item.id}>
                            {item.sourceType === 'recipe' ? `${item.name} (Prep Product)` : `${item.name} (${item.unit})`}
                          </option>
                        ))}
                      </select>
                    </label>
                    <div className="field-grid">
                      <label className="input-field">
                        <span>Purchase Qty</span>
                        <input className="text-input" inputMode="decimal" value={line.purchaseQuantity} onChange={(event) => onChange((current) => ({ ...current, ingredients: current.ingredients.map((item) => (item.id === line.id ? { ...item, purchaseQuantity: sanitizeDecimalInput(event.target.value) } : item)) }))} />
                      </label>
                      <label className="input-field">
                        <span>Unit</span>
                        <input className="text-input" value={line.purchaseUnit} onChange={(event) => onChange((current) => ({ ...current, ingredients: current.ingredients.map((item) => (item.id === line.id ? { ...item, purchaseUnit: event.target.value } : item)) }))} />
                      </label>
                      <label className="input-field">
                        <span>Quantity Used</span>
                        <input className="text-input" inputMode="decimal" value={line.recipeQuantity} onChange={(event) => onChange((current) => ({ ...current, ingredients: current.ingredients.map((item) => (item.id === line.id ? { ...item, recipeQuantity: sanitizeDecimalInput(event.target.value) } : item)) }))} />
                      </label>
                      <label className="input-field">
                        <span>Recipe Unit</span>
                        <input className="text-input" value={line.recipeUnit} onChange={(event) => onChange((current) => ({ ...current, ingredients: current.ingredients.map((item) => (item.id === line.id ? { ...item, recipeUnit: event.target.value } : item)) }))} />
                      </label>
                    </div>
                    <div className="finance-row">
                      <span>Estimated Cost</span>
                      <strong>{(() => {
                        const lineCost = computeRecipeLineCost(line, ingredientCatalog)
                        return lineCost === null ? 'Unit mismatch' : formatPhp(lineCost)
                      })()}</strong>
                    </div>
                    <div className="sheet-footer">
                      <button type="button" className="secondary-button" onClick={() => onRemoveIngredient(line.id)}>
                        Remove Line
                      </button>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </section>

          {error ? <p className="field-error cash-form-error">{error}</p> : null}
        </div>

        <div className="sheet-footer">
          <button type="button" className="finance-primary-button" onClick={onSave}>
            {draft.recipeType === 'PREP' ? 'Save Prep Product' : 'Save Recipe'}
          </button>
        </div>
      </section>
    </div>
  )
}

void RecipesScreen
void RecipeEditorModal
void MenuSettingsScreen
void ProductEditModal

type ResetOptionsModalProps = {
  value: string
  onChange: (value: string) => void
  onClose: () => void
  workingAction: ResetActionId | null
  statusMessage: string
  errorMessage: string
  onTestingReset: () => void
  onEmptyEverything: () => void
  onSafeState: () => void
  onClearOrders: () => void
  onClearMenu: () => void
  onClearRecipes: () => void
  onClearDailyLogs: () => void
  onClearInventory: () => void
}

function ResetOptionsModal({
  value,
  onChange,
  onClose,
  workingAction,
  statusMessage,
  errorMessage,
  onTestingReset,
  onEmptyEverything,
  onSafeState,
  onClearOrders,
  onClearMenu,
  onClearRecipes,
  onClearDailyLogs,
  onClearInventory,
}: ResetOptionsModalProps) {
  const resetConfirmed = value.trim().toUpperCase() === 'RESET'

  function renderResetAction(
    actionId: ResetActionId,
    title: string,
    description: string,
    buttonLabel: string,
    onClick: () => void,
    requiresConfirmation = false,
  ) {
    const disabled = workingAction !== null || (requiresConfirmation && !resetConfirmed)
    return (
      <article className="surface-card reset-action-card">
        <div className="reset-action-copy">
          <strong>{title}</strong>
          <p>{description}</p>
        </div>
        <button
          type="button"
          className={requiresConfirmation ? 'danger-button compact-submit' : 'secondary-button compact-submit'}
          disabled={disabled}
          onClick={onClick}
        >
          {workingAction === actionId ? 'Working...' : buttonLabel}
        </button>
      </article>
    )
  }

  return (
    <div className="modal-overlay" role="presentation">
      <div className="sheet-backdrop" onClick={onClose} />
      <section className="dialog-card reset-dialog-card" role="dialog" aria-modal="true" aria-label="Reset system data">
        <header className="dialog-header">
          <h2>Reset Data</h2>
          <p>Use the Android-style reset actions below. Type RESET once to unlock destructive options.</p>
        </header>

        <label className="dialog-field">
          <span>Type RESET to confirm destructive actions</span>
          <div className="purchase-input-group dialog-input-group reset-input-group">
            <input type="text" value={value} onChange={(event) => onChange(event.target.value)} />
          </div>
        </label>

        <div className="reset-action-list">
          {renderResetAction('testing-reset', 'Testing Reset', 'Clear the current workspace, then repopulate troubleshooting sample data.', 'Testing Reset', onTestingReset, true)}
          {renderResetAction('empty-everything', 'Empty Everything', 'Clear orders, menu, recipes, logs, finance rows, and current synced workspace data.', 'Empty Everything', onEmptyEverything, true)}
          {renderResetAction('safe-state', 'Safe State', 'Clear operational history while keeping the current menu catalog in place.', 'Safe State', onSafeState, true)}
          {renderResetAction('clear-orders', 'Queue / Orders', 'Clear orders, void records, and derived accounting totals.', 'Clear Orders', onClearOrders)}
          {renderResetAction('clear-menu', 'Menu', 'Clear categories and menu products.', 'Clear Menu', onClearMenu, true)}
          {renderResetAction('clear-recipes', 'Recipes', 'Clear recipes and recipe ingredient links.', 'Clear Recipes', onClearRecipes)}
          {renderResetAction('clear-daily-logs', 'Daily Logs', 'Clear ingredient price logs and saved accounting logs.', 'Clear Logs', onClearDailyLogs)}
          {renderResetAction('clear-inventory', 'Inventory', 'Zero active sellable stock in Supabase and clear local count overrides.', 'Clear Inventory', onClearInventory)}
        </div>

        {statusMessage ? <p className="reset-status-message">{statusMessage}</p> : null}
        {errorMessage ? <p className="field-error reset-status-message">{errorMessage}</p> : null}

        <div className="dialog-actions">
          <button type="button" className="secondary-button" onClick={onClose}>
            Close
          </button>
        </div>
      </section>
    </div>
  )
}

type InventoryOverviewScreenProps = {
  period: Period
  onPeriodChange: (period: Period) => void
  ingredients: Ingredient[]
  summary: { lowStock: number; needFix: number; overdue: number }
  pendingPurchaseAlerts: number
  isSynced: boolean
  flashMessage: string
  onOpenPurchaseLog: () => void
  onOpenConfiguration: () => void
  onOpenFixCount: (ingredientId: string) => void
}

function InventoryOverviewScreen({
  period,
  onPeriodChange,
  ingredients,
  summary,
  pendingPurchaseAlerts,
  isSynced,
  flashMessage,
  onOpenPurchaseLog,
  onOpenConfiguration,
  onOpenFixCount,
}: InventoryOverviewScreenProps) {
  return (
    <div className="inventory-panel">
      <header className="inventory-topbar">
        <button type="button" className="icon-button" onClick={onOpenPurchaseLog} aria-label="Open purchase log">
          <CartIcon />
          {pendingPurchaseAlerts > 0 ? <span className="icon-badge">{pendingPurchaseAlerts}</span> : null}
        </button>

        <div className={`sync-badge ${isSynced ? 'is-synced' : 'is-pending'}`}>
          <span className="sync-dot" />
          {isSynced ? 'Synced' : 'Pending Sync'}
        </div>

        <button type="button" className="icon-button" onClick={onOpenConfiguration} aria-label="Open inventory settings">
          <GearIcon />
        </button>
      </header>

      <div className="inventory-periods" role="tablist" aria-label="Inventory periods">
        {periods.map((option) => (
          <button
            key={option}
            type="button"
            className={`period-pill inventory-pill ${period === option ? 'is-active' : ''}`}
            onClick={() => onPeriodChange(option)}
          >
            {option}
          </button>
        ))}
      </div>

      <section className="inventory-summary">
        <div className="section-head section-head-column">
          <h1>Dashboard Overview</h1>
          <p>{flashMessage}</p>
        </div>

        <div className="summary-grid">
          <SummaryCounter label="Low Stock" value={summary.lowStock} helper="Action Required" tone="warning" />
          <SummaryCounter label="Need Fix" value={summary.needFix} helper="Count Discrepancies" tone="danger" />
          <SummaryCounter label="Overdue" value={summary.overdue} helper="Not Counted Recently" tone="muted" />
        </div>
      </section>

      <section className="live-ingredients-section">
        <div className="section-head section-head-tight">
          <h2>Live Ingredients</h2>
        </div>

        <div className="ingredient-card-list">
          {ingredients.map((ingredient) => (
            <article key={ingredient.id} className={`surface-card ingredient-card status-${ingredient.status}`}>
              <div className="ingredient-status-edge" />
              <div className="ingredient-card-body">
                <div className="ingredient-card-top">
                  <div>
                    <p className="ingredient-name">{ingredient.name}</p>
                    <p className="ingredient-status-text">{statusLabel(ingredient.status)}</p>
                  </div>
                  <button type="button" className="ghost-pill fix-count-button" onClick={() => onOpenFixCount(ingredient.id)}>
                    Fix Count
                  </button>
                </div>

                <p className="ingredient-primary-metric">
                  Est. On-Hand: <strong>{formatQuantity(ingredient.estimatedOnHand, ingredient.unit)}</strong>
                </p>

                <div className="ingredient-secondary-metrics">
                  <span>Used {period}: {formatQuantity(ingredient.usedByPeriod[period], ingredient.unit)}</span>
                  <span>Reorder Level: {formatQuantity(ingredient.reorderLevel, ingredient.unit)}</span>
                </div>
              </div>
            </article>
          ))}
        </div>
      </section>
    </div>
  )
}

type InventoryConfigurationScreenProps = {
  categories: string[]
  activeCategory: string
  onCategoryChange: (category: string) => void
  ingredients: Ingredient[]
  onBack: () => void
  onCountingToggle: (ingredientId: string) => void
  onFrequencyChange: (ingredientId: string, frequency: Frequency) => void
}

function InventoryConfigurationScreen({
  categories,
  activeCategory,
  onCategoryChange,
  ingredients,
  onBack,
  onCountingToggle,
  onFrequencyChange,
}: InventoryConfigurationScreenProps) {
  return (
    <div className="inventory-panel">
      <header className="configuration-header">
        <button type="button" className="back-button" onClick={onBack}>
          <span aria-hidden="true">&lt;</span>
          Back
        </button>
        <h1>Inventory Configuration</h1>
      </header>

      <div className="category-chip-row" role="tablist" aria-label="Inventory categories">
        {categories.map((category) => (
          <button
            key={category}
            type="button"
            className={`category-chip ${activeCategory === category ? 'is-active' : ''}`}
            onClick={() => onCategoryChange(category)}
          >
            {category}
          </button>
        ))}
      </div>

      <section className="surface-card configuration-card">
        <div className="configuration-table-head">
          <span>{activeCategory === 'All' ? 'Ingredients' : activeCategory}</span>
          <span>Counting On</span>
        </div>

        <div className="configuration-list">
          {ingredients.map((ingredient) => (
            <div key={ingredient.id} className="configuration-row">
              <div className="configuration-copy">
                <strong>{ingredient.name}</strong>
                <small>{ingredient.category}</small>
              </div>

              <div className="configuration-controls">
                <label className="switch">
                  <input
                    type="checkbox"
                    checked={ingredient.countingEnabled}
                    onChange={() => onCountingToggle(ingredient.id)}
                  />
                  <span className="switch-track" />
                </label>

                <select
                  className="frequency-select"
                  value={ingredient.countingFrequency}
                  disabled={!ingredient.countingEnabled}
                  onChange={(event) => onFrequencyChange(ingredient.id, event.target.value as Frequency)}
                >
                  {periods.map((frequency) => (
                    <option key={frequency} value={frequency}>
                      {frequency}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  )
}

type LogPurchasedIngredientsModalProps = {
  currentDateLabel: string
  purchaseLogId: string
  ingredients: Ingredient[]
  purchaseDrafts: PurchaseDrafts
  purchaseErrors: PurchaseErrors
  onClose: () => void
  onDraftChange: (ingredientId: string, value: string) => void
  onSubmit: () => void
}

function LogPurchasedIngredientsModal({
  currentDateLabel,
  purchaseLogId,
  ingredients,
  purchaseDrafts,
  purchaseErrors,
  onClose,
  onDraftChange,
  onSubmit,
}: LogPurchasedIngredientsModalProps) {
  return (
    <div className="modal-overlay" role="presentation">
      <div className="sheet-backdrop" onClick={onClose} />
      <section className="bottom-sheet" role="dialog" aria-modal="true" aria-label="Log purchased ingredients">
        <div className="sheet-handle" />
        <header className="sheet-header">
          <h2>Log Purchased Ingredients</h2>
          <p>Current Date: {currentDateLabel}</p>
          <small>Daily Log ID: {purchaseLogId}</small>
        </header>

        <div className="purchase-list">
          {ingredients.map((ingredient) => (
            <div key={ingredient.id} className="purchase-row">
              <div className="purchase-copy">
                <strong>{ingredient.name}</strong>
                <small>{ingredient.category}</small>
              </div>

              <div className="purchase-input-group">
                <input
                  type="text"
                  inputMode="decimal"
                  value={purchaseDrafts[ingredient.id] ?? ''}
                  onChange={(event) => onDraftChange(ingredient.id, event.target.value)}
                  aria-label={`Purchased quantity for ${ingredient.name}`}
                />
                <span>{ingredient.unit}</span>
              </div>

              {purchaseErrors[ingredient.id] ? <p className="field-error">{purchaseErrors[ingredient.id]}</p> : null}
            </div>
          ))}
        </div>

        <div className="sheet-footer">
          <button type="button" className="submit-button" onClick={onSubmit}>
            Log Purchases
          </button>
        </div>
      </section>
    </div>
  )
}

type FixCountModalProps = {
  ingredient: Ingredient
  value: string
  error: string
  onClose: () => void
  onChange: (value: string) => void
  onSave: () => void
}

function FixCountModal({ ingredient, value, error, onClose, onChange, onSave }: FixCountModalProps) {
  return (
    <div className="modal-overlay" role="presentation">
      <div className="sheet-backdrop" onClick={onClose} />
      <section className="dialog-card" role="dialog" aria-modal="true" aria-label="Fix count">
        <header className="dialog-header">
          <h2>Fix Count</h2>
          <p>{ingredient.name}</p>
        </header>

        <label className="dialog-field">
          <span>Corrected quantity</span>
          <div className="purchase-input-group dialog-input-group">
            <input
              type="text"
              inputMode="decimal"
              value={value}
              onChange={(event) => {
                const nextValue = event.target.value
                if (nextValue === '' || /^\d*\.?\d*$/.test(nextValue)) {
                  onChange(nextValue)
                }
              }}
            />
            <span>{ingredient.unit}</span>
          </div>
        </label>

        {error ? <p className="field-error">{error}</p> : null}

        <div className="dialog-actions">
          <button type="button" className="secondary-button" onClick={onClose}>
            Cancel
          </button>
          <button type="button" className="submit-button compact-submit" onClick={onSave}>
            Save Count
          </button>
        </div>
      </section>
    </div>
  )
}

type SummaryCounterProps = {
  label: string
  value: number
  helper: string
  tone: 'warning' | 'danger' | 'muted'
}

function SummaryCounter({ label, value, helper, tone }: SummaryCounterProps) {
  return (
    <article className="surface-card summary-card">
      <p>{label}</p>
      <strong className={`summary-value tone-${tone}`}>{value}</strong>
      <small>{helper}</small>
    </article>
  )
}

type LogsScreenProps = {
  records: LogRecord[]
  onCreateNew: () => void
  onOpenRecord: (recordId: string) => void
}

function LogsScreen({ records, onCreateNew, onOpenRecord }: LogsScreenProps) {
  return (
    <div className="record-screen">
      <header className="record-header record-header-leading">
        <h1>Logs</h1>
        <div className="record-header-actions">
          <span className="saved-pill">{records.length} saved</span>
          <button type="button" className="record-icon-button" aria-label="Create daily log" onClick={onCreateNew}>
            <PlusIcon />
          </button>
        </div>
      </header>

      <div className="shared-card-list">
        {records.length > 0 ? (
          records.map((record) => (
            <button key={record.id} type="button" className="record-card-button" onClick={() => onOpenRecord(record.id)}>
              <UnifiedRecordCard
                media={<ClipboardIcon />}
                title={record.title}
                subtitle={record.detail}
                status={record.status}
                sideTop={record.relativeDate}
                sideBottom={record.fullDate}
              />
            </button>
          ))
        ) : (
          <div className="sync-empty-state">
            <strong>No daily logs yet.</strong>
            <p>Tap + to create a new daily log by copying the latest ingredient price structure.</p>
          </div>
        )}
      </div>
    </div>
  )
}

type UnifiedRecordCardProps = {
  media: ReactNode
  title: string
  subtitle: string
  sideTop: string
  sideBottom: string
  sideMiddle?: string
  status?: SyncStatus
  emphasizeSideTop?: boolean
}

function UnifiedRecordCard({
  media,
  title,
  subtitle,
  sideTop,
  sideBottom,
  sideMiddle,
  status,
  emphasizeSideTop = false,
}: UnifiedRecordCardProps) {
  return (
    <article className="surface-card shared-record-card">
      <div className="shared-record-media">
        <span className="shared-record-media-shell">{media}</span>
      </div>
      <div className="shared-record-copy">
        <div className="shared-record-head">
          <strong>{title}</strong>
          {status ? <span className={`system-badge is-${status}`}>{syncStatusLabel(status)}</span> : null}
        </div>
        <small>{subtitle}</small>
      </div>
      <div className="shared-record-side">
        <strong className={emphasizeSideTop ? 'is-emphasis' : ''}>{sideTop}</strong>
        {sideMiddle ? <span>{sideMiddle}</span> : null}
        <small>{sideBottom}</small>
      </div>
    </article>
  )
}

type BottomNavigationProps = {
  activeTab: AppTab
  appMode: AppMode
  syncBusy: boolean
  onTabChange: (tab: AppTab) => void
  onSync: () => void
}

function BottomNavigation({ activeTab, appMode, syncBusy, onTabChange, onSync }: BottomNavigationProps) {
  return (
    <nav className="bottom-nav" aria-label="Primary">
      <button type="button" className={`bottom-nav-item ${activeTab === 'dashboard' ? 'is-active' : ''}`} onClick={() => onTabChange('dashboard')}>
        <GridIcon />
        <span>Dashboard</span>
      </button>
      {appMode === 'full-admin' ? (
        <button type="button" className={`bottom-nav-item ${activeTab === 'inventory' ? 'is-active' : ''}`} onClick={() => onTabChange('inventory')}>
          <InventoryIcon />
          <span>Inventory</span>
        </button>
      ) : null}
      <button
        type="button"
        className="bottom-nav-sync"
        onClick={onSync}
        aria-label="Refresh live admin data"
        disabled={syncBusy}
      >
        <SyncIcon />
      </button>
      {appMode === 'full-admin' ? (
        <button type="button" className={`bottom-nav-item ${activeTab === 'daily-log' ? 'is-active' : ''}`} onClick={() => onTabChange('daily-log')}>
          <ClipboardIcon />
          <span>Daily Log</span>
        </button>
      ) : null}
      <button type="button" className={`bottom-nav-item ${activeTab === 'more' ? 'is-active' : ''}`} onClick={() => onTabChange('more')}>
        <MenuIcon />
        <span>More</span>
      </button>
    </nav>
  )
}

function formatQuantity(value: number, unit: string) {
  const normalized = Number.isInteger(value) ? String(value) : value.toFixed(1)
  return `${normalized} ${unit}`
}

function formatShortOrderNumber(value: string) {
  const cleaned = value.trim()
  return cleaned.length <= 8 ? cleaned : cleaned.slice(-8)
}

function resolveCashOrderAmount(order: OrderRecord) {
  const gcashAmount = resolveGcashOrderAmount(order)
  if (gcashAmount > 0 && order.total >= gcashAmount) {
    return Math.max(order.total - gcashAmount, 0)
  }
  if (typeof order.cashAmount === 'number') {
    return order.cashAmount
  }
  return order.paymentMethod.toLowerCase().includes('cash') ? order.total : 0
}

function resolveGcashOrderAmount(order: OrderRecord) {
  return Math.max(order.gcashAmount ?? 0, 0)
}

function resolveOrderSalesAmount(order: OrderRecord) {
  const cashAmount = resolveCashOrderAmount(order)
  const gcashAmount = resolveGcashOrderAmount(order)
  return Math.max(order.total, cashAmount + gcashAmount)
}

function isoDateKey(value: string | undefined) {
  if (!value) {
    return ''
  }
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    return ''
  }
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Manila',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date)
}

function normalizeDateRange(range: DateRangeValue) {
  const start = range.start && range.end && range.start > range.end ? range.end : range.start
  const end = range.start && range.end && range.start > range.end ? range.start : range.end
  return { start, end }
}

function isIsoInDateRange(value: string | undefined, range: DateRangeValue) {
  const key = isoDateKey(value)
  if (!key) {
    return false
  }
  const normalized = normalizeDateRange(range)
  return (!normalized.start || key >= normalized.start) && (!normalized.end || key <= normalized.end)
}

function formatDateRangeLabel(range: DateRangeValue) {
  const normalized = normalizeDateRange(range)
  if (!normalized.start && !normalized.end) {
    return 'All dates'
  }
  if (normalized.start && normalized.end && normalized.start === normalized.end) {
    return formatDueDate(normalized.start)
  }
  if (!normalized.start) {
    return `Until ${formatDueDate(normalized.end)}`
  }
  if (!normalized.end) {
    return `From ${formatDueDate(normalized.start)}`
  }
  return `${formatDueDate(normalized.start)} - ${formatDueDate(normalized.end)}`
}

function formatPhp(value: number) {
  return new Intl.NumberFormat('en-PH', {
    style: 'currency',
    currency: 'PHP',
    minimumFractionDigits: 2,
  }).format(value)
}

function formatSignedPhp(value: number) {
  return `${value < 0 ? '-' : ''}${formatPhp(Math.abs(value))}`
}

function formatDueDate(value: string) {
  return new Intl.DateTimeFormat('en-PH', {
    month: 'short',
    day: 'numeric',
  }).format(new Date(`${value}T00:00:00+08:00`))
}

function formatFullDateTime(value: string) {
  const date = new Date(value)
  if (!value || Number.isNaN(date.getTime())) {
    return 'No activity yet'
  }
  return new Intl.DateTimeFormat('en-PH', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(date)
}

function formatActivityTime(value: string) {
  const formatted = formatFullDateTime(value)
  return formatted === 'No activity yet' ? formatted : `Last activity ${formatted}`
}

function cashMovementLabel(type: CashMovementType) {
  switch (type) {
    case 'transfer':
      return 'Transfer'
    case 'adjustment':
      return 'Adjustment'
    default:
      return 'Cash Pull'
  }
}

function findAccountName(accounts: CashAccount[], accountId: string | null) {
  if (!accountId) {
    return '--'
  }
  return accounts.find((account) => account.id === accountId)?.name ?? '--'
}

function formatCashMovementAccounts(movement: CashMovement, accounts: CashAccount[]) {
  if (movement.type === 'adjustment') {
    const accountName = findAccountName(accounts, movement.adjustmentDirection === 'add' ? movement.toAccountId : movement.fromAccountId)
    return `${movement.adjustmentDirection === 'add' ? 'Add to' : 'Remove from'} ${accountName}`
  }
  return `${findAccountName(accounts, movement.fromAccountId)} → ${findAccountName(accounts, movement.toAccountId)}`
}

function formatCashMovementMeta(movement: CashMovement) {
  return `${formatFullDateTime(movement.createdAt)} • ${movement.deviceSource}`
}

function cashMovementCountForAccount(movements: CashMovement[], accountId: string) {
  return movements.filter((movement) => movement.fromAccountId === accountId || movement.toAccountId === accountId).length
}

function getBillStatus(bill: BillRecord) {
  if (bill.paid) {
    return { label: 'Paid', tone: 'paid' as const }
  }

  const dueDate = new Date(`${bill.dueDate}T00:00:00+08:00`)
  const daysUntilDue = Math.ceil((dueDate.getTime() - financeBusinessDate.getTime()) / 86400000)
  if (daysUntilDue < 0) {
    return { label: 'Overdue', tone: 'overdue' as const }
  }
  if (daysUntilDue <= 3) {
    return { label: 'Due Soon', tone: 'due-soon' as const }
  }
  return { label: 'Scheduled', tone: 'scheduled' as const }
}

function statusLabel(status: IngredientStatus) {
  switch (status) {
    case 'critical':
      return 'Need Fix'
    case 'low':
      return 'Low Stock'
    default:
      return 'Healthy'
  }
}

function CartIcon() {
  return (
    <svg viewBox="0 0 24 24" className="icon-svg" aria-hidden="true">
      <path d="M4 5h2l1.3 6.2a1 1 0 0 0 1 .8h7.9a1 1 0 0 0 1-.8L19 7H7.1" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="10" cy="18" r="1.5" fill="currentColor" />
      <circle cx="17" cy="18" r="1.5" fill="currentColor" />
    </svg>
  )
}

function GearIcon() {
  return (
    <svg viewBox="0 0 24 24" className="icon-svg" aria-hidden="true">
      <path d="M12 8.4a3.6 3.6 0 1 0 0 7.2 3.6 3.6 0 0 0 0-7.2Zm8 3.6-.9-.4a7.6 7.6 0 0 0-.5-1.3l.5-.9-1.6-1.6-.9.5a7.6 7.6 0 0 0-1.3-.5L15 6h-3l-.4.9a7.6 7.6 0 0 0-1.3.5l-.9-.5-1.6 1.6.5.9a7.6 7.6 0 0 0-.5 1.3L6 12v3l.9.4a7.6 7.6 0 0 0 .5 1.3l-.5.9 1.6 1.6.9-.5a7.6 7.6 0 0 0 1.3.5l.4.9h3l.4-.9a7.6 7.6 0 0 0 1.3-.5l.9.5 1.6-1.6-.5-.9a7.6 7.6 0 0 0 .5-1.3l.9-.4v-3Z" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function GridIcon() {
  return (
    <svg viewBox="0 0 24 24" className="icon-svg" aria-hidden="true">
      <rect x="4" y="4" width="6" height="6" rx="1.2" fill="currentColor" />
      <rect x="14" y="4" width="6" height="6" rx="1.2" fill="currentColor" />
      <rect x="4" y="14" width="6" height="6" rx="1.2" fill="currentColor" />
      <rect x="14" y="14" width="6" height="6" rx="1.2" fill="currentColor" />
    </svg>
  )
}

function SyncIcon() {
  return (
    <svg viewBox="0 0 24 24" className="icon-svg sync-nav-icon" aria-hidden="true">
      <path d="M7 8a6 6 0 0 1 10-1m0 0V3m0 4h-4M17 16a6 6 0 0 1-10 1m0 0v4m0-4h4" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function ClipboardIcon() {
  return (
    <svg viewBox="0 0 24 24" className="icon-svg" aria-hidden="true">
      <path d="M9 4h6l1 2h2v14H6V6h2l1-2Z" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
      <path d="M9 11h6M9 15h4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  )
}

function InventoryIcon() {
  return (
    <svg viewBox="0 0 24 24" className="icon-svg" aria-hidden="true">
      <path d="M6 5h12v4H6zM6 11h12v8H6z" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
      <path d="M10 8h4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  )
}

function MenuIcon() {
  return (
    <svg viewBox="0 0 24 24" className="icon-svg" aria-hidden="true">
      <path d="M5 7h14M5 12h14M5 17h14" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  )
}

function menuStatusLabel(status: MenuItemStatus) {
  switch (status) {
    case 'available':
      return 'Available'
    case 'unavailable':
      return 'Unavailable'
    default:
      return 'Hidden'
  }
}

function syncStatusLabel(status: SyncStatus) {
  switch (status) {
    case 'completed':
      return 'Completed'
    case 'voided':
      return 'Voided'
    default:
      return 'Synced'
  }
}

function SearchIcon() {
  return (
    <svg viewBox="0 0 24 24" className="icon-svg" aria-hidden="true">
      <circle cx="11" cy="11" r="6" fill="none" stroke="currentColor" strokeWidth="1.8" />
      <path d="M16 16l4 4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  )
}

function PlusIcon() {
  return (
    <svg viewBox="0 0 24 24" className="icon-svg" aria-hidden="true">
      <path d="M12 5v14M5 12h14" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  )
}

function CalendarIcon() {
  return (
    <svg viewBox="0 0 24 24" className="icon-svg" aria-hidden="true">
      <path d="M6 5h12a2 2 0 0 1 2 2v11a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2Z" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" />
      <path d="M8 3v4M16 3v4M4 10h16" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
    </svg>
  )
}

function PencilIcon() {
  return (
    <svg viewBox="0 0 24 24" className="icon-svg" aria-hidden="true">
      <path d="M4 20l4.2-1 9.5-9.5-3.2-3.2L5 15.8 4 20Z" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" />
      <path d="M13.8 5.8 17 9" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
    </svg>
  )
}

function TrashIcon() {
  return (
    <svg viewBox="0 0 24 24" className="icon-svg" aria-hidden="true">
      <path d="M5 7h14M9 7V5h6v2m-8 0 1 12h8l1-12" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function CloseIcon() {
  return (
    <svg viewBox="0 0 24 24" className="icon-svg" aria-hidden="true">
      <path d="M6 6l12 12M18 6 6 18" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  )
}

function DragHandleIcon() {
  return (
    <svg viewBox="0 0 24 24" className="icon-svg" aria-hidden="true">
      <path d="M8 6h8M8 12h8M8 18h8" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  )
}

function ModeSwitchIcon() {
  return (
    <svg viewBox="0 0 24 24" className="icon-svg" aria-hidden="true">
      <path d="M7 8h10M7 16h10M15 5l3 3-3 3M9 13l-3 3 3 3" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function SyncLogsIcon() {
  return (
    <svg viewBox="0 0 24 24" className="icon-svg" aria-hidden="true">
      <path d="M7 8a6 6 0 0 1 10-1m0 0V3m0 4h-4M17 16a6 6 0 0 1-10 1m0 0v4m0-4h4" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function OrderHistoryIcon() {
  return (
    <svg viewBox="0 0 24 24" className="icon-svg" aria-hidden="true">
      <path d="M6 5h12v14H6z" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" />
      <path d="M9 9h6M9 13h6M9 17h4" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
    </svg>
  )
}

function ProductSettingsIcon() {
  return (
    <svg viewBox="0 0 24 24" className="icon-svg" aria-hidden="true">
      <path d="M7 4h10l3 4v10a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V8l3-4Z" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" />
      <path d="M8 9h8M10 13h4" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
    </svg>
  )
}

function RecipeBookIcon() {
  return (
    <svg viewBox="0 0 24 24" className="icon-svg" aria-hidden="true">
      <path d="M6 4h10a2 2 0 0 1 2 2v14H8a2 2 0 0 0-2 2V4Z" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" />
      <path d="M9 8h5M9 12h5" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
    </svg>
  )
}

function FinanceOverviewIcon() {
  return (
    <svg viewBox="0 0 24 24" className="icon-svg" aria-hidden="true">
      <path d="M5 18 10 13l3 3 6-7" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M5 6v12h14" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function CashDrawerIcon() {
  return (
    <svg viewBox="0 0 24 24" className="icon-svg" aria-hidden="true">
      <path d="M4 9h16v8H4zM7 9V6h10v3" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" />
      <circle cx="12" cy="13" r="1.4" fill="currentColor" />
    </svg>
  )
}

function BillsIcon() {
  return (
    <svg viewBox="0 0 24 24" className="icon-svg" aria-hidden="true">
      <path d="M7 4h10v16l-2-1.4L13 20l-2-1.4L9 20l-2-1.4L5 20V6a2 2 0 0 1 2-2Z" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" />
      <path d="M9 9h6M9 13h6" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
    </svg>
  )
}

function ProfitInsightsIcon() {
  return (
    <svg viewBox="0 0 24 24" className="icon-svg" aria-hidden="true">
      <path d="M6 18 18 6M10 6h8v8" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function ResetIcon() {
  return (
    <svg viewBox="0 0 24 24" className="icon-svg" aria-hidden="true">
      <path d="M12 4a8 8 0 1 1-7.2 4.5M4 4v5h5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}
export default App

