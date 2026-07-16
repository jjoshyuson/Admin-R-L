export type ServiceMode = 'DINE IN' | 'TAKE OUT'
export type PaymentMethod = 'CASH' | 'GCASH' | 'SPLIT'
export type ProductStatus = 'AVAILABLE' | 'UNAVAILABLE' | 'HIDDEN'

export type PosMenuCategory = {
  id: string
  name: string
  sortOrder: number
  isActive: boolean
}

export type PosMenuProduct = {
  id: string
  categoryId: string
  categoryName: string
  name: string
  price: number
  halfOrderPrice: number | null
  status: ProductStatus
  imagePath: string | null
  stockCount: number
  isLowStock: boolean
  isActive: boolean
}

export type CartLine = {
  lineId: string
  product: PosMenuProduct
  quantity: number
  isHalfOrder: boolean
  serviceMode: ServiceMode
  unitPrice: number
  lineTotal: number
}

export type CartTotals = {
  subtotal: number
  tax: number
  total: number
}

export type PaymentInput = {
  method: PaymentMethod
  cashReceived?: number
  gcashReference?: string
  splitCashAmount?: number
  splitGcashAmount?: number
  splitGcashReference?: string
}

export type PaymentDetails = {
  method: PaymentMethod
  paymentReference: string | null
  cashAmount: number | null
  gcashAmount: number | null
  gcashReferenceLast4: string | null
  amountReceived: number | null
  changeAmount: number
}

export type KitchenOrderItem = {
  productId: string
  name: string
  serviceMode: ServiceMode
  isHalfOrder: boolean
  quantity: number
  price: number
  lineTotal: number
  kitchenStatus: 'PENDING'
  isChecked: boolean
}

export type CompletedOrder = {
  deviceOrderId: string
  deviceId: string
  createdAt: string
  serviceMode: ServiceMode | 'MIXED'
  payment: PaymentDetails
  orderNote: string | null
  totals: CartTotals
  items: KitchenOrderItem[]
}

export type SaveOrderInput = {
  deviceId: string
  orderNote: string | null
  lines: CartLine[]
  totals: CartTotals
  payment: PaymentDetails
  createdAt?: Date
}

