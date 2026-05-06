import { useEffect, useMemo, useState } from 'react'
import { fetchInventoryItems, upsertInventoryItems } from '../lib/adminApi'
import type { IngredientPriceLog, InventoryItem, RecipeIngredient } from '../lib/adminTypes'

export type InventoryPeriod = 'Daily' | 'Weekly' | 'Monthly'
export type InventoryFrequency = 'Daily' | 'Weekly' | 'Monthly'
export type IngredientStatus = 'healthy' | 'low' | 'critical'

export type InventoryIngredient = {
  id: string
  name: string
  category: string
  unit: string
  estimatedOnHand: number
  reorderLevel: number
  status: IngredientStatus
  countingEnabled: boolean
  countingFrequency: InventoryFrequency
  overdue: boolean
  usedByPeriod: Record<InventoryPeriod, number>
}

const STORAGE_KEY = 'admin-web-inventory-overrides-v1'

function titleCase(value: string) {
  return value
    .split(/[\s-_]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ')
}

function categoryForIngredient(name: string) {
  const normalized = name.toLowerCase()
  if (/(beef|pork|chicken|meat)/.test(normalized)) return 'Meat'
  if (/(milk|cheese|butter|cream)/.test(normalized)) return 'Dairy'
  if (/(juice|tea|coffee|water|soda)/.test(normalized)) return 'Beverage'
  if (/(shrimp|fish|tuna|salmon)/.test(normalized)) return 'Seafood'
  if (/(lettuce|tomato|onion|garlic|potato|calamansi|lemon)/.test(normalized)) return 'Produce'
  return 'General'
}

function statusFor(onHand: number, reorderLevel: number): IngredientStatus {
  if (onHand <= reorderLevel * 0.8) return 'critical'
  if (onHand <= reorderLevel) return 'low'
  return 'healthy'
}

function buildSeedIngredients(logs: IngredientPriceLog[], recipeIngredients: RecipeIngredient[]): InventoryIngredient[] {
  const unique = new Map<string, { name: string; unit: string; recipeUsage: number }>()
  for (const ingredient of recipeIngredients) {
    const current = unique.get(ingredient.ingredientRefId) ?? {
      name: ingredient.ingredientName || ingredient.ingredientRefId,
      unit: ingredient.purchaseUnit || ingredient.recipeUnit || 'kg',
      recipeUsage: 0,
    }
    current.recipeUsage += ingredient.recipeQuantity
    unique.set(ingredient.ingredientRefId, current)
  }
  for (const log of logs) {
    if (!unique.has(log.ingredientId)) {
      unique.set(log.ingredientId, {
        name: log.ingredientName || log.ingredientId,
        unit: log.unit || 'kg',
        recipeUsage: 0,
      })
    }
  }
  return [...unique.entries()].map(([id, item], index) => {
    const reorderLevel = Math.max(2, Math.ceil(item.recipeUsage || 4))
    const estimatedOnHand = reorderLevel + 4 + (index % 3)
    return {
      id,
      name: titleCase(item.name),
      category: categoryForIngredient(item.name),
      unit: item.unit || 'kg',
      estimatedOnHand,
      reorderLevel,
      status: statusFor(estimatedOnHand, reorderLevel),
      countingEnabled: true,
      countingFrequency: index % 3 === 0 ? 'Daily' : index % 2 === 0 ? 'Weekly' : 'Monthly',
      overdue: false,
      usedByPeriod: {
        Daily: Math.max(1, Number((item.recipeUsage / 5).toFixed(1)) || 1),
        Weekly: Math.max(3, Number((item.recipeUsage / 2).toFixed(1)) || 3),
        Monthly: Math.max(12, Number((item.recipeUsage * 2).toFixed(1)) || 12),
      },
    }
  })
}

function readPersistedOverrides() {
  if (typeof window === 'undefined') return new Map<string, Partial<InventoryIngredient>>()
  const raw = window.localStorage.getItem(STORAGE_KEY)
  if (!raw) return new Map<string, Partial<InventoryIngredient>>()
  try {
    const parsed = JSON.parse(raw) as Record<string, Partial<InventoryIngredient>>
    return new Map(Object.entries(parsed))
  } catch {
    return new Map<string, Partial<InventoryIngredient>>()
  }
}

function mergeRemoteItems(seedIngredients: InventoryIngredient[], remoteItems: InventoryItem[]) {
  const remoteById = new Map(remoteItems.map((item) => [item.id, item]))
  const merged = seedIngredients.map((ingredient) => {
    const remote = remoteById.get(ingredient.id)
    if (!remote) return ingredient
    return {
      ...ingredient,
      name: remote.name || ingredient.name,
      category: remote.category || ingredient.category,
      unit: remote.unit || ingredient.unit,
      estimatedOnHand: remote.onHand,
      reorderLevel: remote.reorderLevel,
      countingEnabled: remote.countingEnabled,
      countingFrequency: remote.countingFrequency,
      overdue: remote.overdue,
      status: statusFor(remote.onHand, remote.reorderLevel),
    }
  })

  for (const remote of remoteItems) {
    if (merged.some((ingredient) => ingredient.id === remote.id)) continue
    merged.push({
      id: remote.id,
      name: titleCase(remote.name),
      category: remote.category || categoryForIngredient(remote.name),
      unit: remote.unit || 'kg',
      estimatedOnHand: remote.onHand,
      reorderLevel: remote.reorderLevel,
      status: statusFor(remote.onHand, remote.reorderLevel),
      countingEnabled: remote.countingEnabled,
      countingFrequency: remote.countingFrequency,
      overdue: remote.overdue,
      usedByPeriod: {
        Daily: 0,
        Weekly: 0,
        Monthly: 0,
      },
    })
  }

  return merged
}

export function useInventoryState(logs: IngredientPriceLog[], recipeIngredients: RecipeIngredient[]) {
  const seedIngredients = useMemo(
    () => buildSeedIngredients(logs, recipeIngredients),
    [logs, recipeIngredients],
  )
  const [ingredients, setIngredients] = useState<InventoryIngredient[]>(seedIngredients)
  const [hydrated, setHydrated] = useState(false)

  useEffect(() => {
    let cancelled = false

    async function hydrate() {
      try {
        const remoteItems = await fetchInventoryItems()
        if (cancelled) return
        if (remoteItems.length > 0) {
          setIngredients(mergeRemoteItems(seedIngredients, remoteItems))
          setHydrated(true)
          return
        }
      } catch {
        if (cancelled) return
      }

      const overrides = readPersistedOverrides()
      const next = seedIngredients.map((ingredient) => {
        const override = overrides.get(ingredient.id)
        if (!override) return ingredient
        const estimatedOnHand = override.estimatedOnHand ?? ingredient.estimatedOnHand
        const reorderLevel = override.reorderLevel ?? ingredient.reorderLevel
        return {
          ...ingredient,
          ...override,
          estimatedOnHand,
          reorderLevel,
          status: statusFor(estimatedOnHand, reorderLevel),
        }
      })
      setIngredients(next)
      setHydrated(true)
    }

    setHydrated(false)
    void hydrate()

    return () => {
      cancelled = true
    }
  }, [seedIngredients])

  useEffect(() => {
    if (!hydrated) return
    if (typeof window === 'undefined') return
    const payload = Object.fromEntries(
      ingredients.map((ingredient) => [
        ingredient.id,
        {
          estimatedOnHand: ingredient.estimatedOnHand,
          reorderLevel: ingredient.reorderLevel,
          countingEnabled: ingredient.countingEnabled,
          countingFrequency: ingredient.countingFrequency,
          overdue: ingredient.overdue,
        },
      ]),
    )
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(payload))
    void upsertInventoryItems(
      ingredients.map((ingredient) => ({
        id: ingredient.id,
        name: ingredient.name,
        category: ingredient.category,
        unit: ingredient.unit,
        onHand: ingredient.estimatedOnHand,
        reorderLevel: ingredient.reorderLevel,
        countingEnabled: ingredient.countingEnabled,
        countingFrequency: ingredient.countingFrequency,
        overdue: ingredient.overdue,
        updatedAt: new Date().toISOString(),
      })),
    ).catch(() => {
      // The local cache remains the fallback until the inventory tables exist in Supabase.
    })
  }, [hydrated, ingredients])

  return {
    ingredients,
    setIngredients,
  }
}
