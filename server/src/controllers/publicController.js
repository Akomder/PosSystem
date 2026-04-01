const { query, pool }      = require('../config/db')
const { checkValidation }  = require('../middleware/errorHandler')
const { emitOrderCreated } = require('../config/socket')
const { ORDER_SELECT, fmtOrder } = require('./ordersController')

// ─── Helper: parse "T-01" or "1" or 1 → raw integer ─────────────────────────
function parseRawTableId(v) {
  const m = String(v).trim().match(/^(?:T-)?0*(\d+)$/i)
  return m ? parseInt(m[1], 10) : null
}

// ─── GET /api/public/tables/:id ───────────────────────────────────────────────
async function getPublicTable(req, res, next) {
  try {
    const rawId = parseRawTableId(req.params.id)
    if (!rawId) return res.status(400).json({ error: 'Invalid table id' })
    const { rows } = await query(
      'SELECT id, number, capacity, status, section FROM restaurant_tables WHERE id = $1',
      [rawId]
    )
    if (!rows.length) return res.status(404).json({ error: 'Table not found' })
    const r = rows[0]
    res.json({
      id:       `T-${String(r.id).padStart(2, '0')}`,
      number:   r.number,
      capacity: r.capacity,
      status:   r.status,
      section:  r.section,
    })
  } catch (err) { next(err) }
}

// ─── GET /api/public/menu ─────────────────────────────────────────────────────
async function getPublicMenu(req, res, next) {
  try {
    const { rows } = await query(
      `SELECT id, name, category, price, description, prep_time
       FROM menu_items WHERE available = true ORDER BY category, name`
    )
    res.json(rows.map(r => ({
      id:          r.id,
      name:        r.name,
      category:    r.category,
      price:       parseFloat(r.price),
      description: r.description,
      prepTime:    r.prep_time,
    })))
  } catch (err) { next(err) }
}

// ─── POST /api/public/orders ──────────────────────────────────────────────────
async function createPublicOrder(req, res, next) {
  if (!checkValidation(req, res)) return
  const { tableId, notes, items } = req.body

  const rawId = parseRawTableId(tableId)
  if (!rawId) return res.status(400).json({ error: 'Invalid tableId format' })

  const client = await pool.connect()
  try {
    await client.query('BEGIN')

    // Lock table row
    const tRes = await client.query(
      'SELECT * FROM restaurant_tables WHERE id = $1 FOR UPDATE', [rawId]
    )
    if (!tRes.rows.length) throw Object.assign(new Error('Table not found'), { status: 404 })
    const table = tRes.rows[0]

    // Fetch menu prices (available items only)
    const menuIds = items.map(i => i.menuItemId)
    const mRes = await client.query(
      'SELECT id, name, price FROM menu_items WHERE id = ANY($1) AND available = true',
      [menuIds]
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
      return { ...i, name: m.name, unitPrice: m.price, lineTotal: line }
    })
    const tax   = Math.round(subtotal * 0.08 * 100) / 100
    const total = Math.round((subtotal + tax) * 100) / 100

    // Insert order — waiter = 'Guest' for customer self-orders
    const oRes = await client.query(
      `INSERT INTO orders (table_id, table_number, waiter, notes, subtotal, tax, total)
       VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
      [table.id, table.number, 'Guest', notes || '', subtotal, tax, total]
    )
    const order = oRes.rows[0]

    // Insert order items
    for (const item of enriched) {
      await client.query(
        `INSERT INTO order_items (order_id, menu_item_id, name, quantity, unit_price)
         VALUES ($1,$2,$3,$4,$5)`,
        [order.id, item.menuItemId, item.name, item.quantity, item.unitPrice]
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
    res.status(201).json(fullOrder)
  } catch (err) {
    await client.query('ROLLBACK')
    if (err.status) return res.status(err.status).json({ error: err.message })
    next(err)
  } finally {
    client.release()
  }
}

module.exports = { getPublicTable, getPublicMenu, createPublicOrder }
