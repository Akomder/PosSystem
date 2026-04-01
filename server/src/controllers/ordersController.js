const { query, pool }     = require('../config/db')
const { checkValidation } = require('../middleware/errorHandler')
const { emitOrderCreated, emitOrderUpdated, emitTableUpdated } = require('../config/socket')

// ─── Schema status values ─────────────────────────────────────────────────────
// orders.status CHECK: 'Pending' | 'In Progress' | 'Served' | 'Closed'
const VALID_STATUSES = ['Pending', 'In Progress', 'Served', 'Closed']

// ─── format helpers ───────────────────────────────────────────────────────────
function fmtOrderId(n) { return `ORD-${String(n).padStart(3, '0')}` }
function fmtTableId(n) { return n ? `T-${String(n).padStart(2, '0')}` : null }
function fmtMenuId(n)  { return `MI-${String(n).padStart(3, '0')}`  }

function fmtOrder(r) {
  return {
    id:            fmtOrderId(r.id),
    tableId:       fmtTableId(r.table_id),
    tableNumber:   r.table_number,
    waiter:        r.waiter,
    status:        r.status,
    notes:         r.notes || '',
    subtotal:      parseFloat(r.subtotal || 0),
    tax:           parseFloat(r.tax      || 0),
    total:         parseFloat(r.total    || 0),
    discount:      parseFloat(r.discount || 0),
    paymentMethod: r.payment_method || 'cash',
    currency:      r.currency       || 'LAK',
    voucherCode:   r.voucher_code   || '',
    cashTendered:  parseFloat(r.cash_tendered  || 0),
    changeAmount:  parseFloat(r.change_amount  || 0),
    customerId:    r.customer_id ? `CUS-${String(r.customer_id).padStart(3,'0')}` : null,
    items: (r.items || []).map(i => ({
      id:        fmtMenuId(i.menu_item_id),
      name:      i.name,
      quantity:  i.quantity,
      unitPrice: parseFloat(i.unit_price),
      lineTotal: parseFloat(i.line_total),
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
          'menu_item_id', oi.menu_item_id,
          'name',         oi.name,
          'quantity',     oi.quantity,
          'unit_price',   oi.unit_price,
          'line_total',   oi.quantity * oi.unit_price
        ) ORDER BY oi.id
      ) FILTER (WHERE oi.id IS NOT NULL),
    '[]'::json) AS items
  FROM orders o
  LEFT JOIN order_items oi ON oi.order_id = o.id
`

// ─── GET /api/orders ──────────────────────────────────────────────────────────
async function getAllOrders(req, res, next) {
  try {
    const { status, tableId, limit = 100, offset = 0 } = req.query
    const rid = req.restaurantId
    let where = 'WHERE 1=1'
    const params = []

    if (rid)     { params.push(rid);     where += ` AND o.restaurant_id = $${params.length}` }
    if (status)  { params.push(status);  where += ` AND o.status = $${params.length}` }
    if (tableId) { params.push(tableId); where += ` AND o.table_id = $${params.length}` }

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
    const { rows } = await query(
      `${ORDER_SELECT} WHERE o.id = $1 GROUP BY o.id`,
      [req.params.id]
    )
    if (!rows.length) return res.status(404).json({ error: 'Order not found' })
    res.json(fmtOrder(rows[0]))
  } catch (err) { next(err) }
}

// ─── POST /api/orders ─────────────────────────────────────────────────────────
async function createOrder(req, res, next) {
  if (!checkValidation(req, res)) return
  const { tableId, waiter, notes, items,
          customerId, paymentMethod, currency, discount, voucherCode, cashTendered, changeAmount } = req.body

  const client = await pool.connect()
  try {
    await client.query('BEGIN')

    // 1. Lock the table row
    const tRes = await client.query(
      'SELECT * FROM restaurant_tables WHERE id = $1 FOR UPDATE', [tableId]
    )
    if (!tRes.rows.length) throw Object.assign(new Error('Table not found'), { status: 404 })
    const table = tRes.rows[0]

    // 2. Fetch current menu prices
    const menuIds = items.map(i => i.menuItemId)
    const mRes = await client.query(
      'SELECT id, name, price FROM menu_items WHERE id = ANY($1)', [menuIds]
    )
    const menuMap = {}
    mRes.rows.forEach(m => { menuMap[m.id] = m })

    // 3. Calculate totals
    let subtotal = 0
    const enriched = items.map(i => {
      const m = menuMap[i.menuItemId]
      if (!m) throw Object.assign(new Error(`Menu item ${i.menuItemId} not found`), { status: 400 })
      const line = parseFloat(m.price) * i.quantity
      subtotal += line
      return { ...i, name: m.name, unitPrice: m.price, lineTotal: line }
    })
    const tax   = Math.round(subtotal * 0.08 * 100) / 100
    const total = Math.round((subtotal + tax) * 100) / 100

    // 4. Insert order (status defaults to 'Pending')
    const discountAmt = parseFloat(discount) || 0
    const finalTotal  = Math.max(0, Math.round((subtotal + tax - discountAmt) * 100) / 100)
    const rid = req.restaurantId || table.restaurant_id || null
    const oRes = await client.query(
      `INSERT INTO orders (table_id, table_number, waiter, notes, subtotal, tax, total,
         customer_id, payment_method, currency, discount, voucher_code, cash_tendered, change_amount,
         restaurant_id)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15) RETURNING *`,
      [table.id, table.number, waiter || 'Unassigned', notes || '', subtotal, tax, finalTotal,
       customerId || null, paymentMethod || 'cash', currency || 'LAK',
       discountAmt, voucherCode || '', parseFloat(cashTendered) || 0, parseFloat(changeAmount) || 0,
       rid]
    )
    const order = oRes.rows[0]

    // 5. Insert order_items
    for (const item of enriched) {
      await client.query(
        `INSERT INTO order_items (order_id, menu_item_id, name, quantity, unit_price)
         VALUES ($1,$2,$3,$4,$5)`,
        [order.id, item.menuItemId, item.name, item.quantity, item.unitPrice]
      )
    }

    // 6. Mark table as Occupied and link order
    await client.query(
      `UPDATE restaurant_tables
       SET status='Occupied', current_order_id=$1, waiter=$2
       WHERE id=$3`,
      [order.id, waiter || null, table.id]
    )

    await client.query('COMMIT')

    // 7. Fetch full order with items
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
  const { status } = req.body
  if (!VALID_STATUSES.includes(status)) {
    return res.status(400).json({ error: `status must be one of: ${VALID_STATUSES.join(', ')}` })
  }

  const client = await pool.connect()
  try {
    await client.query('BEGIN')

    const oRes = await client.query(
      'UPDATE orders SET status=$1, updated_at=NOW() WHERE id=$2 RETURNING *',
      [status, req.params.id]
    )
    if (!oRes.rows.length) {
      await client.query('ROLLBACK')
      return res.status(404).json({ error: 'Order not found' })
    }
    const order = oRes.rows[0]

    // Free the table when order is Closed
    if (status === 'Closed') {
      await client.query(
        `UPDATE restaurant_tables
         SET status='Available', current_order_id=NULL, waiter=NULL
         WHERE current_order_id=$1`,
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
      'SELECT id, name, price FROM menu_items WHERE id = ANY($1)', [menuIds]
    )
    const menuMap = {}
    mRes.rows.forEach(m => { menuMap[m.id] = m })

    let subtotal = 0
    const enriched = items.map(i => {
      const m = menuMap[i.menuItemId]
      if (!m) throw Object.assign(new Error(`Menu item ${i.menuItemId} not found`), { status: 400 })
      const line = parseFloat(m.price) * i.quantity
      subtotal += line
      return { ...i, name: m.name, unitPrice: m.price, lineTotal: line }
    })
    const tax   = Math.round(subtotal * 0.08 * 100) / 100
    const total = Math.round((subtotal + tax) * 100) / 100

    await client.query('DELETE FROM order_items WHERE order_id=$1', [req.params.id])
    for (const item of enriched) {
      await client.query(
        `INSERT INTO order_items (order_id, menu_item_id, name, quantity, unit_price)
         VALUES ($1,$2,$3,$4,$5)`,
        [req.params.id, item.menuItemId, item.name, item.quantity, item.unitPrice]
      )
    }

    const oRes = await client.query(
      `UPDATE orders SET notes=$1, subtotal=$2, tax=$3, total=$4, updated_at=NOW()
       WHERE id=$5 RETURNING *`,
      [notes || '', subtotal, tax, total, req.params.id]
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

module.exports = { getAllOrders, getOrder, createOrder, updateStatus, updateOrder, ORDER_SELECT, fmtOrder }
