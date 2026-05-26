const { query, pool }     = require('../config/db')
const { checkValidation } = require('../middleware/errorHandler')
const { emitTableUpdated } = require('../config/socket')
const PLAN_LIMITS          = require('../config/planLimits')

// ─── format helpers ───────────────────────────────────────────────────────────
function fmtTableId(n)  { return `T-${String(n).padStart(2, '0')}` }
function fmtOrderId(n)  { return n ? `ORD-${String(n).padStart(3, '0')}` : null }

function fmt(r) {
  return {
    id:             fmtTableId(r.id),
    tableNumber:    r.number,
    capacity:       r.capacity,
    status:         r.status,
    currentOrderId: fmtOrderId(r.current_order_id),
    waiter:         r.waiter || null,
    section:        r.section,
    updatedAt:      r.updated_at,
  }
}

// ─── GET /api/tables ──────────────────────────────────────────────────────────
async function getAllTables(req, res, next) {
  try {
    const { status, section } = req.query
    const rid = req.restaurantId
    let sql = 'SELECT * FROM restaurant_tables WHERE 1=1'
    const params = []
    if (rid)     { params.push(rid);     sql += ` AND restaurant_id = $${params.length}` }
    if (status)  { params.push(status);  sql += ` AND status = $${params.length}` }
    if (section) { params.push(section); sql += ` AND section = $${params.length}` }
    sql += ' ORDER BY number'
    const { rows } = await query(sql, params)
    res.json(rows.map(fmt))
  } catch (err) { next(err) }
}

// ─── GET /api/tables/:id ──────────────────────────────────────────────────────
async function getTable(req, res, next) {
  try {
    const rid = req.restaurantId
    let sql = 'SELECT * FROM restaurant_tables WHERE id = $1'
    const params = [req.params.id]
    if (rid) { params.push(rid); sql += ` AND restaurant_id = $${params.length}` }
    const { rows } = await query(sql, params)
    if (!rows.length) return res.status(404).json({ error: 'Table not found' })
    res.json(fmt(rows[0]))
  } catch (err) { next(err) }
}

// ─── PATCH /api/tables/:id/status ────────────────────────────────────────────
async function updateStatus(req, res, next) {
  if (!checkValidation(req, res)) return
  const { status } = req.body
  const VALID = ['Available', 'Occupied', 'Reserved']
  if (!VALID.includes(status)) {
    return res.status(400).json({ error: `status must be one of: ${VALID.join(', ')}` })
  }
  const rid = req.restaurantId
  try {
    let sql, params
    if (status === 'Available') {
      sql    = `UPDATE restaurant_tables SET status=$1, waiter=NULL, current_order_id=NULL WHERE id=$2 AND restaurant_id=$3 RETURNING *`
      params = [status, req.params.id, rid]
    } else {
      sql    = `UPDATE restaurant_tables SET status=$1 WHERE id=$2 AND restaurant_id=$3 RETURNING *`
      params = [status, req.params.id, rid]
    }
    const { rows } = await query(sql, params)
    if (!rows.length) return res.status(404).json({ error: 'Table not found' })
    const table = fmt(rows[0])
    emitTableUpdated(table.id, status, table)
    res.json(table)
  } catch (err) { next(err) }
}

// ─── PATCH /api/tables/:id/assign ────────────────────────────────────────────
async function assignWaiter(req, res, next) {
  if (!checkValidation(req, res)) return
  const { waiter } = req.body
  const rid = req.restaurantId
  try {
    const { rows } = await query(
      `UPDATE restaurant_tables SET waiter=$1 WHERE id=$2 AND restaurant_id=$3 RETURNING *`,
      [waiter || null, req.params.id, rid]
    )
    if (!rows.length) return res.status(404).json({ error: 'Table not found' })
    const table = fmt(rows[0])
    emitTableUpdated(table.id, table.status, table)
    res.json(table)
  } catch (err) { next(err) }
}

// ─── PUT /api/tables/:id ──────────────────────────────────────────────────────
async function updateTable(req, res, next) {
  if (!checkValidation(req, res)) return
  const { capacity, section } = req.body
  const sets = [], params = []
  if (capacity !== undefined) { params.push(capacity); sets.push(`capacity = $${params.length}`) }
  if (section  !== undefined) { params.push(section);  sets.push(`section  = $${params.length}`) }
  if (!sets.length) return res.status(400).json({ error: 'Nothing to update' })
  const rid = req.restaurantId
  params.push(req.params.id, rid)
  try {
    const { rows } = await query(
      `UPDATE restaurant_tables SET ${sets.join(', ')} WHERE id=$${params.length - 1} AND restaurant_id=$${params.length} RETURNING *`,
      params
    )
    if (!rows.length) return res.status(404).json({ error: 'Table not found' })
    res.json(fmt(rows[0]))
  } catch (err) { next(err) }
}

// ─── POST /api/tables ─────────────────────────────────────────────────────────
async function createTable(req, res, next) {
  const { number, capacity, section } = req.body
  const rid = req.restaurantId
  try {
    // ── Plan limit check ────────────────────────────────────────────────────
    if (rid) {
      const restRes = await query(`SELECT plan FROM restaurants WHERE id=$1`, [rid])
      const plan = restRes.rows[0]?.plan || 'basic'
      const limit = PLAN_LIMITS[plan]?.maxTables ?? 10
      const countRes = await query(`SELECT COUNT(*) FROM restaurant_tables WHERE restaurant_id=$1`, [rid])
      const current = parseInt(countRes.rows[0].count)
      if (current >= limit) {
        return res.status(403).json({
          error: `Plan limit reached. Your ${plan} plan allows up to ${limit} tables. Upgrade to add more.`,
          limitType: 'tables', current, limit, plan,
        })
      }
    }

    const { rows } = await query(
      `INSERT INTO restaurant_tables (restaurant_id, number, capacity, section, status)
       VALUES ($1, $2, $3, $4, 'Available') RETURNING *`,
      [rid, number, capacity || 2, section || 'Main Hall']
    )
    res.status(201).json(fmt(rows[0]))
  } catch (err) { next(err) }
}

// ─── DELETE /api/tables/:id ───────────────────────────────────────────────────
async function deleteTable(req, res, next) {
  const rid = req.restaurantId
  try {
    const { rows } = await query(
      `DELETE FROM restaurant_tables WHERE id=$1 AND restaurant_id=$2 RETURNING id`,
      [req.params.id, rid]
    )
    if (!rows.length) return res.status(404).json({ error: 'Table not found' })
    res.status(204).end()
  } catch (err) { next(err) }
}

module.exports = { getAllTables, getTable, updateStatus, assignWaiter, updateTable, createTable, deleteTable }
