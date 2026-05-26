const { query, pool }     = require('../config/db')
const { checkValidation } = require('../middleware/errorHandler')

function fmtId(n) { return `ST-${String(n).padStart(4, '0')}` }

function fmt(r, items = []) {
  return {
    id:           fmtId(r.id),
    _id:          r.id,
    name:         r.name,
    status:       r.status,
    conductedBy:  r.conducted_by,
    startedAt:    r.started_at,
    completedAt:  r.completed_at,
    notes:        r.notes,
    restaurantId: r.restaurant_id,
    createdAt:    r.created_at,
    updatedAt:    r.updated_at,
    items:        items.map(i => ({
      id:           i.id,
      menuItemId:   i.menu_item_id,
      itemName:     i.item_name,
      expectedQty:  i.expected_qty,
      actualQty:    i.actual_qty,
      variance:     i.variance,
      unitCost:     parseFloat(i.unit_cost),
      varianceValue: i.variance * parseFloat(i.unit_cost),
    })),
  }
}

async function getAll(req, res, next) {
  try {
    const { rows } = await query(
      'SELECT * FROM stock_takes WHERE restaurant_id = $1 ORDER BY created_at DESC',
      [req.restaurantId]
    )
    res.json(rows.map(r => fmt(r)))
  } catch (err) { next(err) }
}

async function getOne(req, res, next) {
  try {
    const { rows } = await query(
      'SELECT * FROM stock_takes WHERE id = $1 AND restaurant_id = $2',
      [req.params.id, req.restaurantId]
    )
    if (!rows.length) return res.status(404).json({ error: 'Stock take not found' })
    const { rows: items } = await query(
      'SELECT * FROM stock_take_items WHERE stock_take_id = $1 ORDER BY id',
      [req.params.id]
    )
    res.json(fmt(rows[0], items))
  } catch (err) { next(err) }
}

async function create(req, res, next) {
  if (!checkValidation(req, res)) return
  const { name, notes } = req.body
  const conductedBy = req.user.name || req.user.email
  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    const { rows } = await client.query(
      `INSERT INTO stock_takes (restaurant_id, name, conducted_by, notes, status, started_at)
       VALUES ($1,$2,$3,$4,'in_progress',NOW()) RETURNING *`,
      [req.restaurantId, name, conductedBy, notes || '']
    )

    // Auto-populate items from current menu
    const menuItems = await client.query(
      'SELECT id, name, stock, cost_price FROM menu_items WHERE restaurant_id = $1 ORDER BY name',
      [req.restaurantId]
    )
    for (const m of menuItems.rows) {
      await client.query(
        `INSERT INTO stock_take_items (stock_take_id, menu_item_id, item_name, expected_qty, actual_qty, unit_cost)
         VALUES ($1,$2,$3,$4,$4,$5)`,
        [rows[0].id, m.id, m.name, m.stock, m.cost_price]
      )
    }

    await client.query('COMMIT')
    const { rows: items } = await query('SELECT * FROM stock_take_items WHERE stock_take_id = $1', [rows[0].id])
    res.status(201).json(fmt(rows[0], items))
  } catch (err) {
    await client.query('ROLLBACK')
    next(err)
  } finally { client.release() }
}

async function updateItem(req, res, next) {
  const { actualQty } = req.body
  if (actualQty === undefined) return res.status(400).json({ error: 'actualQty required' })
  try {
    const { rows } = await query(
      `UPDATE stock_take_items SET actual_qty = $1
       WHERE id = $2 RETURNING *`,
      [actualQty, req.params.itemId]
    )
    if (!rows.length) return res.status(404).json({ error: 'Item not found' })
    res.json({
      id: rows[0].id,
      actualQty: rows[0].actual_qty,
      variance: rows[0].variance,
    })
  } catch (err) { next(err) }
}

async function complete(req, res, next) {
  try {
    const { rows } = await query(
      `UPDATE stock_takes SET status='completed', completed_at=NOW(), updated_at=NOW()
       WHERE id = $1 AND restaurant_id = $2 AND status != 'completed' RETURNING *`,
      [req.params.id, req.restaurantId]
    )
    if (!rows.length) return res.status(404).json({ error: 'Stock take not found or already completed' })
    res.json(fmt(rows[0]))
  } catch (err) { next(err) }
}

async function remove(req, res, next) {
  try {
    const { rowCount } = await query(
      'DELETE FROM stock_takes WHERE id = $1 AND restaurant_id = $2',
      [req.params.id, req.restaurantId]
    )
    if (!rowCount) return res.status(404).json({ error: 'Stock take not found' })
    res.status(204).end()
  } catch (err) { next(err) }
}

module.exports = { getAll, getOne, create, updateItem, complete, remove }
