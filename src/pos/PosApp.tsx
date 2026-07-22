import { useEffect, useMemo, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import {
  ChartNoAxesColumnIncreasing,
  Banknote,
  Check,
  ChevronLeft,
  ChevronRight,
  CircleCheckBig,
  CircleAlert,
  Clock3,
  ChefHat,
  Eye,
  Glasses,
  LayoutGrid,
  List,
  LogOut,
  MapPin,
  Pencil,
  Plus,
  RefreshCw,
  Settings,
  Shirt,
  ShoppingCart,
  Table as TableIcon,
  Trash2,
  Utensils,
  User,
  WalletCards,
  X,
} from 'lucide-react'
import { fetchAdminSetting, fetchCashMovements, fetchOrders, saveAdminSetting, upsertCashMovements, voidOrder } from '../lib/adminApi'
import type { CashMovement, OrderRecord } from '../lib/adminTypes'
import { fetchPosMenu, getPreviewPosMenu, isProductVisibleOnPos, updatePosMenuProductStatus } from '../lib/pos/menuService'
import type { CompletedOrder, PosMenuCategory, PosMenuProduct, ProductStatus, ServiceMode } from '../lib/pos/posTypes'
import { checkNativePrinterStatus, printPosDocument, type NativePrinterStatus, type PrintDocumentType, type ReceiptDetailMode, type ReceiptPaperWidth } from '../lib/pos/printService'
import { paymentBelongsToActiveShift } from '../lib/pos/shiftFiltering'
import {
  cancelOrderEditRequest,
  createOrderEditRequest,
  describeOrderEditRequestError,
  subscribeToOrderEditRequest,
} from '../lib/orderEditRequests'
import { hasSupabaseConfig, requireSupabase } from '../lib/supabase/client'
import { closeOpenShiftSession, createShiftAdjustment, fetchOpenShiftSession, fetchShiftAdjustments, fetchShiftSchedule, openShiftSession } from '../lib/shiftService'
import type { ShiftAdjustment, ShiftSchedule, ShiftSession } from '../lib/adminTypes'

type MainTab = 'new-order' | 'ongoing' | 'kitchen' | 'sale-tracker' | 'settings'
type PrinterDetectionLogEntry = NativePrinterStatus & { checkedAt: string }
type OrderStatus = 'preparing' | 'served' | 'paid'
type OrderType = Extract<ServiceMode, 'DINE IN' | 'TAKE OUT'>
type OrderFilter = 'all' | OrderStatus
type PaymentFilter = 'all' | 'waiting' | 'partial' | 'paid'
type OrderSort = 'oldest' | 'newest'
type PaymentMethod = 'cash' | 'gcash' | 'split'
type CheckoutTarget = { type: 'order'; orderId: string }
type KitchenNoteTarget = { orderNumber: string; itemCount: number; appendToOrderId?: string; editOrderId?: string; noteOrderId?: string; initialNote?: string }
type SettingsSection = 'menu' | 'history' | 'money' | 'printing'
type MoneyAccount = 'cash' | 'gcash'
type MovementDirection = 'in' | 'out'
type ExpensePaymentMethod = 'cash' | 'gcash'
type ReceiptPrintSettings = {
  paperWidth: ReceiptPaperWidth
  detailMode: ReceiptDetailMode
  includeOrderNote: boolean
}
type EditApprovalRequest = {
  requestId: string | null
  orderId: string
  action: 'edit' | 'cancel'
  status: 'creating' | 'pending' | 'approved' | 'error'
  message: string
}

type ExpenseCategorySetting = {
  id: string
  name: string
  subcategories: Array<{
    id: string
    name: string
  }>
}

type PosEmployee = {
  id: string
  name: string
  dailyRate: number
  isCashier: boolean
  isActive: boolean
  pin: string
}

type SalePayment = {
  id: string
  orderId: string
  customerName: string
  amount: number
  method: 'cash' | 'gcash' | 'other'
  status: 'paid' | 'unpaid'
  createdAt: string
  items: Array<{
    name: string
    quantity: number
    price: number
  }>
  orderNote?: string
  shiftId?: string | null
  shiftSessionId?: string | null
}

const saleTrackerCache: {
  shiftId: string | null
  payments: SalePayment[]
  expenses: CashMovement[]
  adjustments: ShiftAdjustment[]
  status: string
} = {
  shiftId: null,
  payments: [],
  expenses: [],
  adjustments: [],
  status: 'Loading payments...',
}

type TicketItem = {
  lineId: string
  productId: string
  categoryName: string
  name: string
  price: number
  quantity: number
  imagePath: string | null
  orderType: OrderType
  isHalfOrder: boolean
}

type OrderItem = {
  id: string
  productId: string
  categoryName: string
  name: string
  quantity: number
  price: number
  served: boolean
  paidQuantity: number
  kitchenPrintedQuantity: number
  orderType: OrderType
  isHalfOrder: boolean
}

type RestaurantOrder = {
  id: string
  deviceOrderId: string
  items: OrderItem[]
  status: OrderStatus
  paid: boolean
  readyForPayment: boolean
  paymentReceived: number
  paymentMethod: PaymentMethod | null
  paymentReference: string
  paymentNotes: string
  orderType: OrderType | 'MIXED'
  createdAt: number
  shiftId: string | null
  shiftSessionId: string | null
}

const defaultCategoryNames = ['Meals', 'Drinks', 'Add-ons', 'Others']
const posAppVersion = 'vA06'
const taxRate = 0
const paymentModeTiles = [
  { id: 'full', label: 'Full Payment', helper: 'Pay full amount', icon: '$' },
  { id: 'split-items', label: 'Split by Items', helper: 'Share items', icon: '1/2' },
  { id: 'split-people', label: 'Split by People', helper: 'Per person', icon: 'PPL' },
  { id: 'custom', label: 'Custom Amount', helper: 'Any amount', icon: 'AMT' },
  { id: 'combine', label: 'Combine Orders', helper: 'Pay multiple', icon: 'COM' },
  { id: 'other', label: 'Other', helper: 'Other options', icon: '...' },
] as const
type PaymentModeId = typeof paymentModeTiles[number]['id']

export function PosApp() {
  const [categories, setCategories] = useState<PosMenuCategory[]>([])
  const [products, setProducts] = useState<PosMenuProduct[]>([])
  const [selectedCategory, setSelectedCategory] = useState('Meals')
  const [orderType, setOrderType] = useState<OrderType>('DINE IN')
  const [halfOrderEnabled, setHalfOrderEnabled] = useState(false)
  const [deviceId] = useState(readDeviceId)
  const [ticketItems, setTicketItems] = useState<TicketItem[]>([])
  const [orders, setOrders] = useState<RestaurantOrder[]>([])
  const [history, setHistory] = useState<RestaurantOrder[]>([])
  const [activeTab, setActiveTab] = useState<MainTab>('new-order')
  const [primaryNavCollapsed, setPrimaryNavCollapsed] = useState(readPrimaryNavCollapsed)
  const [employees, setEmployees] = useState<PosEmployee[]>(readLocalPosEmployees)
  const [activeEmployeeId, setActiveEmployeeId] = useState(readActiveEmployeeId)
  const [shiftSchedule, setShiftSchedule] = useState<ShiftSchedule | null>(null)
  const [activeShiftSession, setActiveShiftSession] = useState<ShiftSession | null>(null)
  const [shiftBusy, setShiftBusy] = useState(false)
  const [pendingEmployeeId, setPendingEmployeeId] = useState('')
  const [loginPin, setLoginPin] = useState('')
  const [pinError, setPinError] = useState('')
  const [statusMessage, setStatusMessage] = useState('Loading menu...')
  const [refreshing, setRefreshing] = useState(false)
  const [nextOrderNumber, setNextOrderNumber] = useState(1)
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null)
  const [prepaidCheckoutOrderId, setPrepaidCheckoutOrderId] = useState<string | null>(null)
  const [kitchenNoteTarget, setKitchenNoteTarget] = useState<KitchenNoteTarget | null>(null)
  const [appendOrderId, setAppendOrderId] = useState<string | null>(null)
  const [editOrderId, setEditOrderId] = useState<string | null>(null)
  const [editApprovalRequest, setEditApprovalRequest] = useState<EditApprovalRequest | null>(null)
  const [autoPrintReceipt, setAutoPrintReceipt] = useState(readAutoPrintReceipt)
  const [receiptCopies, setReceiptCopies] = useState(readReceiptCopies)
  const [receiptPrintSettings, setReceiptPrintSettings] = useState(readReceiptPrintSettings)
  const [menuCategoriesEnabled, setMenuCategoriesEnabled] = useState(readKitchenPrintCategorySettings)

  useEffect(() => {
    let active = true
    fetchPosMenu()
      .then((menu) => {
        if (!active) return
        setCategories(menu.categories)
        setProducts(menu.products)
        setStatusMessage(hasSupabaseConfig ? 'Live Supabase menu loaded.' : 'Preview menu loaded.')
      })
      .catch((error: unknown) => {
        if (!active) return
        const preview = getPreviewPosMenu()
        setCategories(preview.categories)
        setProducts(preview.products)
        setStatusMessage(`Preview menu shown. ${error instanceof Error ? error.message : 'Menu failed to load.'}`)
      })
    return () => {
      active = false
    }
  }, [])

  useEffect(() => {
    if (!hasSupabaseConfig) return
    let active = true
    const supabase = requireSupabase()
    const refreshSharedMenu = async () => {
      try {
        const menu = await fetchPosMenu()
        if (!active) return
        setCategories(menu.categories)
        setProducts(menu.products)
      } catch (error) {
        if (active) setStatusMessage(error instanceof Error ? error.message : 'Could not sync the shared menu.')
      }
    }
    const channel = supabase
      .channel('pos-shared-menu')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'products' }, () => void refreshSharedMenu())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'categories' }, () => void refreshSharedMenu())
      .subscribe()
    return () => {
      active = false
      void supabase.removeChannel(channel)
    }
  }, [])

  useEffect(() => {
    window.localStorage.setItem('pos-web-device-id', deviceId)
  }, [deviceId])

  useEffect(() => {
    window.localStorage.setItem('pos-web-primary-nav-collapsed', primaryNavCollapsed ? '1' : '0')
  }, [primaryNavCollapsed])

  useEffect(() => {
    let active = true
    fetchAdminSetting('employees')
      .then((setting) => {
        if (!active) return
        const nextEmployees = normalizePosEmployees(setting)
        if (nextEmployees.length > 0) {
          setEmployees(nextEmployees)
          writeLocalPosEmployees(nextEmployees)
          setActiveEmployeeId((current) => {
            if (nextEmployees.some((employee) => employee.id === current && employee.isActive && employee.isCashier)) return current
            return ''
          })
        }
      })
      .catch(() => {
        if (!active) return
        const fallbackEmployees = readLocalPosEmployees()
        setEmployees(fallbackEmployees)
      })
    return () => {
      active = false
    }
  }, [])

  useEffect(() => {
    window.localStorage.setItem('pos-web-active-employee-id', activeEmployeeId)
  }, [activeEmployeeId])

  useEffect(() => {
    let active = true
    Promise.all([fetchShiftSchedule(), fetchOpenShiftSession(deviceId)]).then(([schedule, session]) => {
      if (!active) return
      setShiftSchedule(schedule)
      setActiveShiftSession(session)
      setActiveEmployeeId(session?.employeeId ?? '')
    }).catch((error: unknown) => setStatusMessage(error instanceof Error ? error.message : 'Could not load shift status.'))
    return () => { active = false }
  }, [deviceId])

  useEffect(() => {
    window.localStorage.setItem('pos-web-auto-print-receipt', autoPrintReceipt ? '1' : '0')
  }, [autoPrintReceipt])

  useEffect(() => {
    window.localStorage.setItem('pos-web-receipt-copies', String(receiptCopies))
  }, [receiptCopies])

  useEffect(() => {
    window.localStorage.setItem('pos-web-receipt-print-settings', JSON.stringify(receiptPrintSettings))
  }, [receiptPrintSettings])

  useEffect(() => {
    window.localStorage.setItem('pos-web-kitchen-print-categories', JSON.stringify(menuCategoriesEnabled))
  }, [menuCategoriesEnabled])

  useEffect(() => {
    let active = true

    async function loadSyncedOrders() {
      try {
        const items = await fetchOrders()
        if (!active) return
        const mappedOrders = items.map(mapAdminOrderToRestaurantOrder)
        const activeOrders = mappedOrders.filter((order) => !order.paid)
        const closedOrders = mappedOrders.filter((order) => order.paid)
        setOrders(activeOrders)
        setHistory(closedOrders)
        if (hasSupabaseConfig) {
          setStatusMessage(`${activeOrders.length} active orders synced from Supabase.`)
        }
      } catch (error) {
        if (!active) return
        setStatusMessage(error instanceof Error ? error.message : 'Could not sync active orders.')
      }
    }

    void loadSyncedOrders()

    if (!hasSupabaseConfig) {
      return () => {
        active = false
      }
    }

    const supabase = requireSupabase()
    const channel = supabase
      .channel('pos-active-orders')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, () => {
        void loadSyncedOrders()
      })
      .subscribe()

    return () => {
      active = false
      void supabase.removeChannel(channel)
    }
  }, [])

  const visibleCategories = useMemo(() => {
    const categoryNames = new Map<string, string>()
    const sortedCategories = [...categories].sort((left, right) => left.sortOrder - right.sortOrder)
    const menuVisibleProducts = products.filter(isProductVisibleOnPos)

    sortedCategories.forEach((category) => {
      categoryNames.set(normalizeCategory(category.name), category.name)
    })

    menuVisibleProducts.forEach((product) => {
      const name = product.categoryName || 'Uncategorized'
      categoryNames.set(normalizeCategory(name), name)
    })

    if (categoryNames.size === 0) {
      defaultCategoryNames.forEach((name) => categoryNames.set(normalizeCategory(name), name))
    }

    return [...categoryNames.values()].map((category) => ({
      name: category,
      count: menuVisibleProducts.filter((product) => sameCategory(category, product.categoryName)).length,
      hasLiveMatch: categories.some((item) => sameCategory(category, item.name)),
    }))
  }, [categories, products])

  useEffect(() => {
    if (selectedCategory === 'All Items') return
    if (visibleCategories.length === 0) return
    if (!visibleCategories.some((category) => sameCategory(category.name, selectedCategory))) {
      setSelectedCategory('All Items')
    }
  }, [selectedCategory, visibleCategories])

  const visibleProducts = useMemo(() => {
    return products
      .filter(isProductVisibleOnPos)
      .filter((product) => selectedCategory === 'All Items' || sameCategory(selectedCategory, product.categoryName))
  }, [products, selectedCategory])
  const categoryByProductId = useMemo(
    () => new Map(products.map((product) => [product.id, product.categoryName || 'Uncategorized'])),
    [products],
  )
  const visibleHalfOrderAvailable = visibleProducts.some((product) => resolveHalfOrderPrice(product) != null)

  async function changeMenuProductAvailability(productId: string, status: ProductStatus) {
    const previousProducts = products
    setProducts((current) => current.map((product) => product.id === productId ? { ...product, status } : product))
    try {
      await updatePosMenuProductStatus(productId, status)
      setStatusMessage(`${products.find((product) => product.id === productId)?.name ?? 'Menu item'} is now ${status.toLowerCase()}.`)
    } catch (error) {
      setProducts(previousProducts)
      throw error
    }
  }

  const subtotal = ticketItems.reduce((sum, item) => sum + item.price * item.quantity, 0)
  const tax = subtotal * taxRate
  const total = subtotal + tax
  const ongoingOrders = orders.filter((order) => !order.readyForPayment && !(order.paid && order.readyForPayment))
  const finishOrders = orders.filter((order) => (order.readyForPayment || order.id === prepaidCheckoutOrderId) && !order.paid)
  const shiftHistory = activeShiftSession
    ? history.filter((order) => order.shiftId === activeShiftSession.shiftId)
    : []
  const completedThisShift = shiftHistory.length
  const cashierEmployees = employees.filter((employee) => employee.isActive && employee.isCashier)
  const activeEmployee = cashierEmployees.find((employee) => employee.id === activeEmployeeId) ?? null
  const activeEmployeeName = activeEmployee?.name ?? 'Select cashier'

  async function clockInEmployee(employeeId: string) {
    const employee = cashierEmployees.find((item) => item.id === employeeId)
    if (!employee || !shiftSchedule || shiftBusy) return
    setShiftBusy(true)
    try {
      const session = await openShiftSession({ employeeId: employee.id, employeeName: employee.name, deviceId, schedule: shiftSchedule })
      setActiveEmployeeId(employee.id); setActiveShiftSession(session)
      setStatusMessage(`${employee.name} clocked into ${session.shiftType === 'FIRST' ? 'First' : 'Second'} Shift. Cash starts at ₱0.`)
    } catch (error) { setStatusMessage(error instanceof Error ? error.message : 'Could not clock in.') }
    finally { setShiftBusy(false) }
  }

  async function clockOutEmployee() {
    if (shiftBusy) return
    setShiftBusy(true)
    try { await closeOpenShiftSession(deviceId); setActiveEmployeeId(''); setActiveShiftSession(null); setStatusMessage('Shift closed. Cash reset to ₱0 for the next cashier.') }
    catch (error) { setStatusMessage(error instanceof Error ? error.message : 'Could not close shift.') }
    finally { setShiftBusy(false) }
  }
  const selectedOrder = selectedOrderId
    ? ongoingOrders.find((order) => order.id === selectedOrderId) ?? ongoingOrders[0] ?? null
    : ongoingOrders[0] ?? null
  const selectedFinishOrder = selectedOrderId
    ? finishOrders.find((order) => order.id === selectedOrderId) ?? finishOrders[0] ?? null
    : finishOrders[0] ?? null
  const appendContextOrder = appendOrderId ? orders.find((order) => order.id === appendOrderId) ?? null : null
  const posModeTitle = editOrderId ? 'Edit Order' : appendOrderId ? 'Add Order' : 'New Order'
  const posModeOrderNumber = editOrderId
    ? formatPosOrderRef(editOrderId)
    : appendOrderId
      ? formatPosOrderRef(appendOrderId)
      : `#${String(nextOrderNumber).padStart(4, '0')}`

  useEffect(() => {
    if (!editApprovalRequest?.requestId || editApprovalRequest.status !== 'pending') return undefined
    return subscribeToOrderEditRequest(editApprovalRequest.requestId, (request) => {
      if (request.status === 'approved') {
        if (editApprovalRequest.action === 'cancel') {
          void completeApprovedCancellation(editApprovalRequest.orderId, request.approvedBy ?? 'Admin Web')
        } else {
          beginApprovedEditOrder(editApprovalRequest.orderId, request.approvedBy ?? 'Admin Web')
        }
      } else if (request.status === 'cancelled' || request.status === 'expired') {
        setStatusMessage(`Edit request for ${formatPosOrderRef(editApprovalRequest.orderId)} was ${request.status}.`)
        setEditApprovalRequest(null)
      }
    })
  }, [editApprovalRequest?.requestId, editApprovalRequest?.status, editApprovalRequest?.orderId, orders])

  function addProduct(product: PosMenuProduct) {
    if (product.status !== 'AVAILABLE') return
    const halfPrice = resolveHalfOrderPrice(product)
    const useHalfOrder = halfOrderEnabled && halfPrice != null
    const unitPrice = useHalfOrder ? halfPrice : product.price
    setTicketItems((current) => {
      const lineId = `${product.id}:${orderType}:${useHalfOrder ? 'half' : 'regular'}`
      const existing = current.find((item) => item.lineId === lineId)
      if (existing) {
        return current.map((item) => item.lineId === lineId ? { ...item, quantity: item.quantity + 1 } : item)
      }
      return [
        ...current,
        {
          lineId,
          productId: product.id,
          categoryName: product.categoryName || 'Uncategorized',
          name: product.name,
          price: unitPrice,
          quantity: 1,
          imagePath: product.imagePath,
          orderType,
          isHalfOrder: useHalfOrder,
        },
      ]
    })
  }

  function changeTicketQuantity(lineId: string, delta: number) {
    setTicketItems((current) =>
      current.flatMap((item) => {
        if (item.lineId !== lineId) return [item]
        const quantity = item.quantity + delta
        return quantity > 0 ? [{ ...item, quantity }] : []
      }),
    )
  }

  function removeTicketItem(lineId: string) {
    setTicketItems((current) => current.filter((item) => item.lineId !== lineId))
  }

  function printSentKitchenTicket(order: RestaurantOrder) {
    return printOrderDocument(order, 'kitchen-ticket', setStatusMessage, 1, receiptPrintSettings, menuCategoriesEnabled, categoryByProductId)
  }

  function requestClockIn(employeeId: string) {
    if (!employeeId) return
    const employee = cashierEmployees.find((item) => item.id === employeeId)
    if (!employee) return
    if (!employee.pin) {
      setStatusMessage(`${employee.name} needs a login PIN. Add one in Employee Management.`)
      return
    }
    setPendingEmployeeId(employeeId)
    setLoginPin('')
    setPinError('')
  }

  function verifyPinAndClockIn() {
    const employee = cashierEmployees.find((item) => item.id === pendingEmployeeId)
    if (!employee || loginPin !== employee.pin) {
      setPinError('Incorrect PIN. Please try again.')
      setLoginPin('')
      return
    }
    setPendingEmployeeId('')
    setPinError('')
    void clockInEmployee(employee.id)
  }

  function reprintKitchenTicket(orderId: string) {
    const order = orders.find((item) => item.id === orderId)
    if (!order) return
    const printed = printSentKitchenTicket({
      ...order,
      paymentNotes: ['REPRINT', order.paymentNotes].filter(Boolean).join(' · '),
    })
    if (!printed) return
    const printedOrder = markKitchenItemsPrinted(order)
    setOrders((current) => current.map((item) => item.id === orderId ? printedOrder : item))
    void syncOrderSnapshot(printedOrder, setStatusMessage)
  }

  async function saveOrder(note: string) {
    if (ticketItems.length === 0) return
    const targetEditOrderId = kitchenNoteTarget?.editOrderId ?? editOrderId
    if (targetEditOrderId) {
      const existingOrder = orders.find((order) => order.id === targetEditOrderId)
      if (!existingOrder) return
      const existingItems = new Map(existingOrder?.items.map((item) => [item.id, item]) ?? [])
      const nextItems: OrderItem[] = ticketItems.map((item, index) => {
        const existing = existingItems.get(item.lineId)
        return {
          id: existing?.id ?? `${item.lineId}:edit:${Date.now()}:${index}`,
          productId: item.productId,
          categoryName: item.categoryName,
          name: item.name,
          quantity: item.quantity,
          price: item.price,
          served: existing?.served ?? false,
          paidQuantity: existing ? Math.min(existing.paidQuantity, item.quantity) : 0,
          kitchenPrintedQuantity: existing ? Math.min(existing.kitchenPrintedQuantity, item.quantity) : 0,
          orderType: item.orderType,
          isHalfOrder: item.isHalfOrder,
        }
      })
      const readyForPayment = nextItems.length > 0 && nextItems.every((item) => item.served)
      const updatedOrder: RestaurantOrder = {
        ...existingOrder,
        items: nextItems,
        status: readyForPayment ? 'served' : 'preparing',
        readyForPayment,
        paid: false,
        paymentNotes: [existingOrder.paymentNotes, note ? `Edit order: ${note}` : 'Edit order'].filter(Boolean).join(' | '),
        orderType: ticketOrderType(ticketItems),
      }
      setOrders((current) => current.map((order) => {
        if (order.id !== targetEditOrderId) return order
        return updatedOrder
      }))
      setTicketItems([])
      setKitchenNoteTarget(null)
      setEditOrderId(null)
      setAppendOrderId(null)
      setSelectedOrderId(targetEditOrderId)
      setStatusMessage(`${formatPosOrderRef(targetEditOrderId)} edited and sent to kitchen.`)
      setActiveTab('ongoing')
      const kitchenPrintDelta = buildKitchenPrintDelta(existingOrder, updatedOrder)
      await syncOrderSnapshot(updatedOrder, setStatusMessage)
      if (kitchenPrintDelta.items.length > 0) {
        if (printSentKitchenTicket(kitchenPrintDelta)) {
          const printedOrder = markKitchenItemsPrinted(updatedOrder, new Set(kitchenPrintDelta.items.map((item) => item.id)))
          setOrders((current) => current.map((item) => item.id === targetEditOrderId ? printedOrder : item))
          await syncOrderSnapshot(printedOrder, setStatusMessage)
        }
      } else {
        setStatusMessage(`${formatPosOrderRef(targetEditOrderId)} updated. No new kitchen items to print.`)
      }
      return
    }

    const targetOrderId = kitchenNoteTarget?.appendToOrderId ?? appendOrderId
    if (targetOrderId) {
      const createdAt = Date.now()
      const existingOrder = orders.find((order) => order.id === targetOrderId)
      if (!existingOrder) return
      const appendedItems: OrderItem[] = ticketItems.map((item, index) => ({
        id: `${item.lineId}:addon:${createdAt}:${index}`,
        productId: item.productId,
        categoryName: item.categoryName,
        name: item.name,
        quantity: item.quantity,
        price: item.price,
        served: false,
        paidQuantity: 0,
        kitchenPrintedQuantity: 0,
        orderType: item.orderType,
        isHalfOrder: item.isHalfOrder,
      }))
      const updatedOrder: RestaurantOrder = {
        ...existingOrder,
        items: [...existingOrder.items, ...appendedItems],
        status: 'preparing',
        readyForPayment: false,
        paid: false,
        paymentNotes: [existingOrder.paymentNotes, note ? `Add order: ${note}` : 'Add order'].filter(Boolean).join(' | '),
        orderType: ticketOrderType([...existingOrder.items, ...appendedItems].map((item) => ({
          lineId: item.id,
          productId: item.productId,
          categoryName: item.categoryName,
          name: item.name,
          price: item.price,
          quantity: item.quantity,
          imagePath: null,
          orderType: item.orderType,
          isHalfOrder: item.isHalfOrder,
        }))),
      }
      setOrders((current) => current.map((order) => {
        if (order.id !== targetOrderId) return order
        return updatedOrder
      }))
      setTicketItems([])
      setKitchenNoteTarget(null)
      setAppendOrderId(null)
      setEditOrderId(null)
      setSelectedOrderId(targetOrderId)
      setStatusMessage(`${formatPosOrderRef(targetOrderId)} add order sent to kitchen.`)
      setActiveTab('ongoing')
      await syncOrderSnapshot(updatedOrder, setStatusMessage)
      const appendedTicket = {
        ...updatedOrder,
        items: appendedItems,
        paymentNotes: note ? `Add order: ${note}` : 'Add order',
      }
      if (printSentKitchenTicket(appendedTicket)) {
        const printedOrder = markKitchenItemsPrinted(updatedOrder, new Set(appendedItems.map((item) => item.id)))
        setOrders((current) => current.map((item) => item.id === targetOrderId ? printedOrder : item))
        await syncOrderSnapshot(printedOrder, setStatusMessage)
      }
      return
    }
    const createdAt = Date.now()
    const order: RestaurantOrder = {
      id: `#${String(nextOrderNumber).padStart(4, '0')}`,
      deviceOrderId: createDeviceOrderId(deviceId, nextOrderNumber, createdAt),
      items: ticketItems.map((item) => ({
        id: item.lineId,
        productId: item.productId,
        categoryName: item.categoryName,
        name: item.name,
        quantity: item.quantity,
        price: item.price,
        served: false,
        paidQuantity: 0,
        kitchenPrintedQuantity: 0,
        orderType: item.orderType,
        isHalfOrder: item.isHalfOrder,
      })),
      status: 'preparing',
      paid: false,
      readyForPayment: false,
      paymentReceived: 0,
      paymentMethod: null,
      paymentReference: '',
      paymentNotes: note,
      orderType: ticketOrderType(ticketItems),
      createdAt,
      shiftId: activeShiftSession?.shiftId ?? null,
      shiftSessionId: activeShiftSession?.id ?? null,
    }
    setOrders((current) => [order, ...current])
    setNextOrderNumber((value) => value + 1)
    setTicketItems([])
    setKitchenNoteTarget(null)
    setStatusMessage(`${order.id} saved to ongoing orders.`)
    setActiveTab('ongoing')
    await syncOrderSnapshot(order, setStatusMessage)
    await syncPaymentSnapshot(order, setStatusMessage, undefined, activeShiftSession, activeEmployeeName)
    if (printSentKitchenTicket(order)) {
      const printedOrder = markKitchenItemsPrinted(order)
      setOrders((current) => current.map((item) => item.id === order.id ? printedOrder : item))
      await syncOrderSnapshot(printedOrder, setStatusMessage)
    }
  }

  function startAddOrder(orderId: string) {
    setAppendOrderId(orderId)
    setEditOrderId(null)
    setSelectedOrderId(orderId)
    setTicketItems([])
    setStatusMessage(`Adding items to ${formatPosOrderRef(orderId)}. Choose products, then prepare the order.`)
    setActiveTab('new-order')
  }

  async function quickAddRice(orderId: string) {
    const order = orders.find((item) => item.id === orderId)
    const riceProduct = products.find((product) => product.status === 'AVAILABLE' && product.name.trim().toLowerCase() === 'plain rice')
    if (!order) return
    if (!riceProduct) {
      setStatusMessage('The Plain Rice menu item is unavailable. Refresh the POS or check Menu Settings.')
      return
    }
    const riceOrderType = order.orderType === 'MIXED' ? order.items[0]?.orderType ?? 'DINE IN' : order.orderType
    const existingRice = order.items.find((item) => item.productId === riceProduct.id && item.orderType === riceOrderType)
    const riceItem: OrderItem = {
      id: `${riceProduct.id}:${riceOrderType}:rice-addon:${Date.now()}`,
      productId: riceProduct.id,
      categoryName: riceProduct.categoryName || 'Uncategorized',
      name: riceProduct.name,
      quantity: 1,
      price: riceProduct.price,
      served: true,
      paidQuantity: 0,
      kitchenPrintedQuantity: 1,
      orderType: riceOrderType,
      isHalfOrder: false,
    }
    const updatedItems = existingRice
      ? order.items.map((item) => item.id === existingRice.id ? {
          ...item,
          quantity: item.quantity + 1,
          served: true,
          kitchenPrintedQuantity: item.kitchenPrintedQuantity + 1,
        } : item)
      : [...order.items, riceItem]
    const remainsReadyForPayment = updatedItems.every((item) => item.served)
    const updatedOrder: RestaurantOrder = {
      ...order,
      items: updatedItems,
      status: remainsReadyForPayment ? 'served' : 'preparing',
      paid: false,
      readyForPayment: remainsReadyForPayment,
      paymentNotes: [order.paymentNotes, `Extra Rice: ${riceProduct.name}`].filter(Boolean).join(' | '),
    }
    setOrders((current) => current.map((item) => item.id === orderId ? updatedOrder : item))
    setSelectedOrderId(orderId)
    setStatusMessage(`Extra Rice added to ${formatPosOrderRef(orderId)} and marked served.`)
    await syncOrderSnapshot(updatedOrder, setStatusMessage)
  }

  async function saveOrderNotes(orderId: string, note: string) {
    const existingOrder = orders.find((order) => order.id === orderId)
    if (!existingOrder) return
    const updatedOrder = { ...existingOrder, paymentNotes: note }
    setOrders((current) => current.map((order) => order.id === orderId ? updatedOrder : order))
    setKitchenNoteTarget(null)
    setStatusMessage(`${formatPosOrderRef(orderId)} notes updated.`)
    await syncOrderSnapshot(updatedOrder, setStatusMessage)
  }

  function editOrderNotes(orderId: string) {
    const order = orders.find((item) => item.id === orderId)
    if (!order) return
    setKitchenNoteTarget({ orderNumber: order.id, itemCount: order.items.reduce((sum, item) => sum + item.quantity, 0), noteOrderId: order.id, initialNote: order.paymentNotes })
  }

  async function requestEditOrder(orderId: string) {
    const order = orders.find((item) => item.id === orderId)
    if (!order) {
      setStatusMessage(`${formatPosOrderRef(orderId)} could not be found for editing.`)
      return
    }
    if (!hasSupabaseConfig) {
      setStatusMessage('Edit order approval requires online Supabase sync. Connect first, then ask admin to approve.')
      setEditApprovalRequest({
        requestId: null,
        orderId,
        action: 'edit',
        status: 'error',
        message: 'Online admin approval is required. This POS cannot approve its own edit request.',
      })
      return
    }
    setEditApprovalRequest({
      requestId: null,
      orderId,
      action: 'edit',
      status: 'creating',
      message: 'Sending approval request to Admin Web...',
    })
    try {
      const request = await createOrderEditRequest({
        deviceOrderId: order.deviceOrderId,
        displayOrderId: order.id,
        deviceId,
        requestedBy: activeEmployeeName,
      })
      setStatusMessage(`Edit request sent for ${formatPosOrderRef(order.id)}. Waiting for Admin Web approval.`)
      setEditApprovalRequest({
        requestId: request.id,
        orderId,
        action: 'edit',
        status: 'pending',
        message: 'Waiting for the admin app to approve. Keep this POS online.',
      })
    } catch (error) {
      const message = describeOrderEditRequestError(error)
      setStatusMessage(message)
      setEditApprovalRequest({
        requestId: null,
        orderId,
        action: 'edit',
        status: 'error',
        message,
      })
    }
  }

  async function requestCancelOrder(orderId: string) {
    const order = orders.find((item) => item.id === orderId)
    if (!order) {
      setStatusMessage(`${formatPosOrderRef(orderId)} could not be found for cancellation.`)
      return
    }
    if (!hasSupabaseConfig) {
      setStatusMessage('Cancel order approval requires online Supabase sync.')
      setEditApprovalRequest({
        requestId: null,
        orderId,
        action: 'cancel',
        status: 'error',
        message: 'Online admin confirmation is required. This POS cannot cancel an order by itself.',
      })
      return
    }
    setEditApprovalRequest({
      requestId: null,
      orderId,
      action: 'cancel',
      status: 'creating',
      message: 'Sending cancellation request to Admin Web...',
    })
    try {
      const request = await createOrderEditRequest({
        deviceOrderId: order.deviceOrderId,
        displayOrderId: order.id,
        deviceId,
        requestedBy: `${activeEmployeeName} · Cancel order`,
      })
      setStatusMessage(`Cancellation request sent for ${formatPosOrderRef(order.id)}. Waiting for Admin Web confirmation.`)
      setEditApprovalRequest({
        requestId: request.id,
        orderId,
        action: 'cancel',
        status: 'pending',
        message: 'Waiting for an admin to confirm cancellation. Keep this POS online.',
      })
    } catch (error) {
      const message = describeOrderEditRequestError(error)
      setStatusMessage(message)
      setEditApprovalRequest({ requestId: null, orderId, action: 'cancel', status: 'error', message })
    }
  }

  async function completeApprovedCancellation(orderId: string, approvedBy: string) {
    const order = orders.find((item) => item.id === orderId)
    if (!order) {
      setEditApprovalRequest(null)
      return
    }
    try {
      await voidOrder({
        deviceOrderId: order.deviceOrderId,
        voidReason: 'Cancelled from POS after admin confirmation',
        voidedBy: approvedBy,
      })
      setOrders((current) => current.filter((item) => item.id !== orderId))
      setSelectedOrderId(null)
      setStatusMessage(`${formatPosOrderRef(order.id)} cancelled with confirmation from ${approvedBy}.`)
      setEditApprovalRequest(null)
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Could not cancel the approved order.'
      setStatusMessage(message)
      setEditApprovalRequest({ requestId: null, orderId, action: 'cancel', status: 'error', message })
    }
  }

  function beginApprovedEditOrder(orderId: string, approvedBy: string) {
    const order = orders.find((item) => item.id === orderId)
    if (!order) {
      setStatusMessage(`${formatPosOrderRef(orderId)} could not be found for editing.`)
      setEditApprovalRequest(null)
      return
    }
    setAppendOrderId(null)
    setEditOrderId(order.id)
    setSelectedOrderId(order.id)
    setTicketItems(order.items.map(orderItemToTicketItem))
    setStatusMessage(`${approvedBy} approved edit access for ${formatPosOrderRef(order.id)}.`)
    setEditApprovalRequest(null)
    setActiveTab('new-order')
  }

  function closeEditApprovalRequest() {
    if (editApprovalRequest?.requestId && editApprovalRequest.status === 'pending') {
      void cancelOrderEditRequest(editApprovalRequest.requestId).catch(() => {})
    }
    setEditApprovalRequest(null)
  }

  function updateOrderItem(orderId: string, itemId: string, served: boolean) {
    const order = orders.find((item) => item.id === orderId)
    if (!order) return
    const items = order.items.map((item) => item.id === itemId ? { ...item, served } : item)
    const isServed = items.every((item) => item.served)
    const isPaid = isServed && order.paymentReceived >= orderTotal({ ...order, items })
    const updatedOrder: RestaurantOrder = {
      ...order,
      items,
      readyForPayment: isServed,
      status: isPaid ? 'paid' : isServed ? 'served' : 'preparing',
      paid: isPaid,
    }
    setOrders((current) => current.map((item) => item.id === orderId ? updatedOrder : item))
    void syncOrderSnapshot(updatedOrder, setStatusMessage)
    if (isPaid) window.setTimeout(closeCompletedOrders, 0)
  }

  function markAllServed(orderId: string) {
    const order = orders.find((item) => item.id === orderId)
    if (!order) return
    const isPaid = order.paymentReceived >= orderTotal(order)
    const updatedOrder: RestaurantOrder = {
      ...order,
      status: isPaid ? 'paid' : 'served',
      paid: isPaid,
      readyForPayment: true,
      items: order.items.map((item) => ({ ...item, served: true })),
    }
    setOrders((current) => current.map((item) => item.id === orderId ? updatedOrder : item))
    void syncOrderSnapshot(updatedOrder, setStatusMessage)
    setSelectedOrderId(orderId)
    setActiveTab(isPaid ? 'ongoing' : 'kitchen')
    window.setTimeout(closeCompletedOrders, 0)
  }

  function markPaid(orderId: string) {
    setSelectedOrderId(orderId)
    setPrepaidCheckoutOrderId(orderId)
    setActiveTab('kitchen')
  }

  function applyOrderPayment(orderId: string, payment: OrderPaymentInput) {
    let updatedOrder: RestaurantOrder | null = null
    setOrders((current) => current.map((order) => {
      if (order.id !== orderId) return order
      const totalDue = orderTotal(order)
      const nextReceived = Math.min(totalDue, roundCurrency(order.paymentReceived + payment.amount))
      const itemPayments = payment.itemPayments ?? {}
      const items = order.items.map((item) => {
        const paidUnits = itemPayments[item.id] ?? 0
        return paidUnits > 0
          ? { ...item, paidQuantity: Math.min(item.quantity, item.paidQuantity + paidUnits) }
          : item
      })
      updatedOrder = {
        ...order,
        items: nextReceived >= totalDue ? items.map((item) => ({ ...item, paidQuantity: item.quantity })) : items,
        status: nextReceived >= totalDue && order.readyForPayment ? 'paid' : order.status,
        paid: nextReceived >= totalDue && order.readyForPayment,
        paymentReceived: nextReceived,
        paymentMethod: payment.method,
        paymentReference: payment.reference,
        paymentNotes: nextReceived >= totalDue && !order.readyForPayment
          ? [order.paymentNotes, 'Customer prepaid'].filter(Boolean).join(' | ')
          : order.paymentNotes,
      }
      return updatedOrder
    }))
    const paymentOrder = updatedOrder as RestaurantOrder | null
    const isFullyCollected = Boolean(paymentOrder && paymentOrder.paymentReceived >= orderTotal(paymentOrder))
    setStatusMessage(`${formatPosOrderRef(orderId)} ${paymentOrder?.paid ? 'marked paid' : isFullyCollected ? 'marked prepaid' : 'payment recorded'}.`)
    if (paymentOrder && paymentOrder.paymentReceived >= orderTotal(paymentOrder)) setPrepaidCheckoutOrderId(null)
    if (paymentOrder && isFullyCollected && autoPrintReceipt) printOrderDocument(paymentOrder, 'customer-receipt', setStatusMessage, receiptCopies, receiptPrintSettings)
    if (paymentOrder) void syncOrderSnapshot(paymentOrder, setStatusMessage)
    if (paymentOrder) void syncPaymentSnapshot(paymentOrder, setStatusMessage, payment, activeShiftSession, activeEmployeeName)
    window.setTimeout(closeCompletedOrders, 0)
  }

  async function applyEmployeePayment(orderId: string, employee: PosEmployee) {
    const order = orders.find((item) => item.id === orderId)
    if (!order) return
    const localKey = 'admin-web-employee-consumption'
    let records: EmployeeConsumptionRecord[] = []
    try {
      const remote = await fetchAdminSetting('employee_consumption')
      const local = JSON.parse(window.localStorage.getItem(localKey) ?? '{"records":[]}') as { records?: EmployeeConsumptionRecord[] }
      records = Array.isArray(remote?.records) ? remote.records as EmployeeConsumptionRecord[] : (local.records ?? [])
    } catch { /* keep the new record even if old data cannot be loaded */ }
    records = [{
      id: `employee-consumption-${Date.now()}-${employee.id}`,
      employeeId: employee.id,
      employeeName: employee.name,
      orderId: order.deviceOrderId || order.id,
      displayOrderId: order.id,
      amount: orderBalance(order),
      recordedAt: new Date().toISOString(),
    }, ...records]
    window.localStorage.setItem(localKey, JSON.stringify({ records }))
    await saveAdminSetting('employee_consumption', { records })
    const updatedOrder: RestaurantOrder = {
      ...order,
      status: 'paid', paid: true, paymentReceived: orderTotal(order), paymentMethod: null,
      paymentReference: `EMPLOYEE:${employee.id}`,
      paymentNotes: `Employee payment - ${employee.name}`,
      items: order.items.map((item) => ({ ...item, paidQuantity: item.quantity })),
    }
    setOrders((current) => current.map((item) => item.id === orderId ? updatedOrder : item))
    setStatusMessage(`${formatPosOrderRef(orderId)} recorded as ${employee.name}'s staff consumption.`)
    await syncOrderSnapshot(updatedOrder, setStatusMessage)
    window.setTimeout(closeCompletedOrders, 0)
  }

  function closeCompletedOrders() {
    setOrders((current) => {
      const closing = current.filter((order) => order.paid && order.readyForPayment)
      if (closing.length > 0) {
        setHistory((existing) => [...closing, ...existing])
      }
      return current.filter((order) => !(order.paid && order.readyForPayment))
    })
  }

  async function refreshPosData() {
    if (refreshing) return
    setRefreshing(true)
    setStatusMessage('Refreshing POS data...')

    try {
      const [menu, syncedOrders] = await Promise.all([fetchPosMenu(), fetchOrders()])
      const mappedOrders = syncedOrders.map(mapAdminOrderToRestaurantOrder)
      const activeOrders = mappedOrders.filter((order) => !order.paid)

      setCategories(menu.categories)
      setProducts(menu.products)
      setOrders(activeOrders)
      setHistory(mappedOrders.filter((order) => order.paid))
      setStatusMessage(`POS refreshed. ${activeOrders.length} active order${activeOrders.length === 1 ? '' : 's'} loaded.`)
    } catch (error) {
      setStatusMessage(error instanceof Error ? `Refresh failed: ${error.message}` : 'Refresh failed. Please try again.')
    } finally {
      setRefreshing(false)
    }
  }

  return (
    <main className={`pos-shell is-${activeTab} ${primaryNavCollapsed ? 'is-nav-collapsed' : ''} ${activeTab === 'ongoing' || activeTab === 'kitchen' ? 'is-ongoing-screen' : ''}`}>
      <aside className="pos-sidebar">
        <button
          type="button"
          className="primary-nav-toggle"
          aria-label={primaryNavCollapsed ? 'Expand navigation' : 'Collapse navigation'}
          onClick={() => setPrimaryNavCollapsed((collapsed) => !collapsed)}
        >
          {primaryNavCollapsed ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
        </button>
        <div className="pos-sidebar-brand">
          <span className="pos-logo-mark"><ShoppingCart size={20} aria-hidden="true" /></span>
          <div>
            <span>OOH POS</span>
            <em className="pos-app-version">{posAppVersion}</em>
            <strong>{tabTitle(activeTab)}</strong>
            <small>{statusMessage}</small>
          </div>
        </div>
        <nav className="pos-section-nav" aria-label="POS sections">
          <PrimaryNavButton icon={<ShoppingCart size={22} strokeWidth={1.9} />} label="POS" subtitle="Create New Order" active={activeTab === 'new-order'} onClick={() => { setAppendOrderId(null); setEditOrderId(null); setTicketItems([]); setActiveTab('new-order') }} />
          <PrimaryNavButton icon={<Clock3 size={22} strokeWidth={1.9} />} label="Orders" subtitle="In Kitchen" count={ongoingOrders.length} active={activeTab === 'ongoing'} onClick={() => setActiveTab('ongoing')} />
          <PrimaryNavButton icon={<WalletCards size={22} strokeWidth={1.9} />} label="Pending Payment" subtitle="Awaiting Payment" count={finishOrders.length} active={activeTab === 'kitchen'} onClick={() => setActiveTab('kitchen')} />
          <PrimaryNavButton icon={<ChartNoAxesColumnIncreasing size={22} strokeWidth={1.9} />} label="Reports" subtitle="Sales & Analytics" active={activeTab === 'sale-tracker'} onClick={() => setActiveTab('sale-tracker')} />
        </nav>

        <div className="sidebar-status">
          <span className="online-dot">Online</span>
          <strong>{activeEmployeeName}</strong>
          <small>{activeEmployee ? `Cashier - ${formatPhp(activeEmployee.dailyRate)} / day` : 'Choose person on shift'}</small>
          {activeEmployee ? (
            <button type="button" disabled={shiftBusy} onClick={() => void clockOutEmployee()}><LogOut size={16} aria-hidden="true" /> Clock Out</button>
          ) : null}
          {!activeEmployee ? (
            <select
              className="sidebar-employee-select"
              value={activeEmployeeId}
              onChange={(event) => requestClockIn(event.target.value)}
              aria-label="Select cashier on shift"
            >
              <option value="">{shiftBusy ? 'Opening shift...' : 'Select cashier to clock in'}</option>
              {cashierEmployees.map((employee) => (
                <option key={employee.id} value={employee.id}>{employee.name}</option>
              ))}
            </select>
          ) : null}
          <span>{ongoingOrders.length} ongoing</span>
          <span>{completedThisShift} closed this shift</span>
          <span>{activeShiftSession ? `${activeShiftSession.shiftType === 'FIRST' ? 'First' : 'Second'} Shift • Cash ₱0 opening` : 'No open shift'}</span>
        </div>
      </aside>
      {pendingEmployeeId ? (
        <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setPendingEmployeeId('') }}>
          <section className="admin-approval-modal cashier-pin-modal" role="dialog" aria-modal="true" aria-labelledby="cashier-pin-title">
            <header><div><span>POS Login</span><h2 id="cashier-pin-title">Enter your PIN</h2></div><button type="button" className="modal-close" onClick={() => setPendingEmployeeId('')} aria-label="Close">×</button></header>
            <div className="admin-approval-body">
              <p>Logging in as <strong>{cashierEmployees.find((item) => item.id === pendingEmployeeId)?.name}</strong></p>
              <input autoFocus className="cashier-pin-input" type="password" inputMode="numeric" autoComplete="off" maxLength={6} value={loginPin} onChange={(event) => { setLoginPin(event.target.value.replace(/\D/g, '').slice(0, 6)); setPinError('') }} onKeyDown={(event) => { if (event.key === 'Enter' && loginPin.length >= 4) verifyPinAndClockIn() }} aria-label="Cashier PIN" placeholder="••••" />
              {pinError ? <p className="cashier-pin-error" role="alert">{pinError}</p> : <small>Your PIN is 4–6 digits.</small>}
            </div>
            <footer><button type="button" className="modal-secondary" onClick={() => setPendingEmployeeId('')}>Cancel</button><button type="button" className="modal-primary" disabled={loginPin.length < 4} onClick={verifyPinAndClockIn}>Log in</button></footer>
          </section>
        </div>
      ) : null}
      {activeTab === 'new-order' ? (
        <>
          <aside className="pos-category-sidebar" aria-label="POS categories">
            <nav className="category-tabs" aria-label="Categories">
              {[{ name: 'All Items', count: products.filter(isProductVisibleOnPos).length }, ...visibleCategories].map((category) => (
                <button
                  key={category.name}
                  type="button"
                  className={selectedCategory === category.name ? 'is-active' : ''}
                  onClick={() => setSelectedCategory(category.name)}
                >
                  <span className="category-tab-icon">{categoryIconLabel(category.name)}</span>
                  <strong>{category.name}</strong>
                  <em>{category.count}</em>
                </button>
              ))}
            </nav>
          </aside>
          <section className="menu-board">
            <header className="pos-order-header">
              <div className="left-header">
                <strong className="app-title">{posModeTitle}</strong>
                <span className="staff-subtitle">{posModeOrderNumber}</span>
              </div>
              <div className="center-header" aria-hidden="true" />
              <div className="right-header">
                <div className="order-type-toggle" aria-label="Order type">
                  <button type="button" className={`mode-button ${orderType === 'DINE IN' ? 'active is-active' : ''}`} onClick={() => setOrderType('DINE IN')}>
                    Dine In
                  </button>
                  <button type="button" className={`mode-button ${orderType === 'TAKE OUT' ? 'active is-active' : ''}`} onClick={() => setOrderType('TAKE OUT')}>
                    Takeout
                  </button>
                </div>
                <button
                  type="button"
                  className={`mode-button half-order-toggle ${halfOrderEnabled ? 'active is-active' : ''}`}
                  disabled={!visibleHalfOrderAvailable}
                  title={visibleHalfOrderAvailable ? 'Use half-order prices for supported items' : 'No visible products have half-order prices'}
                  onClick={() => setHalfOrderEnabled((enabled) => !enabled)}
                >
                  Half
                </button>
                <button
                  type="button"
                  className="header-icon-button"
                  aria-label="Refresh POS data"
                  title="Refresh POS data"
                  disabled={refreshing}
                  onClick={() => void refreshPosData()}
                >
                  <RefreshCw size={18} className={refreshing ? 'is-spinning' : undefined} aria-hidden="true" />
                </button>
                <button type="button" className="header-icon-button" aria-label="Settings" onClick={() => setActiveTab('settings')}><Settings size={18} aria-hidden="true" /></button>
              </div>
            </header>
            <div className="product-section-label">{selectedCategory}</div>
            <div className="product-grid">
              {visibleProducts.map((product) => (
                <button
                  key={product.id}
                  type="button"
                  className={`menu-card ${product.status === 'UNAVAILABLE' ? 'is-unavailable' : ''}`}
                  disabled={product.status === 'UNAVAILABLE'}
                  onClick={() => addProduct(product)}
                >
                  {product.imagePath ? <img src={product.imagePath} alt="" /> : <span className="menu-card-art">{initials(product.name)}</span>}
                  <strong>{product.name}</strong>
                  <span>{formatPhp(halfOrderEnabled ? resolveHalfOrderPrice(product) ?? product.price : product.price)}</span>
                  {product.status === 'UNAVAILABLE' ? <em>Unavailable</em> : null}
                  {halfOrderEnabled && product.halfOrderPrice == null ? <em>Auto half</em> : null}
                </button>
              ))}
            </div>
          </section>

          <OrderTicketPanel
            ticketItems={ticketItems}
            existingOrder={appendContextOrder}
            mode={editOrderId ? 'edit' : appendOrderId ? 'add' : 'new'}
            total={total}
            orderNumber={posModeOrderNumber}
            onChangeQuantity={changeTicketQuantity}
            onRemoveItem={removeTicketItem}
            onSaveOrder={() => {
              if (appendOrderId && !editOrderId) {
                void saveOrder('')
                return
              }
              setKitchenNoteTarget({
                orderNumber: editOrderId ?? appendOrderId ?? `#${String(nextOrderNumber).padStart(4, '0')}`,
                itemCount: ticketItems.reduce((sum, item) => sum + item.quantity, 0),
                appendToOrderId: appendOrderId ?? undefined,
                editOrderId: editOrderId ?? undefined,
              })
            }}
            onClear={() => { setTicketItems([]); setAppendOrderId(null); setEditOrderId(null) }}
          />
        </>
      ) : null}

      {activeTab === 'kitchen' ? (
        <section className="pos-workspace">
          <FinishOrdersBoard
            orders={finishOrders}
            selectedOrder={selectedFinishOrder}
            onSelectOrder={setSelectedOrderId}
            onToggleItem={updateOrderItem}
            onMarkAllServed={markAllServed}
            onGoToPayment={markPaid}
            onApplyPayment={applyOrderPayment}
            employees={employees.filter((employee) => employee.isActive)}
            onApplyEmployeePayment={applyEmployeePayment}
            onEditNotes={editOrderNotes}
            onViewDetails={(orderId) => setStatusMessage(`${orderId} details selected.`)}
            onAddOrder={startAddOrder}
            onQuickAddRice={quickAddRice}
            autoOpenPaymentOrderId={prepaidCheckoutOrderId}
            onPaymentDismiss={() => {
              setPrepaidCheckoutOrderId(null)
              setActiveTab('ongoing')
            }}
          />
        </section>
      ) : null}

      {activeTab === 'ongoing' ? (
        <section className="pos-workspace">
          <OngoingOrdersBoard
            orders={ongoingOrders}
            selectedOrder={selectedOrder}
            kitchenCategorySettings={menuCategoriesEnabled}
            categoryByProductId={categoryByProductId}
            onSelectOrder={setSelectedOrderId}
            onToggleItem={updateOrderItem}
            onMarkAllServed={markAllServed}
            onGoToPayment={markPaid}
            onViewDetails={requestEditOrder}
            onAddOrder={startAddOrder}
            onQuickAddRice={quickAddRice}
            onCustomerPrepaid={markPaid}
            onCancelOrder={requestCancelOrder}
            onReprintOrder={reprintKitchenTicket}
            onEditNotes={editOrderNotes}
          />
        </section>
      ) : null}

      <section className="pos-workspace" hidden={activeTab !== 'sale-tracker'}>
        <SaleTrackerPage
          deviceId={deviceId}
          staffName={activeEmployeeName}
          shiftSession={activeShiftSession}
          orderType={orderType}
          halfOrderEnabled={halfOrderEnabled}
          onOrderTypeChange={setOrderType}
          onHalfOrderToggle={() => setHalfOrderEnabled((enabled) => !enabled)}
        />
      </section>
      {!activeShiftSession ? <div className="shift-lock-overlay"><section><Clock3 size={38} /><h2>Clock in to start</h2><p>Select the cashier in the sidebar. Orders and financial entries are locked until a shift is open.</p></section></div> : null}

      {activeTab === 'settings' ? (
        <section className="pos-workspace">
          <SettingsPage
            history={shiftHistory}
            products={products}
            categories={visibleCategories.map((category) => category.name)}
            menuCategoriesEnabled={menuCategoriesEnabled}
            deviceId={deviceId}
            autoPrintReceipt={autoPrintReceipt}
            receiptCopies={receiptCopies}
            receiptPrintSettings={receiptPrintSettings}
            onAutoPrintReceiptChange={setAutoPrintReceipt}
            onReceiptCopiesChange={setReceiptCopies}
            onReceiptPrintSettingsChange={setReceiptPrintSettings}
            onProductStatusChange={changeMenuProductAvailability}
            onToggleMenuCategory={(category) => setMenuCategoriesEnabled((current) => ({
              ...current,
              [category]: !isKitchenCategoryEnabled(current, category),
            }))}
          />
        </section>
      ) : null}

      {kitchenNoteTarget ? (
        <SendToKitchenModal
          target={kitchenNoteTarget}
          occupiedTables={buildOccupiedTableMap(orders, kitchenNoteTarget.editOrderId ?? kitchenNoteTarget.appendToOrderId)}
          onCancel={() => setKitchenNoteTarget(null)}
          onSend={(note) => {
            if (kitchenNoteTarget.noteOrderId) void saveOrderNotes(kitchenNoteTarget.noteOrderId, note)
            else void saveOrder(note)
          }}
        />
      ) : null}
      {editApprovalRequest ? (
        <AdminApprovalModal
          orderId={editApprovalRequest.orderId}
          action={editApprovalRequest.action}
          status={editApprovalRequest.status}
          message={editApprovalRequest.message}
          onCancel={closeEditApprovalRequest}
        />
      ) : null}
    </main>
  )
}

function PrimaryNavButton({
  icon,
  label,
  subtitle,
  count,
  active,
  onClick,
}: {
  icon: ReactNode
  label: string
  subtitle: string
  count?: number
  active: boolean
  onClick: () => void
}) {
  return (
    <button type="button" className={active ? 'is-active' : ''} onClick={onClick} title={`${label} - ${subtitle}`}>
      <span className="primary-nav-icon">{icon}</span>
      <span className="primary-nav-copy">
        <strong>{label}</strong>
        <small>{subtitle}</small>
      </span>
      {typeof count === 'number' ? <em>{count}</em> : null}
    </button>
  )
}

type OrderTicketPanelProps = {
  ticketItems: TicketItem[]
  existingOrder: RestaurantOrder | null
  mode: 'new' | 'add' | 'edit'
  total: number
  orderNumber: string
  onChangeQuantity: (lineId: string, delta: number) => void
  onRemoveItem: (lineId: string) => void
  onSaveOrder: () => void
  onClear: () => void
}

const kitchenTableTags = ['Table 1', 'Table 2', 'Table 3', 'Table 4', 'Table 5', 'Table 6']
const kitchenColorTags = [
  { label: 'Red', className: 'is-red' },
  { label: 'Blue', className: 'is-blue' },
  { label: 'Green', className: 'is-green' },
  { label: 'Yellow', className: 'is-yellow' },
  { label: 'Black', className: 'is-black' },
  { label: 'White', className: 'is-white' },
]
const kitchenIdentifierTags = ['Glasses']

function SendToKitchenModal({
  target,
  occupiedTables,
  onCancel,
  onSend,
}: {
  target: KitchenNoteTarget
  occupiedTables: Record<string, 'Preparing' | 'Pending Payment'>
  onCancel: () => void
  onSend: (note: string) => void
}) {
  const initial = parsePreparedOrderNote(target.initialNote ?? '')
  const [selectedTable, setSelectedTable] = useState(initial.table)
  const [selectedColor, setSelectedColor] = useState(initial.color)
  const [selectedIdentifier, setSelectedIdentifier] = useState(initial.identifier)
  const [customNote, setCustomNote] = useState(initial.customerNote)
  const [kitchenNote, setKitchenNote] = useState(initial.kitchenNote)
  const customNoteValue = customNote.trim()
  const kitchenNoteValue = kitchenNote.trim()
  const selectedNotes = [selectedTable, selectedColor ? `${selectedColor} shirt` : '', selectedIdentifier].filter(Boolean)
  const customerNote = [...selectedNotes, customNoteValue].filter(Boolean).join(' - ')
  const note = [
    customerNote ? `Customer: ${customerNote}` : '',
    kitchenNoteValue ? `Kitchen: ${kitchenNoteValue}` : '',
  ].filter(Boolean).join(' | ')
  const canSend = Boolean(target.noteOrderId) || selectedNotes.length > 0 || customNoteValue.length > 0 || kitchenNoteValue.length > 0
  const selectedTableStatus = selectedTable ? occupiedTables[selectedTable] : undefined

  return (
    <div className="modal-backdrop kitchen-note-backdrop" role="presentation">
      <section className="kitchen-note-modal" role="dialog" aria-modal="true" aria-labelledby="send-kitchen-title">
        <header>
          <div className="kitchen-note-title">
            <span className="kitchen-note-icon"><Utensils size={22} strokeWidth={1.8} aria-hidden="true" /></span>
            <div>
              <h2 id="send-kitchen-title">Prepare Order</h2>
              <span>Order {formatPosOrderRef(target.orderNumber)} - {target.itemCount} items</span>
            </div>
          </div>
          <button type="button" className="modal-close kitchen-note-close" onClick={onCancel} aria-label="Close Prepare Order modal">
            <X size={18} strokeWidth={1.8} aria-hidden="true" />
          </button>
        </header>

        <div className="kitchen-note-body">
          <div className="kitchen-note-warning">
            <CircleAlert className="send-kitchen-modal__warning-icon" size={16} strokeWidth={1.8} aria-hidden="true" />
            <p>{selectedTableStatus
              ? `${selectedTable} already has an order under ${selectedTableStatus}. You may continue, but confirm this is the correct table.`
              : 'Select a quick note or add a customer or kitchen note before preparing the order.'}</p>
          </div>

          <div className="kitchen-note-section">
            <strong className="send-kitchen-modal__section-label">
              <MapPin className="send-kitchen-modal__section-icon" size={16} strokeWidth={1.8} aria-hidden="true" />
              <span>Table <em>(Location)</em></span>
            </strong>
            <div className="kitchen-option-grid table-grid" aria-label="Table location">
              {kitchenTableTags.map((tag) => {
                const occupiedStatus = occupiedTables[tag]
                return (
                  <button
                    key={tag}
                    type="button"
                    className={`${selectedTable === tag ? 'is-selected' : ''} ${occupiedStatus ? 'is-occupied' : ''}`}
                    onClick={() => setSelectedTable((current) => current === tag ? '' : tag)}
                    aria-label={`${tag}${occupiedStatus ? `, occupied, ${occupiedStatus}` : ', available'}`}
                  >
                    <TableIcon className="send-kitchen-modal__option-icon" size={22} strokeWidth={1.8} aria-hidden="true" />
                    <span>{tag}</span>
                    {occupiedStatus ? <small>{occupiedStatus}</small> : null}
                  </button>
                )
              })}
            </div>
          </div>

          <div className="kitchen-note-section">
            <strong className="send-kitchen-modal__section-label">
              <Shirt className="send-kitchen-modal__section-icon" size={16} strokeWidth={1.8} aria-hidden="true" />
              <span>Customer Clothes <em>(Color)</em></span>
            </strong>
            <div className="kitchen-option-grid color-grid" aria-label="Customer clothes color">
              {kitchenColorTags.map((tag) => (
                <button
                  key={tag.label}
                  type="button"
                  className={`${selectedColor === tag.label ? 'is-selected' : ''} ${tag.className}`}
                  onClick={() => setSelectedColor((current) => current === tag.label ? '' : tag.label)}
                >
                  <Shirt className="send-kitchen-modal__option-icon send-kitchen-modal__shirt-icon" size={22} strokeWidth={1.8} aria-hidden="true" />
                  <span>{tag.label}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="kitchen-note-section">
            <strong className="send-kitchen-modal__section-label">
              <Eye className="send-kitchen-modal__section-icon" size={16} strokeWidth={1.8} aria-hidden="true" />
              <span>Other Identifiers</span>
            </strong>
            <div className="kitchen-option-grid identifier-grid" aria-label="Other identifiers">
              {kitchenIdentifierTags.map((tag) => (
                <button
                  key={tag}
                  type="button"
                  className={selectedIdentifier === tag ? 'is-selected' : ''}
                  onClick={() => setSelectedIdentifier((current) => current === tag ? '' : tag)}
                >
                  <Glasses className="send-kitchen-modal__option-icon" size={22} strokeWidth={1.8} aria-hidden="true" />
                  <span>{tag}</span>
                </button>
              ))}
            </div>
          </div>

          <label className="kitchen-note-field">
            <span className="send-kitchen-modal__field-label">
              <User className="send-kitchen-modal__section-icon" size={16} strokeWidth={1.8} aria-hidden="true" />
              <span>Customer Note <em>(Optional)</em></span>
            </span>
            <input
              maxLength={100}
              value={customNote}
              onChange={(event) => setCustomNote(event.target.value)}
              placeholder="Type additional note about the customer..."
            />
            <small>{customNote.length} / 100</small>
          </label>

          <label className="kitchen-note-field kitchen-note-prep-field">
            <span className="send-kitchen-modal__field-label">
              <ChefHat className="send-kitchen-modal__section-icon" size={16} strokeWidth={1.8} aria-hidden="true" />
              <span>Kitchen Notes <em>(Optional)</em></span>
            </span>
            <input
              maxLength={120}
              value={kitchenNote}
              onChange={(event) => setKitchenNote(event.target.value)}
              placeholder="e.g. no onions, extra sabaw, separate sauce..."
            />
            <small>{kitchenNote.length} / 120</small>
          </label>
        </div>

        <footer>
          <button type="button" className="modal-secondary" onClick={onCancel}>Cancel</button>
          <button type="button" className="modal-primary" disabled={!canSend} onClick={() => onSend(note)}>
            <Utensils className="send-kitchen-modal__footer-icon" size={18} strokeWidth={1.8} aria-hidden="true" />
            {target.noteOrderId ? 'Save Notes' : 'Prepare Order'}
          </button>
        </footer>
      </section>
    </div>
  )
}

function AdminApprovalModal({
  orderId,
  action,
  status,
  message,
  onCancel,
}: {
  orderId: string
  action: EditApprovalRequest['action']
  status: EditApprovalRequest['status']
  message: string
  onCancel: () => void
}) {
  const isPending = status === 'creating' || status === 'pending'
  return (
    <div className="modal-backdrop" role="presentation">
      <section className="admin-approval-modal" role="dialog" aria-modal="true" aria-labelledby="admin-approval-title">
        <header>
          <div>
            <span>Admin Access</span>
            <h2 id="admin-approval-title">{action === 'cancel' ? 'Cancel Order Request' : 'Edit Request Pending'}</h2>
          </div>
          <button type="button" className="modal-close" onClick={onCancel} aria-label="Close">x</button>
        </header>
        <div className="admin-approval-body">
          <strong>{formatPosOrderRef(orderId)}</strong>
          <p>{action === 'cancel'
            ? 'Cancelling removes this order from active sales. An admin must confirm the request from Admin Web.'
            : 'Editing an existing order can change kitchen and payment records. Approval must come from Admin Web while both apps are online.'}</p>
          <div className="admin-approval-card">
            <span>{isPending ? 'Waiting for admin confirmation' : 'Request not sent'}</span>
            <small>{message}</small>
          </div>
        </div>
        <footer>
          <button type="button" className="modal-secondary" onClick={onCancel}>
            {isPending ? 'Cancel Request' : 'Close'}
          </button>
        </footer>
      </section>
    </div>
  )
}

export function PaymentModal({
  target,
  order,
  onClose,
  onConfirm,
}: {
  target: CheckoutTarget
  order: RestaurantOrder | null
  onClose: () => void
  onConfirm: (target: CheckoutTarget, payment: OrderPaymentInput) => void
}) {
  const [method, setMethod] = useState<PaymentMethod>('cash')
  const [cashReceived, setCashReceived] = useState('')
  const [gcashReference, setGcashReference] = useState('')
  const items = order?.items ?? []
  const subtotal = items.reduce((sum, item) => sum + item.price * item.quantity, 0)
  const tax = subtotal * taxRate
  const total = subtotal + tax
  const balance = order ? orderBalance(order) : total
  const cashValue = Number(cashReceived) || 0
  const change = method === 'cash' ? Math.max(0, cashValue - balance) : 0
  const canConfirm = items.length > 0
    && balance > 0
    && (method !== 'cash' || cashValue >= balance)
    && (method !== 'gcash' || gcashReference.trim().length === 6)

  function setMethodAndDefaults(nextMethod: PaymentMethod) {
    setMethod(nextMethod)
    if (nextMethod === 'gcash') {
      setCashReceived('')
    }
  }

  function updateActiveAmount(value: string) {
    setCashReceived(normalizeAmountInput(value))
  }

  function appendReference(value: string) {
    setGcashReference((current) => `${current}${value}`.replace(/\D/g, '').slice(0, 6))
  }

  function backspaceReference() {
    setGcashReference((current) => current.slice(0, -1))
  }

  function appendAmount(value: string) {
    if (method === 'gcash') return
    const current = cashReceived || ''
    if (value === '.' && current.includes('.')) return
    updateActiveAmount(current === '0' && value !== '.' ? value : `${current}${value}`)
  }

  function backspaceAmount() {
    if (method === 'gcash') return
    updateActiveAmount((cashReceived || '').slice(0, -1))
  }

  return (
    <div className="modal-backdrop" role="presentation">
      <section className="payment-modal" role="dialog" aria-modal="true" aria-labelledby="payment-title">
        <section className="checkout-summary-panel">
          <header>
            <h2 id="payment-title">Order Summary</h2>
            <span>{items.length} {items.length === 1 ? 'item' : 'items'}</span>
          </header>
          <div className="checkout-summary-items">
            {items.map((item) => (
              <article key={item.id}>
                <div>
                  <strong>{item.name}</strong>
                  <small className={item.paidQuantity > 0 ? 'item-payment-note' : undefined}>
                    {item.paidQuantity >= item.quantity
                      ? `Paid x${item.quantity}`
                      : item.paidQuantity > 0
                        ? `Paid x${item.paidQuantity} · Unpaid x${item.quantity - item.paidQuantity}`
                        : 'Unpaid'}
                  </small>
                </div>
                <div>
                  <strong>{formatPhp(item.price * item.quantity)}</strong>
                  <small>x{item.quantity}</small>
                </div>
              </article>
            ))}
          </div>
          <section className="checkout-totals">
            <div><span>Order total</span><strong>{formatPhp(total)}</strong></div>
            {order && order.paymentReceived > 0 ? <div><span>Previously paid</span><strong>{formatPhp(Math.min(total, order.paymentReceived))}</strong></div> : null}
            <div className="checkout-total"><span>Amount due</span><strong>{formatPhp(balance)}</strong></div>
          </section>
        </section>

        <section className="checkout-payment-panel">
          <header>
            <div>
              <p className="eyebrow">▣ &nbsp; Checkout&nbsp; • &nbsp;Full payment</p>
              <h2>Payment {formatPosOrderRef(target.orderId)}</h2>
            </div>
            <div className="checkout-header-actions">
              <div className="payment-methods" aria-label="Payment method">
                <button type="button" className={method === 'cash' ? 'is-active' : ''} onClick={() => setMethodAndDefaults('cash')}><Banknote size={19} /><span>Cash</span></button>
                <button type="button" className={method === 'gcash' ? 'is-active' : ''} onClick={() => setMethodAndDefaults('gcash')}><span className="gcash-mark">G</span><span>GCash</span></button>
              </div>
              <button type="button" className="modal-close checkout-close" onClick={onClose}><X size={22} /><span>Close</span></button>
            </div>
          </header>

          <div className="payment-body">
            {method === 'cash' ? (
              <div className="amount-change-row">
                <label className="payment-field amount-tendered">
                  <span>Amount Tendered</span>
                  <input
                    type="text"
                    inputMode="decimal"
                    value={cashReceived}
                    onChange={(event) => updateActiveAmount(event.target.value)}
                  />
                </label>
                <section className="change-box">
                  <span>Change</span>
                  <strong>{formatPhp(change)}</strong>
                </section>
              </div>
            ) : (
              <label className="payment-field gcash-reference-field">
                <span>Last 6 digits of GCash number</span>
                <input
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  maxLength={6}
                  value={gcashReference}
                  onChange={(event) => setGcashReference(event.target.value.replace(/\D/g, '').slice(0, 6))}
                  placeholder="—  —  —  —  —  —"
                  aria-label="Last 6 digits of GCash number"
                />
              </label>
            )}

            <div className="checkout-keypad">
              {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((key) => (
                <button key={key} type="button" onClick={() => method === 'gcash' ? appendReference(key) : appendAmount(key)}>{key}</button>
              ))}
              <button type="button" onClick={() => method === 'gcash' ? appendReference('0') : appendAmount('0')}>0</button>
              <button type="button" className="keypad-action" onClick={() => method === 'gcash' ? backspaceReference() : backspaceAmount()}>⌫ <span>Back</span></button>
              <button type="button" className="keypad-action keypad-clear" onClick={() => method === 'gcash' ? setGcashReference('') : updateActiveAmount('')}><Trash2 size={24} /><span>Clear</span></button>
            </div>

            <button type="button" className="modal-primary process-payment-button" disabled={!canConfirm} onClick={() => onConfirm(target, {
              method,
              amount: balance,
              reference: method === 'gcash' ? gcashReference : '',
              notes: '',
              cashAmount: method === 'cash' ? cashValue : undefined,
              gcashAmount: method === 'gcash' ? balance : undefined,
            })}>
              <Check size={24} />
              <strong>Confirm payment {formatPhp(balance)}</strong>
            </button>
          </div>
        </section>
      </section>
    </div>
  )
}

function OrderTicketPanel({
  ticketItems,
  existingOrder,
  mode,
  total,
  orderNumber,
  onChangeQuantity,
  onRemoveItem,
  onSaveOrder,
  onClear,
}: OrderTicketPanelProps) {
  const emptyMessage = mode === 'add'
    ? 'Tap menu items to add to this order.'
    : mode === 'edit'
      ? 'No items in this order.'
      : 'Tap menu items to build an order.'
  return (
    <aside className="order-ticket">
      <header className="ticket-header">
        <div>
          <p className="eyebrow">Order {orderNumber}</p>
          <h2>{ticketItems.length} items</h2>
        </div>
        <button type="button" className="clear-small" disabled={ticketItems.length === 0} onClick={onClear}>Clear Order</button>
      </header>

      <div className="ticket-items">
        {existingOrder && mode === 'add' ? (
          <section className="existing-order-preview" aria-label="Already ordered items">
            <div>
              <strong>Already Ordered</strong>
              <span>{existingOrder.items.length} items</span>
            </div>
            {existingOrder.items.map((item) => (
              <article key={item.id}>
                <span>{item.quantity}</span>
                <div>
                  <strong>{item.name}</strong>
                  <small>{item.isHalfOrder ? 'Half Order - ' : ''}{formatOrderType(item.orderType)}</small>
                </div>
                <strong>{formatPhp(item.price * item.quantity)}</strong>
              </article>
            ))}
          </section>
        ) : null}
        {ticketItems.length === 0 ? (
          <p className="empty-ticket">{emptyMessage}</p>
        ) : (
          <>
            {mode === 'add' ? <p className="ticket-section-label">New Items</p> : null}
            {ticketItems.map((item) => (
              <article key={item.lineId} className="ticket-item">
                <div className="ticket-item-main">
                  <strong>{item.name}</strong>
                  <small className={item.orderType === 'DINE IN' ? 'mode-dine-in' : 'mode-takeout'}>{formatOrderType(item.orderType)}</small>
                  {item.isHalfOrder ? <small className="half-order-stamp">Half Order</small> : null}
                </div>
                <div className="qty-row" aria-label={`${item.name} quantity`}>
                  <span>Qty</span>
                  <button type="button" onClick={() => onChangeQuantity(item.lineId, -1)}>-</button>
                  <strong>{item.quantity}</strong>
                  <button type="button" onClick={() => onChangeQuantity(item.lineId, 1)}>+</button>
                </div>
                <strong className="line-total">{formatPhp(item.price * item.quantity)}</strong>
                <button type="button" className="trash-button" aria-label={`Remove ${item.name}`} onClick={() => onRemoveItem(item.lineId)}>x</button>
              </article>
            ))}
          </>
        )}
        {ticketItems.length > 0 ? <button type="button" className="add-item-note-button">+ Add Item Note</button> : null}
      </div>

      <section className="order-summary">
        <div className="summary-total"><span>Total</span><strong>{formatPhp(total)}</strong></div>
      </section>

      <section className="ticket-status-stack">
        <article>
          <div>
            <span className="ticket-status-icon"><Utensils size={18} aria-hidden="true" /></span>
            <div>
              <strong>Not Prepared</strong>
              <small>Order has not been prepared yet</small>
            </div>
          </div>
          <button type="button" disabled={ticketItems.length === 0} onClick={onSaveOrder}>Prepare Order</button>
        </article>
      </section>
    </aside>
  )
}

type KitchenOrdersPageProps = {
  orders: RestaurantOrder[]
  onToggleItem: (orderId: string, itemId: string, served: boolean) => void
  onStatusChange: (orderId: string, status: OrderStatus) => void
}

export function KitchenOrdersPage({ orders, onToggleItem, onStatusChange }: KitchenOrdersPageProps) {
  return (
    <section className="tracking-page">
      <PageHeader title="Kitchen Orders" subtitle="Item-level prep and served tracking for the kitchen line." />
      <div className="order-card-grid">
        {orders.length === 0 ? <EmptyState text="No kitchen orders yet." /> : null}
        {orders.map((order) => (
          <article key={order.id} className={`order-card status-${order.status}`}>
            <OrderCardHeader order={order} />
            <ItemChecklist order={order} onToggleItem={onToggleItem} />
            <div className="status-actions">
              <button type="button" className={order.status === 'preparing' ? 'is-active' : ''} onClick={() => onStatusChange(order.id, 'preparing')}>Preparing</button>
              <button type="button" className={order.status === 'served' ? 'is-active' : ''} onClick={() => onStatusChange(order.id, 'served')}>Served</button>
              <button type="button" className={order.status === 'paid' ? 'is-active' : ''} onClick={() => onStatusChange(order.id, 'paid')}>Paid</button>
            </div>
          </article>
        ))}
      </div>
    </section>
  )
}

type OngoingOrdersPageProps = {
  orders: RestaurantOrder[]
  selectedOrder: RestaurantOrder | null
  kitchenCategorySettings?: Record<string, boolean>
  categoryByProductId?: Map<string, string>
  onSelectOrder: (orderId: string) => void
  onToggleItem: (orderId: string, itemId: string, served: boolean) => void
  onMarkAllServed: (orderId: string) => void
  onViewDetails: (orderId: string) => void
  onGoToPayment: (orderId: string) => void
  onAddOrder?: (orderId: string) => void
  onQuickAddRice?: (orderId: string) => void
  onCustomerPrepaid?: (orderId: string) => void
  onCancelOrder?: (orderId: string) => void
  onReprintOrder?: (orderId: string) => void
  onApplyPayment?: (orderId: string, payment: OrderPaymentInput) => void
  onEditNotes?: (orderId: string) => void
}

type OrderPaymentInput = {
  method: PaymentMethod
  amount: number
  reference: string
  notes: string
  cashAmount?: number
  gcashAmount?: number
  itemPayments?: Record<string, number>
}

function OngoingOrdersBoard({
  orders,
  selectedOrder,
  kitchenCategorySettings = {},
  categoryByProductId = new Map(),
  onSelectOrder,
  onToggleItem,
  onMarkAllServed,
  onViewDetails,
  onAddOrder,
  onQuickAddRice,
  onCustomerPrepaid,
  onCancelOrder,
  onReprintOrder,
  onEditNotes,
}: OngoingOrdersPageProps) {
  const [sort, setSort] = useState<OrderSort>('oldest')
  const [viewMode, setViewMode] = useState<'tiles' | 'list'>('tiles')
  const filteredOrders = useMemo(() => {
    return [...orders].sort((left, right) => sort === 'oldest' ? left.createdAt - right.createdAt : right.createdAt - left.createdAt)
  }, [orders, sort])

  return (
    <section className="ongoing-dashboard">
      <section className="ongoing-main">
        <div className="ongoing-toolbar">
          <div className="filter-block">
            <p className="eyebrow">Ongoing Orders</p>
          </div>
          <div className="sort-control">
            <span>Sort by:</span>
            <button type="button" className="sort-select" onClick={() => setSort(sort === 'oldest' ? 'newest' : 'oldest')}>
              {sort === 'oldest' ? 'Oldest First' : 'Newest First'} v
            </button>
            <button type="button" className={`grid-mode ${viewMode === 'tiles' ? 'is-active' : ''}`} aria-label="Tile view" onClick={() => setViewMode('tiles')}><LayoutGrid size={16} /> Tiles</button>
            <button type="button" className={`grid-mode ${viewMode === 'list' ? 'is-active' : ''}`} aria-label="List view" onClick={() => setViewMode('list')}><List size={16} /> List</button>
          </div>
        </div>

        <div className={`ongoing-grid ${viewMode === 'list' ? 'is-list-view' : ''}`}>
          {filteredOrders.length === 0 ? <EmptyState text="No ongoing orders match this filter." /> : null}
          {filteredOrders.map((order) => (
            <OngoingTrackingCard
              key={order.id}
              order={order}
              kitchenCategorySettings={kitchenCategorySettings}
              categoryByProductId={categoryByProductId}
              selected={selectedOrder?.id === order.id}
              onSelect={() => onSelectOrder(order.id)}
            />
          ))}
        </div>
        <p className="showing-count">Showing {filteredOrders.length} of {orders.length} ongoing orders</p>
      </section>

      <OngoingTrackingDetailPanel
        order={selectedOrder}
        onToggleItem={onToggleItem}
        onMarkAllServed={onMarkAllServed}
        onViewDetails={onViewDetails}
        onAddOrder={onAddOrder}
        onQuickAddRice={onQuickAddRice}
        onCustomerPrepaid={onCustomerPrepaid}
        onCancelOrder={onCancelOrder}
        onReprintOrder={onReprintOrder}
        onEditNotes={onEditNotes}
      />
    </section>
  )
}

function OngoingTrackingCard({
  order,
  kitchenCategorySettings,
  categoryByProductId,
  selected,
  onSelect,
}: {
  order: RestaurantOrder
  kitchenCategorySettings: Record<string, boolean>
  categoryByProductId: Map<string, string>
  selected: boolean
  onSelect: () => void
}) {
  const ready = allItemsServed(order)
  const kitchenItems = kitchenPrintableItems(order.items, kitchenCategorySettings, categoryByProductId)
  const hasUnprintedKitchenItems = kitchenItems.some((item) => item.kitchenPrintedQuantity < item.quantity)
  return (
    <article className={`mini-order-card ${selected ? 'is-selected' : ''} ${ready ? 'is-ready' : ''}`} onClick={onSelect}>
      <span className="order-card-icon"><Utensils size={24} aria-hidden="true" /></span>
      <div className="order-card-copy">
        <header>
          <div>
            <strong>{formatPosOrderRef(order.id)}</strong>
            <span>{order.items.length} items • Table {tableNumber(order.id)}</span>
          </div>
          <time>{formatOrderTime(order.createdAt)}</time>
        </header>
        <div className="mini-subhead">
          <span>{formatOrderType(order.orderType)}</span>
          <span className={`status-pill status-${order.status}`}>{statusLabel(order.status)}</span>
          {paymentStatus(order) === 'paid' && !order.paid ? <span className="status-pill payment-paid">PREPAID</span> : null}
          {hasUnprintedKitchenItems ? <span className="print-status-pill is-not-printed">NOT PRINTED</span> : null}
        </div>
        <footer>
          <span>{minutesAgo(order.createdAt)} mins ago</span>
          <strong className="ongoing-card-price">{formatPhp(orderTotal(order))}</strong>
          <span className="order-card-chevron"><ChevronRight size={18} aria-hidden="true" /></span>
        </footer>
      </div>
    </article>
  )
}

function OngoingTrackingDetailPanel({
  order,
  onToggleItem,
  onMarkAllServed,
  onViewDetails,
  onAddOrder,
  onQuickAddRice,
  onCustomerPrepaid,
  onCancelOrder,
  onReprintOrder,
  onEditNotes,
}: {
  order: RestaurantOrder | null
  onToggleItem: (orderId: string, itemId: string, served: boolean) => void
  onMarkAllServed: (orderId: string) => void
  onViewDetails: (orderId: string) => void
  onAddOrder?: (orderId: string) => void
  onQuickAddRice?: (orderId: string) => void
  onCustomerPrepaid?: (orderId: string) => void
  onCancelOrder?: (orderId: string) => void
  onReprintOrder?: (orderId: string) => void
  onEditNotes?: (orderId: string) => void
}) {
  const [confirmingReprint, setConfirmingReprint] = useState(false)

  useEffect(() => {
    setConfirmingReprint(false)
  }, [order?.id])

  if (!order) {
    return (
      <aside className="order-detail-panel">
        <EmptyState text="Select an order to view details." />
      </aside>
    )
  }
  const allReady = allItemsServed(order)
  return (
    <aside className="order-detail-panel">
      <header>
        <div>
          <p className="detail-title">Order {formatPosOrderRef(order.id)}</p>
          <span className="detail-order-subtitle">New Order</span>
          <span>Table {tableNumber(order.id)} - {formatOrderType(order.orderType)}</span>
          <span className={`status-pill status-${order.status}`}>{statusLabel(order.status)}</span>
          {paymentStatus(order) === 'paid' && !order.paid ? <span className="status-pill payment-paid">PREPAID</span> : null}
        </div>
        <div className="detail-time">
          <time>{formatOrderTime(order.createdAt)}</time>
          <span>{minutesAgo(order.createdAt)} mins ago</span>
        </div>
      </header>
      <section>
        <div className="detail-section-head">
          <strong>Order Items</strong>
          <span>{order.items.length} items</span>
        </div>
        <div className="detail-items">
          {order.items.map((item) => (
            <label key={item.id}>
              <input checked={item.served} type="checkbox" onChange={(event) => onToggleItem(order.id, item.id, event.target.checked)} />
              <span>{item.quantity}</span>
              <div>
                <strong>{item.name}</strong>
                <small>{item.isHalfOrder ? 'Half Order - ' : ''}{itemCategory(item.name)} - {formatOrderType(item.orderType)}</small>
              </div>
              <em>{formatPhp(item.price * item.quantity)}</em>
            </label>
          ))}
        </div>
      </section>
      <section>
        <strong>Notes</strong>
        <button type="button" className="notes-box notes-box-button" onClick={() => onEditNotes?.(order.id)} aria-label={`Edit notes for ${formatPosOrderRef(order.id)}`}>
          <span>{order.paymentNotes || 'No special instructions'}</span><Pencil size={15} aria-hidden="true" />
        </button>
      </section>
      <section className="detail-actions">
        <button type="button" className="send-kitchen" onClick={() => onMarkAllServed(order.id)}>
          <CircleCheckBig size={16} /> {allReady ? 'Mark as Served' : 'Mark All Ready'}
        </button>
        <button type="button" onClick={() => onAddOrder?.(order.id)}><Plus size={16} /> Add Order</button>
        <button type="button" onClick={() => onQuickAddRice?.(order.id)}><Plus size={16} /> Extra Rice</button>
        {paymentStatus(order) === 'paid' ? (
          <button type="button" disabled><CircleCheckBig size={16} /> Prepay</button>
        ) : (
          <button type="button" onClick={() => onCustomerPrepaid?.(order.id)}><WalletCards size={16} /> Prepay</button>
        )}
        <button type="button" className="edit-order-action" onClick={() => onViewDetails(order.id)}><Pencil size={16} /> Edit Order</button>
        <button type="button" onClick={() => setConfirmingReprint(true)}><RefreshCw size={16} /> Reprint</button>
        <button type="button" className="cancel-order-action" onClick={() => onCancelOrder?.(order.id)}><X size={16} /> Cancel Order</button>
      </section>
      {confirmingReprint ? (
        <div className="modal-backdrop" role="presentation">
          <section className="expense-modal" role="dialog" aria-modal="true" aria-labelledby="reprint-confirm-title">
            <header>
              <div><span>Kitchen Ticket</span><h2 id="reprint-confirm-title">Confirm Reprint</h2></div>
              <button type="button" className="modal-close" onClick={() => setConfirmingReprint(false)} aria-label="Close">x</button>
            </header>
            <div className="expense-body">
              <p>Reprint every item from {formatPosOrderRef(order.id)}? The ticket will be marked REPRINT.</p>
            </div>
            <footer>
              <button type="button" className="modal-secondary" onClick={() => setConfirmingReprint(false)}>Cancel</button>
              <button type="button" className="modal-primary" onClick={() => { setConfirmingReprint(false); onReprintOrder?.(order.id) }}>Confirm Reprint</button>
            </footer>
          </section>
        </div>
      ) : null}
    </aside>
  )
}

function FinishOrdersBoard({
  orders,
  selectedOrder,
  onSelectOrder,
  onToggleItem,
  onApplyPayment,
  onAddOrder,
  onQuickAddRice,
  employees,
  onApplyEmployeePayment,
  onEditNotes,
  autoOpenPaymentOrderId,
  onPaymentDismiss,
}: OngoingOrdersPageProps & {
  employees: PosEmployee[]
  onApplyEmployeePayment: (orderId: string, employee: PosEmployee) => Promise<void>
  autoOpenPaymentOrderId?: string | null
  onPaymentDismiss?: () => void
}) {
  const [filter, setFilter] = useState<PaymentFilter>('all')
  const [sort, setSort] = useState<OrderSort>('oldest')
  const [viewMode, setViewMode] = useState<'tiles' | 'list'>('tiles')
  const filteredOrders = useMemo(() => {
    const base = filter === 'all' ? orders : orders.filter((order) => paymentStatus(order) === filter)
    return [...base].sort((left, right) => sort === 'oldest' ? left.createdAt - right.createdAt : right.createdAt - left.createdAt)
  }, [filter, orders, sort])
  const counts = {
    all: orders.length,
    waiting: orders.filter((order) => paymentStatus(order) === 'waiting').length,
    partial: orders.filter((order) => paymentStatus(order) === 'partial').length,
    paid: orders.filter((order) => paymentStatus(order) === 'paid').length,
  }

  return (
    <section className="ongoing-dashboard">
      <section className="ongoing-main">
        <div className="ongoing-toolbar">
          <div className="filter-block">
            <p className="eyebrow">Pending Payment</p>
            <div className="filter-pills">
              <button type="button" className={filter === 'all' ? 'is-active' : ''} onClick={() => setFilter('all')}>All ({counts.all})</button>
              <button type="button" className={filter === 'waiting' ? 'is-active is-waiting' : 'is-waiting'} onClick={() => setFilter('waiting')}>Pending Payment ({counts.waiting})</button>
              <button type="button" className={filter === 'partial' ? 'is-active is-partial' : 'is-partial'} onClick={() => setFilter('partial')}>Partial Payment ({counts.partial})</button>
              <button type="button" className={filter === 'paid' ? 'is-active is-paid-filter' : 'is-paid-filter'} onClick={() => setFilter('paid')}>Paid ({counts.paid})</button>
            </div>
          </div>
          <div className="sort-control">
            <span>Sort by:</span>
            <button type="button" className="sort-select" onClick={() => setSort(sort === 'oldest' ? 'newest' : 'oldest')}>
              {sort === 'oldest' ? 'Oldest First' : 'Newest First'} v
            </button>
            <button type="button" className={`grid-mode ${viewMode === 'tiles' ? 'is-active' : ''}`} aria-label="Tile view" onClick={() => setViewMode('tiles')}><LayoutGrid size={16} /> Tiles</button>
            <button type="button" className={`grid-mode ${viewMode === 'list' ? 'is-active' : ''}`} aria-label="List view" onClick={() => setViewMode('list')}><List size={16} /> List</button>
          </div>
        </div>

        <div className={`ongoing-grid ${viewMode === 'list' ? 'is-list-view' : ''}`}>
          {filteredOrders.length === 0 ? <EmptyState text="No pending payment orders match this filter." /> : null}
          {filteredOrders.map((order) => (
            <FinishOrderCard
              key={order.id}
              order={order}
              selected={selectedOrder?.id === order.id}
              onSelect={() => onSelectOrder(order.id)}
            />
          ))}
        </div>
        <p className="showing-count">Showing {filteredOrders.length} of {orders.length} pending payment orders</p>
      </section>

      <FinishOrderDetailPanel
        order={selectedOrder}
        onToggleItem={onToggleItem}
        onApplyPayment={onApplyPayment}
        onAddOrder={onAddOrder}
        onQuickAddRice={onQuickAddRice}
        employees={employees}
        onApplyEmployeePayment={onApplyEmployeePayment}
        onEditNotes={onEditNotes}
        autoOpenPayment={selectedOrder?.id === autoOpenPaymentOrderId}
        onPaymentDismiss={onPaymentDismiss}
      />
    </section>
  )
}

function FinishOrderCard({
  order,
  selected,
  onSelect,
}: {
  order: RestaurantOrder
  selected: boolean
  onSelect: () => void
}) {
  const ready = allItemsServed(order)
  const total = orderTotal(order)
  const balance = orderBalance(order)
  const payStatus = paymentStatus(order)
  return (
    <article className={`mini-order-card payment-order-card payment-${payStatus} ${selected ? 'is-selected' : ''} ${ready ? 'is-ready' : ''}`} onClick={onSelect}>
      <span className="order-card-icon"><WalletCards size={22} aria-hidden="true" /></span>
      <div className="order-card-copy">
        <header>
          <div>
            <strong>{formatPosOrderRef(order.id)}</strong>
            <span>{order.items.length} items • Table {tableNumber(order.id)}</span>
          </div>
          <time>{formatOrderTime(order.createdAt)}</time>
        </header>
        <div className="mini-subhead">
          <span>{formatOrderType(order.orderType)}</span>
          <span className={`status-pill payment-${payStatus}`}>{paymentStatusLabel(payStatus)}</span>
        </div>
        <footer>
          <span>{minutesAgo(order.createdAt)} mins ago</span>
          <strong className="ongoing-card-price">{payStatus === 'partial' ? `${formatPhp(balance)} due` : formatPhp(total)}</strong>
          <span className="order-card-chevron"><ChevronRight size={18} aria-hidden="true" /></span>
        </footer>
      </div>
    </article>
  )
}

function FinishOrderDetailPanel({
  order,
  onToggleItem,
  onApplyPayment,
  onAddOrder,
  onQuickAddRice,
  employees,
  onApplyEmployeePayment,
  onEditNotes,
  autoOpenPayment = false,
  onPaymentDismiss,
}: {
  order: RestaurantOrder | null
  onToggleItem: (orderId: string, itemId: string, served: boolean) => void
  onApplyPayment?: (orderId: string, payment: OrderPaymentInput) => void
  onAddOrder?: (orderId: string) => void
  onQuickAddRice?: (orderId: string) => void
  employees: PosEmployee[]
  onApplyEmployeePayment: (orderId: string, employee: PosEmployee) => Promise<void>
  onEditNotes?: (orderId: string) => void
  autoOpenPayment?: boolean
  onPaymentDismiss?: () => void
}) {
  const [paymentMode, setPaymentMode] = useState<PaymentModeId>('full')
  const [method, setMethod] = useState<PaymentMethod>('cash')
  const [amount, setAmount] = useState('')
  const [cashReceived, setCashReceived] = useState('')
  const [gcashReceived, setGcashReceived] = useState('')
  const [splitCash, setSplitCash] = useState('')
  const [splitGcash, setSplitGcash] = useState('')
  const [splitField, setSplitField] = useState<'cash' | 'gcash'>('cash')
  const [keypadTarget, setKeypadTarget] = useState<'amount' | 'reference'>('amount')
  const [reference, setReference] = useState('')
  const [peopleCount, setPeopleCount] = useState(3)
  const [splitItemQuantities, setSplitItemQuantities] = useState<Record<string, number>>({})
  const [paymentPopupOpen, setPaymentPopupOpen] = useState(false)
  const [employeeId, setEmployeeId] = useState('')
  const [employeePaymentBusy, setEmployeePaymentBusy] = useState(false)

  useEffect(() => {
    if (!autoOpenPayment || !order) return
    setPaymentMode('full')
    setPaymentPopupOpen(true)
  }, [autoOpenPayment, order?.id])

  if (!order) {
    return (
      <aside className="order-detail-panel">
        <EmptyState text="Select an order to view details." />
      </aside>
    )
  }
  const total = orderTotal(order)
  const balance = orderBalance(order)
  const payStatus = paymentStatus(order)
  const selectedItemsTotal = order.items
    .reduce((sum, item) => sum + item.price * (splitItemQuantities[item.id] ?? 0), 0)
  const customAmount = Number(amount) || 0
  const amountDue = resolvePaymentModeAmount(paymentMode, {
    balance,
    customAmount,
    peopleCount,
    selectedItemsTotal,
  })
  const cashReceivedValue = Number(cashReceived) || 0
  const gcashReceivedValue = Number(gcashReceived) || 0
  const splitCashValue = Number(splitCash) || 0
  const splitGcashValue = Number(splitGcash) || 0
  const splitReceivedValue = splitCashValue + splitGcashValue
  const receivedAmount = method === 'cash'
    ? cashReceivedValue
    : method === 'gcash'
      ? gcashReceivedValue
      : splitReceivedValue
  const changeAmount = method === 'cash' || method === 'split' ? Math.max(0, receivedAmount - amountDue) : 0
  const canConfirm = Boolean(onApplyPayment)
    && balance > 0
    && amountDue > 0
    && amountDue <= balance
    && (method !== 'cash' || cashReceivedValue >= amountDue)
    && (method !== 'split' || splitReceivedValue >= amountDue)
    && (method !== 'gcash' || reference.trim().length === 6)
    && (method !== 'split' || reference.trim().length === 6)

  function updateSplitAmount(field: 'cash' | 'gcash', value: string) {
    const normalized = normalizeAmountInput(value)
    const current = Math.min(Number(normalized) || 0, amountDue)
    const remaining = roundCurrency(Math.max(0, amountDue - current))
    if (field === 'cash') {
      setSplitCash(normalized)
      setSplitGcash(remaining ? String(remaining) : '')
    } else {
      setSplitGcash(normalized)
      setSplitCash(remaining ? String(remaining) : '')
    }
  }

  function updateActivePaymentAmount(value: string) {
    if (method === 'cash') {
      setCashReceived(normalizeAmountInput(value))
    } else if (method === 'gcash') {
      setGcashReceived(normalizeAmountInput(value))
    } else {
      updateSplitAmount(splitField, value)
    }
  }

  function activePaymentAmount() {
    if (method === 'cash') return cashReceived
    if (method === 'gcash') return gcashReceived
    return splitField === 'cash' ? splitCash : splitGcash
  }

  function appendPaymentDigit(value: string) {
    if (keypadTarget === 'reference') {
      if (value !== '.') setReference((current) => `${current}${value}`.replace(/\D/g, '').slice(0, 6))
      return
    }
    const current = activePaymentAmount()
    updateActivePaymentAmount((() => {
      if (value === '.' && current.includes('.')) return current
      const next = current === '0' && value !== '.' ? value : `${current}${value}`
      return normalizeAmountInput(next)
    })())
  }

  function backspacePaymentAmount() {
    if (keypadTarget === 'reference') {
      setReference((current) => current.slice(0, -1))
      return
    }
    updateActivePaymentAmount(activePaymentAmount().slice(0, -1))
  }

  function clearPaymentAmount() {
    if (keypadTarget === 'reference') {
      setReference('')
      return
    }
    updateActivePaymentAmount('')
  }

  return (
    <aside className="order-detail-panel">
      <header>
        <div>
          <p className="detail-title">Order {formatPosOrderRef(order.id)}</p>
          <span>Table {tableNumber(order.id)} - {formatOrderType(order.orderType)}</span>
          <span className={`status-pill payment-${payStatus}`}>{paymentStatusLabel(payStatus)}</span>
        </div>
        <div className="detail-time">
          <time>{formatOrderTime(order.createdAt)}</time>
          <span>{minutesAgo(order.createdAt)} mins ago</span>
        </div>
      </header>
      <section className="finish-total-block">
        <span>Total Amount</span>
        <strong>{formatPhp(total)}</strong>
        {order.paymentReceived > 0 ? <small>Paid {formatPhp(order.paymentReceived)} - Balance {formatPhp(balance)}</small> : null}
      </section>
      <section>
        <div className="detail-section-head">
          <strong>Order Items</strong>
          <span>{order.items.length} items</span>
        </div>
        <div className="detail-items">
          {order.items.map((item) => (
            <label key={item.id}>
              <input checked={item.served} type="checkbox" onChange={(event) => onToggleItem(order.id, item.id, event.target.checked)} />
              <span>{item.quantity}</span>
              <div>
                <strong>{item.name}</strong>
                <small>{item.isHalfOrder ? 'Half Order - ' : ''}{itemCategory(item.name)} - {formatOrderType(item.orderType)}</small>
                {item.paidQuantity > 0 ? (
                  <small className="item-payment-note">
                    {item.paidQuantity >= item.quantity
                      ? `Paid x${item.quantity}`
                      : `Paid x${item.paidQuantity} · Unpaid x${item.quantity - item.paidQuantity}`}
                  </small>
                ) : null}
              </div>
            </label>
          ))}
        </div>
      </section>
      <section>
        <strong>Notes</strong>
        <button type="button" className="notes-box notes-box-button" onClick={() => onEditNotes?.(order.id)} aria-label={`Edit notes for ${formatPosOrderRef(order.id)}`}>
          <span>{order.paymentNotes || 'No special instructions'}</span><Pencil size={15} aria-hidden="true" />
        </button>
      </section>
      <section className="detail-actions">
        <button type="button" onClick={() => onAddOrder?.(order.id)}><Plus size={16} /> Add Order</button>
        <button type="button" onClick={() => onQuickAddRice?.(order.id)}><Plus size={16} /> Extra Rice</button>
      </section>
      <section className="finish-payment-system">
        <strong>Payment Mode</strong>
        <div className="payment-mode-grid">
          {paymentModeTiles.map((tile) => {
            const active = tile.id === paymentMode
            return (
              <button
                key={tile.id}
                type="button"
                className={active ? 'is-active' : ''}
                onClick={() => setPaymentMode(tile.id)}
              >
                <i>{tile.icon}</i>
                <span>{tile.label}</span>
                <small>{tile.helper}</small>
              </button>
            )
          })}
        </div>
        <section className="payment-mode-panel">
          {paymentMode === 'full' ? (
            <>
              <p>Collect the full remaining balance in one transaction.</p>
              <div className="finish-total-block compact">
                <span>Amount to pay</span>
                <strong>{formatPhp(balance)}</strong>
              </div>
            </>
          ) : null}

          {paymentMode === 'split-items' ? (
            <>
              <p>Select the items this customer is paying for.</p>
              <div className="split-item-list">
                {order.items.map((item) => (
                  <SplitItemPaymentRow
                    key={item.id}
                    item={item}
                    selectedQuantity={splitItemQuantities[item.id] ?? 0}
                    onChange={(quantity) => setSplitItemQuantities((current) => ({
                      ...current,
                      [item.id]: quantity,
                    }))}
                  />
                ))}
              </div>
              <div className="finish-total-block compact">
                <span>Selected total</span>
                <strong>{formatPhp(selectedItemsTotal)}</strong>
              </div>
            </>
          ) : null}

          {paymentMode === 'split-people' ? (
            <>
              <p>Split the total amount evenly among people.</p>
              <div className="people-stepper">
                <span>Number of people</span>
                <div>
                  <button type="button" onClick={() => setPeopleCount((count) => Math.max(1, count - 1))}>-</button>
                  <strong>{peopleCount}</strong>
                  <button type="button" onClick={() => setPeopleCount((count) => count + 1)}>+</button>
                </div>
              </div>
              <div className="finish-total-block compact">
                <span>Amount per person</span>
                <strong>{formatPhp(roundCurrency(balance / peopleCount))}</strong>
              </div>
            </>
          ) : null}

          {paymentMode === 'custom' ? (
            <>
              <p>Enter the exact amount the customer will pay now.</p>
              <label className="finish-reference-field">
                <span>Custom Amount</span>
                <input
                  type="number"
                  min="0"
                  inputMode="decimal"
                  value={amount}
                  onChange={(event) => setAmount(normalizeAmountInput(event.target.value))}
                />
              </label>
            </>
          ) : null}

          {paymentMode === 'combine' ? (
            <>
              <p>Select orders to combine and pay together. Current order is included.</p>
              <div className="combine-order-list">
                <label><input checked readOnly type="checkbox" /><span>{formatPosOrderRef(order.id)}</span><strong>{formatPhp(balance)}</strong></label>
                <label><input disabled type="checkbox" /><span>Next order</span><strong>Not selected</strong></label>
              </div>
            </>
          ) : null}

          {paymentMode === 'other' ? (
            <label className="finish-reference-field employee-payment-field">
              <span>Paying as Employee</span>
              <span className="employee-select-shell">
                <select value={employeeId} onChange={(event) => setEmployeeId(event.target.value)}>
                  <option value="">Select employee...</option>
                  {employees.map((employee) => <option key={employee.id} value={employee.id}>{employee.name}</option>)}
                </select>
                <i aria-hidden="true">⌄</i>
              </span>
            </label>
          ) : null}
        </section>
        <button
          type="button"
          className="confirm-payment-mode-button"
          disabled={amountDue <= 0 || amountDue > balance || (paymentMode === 'other' && !employeeId) || employeePaymentBusy}
          onClick={async () => {
            if (paymentMode !== 'other') { setPaymentPopupOpen(true); return }
            const employee = employees.find((item) => item.id === employeeId)
            if (!employee) return
            setEmployeePaymentBusy(true)
            try { await onApplyEmployeePayment(order.id, employee); setEmployeeId(''); setPaymentMode('full') }
            finally { setEmployeePaymentBusy(false) }
          }}
        >
          {paymentMode === 'other' ? (employeePaymentBusy ? 'Recording...' : 'Confirm Employee Payment') : 'Confirm Mode'}
          <strong>{paymentModeLabel(paymentMode)} · {formatPhp(amountDue || balance)}</strong>
        </button>
      </section>

      {paymentPopupOpen ? (
        <div className="modal-backdrop" role="presentation">
          <section className="payment-modal finish-collection-modal" role="dialog" aria-modal="true" aria-labelledby="pending-payment-title">
            <section className="checkout-summary-panel">
              <header>
                <h2 id="pending-payment-title">Order Summary</h2>
                <span>{order.items.length} {order.items.length === 1 ? 'item' : 'items'}</span>
              </header>
              <div className="checkout-summary-items">
                {order.items.map((item) => (
                  <article key={item.id}>
                    <div>
                      <strong>{item.name}</strong>
                      <small className={item.paidQuantity > 0 ? 'item-payment-note' : undefined}>
                        {item.paidQuantity >= item.quantity
                          ? `Paid x${item.quantity}`
                          : item.paidQuantity > 0
                            ? `Paid x${item.paidQuantity} · Unpaid x${item.quantity - item.paidQuantity}`
                            : `Unpaid x${item.quantity}`}
                      </small>
                    </div>
                    <div>
                      <strong>{formatPhp(item.price * item.quantity)}</strong>
                      <small>x{item.quantity}</small>
                    </div>
                  </article>
                ))}
              </div>
              <section className="checkout-totals">
                <div><span>Order total</span><strong>{formatPhp(total)}</strong></div>
                {order.paymentReceived > 0 ? <div><span>Previously paid</span><strong>{formatPhp(Math.min(total, order.paymentReceived))}</strong></div> : null}
                <div className="checkout-total"><span>{paymentModeLabel(paymentMode)}</span><strong>{formatPhp(amountDue)}</strong></div>
              </section>
            </section>

            <section className="checkout-payment-panel">
              <header>
                <div>
                  <p className="eyebrow">▣ &nbsp; Checkout&nbsp; • &nbsp;{paymentModeLabel(paymentMode)}</p>
                  <h2>Payment {formatPosOrderRef(order.id)}</h2>
                </div>
                <div className="finish-checkout-actions">
                  <div className="finish-method-grid" aria-label="Payment method">
                    <button type="button" className={method === 'cash' ? 'is-active' : ''} onClick={() => { setMethod('cash'); setKeypadTarget('amount') }}><Banknote size={18} />Cash</button>
                    <button type="button" className={method === 'gcash' ? 'is-active' : ''} onClick={() => { setMethod('gcash'); setKeypadTarget('reference') }}><span className="gcash-mark">G</span>GCash</button>
                  </div>
                  <button type="button" className="modal-close finish-checkout-close" onClick={() => {
                    setPaymentPopupOpen(false)
                    if (autoOpenPayment) onPaymentDismiss?.()
                  }}><X size={24} /><span>Close</span></button>
                </div>
              </header>
              <div className="finish-popup-body">
        {method === 'cash' ? (
          <button
            type="button"
            className="finish-amount-row finish-cash-summary"
            aria-label={`Cash received ${formatPhp(cashReceivedValue)}; change ${formatPhp(changeAmount)}`}
            onClick={() => setKeypadTarget('amount')}
          >
            <span><small>Cash Received</small><strong>{formatPhp(cashReceivedValue)}</strong></span>
            <span><small>Change</small><strong>{formatPhp(changeAmount)}</strong></span>
          </button>
        ) : null}
        {method === 'gcash' ? (
          <button
            type="button"
            className="finish-gcash-lines"
            aria-label={`Last 6 digits of GCash number: ${reference || 'not entered'}`}
            onClick={() => setKeypadTarget('reference')}
          >
            {Array.from({ length: 6 }, (_, index) => <span key={index}>{reference[index] ?? '—'}</span>)}
          </button>
        ) : null}
          <div className="finish-numberpad" aria-label="Payment number pad">
            {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((key) => (
              <button key={key} type="button" onClick={() => appendPaymentDigit(key)}>{key}</button>
            ))}
            <button type="button" onClick={() => appendPaymentDigit('0')}>0</button>
            <button type="button" className="finish-keypad-action" onClick={backspacePaymentAmount}>⌫ <span>Back</span></button>
            <button type="button" className="finish-keypad-action finish-keypad-clear" onClick={clearPaymentAmount}><Trash2 size={24} /><span>Clear</span></button>
          </div>
        <button
          type="button"
                  className="modal-primary process-payment-button"
          disabled={!canConfirm}
          onClick={() => {
            if (!onApplyPayment) return
            onApplyPayment(order.id, {
              method,
              amount: amountDue,
              reference: reference.trim(),
              notes: '',
              cashAmount: method === 'cash' ? amountDue : method === 'split' ? splitCashValue : 0,
              gcashAmount: method === 'gcash' ? amountDue : method === 'split' ? splitGcashValue : 0,
              itemPayments: paymentMode === 'split-items' ? splitItemQuantities : undefined,
            })
            setAmount('')
            setCashReceived('')
            setGcashReceived('')
            setSplitCash('')
            setSplitGcash('')
            setSplitField('cash')
            setKeypadTarget('amount')
            setReference('')
            setSplitItemQuantities({})
            setPaymentMode('full')
                    setPaymentPopupOpen(false)
          }}
        >
          <Check size={24} /> {method === 'cash'
            ? `Confirm Change ${formatPhp(changeAmount)}`
            : `Confirm Payment ${formatPhp(amountDue || balance)}`}
        </button>
              </div>
            </section>
          </section>
        </div>
      ) : null}
    </aside>
  )
}

function SplitItemPaymentRow({
  item,
  selectedQuantity,
  onChange,
}: {
  item: OrderItem
  selectedQuantity: number
  onChange: (quantity: number) => void
}) {
  const unpaidQuantity = Math.max(0, item.quantity - item.paidQuantity)
  const isFullyPaid = unpaidQuantity === 0
  const clampedQuantity = Math.min(selectedQuantity, unpaidQuantity)

  return (
    <div className={`split-item-row ${isFullyPaid ? 'is-paid' : ''}`}>
      <button type="button" disabled={isFullyPaid || clampedQuantity === 0} onClick={() => onChange(Math.max(0, clampedQuantity - 1))}>-</button>
      <span>{clampedQuantity}</span>
      <button type="button" disabled={isFullyPaid || clampedQuantity >= unpaidQuantity} onClick={() => onChange(Math.min(unpaidQuantity, clampedQuantity + 1))}>+</button>
      <div>
        <strong>{item.name}</strong>
        <small>{isFullyPaid ? 'Paid' : `${unpaidQuantity} unpaid of ${item.quantity}`}</small>
      </div>
      <em>{formatPhp(item.price * clampedQuantity)}</em>
    </div>
  )
}

export function OngoingOrdersPage({
  orders,
  selectedOrder,
  onSelectOrder,
  onToggleItem,
  onMarkAllServed,
  onViewDetails,
  onGoToPayment,
}: OngoingOrdersPageProps) {
  const [filter, setFilter] = useState<OrderFilter>('all')
  const [sort, setSort] = useState<OrderSort>('oldest')
  const filteredOrders = useMemo(() => {
    const base = filter === 'all' ? orders : orders.filter((order) => order.status === filter)
    return [...base].sort((left, right) => sort === 'oldest' ? left.createdAt - right.createdAt : right.createdAt - left.createdAt)
  }, [filter, orders, sort])
  const counts = {
    all: orders.length,
        preparing: orders.filter((order) => order.status === 'preparing').length,
    served: orders.filter((order) => order.status === 'served').length,
    paid: orders.filter((order) => order.status === 'paid').length,
  }

  return (
    <section className="ongoing-dashboard">
      <header className="ongoing-hero">
        <div>
          <h2>Kitchen Orders</h2>
          <p>Monitor and manage all kitchen orders</p>
        </div>
        <div className="ongoing-hero-actions">
          <button type="button" className="bell-button" aria-label="Notifications"><Clock3 size={16} aria-hidden="true" /><span>{counts.preparing}</span></button>
          <button type="button" className="station-button">Kitchen Station</button>
        </div>
      </header>

      <div className="ongoing-body">
        <section className="ongoing-main">
          <div className="ongoing-toolbar">
            <div>
              <p className="eyebrow">Ongoing Orders</p>
              <div className="filter-pills">
                <button type="button" className={filter === 'all' ? 'is-active' : ''} onClick={() => setFilter('all')}>All ({counts.all})</button>
                <button type="button" className={filter === 'preparing' ? 'is-active is-preparing' : 'is-preparing'} onClick={() => setFilter('preparing')}>Preparing ({counts.preparing})</button>
                <button type="button" className={filter === 'served' ? 'is-active is-served' : 'is-served'} onClick={() => setFilter('served')}>Served ({counts.served})</button>
                <button type="button" className={filter === 'paid' ? 'is-active is-paid-filter' : 'is-paid-filter'} onClick={() => setFilter('paid')}>Paid ({counts.paid})</button>
              </div>
            </div>
            <div className="sort-control">
              <span>Sort by:</span>
              <button type="button" onClick={() => setSort(sort === 'oldest' ? 'newest' : 'oldest')}>
                {sort === 'oldest' ? 'Oldest First' : 'Newest First'}
              </button>
              <button type="button" className="grid-mode is-active"><LayoutGrid size={16} aria-hidden="true" /></button>
              <button type="button" className="grid-mode"><List size={16} aria-hidden="true" /></button>
            </div>
          </div>

          <div className="ongoing-grid">
            {filteredOrders.length === 0 ? <EmptyState text="No ongoing orders match this filter." /> : null}
            {filteredOrders.map((order) => (
              <OngoingMiniCard
                key={order.id}
                order={order}
                selected={selectedOrder?.id === order.id}
                onSelect={() => onSelectOrder(order.id)}
                onToggleItem={onToggleItem}
                onMarkAllServed={onMarkAllServed}
              />
            ))}
          </div>
          <p className="showing-count">Showing {filteredOrders.length} of {orders.length} ongoing orders</p>
        </section>

        <OrderDetailPanel
          order={selectedOrder}
          onToggleItem={onToggleItem}
          onMarkAllServed={onMarkAllServed}
          onViewDetails={onViewDetails}
          onGoToPayment={onGoToPayment}
        />
      </div>
    </section>
  )
}

function OngoingMiniCard({
  order,
  selected,
  onSelect,
  onToggleItem,
  onMarkAllServed,
}: {
  order: RestaurantOrder
  selected: boolean
  onSelect: () => void
  onToggleItem: (orderId: string, itemId: string, served: boolean) => void
  onMarkAllServed: (orderId: string) => void
}) {
  const ready = allItemsServed(order)
  return (
    <article className={`mini-order-card ${selected ? 'is-selected' : ''} ${ready ? 'is-ready' : ''}`} onClick={onSelect}>
      <header>
        <div>
          <strong>{formatPosOrderRef(order.id)}</strong>
          <span>Table {tableNumber(order.id)} - {formatOrderType(order.orderType)}</span>
        </div>
        <div>
          <time>{formatOrderTime(order.createdAt)}</time>
          <span className={`status-pill status-${order.status}`}>{statusLabel(order.status)}</span>
        </div>
      </header>
      <div className="mini-item-list">
        {order.items.map((item) => (
          <label key={item.id} onClick={(event) => event.stopPropagation()}>
            <input checked={item.served} type="checkbox" onChange={(event) => onToggleItem(order.id, item.id, event.target.checked)} />
            <span>{item.quantity}</span>
            <strong>{item.name}</strong>
          </label>
        ))}
      </div>
      <footer>
        <span>{minutesAgo(order.createdAt)} mins ago</span>
        {ready ? <button type="button" onClick={(event) => { event.stopPropagation(); onMarkAllServed(order.id) }}>Mark as Served</button> : null}
      </footer>
    </article>
  )
}

function OrderDetailPanel({
  order,
  onToggleItem,
  onMarkAllServed,
  onViewDetails,
  onGoToPayment,
}: {
  order: RestaurantOrder | null
  onToggleItem: (orderId: string, itemId: string, served: boolean) => void
  onMarkAllServed: (orderId: string) => void
  onViewDetails: (orderId: string) => void
  onGoToPayment: (orderId: string) => void
}) {
  if (!order) {
    return (
      <aside className="order-detail-panel">
        <EmptyState text="Select an order to view details." />
      </aside>
    )
  }
  return (
    <aside className="order-detail-panel">
      <header>
        <div>
          <h3>Order {formatPosOrderRef(order.id)}</h3>
          <span>Table {tableNumber(order.id)} - {formatOrderType(order.orderType)}</span>
          <span className={`status-pill status-${order.status}`}>{statusLabel(order.status)}</span>
        </div>
        <time>{formatOrderTime(order.createdAt)}</time>
      </header>
      <section>
        <div className="detail-section-head">
          <strong>Order Items</strong>
          <span>{order.items.length} items</span>
        </div>
        <div className="detail-items">
          {order.items.map((item) => (
            <label key={item.id}>
              <input checked={item.served} type="checkbox" onChange={(event) => onToggleItem(order.id, item.id, event.target.checked)} />
              <span>{item.quantity}</span>
              <div>
                <strong>{item.name}</strong>
                <small>{item.served ? 'Prepared' : 'Pending'}</small>
              </div>
            </label>
          ))}
        </div>
      </section>
      <section>
        <strong>Notes</strong>
        <p className="notes-box">{order.paymentNotes || 'No special instructions'}</p>
      </section>
      <section className="detail-actions">
        <button type="button" className="send-kitchen" onClick={() => onMarkAllServed(order.id)}><CircleCheckBig size={16} aria-hidden="true" /> Mark All as Ready</button>
        <button type="button" onClick={() => onViewDetails(order.id)}><Pencil size={16} aria-hidden="true" /> Edit Order</button>
        <button type="button" className={order.paid ? 'is-paid' : 'clear-order-button'} onClick={() => onGoToPayment(order.id)}>
          {order.paid ? 'Paid' : 'Go to Payment'}
        </button>
      </section>
    </aside>
  )
}

function SaleTrackerPage({
  deviceId,
  staffName,
  orderType,
  halfOrderEnabled,
  onOrderTypeChange,
  onHalfOrderToggle,
  shiftSession,
}: {
  deviceId: string
  staffName: string
  orderType: OrderType
  halfOrderEnabled: boolean
  onOrderTypeChange: (orderType: OrderType) => void
  onHalfOrderToggle: () => void
  shiftSession: ShiftSession | null
}) {
  const cachedShiftMatches = saleTrackerCache.shiftId === (shiftSession?.shiftId ?? null)
  const [payments, setPayments] = useState<SalePayment[]>(() => saleTrackerCache.payments)
  const [trackerStatus, setTrackerStatus] = useState(() => cachedShiftMatches ? saleTrackerCache.status : 'Loading payments...')
  const [cardLayout, setCardLayout] = useState<'money-first' | 'counts-first'>('money-first')
  const [selectedPayment, setSelectedPayment] = useState<SalePayment | null>(null)
  const [showExpenseModal, setShowExpenseModal] = useState(false)
  const [showAdjustmentModal, setShowAdjustmentModal] = useState(false)
  const [showFinancialHistory, setShowFinancialHistory] = useState(false)
  const [shiftExpenses, setShiftExpenses] = useState<CashMovement[]>(() => cachedShiftMatches ? saleTrackerCache.expenses : [])
  const [shiftAdjustments, setShiftAdjustments] = useState<ShiftAdjustment[]>(() => cachedShiftMatches ? saleTrackerCache.adjustments : [])
  const [refreshRequest, setRefreshRequest] = useState(0)

  useEffect(() => {
    let active = true

    async function loadPayments() {
      if (!hasSupabaseConfig) {
        setTrackerStatus('Supabase is not configured. Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.')
        return
      }

      try {
        const rows = await fetchSalePayments()
        const movements = await fetchCashMovements()
        const adjustments = shiftSession ? await fetchShiftAdjustments(shiftSession.shiftId) : []
        if (!active) return
        const currentExpenses = movements.filter((item) => shiftSession && item.movementKind === 'PAY_OUT' && cashMovementBelongsToShift(item, shiftSession))
        const currentAdjustments = adjustments.filter((item) => shiftSession && shiftAdjustmentBelongsToShift(item, shiftSession))
        const currentShiftCount = shiftSession ? rows.filter((payment) => salePaymentBelongsToShift(payment, shiftSession)).length : 0
        const nextStatus = `Live Supabase payments synced. ${currentShiftCount} current-shift records loaded.`
        saleTrackerCache.shiftId = shiftSession?.shiftId ?? null
        saleTrackerCache.payments = rows
        saleTrackerCache.expenses = currentExpenses
        saleTrackerCache.adjustments = currentAdjustments
        saleTrackerCache.status = nextStatus
        setPayments(rows)
        setShiftExpenses(currentExpenses)
        setShiftAdjustments(currentAdjustments)
        setTrackerStatus(nextStatus)
      } catch (error) {
        if (!active) return
        setTrackerStatus(error instanceof Error ? error.message : 'Could not load payments.')
      }
    }

    void loadPayments()

    if (!hasSupabaseConfig) {
      return () => {
        active = false
      }
    }

    const supabase = requireSupabase()
    const channel = supabase
      .channel('pos-sale-tracker-payments')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'payments' }, () => {
        void loadPayments()
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, () => {
        void loadPayments()
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'cash_movements' }, () => { void loadPayments() })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'shift_adjustments' }, () => { void loadPayments() })
      .subscribe()

    return () => {
      active = false
      void supabase.removeChannel(channel)
    }
  }, [shiftSession?.id, refreshRequest])

  const shiftPayments = shiftSession
    ? payments.filter((payment) => salePaymentBelongsToShift(payment, shiftSession))
    : []
  const paidThisShift = shiftPayments.filter((payment) => payment.status === 'paid')
  const cashTotal = paidThisShift
    .filter((payment) => payment.method === 'cash')
    .reduce((sum, payment) => sum + payment.amount, 0)
  const gcashTotal = paidThisShift
    .filter((payment) => payment.method === 'gcash')
    .reduce((sum, payment) => sum + payment.amount, 0)
  const cashExpenses = shiftExpenses.filter((item) => item.accountType !== 'BANK').reduce((sum, item) => sum + item.amount, 0)
  const gcashExpenses = shiftExpenses.filter((item) => item.accountType === 'BANK').reduce((sum, item) => sum + item.amount, 0)
  const approvedAdjustment = (account: 'CASH' | 'GCASH') => shiftAdjustments.filter((item) => item.status === 'APPROVED' && item.account === account).reduce((sum, item) => sum + (item.direction === 'ADD' ? item.amount : -item.amount), 0)
  const netCash = cashTotal - cashExpenses + approvedAdjustment('CASH')
  const netGcash = gcashTotal - gcashExpenses + approvedAdjustment('GCASH')
  const ongoingTotal = shiftPayments
    .filter((payment) => payment.status === 'unpaid')
    .reduce((sum, payment) => sum + payment.amount, 0)
  const averagePayment = shiftPayments.length > 0
    ? shiftPayments.reduce((sum, payment) => sum + payment.amount, 0) / shiftPayments.length
    : 0
  const unpaidThisShift = shiftPayments.filter((payment) => payment.status === 'unpaid')
  const customerCount = new Set(shiftPayments.map((payment) => payment.customerName || payment.orderId || payment.id)).size

  const metricCards = [
    { label: 'Total Paid Cash', value: netCash, subtext: `${formatPhp(cashTotal)} gross − ${formatPhp(cashExpenses)} expenses`, tone: 'green' },
    { label: 'Total GCash', value: netGcash, subtext: `${formatPhp(gcashTotal)} gross − ${formatPhp(gcashExpenses)} expenses`, tone: 'blue' },
    { label: 'Ongoing Payments', value: ongoingTotal, subtext: 'Unpaid', tone: 'orange' },
    { label: 'Average Payment', value: averagePayment, subtext: 'This shift', tone: 'neutral' },
  ] as const
  const overviewCards = [
    { label: 'Total Transactions This Shift', value: shiftPayments.length },
    { label: 'Paid Transactions', value: paidThisShift.length },
    { label: 'Unpaid Transactions', value: unpaidThisShift.length },
    { label: 'Total Customers', value: customerCount },
  ] as const
  const moneyCardsFirst = cardLayout === 'money-first'

  return (
    <section className="sale-tracker-page">
      <header className="sale-tracker-header">
        <div className="left-header">
          <strong className="app-title">OOH POS</strong>
          <span className="staff-subtitle">{staffName} • {deviceId}</span>
        </div>
        <div className="sale-tracker-title">
          <h1>Sale Tracker</h1>
          <p>Track all payments and ongoing balances</p>
        </div>
        <div className="right-header">
          <div className="order-type-toggle" aria-label="Order type">
            <button type="button" className={`mode-button ${orderType === 'DINE IN' ? 'active is-active' : ''}`} onClick={() => onOrderTypeChange('DINE IN')}>
              Dine In
            </button>
            <button type="button" className={`mode-button ${orderType === 'TAKE OUT' ? 'active is-active' : ''}`} onClick={() => onOrderTypeChange('TAKE OUT')}>
              Takeout
            </button>
          </div>
          <button type="button" className={`mode-button half-order-toggle ${halfOrderEnabled ? 'active is-active' : ''}`} onClick={onHalfOrderToggle}>
            Half
          </button>
        </div>
      </header>

      <div className="sale-tracker-body">
        <main className="sale-tracker-main">
          <section className="sale-card-controls" aria-label="Sale tracker card layout">
            <span>{moneyCardsFirst ? 'Showing money metrics' : 'Showing transaction counts'}</span>
            <button
              type="button"
              onClick={() => setCardLayout((current) => current === 'money-first' ? 'counts-first' : 'money-first')}
            >
              {moneyCardsFirst ? 'Show Counts' : 'Show Money'}
            </button>
          </section>

          <div className="sale-card-stack">
            {moneyCardsFirst ? (
              <section className="sale-metrics-grid" aria-label="Payment metrics">
                {metricCards.map((card) => (
                  <article key={card.label} className={`sale-metric-card is-${card.tone}`}>
                    <span>{card.label}</span>
                    <strong>{formatPhp(card.value)}</strong>
                    <small>{card.subtext}</small>
                  </article>
                ))}
              </section>
            ) : (
            <section className="sale-overview-grid" aria-label="Payment overview">
              {overviewCards.map((card) => (
                <article key={card.label}>
                  <span>{card.label}</span>
                  <strong>{card.value}</strong>
                </article>
              ))}
            </section>
            )}
          </div>

          <section className="sale-table-card">
            <header>
              <div>
                <h2>Transactions</h2>
                <span>{trackerStatus}</span>
              </div>
              <button type="button" onClick={() => { setTrackerStatus('Refreshing payments...'); setRefreshRequest((value) => value + 1) }}>Refresh Status</button>
            </header>
            <div className="sale-simple-table">
              <div className="sale-simple-table-head">
                <span>Order Number</span>
                <span>Price</span>
                <span>Payment Method</span>
                <span>Status</span>
                <span>Details</span>
              </div>
              <div className="sale-simple-table-body">
                {shiftPayments.length === 0 ? <EmptyState text="No transactions in this shift yet." /> : null}
                {shiftPayments.map((payment) => (
                  <article key={payment.id}>
                    <strong>{payment.orderId ? formatPosOrderRef(payment.orderId) : '-'}</strong>
                    <strong>{formatPhp(payment.amount)}</strong>
                    <span>{paymentMethodText(payment.method)}</span>
                    <em className={`sale-status is-${payment.status}`}>{payment.status === 'paid' ? 'Paid' : 'Unpaid'}</em>
                    <button type="button" onClick={() => setSelectedPayment(payment)}>Details</button>
                  </article>
                ))}
              </div>
            </div>
          </section>
        </main>

        <aside className="sale-summary-panel">
          <header>
            <h2>Sale Summary</h2>
            <span>Current shift</span>
          </header>
          <div className="sale-summary-list">
            <article>
              <span>Cash Total</span>
              <strong>{formatPhp(netCash)}</strong>
            </article>
            <article>
              <span>GCash Total</span>
              <strong>{formatPhp(netGcash)}</strong>
            </article>
            <article>
              <span>Total Paid</span>
              <strong>{formatPhp(netCash + netGcash)}</strong>
            </article>
            <article>
              <span>Ongoing Balance</span>
              <strong>{formatPhp(ongoingTotal)}</strong>
            </article>
          </div>
          <div className="sale-quick-actions">
            <button type="button" onClick={() => setShowExpenseModal(true)}>Log Expense</button>
            <button type="button" onClick={() => setShowAdjustmentModal(true)}>Request Adjustment</button>
            <button type="button" onClick={() => setShowFinancialHistory(true)}>View History</button>
          </div>
        </aside>
      </div>
      {selectedPayment ? (
        <SalePaymentDetailsModal payment={selectedPayment} cashierName={staffName} onClose={() => setSelectedPayment(null)} />
      ) : null}
      {showExpenseModal ? (
        <LogExpenseModal
          deviceId={deviceId}
          shiftSession={shiftSession}
          staffName={staffName}
          onClose={() => setShowExpenseModal(false)}
          onSaved={(message) => {
            setTrackerStatus(message)
            setShowExpenseModal(false)
          }}
        />
      ) : null}
      {showAdjustmentModal && shiftSession ? <PosAdjustmentModal shiftSession={shiftSession} staffName={staffName} onClose={() => setShowAdjustmentModal(false)} onSaved={(message) => { setTrackerStatus(message); setShowAdjustmentModal(false) }} /> : null}
      {showFinancialHistory ? <FinancialHistoryModal expenses={shiftExpenses} adjustments={shiftAdjustments} onClose={() => setShowFinancialHistory(false)} /> : null}
    </section>
  )
}

function FinancialHistoryModal({ expenses, adjustments, onClose }: { expenses: CashMovement[]; adjustments: ShiftAdjustment[]; onClose: () => void }) {
  const [tab, setTab] = useState<'expenses' | 'adjustments'>('expenses')
  return <div className="modal-backdrop expense-backdrop"><section className="expense-modal financial-history-modal" role="dialog" aria-modal="true"><header><div><span>Current Shift</span><h2>Financial History</h2></div><button className="modal-close" onClick={onClose}>x</button></header><div className="expense-body"><div className="expense-payment-grid"><button className={tab === 'expenses' ? 'is-selected' : ''} onClick={() => setTab('expenses')}>Expenses ({expenses.length})</button><button className={tab === 'adjustments' ? 'is-selected' : ''} onClick={() => setTab('adjustments')}>Adjustments ({adjustments.length})</button></div><div className="financial-history-list">{tab === 'expenses' ? (expenses.length ? expenses.map((item) => <article key={item.id}><div><strong>{item.reasonCategory}</strong><span>{item.note || 'No note'} • {item.accountType === 'BANK' ? 'GCash' : 'Cash'}</span></div><em>-{formatPhp(item.amount)}</em></article>) : <p>No expenses in this shift.</p>) : (adjustments.length ? adjustments.map((item) => <article key={item.id}><div><strong>{item.reason}</strong><span>{item.account} • {item.status}</span></div><em>{item.direction === 'ADD' ? '+' : '-'}{formatPhp(item.amount)}</em></article>) : <p>No adjustment requests in this shift.</p>)}</div></div><footer><button className="modal-secondary" onClick={onClose}>Close</button></footer></section></div>
}

function PosAdjustmentModal({ shiftSession, staffName, onClose, onSaved }: { shiftSession: ShiftSession; staffName: string; onClose: () => void; onSaved: (message: string) => void }) {
  const [account, setAccount] = useState<'CASH' | 'GCASH'>('CASH'); const [direction, setDirection] = useState<'ADD' | 'REMOVE'>('ADD'); const [amount, setAmount] = useState(''); const [reason, setReason] = useState(''); const [status, setStatus] = useState('Admin approval is required before totals change.')
  async function submit() { const value = Number(amount); if (!(value > 0) || !reason.trim()) { setStatus('Amount and reason are required.'); return } try { await createShiftAdjustment({ shiftId: shiftSession.shiftId, shiftSessionId: shiftSession.id, account, direction, amount: value, reason: reason.trim(), requestedBy: staffName }); onSaved('Adjustment request sent to Admin for approval.') } catch (error) { setStatus(error instanceof Error ? error.message : 'Could not send request.') } }
  return <div className="modal-backdrop expense-backdrop"><section className="expense-modal" role="dialog" aria-modal="true"><header><div><span>Approval Required</span><h2>Request Adjustment</h2></div><button className="modal-close" onClick={onClose}>x</button></header><div className="expense-body"><div className="expense-payment-grid"><button className={account === 'CASH' ? 'is-selected' : ''} onClick={() => setAccount('CASH')}>Cash</button><button className={account === 'GCASH' ? 'is-selected' : ''} onClick={() => setAccount('GCASH')}>GCash</button></div><div className="expense-payment-grid"><button className={direction === 'ADD' ? 'is-selected' : ''} onClick={() => setDirection('ADD')}>Add</button><button className={direction === 'REMOVE' ? 'is-selected' : ''} onClick={() => setDirection('REMOVE')}>Remove</button></div><label className="expense-field"><span>Amount</span><input inputMode="decimal" value={amount} onChange={(e) => setAmount(normalizeAmountInput(e.target.value))} /></label><label className="expense-field"><span>Reason</span><input value={reason} onChange={(e) => setReason(e.target.value)} /></label><p className="expense-status">{status}</p></div><footer><button className="modal-secondary" onClick={onClose}>Cancel</button><button className="modal-primary" onClick={() => void submit()}>Send Request</button></footer></section></div>
}

function LogExpenseModal({
  deviceId,
  onClose,
  onSaved,
  shiftSession,
  staffName,
}: {
  deviceId: string
  onClose: () => void
  onSaved: (message: string) => void
  shiftSession: ShiftSession | null
  staffName: string
}) {
  const amountRef = useRef<HTMLInputElement | null>(null)
  const [categories, setCategories] = useState<ExpenseCategorySetting[]>([])
  const [amount, setAmount] = useState('')
  const [categoryId, setCategoryId] = useState('')
  const [subcategoryId, setSubcategoryId] = useState('')
  const [paymentMethod, setPaymentMethod] = useState<ExpensePaymentMethod | ''>('')
  const [note, setNote] = useState('')
  const [status, setStatus] = useState('Loading expense categories...')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    amountRef.current?.focus()
  }, [])

  useEffect(() => {
    let active = true
    fetchExpenseCategorySettings()
      .then((items) => {
        if (!active) return
        setCategories(items)
        setStatus(items.length > 0
          ? 'Expense categories loaded from Supabase settings.'
          : 'No expense categories found. Configure Admin Settings -> Expense Categories.')
      })
      .catch((error: unknown) => {
        if (!active) return
        setStatus(error instanceof Error ? error.message : 'Could not load expense categories.')
      })
    return () => {
      active = false
    }
  }, [])

  const selectedCategory = categories.find((category) => category.id === categoryId)
  const selectedSubcategory = selectedCategory?.subcategories.find((subcategory) => subcategory.id === subcategoryId)
  const amountValue = Number(amount)
  const canSave = Number.isFinite(amountValue) && amountValue > 0 && Boolean(categoryId) && Boolean(paymentMethod) && !saving

  async function saveExpense() {
    if (!selectedCategory || !paymentMethod || !canSave) {
      setStatus('Amount, category, and payment method are required.')
      return
    }

    setSaving(true)
    try {
      await saveExpenseMovement({
        deviceId,
        amount: amountValue,
        category: selectedCategory,
        subcategory: selectedSubcategory,
        paymentMethod,
        note,
        shiftSession,
        staffName,
      })
      onSaved(hasSupabaseConfig
        ? `Expense saved to Supabase cash_movements. ${formatPhp(amountValue)} deducted from ${expensePaymentLabel(paymentMethod)}.`
        : 'Expense recorded locally for this session. Supabase is not configured.')
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Could not save expense.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="modal-backdrop expense-backdrop" role="presentation">
      <section className="expense-modal" role="dialog" aria-modal="true" aria-labelledby="expense-modal-title">
        <header>
          <div>
            <span>Financial Log</span>
            <h2 id="expense-modal-title">Log Expense</h2>
          </div>
          <button type="button" className="modal-close" onClick={onClose} aria-label="Close">x</button>
        </header>
        <div className="expense-body">
          <label className="expense-field expense-amount-field">
            <span>Amount</span>
            <input
              ref={amountRef}
              type="number"
              inputMode="numeric"
              pattern="[0-9]*"
              min="0"
              step="1"
              value={amount}
              onChange={(event) => setAmount(normalizeAmountInput(event.target.value))}
              placeholder="0"
            />
          </label>

          <section className="expense-field">
            <span>Category <em>Required</em></span>
            {categories.length === 0 ? (
              <p className="expense-empty-state">No categories configured yet.</p>
            ) : (
              <div className="expense-button-grid">
                {categories.map((category) => (
                  <button
                    key={category.id}
                    type="button"
                    className={category.id === categoryId ? 'is-selected' : ''}
                    onClick={() => {
                      setCategoryId(category.id)
                      setSubcategoryId('')
                    }}
                  >
                    {category.name}
                  </button>
                ))}
              </div>
            )}
          </section>

          {selectedCategory ? (
            <section className="expense-field">
              <span>Subcategory <em>Optional</em></span>
              {selectedCategory.subcategories.length === 0 ? (
                <p className="expense-empty-state">No subcategories for {selectedCategory.name}.</p>
              ) : (
                <div className="expense-button-grid">
                  {selectedCategory.subcategories.map((subcategory) => (
                    <button
                      key={subcategory.id}
                      type="button"
                      className={subcategory.id === subcategoryId ? 'is-selected' : ''}
                      onClick={() => setSubcategoryId(subcategory.id)}
                    >
                      {subcategory.name}
                    </button>
                  ))}
                </div>
              )}
            </section>
          ) : null}

          <section className="expense-field">
            <span>Payment Method <em>Required</em></span>
            <div className="expense-payment-grid">
              {(['cash', 'gcash'] as ExpensePaymentMethod[]).map((method) => (
                <button
                  key={method}
                  type="button"
                  className={paymentMethod === method ? 'is-selected' : ''}
                  onClick={() => setPaymentMethod(method)}
                >
                  {expensePaymentLabel(method)}
                </button>
              ))}
            </div>
          </section>

          <label className="expense-field expense-note-field">
            <span>Note <em>Optional</em></span>
            <input value={note} onChange={(event) => setNote(event.target.value)} placeholder="Supplier, receipt number, or short reason" />
          </label>

          <p className="expense-status">{status}</p>
        </div>
        <footer>
          <button type="button" className="modal-secondary" onClick={onClose}>Cancel</button>
          <button type="button" className="modal-primary" disabled={!canSave} onClick={saveExpense}>
            {saving ? 'Saving...' : 'Save Expense'}
          </button>
        </footer>
      </section>
    </div>
  )
}

function SalePaymentDetailsModal({ payment, cashierName, onClose }: { payment: SalePayment; cashierName: string; onClose: () => void }) {
  const orderRef = payment.orderId ? formatPosOrderRef(payment.orderId) : '-'
  return (
    <div className="modal-backdrop sale-detail-backdrop" role="presentation">
      <section className="sale-detail-modal" role="dialog" aria-modal="true" aria-labelledby="sale-detail-title">
        <header>
          <div>
            <span>Order Details</span>
            <h2 id="sale-detail-title">{orderRef}</h2>
          </div>
          <button type="button" className="modal-close" onClick={onClose} aria-label="Close">x</button>
        </header>
        <div className="sale-detail-body">
          <section className="sale-detail-summary">
            <article>
              <span>Price</span>
              <strong>{formatPhp(payment.amount)}</strong>
            </article>
            <article>
              <span>Payment Method</span>
              <strong>{paymentMethodText(payment.method)}</strong>
            </article>
            <article>
              <span>Status</span>
              <em className={`sale-status is-${payment.status}`}>{payment.status === 'paid' ? 'Paid' : 'Unpaid'}</em>
            </article>
            <article>
              <span>Time</span>
              <strong>{formatOrderTime(new Date(payment.createdAt).getTime())}</strong>
            </article>
          </section>
          <section className="sale-detail-meta">
            <div>
              <span>Cashier</span>
              <strong>{cashierName}</strong>
            </div>
            <div>
              <span>Order Number</span>
              <strong>{orderRef}</strong>
            </div>
          </section>
          <section className="sale-detail-items">
            <div className="detail-section-head">
              <strong>Order Items</strong>
              <span>{payment.items.length} items</span>
            </div>
            <div className="sale-detail-items-list">
              {payment.items.length === 0 ? <EmptyState text="No item details available for this payment." /> : null}
              {payment.items.map((item, index) => (
                <article key={`${item.name}-${index}`}>
                  <span>{item.quantity}x</span>
                  <strong>{item.name}</strong>
                  <em>{formatPhp(item.price * item.quantity)}</em>
                </article>
              ))}
            </div>
          </section>
          <section className="sale-detail-note">
            <span>Order Notes</span>
            <p>{payment.orderNote?.trim() || 'No order notes recorded.'}</p>
          </section>
        </div>
        <footer>
          <button type="button" className="modal-secondary" onClick={onClose}>Close</button>
        </footer>
      </section>
    </div>
  )
}

function SettingsPage({
  history,
  products,
  categories,
  menuCategoriesEnabled,
  deviceId,
  onToggleMenuCategory,
  autoPrintReceipt,
  receiptCopies,
  receiptPrintSettings,
  onAutoPrintReceiptChange,
  onReceiptCopiesChange,
  onReceiptPrintSettingsChange,
  onProductStatusChange,
}: {
  history: RestaurantOrder[]
  products: PosMenuProduct[]
  categories: string[]
  menuCategoriesEnabled: Record<string, boolean>
  deviceId: string
  autoPrintReceipt: boolean
  receiptCopies: number
  receiptPrintSettings: ReceiptPrintSettings
  onAutoPrintReceiptChange: (enabled: boolean) => void
  onReceiptCopiesChange: (copies: number) => void
  onReceiptPrintSettingsChange: (settings: ReceiptPrintSettings) => void
  onProductStatusChange: (productId: string, status: ProductStatus) => Promise<void>
  onToggleMenuCategory: (category: string) => void
}) {
  const [activeSection, setActiveSection] = useState<SettingsSection>('menu')
  const [movements, setMovements] = useState<CashMovement[]>([])
  const [movementStatus, setMovementStatus] = useState('Loading money movements...')
  const [moneyAccount, setMoneyAccount] = useState<MoneyAccount>('cash')
  const [movementDirection, setMovementDirection] = useState<MovementDirection>('in')
  const [movementAmount, setMovementAmount] = useState('')
  const [movementNote, setMovementNote] = useState('')
  const [printSettingsStatus, setPrintSettingsStatus] = useState('Receipt settings are saved on this POS browser.')
  const [printerDetectionLog, setPrinterDetectionLog] = useState<PrinterDetectionLogEntry[]>(readPrinterDetectionLog)
  const [savingProductId, setSavingProductId] = useState<string | null>(null)
  const [menuStatusMessage, setMenuStatusMessage] = useState('Availability changes sync with Admin Web and the live POS menu.')
  const [activeMenuListCategory, setActiveMenuListCategory] = useState('All Items')

  useEffect(() => {
    let active = true
    fetchCashMovements()
      .then((items) => {
        if (!active) return
        setMovements(items)
        setMovementStatus(hasSupabaseConfig ? 'Synced with Supabase cash_movements.' : 'Supabase not configured. Showing local POS totals only.')
      })
      .catch((error: unknown) => {
        if (!active) return
        setMovementStatus(error instanceof Error ? error.message : 'Could not load money movements.')
      })
    return () => {
      active = false
    }
  }, [])

  useEffect(() => {
    window.localStorage.setItem('pos-web-printer-detection-log', JSON.stringify(printerDetectionLog))
  }, [printerDetectionLog])

  const cashMovements = movements.filter((movement) => movement.accountId !== 'bank-gcash')
  const gcashMovements = movements.filter((movement) => movement.accountId === 'bank-gcash')
  const cashBalance = cashMovements.reduce((sum, movement) => sum + movementSignedAmount(movement), 0)
  const gcashBalance = gcashMovements.reduce((sum, movement) => sum + movementSignedAmount(movement), 0)
  const recentMovements = movements.slice(0, 8)
  const menuListProducts = activeMenuListCategory === 'All Items'
    ? products
    : products.filter((product) => (product.categoryName || 'Uncategorized') === activeMenuListCategory)
  const menuListCategories = ['All Items', ...categories]

  async function saveMoneyMovement() {
    const amount = Number(movementAmount)
    if (!Number.isFinite(amount) || amount <= 0) {
      setMovementStatus('Enter an amount greater than 0.')
      return
    }
    const movement: CashMovement = {
      id: `pos-movement-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      accountId: moneyAccount === 'gcash' ? 'bank-gcash' : normalizeAccountId(deviceId),
      accountType: moneyAccount === 'gcash' ? 'BANK' : 'TABLET_DRAWER',
      sourceAccountId: null,
      destinationAccountId: null,
      movementKind: movementDirection === 'in' ? 'PAY_IN' : 'PAY_OUT',
      reasonCategory: moneyAccount === 'gcash' ? 'GCash POS' : 'Cash Drawer',
      amount: roundCurrency(amount),
      note: movementNote.trim() || null,
      relatedBillId: null,
      createdBy: 'POS Web',
      createdAtEpochMillis: Date.now(),
    }
    try {
      await upsertCashMovements([movement])
      setMovements((current) => [movement, ...current])
      setMovementAmount('')
      setMovementNote('')
      setMovementStatus(hasSupabaseConfig ? 'Money movement saved to Supabase.' : 'Money movement recorded locally for this session.')
    } catch (error) {
      setMovementStatus(error instanceof Error ? error.message : 'Could not save money movement.')
    }
  }

  function updateReceiptPrintSettings(nextSettings: Partial<ReceiptPrintSettings>) {
    onReceiptPrintSettingsChange({ ...receiptPrintSettings, ...nextSettings })
    setPrintSettingsStatus('Receipt settings saved.')
  }

  function printTestReceipt() {
    try {
      printPosDocument(buildTestReceipt(deviceId), 'customer-receipt', {
        copies: receiptCopies,
        ...receiptPrintSettings,
      })
      setPrintSettingsStatus(`Test receipt opened with ${receiptCopies} ${receiptCopies === 1 ? 'copy' : 'copies'}.`)
    } catch (error) {
      setPrintSettingsStatus(error instanceof Error ? error.message : 'Could not open test receipt.')
    }
  }

  function checkPaperSensor() {
    const result = checkNativePrinterStatus()
    const entry: PrinterDetectionLogEntry = { ...result, checkedAt: new Date().toISOString() }
    setPrinterDetectionLog((current) => [entry, ...current].slice(0, 10))
    setPrintSettingsStatus(`${result.state}: ${result.message}`)
  }

  async function setProductAvailability(product: PosMenuProduct, nextStatus: ProductStatus) {
    setSavingProductId(product.id)
    try {
      await onProductStatusChange(product.id, nextStatus)
      setMenuStatusMessage(`${product.name} changed to ${productStatusLabel(nextStatus)}.`)
    } catch (error) {
      setMenuStatusMessage(error instanceof Error ? error.message : `Could not update ${product.name}.`)
    } finally {
      setSavingProductId(null)
    }
  }

  const settingSections: Array<{ id: SettingsSection; title: string; subtitle: string }> = [
    { id: 'menu', title: 'Menu List', subtitle: `${products.length} products` },
    { id: 'printing', title: 'Printing', subtitle: 'Receipt print setup' },
  ]

  return (
    <section className="settings-page">
      <aside className="settings-sidebar">
        <div className="settings-brand">
          <span>OOH POS Web</span>
          <strong>Settings</strong>
        </div>
        <nav aria-label="Settings sections">
          {settingSections.map((section) => (
            <button
              key={section.id}
              type="button"
              className={activeSection === section.id ? 'is-active' : ''}
              onClick={() => setActiveSection(section.id)}
            >
              <strong>{section.title}</strong>
              <span>{section.subtitle}</span>
            </button>
          ))}
        </nav>
        <div className="settings-profile-tile">
          <strong>{deviceId}</strong>
          <span>POS terminal</span>
        </div>
      </aside>

      <div className="settings-content">
        {activeSection === 'menu' ? (
          <section className="settings-panel">
            <SettingsPanelHeader title="Menu List" subtitle="Products and POS category visibility." />
            <p className="settings-menu-sync-status" role="status">{menuStatusMessage}</p>
            <div className="settings-menu-manager">
              <aside className="settings-menu-categories">
                <header>
                  <strong>Categories</strong>
                  <button type="button" aria-label="Add category">+</button>
                </header>
                <div className="settings-category-list">
                  {menuListCategories.map((category) => {
                    const isAll = category === 'All Items'
                    const isVisible = isAll || isKitchenCategoryEnabled(menuCategoriesEnabled, category)
                    const count = isAll ? products.length : countProductsForCategory(products, category)
                    return (
                      <button
                        key={category}
                        type="button"
                        className={`${activeMenuListCategory === category ? 'is-active' : ''} ${isVisible ? 'is-visible' : 'is-hidden'}`}
                        onClick={() => setActiveMenuListCategory(category)}
                      >
                        <span>{categoryIconLabel(category)}</span>
                        <strong>{category}</strong>
                        <em>{count}</em>
                      </button>
                    )
                  })}
                </div>
                {activeMenuListCategory !== 'All Items' ? (
                  <button
                    type="button"
                    className={`settings-category-kitchen-toggle ${isKitchenCategoryEnabled(menuCategoriesEnabled, activeMenuListCategory) ? 'is-enabled' : ''}`}
                    onClick={() => onToggleMenuCategory(activeMenuListCategory)}
                  >
                    <span>{isKitchenCategoryEnabled(menuCategoriesEnabled, activeMenuListCategory) ? 'Prints to kitchen' : 'Hidden from kitchen print'}</span>
                    <strong>{isKitchenCategoryEnabled(menuCategoriesEnabled, activeMenuListCategory) ? 'On' : 'Off'}</strong>
                  </button>
                ) : null}
                <button type="button" className="settings-add-category">+ Add Category</button>
              </aside>

              <div className="settings-menu-table">
                <div className="settings-menu-table-head">
                  <label aria-label="Select all menu items">
                    <input type="checkbox" />
                  </label>
                  <span>Item</span>
                  <span>Category</span>
                  <span>Price</span>
                  <span>Status</span>
                  <span>Actions</span>
                </div>
                <div className="settings-menu-table-body">
                  {menuListProducts.map((product) => (
                    <article key={product.id}>
                      <label aria-label={`Select ${product.name}`}>
                        <input type="checkbox" />
                      </label>
                      <div className="settings-menu-product-cell">
                        {product.imagePath ? <img src={product.imagePath} alt="" /> : <span>{initials(product.name)}</span>}
                        <strong>{product.name}</strong>
                      </div>
                      <span>{product.categoryName || 'Uncategorized'}</span>
                      <strong>{formatPhp(product.price)}</strong>
                      <div className="settings-product-status" aria-label={`${product.name} status`}>
                        {(['AVAILABLE', 'UNAVAILABLE', 'HIDDEN'] as ProductStatus[]).map((status) => (
                          <button
                            key={status}
                            type="button"
                            className={product.status === status ? `is-selected is-${status.toLowerCase()}` : ''}
                            disabled={savingProductId === product.id || product.status === status}
                            onClick={() => void setProductAvailability(product, status)}
                          >
                            {savingProductId === product.id && product.status !== status ? '...' : productStatusLabel(status)}
                          </button>
                        ))}
                      </div>
                      <button type="button" aria-label={`Actions for ${product.name}`}>...</button>
                    </article>
                  ))}
                </div>
                <footer className="settings-menu-table-footer">
                  <span>Showing 1 to {menuListProducts.length} of {menuListProducts.length} items</span>
                  <div>
                    <button type="button" aria-label="Previous page">&lt;</button>
                    <button type="button" className="is-current">1</button>
                    <button type="button" aria-label="Next page">&gt;</button>
                  </div>
                  <button type="button">10 / page</button>
                </footer>
              </div>
            </div>
          </section>
        ) : null}

        {activeSection === 'history' ? (
          <section className="settings-panel">
            <SettingsPanelHeader title="Order History" subtitle="Closed orders from the current shift." />
            <div className="settings-card history-card">
              <HistoryPage orders={history} products={products} kitchenCategorySettings={menuCategoriesEnabled} receiptCopies={receiptCopies} receiptPrintSettings={receiptPrintSettings} />
            </div>
          </section>
        ) : null}

        {activeSection === 'money' ? (
          <section className="settings-panel">
            <SettingsPanelHeader title="Money Movements" subtitle="Cash drawer and GCash records shared with Admin Web." />
            <div className="money-summary-grid">
              <article>
                <span>Cash Drawer</span>
                <strong>{formatPhp(cashBalance)}</strong>
                <small>{cashMovements.length} movements</small>
              </article>
              <article>
                <span>GCash</span>
                <strong>{formatPhp(gcashBalance)}</strong>
                <small>{gcashMovements.length} movements</small>
              </article>
            </div>
            <div className="settings-card money-entry-card">
              <h3>New Movement</h3>
              <div className="segmented-control">
                <button type="button" className={moneyAccount === 'cash' ? 'is-active' : ''} onClick={() => setMoneyAccount('cash')}>Cash</button>
                <button type="button" className={moneyAccount === 'gcash' ? 'is-active' : ''} onClick={() => setMoneyAccount('gcash')}>GCash</button>
              </div>
              <div className="segmented-control">
                <button type="button" className={movementDirection === 'in' ? 'is-active' : ''} onClick={() => setMovementDirection('in')}>Pay In</button>
                <button type="button" className={movementDirection === 'out' ? 'is-active' : ''} onClick={() => setMovementDirection('out')}>Pay Out</button>
              </div>
              <label>
                <span>Amount</span>
                <input inputMode="decimal" value={movementAmount} onChange={(event) => setMovementAmount(normalizeAmountInput(event.target.value))} placeholder="0.00" />
              </label>
              <label>
                <span>Note</span>
                <input value={movementNote} onChange={(event) => setMovementNote(event.target.value)} placeholder="Reason or shift note" />
              </label>
              <button type="button" className="settings-primary-button" onClick={saveMoneyMovement}>Save Movement</button>
              <p>{movementStatus}</p>
            </div>
            <div className="settings-card">
              <h3>Recent Movements</h3>
              <div className="movement-list">
                {recentMovements.length === 0 ? <EmptyState text="No money movements yet." /> : null}
                {recentMovements.map((movement) => (
                  <article key={movement.id}>
                    <div>
                      <strong>{movementAccountLabel(movement.accountId)}</strong>
                      <span>{movementKindLabel(movement.movementKind)} - {movement.reasonCategory}</span>
                    </div>
                    <em className={movementSignedAmount(movement) >= 0 ? 'is-positive' : 'is-negative'}>
                      {formatPhp(Math.abs(movement.amount))}
                    </em>
                  </article>
                ))}
              </div>
            </div>
          </section>
        ) : null}

        {activeSection === 'printing' ? (
          <section className="settings-panel">
            <SettingsPanelHeader title="Printing" subtitle="POS Web receipt setup for browser printing." />
            <div className="printing-settings-grid">
              <div className="settings-card printing-card">
                <h3>Receipt Behavior</h3>
                <SettingsToggle label="Auto print after payment" checked={autoPrintReceipt} onChange={onAutoPrintReceiptChange} />
                <label>
                  <span>Receipt copies</span>
                  <div className="receipt-copy-control">
                    <button type="button" onClick={() => onReceiptCopiesChange(receiptCopies - 1)} aria-label="Decrease receipt copies">-</button>
                    <input inputMode="numeric" value={String(receiptCopies)} onChange={(event) => onReceiptCopiesChange(normalizeReceiptCopies(event.target.value))} />
                    <button type="button" onClick={() => onReceiptCopiesChange(receiptCopies + 1)} aria-label="Increase receipt copies">+</button>
                  </div>
                </label>
                <div className="settings-action-row">
                  <button type="button" className="settings-primary-button" onClick={printTestReceipt}>Test Receipt</button>
                  <span>{printSettingsStatus}</span>
                </div>
              </div>

              <div className="settings-card printing-card">
                <h3>Receipt Format</h3>
                <div className="settings-field-group">
                  <span>Paper width</span>
                  <div className="segmented-control">
                    <button type="button" className={receiptPrintSettings.paperWidth === '80mm' ? 'is-active' : ''} onClick={() => updateReceiptPrintSettings({ paperWidth: '80mm' })}>80mm</button>
                    <button type="button" className={receiptPrintSettings.paperWidth === '58mm' ? 'is-active' : ''} onClick={() => updateReceiptPrintSettings({ paperWidth: '58mm' })}>58mm</button>
                  </div>
                </div>
                <div className="settings-field-group">
                  <span>Line detail</span>
                  <div className="segmented-control">
                    <button type="button" className={receiptPrintSettings.detailMode === 'standard' ? 'is-active' : ''} onClick={() => updateReceiptPrintSettings({ detailMode: 'standard' })}>Standard</button>
                    <button type="button" className={receiptPrintSettings.detailMode === 'compact' ? 'is-active' : ''} onClick={() => updateReceiptPrintSettings({ detailMode: 'compact' })}>Compact</button>
                  </div>
                </div>
                <SettingsToggle label="Print order notes" checked={receiptPrintSettings.includeOrderNote} onChange={(includeOrderNote) => updateReceiptPrintSettings({ includeOrderNote })} />
              </div>
            </div>
            <div className="settings-card">
              <h3>Paper Sensor Diagnostic</h3>
              <p>Remove the paper, close the printer cover, then run the check. Some printer models do not return sensor data over Bluetooth.</p>
              <div className="settings-action-row">
                <button type="button" className="settings-primary-button" onClick={checkPaperSensor}>Check Paper Sensor</button>
                <button type="button" onClick={() => setPrinterDetectionLog([])}>Clear Log</button>
                <span>{printerDetectionLog[0]?.state ?? 'Not checked yet'}</span>
              </div>
              <div className="movement-list">
                {printerDetectionLog.map((entry) => (
                  <article key={entry.checkedAt}>
                    <div>
                      <strong>{entry.state} · {entry.printer || 'No printer identified'}</strong>
                      <span>{entry.message}</span>
                    </div>
                    <em>{entry.rawStatus == null ? 'No raw byte' : `0x${entry.rawStatus.toString(16).padStart(2, '0').toUpperCase()}`}</em>
                  </article>
                ))}
              </div>
            </div>
            <div className="settings-card tablet-app-download-card">
              <div>
                <h3>Tablet Printer App</h3>
                <p>Install this Android wrapper on the tablet for silent Bluetooth thermal receipt printing.</p>
              </div>
              <a className="settings-primary-button" href={`${import.meta.env.BASE_URL}downloads/ooh-pos-tablet-debug.apk`} download>
                Download APK
              </a>
            </div>
          </section>
        ) : null}

      </div>
    </section>
  )
}

function SettingsPanelHeader({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <header className="settings-panel-header">
      <div>
        <h2>{title}</h2>
        <span>{subtitle}</span>
      </div>
    </header>
  )
}

function SettingsToggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (checked: boolean) => void }) {
  return (
    <button type="button" className={`settings-toggle ${checked ? 'is-active' : ''}`} onClick={() => onChange(!checked)}>
      <span>{label}</span>
      <strong>{checked ? 'On' : 'Off'}</strong>
    </button>
  )
}

function HistoryPage({
  orders,
  products,
  kitchenCategorySettings,
  receiptCopies,
  receiptPrintSettings,
}: {
  orders: RestaurantOrder[]
  products: PosMenuProduct[]
  kitchenCategorySettings: Record<string, boolean>
  receiptCopies: number
  receiptPrintSettings: ReceiptPrintSettings
}) {
  const [selectedOrderId, setSelectedOrderId] = useState(orders[0]?.id ?? '')
  const [historyStatus, setHistoryStatus] = useState('Showing closed orders from the current shift.')
  const visibleOrders = orders
  const selectedOrder = visibleOrders.find((order) => order.id === selectedOrderId) ?? visibleOrders[0] ?? null
  const categoryByProductId = useMemo(
    () => new Map(products.map((product) => [product.id, product.categoryName || 'Uncategorized'])),
    [products],
  )

  useEffect(() => {
    if (!selectedOrderId && visibleOrders[0]) {
      setSelectedOrderId(visibleOrders[0].id)
    }
  }, [selectedOrderId, visibleOrders])

  return (
    <div className="history-manager">
      <div className="history-list-panel">
        <div className="history-list-head">
          <strong>Closed Orders</strong>
          <span>{visibleOrders.length} orders</span>
        </div>
        <p className="history-sync-note">{historyStatus}</p>
        <div className="history-list">
          {visibleOrders.length === 0 ? <EmptyState text="No closed orders in this shift yet." /> : null}
          {visibleOrders.map((order) => (
            <button
              key={order.id}
              type="button"
              className={selectedOrder?.id === order.id ? 'is-selected' : ''}
              onClick={() => setSelectedOrderId(order.id)}
            >
              <div>
                <strong>{formatPosOrderRef(order.id)}</strong>
                <span>{formatOrderType(order.orderType)} - {formatOrderTime(order.createdAt)}</span>
              </div>
              <em>{formatPhp(orderTotal(order))}</em>
            </button>
          ))}
        </div>
      </div>

      <aside className="history-detail-panel">
        {selectedOrder ? (
          <>
            <header>
              <div>
                <span>Selected Order</span>
                <strong>{formatPosOrderRef(selectedOrder.id)}</strong>
              </div>
              <em className="is-paid">Paid</em>
            </header>
            <div className="history-detail-summary">
              <div>
                <span>Order Type</span>
                <strong>{formatOrderType(selectedOrder.orderType)}</strong>
              </div>
              <div>
                <span>Total</span>
                <strong>{formatPhp(orderTotal(selectedOrder))}</strong>
              </div>
              <div>
                <span>Payment</span>
                <strong>{historyPaymentLabel(selectedOrder)}</strong>
              </div>
            </div>
            <div className="history-detail-items">
              {selectedOrder.items.map((item) => (
                <article key={item.id}>
                  <span>{item.quantity}x</span>
                  <strong>{item.name}</strong>
                  <em>{formatPhp(item.price * item.quantity)}</em>
                </article>
              ))}
            </div>
            <section className="history-order-note">
              <span>Order Notes</span>
              <p>{selectedOrder.paymentNotes || 'No order notes recorded.'}</p>
            </section>
            <div className="history-actions">
              <button type="button" className="settings-primary-button" onClick={() => printOrderDocument(selectedOrder, 'customer-receipt', setHistoryStatus, receiptCopies, receiptPrintSettings)}>Print Receipt</button>
              <button type="button" onClick={() => printOrderDocument(selectedOrder, 'kitchen-ticket', setHistoryStatus, 1, receiptPrintSettings, kitchenCategorySettings, categoryByProductId)}>Print Kitchen Ticket</button>
              <button type="button" onClick={() => printOrderDocument(selectedOrder, 'customer-receipt', setHistoryStatus, receiptCopies, receiptPrintSettings)}>Reprint Summary</button>
            </div>
          </>
        ) : (
          <EmptyState text="Select an order to see print options." />
        )}
      </aside>
    </div>
  )
}

function PageHeader({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <header className="page-header">
      <div>
        <p className="eyebrow">Restaurant Flow</p>
        <h2>{title}</h2>
        <span>{subtitle}</span>
      </div>
    </header>
  )
}

function EmptyState({ text }: { text: string }) {
  return <div className="empty-state">{text}</div>
}

function OrderCardHeader({ order }: { order: RestaurantOrder }) {
  return (
    <header className="order-card-header">
      <div>
        <strong>{formatPosOrderRef(order.id)}</strong>
        <span>{formatOrderType(order.orderType)} - {formatOrderTime(order.createdAt)}</span>
      </div>
      <span className={`status-pill status-${order.status}`}>{statusLabel(order.status)}</span>
    </header>
  )
}

function ItemChecklist({
  order,
  onToggleItem,
  readOnly = false,
}: {
  order: RestaurantOrder
  onToggleItem: (orderId: string, itemId: string, served: boolean) => void
  readOnly?: boolean
}) {
  return (
    <div className="item-checklist">
      {order.items.map((item) => (
        <label key={item.id} className={item.served ? 'is-checked' : ''}>
          <input
            type="checkbox"
            checked={item.served}
            disabled={readOnly}
            onChange={(event) => onToggleItem(order.id, item.id, event.target.checked)}
          />
          <span>{item.quantity} x {item.name}</span>
        </label>
      ))}
    </div>
  )
}

function readDeviceId() {
  return window.localStorage.getItem('pos-web-device-id') || 'Tablet 1'
}

function readPrimaryNavCollapsed() {
  return window.localStorage.getItem('pos-web-primary-nav-collapsed') === '1'
}

function readActiveEmployeeId() {
  return window.localStorage.getItem('pos-web-active-employee-id') ?? ''
}

function readLocalPosEmployees(): PosEmployee[] {
  try {
    return normalizePosEmployees(JSON.parse(window.localStorage.getItem('admin-web-employees') ?? '{}') as Record<string, unknown>)
  } catch {
    return []
  }
}

function writeLocalPosEmployees(employees: PosEmployee[]) {
  window.localStorage.setItem('admin-web-employees', JSON.stringify({ employees }))
}

function normalizePosEmployees(setting: Record<string, unknown> | null): PosEmployee[] {
  const rawEmployees = Array.isArray(setting?.employees) ? setting.employees : []
  return rawEmployees
    .map((rawEmployee, index) => {
      const employee = typeof rawEmployee === 'object' && rawEmployee !== null ? rawEmployee as Record<string, unknown> : {}
      const name = String(employee.name ?? '').trim()
      if (!name) return null
      return {
        id: String(employee.id ?? `employee-${index}`),
        name,
        dailyRate: Math.max(0, Number(employee.dailyRate ?? employee.daily_rate ?? 0) || 0),
        isCashier: employee.isCashier !== false && employee.is_cashier !== false,
        isActive: employee.isActive !== false && employee.is_active !== false,
        pin: String(employee.pin ?? employee.loginPin ?? employee.login_pin ?? '').replace(/\D/g, '').slice(0, 6),
      }
    })
    .filter((employee): employee is PosEmployee => Boolean(employee))
}

function readAutoPrintReceipt() {
  return window.localStorage.getItem('pos-web-auto-print-receipt') === '1'
}

function readReceiptCopies() {
  return normalizeReceiptCopies(window.localStorage.getItem('pos-web-receipt-copies') ?? '1')
}

function readReceiptPrintSettings(): ReceiptPrintSettings {
  try {
    const raw = JSON.parse(window.localStorage.getItem('pos-web-receipt-print-settings') ?? '{}') as Partial<ReceiptPrintSettings>
    return {
      paperWidth: raw.paperWidth === '58mm' ? '58mm' : '80mm',
      detailMode: raw.detailMode === 'compact' ? 'compact' : 'standard',
      includeOrderNote: raw.includeOrderNote !== false,
    }
  } catch {
    return {
      paperWidth: '80mm',
      detailMode: 'standard',
      includeOrderNote: true,
    }
  }
}

type EmployeeConsumptionRecord = {
  id: string
  employeeId: string
  employeeName: string
  orderId: string
  displayOrderId: string
  amount: number
  recordedAt: string
}

function readPrinterDetectionLog(): PrinterDetectionLogEntry[] {
  try {
    const parsed = JSON.parse(window.localStorage.getItem('pos-web-printer-detection-log') ?? '[]')
    return Array.isArray(parsed) ? parsed.slice(0, 10) as PrinterDetectionLogEntry[] : []
  } catch {
    return []
  }
}

function readKitchenPrintCategorySettings(): Record<string, boolean> {
  try {
    const raw = JSON.parse(window.localStorage.getItem('pos-web-kitchen-print-categories') ?? '{}') as Record<string, unknown>
    return Object.fromEntries(
      Object.entries(raw)
        .filter(([category]) => category.trim().length > 0)
        .map(([category, enabled]) => [category, enabled !== false]),
    )
  } catch {
    return {}
  }
}

function isKitchenCategoryEnabled(settings: Record<string, boolean>, category: string) {
  return settings[category] !== false
}

function kitchenPrintableItems(
  items: OrderItem[],
  kitchenCategorySettings: Record<string, boolean>,
  categoryByProductId: Map<string, string>,
) {
  return items.filter((item) => {
    const category = categoryByProductId.get(item.productId) || item.categoryName || itemCategory(item.name)
    return isKitchenCategoryEnabled(kitchenCategorySettings, category)
  })
}

function normalizeReceiptCopies(value: string | number) {
  const numeric = typeof value === 'number' ? value : Number(value.replace(/\D/g, ''))
  if (!Number.isFinite(numeric)) return 1
  return Math.min(10, Math.max(1, Math.trunc(numeric)))
}

function buildTestReceipt(deviceId: string): CompletedOrder {
  return {
    deviceOrderId: createDeviceOrderId(deviceId, 1, Date.now()),
    deviceId,
    createdAt: new Date().toISOString(),
    serviceMode: 'DINE IN',
    payment: {
      method: 'CASH',
      paymentReference: null,
      cashAmount: 500,
      gcashAmount: null,
      gcashReferenceLast4: null,
      amountReceived: 500,
      changeAmount: 155,
    },
    orderNote: 'Sample cashier note',
    totals: {
      subtotal: 345,
      tax: 0,
      total: 345,
    },
    items: [
      {
        productId: 'sample-meal',
        name: 'Sample Meal',
        serviceMode: 'DINE IN',
        isHalfOrder: false,
        quantity: 2,
        price: 120,
        lineTotal: 240,
        kitchenStatus: 'PENDING',
        isChecked: true,
      },
      {
        productId: 'sample-drink',
        name: 'Iced Tea',
        serviceMode: 'TAKE OUT',
        isHalfOrder: false,
        quantity: 1,
        price: 105,
        lineTotal: 105,
        kitchenStatus: 'PENDING',
        isChecked: true,
      },
    ],
  }
}

function formatPhp(value: number) {
  return new Intl.NumberFormat('en-PH', {
    style: 'currency',
    currency: 'PHP',
    minimumFractionDigits: 2,
  }).format(value)
}

function formatPosOrderRef(value: string) {
  const cleaned = value.trim()
  const match = cleaned.match(/(\d{4})(\d{2})(\d{2})\d{6}-(\d{4,})$/)
  if (match) {
    return `#${match[2]}${match[3]}-${match[4]}`
  }

  const lastSegment = cleaned.split('-').filter(Boolean).at(-1)
  if (lastSegment && /^\d{4,}$/.test(lastSegment)) {
    return `#${lastSegment}`
  }

  if (/^#?\d{1,6}$/.test(cleaned)) {
    return cleaned.startsWith('#') ? cleaned : `#${cleaned.padStart(4, '0')}`
  }

  const digits = cleaned.replace(/\D/g, '')
  if (digits.length >= 5) {
    return `#${digits.slice(-5)}`
  }

  return cleaned || '#----'
}

function initials(value: string) {
  return value
    .split(' ')
    .map((part) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase()
}

function categoryIconLabel(category: string) {
  if (category === 'All Items') return 'AI'
  return initials(category).slice(0, 2) || 'CT'
}

function resolveHalfOrderPrice(product: PosMenuProduct) {
  if (typeof product.halfOrderPrice === 'number'
    && Number.isFinite(product.halfOrderPrice)
    && product.halfOrderPrice > 0) {
    return roundCurrency(product.halfOrderPrice)
  }
  if (!Number.isFinite(product.price) || product.price <= 0) return null
  return roundCurrency(product.price / 2)
}

function productStatusLabel(status: string) {
  switch (status) {
    case 'AVAILABLE':
      return 'Available'
    case 'HIDDEN':
      return 'Hidden'
    case 'UNAVAILABLE':
      return 'Unavailable'
    default:
      return status || 'Unknown'
  }
}

function historyPaymentLabel(order: RestaurantOrder) {
  if (order.paymentMethod === 'gcash') return 'GCash'
  if (order.paymentMethod === 'split') return 'Split Cash/GCash'
  if (order.paymentMethod === 'cash') return 'Cash'
  return 'Not recorded'
}

function mapAdminOrderToRestaurantOrder(order: OrderRecord): RestaurantOrder {
  const workflowStatus = normalizeStatusToken(order.workflowStatus)
  const paymentStatus = normalizeStatusToken(order.paymentStatus)
  const paid = paymentStatus === 'PAID' || workflowStatus === 'PAID'
  const workflowReadyForPayment = isReadyForPaymentStatus(workflowStatus) || isReadyForPaymentStatus(paymentStatus)
  const mappedItems = order.items.map((item, index) => {
    const quantity = Math.max(1, Number(item.quantity) || 1)
    const price = item.price ?? roundCurrency((item.lineTotal || 0) / quantity)
    const itemServed = Boolean(item.isChecked) || isReadyForPaymentStatus(normalizeStatusToken(item.kitchenStatus)) || paid
    return {
      id: `${order.deviceOrderId}-${index}`,
      productId: item.productId ?? `${order.deviceOrderId}-${index}`,
      categoryName: item.categoryName ?? itemCategory(item.name),
      name: item.name,
      quantity,
      price,
      served: itemServed,
      paidQuantity: paid ? quantity : 0,
      kitchenPrintedQuantity: Math.min(quantity, Math.max(0, Number(item.kitchenPrintedQuantity) || 0)),
      orderType: normalizeOrderType(item.serviceMode || order.serviceMode),
      isHalfOrder: Boolean(item.isHalfOrder),
    }
  })
  const allMappedItemsServed = mappedItems.length > 0 && mappedItems.every((item) => item.served)
  const readyForPayment = paid || workflowReadyForPayment || allMappedItemsServed
  return {
    id: order.deviceOrderId,
    deviceOrderId: order.deviceOrderId,
    items: mappedItems,
    status: paid ? 'paid' : readyForPayment ? 'served' : 'preparing',
    paid,
    readyForPayment,
    paymentReceived: (order.cashAmount ?? 0) + (order.gcashAmount ?? 0),
    paymentMethod: normalizePaymentMethod(order.paymentMethod),
    paymentReference: order.paymentReference ?? order.gcashReferenceLast4 ?? '',
    paymentNotes: order.orderNote ?? '',
    orderType: normalizeOrderType(order.serviceMode),
    createdAt: Date.parse(order.createdAt) || Date.now(),
    shiftId: order.shiftId ?? null,
    shiftSessionId: order.shiftSessionId ?? null,
  }
}

function normalizeStatusToken(value: string | null | undefined) {
  return String(value ?? '').trim().toUpperCase().replace(/[^A-Z0-9]+/g, '_').replace(/^_+|_+$/g, '')
}

function isReadyForPaymentStatus(status: string) {
  return [
    'SERVED',
    'READY',
    'READY_TO_SERVE',
    'WAITING_PAYMENT',
    'WAITING_FOR_PAYMENT',
    'PENDING_PAYMENT',
    'AWAITING_PAYMENT',
  ].includes(status)
}

function normalizeOrderType(value: string | null | undefined): OrderType {
  const normalized = (value || '').toUpperCase().replaceAll('_', ' ')
  return normalized.includes('TAKE') ? 'TAKE OUT' : 'DINE IN'
}

function normalizePaymentMethod(value: string): PaymentMethod | null {
  const normalized = value.toLowerCase()
  if (normalized.includes('split')) return 'split'
  if (normalized.includes('gcash')) return 'gcash'
  if (normalized.includes('cash')) return 'cash'
  return null
}

function sameCategory(expected: string, actual: string) {
  const normalizedExpected = normalizeCategory(expected)
  const normalizedActual = normalizeCategory(actual)
  if (normalizedExpected === 'addons') return normalizedActual.includes('addon') || normalizedActual.includes('add-on')
  return normalizedExpected === normalizedActual
}

function normalizeCategory(value: string) {
  return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, '')
}

function tabTitle(tab: MainTab) {
  switch (tab) {
    case 'kitchen':
      return 'Pending Payment'
    case 'ongoing':
      return 'Ongoing Orders'
    case 'sale-tracker':
      return 'Sale Tracker'
    case 'settings':
      return 'Settings'
    default:
      return 'Meals'
  }
}

function allItemsServed(order: RestaurantOrder) {
  return order.items.length > 0 && order.items.every((item) => item.served)
}

function statusLabel(status: OrderStatus) {
  switch (status) {
    case 'preparing':
      return 'Preparing'
    case 'served':
      return 'Served'
    default:
      return 'Paid'
  }
}

function orderTotal(order: RestaurantOrder) {
  const subtotal = order.items.reduce((sum, item) => sum + item.price * item.quantity, 0)
  return roundCurrency(subtotal + subtotal * taxRate)
}

function orderBalance(order: RestaurantOrder) {
  return Math.max(0, roundCurrency(orderTotal(order) - order.paymentReceived))
}

function paymentStatus(order: RestaurantOrder): Exclude<PaymentFilter, 'all'> {
  if (order.paid || order.paymentReceived >= orderTotal(order)) return 'paid'
  if (order.paymentReceived > 0) return 'partial'
  return 'waiting'
}

function paymentStatusLabel(status: Exclude<PaymentFilter, 'all'>) {
  switch (status) {
    case 'paid':
      return 'Paid'
    case 'partial':
      return 'Partial Payment'
    default:
      return 'Pending Payment'
  }
}

function paymentModeLabel(mode: PaymentModeId) {
  return paymentModeTiles.find((tile) => tile.id === mode)?.label ?? 'Payment'
}

function resolvePaymentModeAmount(
  mode: PaymentModeId,
  values: { balance: number; customAmount: number; peopleCount: number; selectedItemsTotal: number },
) {
  switch (mode) {
    case 'split-items':
      return roundCurrency(values.selectedItemsTotal)
    case 'split-people':
      return roundCurrency(values.balance / Math.max(1, values.peopleCount))
    case 'custom':
      return roundCurrency(values.customAmount)
    case 'combine':
    case 'other':
    case 'full':
    default:
      return roundCurrency(values.balance)
  }
}

function formatOrderType(type: OrderType | 'MIXED') {
  if (type === 'DINE IN') return 'Dine In'
  if (type === 'TAKE OUT') return 'Takeout'
  return 'Mixed'
}

function ticketOrderType(items: TicketItem[]): OrderType | 'MIXED' {
  const first = items[0]?.orderType
  if (!first) return 'DINE IN'
  return items.every((item) => item.orderType === first) ? first : 'MIXED'
}

function printOrderDocument(
  order: RestaurantOrder,
  documentType: PrintDocumentType,
  setStatusMessage: (message: string) => void,
  copies = 1,
  settings: ReceiptPrintSettings = readReceiptPrintSettings(),
  kitchenCategorySettings: Record<string, boolean> = readKitchenPrintCategorySettings(),
  categoryByProductId: Map<string, string> = new Map(),
): boolean {
  try {
    const printOrder = toCompletedPrintOrder(order, documentType === 'kitchen-ticket' ? { kitchenCategorySettings, categoryByProductId } : undefined)
    if (documentType === 'kitchen-ticket' && printOrder.items.length === 0) {
      setStatusMessage(`${formatPosOrderRef(order.id)} has no items in the selected kitchen print categories.`)
      return false
    }
    printPosDocument(printOrder, documentType, { copies, ...settings })
    const copyLabel = documentType === 'customer-receipt' && copies > 1 ? ` (${copies} copies)` : ''
    setStatusMessage(`${formatPosOrderRef(order.id)} ${documentType === 'kitchen-ticket' ? 'kitchen ticket' : 'receipt'} sent to printer${copyLabel}.`)
    return true
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Could not print order.'
    setStatusMessage(message)
    if (message.toLowerCase().includes('paper is out')) {
      window.alert(message)
    }
    return false
  }
}

function toCompletedPrintOrder(
  order: RestaurantOrder,
  options?: {
    kitchenCategorySettings: Record<string, boolean>
    categoryByProductId: Map<string, string>
  },
): CompletedOrder {
  const sourceItems = options
    ? kitchenPrintableItems(order.items, options.kitchenCategorySettings, options.categoryByProductId)
    : order.items
  const subtotal = sourceItems.reduce((sum, item) => sum + item.price * item.quantity, 0)
  const tax = roundCurrency(subtotal * taxRate)
  const total = roundCurrency(subtotal + tax)
  const paymentMethod = (order.paymentMethod ?? 'cash').toUpperCase() as CompletedOrder['payment']['method']
  return {
    deviceOrderId: order.deviceOrderId || order.id,
    deviceId: orderDeviceLabel(order),
    createdAt: new Date(order.createdAt).toISOString(),
    serviceMode: order.orderType,
    payment: {
      method: paymentMethod,
      paymentReference: order.paymentReference || null,
      cashAmount: order.paymentMethod === 'cash' || order.paymentMethod === 'split' ? order.paymentReceived : null,
      gcashAmount: order.paymentMethod === 'gcash' ? order.paymentReceived : null,
      gcashReferenceLast4: order.paymentReference.replace(/\D/g, '').slice(-4) || null,
      amountReceived: order.paymentReceived || total,
      changeAmount: Math.max(0, roundCurrency((order.paymentReceived || total) - total)),
    },
    orderNote: order.paymentNotes || null,
    totals: { subtotal: roundCurrency(subtotal), tax, total },
    items: sourceItems.map((item) => ({
      productId: item.productId,
      categoryName: options?.categoryByProductId.get(item.productId) || item.categoryName || itemCategory(item.name),
      name: item.name,
      serviceMode: item.orderType,
      isHalfOrder: item.isHalfOrder,
      quantity: item.quantity,
      price: item.price,
      lineTotal: roundCurrency(item.price * item.quantity),
      kitchenStatus: 'PENDING',
      isChecked: item.served,
    })),
  }
}

function orderItemToTicketItem(item: OrderItem): TicketItem {
  return {
    lineId: item.id,
    productId: item.productId,
    categoryName: item.categoryName,
    name: item.name,
    price: item.price,
    quantity: item.quantity,
    imagePath: null,
    orderType: item.orderType,
    isHalfOrder: item.isHalfOrder,
  }
}

function formatOrderTime(timestamp: number) {
  return new Intl.DateTimeFormat('en-PH', {
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(timestamp))
}

function minutesAgo(timestamp: number) {
  return Math.max(0, Math.round((Date.now() - timestamp) / 60000))
}

function normalizeAmountInput(value: string) {
  const normalized = value.replace(/[^\d.]/g, '')
  const [whole, ...decimalParts] = normalized.split('.')
  const decimal = decimalParts.join('').slice(0, 2)
  return decimalParts.length > 0 ? `${whole || '0'}.${decimal}` : whole
}

function roundCurrency(value: number) {
  return Math.round(value * 100) / 100
}

function paymentMethodText(method: SalePayment['method']) {
  if (method === 'gcash') return 'GCash'
  if (method === 'cash') return 'Cash'
  return 'Other'
}

function tableNumber(orderId: string) {
  const numeric = Number(orderId.replace(/\D/g, '')) || 1
  return (numeric % 6) + 1
}

function parsePreparedOrderNote(note: string) {
  const customerMatch = note.match(/(?:^|\|\s*)Customer:\s*(.*?)(?=\s*\|\s*Kitchen:|$)/i)
  const kitchenMatch = note.match(/(?:^|\|\s*)Kitchen:\s*(.*)$/i)
  const customerParts = (customerMatch?.[1] ?? '').split(/\s+-\s+/).map((part) => part.trim()).filter(Boolean)
  const table = customerParts.find((part) => /^Table [1-6]$/i.test(part)) ?? ''
  const colorPart = customerParts.find((part) => /^(Red|Blue|Green|Yellow|Black|White) shirt$/i.test(part)) ?? ''
  const identifier = customerParts.find((part) => kitchenIdentifierTags.some((tag) => tag.toLowerCase() === part.toLowerCase())) ?? ''
  const customerNote = customerParts.filter((part) => part !== table && part !== colorPart && part !== identifier).join(' - ')
  return {
    table: table ? `Table ${table.match(/\d/)?.[0]}` : '',
    color: colorPart.replace(/ shirt$/i, ''),
    identifier,
    customerNote: customerMatch ? customerNote : '',
    kitchenNote: kitchenMatch?.[1]?.trim() ?? (customerMatch ? '' : note.trim()),
  }
}

function buildOccupiedTableMap(orders: RestaurantOrder[], excludedOrderId?: string): Record<string, 'Preparing' | 'Pending Payment'> {
  return orders.reduce<Record<string, 'Preparing' | 'Pending Payment'>>((occupied, order) => {
    if (order.id === excludedOrderId || order.paid) return occupied
    const match = order.paymentNotes.match(/\bTable\s+([1-6])\b/i)
    if (!match) return occupied
    const table = `Table ${match[1]}`
    const status = order.readyForPayment ? 'Pending Payment' : 'Preparing'
    if (!occupied[table] || status === 'Pending Payment') occupied[table] = status
    return occupied
  }, {})
}

function itemCategory(itemName: string) {
  const normalized = itemName.toLowerCase()
  if (/\b(tea|water|coke|drink|softdrink|juice)\b/.test(normalized)) return 'Drinks'
  if (/\brice\b/.test(normalized)) return 'Side'
  if (normalized.includes('custom')) return 'Custom'
  return 'Main Dish'
}

function countProductsForCategory(products: PosMenuProduct[], category: string) {
  return products.filter((product) => sameCategory(category, product.categoryName)).length
}

async function fetchSalePayments() {
  const supabase = requireSupabase()
  const orderRows = await fetchSalePaymentsFromOrders()
  const eventRows = await fetchSalePaymentsFromShiftEvents(orderRows)
  const { data, error } = await supabase
    .from('payments')
    .select('id,order_id,customer_name,amount,method,status,created_at,collection_shift_id,shift_session_id')
    .order('created_at', { ascending: false })

  if (error) {
    if (isMissingTableError(error)) {
      return mergeSalePaymentRows(eventRows, orderRows)
    }
    throw error
  }

  const paymentRows = (data ?? []).map(mapSalePaymentRow)
  return mergeSalePaymentRows([...eventRows, ...paymentRows], orderRows)
}

function buildKitchenPrintDelta(previousOrder: RestaurantOrder, updatedOrder: RestaurantOrder): RestaurantOrder {
  const previousQuantityByItemId = new Map(previousOrder.items.map((item) => [item.id, item.quantity]))
  const items = updatedOrder.items.flatMap((item) => {
    const addedQuantity = item.quantity - (previousQuantityByItemId.get(item.id) ?? 0)
    return addedQuantity > 0 ? [{ ...item, quantity: addedQuantity }] : []
  })
  return {
    ...updatedOrder,
    items,
  }
}

function markKitchenItemsPrinted(order: RestaurantOrder, itemIds?: Set<string>): RestaurantOrder {
  return {
    ...order,
    items: order.items.map((item) => itemIds && !itemIds.has(item.id)
      ? item
      : { ...item, kitchenPrintedQuantity: item.quantity }),
  }
}

async function fetchSalePaymentsFromShiftEvents(orderRows: SalePayment[]) {
  const supabase = requireSupabase()
  const { data, error } = await supabase
    .from('shift_payment_events')
    .select('id,order_id,collection_shift_id,shift_session_id,method,amount,collected_by,collected_at')
    .order('collected_at', { ascending: false })

  if (error) {
    if (isMissingTableError(error)) return []
    throw error
  }

  const orderById = new Map(orderRows.map((row) => [row.orderId, row]))
  return (data ?? []).flatMap((row): SalePayment[] => {
    const order = orderById.get(String(row.order_id ?? ''))
    // Match the Admin shift report: stale payment events must not contribute
    // after their source order has been deleted or replaced.
    if (!order) return []
    const method = String(row.method ?? 'other').toLowerCase()
    return [{
      id: String(row.id ?? ''),
      orderId: String(row.order_id ?? ''),
      customerName: String(row.collected_by ?? order.customerName ?? ''),
      amount: Number(row.amount ?? 0) || 0,
      method: method === 'cash' || method === 'gcash' ? method : 'other',
      status: 'paid',
      createdAt: String(row.collected_at ?? order.createdAt ?? new Date().toISOString()),
      items: order.items,
      orderNote: order.orderNote,
      shiftId: row.collection_shift_id ? String(row.collection_shift_id) : null,
      shiftSessionId: row.shift_session_id ? String(row.shift_session_id) : null,
    }]
  })
}

async function fetchSalePaymentsFromOrders() {
  const supabase = requireSupabase()
  const { data, error } = await supabase
    .from('orders')
    .select('device_order_id,device_id,payment_method,payment_status,workflow_status,cash_amount,gcash_amount,total,items_json,order_note,created_at,shift_id,shift_session_id')
    .order('created_at', { ascending: false })

  if (error) throw error
  return (data ?? []).flatMap(mapOrderRowToSalePayments)
}

function mapSalePaymentRow(row: Record<string, unknown>): SalePayment {
  const method = String(row.method ?? 'other').toLowerCase()
  const status = String(row.status ?? 'unpaid').toLowerCase()
  return {
    id: String(row.id ?? ''),
    orderId: String(row.order_id ?? ''),
    customerName: String(row.customer_name ?? ''),
    amount: Number(row.amount ?? 0) || 0,
    method: method === 'cash' || method === 'gcash' ? method : 'other',
    status: status === 'paid' ? 'paid' : 'unpaid',
    createdAt: String(row.created_at ?? new Date().toISOString()),
    items: [],
    shiftId: row.collection_shift_id ? String(row.collection_shift_id) : null,
    shiftSessionId: row.shift_session_id ? String(row.shift_session_id) : null,
  }
}

function mergeSalePaymentRows(paymentRows: SalePayment[], orderRows: SalePayment[]) {
  const orderRowsByOrderId = new Map(orderRows.map((row) => [row.orderId, row]))
  const uniquePaymentRows = paymentRows.filter((payment, index, rows) => rows.findIndex((candidate) => salePaymentKey(candidate) === salePaymentKey(payment)) === index)
  const merged = uniquePaymentRows.map((payment) => {
    const order = orderRowsByOrderId.get(payment.orderId)
    if (!order) return payment
    return {
      ...payment,
      items: payment.items.length > 0 ? payment.items : order.items,
      shiftId: payment.shiftId ?? order.shiftId,
      shiftSessionId: payment.shiftSessionId ?? order.shiftSessionId,
      customerName: payment.customerName || order.customerName,
      createdAt: payment.createdAt || order.createdAt,
      orderNote: payment.orderNote || order.orderNote,
    }
  })
  const existingKeys = new Set(merged.map(salePaymentKey))
  orderRows.forEach((order) => {
    if (!existingKeys.has(salePaymentKey(order))) {
      merged.push(order)
    }
  })
  return merged.sort((left, right) => Date.parse(right.createdAt) - Date.parse(left.createdAt))
}

function salePaymentKey(payment: SalePayment) {
  return `${payment.orderId}:${payment.method}:${payment.status}`
}

function salePaymentBelongsToShift(payment: SalePayment, shiftSession: ShiftSession) {
  return paymentBelongsToActiveShift(payment, shiftSession)
}

function cashMovementBelongsToShift(movement: CashMovement, shiftSession: ShiftSession) {
  if (movement.shiftId === shiftSession.shiftId || movement.shiftSessionId === shiftSession.id) return true
  return recordCreatedDuringShift(new Date(movement.createdAtEpochMillis).toISOString(), shiftSession)
}

function shiftAdjustmentBelongsToShift(adjustment: ShiftAdjustment, shiftSession: ShiftSession) {
  if (adjustment.shiftId === shiftSession.shiftId || adjustment.shiftSessionId === shiftSession.id) return true
  return recordCreatedDuringShift(adjustment.requestedAt, shiftSession)
}

function recordCreatedDuringShift(createdAt: string, shiftSession: ShiftSession) {
  const created = Date.parse(createdAt)
  const opened = Date.parse(shiftSession.clockedInAt)
  const closed = shiftSession.clockedOutAt ? Date.parse(shiftSession.clockedOutAt) : Date.now()
  return Number.isFinite(created) && Number.isFinite(opened) && created >= opened && created <= closed
}

function mapOrderRowToSalePayments(row: Record<string, unknown>): SalePayment[] {
  const orderId = String(row.device_order_id ?? '')
  const createdAt = String(row.created_at ?? new Date().toISOString())
  const customerName = String(row.device_id ?? 'POS Customer')
  const paymentStatus = String(row.payment_status ?? '').toLowerCase()
  const workflowStatus = String(row.workflow_status ?? '').toLowerCase()
  const paymentMethod = String(row.payment_method ?? '').toLowerCase()
  const total = Number(row.total ?? 0) || 0
  const cashAmount = Number(row.cash_amount ?? 0) || 0
  const gcashAmount = Number(row.gcash_amount ?? 0) || 0
  const isPaid = paymentStatus === 'paid' || workflowStatus === 'paid' || paymentMethod === 'paid'
  const items = mapSalePaymentItems(row.items_json)
  const orderNote = row.order_note ? String(row.order_note) : ''

  if (!isPaid) {
    return [{
      id: `${orderId || createdAt}-unpaid`,
      orderId,
      customerName,
      amount: total,
      method: 'other',
      status: 'unpaid',
      createdAt,
      items,
      orderNote,
      shiftId: row.shift_id ? String(row.shift_id) : null,
      shiftSessionId: row.shift_session_id ? String(row.shift_session_id) : null,
    }]
  }

  const rows: SalePayment[] = []
  if (cashAmount > 0) {
    rows.push({
      id: `${orderId || createdAt}-cash`,
      orderId,
      customerName,
      amount: cashAmount,
      method: 'cash',
      status: 'paid',
      createdAt,
      items,
      orderNote,
      shiftId: row.shift_id ? String(row.shift_id) : null,
      shiftSessionId: row.shift_session_id ? String(row.shift_session_id) : null,
    })
  }
  if (gcashAmount > 0) {
    rows.push({
      id: `${orderId || createdAt}-gcash`,
      orderId,
      customerName,
      amount: gcashAmount,
      method: 'gcash',
      status: 'paid',
      createdAt,
      items,
      orderNote,
      shiftId: row.shift_id ? String(row.shift_id) : null,
      shiftSessionId: row.shift_session_id ? String(row.shift_session_id) : null,
    })
  }

  if (rows.length > 0) return rows

  return [{
    id: orderId || createdAt,
    orderId,
    customerName,
    amount: total,
    method: paymentMethod.includes('gcash') ? 'gcash' : paymentMethod.includes('cash') ? 'cash' : 'other',
    status: 'paid',
    createdAt,
    items,
    orderNote,
    shiftId: row.shift_id ? String(row.shift_id) : null,
    shiftSessionId: row.shift_session_id ? String(row.shift_session_id) : null,
  }]
}

function mapSalePaymentItems(value: unknown): SalePayment['items'] {
  if (!Array.isArray(value)) return []
  return value.map((rawItem) => {
    const item = typeof rawItem === 'object' && rawItem !== null ? rawItem as Record<string, unknown> : {}
    const quantity = Math.max(1, Number(item.quantity ?? 1) || 1)
    const lineTotal = Number(item.lineTotal ?? item.line_total ?? 0) || 0
    const price = Number(item.price ?? 0) || (lineTotal > 0 ? roundCurrency(lineTotal / quantity) : 0)
    return {
      name: String(item.name ?? 'Item'),
      quantity,
      price,
    }
  })
}

async function fetchExpenseCategorySettings(): Promise<ExpenseCategorySetting[]> {
  if (!hasSupabaseConfig) return []
  const supabase = requireSupabase()
  const { data, error } = await supabase
    .from('admin_settings')
    .select('value')
    .eq('key', 'expense_categories')
    .maybeSingle()

  if (error) throw error
  return normalizeExpenseCategorySettings((data as { value?: unknown } | null)?.value)
}

function normalizeExpenseCategorySettings(value: unknown): ExpenseCategorySetting[] {
  const rawCategories = Array.isArray(value)
    ? value
    : typeof value === 'object' && value !== null && Array.isArray((value as { categories?: unknown }).categories)
      ? (value as { categories: unknown[] }).categories
      : []

  return rawCategories
    .map((rawCategory, index) => {
      const category = typeof rawCategory === 'object' && rawCategory !== null ? rawCategory as Record<string, unknown> : {}
      const name = String(category.name ?? category.label ?? '').trim()
      if (!name) return null
      const rawSubcategories = Array.isArray(category.subcategories)
        ? category.subcategories
        : Array.isArray(category.children)
          ? category.children
          : []
      return {
        id: String(category.id ?? normalizeCategory(name) ?? `expense-category-${index}`),
        name,
        subcategories: rawSubcategories
          .map((rawSubcategory, subIndex) => {
            const subcategory = typeof rawSubcategory === 'object' && rawSubcategory !== null ? rawSubcategory as Record<string, unknown> : {}
            const subName = String(subcategory.name ?? subcategory.label ?? rawSubcategory ?? '').trim()
            if (!subName) return null
            return {
              id: String(subcategory.id ?? `${normalizeCategory(name)}-${normalizeCategory(subName) || subIndex}`),
              name: subName,
            }
          })
          .filter((subcategory): subcategory is { id: string; name: string } => Boolean(subcategory)),
      }
    })
    .filter((category): category is ExpenseCategorySetting => Boolean(category))
}

async function saveExpenseMovement(input: {
  deviceId: string
  amount: number
  category: ExpenseCategorySetting
  subcategory?: { id: string; name: string }
  paymentMethod: ExpensePaymentMethod
  note: string
  shiftSession: ShiftSession | null
  staffName: string
}) {
  const account = expenseAccountForPaymentMethod(input.paymentMethod, input.deviceId)
  const reasonCategory = [input.category.name, input.subcategory?.name].filter(Boolean).join(' / ')
  const movement: CashMovement = {
    id: `pos-expense-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    accountId: account.accountId,
    accountType: account.accountType,
    sourceAccountId: account.accountId,
    destinationAccountId: null,
    movementKind: 'PAY_OUT',
    reasonCategory,
    amount: roundCurrency(input.amount),
    note: input.note.trim() || `POS expense paid by ${expensePaymentLabel(input.paymentMethod)}`,
    relatedBillId: null,
    createdBy: input.staffName,
    createdAtEpochMillis: Date.now(),
    shiftId: input.shiftSession?.shiftId ?? null,
    shiftSessionId: input.shiftSession?.id ?? null,
  }
  await upsertCashMovements([movement])
}

function expenseAccountForPaymentMethod(paymentMethod: ExpensePaymentMethod, deviceId: string): Pick<CashMovement, 'accountId' | 'accountType'> {
  switch (paymentMethod) {
    case 'gcash':
      return { accountId: 'bank-gcash', accountType: 'BANK' }
    case 'cash':
    default:
      return { accountId: normalizeAccountId(deviceId), accountType: 'TABLET_DRAWER' }
  }
}

function expensePaymentLabel(paymentMethod: ExpensePaymentMethod) {
  switch (paymentMethod) {
    case 'gcash':
      return 'GCash'
    default:
      return 'Cash'
  }
}

function isMissingTableError(error: unknown) {
  const record = error as { code?: string; message?: string }
  const message = record.message?.toLowerCase() ?? ''
  return record.code === 'PGRST205'
    || message.includes('could not find the table')
    || message.includes('schema cache')
}

function createDeviceOrderId(deviceId: string, orderNumber: number, createdAt: number) {
  const safeDevice = normalizeAccountId(deviceId).toUpperCase()
  const compactTime = new Date(createdAt).toISOString().replace(/[-:.TZ]/g, '').slice(0, 14)
  return `${safeDevice}-${compactTime}-${String(orderNumber).padStart(4, '0')}`
}

async function syncOrderSnapshot(order: RestaurantOrder, setStatusMessage: (message: string) => void) {
  if (!hasSupabaseConfig) {
    saveLocalOrderPreview(order)
    setStatusMessage(`${order.id} saved locally. Supabase config is missing.`)
    return
  }

  try {
    const supabase = requireSupabase()
    const fullPayload = buildSupabaseOrderPayload(order, true)
    const fullResult = await supabase.from('orders').upsert(fullPayload, { onConflict: 'device_order_id' })
    if (!fullResult.error) {
      setStatusMessage(`${order.id} synced to Supabase.`)
      return
    }

    if (!isMissingOptionalOrderColumn(fullResult.error)) {
      throw fullResult.error
    }

    const baseResult = await supabase.from('orders').upsert(buildSupabaseOrderPayload(order, false), { onConflict: 'device_order_id' })
    if (baseResult.error) throw baseResult.error
    setStatusMessage(`${order.id} synced to Supabase with base order fields.`)
  } catch (error) {
    setStatusMessage(`${order.id} sync failed: ${error instanceof Error ? error.message : 'Unknown Supabase error.'}`)
  }
}

async function syncPaymentSnapshot(
  order: RestaurantOrder,
  setStatusMessage: (message: string) => void,
  payment?: OrderPaymentInput,
  shiftSession?: ShiftSession | null,
  collectedBy = 'POS Web',
) {
  if (!hasSupabaseConfig) return

  try {
    const supabase = requireSupabase()
    const rows = buildPaymentRows(order, payment).map((row) => ({
      ...row,
      customer_name: collectedBy,
      origin_shift_id: order.shiftId,
      collection_shift_id: row.status === 'paid' ? shiftSession?.shiftId ?? null : null,
      shift_session_id: row.status === 'paid' ? shiftSession?.id ?? null : null,
    }))
    if (rows.length === 0) return
    const { error } = await supabase.from('payments').upsert(rows, { onConflict: 'id' })
    if (error) {
      if (!isMissingTableError(error)) throw error
    }
    const eventRows = rows.filter((row) => row.status === 'paid' && row.shift_session_id && (row.method === 'cash' || row.method === 'gcash')).map((row) => ({
      id: `shift-${row.id}`,
      order_id: row.order_id,
      origin_shift_id: order.shiftId,
      collection_shift_id: row.collection_shift_id,
      shift_session_id: row.shift_session_id,
      method: String(row.method).toUpperCase(),
      amount: row.amount,
      collected_by: collectedBy,
      collected_at: row.created_at,
    }))
    if (eventRows.length > 0) {
      const result = await supabase.from('shift_payment_events').upsert(eventRows, { onConflict: 'id' })
      if (result.error && !isMissingTableError(result.error)) throw result.error
    }
  } catch (error) {
    setStatusMessage(`${order.id} payment sync failed: ${error instanceof Error ? error.message : 'Unknown Supabase error.'}`)
  }
}

function buildPaymentRows(order: RestaurantOrder, payment?: OrderPaymentInput) {
  const baseId = normalizeAccountId(order.deviceOrderId || order.id)
  const orderId = order.deviceOrderId || order.id
  const customerName = `Table ${tableNumber(order.id)}`
  const createdAt = new Date(order.createdAt).toISOString()
  const balance = orderBalance(order)

  if (!order.paid) {
    const rows = []
    if (payment && payment.amount > 0) {
      rows.push(...buildPaidPaymentRows({
        baseId: `${baseId}-${Date.now()}`,
        orderId,
        customerName,
        createdAt: new Date().toISOString(),
        method: payment.method,
        amount: payment.amount,
        cashAmount: payment.cashAmount,
        gcashAmount: payment.gcashAmount,
      }))
    }
    rows.push({
      id: baseId,
      order_id: orderId,
      customer_name: customerName,
      amount: balance > 0 ? balance : orderTotal(order),
      method: 'other',
      status: 'unpaid',
      created_at: createdAt,
    })
    return rows
  }

  return buildPaidPaymentRows({
    baseId,
    orderId,
    customerName,
    createdAt,
    method: payment?.method ?? order.paymentMethod ?? 'other',
    amount: (payment?.amount ?? order.paymentReceived) || orderTotal(order),
    cashAmount: payment?.cashAmount,
    gcashAmount: payment?.gcashAmount,
  })
}

function buildPaidPaymentRows({
  baseId,
  orderId,
  customerName,
  createdAt,
  method,
  amount,
  cashAmount,
  gcashAmount,
}: {
  baseId: string
  orderId: string
  customerName: string
  createdAt: string
  method: PaymentMethod | 'other'
  amount: number
  cashAmount?: number
  gcashAmount?: number
}) {
  if (method === 'split') {
    const rows = []
    if ((cashAmount ?? 0) > 0) {
      rows.push({
        id: `${baseId}-cash`,
        order_id: orderId,
        customer_name: customerName,
        amount: roundCurrency(cashAmount ?? 0),
        method: 'cash',
        status: 'paid',
        created_at: createdAt,
      })
    }
    if ((gcashAmount ?? 0) > 0) {
      rows.push({
        id: `${baseId}-gcash`,
        order_id: orderId,
        customer_name: customerName,
        amount: roundCurrency(gcashAmount ?? 0),
        method: 'gcash',
        status: 'paid',
        created_at: createdAt,
      })
    }
    return rows.length > 0 ? rows : [{
      id: baseId,
      order_id: orderId,
      customer_name: customerName,
      amount: roundCurrency(amount),
      method: 'other',
      status: 'paid',
      created_at: createdAt,
    }]
  }

  return [{
    id: baseId,
    order_id: orderId,
    customer_name: customerName,
    amount: roundCurrency(amount),
    method: method === 'cash' || method === 'gcash' ? method : 'other',
    status: 'paid',
    created_at: createdAt,
  }]
}

function buildSupabaseOrderPayload(order: RestaurantOrder, includeWorkflowFields: boolean) {
  const subtotal = order.items.reduce((sum, item) => sum + item.price * item.quantity, 0)
  const tax = roundCurrency(subtotal * taxRate)
  const total = roundCurrency(subtotal + tax)
  const paymentMethod = order.paymentMethod?.toUpperCase() ?? 'UNPAID'
  const basePayload: Record<string, unknown> = {
    device_order_id: order.deviceOrderId,
    device_id: normalizeAccountId(orderDeviceLabel(order)),
    service_mode: order.orderType,
    payment_method: paymentMethod,
    payment_reference: order.paymentReference || null,
    cash_amount: order.paymentMethod === 'cash' || order.paymentMethod === 'split' ? order.paymentReceived : null,
    gcash_amount: order.paymentMethod === 'gcash' ? order.paymentReceived : null,
    subtotal,
    tax,
    total,
    items_json: order.items.map((item) => ({
      productId: item.productId,
      categoryName: item.categoryName,
      name: item.name,
      serviceMode: item.orderType,
      isHalfOrder: item.isHalfOrder,
      quantity: item.quantity,
      price: item.price,
      lineTotal: roundCurrency(item.price * item.quantity),
      kitchenStatus: item.served ? 'SERVED' : 'PREPARING',
      isChecked: item.served,
      paidQuantity: item.paidQuantity,
      kitchenPrintedQuantity: item.kitchenPrintedQuantity,
    })),
    created_at: new Date(order.createdAt).toISOString(),
    uploaded_at: new Date().toISOString(),
    shift_id: order.shiftId,
    shift_session_id: order.shiftSessionId,
  }

  if (!includeWorkflowFields) return basePayload

  return {
    ...basePayload,
    payment_status: order.status === 'paid' ? 'PAID' : order.paymentReceived > 0 ? 'PARTIAL' : 'UNPAID',
    workflow_status: orderStatusForSupabase(order),
    item_checklist_json: order.items.map((item) => item.served),
    completed_at: order.paid && order.readyForPayment ? new Date().toISOString() : null,
    order_note: order.paymentNotes || null,
    gcash_reference_last4: order.paymentMethod === 'gcash' || order.paymentMethod === 'split'
      ? order.paymentReference.replace(/\D/g, '').slice(-4) || null
      : null,
  }
}

function orderStatusForSupabase(order: RestaurantOrder) {
  if (order.paid || order.status === 'paid') return 'PAID'
  // The shared schema uses SERVED for orders awaiting payment. The POS mapper
  // presents SERVED as Pending Payment when the order is loaded on any device.
  if (allItemsServed(order) || order.readyForPayment || order.status === 'served') return 'SERVED'
  return 'PREPARING'
}

function orderDeviceLabel(order: RestaurantOrder) {
  const [device] = order.deviceOrderId.split('-20')
  return device || 'tablet-1'
}

function isMissingOptionalOrderColumn(error: unknown) {
  const record = error as { code?: string; message?: string }
  const message = record.message?.toLowerCase() ?? ''
  return record.code === 'PGRST204'
    || message.includes('could not find')
    || message.includes('column')
    || message.includes('schema cache')
}

function saveLocalOrderPreview(order: RestaurantOrder) {
  if (typeof window === 'undefined') return
  const key = 'pos-web-preview-restaurant-orders'
  const existing = JSON.parse(window.localStorage.getItem(key) ?? '[]') as RestaurantOrder[]
  window.localStorage.setItem(key, JSON.stringify([order, ...existing].slice(0, 40)))
}

function normalizeAccountId(value: string) {
  return value.trim().toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '') || 'tablet-1'
}

function movementSignedAmount(movement: CashMovement) {
  switch (movement.movementKind) {
    case 'PAY_OUT':
    case 'TRANSFER_OUT':
    case 'ADJUSTMENT_MINUS':
    case 'BILL_PAYMENT':
      return -movement.amount
    default:
      return movement.amount
  }
}

function movementAccountLabel(accountId: string) {
  if (accountId === 'bank-gcash') return 'GCash'
  if (accountId === 'main-safe') return 'Main Safe'
  return accountId.split('-').map((part) => part.charAt(0).toUpperCase() + part.slice(1)).join(' ')
}

function movementKindLabel(kind: CashMovement['movementKind']) {
  return kind
    .toLowerCase()
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ')
}







