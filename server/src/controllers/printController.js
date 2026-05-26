const { query }  = require('../config/db')
const { fmtOrder, ORDER_SELECT } = require('./ordersController')

// ─── Currency formatter (server-side, no Intl locale needed) ─────────────────
function fmt(amount, currency = 'LAK') {
  const n = parseFloat(amount || 0)
  const fixed = n.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })
  return `${fixed} ${currency}`
}

// ─── Build receipt HTML ───────────────────────────────────────────────────────
function buildReceiptHtml(order, restaurant, isKitchen = false) {
  const cur       = restaurant.currency || 'LAK'
  const orderDate = new Date(order.createdAt).toLocaleString('en-US', {
    dateStyle: 'medium', timeStyle: 'short',
  })

  const itemRows = (order.items || []).map(item => {
    const modLines = (item.modifiers || []).map(m =>
      `<tr class="mod-row">
         <td colspan="2" class="mod-name">↳ ${m.name}${m.priceAdjustment !== 0 ? ` (${m.priceAdjustment > 0 ? '+' : ''}${fmt(m.priceAdjustment, cur)})` : ''}</td>
         <td></td>
       </tr>`
    ).join('')
    const noteLine = item.notes
      ? `<tr class="note-row"><td colspan="3" class="item-note">✎ ${item.notes}</td></tr>`
      : ''
    return `
      <tr class="item-row">
        <td class="item-name">${item.name}</td>
        <td class="item-qty">${item.quantity}×</td>
        ${isKitchen ? '<td></td>' : `<td class="item-price">${fmt(item.lineTotal, cur)}</td>`}
      </tr>
      ${modLines}
      ${noteLine}
    `
  }).join('')

  const paymentRows = !isKitchen && (order.payments || []).length
    ? (order.payments || []).map(p =>
        `<div class="pay-row">
           <span>${p.paymentMethod}</span>
           <span>${fmt(p.amount, cur)}</span>
         </div>`
      ).join('')
    : ''

  const totalsBlock = isKitchen ? '' : `
    <div class="divider"></div>
    <div class="totals">
      <div class="total-row"><span>Subtotal</span><span>${fmt(order.subtotal, cur)}</span></div>
      <div class="total-row"><span>Tax</span><span>${fmt(order.tax, cur)}</span></div>
      ${order.discount > 0 ? `<div class="total-row discount"><span>Discount</span><span>-${fmt(order.discount, cur)}</span></div>` : ''}
      <div class="total-row grand"><span>TOTAL</span><span>${fmt(order.total, cur)}</span></div>
    </div>
    ${paymentRows ? `<div class="divider"></div><div class="payments"><p class="section-label">Payment</p>${paymentRows}</div>` : ''}
  `

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>${isKitchen ? 'Kitchen Ticket' : 'Receipt'} — ${order.id}</title>
  <style>
    @page { margin: 0; size: 80mm auto; }

    * { box-sizing: border-box; margin: 0; padding: 0; }

    body {
      font-family: 'Courier New', Courier, monospace;
      font-size: 12px;
      width: 80mm;
      max-width: 80mm;
      padding: 6mm 4mm;
      color: #111;
      background: #fff;
    }

    /* ── Header ── */
    .header { text-align: center; margin-bottom: 8px; }
    .restaurant-name { font-size: 16px; font-weight: bold; letter-spacing: 0.5px; }
    .restaurant-sub  { font-size: 10px; color: #555; margin-top: 2px; line-height: 1.4; }
    .order-title     { font-size: 13px; font-weight: bold; margin-top: 6px; }
    .order-meta      { font-size: 10px; color: #444; margin-top: 3px; line-height: 1.5; }

    .divider { border-top: 1px dashed #aaa; margin: 6px 0; }
    .double-divider { border-top: 2px solid #111; margin: 6px 0; }

    /* ── Items table ── */
    .items-table { width: 100%; border-collapse: collapse; }
    .items-table th {
      font-size: 10px; text-transform: uppercase; letter-spacing: 0.5px;
      padding: 2px 0; border-bottom: 1px solid #ccc;
    }
    .item-row td  { padding: 3px 0; vertical-align: top; }
    .item-name    { width: 55%; line-height: 1.3; }
    .item-qty     { width: 10%; text-align: center; }
    .item-price   { width: 35%; text-align: right; font-weight: 600; }
    .mod-row td   { padding: 0 0 2px 0; }
    .mod-name     { font-size: 10px; color: #555; padding-left: 8px; }
    .note-row td  { }
    .item-note    { font-size: 10px; color: #777; font-style: italic; padding-left: 8px; padding-bottom: 2px; }

    /* ── Totals ── */
    .totals .total-row {
      display: flex; justify-content: space-between;
      font-size: 11px; padding: 2px 0;
    }
    .totals .total-row.grand {
      font-size: 14px; font-weight: bold; padding-top: 4px; margin-top: 2px;
      border-top: 1px solid #111;
    }
    .totals .total-row.discount { color: #16a34a; }

    /* ── Payments ── */
    .section-label { font-size: 10px; text-transform: uppercase; letter-spacing: 0.5px; color: #555; margin-bottom: 3px; }
    .payments .pay-row {
      display: flex; justify-content: space-between;
      font-size: 11px; padding: 1px 0; text-transform: capitalize;
    }

    /* ── Footer ── */
    .footer { text-align: center; font-size: 10px; color: #777; margin-top: 8px; line-height: 1.5; }

    /* ── Print ── */
    @media print {
      html, body { width: 80mm; }
    }
  </style>
</head>
<body>

  <div class="header">
    <div class="restaurant-name">${escHtml(restaurant.name)}</div>
    ${restaurant.address ? `<div class="restaurant-sub">${escHtml(restaurant.address)}</div>` : ''}
    ${restaurant.phone  ? `<div class="restaurant-sub">Tel: ${escHtml(restaurant.phone)}</div>` : ''}
    <div class="order-title">${isKitchen ? '— KITCHEN TICKET —' : '— RECEIPT —'}</div>
    <div class="order-meta">
      Order: ${order.id}<br/>
      ${order.tableNumber ? `Table: ${order.tableNumber}<br/>` : ''}
      ${order.orderType && order.orderType !== 'Dine In' ? `Type: ${order.orderType}<br/>` : ''}
      ${order.waiter && order.waiter !== 'Unassigned' ? `Waiter: ${escHtml(order.waiter)}<br/>` : ''}
      ${orderDate}
    </div>
  </div>

  <div class="divider"></div>

  <table class="items-table">
    <thead>
      <tr>
        <th class="item-name">Item</th>
        <th class="item-qty">Qty</th>
        ${isKitchen ? '<th></th>' : '<th style="text-align:right">Amount</th>'}
      </tr>
    </thead>
    <tbody>
      ${itemRows}
    </tbody>
  </table>

  ${order.notes ? `<div class="divider"></div><div style="font-size:11px;font-style:italic;color:#555">Note: ${escHtml(order.notes)}</div>` : ''}

  ${totalsBlock}

  <div class="divider"></div>
  <div class="footer">
    ${isKitchen ? 'Kitchen copy — not a receipt' : 'Thank you for dining with us!'}
  </div>

</body>
</html>`
}

function escHtml(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

// ─── GET /api/orders/:id/receipt ─────────────────────────────────────────────
async function getReceipt(req, res, next) {
  try {
    const rid = req.restaurantId
    let sql = `${ORDER_SELECT} WHERE o.id = $1`
    const params = [req.params.id]
    if (rid) { params.push(rid); sql += ` AND o.restaurant_id = $${params.length}` }
    sql += ' GROUP BY o.id'

    const { rows } = await query(sql, params)
    if (!rows.length) return res.status(404).json({ error: 'Order not found' })
    const order = fmtOrder(rows[0])

    const rRes = await query('SELECT * FROM restaurants WHERE id = $1', [rid || rows[0].restaurant_id])
    const restaurant = rRes.rows[0] || {}

    const html = buildReceiptHtml(order, restaurant, false)
    res.set('Content-Type', 'text/html; charset=utf-8').send(html)
  } catch (err) { next(err) }
}

// ─── GET /api/orders/:id/kitchen-ticket ──────────────────────────────────────
async function getKitchenTicket(req, res, next) {
  try {
    const rid = req.restaurantId
    let sql = `${ORDER_SELECT} WHERE o.id = $1`
    const params = [req.params.id]
    if (rid) { params.push(rid); sql += ` AND o.restaurant_id = $${params.length}` }
    sql += ' GROUP BY o.id'

    const { rows } = await query(sql, params)
    if (!rows.length) return res.status(404).json({ error: 'Order not found' })
    const order = fmtOrder(rows[0])

    const rRes = await query('SELECT * FROM restaurants WHERE id = $1', [rid || rows[0].restaurant_id])
    const restaurant = rRes.rows[0] || {}

    const html = buildReceiptHtml(order, restaurant, true)
    res.set('Content-Type', 'text/html; charset=utf-8').send(html)
  } catch (err) { next(err) }
}

module.exports = { getReceipt, getKitchenTicket }
