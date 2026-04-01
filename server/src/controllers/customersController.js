const { query }           = require('../config/db')
const { checkValidation } = require('../middleware/errorHandler')

function fmtCustomer(r) {
  return {
    id:         `CUS-${String(r.id).padStart(3,'0')}`,
    rawId:      r.id,
    name:       r.name,
    phone:      r.phone || '',
    email:      r.email || '',
    groupName:  r.group_name,
    points:     r.points,
    totalSpent: parseFloat(r.total_spent || 0),
    notes:      r.notes || '',
    createdAt:  r.created_at,
  }
}

async function getAll(req, res, next) {
  try {
    const { search, group } = req.query
    let sql = 'SELECT * FROM customers WHERE 1=1'
    const params = []
    if (search) {
      params.push(`%${search}%`)
      sql += ` AND (name ILIKE $${params.length} OR phone ILIKE $${params.length} OR email ILIKE $${params.length})`
    }
    if (group) {
      params.push(group)
      sql += ` AND group_name = $${params.length}`
    }
    sql += ' ORDER BY created_at DESC'
    const { rows } = await query(sql, params)
    res.json(rows.map(fmtCustomer))
  } catch (err) { next(err) }
}

async function getOne(req, res, next) {
  try {
    const { rows } = await query('SELECT * FROM customers WHERE id = $1', [req.params.id])
    if (!rows.length) return res.status(404).json({ error: 'Customer not found' })
    res.json(fmtCustomer(rows[0]))
  } catch (err) { next(err) }
}

async function create(req, res, next) {
  checkValidation(req)
  try {
    const { name, phone, email, groupName, notes } = req.body
    const { rows } = await query(
      `INSERT INTO customers (name, phone, email, group_name, notes)
       VALUES ($1,$2,$3,$4,$5) RETURNING *`,
      [name, phone||null, email||null, groupName||'General', notes||'']
    )
    res.status(201).json(fmtCustomer(rows[0]))
  } catch (err) { next(err) }
}

async function update(req, res, next) {
  checkValidation(req)
  try {
    const { name, phone, email, groupName, notes, points } = req.body
    const { rows } = await query(
      `UPDATE customers SET name=$1,phone=$2,email=$3,group_name=$4,notes=$5,
       points=COALESCE($6,points), updated_at=NOW()
       WHERE id=$7 RETURNING *`,
      [name, phone||null, email||null, groupName||'General', notes||'', points??null, req.params.id]
    )
    if (!rows.length) return res.status(404).json({ error: 'Customer not found' })
    res.json(fmtCustomer(rows[0]))
  } catch (err) { next(err) }
}

async function remove(req, res, next) {
  try {
    const { rowCount } = await query('DELETE FROM customers WHERE id=$1', [req.params.id])
    if (!rowCount) return res.status(404).json({ error: 'Customer not found' })
    res.json({ success: true })
  } catch (err) { next(err) }
}

module.exports = { getAll, getOne, create, update, remove }
