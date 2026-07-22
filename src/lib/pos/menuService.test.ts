import { describe, expect, it } from 'vitest'
import { isProductVisibleOnPos } from './menuService'
import type { PosMenuProduct } from './posTypes'

const product: PosMenuProduct = {
  id: 'product-1', categoryId: 'category-1', categoryName: 'Meals', name: 'Meal',
  price: 100, halfOrderPrice: null, status: 'AVAILABLE', imagePath: null,
  stockCount: 0, isLowStock: false, isActive: true,
}

describe('isProductVisibleOnPos', () => {
  it('shows available and unavailable products, but not hidden or inactive products', () => {
    expect(isProductVisibleOnPos(product)).toBe(true)
    expect(isProductVisibleOnPos({ ...product, status: 'UNAVAILABLE' })).toBe(true)
    expect(isProductVisibleOnPos({ ...product, status: 'HIDDEN' })).toBe(false)
    expect(isProductVisibleOnPos({ ...product, isActive: false })).toBe(false)
  })
})
