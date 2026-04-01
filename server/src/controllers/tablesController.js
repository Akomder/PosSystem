const { query, pool }     = require('../config/db')
const { checkValidation } = require('../middleware/errorHandler')
const { emitTableUpdated } = require('../config/socket')

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
  try {
    let sql, params
    if (status === 'Available') {
      sql    = `UPDATE restaurant_tables SET status=$1, waiter=NULL, current_order_id=NULL WHERE id=$2 RETURNING *`
      params = [status, req.params.id]
    } else {
      sql    = `UPDATE restaurant_tables SET status=$1 WHERE id=$2 RETURNING *`
      params = [status, req.params.id]
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
  try {
    const { rows } = await query(
      `UPDATE restaurant_tables SET waiter=$1 WHERE id=$2 RETURNING *`,
      [waiter || null, req.params.id]
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
  params.push(req.params.id)
  try {
    const { rows } = await query(
      `UPDATE restaurant_tables SET ${sets.join(', ')} WHERE id=$${params.length} RETURNING *`,
      params
    )
    if (!rows.length) return res.status(404).json({ error: 'Table not found' })
    res.json(fmt(rows[0]))
  } catch (err) { next(err) }
}

module.exports = { getAllTables, getTable, updateStatus, assignWaiter, updateTable }
