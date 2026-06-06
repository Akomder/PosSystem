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
  showDiscount:        true,
  showPaymentDetails:  true,
  showSignatureLine:   false,
  signatureLabel:      'Signature: ____________________',
  // ── QR Payment ──────────────────────────────────────────────────────────────
  showQrPayment:       false,
  qrPaymentLabel:      'Scan to Pay',
  // ── Alt currencies ───────────────────────────────────────────────────────────
  showAltCurrencies:   false,
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

  // ── Alt currencies ─────────────────────────────────────────────────────────
  const exchangeRates = (restaurant.settings || {}).exchangeRates || {}
  const usdRate = parseFloat(exchangeRates.USD)
  const thbRate = parseFloat(exchangeRates.THB)
  const altCurrencyBlock = !isKitchen && cfg.showAltCurrencies && (usdRate || thbRate)
    ? `${cfg.showDividers ? dividerEl : ''}
       <div style="font-size:${fontSize - 1}px;">
         ${usdRate ? `<div style="display:flex;justify-content:space-between;padding:1px 0;"><span style="color:#888;">$ USD</span><span>≈ ${(parseFloat(order.total || 0) * usdRate).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span></div>` : ''}
         ${thbRate ? `<div style="display:flex;justify-content:space-between;padding:1px 0;"><span style="color:#888;">฿ THB</span><span>≈ ${(parseFloat(order.total || 0) * thbRate).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span></div>` : ''}
       </div>`
    : ''

  // ── QR payment ─────────────────────────────────────────────────────────────
  const qrImageBase64 = (restaurant.settings || {}).payment?.qrImageBase64 || ''
  const qrPaymentBlock = !isKitchen && cfg.showQrPayment
    ? `${cfg.showDividers ? dividerEl : ''}
       <div style="text-align:center;margin:6px 0 4px;">
         <div style="font-size:${fontSize - 1}px;font-weight:600;margin-bottom:5px;">${escHtml(cfg.qrPaymentLabel || 'Scan to Pay')}</div>
         ${qrImageBase64
           ? `<img src="${qrImageBase64}" style="width:80px;height:80px;object-fit:contain;display:block;margin:0 auto;" alt="QR"/>`
           : `<div style="width:80px;height:80px;margin:0 auto;border:1.5px dashed #ccc;display:flex;align-items:center;justify-content:center;font-size:9px;color:#aaa;">QR Code</div>`}
       </div>`
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
${altCurrencyBlock}
${qrPaymentBlock}

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

// ─── Shared: fetch restaurant by restaurantId ─────────────────────────────────
async function getRestaurant(rid) {
  const { rows } = await query(
    'SELECT id, name, phone, email, address, currency, logo_url, settings FROM restaurants WHERE id = $1',
    [rid]
  )
  return rows[0] || {}
}

// ─── A4-style document shell ──────────────────────────────────────────────────
// Used for purchase, return, transfer documents (not thermal receipts)
function docShell(title, restaurant, bodyHtml) {
  const cur  = restaurant.currency || 'LAK'
  const name = escHtml(restaurant.name || '')
  const addr = escHtml(restaurant.address || '')
  const tel  = escHtml(restaurant.phone || '')
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <title>${escHtml(title)}</title>
  <style>
    @page { margin: 12mm; size: A5; }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: Arial, Helvetica, sans-serif; font-size: 11px; color: #111; background: #fff; padding: 8px 10px; }
    h1 { font-size: 15px; font-weight: 800; text-align: center; margin: 10px 0 4px; letter-spacing: 0.5px; }
    h2 { font-size: 12px; text-align: center; color: #555; margin-bottom: 10px; }
    table { width: 100%; border-collapse: collapse; margin: 8px 0; font-size: 10.5px; }
    th { background: #f3f4f6; font-weight: 700; padding: 5px 4px; border: 1px solid #ddd; text-align: center; }
    td { padding: 4px; border: 1px solid #e5e7eb; vertical-align: top; }
    .lbl { color: #666; font-size: 10px; }
    .info-row { margin: 3px 0; font-size: 10.5px; }
    .sig-row { display: flex; justify-content: space-around; margin-top: 28px; text-align: center; }
    .sig-box { flex: 1; padding: 0 10px; }
    .sig-line { border-top: 1px solid #333; margin-top: 24px; padding-top: 4px; font-size: 10px; color: #555; }
    .right { text-align: right; }
    .center { text-align: center; }
    .bold { font-weight: 700; }
    .total-row td { font-weight: 700; background: #f9fafb; }
    .divider { border-top: 1px dashed #bbb; margin: 6px 0; }
    @media print { html, body { width: 148mm; } }
  </style>
</head>
<body>
<div style="font-size:10px;color:#555;margin-bottom:4px;">
  ${name}${addr ? ` · ${addr}` : ''}${tel ? ` · Tel: ${tel}` : ''}
</div>
${bodyHtml}
</body>
</html>`
}

// ─── BUILD: Draft Order ───────────────────────────────────────────────────────
function buildDraftHtml(order, restaurant) {
  const cur      = restaurant.currency || 'LAK'
  const cfg      = { ...DEFAULT_CONFIG, ...((restaurant.settings || {}).receipt || {}) }
  const fontSize = Math.max(8, Math.min(18, parseInt(cfg.fontSize) || 12))
  const fontFam  = FONT_MAP[cfg.fontFamily] || FONT_MAP.monospace
  const paperW   = cfg.paperWidth || '80mm'
  const divCss   = 'border-top: 1px dashed #aaa;'
  const dividerEl = `<div style="${divCss} margin: 5px 0;"></div>`
  const orderDate = new Date(order.createdAt).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' })

  const itemRows = (order.items || []).map(item => {
    const modLines = (item.modifiers || []).map(m =>
      `<tr><td colspan="3" style="font-size:${fontSize-2}px;color:#666;padding-left:8px;">↳ ${escHtml(m.name)}</td></tr>`
    ).join('')
    return `<tr>
      <td style="padding:3px 0;vertical-align:top;">${escHtml(item.name)}</td>
      <td style="padding:3px 0;text-align:center;vertical-align:top;">${item.quantity}×</td>
      <td style="padding:3px 0;text-align:right;vertical-align:top;">${fmtCurrency(item.lineTotal, cur)}</td>
    </tr>${modLines}`
  }).join('')

  const logoSrc = cfg.logoUrl || restaurant.logo_url || ''
  const logoHtml = cfg.showLogo && logoSrc
    ? `<div style="text-align:center;margin-bottom:6px;"><img src="${escHtml(logoSrc)}" style="max-width:120px;max-height:60px;object-fit:contain;" alt="logo"/></div>` : ''

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <title>Draft Order — ${escHtml(order.id)}</title>
  <style>
    @page { margin: 0; size: ${paperW} auto; }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: ${fontFam}; font-size: ${fontSize}px; width: ${paperW}; max-width: ${paperW}; padding: 6mm 4mm; color: #111; background: #fff; position: relative; }
    table { width: 100%; border-collapse: collapse; }
    th { font-size: ${fontSize-2}px; text-transform: uppercase; letter-spacing: .5px; padding: 2px 0; border-bottom: 1px solid #ccc; }
    .watermark { position: fixed; top: 50%; left: 50%; transform: translate(-50%,-50%) rotate(-35deg); font-size: 40px; font-weight: 900; color: rgba(239,68,68,.13); pointer-events: none; white-space: nowrap; z-index: 0; letter-spacing: 3px; }
    @media print { html, body { width: ${paperW}; } }
  </style>
</head>
<body>
<div class="watermark">DRAFT</div>
${logoHtml}
<div style="text-align:center;margin-bottom:8px;">
  ${cfg.showRestaurantName ? `<div style="font-size:${fontSize+4}px;font-weight:bold;">${escHtml(restaurant.name||'')}</div>` : ''}
  ${restaurant.phone ? `<div style="font-size:${fontSize-2}px;color:#555;">Tel: ${escHtml(restaurant.phone)}</div>` : ''}
  <div style="font-size:${fontSize+1}px;font-weight:bold;margin-top:6px;color:#dc2626;border:1.5px solid #dc2626;padding:2px 8px;display:inline-block;">— DRAFT ORDER —</div>
  <div style="font-size:${fontSize-2}px;color:#555;margin-top:4px;line-height:1.6;">
    ${lbl(cfg,'labelOrder','Order')}: ${escHtml(order.id)}<br/>
    ${order.tableNumber ? `${lbl(cfg,'labelTable','Table')}: ${order.tableNumber}<br/>` : ''}
    ${order.waiter && order.waiter!=='Unassigned' ? `${lbl(cfg,'labelWaiter','Waiter')}: ${escHtml(order.waiter)}<br/>` : ''}
    ${orderDate}
  </div>
</div>
<div style="${divCss} margin:5px 0;"></div>
<table>
  <thead><tr>
    <th style="text-align:left;width:55%;">Item</th>
    <th style="text-align:center;width:10%;">Qty</th>
    <th style="text-align:right;width:35%;">Amount</th>
  </tr></thead>
  <tbody>${itemRows}</tbody>
</table>
${dividerEl}
<div style="font-size:${fontSize-1}px;">
  <div style="display:flex;justify-content:space-between;padding:2px 0;"><span>${lbl(cfg,'labelSubtotal','Subtotal')}</span><span>${fmtCurrency(order.subtotal,cur)}</span></div>
  <div style="display:flex;justify-content:space-between;font-size:${fontSize+2}px;font-weight:bold;border-top:1px solid #111;margin-top:3px;padding-top:3px;">
    <span>${lbl(cfg,'labelTotal','TOTAL')}</span><span>${fmtCurrency(order.total,cur)}</span>
  </div>
</div>
${dividerEl}
<div style="text-align:center;font-size:${fontSize-2}px;color:#999;margin-top:4px;font-style:italic;">
  ⚠ This is a draft — not a final receipt
</div>
</body></html>`
}

// ─── BUILD: Return Invoice ────────────────────────────────────────────────────
function buildReturnHtml(ret, restaurant) {
  const cur = restaurant.currency || 'LAK'
  const date = new Date(ret.createdAt).toLocaleDateString('en-US', { dateStyle: 'medium' })
  const itemRows = (ret.items || []).map((item, i) => `
    <tr>
      <td class="center">${i+1}</td>
      <td>${escHtml(item.itemName)}</td>
      <td class="center">${item.quantity}</td>
      <td class="right">${fmtCurrency(item.unitPrice, cur)}</td>
      <td class="right bold">${fmtCurrency(item.lineTotal, cur)}</td>
    </tr>`).join('')

  const body = `
<h1>RETURN INVOICE</h1>
<h2>ID: ${escHtml(ret.id)} &nbsp;·&nbsp; ${date}</h2>
<div class="divider"></div>
<div class="info-row"><span class="lbl">Order Ref:</span> ${escHtml(String(ret.orderId||'—'))}</div>
<div class="info-row"><span class="lbl">Processed By:</span> ${escHtml(ret.processedBy||'—')}</div>
<div class="info-row"><span class="lbl">Reason:</span> ${escHtml(ret.reason||'—')}</div>
<div class="divider"></div>
<table>
  <thead><tr>
    <th style="width:6%">#</th>
    <th style="text-align:left">Item</th>
    <th style="width:10%">Qty</th>
    <th style="width:20%">Unit Price</th>
    <th style="width:22%">Total</th>
  </tr></thead>
  <tbody>${itemRows}</tbody>
</table>
<div style="text-align:right;margin:6px 0;">
  <div style="font-size:13px;font-weight:800;border-top:2px solid #111;padding-top:4px;margin-top:4px;">
    Total Refund: ${fmtCurrency(ret.total, cur)}
  </div>
</div>
<div class="divider"></div>
<div class="info-row">Status: <strong>${escHtml(ret.status||'')}</strong></div>
<div class="sig-row">
  <div class="sig-box"><div class="sig-line">Processed By</div></div>
  <div class="sig-box"><div class="sig-line">Customer Signature</div></div>
</div>`
  return docShell('Return Invoice — ' + ret.id, restaurant, body)
}

// ─── BUILD: Purchase Receipt ──────────────────────────────────────────────────
function buildPurchaseHtml(po, restaurant) {
  const cur  = restaurant.currency || 'LAK'
  const date = new Date(po.orderedAt || po.createdAt).toLocaleDateString('en-US', { dateStyle: 'medium' })
  const itemRows = (po.items || []).map((item, i) => `
    <tr>
      <td class="center">${i+1}</td>
      <td>${escHtml(item.itemName)}</td>
      <td class="center">${item.quantityOrdered}</td>
      <td class="center">${item.quantityReceived ?? '—'}</td>
      <td class="right">${fmtCurrency(item.unitCost, cur)}</td>
      <td class="right bold">${fmtCurrency(item.lineTotal, cur)}</td>
    </tr>`).join('')

  const body = `
<h1>PURCHASE ORDER RECEIPT</h1>
<h2>PO: ${escHtml(po.id)} &nbsp;·&nbsp; ${date}</h2>
<div class="divider"></div>
<div style="display:flex;gap:20px;flex-wrap:wrap;margin:6px 0;">
  <div style="flex:1">
    <div class="info-row"><span class="lbl">Supplier:</span> <strong>${escHtml(po.supplierName||'—')}</strong></div>
    <div class="info-row"><span class="lbl">Reference No:</span> ${escHtml(po.referenceNo||'—')}</div>
  </div>
  <div style="flex:1">
    <div class="info-row"><span class="lbl">Status:</span> <strong>${escHtml(po.status||'')}</strong></div>
    ${po.expectedAt ? `<div class="info-row"><span class="lbl">Expected:</span> ${new Date(po.expectedAt).toLocaleDateString('en-US',{dateStyle:'medium'})}</div>` : ''}
    ${po.receivedAt ? `<div class="info-row"><span class="lbl">Received:</span> ${new Date(po.receivedAt).toLocaleDateString('en-US',{dateStyle:'medium'})}</div>` : ''}
  </div>
</div>
<div class="divider"></div>
<table>
  <thead><tr>
    <th style="width:5%">#</th>
    <th style="text-align:left">Item</th>
    <th style="width:11%">Ordered</th>
    <th style="width:11%">Received</th>
    <th style="width:18%">Unit Cost</th>
    <th style="width:18%">Total</th>
  </tr></thead>
  <tbody>${itemRows}</tbody>
</table>
<div style="text-align:right;margin:6px 0;">
  <div style="font-size:13px;font-weight:800;border-top:2px solid #111;padding-top:4px;margin-top:4px;">
    Total: ${fmtCurrency(po.total, cur)}
  </div>
</div>
${po.notes ? `<div class="divider"></div><div class="info-row"><span class="lbl">Notes:</span> ${escHtml(po.notes)}</div>` : ''}
<div class="sig-row">
  <div class="sig-box"><div class="sig-line">Created By</div></div>
  <div class="sig-box"><div class="sig-line">Supplier Representative</div></div>
  <div class="sig-box"><div class="sig-line">Approved By</div></div>
</div>`
  return docShell('Purchase Order — ' + po.id, restaurant, body)
}

// ─── BUILD: Purchase Return ───────────────────────────────────────────────────
function buildPurchaseReturnHtml(pr, restaurant) {
  const cur  = restaurant.currency || 'LAK'
  const date = new Date(pr.createdAt).toLocaleDateString('en-US', { dateStyle: 'medium' })
  const itemRows = (pr.items || []).map((item, i) => `
    <tr>
      <td class="center">${i+1}</td>
      <td>${escHtml(item.itemName)}</td>
      <td class="center">${item.quantity}</td>
      <td class="right">${fmtCurrency(item.unitCost, cur)}</td>
      <td class="right bold">${fmtCurrency(item.lineTotal, cur)}</td>
    </tr>`).join('')

  const body = `
<h1>PURCHASE RETURN</h1>
<h2>ID: ${escHtml(pr.id)} &nbsp;·&nbsp; ${date}</h2>
<div class="divider"></div>
<div style="display:flex;gap:20px;flex-wrap:wrap;margin:6px 0;">
  <div style="flex:1">
    <div class="info-row"><span class="lbl">Supplier:</span> <strong>${escHtml(pr.supplierName||'—')}</strong></div>
    <div class="info-row"><span class="lbl">PO Reference:</span> ${escHtml(pr.purchaseOrderId ? `PO-${String(pr._id||'').padStart(4,'0')}` : pr.purchaseOrderId||'—')}</div>
  </div>
  <div style="flex:1">
    <div class="info-row"><span class="lbl">Status:</span> <strong>${escHtml(pr.status||'')}</strong></div>
    <div class="info-row"><span class="lbl">Reason:</span> ${escHtml(pr.reason||'—')}</div>
  </div>
</div>
<div class="divider"></div>
<table>
  <thead><tr>
    <th style="width:5%">#</th>
    <th style="text-align:left">Item</th>
    <th style="width:10%">Qty</th>
    <th style="width:20%">Unit Cost</th>
    <th style="width:20%">Total</th>
  </tr></thead>
  <tbody>${itemRows}</tbody>
</table>
<div style="text-align:right;margin:6px 0;">
  <div style="font-size:13px;font-weight:800;border-top:2px solid #111;padding-top:4px;margin-top:4px;">
    Total Return: ${fmtCurrency(pr.total, cur)}
  </div>
</div>
<div class="sig-row">
  <div class="sig-box"><div class="sig-line">Created By</div></div>
  <div class="sig-box"><div class="sig-line">Supplier Received</div></div>
</div>`
  return docShell('Purchase Return — ' + pr.id, restaurant, body)
}

// ─── BUILD: Cash In / PHIẾU THU ──────────────────────────────────────────────
function buildCashInHtml(entry, restaurant) {
  const cur  = restaurant.currency || 'LAK'
  const date = new Date(entry.createdAt).toLocaleDateString('en-US', { dateStyle: 'long' })
  const body = `
<h1>PHIẾU THU · CASH RECEIPT</h1>
<h2 style="font-size:10px;color:#888;">ID: ${escHtml(String(entry.id))} &nbsp;·&nbsp; ${date}</h2>
<div class="divider" style="border-color:#22c55e;opacity:.6;"></div>
<table style="border:none;margin:8px 0;">
  <tr>
    <td style="border:none;width:40%;padding:5px 0;" class="lbl">Received from / Description:</td>
    <td style="border:none;padding:5px 0;"><strong>${escHtml(entry.description||'—')}</strong></td>
  </tr>
  <tr>
    <td style="border:none;padding:5px 0;" class="lbl">Category:</td>
    <td style="border:none;padding:5px 0;">${escHtml(entry.category||'—')}</td>
  </tr>
  ${entry.reference ? `<tr><td style="border:none;padding:5px 0;" class="lbl">Reference:</td><td style="border:none;padding:5px 0;">${escHtml(entry.reference)}</td></tr>` : ''}
</table>
<div class="divider"></div>
<div style="text-align:center;margin:12px 0;">
  <div style="font-size:10px;color:#555;margin-bottom:4px;">Amount Received</div>
  <div style="font-size:20px;font-weight:900;color:#16a34a;letter-spacing:.5px;">${fmtCurrency(entry.amount, cur)}</div>
</div>
<div class="divider"></div>
<div class="sig-row">
  <div class="sig-box"><div class="sig-line">Cashier</div></div>
  <div class="sig-box"><div class="sig-line">Payer Signature</div></div>
  <div class="sig-box"><div class="sig-line">Accountant</div></div>
</div>`
  return docShell('Cash Receipt — ' + entry.id, restaurant, body)
}

// ─── BUILD: Cash Out / PHIẾU CHI ─────────────────────────────────────────────
function buildCashOutHtml(entry, restaurant) {
  const cur  = restaurant.currency || 'LAK'
  const date = new Date(entry.createdAt).toLocaleDateString('en-US', { dateStyle: 'long' })
  const body = `
<h1>PHIẾU CHI · PAYMENT SLIP</h1>
<h2 style="font-size:10px;color:#888;">ID: ${escHtml(String(entry.id))} &nbsp;·&nbsp; ${date}</h2>
<div class="divider" style="border-color:#ef4444;opacity:.6;"></div>
<table style="border:none;margin:8px 0;">
  <tr>
    <td style="border:none;width:40%;padding:5px 0;" class="lbl">Paid to / Description:</td>
    <td style="border:none;padding:5px 0;"><strong>${escHtml(entry.description||'—')}</strong></td>
  </tr>
  <tr>
    <td style="border:none;padding:5px 0;" class="lbl">Category:</td>
    <td style="border:none;padding:5px 0;">${escHtml(entry.category||'—')}</td>
  </tr>
  ${entry.reference ? `<tr><td style="border:none;padding:5px 0;" class="lbl">Reference:</td><td style="border:none;padding:5px 0;">${escHtml(entry.reference)}</td></tr>` : ''}
</table>
<div class="divider"></div>
<div style="text-align:center;margin:12px 0;">
  <div style="font-size:10px;color:#555;margin-bottom:4px;">Amount Paid</div>
  <div style="font-size:20px;font-weight:900;color:#dc2626;letter-spacing:.5px;">${fmtCurrency(entry.amount, cur)}</div>
</div>
<div class="divider"></div>
<div class="sig-row">
  <div class="sig-box"><div class="sig-line">Cashier</div></div>
  <div class="sig-box"><div class="sig-line">Recipient Signature</div></div>
  <div class="sig-box"><div class="sig-line">Accountant</div></div>
</div>`
  return docShell('Payment Slip — ' + entry.id, restaurant, body)
}

// ─── GET /api/print/:id/draft ─────────────────────────────────────────────────
async function getDraftOrder(req, res, next) {
  try {
    const rid = req.restaurantId
    let sql = `${ORDER_SELECT} WHERE o.id = $1`
    const params = [req.params.id]
    if (rid) { params.push(rid); sql += ` AND o.restaurant_id = $${params.length}` }
    sql += ' GROUP BY o.id'
    const { rows } = await query(sql, params)
    if (!rows.length) return res.status(404).json({ error: 'Order not found' })
    const order = fmtOrder(rows[0])
    const restaurant = await getRestaurant(rid || rows[0].restaurant_id)
    res.set('Content-Type', 'text/html; charset=utf-8').send(buildDraftHtml(order, restaurant))
  } catch (err) { next(err) }
}

// ─── GET /api/print/return/:id ────────────────────────────────────────────────
async function getReturnInvoice(req, res, next) {
  try {
    const rid = req.restaurantId
    const { rows } = await query(
      `SELECT r.*, json_agg(json_build_object('itemName',ri.item_name,'quantity',ri.quantity,'unitPrice',ri.unit_price,'lineTotal',ri.line_total) ORDER BY ri.id) FILTER (WHERE ri.id IS NOT NULL) AS items
       FROM returns r LEFT JOIN return_items ri ON ri.return_id = r.id
       WHERE r.id = $1 AND r.restaurant_id = $2 GROUP BY r.id`,
      [req.params.id, rid]
    )
    if (!rows.length) return res.status(404).json({ error: 'Return not found' })
    const r = rows[0]
    const ret = {
      id: `RET-${String(r.id).padStart(4,'0')}`, _id: r.id,
      orderId: r.order_id, reason: r.reason, total: parseFloat(r.total||0),
      status: r.status, processedBy: r.processed_by||'',
      createdAt: r.created_at, items: r.items||[],
    }
    const restaurant = await getRestaurant(rid)
    res.set('Content-Type', 'text/html; charset=utf-8').send(buildReturnHtml(ret, restaurant))
  } catch (err) { next(err) }
}

// ─── GET /api/print/purchase/:id ──────────────────────────────────────────────
async function getPurchaseReceipt(req, res, next) {
  try {
    const rid = req.restaurantId
    const poRes = await query(
      `SELECT po.*, s.name AS supplier_name FROM purchase_orders po LEFT JOIN suppliers s ON s.id=po.supplier_id WHERE po.id=$1 AND po.restaurant_id=$2`,
      [req.params.id, rid]
    )
    if (!poRes.rows.length) return res.status(404).json({ error: 'Purchase order not found' })
    const po = poRes.rows[0]
    const { rows: items } = await query('SELECT * FROM purchase_order_items WHERE purchase_order_id=$1 ORDER BY id', [po.id])
    const data = {
      id: `PO-${String(po.id).padStart(4,'0')}`,
      supplierName: po.supplier_name||'', referenceNo: po.reference_no,
      status: po.status, orderedAt: po.ordered_at, expectedAt: po.expected_at, receivedAt: po.received_at,
      notes: po.notes, total: parseFloat(po.total),
      items: items.map(i => ({ itemName: i.item_name, quantityOrdered: i.quantity_ordered, quantityReceived: i.quantity_received, unitCost: parseFloat(i.unit_cost), lineTotal: parseFloat(i.line_total) })),
    }
    const restaurant = await getRestaurant(rid)
    res.set('Content-Type', 'text/html; charset=utf-8').send(buildPurchaseHtml(data, restaurant))
  } catch (err) { next(err) }
}

// ─── GET /api/print/purchase-return/:id ──────────────────────────────────────
async function getPurchaseReturnReceipt(req, res, next) {
  try {
    const rid = req.restaurantId
    const prRes = await query(
      `SELECT pr.*, s.name AS supplier_name FROM purchase_returns pr LEFT JOIN suppliers s ON s.id=pr.supplier_id WHERE pr.id=$1 AND pr.restaurant_id=$2`,
      [req.params.id, rid]
    )
    if (!prRes.rows.length) return res.status(404).json({ error: 'Purchase return not found' })
    const pr = prRes.rows[0]
    const { rows: items } = await query('SELECT * FROM purchase_return_items WHERE purchase_return_id=$1 ORDER BY id', [pr.id])
    const data = {
      id: `PR-${String(pr.id).padStart(4,'0')}`, _id: pr.id,
      supplierName: pr.supplier_name||'', purchaseOrderId: pr.purchase_order_id,
      referenceNo: pr.reference_no, reason: pr.reason, status: pr.status,
      total: parseFloat(pr.total), createdAt: pr.created_at,
      items: items.map(i => ({ itemName: i.item_name, quantity: i.quantity, unitCost: parseFloat(i.unit_cost), lineTotal: parseFloat(i.line_total) })),
    }
    const restaurant = await getRestaurant(rid)
    res.set('Content-Type', 'text/html; charset=utf-8').send(buildPurchaseReturnHtml(data, restaurant))
  } catch (err) { next(err) }
}

// ─── GET /api/print/cashflow/:id ─────────────────────────────────────────────
async function getCashFlowPrint(req, res, next) {
  try {
    const rid = req.restaurantId
    const { rows } = await query('SELECT * FROM cash_flow_entries WHERE id=$1 AND restaurant_id=$2', [req.params.id, rid])
    if (!rows.length) return res.status(404).json({ error: 'Cash flow entry not found' })
    const entry = { id: rows[0].id, type: rows[0].type, category: rows[0].category, amount: parseFloat(rows[0].amount), description: rows[0].description||'', reference: rows[0].reference||'', status: rows[0].status, createdAt: rows[0].created_at }
    const restaurant = await getRestaurant(rid)
    const html = entry.type === 'income'
      ? buildCashInHtml(entry, restaurant)
      : buildCashOutHtml(entry, restaurant)
    res.set('Content-Type', 'text/html; charset=utf-8').send(html)
  } catch (err) { next(err) }
}

module.exports = {
  getReceipt, getKitchenTicket,
  getDraftOrder, getReturnInvoice, getPurchaseReceipt, getPurchaseReturnReceipt, getCashFlowPrint,
}
