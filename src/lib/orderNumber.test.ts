import { describe, expect, it } from 'vitest'
import { formatCustomerOrderNumber, formatHourlyOrderNumber } from './orderNumber'

describe('customer order numbers', () => {
  it('uses the local 24-hour clock and a three-digit sequence', () => {
    const atFivePm = new Date(2026, 6, 25, 17, 14, 0)
    expect(formatHourlyOrderNumber(atFivePm, 1)).toBe('17-001')
    expect(formatHourlyOrderNumber(atFivePm, 799)).toBe('17-799')
  })

  it('reads the new number from a unique device order id', () => {
    expect(formatCustomerOrderNumber('TABLET-1-20260725221400-17-002')).toBe('17-002')
    expect(formatCustomerOrderNumber('#01-001')).toBe('01-001')
  })

  it('continues to format existing legacy order ids', () => {
    expect(formatCustomerOrderNumber('TABLET-1-20260725050123-0007')).toBe('0725-0007')
  })
})
