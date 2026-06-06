const { query, pool } = require('../config/db')
const { emitOrderUpdated } = require('../config/socket')
const { ORDER_SELECT, fmtOrder } = require('./ordersController')

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
    const ret = rows[0]

    // When approved: reduce matching order_items quantities and recalculate totals
    if (status === 'approved' && ret.order_id) {
      const { rows: retItems } = await query(
        'SELECT * FROM return_items WHERE return_id = $1 AND order_item_id IS NOT NULL',
        [ret.id]
      )

      if (retItems.length) {
        const client = await pool.connect()
        try {
          await client.query('BEGIN')
          for (const ri of retItems) {
            const { rows: oi } = await client.query(
              'SELECT quantity FROM order_items WHERE id = $1 AND order_id = $2',
              [ri.order_item_id, ret.order_id]
            )
            if (!oi.length) continue
            const newQty = oi[0].quantity - ri.quantity
            if (newQty <= 0) {
              await client.query('DELETE FROM order_items WHERE id = $1', [ri.order_item_id])
            } else {
              await client.query(
                'UPDATE order_items SET quantity = $1 WHERE id = $2',
                [newQty, ri.order_item_id]
              )
            }
          }
          // Recalculate order totals
          const { rows: totals } = await client.query(
            `SELECT COALESCE(SUM(quantity * unit_price), 0) AS subtotal
             FROM order_items WHERE order_id = $1`,
            [ret.order_id]
          )
          const subtotal = parseFloat(totals[0].subtotal)
          const total = Math.round(subtotal * 100) / 100
          await client.query(
            'UPDATE orders SET subtotal = $1, total = $2, updated_at = NOW() WHERE id = $3',
            [subtotal, total, ret.order_id]
          )
          await client.query('COMMIT')

          // Notify staff and customer of updated order via socket
          const fullRes = await query(`${ORDER_SELECT} WHERE o.id = $1 GROUP BY o.id`, [ret.order_id])
          if (fullRes.rows.length) {
            const fullOrder = fmtOrder(fullRes.rows[0])
            emitOrderUpdated(fullOrder.id, fullOrder.status, fullOrder)
          }
        } catch (err) {
          await client.query('ROLLBACK')
          throw err
        } finally {
          client.release()
        }
      }
    }

    res.json(fmtReturn(ret))
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
