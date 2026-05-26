const { query, pool }     = require('../config/db')
const { checkValidation } = require('../middleware/errorHandler')

function fmtId(n) { return `PR-${String(n).padStart(4, '0')}` }

function fmt(r, items = []) {
  return {
    id:              fmtId(r.id),
    _id:             r.id,
    supplierId:      r.supplier_id,
    supplierName:    r.supplier_name || '',
    purchaseOrderId: r.purchase_order_id,
    referenceNo:     r.reference_no,
    reason:          r.reason,
    status:          r.status,
    total:           parseFloat(r.total),
    restaurantId:    r.restaurant_id,
    createdAt:       r.created_at,
    updatedAt:       r.updated_at,
    items:           items.map(i => ({
      id:         i.id,
      menuItemId: i.menu_item_id,
      itemName:   i.item_name,
      quantity:   i.quantity,
      unitCost:   parseFloat(i.unit_cost),
      lineTotal:  parseFloat(i.line_total),
    })),
  }
}

const SELECT = `
  SELECT pr.*, s.name AS supplier_name
  FROM purchase_returns pr
  LEFT JOIN suppliers s ON s.id = pr.supplier_id
`

async function getAll(req, res, next) {
  try {
    const { status } = req.query
    let sql = `${SELECT} WHERE pr.restaurant_id = $1`
    const params = [req.restaurantId]
    if (status) { params.push(status); sql += ` AND pr.status = $${params.length}` }
    sql += ' ORDER BY pr.created_at DESC'
    const { rows } = await query(sql, params)
    res.json(rows.map(r => fmt(r)))
  } catch (err) { next(err) }
}

async function getOne(req, res, next) {
  try {
    const { rows } = await query(
      `${SELECT} WHERE pr.id = $1 AND pr.restaurant_id = $2`,
      [req.params.id, req.restaurantId]
    )
    if (!rows.length) return res.status(404).json({ error: 'Purchase return not found' })
    const { rows: items } = await query(
      'SELECT * FROM purchase_return_items WHERE purchase_return_id = $1 ORDER BY id',
      [req.params.id]
    )
    res.json(fmt(rows[0], items))
  } catch (err) { next(err) }
}

async function create(req, res, next) {
  if (!checkValidation(req, res)) return
  const { supplierId, purchaseOrderId, referenceNo, reason, items = [] } = req.body
  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    const total = items.reduce((s, i) => s + (i.quantity * i.unitCost), 0)
    const { rows } = await client.query(
      `INSERT INTO purchase_returns (restaurant_id, supplier_id, purchase_order_id, reference_no, reason, total)
       VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
      [req.restaurantId, supplierId || null, purchaseOrderId || null, referenceNo || '', reason || '', total]
    )
    for (const item of items) {
      await client.query(
        `INSERT INTO purchase_return_items (purchase_return_id, menu_item_id, item_name, quantity, unit_cost)
         VALUES ($1,$2,$3,$4,$5)`,
        [rows[0].id, item.menuItemId || null, item.itemName, item.quantity, item.unitCost || 0]
      )
    }
    await client.query('COMMIT')
    const { rows: created } = await query(`${SELECT} WHERE pr.id = $1`, [rows[0].id])
    const { rows: prItems } = await query('SELECT * FROM purchase_return_items WHERE purchase_return_id = $1', [rows[0].id])
    res.status(201).json(fmt(created[0], prItems))
  } catch (err) {
    await client.query('ROLLBACK')
    next(err)
  } finally { client.release() }
}

async function updateStatus(req, res, next) {
  const { status } = req.body
  if (!status) return res.status(400).json({ error: 'status required' })
  try {
    const { rows } = await query(
      `UPDATE purchase_returns SET status=$1, updated_at=NOW()
       WHERE id = $2 AND restaurant_id = $3 RETURNING *`,
      [status, req.params.id, req.restaurantId]
    )
    if (!rows.length) return res.status(404).json({ error: 'Purchase return not found' })
    res.json(fmt(rows[0]))
  } catch (err) { next(err) }
}

async function remove(req, res, next) {
  try {
    const { rowCount } = await query(
      `DELETE FROM purchase_returns WHERE id = $1 AND restaurant_id = $2 AND status = 'pending'`,
      [req.params.id, req.restaurantId]
    )
    if (!rowCount) return res.status(404).json({ error: 'Purchase return not found or not pending' })
    res.status(204).end()
  } catch (err) { next(err) }
}

module.exports = { getAll, getOne, create, updateStatus, remove }
