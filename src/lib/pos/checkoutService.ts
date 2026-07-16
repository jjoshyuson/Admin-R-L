import type {
  CartLine,
  CartTotals,
  PaymentDetails,
  PaymentInput,
  PosMenuProduct,
  ServiceMode,
} from './posTypes'

const moneyPrecision = 100

export function roundMoney(value: number) {
  return Math.round((value + Number.EPSILON) * moneyPrecision) / moneyPrecision
}

export function resolveUnitPrice(product: PosMenuProduct, isHalfOrder: boolean) {
  if (isHalfOrder && product.halfOrderPrice != null) {
    return product.halfOrderPrice
  }
  return product.price
}

export function buildCartLine(product: PosMenuProduct, serviceMode: ServiceMode, isHalfOrder: boolean): CartLine {
  const unitPrice = resolveUnitPrice(product, isHalfOrder)
  return {
    lineId: `${product.id}:${serviceMode}:${isHalfOrder ? 'half' : 'regular'}`,
    product,
    quantity: 1,
    isHalfOrder,
    serviceMode,
    unitPrice,
    lineTotal: roundMoney(unitPrice),
  }
}

export function updateLineQuantity(line: CartLine, quantity: number): CartLine {
  return {
    ...line,
    quantity,
    lineTotal: roundMoney(line.unitPrice * quantity),
  }
}

export function calculateCartTotals(lines: CartLine[], taxEnabled: boolean, taxRatePercent: number): CartTotals {
  const subtotal = roundMoney(lines.reduce((sum, line) => sum + line.lineTotal, 0))
  const tax = taxEnabled ? roundMoney(subtotal * (taxRatePercent / 100)) : 0
  return {
    subtotal,
    tax,
    total: roundMoney(subtotal + tax),
  }
}

export function buildPaymentDetails(input: PaymentInput, total: number): PaymentDetails {
  if (total <= 0) {
    throw new Error('Add items before checkout.')
  }

  if (input.method === 'CASH') {
    const received = roundMoney(input.cashReceived ?? 0)
    if (received < total) {
      throw new Error('Cash received must cover the order total.')
    }
    return {
      method: 'CASH',
      paymentReference: `CASH:${received.toFixed(2)}`,
      cashAmount: total,
      gcashAmount: null,
      gcashReferenceLast4: null,
      amountReceived: received,
      changeAmount: roundMoney(received - total),
    }
  }

  if (input.method === 'GCASH') {
    const reference = normalizeReference(input.gcashReference)
    return {
      method: 'GCASH',
      paymentReference: reference,
      cashAmount: null,
      gcashAmount: total,
      gcashReferenceLast4: reference.slice(-4) || null,
      amountReceived: total,
      changeAmount: 0,
    }
  }

  const cashAmount = roundMoney(input.splitCashAmount ?? 0)
  const gcashAmount = roundMoney(input.splitGcashAmount ?? 0)
  const paid = roundMoney(cashAmount + gcashAmount)
  if (cashAmount < 0 || gcashAmount < 0) {
    throw new Error('Split payment amounts cannot be negative.')
  }
  if (paid < total) {
    throw new Error('Split payment amounts must cover the order total.')
  }
  const reference = normalizeReference(input.splitGcashReference)
  const changeAmount = roundMoney(paid - total)
  return {
    method: 'SPLIT',
    paymentReference: `SPLIT:CASH=${cashAmount.toFixed(2)};GCASH=${gcashAmount.toFixed(2)};REF=${reference};PAID=${paid.toFixed(2)};CHANGE=${changeAmount.toFixed(2)}`,
    cashAmount,
    gcashAmount,
    gcashReferenceLast4: reference.slice(-4) || null,
    amountReceived: paid,
    changeAmount,
  }
}

function normalizeReference(value: string | undefined) {
  return value?.trim().replace(/\s+/g, '') ?? ''
}

