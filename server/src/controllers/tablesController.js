const { query, pool }     = require('../config/db')
const { checkValidation } = require('../middleware/errorHandler')
const { emitTableUpdated, emitOrderUpdated } = require('../config/socket')
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
    zoneId:         r.zone_id   || null,
    updatedAt:      r.updated_at,
    // Floor-plan layout
    mapX:           r.map_x     ?? 0,
    mapY:           r.map_y     ?? 0,
    mapW:           r.map_w     ?? 2,
    mapH:           r.map_h     ?? 2,
    mapShape:       r.map_shape || 'rect',
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
  const { capacity, section, mapX, mapY, mapW, mapH, mapShape } = req.body
  const sets = [], params = []
  if (capacity !== undefined) { params.push(capacity); sets.push(`capacity  = $${params.length}`) }
  if (section  !== undefined) { params.push(section);  sets.push(`section   = $${params.length}`) }
  if (mapX     !== undefined) { params.push(mapX);     sets.push(`map_x     = $${params.length}`) }
  if (mapY     !== undefined) { params.push(mapY);     sets.push(`map_y     = $${params.length}`) }
  if (mapW     !== undefined) { params.push(mapW);     sets.push(`map_w     = $${params.length}`) }
  if (mapH     !== undefined) { params.push(mapH);     sets.push(`map_h     = $${params.length}`) }
  if (mapShape !== undefined) { params.push(mapShape); sets.push(`map_shape = $${params.length}`) }
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

// ─── PATCH /api/tables/:id/move ───────────────────────────────────────────────
// Move an occupied table's active order to an Available target table.
async function moveTable(req, res, next) {
  const { targetTableId } = req.body
  const rid = req.restaurantId
  if (!targetTableId) return res.status(400).json({ error: 'targetTableId is required' })

  const client = await pool.connect()
  try {
    await client.query('BEGIN')

    const srcRes = await client.query(
      `SELECT * FROM restaurant_tables WHERE id=$1 AND restaurant_id=$2 FOR UPDATE`,
      [req.params.id, rid]
    )
    const tgtRes = await client.query(
      `SELECT * FROM restaurant_tables WHERE id=$1 AND restaurant_id=$2 FOR UPDATE`,
      [targetTableId, rid]
    )
    if (!srcRes.rows.length || !tgtRes.rows.length) {
      await client.query('ROLLBACK')
      return res.status(404).json({ error: 'Table not found' })
    }
    const src = srcRes.rows[0], tgt = tgtRes.rows[0]
    if (!src.current_order_id) {
      await client.query('ROLLBACK')
      return res.status(400).json({ error: 'Source table has no active order' })
    }
    if (tgt.status !== 'Available') {
      await client.query('ROLLBACK')
      return res.status(400).json({ error: 'Target table is not available' })
    }

    // Re-point the order to the target table
    await client.query(
      `UPDATE orders SET table_id=$1, table_number=$2, updated_at=NOW() WHERE id=$3`,
      [tgt.id, tgt.number, src.current_order_id]
    )
    // Occupy target, free source
    await client.query(
      `UPDATE restaurant_tables SET status='Occupied', current_order_id=$1, waiter=$2 WHERE id=$3`,
      [src.current_order_id, src.waiter, tgt.id]
    )
    await client.query(
      `UPDATE restaurant_tables SET status='Available', current_order_id=NULL, waiter=NULL WHERE id=$1`,
      [src.id]
    )

    await client.query('COMMIT')

    const updated = await query(
      `SELECT * FROM restaurant_tables WHERE id = ANY($1)`, [[src.id, tgt.id]]
    )
    updated.rows.forEach(r => { const ft = fmt(r); emitTableUpdated(ft.id, ft.status, ft) })
    emitOrderUpdated(fmtOrderId(src.current_order_id), 'moved')
    res.json(updated.rows.map(fmt))
  } catch (err) {
    await client.query('ROLLBACK')
    next(err)
  } finally { client.release() }
}

// ─── POST /api/tables/merge ───────────────────────────────────────────────────
// Merge several tables' open orders into the target table's order (one bill).
async function mergeTables(req, res, next) {
  const { targetTableId, sourceTableIds } = req.body
  const rid = req.restaurantId
  if (!targetTableId || !Array.isArray(sourceTableIds) || !sourceTableIds.length) {
    return res.status(400).json({ error: 'targetTableId and sourceTableIds[] are required' })
  }

  const client = await pool.connect()
  try {
    await client.query('BEGIN')

    const allIds = [targetTableId, ...sourceTableIds]
    const tRes = await client.query(
      `SELECT * FROM restaurant_tables WHERE id = ANY($1) AND restaurant_id=$2 FOR UPDATE`,
      [allIds, rid]
    )
    const byId = {}
    tRes.rows.forEach(r => { byId[r.id] = r })
    const target = byId[targetTableId]
    if (!target || !target.current_order_id) {
      await client.query('ROLLBACK')
      return res.status(400).json({ error: 'Target table must have an active order' })
    }
    const targetOrderId = target.current_order_id

    for (const sid of sourceTableIds) {
      const src = byId[sid]
      if (!src || !src.current_order_id) continue
      const srcOrderId = src.current_order_id

      // Guard: refuse merging paid/closed orders
      const oRes = await client.query(
        `SELECT status, payment_status FROM orders WHERE id=$1`, [srcOrderId]
      )
      const o = oRes.rows[0]
      if (!o || o.status === 'Closed' || o.status === 'Cancelled' || o.payment_status !== 'unpaid') {
        await client.query('ROLLBACK')
        return res.status(400).json({ error: `Table cannot be merged — its order is paid or closed` })
      }

      // Move all line items (and their modifiers via order_item_id) to target order
      await client.query(
        `UPDATE order_items SET order_id=$1 WHERE order_id=$2`, [targetOrderId, srcOrderId]
      )
      // Cancel the now-empty source order and free its table
      await client.query(
        `UPDATE orders SET status='Cancelled', cancel_reason='Merged into order', updated_at=NOW() WHERE id=$1`,
        [srcOrderId]
      )
      await client.query(
        `UPDATE restaurant_tables SET status='Available', current_order_id=NULL, waiter=NULL WHERE id=$1`,
        [sid]
      )
    }

    // Recompute target totals from its (now combined) items
    await client.query(
      `UPDATE orders o SET
         subtotal = COALESCE((SELECT SUM(quantity*unit_price) FROM order_items WHERE order_id=o.id), 0),
         total    = GREATEST(0, COALESCE((SELECT SUM(quantity*unit_price) FROM order_items WHERE order_id=o.id), 0) - o.discount),
         updated_at = NOW()
       WHERE o.id=$1`,
      [targetOrderId]
    )

    await client.query('COMMIT')

    const updated = await query(
      `SELECT * FROM restaurant_tables WHERE id = ANY($1)`, [allIds]
    )
    updated.rows.forEach(r => { const ft = fmt(r); emitTableUpdated(ft.id, ft.status, ft) })
    emitOrderUpdated(fmtOrderId(targetOrderId), 'merged')
    res.json(updated.rows.map(fmt))
  } catch (err) {
    await client.query('ROLLBACK')
    next(err)
  } finally { client.release() }
}

module.exports = { getAllTables, getTable, updateStatus, assignWaiter, updateTable, createTable, deleteTable, moveTable, mergeTables }
