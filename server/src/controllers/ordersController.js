const { query, pool }     = require('../config/db')
const { checkValidation } = require('../middleware/errorHandler')
const { emitOrderCreated, emitOrderUpdated, emitTableUpdated, emitStockLow } = require('../config/socket')
const { deductStock }     = require('../services/stock')

// ─── Schema status values ─────────────────────────────────────────────────────
// orders.status CHECK: 'Pending' | 'In Progress' | 'Served' | 'Closed' | 'Cancelled'
const VALID_STATUSES = ['Pending', 'In Progress', 'Served', 'Closed', 'Cancelled']

// ─── format helpers ───────────────────────────────────────────────────────────
const _ID_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXY3456789'  // 30 unambiguous chars
function fmtOrderId(n) {
  const B = _ID_CHARS.length
  // Integer hash (Thomas Wang): makes sequential IDs look random
  let x = Math.imul(n ^ (n >>> 15), 0x1234567 | 1)
  x = Math.imul(x ^ (x >>> 13), 0x89ABCDE | 1)
  x = (x ^ (x >>> 17)) >>> 0          // unsigned 32-bit
  let v = x % (B * B * B * B)         // 4-digit base-30
  let s = ''
  for (let i = 0; i < 4; i++) { s = _ID_CHARS[v % B] + s; v = Math.floor(v / B) }
  return '#' + s
}
function fmtTableId(n) { return n ? `T-${String(n).padStart(2, '0')}` : null }
function fmtMenuId(n)  { return `MI-${String(n).padStart(3, '0')}`  }

function fmtOrder(r) {
  return {
    rawId:         r.id,
    id:            fmtOrderId(r.id),
    orderType:     r.order_type  || 'Dine In',
    tableId:       fmtTableId(r.table_id),
    tableNumber:   r.table_number,
    waiter:        r.waiter,
    status:        r.status,
    notes:         r.notes || '',
    subtotal:      parseFloat(r.subtotal || 0),
    total:         parseFloat(r.total    || 0),
    discount:      parseFloat(r.discount || 0),
    paymentMethod: r.payment_method || 'cash',
    currency:      r.currency       || 'LAK',
    voucherCode:   r.voucher_code   || '',
    cashTendered:  parseFloat(r.cash_tendered  || 0),
    changeAmount:  parseFloat(r.change_amount  || 0),
    customerId:     r.customer_id ? `CUS-${String(r.customer_id).padStart(3,'0')}` : null,
    paymentStatus:  r.payment_status || 'unpaid',
    cancelReason:   r.cancel_reason  || null,
    payments: (r.payments || []).map(p => ({
      id:            p.id,
      paymentMethod: p.payment_method,
      amount:        parseFloat(p.amount),
      currency:      p.currency,
      cashTendered:  parseFloat(p.cash_tendered || 0),
      changeGiven:   parseFloat(p.change_given  || 0),
      createdAt:     p.created_at,
    })),
    items: (r.items || []).map(i => ({
      id:          fmtMenuId(i.menu_item_id),
      orderItemId: i.order_item_id,
      name:        i.name,
      quantity:    i.quantity,
      unitPrice:   parseFloat(i.unit_price),
      lineTotal:   parseFloat(i.line_total),
      notes:       i.notes     || '',
      station:     i.station   || 'Kitchen',
      completedAt: i.completed_at || null,
      modifiers: (i.modifiers || []).map(m => ({
        id:              m.id,
        modifierOptionId: m.modifier_option_id,
        name:            m.name,
        priceAdjustment: parseFloat(m.price_adjustment || 0),
      })),
    })),
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  }
}

// ─── base SELECT ──────────────────────────────────────────────────────────────
const ORDER_SELECT = `
  SELECT o.*,
    COALESCE(
      json_agg(
        json_build_object(
          'order_item_id', oi.id,
          'menu_item_id',  oi.menu_item_id,
          'name',          oi.name,
          'quantity',      oi.quantity,
          'unit_price',    oi.unit_price,
          'line_total',    oi.quantity * oi.unit_price,
          'notes',         oi.notes,
          'station',       oi.station,
          'completed_at',  oi.completed_at,
          'modifiers',     COALESCE((
            SELECT json_agg(json_build_object(
              'id',                oim.id,
              'modifier_option_id', oim.modifier_option_id,
              'name',              oim.name,
              'price_adjustment',  oim.price_adjustment
            ) ORDER BY oim.id)
            FROM order_item_modifiers oim
            WHERE oim.order_item_id = oi.id
          ), '[]'::json)
        ) ORDER BY oi.id
      ) FILTER (WHERE oi.id IS NOT NULL),
    '[]'::json) AS items,
    COALESCE((
      SELECT json_agg(json_build_object(
        'id',             op.id,
        'payment_method', op.payment_method,
        'amount',         op.amount,
        'currency',       op.currency,
        'cash_tendered',  op.cash_tendered,
        'change_given',   op.change_given,
        'created_at',     op.created_at
      ) ORDER BY op.id)
      FROM order_payments op WHERE op.order_id = o.id
    ), '[]'::json) AS payments
  FROM orders o
  LEFT JOIN order_items oi ON oi.order_id = o.id
`

// ─── GET /api/orders ──────────────────────────────────────────────────────────
async function getAllOrders(req, res, next) {
  try {
    const { status, tableId, orderType, limit = 100, offset = 0 } = req.query
    const rid = req.restaurantId
    let where = 'WHERE 1=1'
    const params = []

    if (rid)       { params.push(rid);       where += ` AND o.restaurant_id = $${params.length}` }
    if (status)    { params.push(status);    where += ` AND o.status = $${params.length}` }
    if (tableId)   { params.push(tableId);   where += ` AND o.table_id = $${params.length}` }
    if (orderType) { params.push(orderType); where += ` AND o.order_type = $${params.length}` }

    params.push(parseInt(limit)); params.push(parseInt(offset))
    const sql = `
      ${ORDER_SELECT}
      ${where}
      GROUP BY o.id
      ORDER BY o.created_at DESC
      LIMIT $${params.length - 1} OFFSET $${params.length}
    `
    const { rows } = await query(sql, params)
    res.json(rows.map(fmtOrder))
  } catch (err) { next(err) }
}

// ─── GET /api/orders/:id ──────────────────────────────────────────────────────
async function getOrder(req, res, next) {
  try {
    const rid = req.restaurantId
    let sql = `${ORDER_SELECT} WHERE o.id = $1`
    const params = [req.params.id]
    if (rid) { params.push(rid); sql += ` AND o.restaurant_id = $${params.length}` }
    sql += ' GROUP BY o.id'
    const { rows } = await query(sql, params)
    if (!rows.length) return res.status(404).json({ error: 'Order not found' })
    res.json(fmtOrder(rows[0]))
  } catch (err) { next(err) }
}

// ─── POST /api/orders ─────────────────────────────────────────────────────────
async function createOrder(req, res, next) {
  if (!checkValidation(req, res)) return
  const {
    tableId, waiter, notes, items, orderType = 'Dine In',
    customerId, paymentMethod, currency, discount, voucherCode, cashTendered, changeAmount,
    payments,   // optional array: [{ method, amount, currency, cashTendered, changeGiven }]
    debtorName, debtorPhone,  // for credit sales without a saved customer
  } = req.body

  // Credit sale: the sale is recorded now, then transferred to a debt account.
  const isCredit = paymentMethod === 'credit'
  if (isCredit && !customerId && !debtorName) {
    return res.status(400).json({ error: 'Credit sales require a customer or debtor name' })
  }

  const isDineIn = orderType === 'Dine In'

  // Dine In requires a tableId; Takeaway/Delivery do not
  if (isDineIn && !tableId) {
    return res.status(400).json({ error: 'tableId is required for Dine In orders' })
  }
  if (!items?.length) {
    return res.status(400).json({ error: 'items must not be empty' })
  }

  const client = await pool.connect()
  try {
    await client.query('BEGIN')

    // 1. Resolve table info (Dine In only)
    let resolvedTableId   = null
    let resolvedTableNum  = null
    let rid               = req.restaurantId || null

    if (isDineIn) {
      const tRes = await client.query(
        'SELECT * FROM restaurant_tables WHERE id = $1 FOR UPDATE', [tableId]
      )
      if (!tRes.rows.length) throw Object.assign(new Error('Table not found'), { status: 404 })
      const table      = tRes.rows[0]
      resolvedTableId  = table.id
      resolvedTableNum = table.number
      rid              = rid || table.restaurant_id
    }

    // 2. Fetch current menu prices + station
    const menuIds = items.map(i => i.menuItemId)
    const mRes = await client.query(
      'SELECT id, name, price, station FROM menu_items WHERE id = ANY($1)', [menuIds]
    )
    const menuMap = {}
    mRes.rows.forEach(m => { menuMap[m.id] = m })

    // 3. Calculate totals (modifiers adjust unit price)
    let subtotal = 0
    const enriched = items.map(i => {
      const m = menuMap[i.menuItemId]
      if (!m) throw Object.assign(new Error(`Menu item ${i.menuItemId} not found`), { status: 400 })
      const modifierAdj = (i.modifiers || []).reduce((s, mod) => s + parseFloat(mod.priceAdjustment || 0), 0)
      const unitPrice = parseFloat(m.price) + modifierAdj
      const line = unitPrice * i.quantity
      subtotal += line
      return { ...i, name: m.name, unitPrice, lineTotal: line, station: m.station || 'Kitchen' }
    })
    const discountAmt = parseFloat(discount) || 0
    const finalTotal  = Math.max(0, Math.round((subtotal - discountAmt) * 100) / 100)

    // 4. Determine payment status from payments array or legacy fields.
    //    Credit sales are recorded as unpaid (settled later via the debt account).
    const paymentsList = isCredit ? null : (Array.isArray(payments) && payments.length ? payments : null)
    const paidTotal = isCredit ? 0 : (paymentsList
      ? paymentsList.reduce((s, p) => s + (parseFloat(p.amount) || 0), 0)
      : (parseFloat(cashTendered) || finalTotal))  // legacy: assume full payment
    const paymentStatus = isCredit ? 'unpaid'
      : paidTotal <= 0 ? 'unpaid'
      : Math.round(paidTotal * 100) >= Math.round(finalTotal * 100) ? 'paid'
      : 'partial'
    const firstMethod = isCredit ? 'credit' : (paymentsList ? paymentsList[0]?.method : (paymentMethod || 'cash'))

    // 4b. Resolve the business day = the currently open shift.
    // Orders created after midnight stay on the shift's day until it is closed.
    // The business day MUST be open to take orders, so every sale is attributed.
    let shiftId = null
    if (rid) {
      const sRes = await client.query(
        `SELECT id FROM shifts WHERE restaurant_id = $1 AND status = 'open' ORDER BY opened_at DESC LIMIT 1`,
        [rid]
      )
      shiftId = sRes.rows[0]?.id || null
      if (!shiftId) {
        throw Object.assign(new Error('Open the business day before taking orders'), { status: 409 })
      }
    }

    // 5. Insert order
    const oRes = await client.query(
      `INSERT INTO orders
         (order_type, table_id, table_number, waiter, notes, subtotal, total,
          customer_id, payment_method, currency, discount, voucher_code,
          cash_tendered, change_amount, payment_status, restaurant_id, shift_id)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17) RETURNING *`,
      [
        orderType,
        resolvedTableId, resolvedTableNum,
        waiter || 'Unassigned', notes || '',
        subtotal, finalTotal,
        customerId || null,
        firstMethod || 'cash', currency || 'LAK',
        discountAmt, voucherCode || '',
        parseFloat(cashTendered) || 0, parseFloat(changeAmount) || 0,
        paymentStatus,
        rid, shiftId,
      ]
    )
    const order = oRes.rows[0]

    // 5. Insert order_items + modifiers
    for (const item of enriched) {
      const oiRes = await client.query(
        `INSERT INTO order_items (order_id, menu_item_id, name, quantity, unit_price, notes, station, restaurant_id)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING id`,
        [order.id, item.menuItemId, item.name, item.quantity, item.unitPrice, item.notes || '', item.station || 'Kitchen', rid]
      )
      const orderItemId = oiRes.rows[0].id
      for (const mod of (item.modifiers || [])) {
        await client.query(
          `INSERT INTO order_item_modifiers (order_item_id, modifier_option_id, name, price_adjustment)
           VALUES ($1,$2,$3,$4)`,
          [orderItemId, mod.modifierOptionId, mod.name, mod.priceAdjustment || 0]
        )
      }
    }

    // 6. Insert payment records
    if (paymentsList) {
      for (const p of paymentsList) {
        await client.query(
          `INSERT INTO order_payments (order_id, restaurant_id, payment_method, amount, currency, cash_tendered, change_given)
           VALUES ($1,$2,$3,$4,$5,$6,$7)`,
          [order.id, rid, p.method || 'cash', parseFloat(p.amount), p.currency || 'LAK',
           parseFloat(p.cashTendered) || 0, parseFloat(p.changeGiven) || 0]
        )
      }
    } else if (paymentStatus !== 'unpaid') {
      // Legacy single-payment: insert one record from flat fields
      await client.query(
        `INSERT INTO order_payments (order_id, restaurant_id, payment_method, amount, currency, cash_tendered, change_given)
         VALUES ($1,$2,$3,$4,$5,$6,$7)`,
        [order.id, rid, firstMethod || 'cash', finalTotal, currency || 'LAK',
         parseFloat(cashTendered) || 0, parseFloat(changeAmount) || 0]
      )
    }

    // 6b. Credit sale → record the bill against a debt account (sale stays recorded).
    if (isCredit) {
      await client.query(
        `INSERT INTO debts (restaurant_id, customer_id, debtor_name, debtor_phone, amount, description, order_id, status)
         VALUES ($1,$2,$3,$4,$5,$6,$7,'unpaid')`,
        [rid, customerId || null, debtorName || null, debtorPhone || null,
         finalTotal, `Credit sale — order ${fmtOrderId(order.id)}`, order.id]
      )
    }

    // 7. Mark table Occupied (Dine In only)
    if (isDineIn) {
      await client.query(
        `UPDATE restaurant_tables
           SET status='Occupied', current_order_id=$1, waiter=$2
         WHERE id=$3`,
        [order.id, waiter || null, resolvedTableId]
      )
    }

    // 8. Deduct tracked stock quantities (keeps stock + stock_quantity in sync);
    //    collect low-stock items to alert after commit.
    const lowStockItems = await deductStock(client, rid, enriched)

    await client.query('COMMIT')

    // Emit low-stock alerts outside transaction (after commit)
    if (lowStockItems.length) emitStockLow(lowStockItems)

    // 7. Return full order with items
    const fullRes = await query(
      `${ORDER_SELECT} WHERE o.id = $1 GROUP BY o.id`, [order.id]
    )
    const fullOrder = fmtOrder(fullRes.rows[0])
    emitOrderCreated(fullOrder)
    res.status(201).json(fullOrder)
  } catch (err) {
    await client.query('ROLLBACK')
    if (err.status) return res.status(err.status).json({ error: err.message })
    next(err)
  } finally {
    client.release()
  }
}

// ─── PATCH /api/orders/:id/status ────────────────────────────────────────────
async function updateStatus(req, res, next) {
  if (!checkValidation(req, res)) return
  const { status, cancelReason } = req.body
  if (!VALID_STATUSES.includes(status)) {
    return res.status(400).json({ error: `status must be one of: ${VALID_STATUSES.join(', ')}` })
  }

  const client = await pool.connect()
  try {
    await client.query('BEGIN')

    const rid = req.restaurantId

    // Fetch current status to enforce transition rules
    const curRes = await client.query(
      rid ? 'SELECT status FROM orders WHERE id=$1 AND restaurant_id=$2'
          : 'SELECT status FROM orders WHERE id=$1',
      rid ? [req.params.id, rid] : [req.params.id]
    )
    if (!curRes.rows.length) {
      await client.query('ROLLBACK')
      return res.status(404).json({ error: 'Order not found' })
    }
    const currentStatus = curRes.rows[0].status

    // Transition guard: Cancelled is terminal; Closed cannot be cancelled
    if (currentStatus === 'Cancelled') {
      await client.query('ROLLBACK')
      return res.status(400).json({ error: 'Cancelled orders cannot be changed' })
    }
    if (currentStatus === 'Closed' && status === 'Cancelled') {
      await client.query('ROLLBACK')
      return res.status(400).json({ error: 'Closed orders cannot be cancelled' })
    }

    // Build dynamic SET clause
    const isCancelling = status === 'Cancelled'
    let oRes
    if (isCancelling) {
      oRes = await client.query(
        rid
          ? 'UPDATE orders SET status=$1, cancel_reason=$2, updated_at=NOW() WHERE id=$3 AND restaurant_id=$4 RETURNING *'
          : 'UPDATE orders SET status=$1, cancel_reason=$2, updated_at=NOW() WHERE id=$3 RETURNING *',
        rid ? [status, cancelReason || null, req.params.id, rid]
            : [status, cancelReason || null, req.params.id]
      )
    } else {
      oRes = await client.query(
        rid
          ? 'UPDATE orders SET status=$1, updated_at=NOW() WHERE id=$2 AND restaurant_id=$3 RETURNING *'
          : 'UPDATE orders SET status=$1, updated_at=NOW() WHERE id=$2 RETURNING *',
        rid ? [status, req.params.id, rid] : [status, req.params.id]
      )
    }
    if (!oRes.rows.length) {
      await client.query('ROLLBACK')
      return res.status(404).json({ error: 'Order not found' })
    }
    const order = oRes.rows[0]

    // Free the table when order is Closed or Cancelled
    if (status === 'Closed' || status === 'Cancelled') {
      await client.query(
        `UPDATE restaurant_tables
         SET status='Available', current_order_id=NULL, waiter=NULL
         WHERE current_order_id=$1`,
        [order.id]
      )
    }

    // Mark payments as refunded when cancelling a paid order
    if (isCancelling && order.payment_status !== 'unpaid') {
      await client.query(
        `UPDATE orders SET payment_status='refunded' WHERE id=$1`,
        [order.id]
      )
    }

    await client.query('COMMIT')

    const fullRes = await query(
      `${ORDER_SELECT} WHERE o.id = $1 GROUP BY o.id`, [order.id]
    )
    const fullOrder = fmtOrder(fullRes.rows[0])
    emitOrderUpdated(fullOrder.id, status, fullOrder)
    res.json(fullOrder)
  } catch (err) {
    await client.query('ROLLBACK')
    next(err)
  } finally {
    client.release()
  }
}

// ─── PUT /api/orders/:id ──────────────────────────────────────────────────────
async function updateOrder(req, res, next) {
  if (!checkValidation(req, res)) return
  const { notes, items } = req.body

  const client = await pool.connect()
  try {
    await client.query('BEGIN')

    const menuIds = items.map(i => i.menuItemId)
    const mRes = await client.query(
      'SELECT id, name, price, station FROM menu_items WHERE id = ANY($1)', [menuIds]
    )
    const menuMap = {}
    mRes.rows.forEach(m => { menuMap[m.id] = m })

    let subtotal = 0
    const enriched = items.map(i => {
      const m = menuMap[i.menuItemId]
      if (!m) throw Object.assign(new Error(`Menu item ${i.menuItemId} not found`), { status: 400 })
      const modifierAdj = (i.modifiers || []).reduce((s, mod) => s + parseFloat(mod.priceAdjustment || 0), 0)
      const unitPrice = parseFloat(m.price) + modifierAdj
      const line = unitPrice * i.quantity
      subtotal += line
      return { ...i, name: m.name, unitPrice, lineTotal: line, station: m.station || 'Kitchen' }
    })
    const total = Math.round(subtotal * 100) / 100

    // Delete old items (cascades to order_item_modifiers)
    await client.query('DELETE FROM order_items WHERE order_id=$1', [req.params.id])
    const rid = req.restaurantId
    for (const item of enriched) {
      const oiRes = await client.query(
        `INSERT INTO order_items (order_id, menu_item_id, name, quantity, unit_price, notes, station, restaurant_id)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING id`,
        [req.params.id, item.menuItemId, item.name, item.quantity, item.unitPrice, item.notes || '', item.station || 'Kitchen', rid]
      )
      const orderItemId = oiRes.rows[0].id
      for (const mod of (item.modifiers || [])) {
        await client.query(
          `INSERT INTO order_item_modifiers (order_item_id, modifier_option_id, name, price_adjustment)
           VALUES ($1,$2,$3,$4)`,
          [orderItemId, mod.modifierOptionId, mod.name, mod.priceAdjustment || 0]
        )
      }
    }

    const oRes = await client.query(
      rid
        ? `UPDATE orders SET notes=$1, subtotal=$2, total=$3, updated_at=NOW() WHERE id=$4 AND restaurant_id=$5 RETURNING *`
        : `UPDATE orders SET notes=$1, subtotal=$2, total=$3, updated_at=NOW() WHERE id=$4 RETURNING *`,
      rid ? [notes || '', subtotal, total, req.params.id, rid] : [notes || '', subtotal, total, req.params.id]
    )
    if (!oRes.rows.length) {
      await client.query('ROLLBACK')
      return res.status(404).json({ error: 'Order not found' })
    }

    await client.query('COMMIT')

    const fullRes = await query(
      `${ORDER_SELECT} WHERE o.id = $1 GROUP BY o.id`, [req.params.id]
    )
    const fullOrder = fmtOrder(fullRes.rows[0])
    emitOrderUpdated(fullOrder.id, fullOrder.status, fullOrder)
    res.json(fullOrder)
  } catch (err) {
    await client.query('ROLLBACK')
    if (err.status) return res.status(err.status).json({ error: err.message })
    next(err)
  } finally {
    client.release()
  }
}

// ─── PATCH /api/orders/:orderId/items/:itemId/done ────────────────────────────
async function markItemDone(req, res, next) {
  const { orderId, itemId } = req.params
  const rid = req.restaurantId
  try {
    const result = await query(
      rid
        ? `UPDATE order_items SET completed_at = NOW()
           WHERE id = $1 AND order_id = $2
             AND EXISTS (SELECT 1 FROM orders WHERE id = $2 AND restaurant_id = $3)
           RETURNING *`
        : `UPDATE order_items SET completed_at = NOW()
           WHERE id = $1 AND order_id = $2 RETURNING *`,
      rid ? [itemId, orderId, rid] : [itemId, orderId]
    )
    if (!result.rows.length) return res.status(404).json({ error: 'Item not found' })

    // Re-fetch the full order so the socket update reflects the new completedAt
    const fullRes = await query(
      `${ORDER_SELECT} WHERE o.id = $1 GROUP BY o.id`, [orderId]
    )
    if (!fullRes.rows.length) return res.status(404).json({ error: 'Order not found' })
    const fullOrder = fmtOrder(fullRes.rows[0])
    emitOrderUpdated(fullOrder.id, fullOrder.status, fullOrder)
    res.json(fullOrder)
  } catch (err) { next(err) }
}

// ─── PATCH /api/orders/:id/checkout ──────────────────────────────────────────
// Pay and close an existing order (QR/Pending) without re-submitting items.
async function checkoutQrOrder(req, res, next) {
  const {
    payments, paymentMethod, currency = 'LAK',
    discount = 0, voucherCode, cashTendered, changeAmount,
  } = req.body

  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    const rid = req.restaurantId

    const curRes = await client.query(
      rid
        ? 'SELECT * FROM orders WHERE id=$1 AND restaurant_id=$2'
        : 'SELECT * FROM orders WHERE id=$1',
      rid ? [req.params.id, rid] : [req.params.id]
    )
    if (!curRes.rows.length) {
      await client.query('ROLLBACK')
      return res.status(404).json({ error: 'Order not found' })
    }
    const order = curRes.rows[0]

    if (order.status === 'Closed')    { await client.query('ROLLBACK'); return res.status(400).json({ error: 'Order already closed' }) }
    if (order.status === 'Cancelled') { await client.query('ROLLBACK'); return res.status(400).json({ error: 'Cannot checkout a cancelled order' }) }

    const discountAmt  = parseFloat(discount) || 0
    const finalTotal   = Math.max(0, Math.round((parseFloat(order.total) - discountAmt) * 100) / 100)
    const paymentsList = Array.isArray(payments) && payments.length ? payments : null
    const firstMethod  = paymentsList ? paymentsList[0]?.method : (paymentMethod || 'cash')
    const paidTotal    = paymentsList
      ? paymentsList.reduce((s, p) => s + (parseFloat(p.amount) || 0), 0)
      : (parseFloat(cashTendered) || finalTotal)
    const payStatus    = Math.round(paidTotal * 100) >= Math.round(finalTotal * 100) ? 'paid' : 'partial'

    await client.query(
      rid
        ? `UPDATE orders SET status='Closed', payment_status=$1, payment_method=$2, currency=$3,
             discount=$4, voucher_code=$5, cash_tendered=$6, change_amount=$7, total=$8,
             updated_at=NOW() WHERE id=$9 AND restaurant_id=$10`
        : `UPDATE orders SET status='Closed', payment_status=$1, payment_method=$2, currency=$3,
             discount=$4, voucher_code=$5, cash_tendered=$6, change_amount=$7, total=$8,
             updated_at=NOW() WHERE id=$9`,
      rid
        ? [payStatus, firstMethod, currency, discountAmt, voucherCode || null,
           parseFloat(cashTendered) || finalTotal, parseFloat(changeAmount) || 0, finalTotal, order.id, rid]
        : [payStatus, firstMethod, currency, discountAmt, voucherCode || null,
           parseFloat(cashTendered) || finalTotal, parseFloat(changeAmount) || 0, finalTotal, order.id]
    )

    if (order.table_id) {
      await client.query(
        `UPDATE restaurant_tables SET status='Available', current_order_id=NULL, waiter=NULL WHERE id=$1`,
        [order.table_id]
      )
    }

    if (paymentsList) {
      for (const p of paymentsList) {
        await client.query(
          `INSERT INTO order_payments (order_id, restaurant_id, payment_method, amount, currency, cash_tendered, change_given)
           VALUES ($1,$2,$3,$4,$5,$6,$7)`,
          [order.id, order.restaurant_id, p.method, parseFloat(p.amount),
           p.currency || currency, parseFloat(p.cashTendered) || parseFloat(p.amount), parseFloat(p.changeGiven) || 0]
        )
      }
    } else {
      await client.query(
        `INSERT INTO order_payments (order_id, restaurant_id, payment_method, amount, currency, cash_tendered, change_given)
         VALUES ($1,$2,$3,$4,$5,$6,$7)`,
        [order.id, order.restaurant_id, firstMethod, finalTotal, currency,
         parseFloat(cashTendered) || finalTotal, parseFloat(changeAmount) || 0]
      )
    }

    await client.query('COMMIT')

    const fullRes = await query(`${ORDER_SELECT} WHERE o.id = $1 GROUP BY o.id`, [order.id])
    const fullOrder = fmtOrder(fullRes.rows[0])
    emitOrderUpdated(fullOrder.id, 'Closed', fullOrder)
    res.json(fullOrder)
  } catch (err) {
    await client.query('ROLLBACK')
    next(err)
  } finally {
    client.release()
  }
}

module.exports = { getAllOrders, getOrder, createOrder, updateStatus, updateOrder, markItemDone, checkoutQrOrder, ORDER_SELECT, fmtOrder }
