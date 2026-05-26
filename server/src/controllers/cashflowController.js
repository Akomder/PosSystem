const { query }           = require('../config/db')
const { checkValidation } = require('../middleware/errorHandler')

function fmtEntry(r) {
  return {
    id:         r.id,
    type:       r.type,
    category:   r.category,
    amount:     parseFloat(r.amount),
    description: r.description || '',
    reference:  r.reference || '',
    status:     r.status,
    createdAt:  r.created_at,
  }
}

async function getAll(req, res, next) {
  try {
    const { type, status, search } = req.query
    const params = [req.restaurantId]
    let sql = 'SELECT * FROM cash_flow_entries WHERE restaurant_id = $1'
    if (type) {
      params.push(type)
      sql += ` AND type = $${params.length}`
    }
    if (status) {
      params.push(status)
      sql += ` AND status = $${params.length}`
    }
    if (search) {
      params.push(`%${search}%`)
      sql += ` AND (description ILIKE $${params.length} OR category ILIKE $${params.length} OR reference ILIKE $${params.length})`
    }
    sql += ' ORDER BY created_at DESC'
    const { rows } = await query(sql, params)

    // Summary scoped to this restaurant
    const summaryRes = await query(`
      SELECT
        COALESCE(SUM(amount) FILTER (WHERE type='income'  AND status='paid'), 0) AS total_income,
        COALESCE(SUM(amount) FILTER (WHERE type='expense' AND status='paid'), 0) AS total_expense,
        COALESCE(SUM(amount) FILTER (WHERE type='income'  AND status='paid' AND created_at::date < CURRENT_DATE), 0) AS prev_income,
        COALESCE(SUM(amount) FILTER (WHERE type='expense' AND status='paid' AND created_at::date < CURRENT_DATE), 0) AS prev_expense,
        COALESCE(SUM(amount) FILTER (WHERE type='income'  AND status='paid' AND created_at::date = CURRENT_DATE), 0) AS today_income,
        COALESCE(SUM(amount) FILTER (WHERE type='expense' AND status='paid' AND created_at::date = CURRENT_DATE), 0) AS today_expense
      FROM cash_flow_entries
      WHERE restaurant_id = $1
    `, [req.restaurantId])

    const s = summaryRes.rows[0]
    const totalIncome    = parseFloat(s.total_income)
    const totalExpense   = parseFloat(s.total_expense)
    const openingBalance = parseFloat(s.prev_income) - parseFloat(s.prev_expense)
    const todayIn        = parseFloat(s.today_income)
    const todayOut       = parseFloat(s.today_expense)

    res.json({
      entries: rows.map(fmtEntry),
      summary: {
        totalIncome,
        totalExpense,
        balance:        totalIncome - totalExpense,
        openingBalance,
        closingBalance: openingBalance + todayIn - todayOut,
        todayIncome:    todayIn,
        todayExpense:   todayOut,
      },
    })
  } catch (err) { next(err) }
}

async function create(req, res, next) {
  if (!checkValidation(req, res)) return
  try {
    const { type, category, amount, description, reference } = req.body
    const { rows } = await query(
      `INSERT INTO cash_flow_entries (restaurant_id, type, category, amount, description, reference)
       VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
      [req.restaurantId, type, category || 'Other', amount,
       description || '', reference || '']
    )
    res.status(201).json(fmtEntry(rows[0]))
  } catch (err) { next(err) }
}

async function updateStatus(req, res, next) {
  try {
    const { status } = req.body
    if (!['paid', 'pending'].includes(status))
      return res.status(400).json({ error: 'Invalid status' })
    const { rows } = await query(
      'UPDATE cash_flow_entries SET status=$1, updated_at=NOW() WHERE id=$2 AND restaurant_id=$3 RETURNING *',
      [status, req.params.id, req.restaurantId]
    )
    if (!rows.length) return res.status(404).json({ error: 'Entry not found' })
    res.json(fmtEntry(rows[0]))
  } catch (err) { next(err) }
}

async function remove(req, res, next) {
  try {
    const { rowCount } = await query(
      'DELETE FROM cash_flow_entries WHERE id=$1 AND restaurant_id=$2',
      [req.params.id, req.restaurantId]
    )
    if (!rowCount) return res.status(404).json({ error: 'Entry not found' })
    res.status(204).end()
  } catch (err) { next(err) }
}

module.exports = { getAll, create, updateStatus, remove }
