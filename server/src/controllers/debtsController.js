const { query, pool }     = require('../config/db')
const { checkValidation } = require('../middleware/errorHandler')

function fmtDebt(r) {
  const displayName  = r.customer_name  || r.debtor_name  || 'Unknown'
  const displayPhone = r.customer_phone || r.debtor_phone || null
  const remaining    = parseFloat(r.amount) - parseFloat(r.paid_amount)
  return {
    id:           r.id,
    customerId:   r.customer_id   || null,
    customerName: r.customer_name || null,
    debtorName:   r.debtor_name   || null,
    debtorPhone:  r.debtor_phone  || null,
    displayName,
    displayPhone,
    isCustomer:   !!r.customer_id,
    orderId:      r.order_id      || null,
    amount:       parseFloat(r.amount),
    paidAmount:   parseFloat(r.paid_amount),
    remaining:    Math.max(0, remaining),
    description:  r.description || '',
    status:       r.status,
    dueDate:      r.due_date || null,
    createdAt:    r.created_at,
    updatedAt:    r.updated_at,
  }
}

function fmtPayment(r) {
  return {
    id:        r.id,
    debtId:    r.debt_id,
    amount:    parseFloat(r.amount),
    note:      r.note || '',
    createdAt: r.created_at,
  }
}

// ─── GET /api/debts ───────────────────────────────────────────────────────────
async function getAll(req, res, next) {
  try {
    const { status, search } = req.query
    const params = [req.restaurantId]

    let sql = `
      SELECT d.*, c.name AS customer_name, c.phone AS customer_phone
      FROM debts d
      LEFT JOIN customers c ON c.id = d.customer_id
      WHERE d.restaurant_id = $1
    `
    if (status) {
      params.push(status)
      sql += ` AND d.status = $${params.length}`
    }
    if (search) {
      params.push(`%${search}%`)
      sql += ` AND (c.name ILIKE $${params.length} OR d.debtor_name ILIKE $${params.length})`
    }
    sql += ' ORDER BY d.created_at DESC'

    const { rows } = await query(sql, params)

    const sumRes = await query(`
      SELECT
        COUNT(*) FILTER (WHERE status = 'unpaid')                                         AS unpaid_count,
        COUNT(*) FILTER (WHERE status = 'partial')                                        AS partial_count,
        COALESCE(SUM(amount - paid_amount) FILTER (WHERE status IN ('unpaid','partial')), 0) AS total_remaining
      FROM debts WHERE restaurant_id = $1
    `, [req.restaurantId])

    const s = sumRes.rows[0]
    res.json({
      debts: rows.map(fmtDebt),
      summary: {
        unpaidCount:    parseInt(s.unpaid_count),
        partialCount:   parseInt(s.partial_count),
        totalRemaining: parseFloat(s.total_remaining),
      },
    })
  } catch (err) { next(err) }
}

// ─── GET /api/debts/:id ───────────────────────────────────────────────────────
async function getOne(req, res, next) {
  try {
    const { rows } = await query(`
      SELECT d.*, c.name AS customer_name, c.phone AS customer_phone
      FROM debts d
      LEFT JOIN customers c ON c.id = d.customer_id
      WHERE d.id = $1 AND d.restaurant_id = $2
    `, [req.params.id, req.restaurantId])

    if (!rows.length) return res.status(404).json({ error: 'Debt not found' })

    const pmtRes = await query(
      `SELECT * FROM debt_payments WHERE debt_id = $1 ORDER BY created_at DESC`,
      [req.params.id]
    )

    res.json({ debt: fmtDebt(rows[0]), payments: pmtRes.rows.map(fmtPayment) })
  } catch (err) { next(err) }
}

// ─── POST /api/debts ──────────────────────────────────────────────────────────
async function create(req, res, next) {
  if (!checkValidation(req, res)) return
  try {
    const { customerId, debtorName, debtorPhone, amount, description, dueDate, orderId } = req.body

    if (!customerId && !debtorName) {
      return res.status(400).json({ error: 'Provide either customerId or debtorName' })
    }

    const { rows } = await query(`
      INSERT INTO debts
        (restaurant_id, customer_id, debtor_name, debtor_phone, amount, description, due_date, order_id)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING *
    `, [req.restaurantId, customerId || null, debtorName || null, debtorPhone || null,
        amount, description || null, dueDate || null, orderId || null])

    const full = await query(`
      SELECT d.*, c.name AS customer_name, c.phone AS customer_phone
      FROM debts d LEFT JOIN customers c ON c.id = d.customer_id WHERE d.id = $1
    `, [rows[0].id])

    res.status(201).json(fmtDebt(full.rows[0]))
  } catch (err) { next(err) }
}

// ─── PUT /api/debts/:id ───────────────────────────────────────────────────────
async function update(req, res, next) {
  if (!checkValidation(req, res)) return
  try {
    const { debtorName, debtorPhone, amount, description, dueDate } = req.body
    const sets = [], params = []

    if (debtorName   !== undefined) { params.push(debtorName);   sets.push(`debtor_name = $${params.length}`) }
    if (debtorPhone  !== undefined) { params.push(debtorPhone);  sets.push(`debtor_phone = $${params.length}`) }
    if (amount       !== undefined) { params.push(amount);       sets.push(`amount = $${params.length}`) }
    if (description  !== undefined) { params.push(description);  sets.push(`description = $${params.length}`) }
    if (dueDate      !== undefined) { params.push(dueDate);      sets.push(`due_date = $${params.length}`) }

    if (!sets.length) return res.status(400).json({ error: 'Nothing to update' })

    params.push(req.params.id, req.restaurantId)
    const { rows } = await query(`
      UPDATE debts SET ${sets.join(', ')}, updated_at = NOW()
      WHERE id = $${params.length - 1} AND restaurant_id = $${params.length}
      RETURNING *
    `, params)

    if (!rows.length) return res.status(404).json({ error: 'Debt not found' })

    const full = await query(`
      SELECT d.*, c.name AS customer_name, c.phone AS customer_phone
      FROM debts d LEFT JOIN customers c ON c.id = d.customer_id WHERE d.id = $1
    `, [rows[0].id])

    res.json(fmtDebt(full.rows[0]))
  } catch (err) { next(err) }
}

// ─── DELETE /api/debts/:id ────────────────────────────────────────────────────
async function remove(req, res, next) {
  try {
    const { rowCount } = await query(
      `DELETE FROM debts WHERE id = $1 AND restaurant_id = $2`,
      [req.params.id, req.restaurantId]
    )
    if (!rowCount) return res.status(404).json({ error: 'Debt not found' })
    res.json({ success: true })
  } catch (err) { next(err) }
}

// ─── POST /api/debts/:id/payment ─────────────────────────────────────────────
async function recordPayment(req, res, next) {
  const client = await pool.connect()
  try {
    await client.query('BEGIN')

    const { amount, note } = req.body
    if (!amount || amount <= 0) {
      await client.query('ROLLBACK')
      return res.status(400).json({ error: 'Amount must be positive' })
    }

    const { rows: debtRows } = await client.query(
      `SELECT * FROM debts WHERE id = $1 AND restaurant_id = $2 FOR UPDATE`,
      [req.params.id, req.restaurantId]
    )
    if (!debtRows.length) {
      await client.query('ROLLBACK')
      return res.status(404).json({ error: 'Debt not found' })
    }

    const debt       = debtRows[0]
    const newPaid    = Math.min(parseFloat(debt.amount), parseFloat(debt.paid_amount) + parseFloat(amount))
    const newStatus  = newPaid >= parseFloat(debt.amount) ? 'paid' : 'partial'

    await client.query(
      `UPDATE debts SET paid_amount = $1, status = $2, updated_at = NOW() WHERE id = $3`,
      [newPaid, newStatus, debt.id]
    )

    const { rows: pmtRows } = await client.query(`
      INSERT INTO debt_payments (restaurant_id, debt_id, amount, note)
      VALUES ($1, $2, $3, $4) RETURNING *
    `, [req.restaurantId, debt.id, amount, note || null])

    await client.query('COMMIT')

    res.json({ payment: fmtPayment(pmtRows[0]), newPaid, newStatus })
  } catch (err) {
    await client.query('ROLLBACK')
    next(err)
  } finally { client.release() }
}

module.exports = { getAll, getOne, create, update, remove, recordPayment }
