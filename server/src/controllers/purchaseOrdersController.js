const { query, pool }     = require('../config/db')
const { checkValidation } = require('../middleware/errorHandler')

function fmtId(n) { return `PO-${String(n).padStart(4, '0')}` }

function fmt(r, items = []) {
  return {
    id:           fmtId(r.id),
    _id:          r.id,
    supplierId:   r.supplier_id,
    supplierName: r.supplier_name || '',
    referenceNo:  r.reference_no,
    status:       r.status,
    orderedAt:    r.ordered_at,
    expectedAt:   r.expected_at,
    receivedAt:   r.received_at,
    notes:        r.notes,
    total:        parseFloat(r.total),
    restaurantId: r.restaurant_id,
    createdAt:    r.created_at,
    updatedAt:    r.updated_at,
    items:        items.map(i => ({
      id:               i.id,
      menuItemId:       i.menu_item_id,
      itemName:         i.item_name,
      quantityOrdered:  i.quantity_ordered,
      quantityReceived: i.quantity_received,
      unitCost:         parseFloat(i.unit_cost),
      lineTotal:        parseFloat(i.line_total),
    })),
  }
}

const SELECT = `
  SELECT po.*, s.name AS supplier_name
  FROM purchase_orders po
  LEFT JOIN suppliers s ON s.id = po.supplier_id
`

async function getAll(req, res, next) {
  try {
    const { status } = req.query
    let sql = `${SELECT} WHERE po.restaurant_id = $1`
    const params = [req.restaurantId]
    if (status) { params.push(status); sql += ` AND po.status = $${params.length}` }
    sql += ' ORDER BY po.created_at DESC'
    const { rows } = await query(sql, params)
    res.json(rows.map(r => fmt(r)))
  } catch (err) { next(err) }
}

async function getOne(req, res, next) {
  try {
    const { rows } = await query(
      `${SELECT} WHERE po.id = $1 AND po.restaurant_id = $2`,
      [req.params.id, req.restaurantId]
    )
    if (!rows.length) return res.status(404).json({ error: 'Purchase order not found' })
    const { rows: items } = await query(
      'SELECT * FROM purchase_order_items WHERE purchase_order_id = $1 ORDER BY id',
      [req.params.id]
    )
    res.json(fmt(rows[0], items))
  } catch (err) { next(err) }
}

async function create(req, res, next) {
  if (!checkValidation(req, res)) return
  const { supplierId, referenceNo, expectedAt, notes, items = [] } = req.body
  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    const total = items.reduce((s, i) => s + (i.quantityOrdered * i.unitCost), 0)
    const { rows } = await client.query(
      `INSERT INTO purchase_orders (restaurant_id, supplier_id, reference_no, expected_at, notes, total)
       VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
      [req.restaurantId, supplierId || null, referenceNo || '', expectedAt || null, notes || '', total]
    )
    for (const item of items) {
      await client.query(
        `INSERT INTO purchase_order_items (purchase_order_id, menu_item_id, item_name, quantity_ordered, unit_cost)
         VALUES ($1,$2,$3,$4,$5)`,
        [rows[0].id, item.menuItemId || null, item.itemName, item.quantityOrdered, item.unitCost || 0]
      )
    }
    await client.query('COMMIT')
    const { rows: created } = await query(`${SELECT} WHERE po.id = $1`, [rows[0].id])
    const { rows: poItems } = await query('SELECT * FROM purchase_order_items WHERE purchase_order_id = $1', [rows[0].id])
    res.status(201).json(fmt(created[0], poItems))
  } catch (err) {
    await client.query('ROLLBACK')
    next(err)
  } finally { client.release() }
}

async function updateStatus(req, res, next) {
  const { status } = req.body
  if (!status) return res.status(400).json({ error: 'status required' })
  try {
    const updateFields = { status }
    if (status === 'ordered')  updateFields.ordered_at  = 'NOW()'
    if (status === 'received') updateFields.received_at = 'NOW()'

    const sets = ['status = $1', 'updated_at = NOW()']
    const params = [status]
    if (status === 'ordered')  { sets.push(`ordered_at = NOW()`) }
    if (status === 'received') { sets.push(`received_at = NOW()`) }
    params.push(req.params.id, req.restaurantId)

    const { rows } = await query(
      `UPDATE purchase_orders SET ${sets.join(', ')}
       WHERE id = $${params.length - 1} AND restaurant_id = $${params.length} RETURNING *`,
      params
    )
    if (!rows.length) return res.status(404).json({ error: 'Purchase order not found' })
    res.json(fmt(rows[0]))
  } catch (err) { next(err) }
}

async function remove(req, res, next) {
  try {
    const { rowCount } = await query(
      `DELETE FROM purchase_orders WHERE id = $1 AND restaurant_id = $2 AND status = 'draft'`,
      [req.params.id, req.restaurantId]
    )
    if (!rowCount) return res.status(404).json({ error: 'Purchase order not found or not in draft' })
    res.status(204).end()
  } catch (err) { next(err) }
}

module.exports = { getAll, getOne, create, updateStatus, remove }
