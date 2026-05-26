const { query } = require('../config/db')

function fmtReturn(r) {
  return {
    id:         r.id,
    orderId:    r.order_id,
    reason:     r.reason || '',
    total:      parseFloat(r.total || 0),
    status:     r.status,
    processedBy: r.processed_by || '',
    createdAt:  r.created_at,
    items:      r.items || [],
  }
}

async function getAll(req, res, next) {
  try {
    const { status, search } = req.query
    const params = [req.restaurantId]
    let sql = `
      SELECT r.*,
        COALESCE(
          json_agg(
            json_build_object(
              'id',        ri.id,
              'itemName',  ri.item_name,
              'quantity',  ri.quantity,
              'unitPrice', ri.unit_price,
              'lineTotal', ri.line_total
            ) ORDER BY ri.id
          ) FILTER (WHERE ri.id IS NOT NULL),
        '[]'::json) AS items
      FROM returns r
      LEFT JOIN return_items ri ON ri.return_id = r.id
      WHERE r.restaurant_id = $1
    `
    if (status) {
      params.push(status)
      sql += ` AND r.status = $${params.length}`
    }
    if (search) {
      params.push(`%${search}%`)
      sql += ` AND r.reason ILIKE $${params.length}`
    }
    sql += ' GROUP BY r.id ORDER BY r.created_at DESC'
    const { rows } = await query(sql, params)
    res.json(rows.map(fmtReturn))
  } catch (err) { next(err) }
}

async function getOne(req, res, next) {
  try {
    const { rows } = await query(`
      SELECT r.*,
        COALESCE(
          json_agg(json_build_object(
            'id',        ri.id,
            'itemName',  ri.item_name,
            'quantity',  ri.quantity,
            'unitPrice', ri.unit_price,
            'lineTotal', ri.line_total
          ) ORDER BY ri.id)
          FILTER (WHERE ri.id IS NOT NULL),
        '[]'::json) AS items
      FROM returns r
      LEFT JOIN return_items ri ON ri.return_id = r.id
      WHERE r.id = $1 AND r.restaurant_id = $2
      GROUP BY r.id
    `, [req.params.id, req.restaurantId])
    if (!rows.length) return res.status(404).json({ error: 'Return not found' })
    res.json(fmtReturn(rows[0]))
  } catch (err) { next(err) }
}

async function create(req, res, next) {
  try {
    const { orderId, reason, items = [] } = req.body
    if (!reason) return res.status(400).json({ error: 'Reason is required' })

    const total = items.reduce(
      (s, i) => s + (parseFloat(i.unitPrice || 0) * parseInt(i.quantity || 0)), 0
    )
    const processedBy = req.user?.name || req.user?.email || 'Admin'

    const { rows } = await query(
      `INSERT INTO returns (restaurant_id, order_id, reason, total, processed_by)
       VALUES ($1,$2,$3,$4,$5) RETURNING *`,
      [req.restaurantId, orderId || null, reason, total, processedBy]
    )
    const ret = rows[0]

    for (const item of items) {
      await query(
        `INSERT INTO return_items (return_id, menu_item_id, item_name, quantity, unit_price)
         VALUES ($1,$2,$3,$4,$5)`,
        [ret.id, item.menuItemId || null, item.name || item.itemName, item.quantity, item.unitPrice || 0]
      )
    }

    const { rows: final } = await query(`
      SELECT r.*,
        COALESCE(json_agg(json_build_object(
          'id', ri.id, 'itemName', ri.item_name, 'quantity', ri.quantity,
          'unitPrice', ri.unit_price, 'lineTotal', ri.line_total
        ) ORDER BY ri.id) FILTER (WHERE ri.id IS NOT NULL), '[]'::json) AS items
      FROM returns r LEFT JOIN return_items ri ON ri.return_id = r.id
      WHERE r.id=$1 GROUP BY r.id
    `, [ret.id])
    res.status(201).json(fmtReturn(final[0]))
  } catch (err) { next(err) }
}

async function updateStatus(req, res, next) {
  try {
    const { status } = req.body
    if (!['pending', 'approved', 'rejected', 'completed'].includes(status))
      return res.status(400).json({ error: 'Invalid status' })
    const { rows } = await query(
      'UPDATE returns SET status=$1, updated_at=NOW() WHERE id=$2 AND restaurant_id=$3 RETURNING *',
      [status, req.params.id, req.restaurantId]
    )
    if (!rows.length) return res.status(404).json({ error: 'Return not found' })
    res.json(fmtReturn(rows[0]))
  } catch (err) { next(err) }
}

async function remove(req, res, next) {
  try {
    const { rowCount } = await query(
      'DELETE FROM returns WHERE id=$1 AND restaurant_id=$2',
      [req.params.id, req.restaurantId]
    )
    if (!rowCount) return res.status(404).json({ error: 'Return not found' })
    res.status(204).end()
  } catch (err) { next(err) }
}

module.exports = { getAll, getOne, create, updateStatus, remove }
