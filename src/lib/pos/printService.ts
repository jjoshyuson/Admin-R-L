import type { CompletedOrder } from './posTypes'

export type PrintDocumentType = 'customer-receipt' | 'kitchen-ticket'

export function openPrintDocument(order: CompletedOrder, documentType: PrintDocumentType) {
  const printWindow = window.open('', '_blank', 'width=420,height=720')
  if (!printWindow) {
    throw new Error('The browser blocked the print window.')
  }
  printWindow.document.write(buildPrintHtml(order, documentType))
  printWindow.document.close()
  printWindow.focus()
  printWindow.print()
}

export function buildPrintHtml(order: CompletedOrder, documentType: PrintDocumentType) {
  const isKitchen = documentType === 'kitchen-ticket'
  const title = isKitchen ? 'Kitchen Ticket' : 'Customer Receipt'
  const rows = order.items
    .map((item) => {
      const detail = `${item.quantity} x ${escapeHtml(item.name)}${item.isHalfOrder ? ' (Half)' : ''}`
      const service = item.serviceMode === order.serviceMode ? '' : ` <span>${item.serviceMode}</span>`
      const amount = isKitchen ? '' : `<strong>${formatPhp(item.lineTotal)}</strong>`
      return `<li><div>${detail}${service}</div>${amount}</li>`
    })
    .join('')

  return `<!doctype html>
<html>
  <head>
    <title>${title} ${escapeHtml(order.deviceOrderId)}</title>
    <style>
      body { color: #1f1b16; font-family: Arial, sans-serif; margin: 0; padding: 18px; }
      .ticket { margin: 0 auto; max-width: 320px; }
      h1 { font-size: 20px; margin: 0 0 6px; text-align: center; }
      .meta { border-bottom: 1px dashed #999; color: #555; font-size: 12px; padding-bottom: 10px; text-align: center; }
      ul { border-bottom: 1px dashed #999; list-style: none; margin: 12px 0; padding: 0 0 8px; }
      li { display: flex; gap: 10px; justify-content: space-between; margin: 8px 0; }
      span { color: #777; font-size: 11px; }
      .totals { font-size: 14px; }
      .totals div { display: flex; justify-content: space-between; margin: 5px 0; }
      .total { font-size: 18px; font-weight: 700; }
      .note { border: 1px solid #ddd; margin-top: 12px; padding: 8px; }
      @media print { body { padding: 0; } button { display: none; } }
    </style>
  </head>
  <body>
    <main class="ticket">
      <h1>${title}</h1>
      <div class="meta">
        <div>${escapeHtml(order.deviceOrderId)}</div>
        <div>${new Date(order.createdAt).toLocaleString()}</div>
        <div>${escapeHtml(order.serviceMode)} | ${escapeHtml(order.deviceId)}</div>
      </div>
      <ul>${rows}</ul>
      ${
        isKitchen
          ? ''
          : `<section class="totals">
              <div><span>Subtotal</span><strong>${formatPhp(order.totals.subtotal)}</strong></div>
              <div><span>Tax</span><strong>${formatPhp(order.totals.tax)}</strong></div>
              <div class="total"><span>Total</span><strong>${formatPhp(order.totals.total)}</strong></div>
              <div><span>Payment</span><strong>${escapeHtml(order.payment.method)}</strong></div>
              <div><span>Change</span><strong>${formatPhp(order.payment.changeAmount)}</strong></div>
            </section>`
      }
      ${order.orderNote ? `<div class="note">${escapeHtml(order.orderNote)}</div>` : ''}
    </main>
  </body>
</html>`
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

