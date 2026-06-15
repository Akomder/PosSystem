const { query, pool }     = require('../config/db')
const { checkValidation } = require('../middleware/errorHandler')
const emailService        = require('../services/emailService')

function fmt(r) {
  return {
    id:           r.id,
    staffId:      r.staff_id,
    openedBy:     r.opened_by,
    closedBy:     r.closed_by,
    openedAt:     r.opened_at,
    closedAt:     r.closed_at,
    openingCash:  parseFloat(r.opening_cash  || 0),
    closingCash:  parseFloat(r.closing_cash  || 0),
    expectedCash: parseFloat(r.expected_cash || 0),
    cashVariance: parseFloat(r.cash_variance || 0),
    cashSalesTotal: parseFloat(r.cash_sales_total || 0), // computed on-the-fly for open shifts
    totalSales:   parseFloat(r.total_sales   || 0),
    totalOrders:  r.total_orders || 0,
    notes:        r.notes,
    status:       r.status,
    restaurantId: r.restaurant_id,
    createdAt:    r.created_at,
  }
}

async function getAll(req, res, next) {
  try {
    const { status } = req.query
    let sql = 'SELECT * FROM shifts WHERE restaurant_id = $1'
    const params = [req.restaurantId]
    if (status) { params.push(status); sql += ` AND status = $${params.length}` }
    sql += ' ORDER BY opened_at DESC LIMIT 100'
    const { rows } = await query(sql, params)
    res.json(rows.map(fmt))
  } catch (err) { next(err) }
}

async function getCurrent(req, res, next) {
  try {
    const { rows } = await query(
      `SELECT * FROM shifts WHERE restaurant_id = $1 AND status = 'open' ORDER BY opened_at DESC LIMIT 1`,
      [req.restaurantId]
    )
    if (!rows[0]) return res.json(null)

    const shift = rows[0]

    // Compute cash sales for this business day (for reconciliation preview)
    const cashRes = await query(
      `SELECT COALESCE(SUM(op.amount),0) AS cash_total
       FROM order_payments op
       JOIN orders o ON o.id = op.order_id
       WHERE op.payment_method = 'cash'
         AND o.restaurant_id = $1
         AND o.status = 'Closed'
         AND (o.shift_id = $2 OR (o.shift_id IS NULL AND o.created_at >= $3))`,
      [req.restaurantId, shift.id, shift.opened_at]
    )
    const cashSalesTotal = parseFloat(cashRes.rows[0].cash_total)
    const expectedCash   = parseFloat(shift.opening_cash) + cashSalesTotal

    res.json({ ...fmt(shift), cashSalesTotal, expectedCash })
  } catch (err) { next(err) }
}

async function openShift(req, res, next) {
  if (!checkValidation(req, res)) return
  const { openingCash, notes } = req.body
  const openedBy = req.user.name || req.user.email
  try {
    // Check no open shift already
    const existing = await query(
      `SELECT id FROM shifts WHERE restaurant_id = $1 AND status = 'open'`,
      [req.restaurantId]
    )
    if (existing.rows.length) return res.status(409).json({ error: 'A shift is already open' })

    const { rows } = await query(
      `INSERT INTO shifts (restaurant_id, opened_by, opening_cash, notes, status)
       VALUES ($1,$2,$3,$4,'open') RETURNING *`,
      [req.restaurantId, openedBy, openingCash ?? 0, notes || '']
    )
    res.status(201).json(fmt(rows[0]))
  } catch (err) { next(err) }
}

async function closeShift(req, res, next) {
  const { closingCash, notes } = req.body
  const closedBy = req.user.name || req.user.email
  const client = await pool.connect()
  try {
    await client.query('BEGIN')

    const { rows } = await client.query(
      `SELECT * FROM shifts WHERE id = $1 AND restaurant_id = $2 AND status = 'open'`,
      [req.params.id, req.restaurantId]
    )
    if (!rows.length) return res.status(404).json({ error: 'Open shift not found' })

    // Compute totals for this business day. Prefer shift_id (correct across
    // midnight); fall back to opened_at for orders created before tagging existed.
    const shiftId = rows[0].id
    const statsRes = await client.query(
      `SELECT COALESCE(SUM(total),0) AS total_sales, COUNT(*) AS total_orders
       FROM orders
       WHERE status = 'Closed' AND restaurant_id = $1
         AND (shift_id = $2 OR (shift_id IS NULL AND created_at >= $3))`,
      [req.restaurantId, shiftId, rows[0].opened_at]
    )

    // Compute cash sales to derive expected closing balance
    const cashRes = await client.query(
      `SELECT COALESCE(SUM(op.amount),0) AS cash_total
       FROM order_payments op
       JOIN orders o ON o.id = op.order_id
       WHERE op.payment_method = 'cash'
         AND o.restaurant_id = $1
         AND o.status = 'Closed'
         AND (o.shift_id = $2 OR (o.shift_id IS NULL AND o.created_at >= $3))`,
      [req.restaurantId, shiftId, rows[0].opened_at]
    )
    const closingCashNum = parseFloat(closingCash) || 0
    const expectedCash   = parseFloat(rows[0].opening_cash) + parseFloat(cashRes.rows[0].cash_total)
    const cashVariance   = closingCashNum - expectedCash

    const { rows: updated } = await client.query(
      `UPDATE shifts SET status='closed', closed_by=$1, closed_at=NOW(),
         closing_cash=$2, total_sales=$3, total_orders=$4,
         expected_cash=$5, cash_variance=$6,
         notes=CASE WHEN $7 != '' THEN $7 ELSE notes END, updated_at=NOW()
       WHERE id = $8 RETURNING *`,
      [
        closedBy,
        closingCashNum,
        statsRes.rows[0].total_sales,
        statsRes.rows[0].total_orders,
        expectedCash,
        cashVariance,
        notes || '',
        req.params.id,
      ]
    )

    await client.query('COMMIT')
    const shiftData = fmt(updated[0])
    res.json(shiftData)

    // Fire-and-forget EOD summary email to restaurant Admin(s)
    query(
      `SELECT u.email FROM users u
       WHERE u.role = 'Admin' AND u.restaurant_id = $1 AND u.email IS NOT NULL`,
      [req.restaurantId]
    ).then(({ rows: admins }) => {
      if (!admins.length) return
      return query(`SELECT name FROM restaurants WHERE id = $1`, [req.restaurantId])
        .then(({ rows: rRows }) => emailService.sendShiftSummary({
          to:             admins.map(a => a.email),
          restaurantName: rRows[0]?.name || 'Restaurant',
          shift:          shiftData,
        }))
    }).catch(err => console.error('[EOD email] failed:', err.message))
  } catch (err) {
    await client.query('ROLLBACK')
    next(err)
  } finally { client.release() }
}

// ─── GET /api/shifts/:id/summary ──────────────────────────────────────────────
// Sales + per-item breakdown for one business day (shift). Used by EOD/reports.
async function getSummary(req, res, next) {
  try {
    const { rows } = await query(
      `SELECT * FROM shifts WHERE id = $1 AND restaurant_id = $2`,
      [req.params.id, req.restaurantId]
    )
    if (!rows.length) return res.status(404).json({ error: 'Shift not found' })
    const shift = rows[0]

    // Orders belong to the shift if tagged, or (legacy) by time window.
    const dayFilter = `(o.shift_id = $2 OR (o.shift_id IS NULL AND o.created_at >= $3
       AND ($4::timestamptz IS NULL OR o.created_at <= $4)))`
    const params = [req.restaurantId, shift.id, shift.opened_at, shift.closed_at]

    const [totalsRes, itemsRes] = await Promise.all([
      query(
        `SELECT COUNT(*) AS total_orders,
                COALESCE(SUM(o.subtotal),0) AS subtotal,
                COALESCE(SUM(o.discount),0) AS discount,
                COALESCE(SUM(o.total),0)    AS total
         FROM orders o
         WHERE o.status = 'Closed' AND o.restaurant_id = $1 AND ${dayFilter}`,
        params
      ),
      query(
        `SELECT oi.name,
                SUM(oi.quantity)                 AS qty,
                SUM(oi.quantity * oi.unit_price) AS revenue
         FROM order_items oi
         JOIN orders o ON o.id = oi.order_id
         WHERE o.status = 'Closed' AND o.restaurant_id = $1 AND ${dayFilter}
         GROUP BY oi.name ORDER BY qty DESC`,
        params
      ),
    ])

    const t = totalsRes.rows[0]
    res.json({
      shift:       fmt(shift),
      totalOrders: parseInt(t.total_orders),
      subtotal:    parseFloat(t.subtotal),
      discount:    parseFloat(t.discount),
      total:       parseFloat(t.total),
      items: itemsRes.rows.map(r => ({
        name:    r.name,
        qty:     parseInt(r.qty),
        revenue: parseFloat(r.revenue),
      })),
    })
  } catch (err) { next(err) }
}

module.exports = { getAll, getCurrent, openShift, closeShift, getSummary }
