const { query, pool }     = require('../config/db')
const { checkValidation } = require('../middleware/errorHandler')

// ─── Format helpers ───────────────────────────────────────────────────────────
function fmtAccount(r) {
  // displayName: prefer linked customer name, fall back to manually entered debtor_name
  const displayName  = r.customer_name  || r.debtor_name  || 'Unknown'
  const displayPhone = r.customer_phone || r.debtor_phone || null
  const isCustomer   = !!r.customer_id

  return {
    id:            r.id,
    customerId:    r.customer_id    || null,
    customerName:  r.customer_name  || null,
    customerGroup: r.customer_group || null,
    debtorName:    r.debtor_name    || null,
    debtorPhone:   r.debtor_phone   || null,
    displayName,
    displayPhone,
    isCustomer,
    creditLimit:   parseFloat(r.credit_limit),
    balance:       parseFloat(r.balance),
    status:        r.status,
    notes:         r.notes || '',
    createdAt:     r.created_at,
    updatedAt:     r.updated_at,
  }
}

function fmtTx(r) {
  return {
    id:           r.id,
    accountId:    r.account_id,
    orderId:      r.order_id || null,
    type:         r.type,
    amount:       parseFloat(r.amount),
    balanceAfter: parseFloat(r.balance_after),
    description:  r.description || '',
    createdAt:    r.created_at,
  }
}

// ─── GET /api/house-accounts ──────────────────────────────────────────────────
async function getAll(req, res, next) {
  try {
    const { status, search } = req.query
    const params = [req.restaurantId]

    // LEFT JOIN — allows customer_id to be NULL (non-customer debtors)
    let sql = `
      SELECT ha.*, c.name AS customer_name, c.group_name AS customer_group, c.phone AS customer_phone
      FROM house_accounts ha
      LEFT JOIN customers c ON c.id = ha.customer_id
      WHERE ha.restaurant_id = $1
    `
    if (status) {
      params.push(status)
      sql += ` AND ha.status = $${params.length}`
    }
    if (search) {
      params.push(`%${search}%`)
      sql += ` AND (c.name ILIKE $${params.length} OR ha.debtor_name ILIKE $${params.length})`
    }
    sql += ' ORDER BY ha.balance DESC, COALESCE(c.name, ha.debtor_name) ASC'

    const { rows } = await query(sql, params)

    const sumRes = await query(`
      SELECT
        COUNT(*) FILTER (WHERE status = 'active')                        AS active_count,
        COALESCE(SUM(balance) FILTER (WHERE status = 'active'), 0)       AS total_outstanding,
        COALESCE(SUM(credit_limit) FILTER (WHERE status = 'active'), 0)  AS total_limit
      FROM house_accounts WHERE restaurant_id = $1
    `, [req.restaurantId])

    const s = sumRes.rows[0]
    res.json({
      accounts: rows.map(fmtAccount),
      summary: {
        activeCount:      parseInt(s.active_count),
        totalOutstanding: parseFloat(s.total_outstanding),
        totalLimit:       parseFloat(s.total_limit),
      },
    })
  } catch (err) { next(err) }
}

// ─── GET /api/house-accounts/:id ─────────────────────────────────────────────
async function getOne(req, res, next) {
  try {
    const { rows } = await query(`
      SELECT ha.*, c.name AS customer_name, c.group_name AS customer_group, c.phone AS customer_phone
      FROM house_accounts ha
      LEFT JOIN customers c ON c.id = ha.customer_id
      WHERE ha.id = $1 AND ha.restaurant_id = $2
    `, [req.params.id, req.restaurantId])

    if (!rows.length) return res.status(404).json({ error: 'House account not found' })

    const txRes = await query(
      `SELECT * FROM house_account_transactions WHERE account_id = $1 ORDER BY created_at DESC LIMIT 100`,
      [req.params.id]
    )

    res.json({ account: fmtAccount(rows[0]), transactions: txRes.rows.map(fmtTx) })
  } catch (err) { next(err) }
}

// ─── POST /api/house-accounts ─────────────────────────────────────────────────
// Supports both registered customers (customerId) and non-customer debtors (debtorName + optional debtorPhone)
async function create(req, res, next) {
  if (!checkValidation(req, res)) return
  try {
    const { customerId, debtorName, debtorPhone, creditLimit = 0, notes = '' } = req.body

    if (!customerId && !debtorName) {
      return res.status(400).json({ error: 'Provide either customerId or debtorName' })
    }

    // Prevent duplicate customer accounts
    if (customerId) {
      const existing = await query(
        'SELECT id FROM house_accounts WHERE restaurant_id=$1 AND customer_id=$2',
        [req.restaurantId, customerId]
      )
      if (existing.rows.length) {
        return res.status(409).json({ error: 'This customer already has a house account' })
      }
    }

    const { rows } = await query(`
      INSERT INTO house_accounts (restaurant_id, customer_id, debtor_name, debtor_phone, credit_limit, notes)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *
    `, [req.restaurantId, customerId || null, debtorName || null, debtorPhone || null, creditLimit, notes])

    const full = await query(`
      SELECT ha.*, c.name AS customer_name, c.group_name AS customer_group, c.phone AS customer_phone
      FROM house_accounts ha LEFT JOIN customers c ON c.id = ha.customer_id WHERE ha.id = $1
    `, [rows[0].id])

    res.status(201).json(fmtAccount(full.rows[0]))
  } catch (err) { next(err) }
}

// ─── PUT /api/house-accounts/:id ──────────────────────────────────────────────
async function update(req, res, next) {
  if (!checkValidation(req, res)) return
  try {
    const { creditLimit, status, notes, debtorName, debtorPhone } = req.body
    const sets = [], params = []

    if (creditLimit  !== undefined) { params.push(creditLimit);  sets.push(`credit_limit = $${params.length}`) }
    if (status       !== undefined) { params.push(status);       sets.push(`status = $${params.length}`) }
    if (notes        !== undefined) { params.push(notes);        sets.push(`notes = $${params.length}`) }
    if (debtorName   !== undefined) { params.push(debtorName);   sets.push(`debtor_name = $${params.length}`) }
    if (debtorPhone  !== undefined) { params.push(debtorPhone);  sets.push(`debtor_phone = $${params.length}`) }

    if (!sets.length) return res.status(400).json({ error: 'Nothing to update' })

    params.push(req.params.id, req.restaurantId)
    const { rows } = await query(`
      UPDATE house_accounts SET ${sets.join(', ')}, updated_at = NOW()
      WHERE id = $${params.length - 1} AND restaurant_id = $${params.length}
      RETURNING *
    `, params)

    if (!rows.length) return res.status(404).json({ error: 'House account not found' })

    const full = await query(`
      SELECT ha.*, c.name AS customer_name, c.group_name AS customer_group, c.phone AS customer_phone
      FROM house_accounts ha LEFT JOIN customers c ON c.id = ha.customer_id WHERE ha.id = $1
    `, [rows[0].id])

    res.json(fmtAccount(full.rows[0]))
  } catch (err) { next(err) }
}

// ─── GET /api/house-accounts/:id/transactions ────────────────────────────────
async function getTransactions(req, res, next) {
  try {
    const { rows } = await query(`
      SELECT * FROM house_account_transactions
      WHERE account_id = $1 AND restaurant_id = $2
      ORDER BY created_at DESC
    `, [req.params.id, req.restaurantId])
    res.json(rows.map(fmtTx))
  } catch (err) { next(err) }
}

// ─── POST /api/house-accounts/:id/charge ─────────────────────────────────────
// Charge an order to this account (order is closed, balance incremented)
async function chargeOrder(req, res, next) {
  const client = await pool.connect()
  try {
    await client.query('BEGIN')

    const { orderId, amount, description } = req.body
    if (!amount || amount <= 0) {
      await client.query('ROLLBACK')
      return res.status(400).json({ error: 'Amount must be positive' })
    }

    const { rows: accRows } = await client.query(
      `SELECT * FROM house_accounts WHERE id = $1 AND restaurant_id = $2 FOR UPDATE`,
      [req.params.id, req.restaurantId]
    )
    if (!accRows.length) { await client.query('ROLLBACK'); return res.status(404).json({ error: 'House account not found' }) }
    const acc = accRows[0]
    if (acc.status !== 'active') { await client.query('ROLLBACK'); return res.status(400).json({ error: `Account is ${acc.status} — cannot charge` }) }

    const newBalance = parseFloat(acc.balance) + parseFloat(amount)

    await client.query(`UPDATE house_accounts SET balance = $1, updated_at = NOW() WHERE id = $2`, [newBalance, acc.id])

    const { rows: txRows } = await client.query(`
      INSERT INTO house_account_transactions
        (restaurant_id, account_id, order_id, type, amount, balance_after, description)
      VALUES ($1, $2, $3, 'charge', $4, $5, $6) RETURNING *
    `, [req.restaurantId, acc.id, orderId || null, amount, newBalance,
        description || (orderId ? `Order #${orderId}` : 'Manual charge')])

    if (orderId) {
      await client.query(
        `UPDATE orders SET payment_status = 'on_account', payment_method = 'House Account',
         status = 'Closed', updated_at = NOW() WHERE id = $1 AND restaurant_id = $2`,
        [orderId, req.restaurantId]
      )
    }

    await client.query('COMMIT')

    const limitWarning = acc.credit_limit > 0 && newBalance > parseFloat(acc.credit_limit)
      ? `Balance exceeds credit limit (${acc.credit_limit})` : null

    res.json({ transaction: fmtTx(txRows[0]), newBalance, limitWarning })
  } catch (err) {
    await client.query('ROLLBACK')
    next(err)
  } finally { client.release() }
}

// ─── POST /api/house-accounts/:id/manual-charge ──────────────────────────────
// Manual debt entry NOT linked to any order (e.g. cash borrowed, goods taken)
async function manualCharge(req, res, next) {
  const client = await pool.connect()
  try {
    await client.query('BEGIN')

    const { amount, description } = req.body
    if (!amount || amount <= 0) {
      await client.query('ROLLBACK')
      return res.status(400).json({ error: 'Amount must be positive' })
    }

    const { rows: accRows } = await client.query(
      `SELECT * FROM house_accounts WHERE id = $1 AND restaurant_id = $2 FOR UPDATE`,
      [req.params.id, req.restaurantId]
    )
    if (!accRows.length) { await client.query('ROLLBACK'); return res.status(404).json({ error: 'House account not found' }) }
    const acc = accRows[0]
    if (acc.status !== 'active') { await client.query('ROLLBACK'); return res.status(400).json({ error: `Account is ${acc.status} — cannot charge` }) }

    const newBalance = parseFloat(acc.balance) + parseFloat(amount)

    await client.query(`UPDATE house_accounts SET balance = $1, updated_at = NOW() WHERE id = $2`, [newBalance, acc.id])

    const { rows: txRows } = await client.query(`
      INSERT INTO house_account_transactions
        (restaurant_id, account_id, type, amount, balance_after, description)
      VALUES ($1, $2, 'charge', $3, $4, $5) RETURNING *
    `, [req.restaurantId, acc.id, amount, newBalance, description || 'Manual debt entry'])

    await client.query('COMMIT')

    const limitWarning = acc.credit_limit > 0 && newBalance > parseFloat(acc.credit_limit)
      ? `Balance exceeds credit limit (${acc.credit_limit})` : null

    res.json({ transaction: fmtTx(txRows[0]), newBalance, limitWarning })
  } catch (err) {
    await client.query('ROLLBACK')
    next(err)
  } finally { client.release() }
}

// ─── POST /api/house-accounts/:id/payment ────────────────────────────────────
async function recordPayment(req, res, next) {
  const client = await pool.connect()
  try {
    await client.query('BEGIN')

    const { amount, description } = req.body
    if (!amount || amount <= 0) {
      await client.query('ROLLBACK')
      return res.status(400).json({ error: 'Amount must be positive' })
    }

    const { rows: accRows } = await client.query(
      `SELECT * FROM house_accounts WHERE id = $1 AND restaurant_id = $2 FOR UPDATE`,
      [req.params.id, req.restaurantId]
    )
    if (!accRows.length) { await client.query('ROLLBACK'); return res.status(404).json({ error: 'House account not found' }) }
    const acc = accRows[0]

    const newBalance = Math.max(0, parseFloat(acc.balance) - parseFloat(amount))

    await client.query(`UPDATE house_accounts SET balance = $1, updated_at = NOW() WHERE id = $2`, [newBalance, acc.id])

    const { rows: txRows } = await client.query(`
      INSERT INTO house_account_transactions
        (restaurant_id, account_id, type, amount, balance_after, description)
      VALUES ($1, $2, 'payment', $3, $4, $5) RETURNING *
    `, [req.restaurantId, acc.id, amount, newBalance, description || 'Customer payment'])

    await client.query('COMMIT')

    res.json({ transaction: fmtTx(txRows[0]), newBalance })
  } catch (err) {
    await client.query('ROLLBACK')
    next(err)
  } finally { client.release() }
}

module.exports = {
  getAll, getOne, create, update,
  getTransactions, chargeOrder, manualCharge, recordPayment,
}
