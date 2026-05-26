const { query, pool }     = require('../config/db')
const { checkValidation } = require('../middleware/errorHandler')

function fmtId(n) { return `DR-${String(n).padStart(4, '0')}` }

function fmt(r, items = []) {
  return {
    id:           fmtId(r.id),
    _id:          r.id,
    recordedBy:   r.recorded_by,
    reason:       r.reason,
    notes:        r.notes,
    totalValue:   parseFloat(r.total_value),
    restaurantId: r.restaurant_id,
    createdAt:    r.created_at,
    items:        items.map(i => ({
      id:        i.id,
      menuItemId:i.menu_item_id,
      itemName:  i.item_name,
      quantity:  i.quantity,
      unitCost:  parseFloat(i.unit_cost),
      lineTotal: parseFloat(i.line_total),
    })),
  }
}

async function getAll(req, res, next) {
  try {
    const { rows } = await query(
      'SELECT * FROM damage_records WHERE restaurant_id = $1 ORDER BY created_at DESC',
      [req.restaurantId]
    )
    res.json(rows.map(r => fmt(r)))
  } catch (err) { next(err) }
}

async function getOne(req, res, next) {
  try {
    const { rows } = await query(
      'SELECT * FROM damage_records WHERE id = $1 AND restaurant_id = $2',
      [req.params.id, req.restaurantId]
    )
    if (!rows.length) return res.status(404).json({ error: 'Damage record not found' })
    const { rows: items } = await query(
      'SELECT * FROM damage_record_items WHERE damage_record_id = $1 ORDER BY id',
      [req.params.id]
    )
    res.json(fmt(rows[0], items))
  } catch (err) { next(err) }
}

async function create(req, res, next) {
  if (!checkValidation(req, res)) return
  const { reason, notes, items = [] } = req.body
  const recordedBy = req.user.name || req.user.email
  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    const totalValue = items.reduce((s, i) => s + (i.quantity * i.unitCost), 0)
    const { rows } = await client.query(
      `INSERT INTO damage_records (restaurant_id, recorded_by, reason, notes, total_value)
       VALUES ($1,$2,$3,$4,$5) RETURNING *`,
      [req.restaurantId, recordedBy, reason || '', notes || '', totalValue]
    )
    for (const item of items) {
      await client.query(
        `INSERT INTO damage_record_items (damage_record_id, menu_item_id, item_name, quantity, unit_cost)
         VALUES ($1,$2,$3,$4,$5)`,
        [rows[0].id, item.menuItemId || null, item.itemName, item.quantity, item.unitCost || 0]
      )
    }
    await client.query('COMMIT')
    const { rows: items2 } = await query('SELECT * FROM damage_record_items WHERE damage_record_id = $1', [rows[0].id])
    res.status(201).json(fmt(rows[0], items2))
  } catch (err) {
    await client.query('ROLLBACK')
    next(err)
  } finally { client.release() }
}

async function remove(req, res, next) {
  try {
    const { rowCount } = await query(
      'DELETE FROM damage_records WHERE id = $1 AND restaurant_id = $2',
      [req.params.id, req.restaurantId]
    )
    if (!rowCount) return res.status(404).json({ error: 'Damage record not found' })
    res.status(204).end()
  } catch (err) { next(err) }
}

module.exports = { getAll, getOne, create, remove }
