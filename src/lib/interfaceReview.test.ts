import { describe, expect, it } from 'vitest'
import { formatOrderAge, isEarlierServiceDay, productMatchesSearch } from './interfaceReview'

describe('operational order ages', () => {
  const now = Date.parse('2026-10-12T10:00:00+08:00')
  it('keeps minute-scale ages for the active kitchen queue', () => {
    expect(formatOrderAge(now - 12 * 60_000, now)).toBe('12 min ago')
  })
  it('uses hours and days instead of unbounded minute counts', () => {
    expect(formatOrderAge(now - 125 * 60_000, now)).toBe('2h 5m ago')
    expect(formatOrderAge(now - 3 * 86_400_000, now)).toBe('3 days ago')
  })
  it('handles unavailable timestamps without rendering NaN', () => {
    expect(formatOrderAge(NaN, now)).toBe('Time unavailable')
    expect(formatOrderAge(now + 60_000, now)).toBe('Just now')
  })
  it('identifies earlier Philippine service dates across midnight', () => {
    expect(isEarlierServiceDay(Date.parse('2026-10-11T23:59:00+08:00'), now)).toBe(true)
    expect(isEarlierServiceDay(Date.parse('2026-10-12T00:01:00+08:00'), now)).toBe(false)
    expect(isEarlierServiceDay(NaN, now)).toBe(false)
  })
})
describe('cashier menu search', () => {
  const product = { name: 'Adobong Baboy', categoryName: 'ULAM' }
  it('matches all query terms across product and category without case sensitivity', () => {
    expect(productMatchesSearch(product, '  BABOY   ulam ')).toBe(true)
    expect(productMatchesSearch(product, 'baboy drinks')).toBe(false)
    expect(productMatchesSearch(product, '')).toBe(true)
  })
})
