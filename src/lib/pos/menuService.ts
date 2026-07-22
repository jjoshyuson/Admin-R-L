import { getStorageBucket, hasSupabaseConfig, requireSupabase } from '../supabase/client'
import type { PosMenuCategory, PosMenuProduct, ProductStatus } from './posTypes'

export async function fetchPosMenu(): Promise<{ categories: PosMenuCategory[]; products: PosMenuProduct[] }> {
  if (!hasSupabaseConfig) {
    return getPreviewPosMenu()
  }

  const supabase = requireSupabase()
  const [categoryResult, productResult] = await Promise.all([
    supabase
      .from('categories')
      .select('id,name,sort_order,is_active')
      .eq('is_active', true)
      .order('sort_order', { ascending: true })
      .limit(200),
    supabase
      .from('products')
      .select('*')
      .eq('is_active', true)
      .order('updated_at', { ascending: false })
      .limit(1200),
  ])

  if (categoryResult.error) throw categoryResult.error
  if (productResult.error) throw productResult.error

  const categories = (categoryResult.data ?? []).map((row) => ({
    id: String(row.id),
    name: String(row.name),
    sortOrder: Number(row.sort_order ?? 0),
    isActive: row.is_active !== false,
  }))
  const categoryById = new Map(categories.map((category) => [category.id, category]))
  const products = (productResult.data ?? []).map((row) => {
    const categoryId = String(row.category_id)
    return {
      id: String(row.id),
      categoryId,
      categoryName: categoryById.get(categoryId)?.name ?? 'Uncategorized',
      name: String(row.name),
      price: Number(row.price ?? 0),
      halfOrderPrice: normalizeHalfOrderPrice(row.half_order_price ?? row.half_price),
      status: String(row.status ?? 'AVAILABLE').toUpperCase() as ProductStatus,
      imagePath: normalizeImagePath(row.image_path),
      stockCount: Number(row.stock_count ?? 0),
      isLowStock: Boolean(row.is_low_stock),
      isActive: row.is_active !== false,
    }
  })

  return { categories, products }
}

export async function updatePosMenuProductStatus(productId: string, status: ProductStatus) {
  if (!hasSupabaseConfig) return
  const { error } = await requireSupabase()
    .from('products')
    .update({ status: status.toLowerCase(), updated_at: new Date().toISOString() })
    .eq('id', productId)
  if (error) throw error
}

export function isProductVisibleOnPos(product: PosMenuProduct) {
  return product.isActive && product.status !== 'HIDDEN'
}

function normalizeHalfOrderPrice(value: unknown) {
  if (value == null || value === '') return null
  const amount = Number(value)
  return Number.isFinite(amount) && amount > 0 ? amount : null
}

export function getPreviewPosMenu() {
  return { categories: sampleCategories, products: sampleProducts }
}

function normalizeImagePath(rawValue: unknown) {
  if (rawValue == null) return null
  const value = String(rawValue).trim()
  if (!value || value.toLowerCase() === 'null' || value.toLowerCase() === 'undefined') return null
  if (/^https?:\/\//i.test(value) || value.startsWith('data:') || value.startsWith('blob:') || value.startsWith('/')) {
    return value
  }
  const { data } = requireSupabase().storage.from(getStorageBucket()).getPublicUrl(value)
  return data.publicUrl
}

const sampleCategories: PosMenuCategory[] = [
  { id: 'meals', name: 'Meals', sortOrder: 0, isActive: true },
  { id: 'drinks', name: 'Drinks', sortOrder: 1, isActive: true },
  { id: 'addons', name: 'Add-ons', sortOrder: 2, isActive: true },
]

const sampleProducts: PosMenuProduct[] = [
  {
    id: 'sample-meal',
    categoryId: 'meals',
    categoryName: 'Meals',
    name: 'Sample Meal',
    price: 149,
    halfOrderPrice: 85,
    status: 'AVAILABLE',
    imagePath: null,
    stockCount: 20,
    isLowStock: false,
    isActive: true,
  },
  {
    id: 'sample-drink',
    categoryId: 'drinks',
    categoryName: 'Drinks',
    name: 'House Iced Tea',
    price: 50,
    halfOrderPrice: null,
    status: 'AVAILABLE',
    imagePath: null,
    stockCount: 30,
    isLowStock: false,
    isActive: true,
  },
]
