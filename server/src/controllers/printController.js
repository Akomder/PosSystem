const { query }  = require('../config/db')
const { fmtOrder, ORDER_SELECT } = require('./ordersController')

// ─── Font map ─────────────────────────────────────────────────────────────────
const FONT_MAP = {
  monospace: "'Courier New', Courier, monospace",
  sans:      "system-ui, -apple-system, 'Segoe UI', Arial, sans-serif",
  arial:     "Arial, Helvetica, sans-serif",
  serif:     "Georgia, 'Times New Roman', serif",
  times:     "'Times New Roman', Times, serif",
}

// ─── Default receipt config ───────────────────────────────────────────────────
// IMPORTANT: keep in sync with ReceiptConfigTab DEFAULT_CONFIG on the client
const DEFAULT_CONFIG = {
  // ── Branding ────────────────────────────────────────────────────────────────
  showLogo:            false,
  logoUrl:             '',
  showRestaurantName:  true,
  restaurantNameSize:  'large',     // 'normal' | 'large' | 'xlarge'
  restaurantNameBold:  true,
  showAddress:         true,
  showPhone:           true,
  showEmail:           false,
  showWebsite:         false,
  websiteText:         '',
  headerText:          '',
  headerAlign:         'center',    // 'left' | 'center' | 'right'
  // ── Order info ──────────────────────────────────────────────────────────────
  showOrderId:         true,
  showTableNumber:     true,
  showWaiter:          true,
  showOrderType:       false,
  showDate:            true,
  // ── Items ───────────────────────────────────────────────────────────────────
  showUnitPrice:       false,
  // ── Totals & Payment ────────────────────────────────────────────────────────
  showSubtotal:        true,
  showTax:             true,
  showDiscount:        true,
  showPaymentDetails:  true,
  showSignatureLine:   false,
  signatureLabel:      'Signature: ____________________',
  // ── Footer ──────────────────────────────────────────────────────────────────
  footerText:          'Thank you for dining with us!',
  footerAlign:         'center',
  // ── Custom labels ───────────────────────────────────────────────────────────
  labelReceipt:        'RECEIPT',
  labelTable:          'Table',
  labelWaiter:         'Waiter',
  labelOrder:          'Order',
  labelOrderType:      'Type',
  labelSubtotal:       'Subtotal',
  labelTax:            'Tax',
  labelTotal:          'TOTAL',
  labelDiscount:       'Discount',
  labelPayment:        'Payment',
  // ── Layout ──────────────────────────────────────────────────────────────────
  paperWidth:          '80mm',      // '58mm' | '80mm'
  fontSize:            12,          // 8–18
  fontFamily:          'monospace', // see FONT_MAP
  showDividers:        true,
  dividerStyle:        'dashed',    // 'dashed' | 'solid' | 'double'
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function fmtCurrency(amount, currency = 'LAK') {
  const n = parseFloat(amount || 0)
  return `${n.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })} ${currency}`
}

function escHtml(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

// Resolve a label key with its default fallback
function lbl(cfg, key, fallback) {
  return escHtml(cfg[key] || fallback)
}

// ─── Build receipt HTML ───────────────────────────────────────────────────────
function buildReceiptHtml(order, restaurant, isKitchen = false) {
  const rawSettings = restaurant.settings || {}
  const cfg = { ...DEFAULT_CONFIG, ...(rawSettings.receipt || {}) }

  const cur      = restaurant.currency || 'LAK'
  const paperW   = cfg.paperWidth || '80mm'
  const fontSize = Math.max(8, Math.min(18, parseInt(cfg.fontSize) || 12))
  const fontFam  = FONT_MAP[cfg.fontFamily] || FONT_MAP.monospace

  // Restaurant name size
  const nameFs = cfg.restaurantNameSize === 'xlarge' ? fontSize + 6
               : cfg.restaurantNameSize === 'normal'  ? fontSize + 2
               :                                        fontSize + 4  // 'large'

  // Divider CSS
  const divCss = cfg.dividerStyle === 'solid'  ? 'border-top: 2px solid #888;'
               : cfg.dividerStyle === 'double' ? 'border-top: 3px double #666;'
               :                                 'border-top: 1px dashed #aaa;'

  const dividerEl = `<div style="${divCss} margin: 5px 0;"></div>`

  const orderDate = new Date(order.createdAt).toLocaleString('en-US', {
    dateStyle: 'medium', timeStyle: 'short',
  })

  // ── Item rows ──────────────────────────────────────────────────────────────
  const itemRows = (order.items || []).map(item => {
    const qty       = item.quantity || 1
    const lineTotal = parseFloat(item.lineTotal || 0)
    const unitPrice = qty > 0 ? lineTotal / qty : lineTotal

    const modLines = (item.modifiers || []).map(m => `
      <tr>
        <td colspan="2" style="font-size:${fontSize - 2}px;color:#666;padding-left:8px;padding-bottom:2px;">
          ↳ ${escHtml(m.name)}${m.priceAdjustment !== 0 ? ` (${m.priceAdjustment > 0 ? '+' : ''}${fmtCurrency(m.priceAdjustment, cur)})` : ''}
        </td>
        <td></td>
      </tr>`).join('')

    const noteLine = item.notes
      ? `<tr><td colspan="3" style="font-size:${fontSize - 2}px;color:#777;font-style:italic;padding-left:8px;padding-bottom:2px;">✎ ${escHtml(item.notes)}</td></tr>`
      : ''

    const unitPriceLine = !isKitchen && cfg.showUnitPrice && qty > 1
      ? `<tr>
           <td colspan="2" style="font-size:${fontSize - 2}px;color:#888;padding-left:4px;padding-bottom:1px;">
             @ ${fmtCurrency(unitPrice, cur)} each
           </td>
           <td></td>
         </tr>`
      : ''

    return `
      <tr>
        <td style="padding:3px 0;vertical-align:top;line-height:1.3;">${escHtml(item.name)}</td>
        <td style="padding:3px 0;text-align:center;vertical-align:top;">${qty}×</td>
        ${isKitchen ? '<td></td>' : `<td style="padding:3px 0;text-align:right;font-weight:600;vertical-align:top;">${fmtCurrency(lineTotal, cur)}</td>`}
      </tr>
      ${unitPriceLine}
      ${modLines}
      ${noteLine}
    `
  }).join('')

  // ── Payment rows ───────────────────────────────────────────────────────────
  const paymentRows = !isKitchen && cfg.showPaymentDetails && (order.payments || []).length
    ? (order.payments || []).map(p => `
        <div style="display:flex;justify-content:space-between;font-size:${fontSize - 1}px;padding:1px 0;text-transform:capitalize;">
          <span>${escHtml(String(p.paymentMethod || ''))}</span>
          <span>${fmtCurrency(p.amount, cur)}</span>
        </div>`
      ).join('')
    : ''

  // ── Totals block ───────────────────────────────────────────────────────────
  const totalsBlock = isKitchen ? '' : `
    ${cfg.showDividers ? dividerEl : ''}
    <div style="font-size:${fontSize - 1}px;">
      ${cfg.showSubtotal ? `<div style="display:flex;justify-content:space-between;padding:2px 0;"><span>${lbl(cfg,'labelSubtotal','Subtotal')}</span><span>${fmtCurrency(order.subtotal, cur)}</span></div>` : ''}
      ${cfg.showTax      ? `<div style="display:flex;justify-content:space-between;padding:2px 0;"><span>${lbl(cfg,'labelTax','Tax')}</span><span>${fmtCurrency(order.tax, cur)}</span></div>` : ''}
      ${cfg.showDiscount && order.discount > 0 ? `<div style="display:flex;justify-content:space-between;padding:2px 0;color:#16a34a;"><span>${lbl(cfg,'labelDiscount','Discount')}</span><span>-${fmtCurrency(order.discount, cur)}</span></div>` : ''}
      <div style="display:flex;justify-content:space-between;font-size:${fontSize + 2}px;font-weight:bold;border-top:1px solid #111;margin-top:3px;padding-top:3px;">
        <span>${lbl(cfg,'labelTotal','TOTAL')}</span>
        <span>${fmtCurrency(order.total, cur)}</span>
      </div>
    </div>
    ${paymentRows ? `
      ${cfg.showDividers ? dividerEl : ''}
      <div style="font-size:${fontSize - 2}px;text-transform:uppercase;letter-spacing:0.5px;color:#555;margin-bottom:3px;">${lbl(cfg,'labelPayment','Payment')}</div>
      ${paymentRows}
    ` : ''}
  `

  // ── Signature line ─────────────────────────────────────────────────────────
  const signatureLine = !isKitchen && cfg.showSignatureLine
    ? `${cfg.showDividers ? dividerEl : ''}
       <div style="font-size:${fontSize - 1}px;margin-top:4px;">${escHtml(cfg.signatureLabel || 'Signature: ____________________')}</div>`
    : ''

  // ── Logo ───────────────────────────────────────────────────────────────────
  const logoSrc  = cfg.logoUrl || restaurant.logo_url || ''
  const logoHtml = cfg.showLogo && logoSrc
    ? `<div style="text-align:center;margin-bottom:6px;"><img src="${escHtml(logoSrc)}" style="max-width:120px;max-height:60px;object-fit:contain;" alt="logo"/></div>`
    : ''

  // ── Header block ───────────────────────────────────────────────────────────
  const hAlign = cfg.headerAlign || 'center'
  const headerLines = [
    cfg.showRestaurantName
      ? `<div style="font-size:${nameFs}px;font-weight:${cfg.restaurantNameBold !== false ? 'bold' : 'normal'};letter-spacing:0.5px;">${escHtml(restaurant.name || '')}</div>`
      : '',
    cfg.showAddress && restaurant.address
      ? `<div style="font-size:${fontSize - 2}px;color:#555;margin-top:2px;">${escHtml(restaurant.address)}</div>`
      : '',
    cfg.showPhone && restaurant.phone
      ? `<div style="font-size:${fontSize - 2}px;color:#555;margin-top:2px;">Tel: ${escHtml(restaurant.phone)}</div>`
      : '',
    cfg.showEmail && restaurant.email
      ? `<div style="font-size:${fontSize - 2}px;color:#555;margin-top:2px;">${escHtml(restaurant.email)}</div>`
      : '',
    cfg.showWebsite && cfg.websiteText
      ? `<div style="font-size:${fontSize - 2}px;color:#555;margin-top:2px;">${escHtml(cfg.websiteText)}</div>`
      : '',
    cfg.headerText
      ? `<div style="font-size:${fontSize - 1}px;color:#444;font-style:italic;margin-top:3px;">${escHtml(cfg.headerText)}</div>`
      : '',
  ].filter(Boolean).join('\n')

  // ── Order meta ─────────────────────────────────────────────────────────────
  const metaLines = [
    cfg.showOrderId     ? `${lbl(cfg,'labelOrder','Order')}: ${escHtml(order.id)}` : '',
    cfg.showTableNumber && order.tableNumber ? `${lbl(cfg,'labelTable','Table')}: ${order.tableNumber}` : '',
    cfg.showOrderType   && order.orderType   ? `${lbl(cfg,'labelOrderType','Type')}: ${escHtml(order.orderType)}` : '',
    cfg.showWaiter && order.waiter && order.waiter !== 'Unassigned'
      ? `${lbl(cfg,'labelWaiter','Waiter')}: ${escHtml(order.waiter)}` : '',
    cfg.showDate ? orderDate : '',
  ].filter(Boolean).join('<br/>')

  // ── Footer ─────────────────────────────────────────────────────────────────
  const footerText = isKitchen
    ? 'Kitchen copy — not a receipt'
    : (cfg.footerText || 'Thank you for dining with us!')
  const fAlign = cfg.footerAlign || 'center'

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
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
    table { width: 100%; border-collapse: collapse; }
    th {
      font-size: ${fontSize - 2}px;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      padding: 2px 0;
      border-bottom: 1px solid #ccc;
    }
    @media print { html, body { width: ${paperW}; } }
  </style>
</head>
<body>

${logoHtml}

<div style="text-align:${hAlign};margin-bottom:8px;">
  ${headerLines}
  <div style="font-size:${fontSize + 1}px;font-weight:bold;margin-top:6px;">— ${lbl(cfg,'labelReceipt','RECEIPT')} —</div>
  ${metaLines ? `<div style="font-size:${fontSize - 2}px;color:#444;margin-top:3px;line-height:1.5;">${metaLines}</div>` : ''}
</div>

${cfg.showDividers ? dividerEl : ''}

<table>
  <thead>
    <tr>
      <th style="text-align:left;width:55%;">Item</th>
      <th style="text-align:center;width:10%;">Qty</th>
      ${isKitchen ? '<th></th>' : '<th style="text-align:right;width:35%;">Amount</th>'}
    </tr>
  </thead>
  <tbody>
    ${itemRows}
  </tbody>
</table>

${order.notes ? `${cfg.showDividers ? dividerEl : ''}<div style="font-size:${fontSize - 1}px;font-style:italic;color:#555;">Note: ${escHtml(order.notes)}</div>` : ''}

${totalsBlock}
${signatureLine}

${cfg.showDividers ? dividerEl : ''}
<div style="text-align:${fAlign};font-size:${fontSize - 2}px;color:#777;margin-top:4px;line-height:1.5;">${escHtml(footerText)}</div>

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
