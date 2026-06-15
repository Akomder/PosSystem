const { query, pool }     = require('../config/db')
const { checkValidation } = require('../middleware/errorHandler')
const { emitStockLow }    = require('../config/socket')
const { deductStock }     = require('../services/stock')

function fmt(r, items = []) {
  return {
    id:         r.id,
    staffId:    r.staff_id,
    staffName:  r.staff_name,
    shiftId:    r.shift_id,
    debtId:     r.debt_id,
    total:      parseFloat(r.total || 0),
    note:       r.note || '',
    createdAt:  r.created_at,
    items: items.map(i => ({
      id:         i.id,
      menuItemId: i.menu_item_id,
      name:       i.name,
      quantity:   parseFloat(i.quantity),
      unitCost:   parseFloat(i.unit_cost),
      lineTotal:  parseFloat(i.quantity) * parseFloat(i.unit_cost),
    })),
  }
}

// ─── GET /api/consumptions ────────────────────────────────────────────────────
async function getAll(req, res, next) {
  try {
    const { rows } = await query(
      `SELECT * FROM staff_consumptions WHERE restaurant_id = $1 ORDER BY created_at DESC LIMIT 100`,
      [req.restaurantId]
    )
    res.json(rows.map(r => fmt(r)))
  } catch (err) { next(err) }
}

// ─── POST /api/consumptions ───────────────────────────────────────────────────
// Records an employee withdrawal: deducts inventory AND charges the employee
// via a linked debt record. items: [{ menuItemId, quantity }]
async function create(req, res, next) {
  if (!checkValidation(req, res)) return
  const { staffId, items, note } = req.body
  if (!staffId)        return res.status(400).json({ error: 'staffId is required' })
  if (!items?.length)  return res.status(400).json({ error: 'items must not be empty' })

  const rid = req.restaurantId
  const client = await pool.connect()
  try {
    await client.query('BEGIN')

    // Resolve staff name
    const staffRes = await client.query(
      `SELECT name FROM staff WHERE id = $1 AND restaurant_id = $2`, [staffId, rid]
    )
    if (!staffRes.rows.length) throw Object.assign(new Error('Staff not found'), { status: 404 })
    const staffName = staffRes.rows[0].name

    // Price the withdrawal at cost
    const menuIds = items.map(i => i.menuItemId)
    const mRes = await client.query(
      `SELECT id, name, cost_price FROM menu_items WHERE id = ANY($1) AND restaurant_id = $2`,
      [menuIds, rid]
    )
    const menuMap = {}
    mRes.rows.forEach(m => { menuMap[m.id] = m })

    let total = 0
    const enriched = items.map(i => {
      const m = menuMap[i.menuItemId]
      if (!m) throw Object.assign(new Error(`Menu item ${i.menuItemId} not found`), { status: 400 })
      const unitCost = parseFloat(m.cost_price || 0)
      total += unitCost * i.quantity
      return { menuItemId: i.menuItemId, name: m.name, quantity: i.quantity, unitCost }
    })

    // Current open shift = business day
    const sRes = await client.query(
      `SELECT id FROM shifts WHERE restaurant_id = $1 AND status = 'open' ORDER BY opened_at DESC LIMIT 1`,
      [rid]
    )
    const shiftId = sRes.rows[0]?.id || null

    // Charge to the employee as a debt
    const debtRes = await client.query(
      `INSERT INTO debts (restaurant_id, debtor_name, amount, description, status)
       VALUES ($1, $2, $3, $4, 'unpaid') RETURNING id`,
      [rid, staffName, total, `Staff consumption — ${staffName}`]
    )
    const debtId = debtRes.rows[0].id

    // Header + line items
    const cRes = await client.query(
      `INSERT INTO staff_consumptions (restaurant_id, staff_id, shift_id, debt_id, staff_name, total, note)
       VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
      [rid, staffId, shiftId, debtId, staffName, total, note || '']
    )
    const consumption = cRes.rows[0]
    for (const it of enriched) {
      await client.query(
        `INSERT INTO staff_consumption_items (consumption_id, menu_item_id, name, quantity, unit_cost)
         VALUES ($1,$2,$3,$4,$5)`,
        [consumption.id, it.menuItemId, it.name, it.quantity, it.unitCost]
      )
    }

    // Deduct inventory (keeps stock + stock_quantity in sync)
    const lowStockItems = await deductStock(client, rid, enriched)

    await client.query('COMMIT')
    if (lowStockItems.length) emitStockLow(lowStockItems)

    const { rows: itemRows } = await query(
      `SELECT * FROM staff_consumption_items WHERE consumption_id = $1 ORDER BY id`, [consumption.id]
    )
    res.status(201).json(fmt(consumption, itemRows))
  } catch (err) {
    await client.query('ROLLBACK')
    if (err.status) return res.status(err.status).json({ error: err.message })
    next(err)
  } finally { client.release() }
}

module.exports = { getAll, create }
