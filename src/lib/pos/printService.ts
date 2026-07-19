import type { CompletedOrder } from './posTypes'

export type PrintDocumentType = 'customer-receipt' | 'kitchen-ticket'
export type ReceiptPaperWidth = '58mm' | '80mm'
export type ReceiptDetailMode = 'compact' | 'standard'
export type PrintOptions = {
  copies?: number
  paperWidth?: ReceiptPaperWidth
  detailMode?: ReceiptDetailMode
  includeOrderNote?: boolean
}

type NativePrinterBridge = {
  printReceipt?: (orderJson: string) => string | void
  printKitchenTicket?: (orderJson: string) => string | void
}

declare global {
  interface Window {
    OohPrinter?: NativePrinterBridge
    AndroidPrinter?: NativePrinterBridge
  }
}

export function printPosDocument(order: CompletedOrder, documentType: PrintDocumentType, options: PrintOptions = {}) {
  const copies = normalizeCopies(options.copies)
  const nativePrinter = window.OohPrinter ?? window.AndroidPrinter
  const nativeMethod = documentType === 'kitchen-ticket'
    ? nativePrinter?.printKitchenTicket
    : nativePrinter?.printReceipt

  if (nativeMethod) {
    for (let copyIndex = 0; copyIndex < copies; copyIndex += 1) {
      const result = nativeMethod.call(nativePrinter, JSON.stringify(order))
      const parsed = typeof result === 'string' ? parseNativePrintResult(result) : null
      if (parsed && !parsed.success) {
        throw new Error(parsed.message || 'Native printer failed.')
      }
    }
    return
  }

  openPrintDocument(order, documentType, copies, options)
}

export function openPrintDocument(order: CompletedOrder, documentType: PrintDocumentType, copies = 1, options: PrintOptions = {}) {
  const printWindow = window.open('', '_blank', 'width=420,height=720')
  if (!printWindow) {
    throw new Error('The browser blocked the print window.')
  }
  printWindow.document.write(buildPrintHtml(order, documentType, { ...options, copies }))
  printWindow.document.close()
  printWindow.focus()
  printWindow.print()
}

function parseNativePrintResult(value: string) {
  try {
    return JSON.parse(value) as { success?: boolean; message?: string }
  } catch {
    return null
  }
}

export function buildPrintHtml(order: CompletedOrder, documentType: PrintDocumentType, options: PrintOptions = {}) {
  const isKitchen = documentType === 'kitchen-ticket'
  const title = isKitchen ? 'Kitchen Ticket' : 'Customer Receipt'
  const printCopies = normalizeCopies(options.copies)
  const paperWidth = options.paperWidth ?? '80mm'
  const receiptCopies = Array.from({ length: printCopies }, (_, index) => buildTicketMarkup(order, documentType, index + 1, printCopies, options)).join('')

  return `<!doctype html>
<html>
  <head>
    <title>${title} ${escapeHtml(order.deviceOrderId)}</title>
    <style>
      @page { margin: 0; size: ${paperWidth} auto; }
      * { box-sizing: border-box; }
      body {
        background: #f4f1eb;
        color: #111;
        font-family: "Courier New", ui-monospace, SFMono-Regular, Consolas, monospace;
        margin: 0;
        padding: 14px;
      }
      .ticket {
        background: #fff;
        margin: 0 auto 14px;
        max-width: 320px;
        padding: 12px 10px;
        width: ${paperWidth};
      }
      .ticket + .ticket { page-break-before: always; }
      .center { text-align: center; }
      .title { font-size: 16px; font-weight: 800; text-transform: uppercase; }
      .brand { font-size: 13px; font-weight: 700; margin-top: 2px; }
      .meta { font-size: 12px; line-height: 1.35; margin-top: 4px; }
      .separator { border: 0; border-top: 1px dashed #111; margin: 9px 0; }
      .row { display: flex; gap: 8px; justify-content: space-between; line-height: 1.3; margin: 5px 0; }
      .row span:first-child { overflow-wrap: anywhere; }
      .row strong { flex: 0 0 auto; font-weight: 700; }
      .item-detail { color: #444; font-size: 11px; margin: -2px 0 5px 0; }
      .total { font-size: 15px; font-weight: 800; text-transform: uppercase; }
      .note { border: 1px dashed #999; font-size: 12px; line-height: 1.35; margin-top: 9px; padding: 7px; overflow-wrap: anywhere; }
      .copy-mark { color: #555; font-size: 11px; margin-top: 8px; }
      @media print {
        body { background: #fff; padding: 0; }
        .ticket { margin: 0; max-width: none; width: ${paperWidth}; }
      }
    </style>
  </head>
  <body>
    ${receiptCopies}
  </body>
</html>`
}

function buildTicketMarkup(order: CompletedOrder, documentType: PrintDocumentType, copyNumber: number, copyCount: number, options: PrintOptions) {
  const isKitchen = documentType === 'kitchen-ticket'
  const title = isKitchen ? 'Kitchen Ticket' : 'Customer Receipt'
  const showServiceMode = options.detailMode !== 'compact'
  const includeOrderNote = options.includeOrderNote !== false
  const rows = order.items
    .map((item) => {
      const detail = `${item.quantity}x ${item.name}${item.isHalfOrder ? ' (Half)' : ''}`
      const service = showServiceMode && item.serviceMode !== order.serviceMode ? `<div class="item-detail">${escapeHtml(item.serviceMode)}</div>` : ''
      const amount = isKitchen ? '' : `<strong>${formatPhp(item.lineTotal)}</strong>`
      return `<div class="row"><span>${escapeHtml(detail)}</span>${amount}</div>${service}`
    })
    .join('')

  return `<main class="ticket">
      <div class="center">
        <div class="title">${title}</div>
        <div class="brand">OOH POS</div>
        <div class="meta">
          <div>${escapeHtml(shortOrderId(order.deviceOrderId))}</div>
          <div>${escapeHtml(formatReceiptTimestamp(order.createdAt))}</div>
          <div>${escapeHtml(order.serviceMode)} | ${escapeHtml(order.deviceId || 'Tablet')}</div>
        </div>
      </div>
      <hr class="separator" />
      ${rows}
      <hr class="separator" />
      ${
        isKitchen
          ? ''
          : `<section>
              <div class="row"><span>Subtotal</span><strong>${formatPhp(order.totals.subtotal)}</strong></div>
              <div class="row"><span>Tax</span><strong>${formatPhp(order.totals.tax)}</strong></div>
              <div class="row total"><span>Total</span><strong>${formatPhp(order.totals.total)}</strong></div>
              <div class="row"><span>Payment</span><strong>${escapeHtml(order.payment.method)}</strong></div>
              <div class="row"><span>Change</span><strong>${formatPhp(order.payment.changeAmount)}</strong></div>
            </section>`
      }
      ${includeOrderNote && order.orderNote ? `<div class="note">${escapeHtml(order.orderNote)}</div>` : ''}
      ${copyCount > 1 ? `<div class="center copy-mark">Copy ${copyNumber} of ${copyCount}</div>` : ''}
    </main>`
}

function normalizeCopies(value: number | undefined) {
  if (!Number.isFinite(value)) return 1
  return Math.min(10, Math.max(1, Math.trunc(value ?? 1)))
}

function formatReceiptTimestamp(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return new Intl.DateTimeFormat('en-PH', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(date)
}

function shortOrderId(value: string) {
  return value.trim() ? value.trim().slice(-18) : 'ORDER'
}

function formatPhp(value: number) {
  return new Intl.NumberFormat('en-PH', {
    style: 'currency',
    currency: 'PHP',
    minimumFractionDigits: 2,
  }).format(value)
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}
