const { query, pool }      = require('../config/db')
const { checkValidation }  = require('../middleware/errorHandler')
const { emitOrderCreated, emitOrderUpdated, emitTableUpdated, emitQrPaymentAlert, emitOrderItemsAdded, emitOrderReturnRequested } = require('../config/socket')
const { ORDER_SELECT, fmtOrder } = require('./ordersController')

// ─── Helpers: parse formatted IDs → raw integers ─────────────────────────────
function parseRawTableId(v) {
  const m = String(v).trim().match(/^(?:T-)?0*(\d+)$/i)
  return m ? parseInt(m[1], 10) : null
}

function parseOrderId(v) {
  const m = String(v).trim().match(/^(?:ORD-)?0*(\d+)$/i)
  return m ? parseInt(m[1], 10) : null
}

// ─── GET /api/public/restaurant/:slug ────────────────────────────────────────
// Lets the tenant login page verify the slug and get the restaurant name/branding.
async function getPublicRestaurant(req, res, next) {
  try {
    const slug = req.params.slug.toLowerCase().trim()
    const { rows } = await query(
      `SELECT id, name, slug, currency, settings FROM restaurants WHERE slug = $1`,
      [slug]
    )
    if (!rows.length) return res.status(404).json({ error: 'Restaurant not found' })
    const r = rows[0]
    const logo = r.settings?.receipt?.logoBase64 || null
    res.json({ id: r.id, name: r.name, slug: r.slug, currency: r.currency, logo })
  } catch (err) { next(err) }
}

// ─── GET /api/public/tables/:id ───────────────────────────────────────────────
async function getPublicTable(req, res, next) {
  try {
    const rawId = parseRawTableId(req.params.id)
    if (!rawId) return res.status(400).json({ error: 'Invalid table id' })
    const { rows } = await query(
      `SELECT t.id, t.number, t.capacity, t.status, t.section, t.restaurant_id,
              t.current_order_id,
              r.name AS restaurant_name, r.currency, r.settings
       FROM restaurant_tables t
       LEFT JOIN restaurants r ON r.id = t.restaurant_id
       WHERE t.id = $1`,
      [rawId]
    )
    if (!rows.length) return res.status(404).json({ error: 'Table not found' })
    const r = rows[0]
    const rSettings = r.settings || {}
    res.json({
      id:               `T-${String(r.id).padStart(2, '0')}`,
      number:           r.number,
      capacity:         r.capacity,
      status:           r.status,
      section:          r.section,
      restaurantId:     r.restaurant_id,
      restaurantName:   r.restaurant_name || 'Restaurant',
      currency:         r.currency || 'LAK',
      currentOrderId:   r.current_order_id || null,
      qrImageBase64:    rSettings?.payment?.qrImageBase64 || null,
    })
  } catch (err) { next(err) }
}

// ─── GET /api/public/menu?tableId=T-01 ───────────────────────────────────────
// Scopes the menu to the restaurant that owns the given table.
async function getPublicMenu(req, res, next) {
  try {
    const { tableId } = req.query

    let sql, params
    if (tableId) {
      const rawId = parseRawTableId(tableId)
      if (!rawId) return res.status(400).json({ error: 'Invalid tableId format' })
      // Join through restaurant_tables to scope to the correct restaurant
      sql = `
        SELECT m.id, m.name, m.category, m.price, m.description, m.prep_time, m.image_url
        FROM menu_items m
        JOIN restaurant_tables t ON t.restaurant_id = m.restaurant_id
        WHERE t.id = $1 AND m.available = true
        ORDER BY m.category, m.name
      `
      params = [rawId]
    } else {
      // Fallback (single-restaurant or test environments)
      sql = `SELECT id, name, category, price, description, prep_time, image_url
             FROM menu_items WHERE available = true ORDER BY category, name`
      params = []
    }

    const { rows } = await query(sql, params)
    res.json(rows.map(r => ({
      id:          r.id,
      name:        r.name,
      category:    r.category,
      price:       parseFloat(r.price),
      description: r.description,
      prepTime:    r.prep_time,
      imageUrl:    r.image_url || '',
    })))
  } catch (err) { next(err) }
}

// ─── POST /api/public/orders ──────────────────────────────────────────────────
async function createPublicOrder(req, res, next) {
  if (!checkValidation(req, res)) return
  const { tableId, notes, items, paymentMethod = 'cash' } = req.body
  const pmMethod = ['cash', 'qr'].includes(paymentMethod) ? paymentMethod : 'cash'

  const rawId = parseRawTableId(tableId)
  if (!rawId) return res.status(400).json({ error: 'Invalid tableId format' })

  const client = await pool.connect()
  try {
    await client.query('BEGIN')

    // Lock table row — also fetches restaurant_id for proper scoping
    const tRes = await client.query(
      'SELECT * FROM restaurant_tables WHERE id = $1 FOR UPDATE', [rawId]
    )
    if (!tRes.rows.length) throw Object.assign(new Error('Table not found'), { status: 404 })
    const table = tRes.rows[0]
    const restaurantId = table.restaurant_id

    // Fetch menu prices — scope to the same restaurant to prevent cross-tenant injection
    const menuIds = items.map(i => i.menuItemId)
    const mRes = await client.query(
      `SELECT id, name, price FROM menu_items
       WHERE id = ANY($1) AND available = true AND restaurant_id = $2`,
      [menuIds, restaurantId]
    )
    const menuMap = {}
    mRes.rows.forEach(m => { menuMap[m.id] = m })

    // Calculate totals
    let subtotal = 0
    const enriched = items.map(i => {
      const m = menuMap[i.menuItemId]
      if (!m) throw Object.assign(
        new Error(`Menu item ${i.menuItemId} not found or unavailable`), { status: 400 }
      )
      const line = parseFloat(m.price) * i.quantity
      subtotal += line
      return { ...i, name: m.name, unitPrice: m.price, lineTotal: line, notes: i.notes || '' }
    })
    // Tax removed from customer QR ordering — price displayed is the final price
    const tax   = 0
    const total = Math.round(subtotal * 100) / 100

    // Insert order — waiter = 'Guest' for customer self-orders
    // IMPORTANT: include restaurant_id so the order appears in the admin's Orders view
    const oRes = await client.query(
      `INSERT INTO orders
         (restaurant_id, table_id, table_number, waiter, notes, subtotal, tax, total, payment_method, payment_status)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,'unpaid') RETURNING *`,
      [restaurantId, table.id, table.number, 'Guest', notes || '', subtotal, tax, total, pmMethod]
    )
    const order = oRes.rows[0]

    // Insert order items — also scoped to the restaurant
    for (const item of enriched) {
      await client.query(
        `INSERT INTO order_items (restaurant_id, order_id, menu_item_id, name, quantity, unit_price, notes)
         VALUES ($1,$2,$3,$4,$5,$6,$7)`,
        [restaurantId, order.id, item.menuItemId, item.name, item.quantity, item.unitPrice, item.notes || '']
      )
    }

    // Mark table Occupied, link order
    await client.query(
      `UPDATE restaurant_tables SET status='Occupied', current_order_id=$1, waiter='Guest' WHERE id=$2`,
      [order.id, table.id]
    )

    await client.query('COMMIT')

    const fullRes = await query(
      `${ORDER_SELECT} WHERE o.id = $1 GROUP BY o.id`, [order.id]
    )
    const fullOrder = fmtOrder(fullRes.rows[0])
    emitOrderCreated(fullOrder)
    // If customer chose QR payment, fire an immediate alert to cashier/waiter
    if (pmMethod === 'qr') emitQrPaymentAlert(fullOrder)
    res.status(201).json(fullOrder)
  } catch (err) {
    await client.query('ROLLBACK')
    if (err.status) return res.status(err.status).json({ error: err.message })
    next(err)
  } finally {
    client.release()
  }
}

// ─── PATCH /api/public/orders/:id/cancel ─────────────────────────────────────
// Lets a customer cancel their own order — only while it is still "Pending".
// Security: orderId + tableId together prove ownership (no auth token needed).
async function cancelPublicOrder(req, res, next) {
  try {
    const { tableId } = req.body
    if (!tableId) return res.status(400).json({ error: 'tableId is required' })

    const rawOrderId = parseOrderId(req.params.id)
    if (!rawOrderId) return res.status(400).json({ error: 'Invalid order id' })

    const rawTableId = parseRawTableId(tableId)
    if (!rawTableId) return res.status(400).json({ error: 'Invalid tableId format' })

    const client = await pool.connect()
    try {
      await client.query('BEGIN')

      // Verify ownership and lock the row
      const chk = await client.query(
        `SELECT id, status FROM orders WHERE id=$1 AND table_id=$2 FOR UPDATE`,
        [rawOrderId, rawTableId]
      )
      if (!chk.rows.length) {
        await client.query('ROLLBACK')
        return res.status(404).json({ error: 'Order not found for this table' })
      }

      const { status } = chk.rows[0]
      if (status === 'Cancelled') {
        await client.query('ROLLBACK')
        return res.status(400).json({ error: 'Order is already cancelled' })
      }
      if (status !== 'Pending') {
        await client.query('ROLLBACK')
        return res.status(400).json({
          error: 'Order cannot be cancelled — the kitchen has already started preparing it',
        })
      }

      // Mark cancelled
      await client.query(
        `UPDATE orders
            SET status='Cancelled', cancel_reason='Cancelled by customer', updated_at=NOW()
          WHERE id=$1`,
        [rawOrderId]
      )

      // Free the table
      await client.query(
        `UPDATE restaurant_tables
            SET status='Available', current_order_id=NULL, waiter=NULL
          WHERE current_order_id=$1`,
        [rawOrderId]
      )

      await client.query('COMMIT')

      // Emit real-time events so kitchen + admin see the update instantly
      const fullRes = await query(`${ORDER_SELECT} WHERE o.id=$1 GROUP BY o.id`, [rawOrderId])
      if (fullRes.rows.length) {
        const fullOrder = fmtOrder(fullRes.rows[0])
        emitOrderUpdated(fullOrder.id, 'Cancelled', fullOrder)
      }
      emitTableUpdated(`T-${String(rawTableId).padStart(2, '0')}`, 'Available', {
        id:             `T-${String(rawTableId).padStart(2, '0')}`,
        status:         'Available',
        currentOrderId: null,
        waiter:         null,
      })

      res.json({ message: 'Order cancelled successfully' })
    } catch (err) {
      await client.query('ROLLBACK')
      next(err)
    } finally {
      client.release()
    }
  } catch (err) { next(err) }
}

// ─── PATCH /api/public/orders/:id/add-items ──────────────────────────────────
// Customer adds more items to their existing open order (running tab).
async function addItemsToPublicOrder(req, res, next) {
  try {
    const rawOrderId = parseOrderId(req.params.id)
    if (!rawOrderId) return res.status(400).json({ error: 'Invalid order ID' })

    const { tableId, items } = req.body
    if (!tableId) return res.status(400).json({ error: 'tableId required' })
    if (!Array.isArray(items) || !items.length) return res.status(400).json({ error: 'items required' })

    const rawTableId = parseRawTableId(tableId)
    if (!rawTableId) return res.status(400).json({ error: 'Invalid tableId' })

    const client = await pool.connect()
    try {
      await client.query('BEGIN')

      const chk = await client.query(
        `SELECT o.id, o.status, o.restaurant_id FROM orders o
         WHERE o.id = $1 AND o.table_id = $2 FOR UPDATE`,
        [rawOrderId, rawTableId]
      )
      if (!chk.rows.length) { await client.query('ROLLBACK'); return res.status(404).json({ error: 'Order not found' }) }
      const { status, restaurant_id: rid } = chk.rows[0]
      if (['Closed', 'Cancelled'].includes(status)) {
        await client.query('ROLLBACK')
        return res.status(400).json({ error: 'Cannot add items to a closed or cancelled order' })
      }

      // Fetch current menu prices
      const menuIds = items.map(i => i.menuItemId)
      const mRes = await client.query(
        'SELECT id, name, price, station FROM menu_items WHERE id = ANY($1) AND restaurant_id = $2',
        [menuIds, rid]
      )
      const menuMap = {}
      mRes.rows.forEach(m => { menuMap[m.id] = m })

      // Insert new order items
      for (const item of items) {
        const m = menuMap[item.menuItemId]
        if (!m) { await client.query('ROLLBACK'); return res.status(400).json({ error: `Menu item ${item.menuItemId} not found` }) }
        const unitPrice = parseFloat(m.price)
        await client.query(
          `INSERT INTO order_items (order_id, menu_item_id, name, quantity, unit_price, notes, station, restaurant_id)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
          [rawOrderId, item.menuItemId, m.name, item.quantity, unitPrice, item.notes || '', m.station || 'Kitchen', rid]
        )
      }

      // Recalculate totals from all items
      const totals = await client.query(
        `SELECT COALESCE(SUM(quantity * unit_price), 0) AS subtotal FROM order_items WHERE order_id = $1`,
        [rawOrderId]
      )
      const subtotal = parseFloat(totals.rows[0].subtotal)
      const tax      = 0
      const total    = Math.round(subtotal * 100) / 100
      await client.query(
        `UPDATE orders SET subtotal=$1, tax=$2, total=$3, updated_at=NOW() WHERE id=$4`,
        [subtotal, tax, total, rawOrderId]
      )

      await client.query('COMMIT')

      // Return full updated order + notify kitchen/admin
      const fullRes = await query(`${ORDER_SELECT} WHERE o.id=$1 GROUP BY o.id`, [rawOrderId])
      const fullOrder = fmtOrder(fullRes.rows[0])
      emitOrderUpdated(fullOrder.id, fullOrder.status, fullOrder)
      emitOrderItemsAdded(fullOrder)
      res.json(fullOrder)
    } catch (err) {
      await client.query('ROLLBACK')
      next(err)
    } finally { client.release() }
  } catch (err) { next(err) }
}

// ─── POST /api/public/orders/:id/request-checkout ────────────────────────────
// Customer signals they are ready to pay — alerts cashier/waiter immediately.
async function requestCheckout(req, res, next) {
  try {
    const rawOrderId = parseOrderId(req.params.id)
    if (!rawOrderId) return res.status(400).json({ error: 'Invalid order ID' })

    const { tableId } = req.body
    if (!tableId) return res.status(400).json({ error: 'tableId required' })

    const rawTableId = parseRawTableId(tableId)
    if (!rawTableId) return res.status(400).json({ error: 'Invalid tableId' })

    const { rows } = await query(
      `${ORDER_SELECT} WHERE o.id=$1 AND o.table_id=$2 GROUP BY o.id`,
      [rawOrderId, rawTableId]
    )
    if (!rows.length) return res.status(404).json({ error: 'Order not found' })

    emitQrPaymentAlert(fmtOrder(rows[0]))
    res.json({ ok: true })
  } catch (err) { next(err) }
}

// ─── GET /api/public/orders/:id?tableId=T-01 ─────────────────────────────────
// Returns a customer's order. Security: orderId + tableId must match.
async function getPublicOrder(req, res, next) {
  try {
    const rawOrderId = parseOrderId(req.params.id)
    if (!rawOrderId) return res.status(400).json({ error: 'Invalid order ID' })

    const rawTableId = parseRawTableId(req.query.tableId || '')
    if (!rawTableId) return res.status(400).json({ error: 'tableId query param required' })

    const { rows } = await query(
      `${ORDER_SELECT} WHERE o.id = $1 AND o.table_id = $2 GROUP BY o.id`,
      [rawOrderId, rawTableId]
    )
    if (!rows.length) return res.status(404).json({ error: 'Order not found' })
    res.json(fmtOrder(rows[0]))
  } catch (err) { next(err) }
}

// ─── POST /api/public/orders/:id/return-request ───────────────────────────────
// Customer submits a return request for specific items (e.g. return 2 of 5 beers).
// Security: orderId + tableId proves ownership (no auth token required).
async function createReturnRequest(req, res, next) {
  try {
    const rawOrderId = parseOrderId(req.params.id)
    if (!rawOrderId) return res.status(400).json({ error: 'Invalid order ID' })

    const { tableId, reason, items } = req.body
    if (!tableId) return res.status(400).json({ error: 'tableId required' })
    if (!Array.isArray(items) || !items.length) return res.status(400).json({ error: 'items required' })
    // reason is optional

    const rawTableId = parseRawTableId(tableId)
    if (!rawTableId) return res.status(400).json({ error: 'Invalid tableId format' })

    // Verify ownership and that the order is still active
    const { rows: orderRows } = await query(
      `SELECT o.id, o.status, o.restaurant_id FROM orders o
       WHERE o.id = $1 AND o.table_id = $2`,
      [rawOrderId, rawTableId]
    )
    if (!orderRows.length) return res.status(404).json({ error: 'Order not found for this table' })
    const { status, restaurant_id: restaurantId } = orderRows[0]
    if (['Closed', 'Cancelled'].includes(status)) {
      return res.status(400).json({ error: 'Cannot request a return on a closed or cancelled order' })
    }

    // Validate each item's return quantity against current order quantity
    for (const item of items) {
      if (!item.orderItemId || item.quantity < 1) {
        return res.status(400).json({ error: 'Each item needs orderItemId and quantity >= 1' })
      }
      const { rows: oi } = await query(
        `SELECT quantity FROM order_items WHERE id = $1 AND order_id = $2`,
        [item.orderItemId, rawOrderId]
      )
      if (!oi.length) return res.status(400).json({ error: `Order item ${item.orderItemId} not found` })
      if (item.quantity > oi[0].quantity) {
        return res.status(400).json({ error: `Cannot return more than ordered for item ${item.orderItemId}` })
      }
    }

    // Create the return record (status = 'pending', linked to the order)
    const total = items.reduce((s, i) => s + parseFloat(i.unitPrice || 0) * parseInt(i.quantity), 0)
    const { rows: retRows } = await query(
      `INSERT INTO returns (restaurant_id, order_id, reason, total, status)
       VALUES ($1, $2, $3, $4, 'pending') RETURNING *`,
      [restaurantId, rawOrderId, reason.trim(), total]
    )
    const ret = retRows[0]

    // Insert return items (with order_item_id for precise approval)
    for (const item of items) {
      await query(
        `INSERT INTO return_items (return_id, order_item_id, menu_item_id, item_name, quantity, unit_price)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [ret.id, item.orderItemId, item.menuItemId || null, item.name, item.quantity, item.unitPrice || 0]
      )
    }

    // Fetch full order to include in socket event
    const fullRes = await query(`${ORDER_SELECT} WHERE o.id = $1 GROUP BY o.id`, [rawOrderId])
    const fullOrder = fmtOrder(fullRes.rows[0])
    emitOrderReturnRequested(fullOrder, { id: ret.id, orderId: rawOrderId, reason: ret.reason, total, items })

    res.status(201).json({ id: ret.id, orderId: rawOrderId, reason: ret.reason, total, status: 'pending' })
  } catch (err) { next(err) }
}

module.exports = { getPublicRestaurant, getPublicTable, getPublicMenu, createPublicOrder, cancelPublicOrder, getPublicOrder, addItemsToPublicOrder, requestCheckout, createReturnRequest }
