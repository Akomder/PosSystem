/**
 * printKitchenTicket.js
 *
 * Opens a silent print window with a kitchen-style ticket.
 * No external deps — pure browser print API.
 *
 * Usage:
 *   import { printKitchenTicket } from '../utils/printKitchenTicket'
 *   printKitchenTicket(order)
 */

function pad(n) {
  return String(n).padStart(2, '0')
}

function fmtTime(isoStr) {
  const d = new Date(isoStr)
  return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`
}

function fmtDate(isoStr) {
  const d = new Date(isoStr)
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`
}

function buildHtml(order) {
  const items = order.items || []

  const itemRows = items.map(item => {
    const modLines = (item.modifiers || [])
      .map(m => `<div class="mod">+ ${m.name}</div>`)
      .join('')
    const noteLine = item.notes
      ? `<div class="note">✎ ${item.notes}</div>`
      : ''
    return `
      <div class="item">
        <span class="qty">${item.quantity}×</span>
        <div class="item-detail">
          <span class="item-name">${item.name || 'Item'}</span>
          ${modLines}
          ${noteLine}
        </div>
      </div>`
  }).join('')

  const tableInfo = order.tableNumber
    ? `Table ${order.tableNumber}`
    : (order.orderType || 'Dine In')

  const orderNotes = order.notes
    ? `<div class="order-notes">⚠ ${order.notes}</div>`
    : ''

  const waiter = (order.waiter && order.waiter !== 'Unassigned')
    ? `<div class="meta-row"><span>Staff:</span><span>${order.waiter}</span></div>`
    : ''

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8" />
  <title>Kitchen Ticket – ${order.id}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: 'Courier New', Courier, monospace;
      font-size: 13px;
      color: #000;
      background: #fff;
      width: 80mm;
      padding: 6px 8px 16px;
    }

    /* ── Header ── */
    .header {
      text-align: center;
      border-bottom: 2px dashed #000;
      padding-bottom: 6px;
      margin-bottom: 6px;
    }
    .header .label {
      font-size: 11px;
      letter-spacing: 3px;
      text-transform: uppercase;
    }
    .header .order-id {
      font-size: 22px;
      font-weight: 900;
      letter-spacing: 1px;
      margin: 2px 0;
    }
    .header .where {
      font-size: 16px;
      font-weight: 700;
    }

    /* ── Meta ── */
    .meta {
      border-bottom: 1px dashed #555;
      padding-bottom: 5px;
      margin-bottom: 6px;
      font-size: 11px;
    }
    .meta-row {
      display: flex;
      justify-content: space-between;
    }

    /* ── Items ── */
    .items-label {
      font-size: 10px;
      letter-spacing: 2px;
      text-transform: uppercase;
      border-bottom: 1px solid #000;
      padding-bottom: 3px;
      margin-bottom: 4px;
    }
    .item {
      display: flex;
      align-items: flex-start;
      gap: 6px;
      padding: 4px 0;
      border-bottom: 1px dotted #ccc;
    }
    .item:last-child { border-bottom: none; }
    .qty {
      font-size: 15px;
      font-weight: 900;
      min-width: 28px;
      flex-shrink: 0;
    }
    .item-detail { flex: 1; }
    .item-name {
      font-size: 14px;
      font-weight: 700;
      display: block;
    }
    .mod {
      font-size: 11px;
      color: #333;
      padding-left: 6px;
    }
    .note {
      font-size: 11px;
      font-style: italic;
      color: #555;
      padding-left: 6px;
    }

    /* ── Order notes ── */
    .order-notes {
      margin-top: 6px;
      padding: 5px 6px;
      border: 2px solid #000;
      font-size: 12px;
      font-weight: 700;
      white-space: pre-wrap;
    }

    /* ── Footer ── */
    .footer {
      margin-top: 8px;
      text-align: center;
      font-size: 10px;
      color: #555;
      border-top: 1px dashed #555;
      padding-top: 5px;
    }

    @media print {
      body { width: 80mm; }
    }
  </style>
</head>
<body>
  <div class="header">
    <div class="label">Kitchen Ticket</div>
    <div class="order-id">${order.id}</div>
    <div class="where">${tableInfo}</div>
  </div>

  <div class="meta">
    <div class="meta-row">
      <span>Date:</span><span>${fmtDate(order.createdAt)}</span>
    </div>
    <div class="meta-row">
      <span>Time:</span><span>${fmtTime(order.createdAt)}</span>
    </div>
    <div class="meta-row">
      <span>Type:</span><span>${order.orderType || 'Dine In'}</span>
    </div>
    ${waiter}
  </div>

  <div class="items-label">Items (${items.length})</div>
  <div class="items">
    ${itemRows || '<div class="item" style="color:#888;font-style:italic">No items</div>'}
  </div>

  ${orderNotes}

  <div class="footer">
    Printed ${fmtTime(new Date().toISOString())} — ${fmtDate(new Date().toISOString())}
  </div>
</body>
</html>`
}

/**
 * Open a tiny print window, render the kitchen ticket, print silently, then close.
 * @param {object} order  — the order object from socket / API
 */
export function printKitchenTicket(order) {
  try {
    const win = window.open('', '_blank', 'width=400,height=600,toolbar=0,menubar=0,location=0')
    if (!win) {
      console.warn('printKitchenTicket: popup blocked — allow popups for this site')
      return
    }
    win.document.open()
    win.document.write(buildHtml(order))
    win.document.close()

    // Wait for fonts/layout then print
    win.onload = () => {
      win.focus()
      win.print()
      // Close after print dialog closes (or after short delay as fallback)
      win.onafterprint = () => win.close()
      setTimeout(() => { try { win.close() } catch (_) {} }, 8000)
    }
  } catch (err) {
    console.error('printKitchenTicket error:', err)
  }
}
