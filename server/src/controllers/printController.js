const { query }  = require('../config/db')
const { fmtOrder, ORDER_SELECT } = require('./ordersController')

// ─── Default receipt config (merged with restaurant.settings.receipt) ─────────
const DEFAULT_CONFIG = {
  showLogo:           false,
  logoUrl:            '',
  showRestaurantName: true,
  showAddress:        true,
  showPhone:          true,
  showEmail:          false,
  showWebsite:        false,
  websiteText:        '',
  showOrderId:        true,
  showTableNumber:    true,
  showWaiter:         true,
  showDate:           true,
  showSubtotal:       true,
  showTax:            true,
  showDiscount:       true,
  showPaymentDetails: true,
  headerText:         '',
  footerText:         'Thank you for dining with us!',
  paperWidth:         '80mm',
  fontSize:           12,
  fontFamily:         'monospace',  // 'monospace' | 'sans'
  showDividers:       true,
}

// ─── Currency formatter ───────────────────────────────────────────────────────
function fmtCurrency(amount, currency = 'LAK') {
  const n = parseFloat(amount || 0)
  const fixed = n.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })
  return `${fixed} ${currency}`
}

function escHtml(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

// ─── Build receipt HTML ───────────────────────────────────────────────────────
function buildReceiptHtml(order, restaurant, isKitchen = false) {
  // Merge restaurant receipt config with defaults
  const rawSettings = restaurant.settings || {}
  const cfg = { ...DEFAULT_CONFIG, ...(rawSettings.receipt || {}) }

  const cur      = restaurant.currency || 'LAK'
  const paperW   = cfg.paperWidth || '80mm'
  const fontSize = parseInt(cfg.fontSize) || 12
  const fontFam  = cfg.fontFamily === 'sans'
    ? "system-ui, -apple-system, 'Segoe UI', sans-serif"
    : "'Courier New', Courier, monospace"

  const orderDate = new Date(order.createdAt).toLocaleString('en-US', {
    dateStyle: 'medium', timeStyle: 'short',
  })

  // ── Item rows ──────────────────────────────────────────────────────────────
  const itemRows = (order.items || []).map(item => {
    const modLines = (item.modifiers || []).map(m =>
      `<tr class="mod-row">
         <td colspan="2" class="mod-name">↳ ${escHtml(m.name)}${m.priceAdjustment !== 0 ? ` (${m.priceAdjustment > 0 ? '+' : ''}${fmtCurrency(m.priceAdjustment, cur)})` : ''}</td>
         <td></td>
       </tr>`
    ).join('')
    const noteLine = item.notes
      ? `<tr class="note-row"><td colspan="3" class="item-note">✎ ${escHtml(item.notes)}</td></tr>`
      : ''
    return `
      <tr class="item-row">
        <td class="item-name">${escHtml(item.name)}</td>
        <td class="item-qty">${item.quantity}×</td>
        ${isKitchen ? '<td></td>' : `<td class="item-price">${fmtCurrency(item.lineTotal, cur)}</td>`}
      </tr>
      ${modLines}
      ${noteLine}
    `
  }).join('')

  // ── Payment rows ───────────────────────────────────────────────────────────
  const paymentRows = !isKitchen && cfg.showPaymentDetails && (order.payments || []).length
    ? (order.payments || []).map(p =>
        `<div class="pay-row">
           <span>${escHtml(String(p.paymentMethod || ''))}</span>
           <span>${fmtCurrency(p.amount, cur)}</span>
         </div>`
      ).join('')
    : ''

  // ── Totals block ───────────────────────────────────────────────────────────
  const totalsBlock = isKitchen ? '' : `
    ${cfg.showDividers ? '<div class="divider"></div>' : ''}
    <div class="totals">
      ${cfg.showSubtotal ? `<div class="total-row"><span>Subtotal</span><span>${fmtCurrency(order.subtotal, cur)}</span></div>` : ''}
      ${cfg.showTax      ? `<div class="total-row"><span>Tax</span><span>${fmtCurrency(order.tax, cur)}</span></div>` : ''}
      ${cfg.showDiscount && order.discount > 0 ? `<div class="total-row discount"><span>Discount</span><span>-${fmtCurrency(order.discount, cur)}</span></div>` : ''}
      <div class="total-row grand"><span>TOTAL</span><span>${fmtCurrency(order.total, cur)}</span></div>
    </div>
    ${paymentRows ? `${cfg.showDividers ? '<div class="divider"></div>' : ''}<div class="payments"><p class="section-label">Payment</p>${paymentRows}</div>` : ''}
  `

  // ── Logo ───────────────────────────────────────────────────────────────────
  const logoSrc = cfg.logoUrl || restaurant.logo_url || ''
  const logoHtml = cfg.showLogo && logoSrc
    ? `<div class="logo-wrap"><img src="${escHtml(logoSrc)}" class="logo" alt="logo" /></div>`
    : ''

  // ── Header meta block ──────────────────────────────────────────────────────
  const headerLines = [
    cfg.showRestaurantName ? `<div class="restaurant-name">${escHtml(restaurant.name || '')}</div>` : '',
    cfg.showAddress && restaurant.address ? `<div class="restaurant-sub">${escHtml(restaurant.address)}</div>` : '',
    cfg.showPhone   && restaurant.phone   ? `<div class="restaurant-sub">Tel: ${escHtml(restaurant.phone)}</div>` : '',
    cfg.showEmail   && restaurant.email   ? `<div class="restaurant-sub">${escHtml(restaurant.email)}</div>` : '',
    cfg.showWebsite && cfg.websiteText    ? `<div class="restaurant-sub">${escHtml(cfg.websiteText)}</div>` : '',
    cfg.headerText ? `<div class="header-extra">${escHtml(cfg.headerText)}</div>` : '',
  ].filter(Boolean).join('\n')

  // ── Order meta ─────────────────────────────────────────────────────────────
  const orderMeta = [
    cfg.showOrderId     ? `Order: ${escHtml(order.id)}` : '',
    cfg.showTableNumber && order.tableNumber ? `Table: ${order.tableNumber}` : '',
    order.orderType && order.orderType !== 'Dine In' ? `Type: ${escHtml(order.orderType)}` : '',
    cfg.showWaiter && order.waiter && order.waiter !== 'Unassigned' ? `Waiter: ${escHtml(order.waiter)}` : '',
    cfg.showDate ? orderDate : '',
  ].filter(Boolean).join('<br/>')

  // ── Footer ─────────────────────────────────────────────────────────────────
  const footerText = isKitchen
    ? 'Kitchen copy — not a receipt'
    : (cfg.footerText || 'Thank you for dining with us!')

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>${isKitchen ? 'Kitchen Ticket' : 'Receipt'} — ${escHtml(order.id)}</title>
  <style>
    @page { margin: 0; size: ${paperW} auto; }

    * { box-sizing: border-box; margin: 0; padding: 0; }

    body {
      font-family: ${fontFam};
      font-size: ${fontSize}px;
      width: ${paperW};
      max-width: ${paperW};
      padding: 6mm 4mm;
      color: #111;
      background: #fff;
    }

    /* ── Logo ── */
    .logo-wrap { text-align: center; margin-bottom: 6px; }
    .logo      { max-width: 120px; max-height: 60px; object-fit: contain; }

    /* ── Header ── */
    .header           { text-align: center; margin-bottom: 8px; }
    .restaurant-name  { font-size: ${fontSize + 4}px; font-weight: bold; letter-spacing: 0.5px; }
    .restaurant-sub   { font-size: ${fontSize - 2}px; color: #555; margin-top: 2px; line-height: 1.4; }
    .header-extra     { font-size: ${fontSize - 1}px; color: #444; margin-top: 3px; font-style: italic; }
    .order-title      { font-size: ${fontSize + 1}px; font-weight: bold; margin-top: 6px; }
    .order-meta       { font-size: ${fontSize - 2}px; color: #444; margin-top: 3px; line-height: 1.5; }

    .divider        { border-top: 1px dashed #aaa; margin: 6px 0; }
    .double-divider { border-top: 2px solid #111; margin: 6px 0; }

    /* ── Items table ── */
    .items-table        { width: 100%; border-collapse: collapse; }
    .items-table th     { font-size: ${fontSize - 2}px; text-transform: uppercase; letter-spacing: 0.5px; padding: 2px 0; border-bottom: 1px solid #ccc; }
    .item-row td        { padding: 3px 0; vertical-align: top; }
    .item-name          { width: 55%; line-height: 1.3; }
    .item-qty           { width: 10%; text-align: center; }
    .item-price         { width: 35%; text-align: right; font-weight: 600; }
    .mod-row td         { padding: 0 0 2px 0; }
    .mod-name           { font-size: ${fontSize - 2}px; color: #555; padding-left: 8px; }
    .item-note          { font-size: ${fontSize - 2}px; color: #777; font-style: italic; padding-left: 8px; padding-bottom: 2px; }

    /* ── Totals ── */
    .totals .total-row  { display: flex; justify-content: space-between; font-size: ${fontSize - 1}px; padding: 2px 0; }
    .totals .total-row.grand {
      font-size: ${fontSize + 2}px; font-weight: bold; padding-top: 4px; margin-top: 2px;
      border-top: 1px solid #111;
    }
    .totals .total-row.discount { color: #16a34a; }

    /* ── Payments ── */
    .section-label { font-size: ${fontSize - 2}px; text-transform: uppercase; letter-spacing: 0.5px; color: #555; margin-bottom: 3px; }
    .payments .pay-row { display: flex; justify-content: space-between; font-size: ${fontSize - 1}px; padding: 1px 0; text-transform: capitalize; }

    /* ── Footer ── */
    .footer { text-align: center; font-size: ${fontSize - 2}px; color: #777; margin-top: 8px; line-height: 1.5; }

    @media print {
      html, body { width: ${paperW}; }
    }
  </style>
</head>
<body>

  ${logoHtml}

  <div class="header">
    ${headerLines}
    <div class="order-title">${isKitchen ? '— KITCHEN TICKET —' : '— RECEIPT —'}</div>
    ${orderMeta ? `<div class="order-meta">${orderMeta}</div>` : ''}
  </div>

  ${cfg.showDividers ? '<div class="divider"></div>' : ''}

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

  ${order.notes ? `${cfg.showDividers ? '<div class="divider"></div>' : ''}<div style="font-size:${fontSize - 1}px;font-style:italic;color:#555">Note: ${escHtml(order.notes)}</div>` : ''}

  ${totalsBlock}

  ${cfg.showDividers ? '<div class="divider"></div>' : ''}
  <div class="footer">${escHtml(footerText)}</div>

</body>
</html>`
}

// ─── GET /api/print/:id/receipt ───────────────────────────────────────────────
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

    const rRes = await query(
      'SELECT id, name, phone, email, address, currency, logo_url, settings FROM restaurants WHERE id = $1',
      [rid || rows[0].restaurant_id]
    )
    const restaurant = rRes.rows[0] || {}

    const html = buildReceiptHtml(order, restaurant, false)
    res.set('Content-Type', 'text/html; charset=utf-8').send(html)
  } catch (err) { next(err) }
}

// ─── GET /api/print/:id/kitchen-ticket ───────────────────────────────────────
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

    const rRes = await query(
      'SELECT id, name, phone, email, address, currency, logo_url, settings FROM restaurants WHERE id = $1',
      [rid || rows[0].restaurant_id]
    )
    const restaurant = rRes.rows[0] || {}

    const html = buildReceiptHtml(order, restaurant, true)
    res.set('Content-Type', 'text/html; charset=utf-8').send(html)
  } catch (err) { next(err) }
}

module.exports = { getReceipt, getKitchenTicket }
