const { query }           = require('../config/db')
const { checkValidation } = require('../middleware/errorHandler')

function fmtEntry(r) {
  return {
    id:         r.id,
    code:       r.code || `TTHD${String(r.id).padStart(6,'0')}`,
    type:       r.type,
    category:   r.category,
    amount:     parseFloat(r.amount),
    note:       r.note || '',
    createdBy:  r.created_by,
    status:     r.status,
    createdAt:  r.created_at,
  }
}

async function getAll(req, res, next) {
  try {
    const { type, status, search } = req.query
    let sql = 'SELECT * FROM cash_flow_entries WHERE 1=1'
    const params = []
    if (type) {
      params.push(type)
      sql += ` AND type=$${params.length}`
    }
    if (status) {
      params.push(status)
      sql += ` AND status=$${params.length}`
    }
    if (search) {
      params.push(`%${search}%`)
      sql += ` AND (note ILIKE $${params.length} OR category ILIKE $${params.length} OR code ILIKE $${params.length})`
    }
    sql += ' ORDER BY created_at DESC'
    const { rows } = await query(sql, params)

    // summary — all time for balance, today for opening/closing
    const summaryRes = await query(`
      SELECT
        COALESCE(SUM(amount) FILTER (WHERE type='income'  AND status='paid'), 0) AS total_income,
        COALESCE(SUM(amount) FILTER (WHERE type='expense' AND status='paid'), 0) AS total_expense,
        COALESCE(SUM(amount) FILTER (WHERE type='income'  AND status='paid' AND created_at::date < CURRENT_DATE), 0) AS prev_income,
        COALESCE(SUM(amount) FILTER (WHERE type='expense' AND status='paid' AND created_at::date < CURRENT_DATE), 0) AS prev_expense,
        COALESCE(SUM(amount) FILTER (WHERE type='income'  AND status='paid' AND created_at::date = CURRENT_DATE), 0) AS today_income,
        COALESCE(SUM(amount) FILTER (WHERE type='expense' AND status='paid' AND created_at::date = CURRENT_DATE), 0) AS today_expense
      FROM cash_flow_entries
    `)
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
  checkValidation(req)
  try {
    const { type, category, amount, note, createdBy } = req.body
    const { rows } = await query(
      `INSERT INTO cash_flow_entries (type,category,amount,note,created_by)
       VALUES ($1,$2,$3,$4,$5) RETURNING *`,
      [type, category||'Other', amount, note||'', createdBy||req.user?.name||'Admin']
    )
    // set auto code
    await query(`UPDATE cash_flow_entries SET code=$1 WHERE id=$2`,
      [`TTHD${String(rows[0].id).padStart(6,'0')}`, rows[0].id])
    const { rows: final } = await query('SELECT * FROM cash_flow_entries WHERE id=$1', [rows[0].id])
    res.status(201).json(fmtEntry(final[0]))
  } catch (err) { next(err) }
}

async function updateStatus(req, res, next) {
  try {
    const { status } = req.body
    if (!['paid','cancelled'].includes(status))
      return res.status(400).json({ error: 'Invalid status' })
    const { rows } = await query(
      'UPDATE cash_flow_entries SET status=$1 WHERE id=$2 RETURNING *',
      [status, req.params.id]
    )
    if (!rows.length) return res.status(404).json({ error: 'Entry not found' })
    res.json(fmtEntry(rows[0]))
  } catch (err) { next(err) }
}

async function remove(req, res, next) {
  try {
    const { rowCount } = await query('DELETE FROM cash_flow_entries WHERE id=$1', [req.params.id])
    if (!rowCount) return res.status(404).json({ error: 'Entry not found' })
    res.json({ success: true })
  } catch (err) { next(err) }
}

module.exports = { getAll, create, updateStatus, remove }
