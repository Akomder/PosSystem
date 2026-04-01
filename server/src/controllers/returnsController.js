const { query } = require('../config/db')

function fmtReturn(r) {
  return {
    id:          r.id,
    code:        r.code || `RET${String(r.id).padStart(6, '0')}`,
    orderId:     r.order_id ? `ORD-${String(r.order_id).padStart(3, '0')}` : null,
    rawOrderId:  r.order_id,
    reason:      r.reason || '',
    totalRefund: parseFloat(r.total_refund || 0),
    status:      r.status,
    createdBy:   r.created_by || '',
    createdAt:   r.created_at,
    items:       r.items || [],
  }
}

async function getAll(req, res, next) {
  try {
    const { status, search } = req.query
    let sql = `
      SELECT r.*,
        COALESCE(
          json_agg(
            json_build_object(
              'name', ri.name,
              'quantity', ri.quantity,
              'unit_price', ri.unit_price
            ) ORDER BY ri.id
          ) FILTER (WHERE ri.id IS NOT NULL),
        '[]'::json) AS items
      FROM returns r
      LEFT JOIN return_items ri ON ri.return_id = r.id
      WHERE 1=1
    `
    const params = []
    if (status) {
      params.push(status)
      sql += ` AND r.status = $${params.length}`
    }
    if (search) {
      params.push(`%${search}%`)
      sql += ` AND (r.code ILIKE $${params.length} OR r.reason ILIKE $${params.length})`
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
          json_agg(json_build_object('name', ri.name, 'quantity', ri.quantity, 'unit_price', ri.unit_price) ORDER BY ri.id)
          FILTER (WHERE ri.id IS NOT NULL),
        '[]'::json) AS items
      FROM returns r
      LEFT JOIN return_items ri ON ri.return_id = r.id
      WHERE r.id = $1 GROUP BY r.id
    `, [req.params.id])
    if (!rows.length) return res.status(404).json({ error: 'Return not found' })
    res.json(fmtReturn(rows[0]))
  } catch (err) { next(err) }
}

async function create(req, res, next) {
  try {
    const { orderId, reason, items = [], createdBy } = req.body
    if (!reason) return res.status(400).json({ error: 'Reason is required' })

    const totalRefund = items.reduce((s, i) => s + (parseFloat(i.unitPrice || 0) * parseInt(i.quantity || 0)), 0)

    const { rows } = await query(
      `INSERT INTO returns (order_id, reason, total_refund, created_by)
       VALUES ($1,$2,$3,$4) RETURNING *`,
      [orderId || null, reason, totalRefund, createdBy || req.user?.name || 'Admin']
    )
    const ret = rows[0]
    // auto code
    await query(`UPDATE returns SET code=$1 WHERE id=$2`,
      [`RET${String(ret.id).padStart(6, '0')}`, ret.id])

    for (const item of items) {
      await query(
        `INSERT INTO return_items (return_id, name, quantity, unit_price) VALUES ($1,$2,$3,$4)`,
        [ret.id, item.name, item.quantity, item.unitPrice || 0]
      )
    }

    const { rows: final } = await query(`
      SELECT r.*,
        COALESCE(json_agg(json_build_object('name', ri.name, 'quantity', ri.quantity, 'unit_price', ri.unit_price) ORDER BY ri.id)
        FILTER (WHERE ri.id IS NOT NULL), '[]'::json) AS items
      FROM returns r LEFT JOIN return_items ri ON ri.return_id = r.id
      WHERE r.id=$1 GROUP BY r.id
    `, [ret.id])
    res.status(201).json(fmtReturn(final[0]))
  } catch (err) { next(err) }
}

async function updateStatus(req, res, next) {
  try {
    const { status } = req.body
    if (!['pending', 'approved', 'rejected'].includes(status))
      return res.status(400).json({ error: 'Invalid status' })
    const { rows } = await query(
      'UPDATE returns SET status=$1 WHERE id=$2 RETURNING *',
      [status, req.params.id]
    )
    if (!rows.length) return res.status(404).json({ error: 'Return not found' })
    res.json(fmtReturn(rows[0]))
  } catch (err) { next(err) }
}

async function remove(req, res, next) {
  try {
    const { rowCount } = await query('DELETE FROM returns WHERE id=$1', [req.params.id])
    if (!rowCount) return res.status(404).json({ error: 'Return not found' })
    res.json({ success: true })
  } catch (err) { next(err) }
}

module.exports = { getAll, getOne, create, updateStatus, remove }
