const { query }           = require('../config/db')
const { checkValidation } = require('../middleware/errorHandler')

function fmtSupplier(r) {
  return {
    id:        `SUP-${String(r.id).padStart(3,'0')}`,
    rawId:     r.id,
    name:      r.name,
    phone:     r.phone || '',
    email:     r.email || '',
    address:   r.address || '',
    notes:     r.notes || '',
    createdAt: r.created_at,
  }
}

async function getAll(req, res, next) {
  try {
    const { search } = req.query
    let sql = 'SELECT * FROM suppliers WHERE 1=1'
    const params = []
    if (search) {
      params.push(`%${search}%`)
      sql += ` AND (name ILIKE $1 OR phone ILIKE $1 OR email ILIKE $1)`
    }
    sql += ' ORDER BY created_at DESC'
    const { rows } = await query(sql, params)
    res.json(rows.map(fmtSupplier))
  } catch (err) { next(err) }
}

async function getOne(req, res, next) {
  try {
    const { rows } = await query('SELECT * FROM suppliers WHERE id=$1', [req.params.id])
    if (!rows.length) return res.status(404).json({ error: 'Supplier not found' })
    res.json(fmtSupplier(rows[0]))
  } catch (err) { next(err) }
}

async function create(req, res, next) {
  checkValidation(req)
  try {
    const { name, phone, email, address, notes } = req.body
    const { rows } = await query(
      `INSERT INTO suppliers (name,phone,email,address,notes)
       VALUES ($1,$2,$3,$4,$5) RETURNING *`,
      [name, phone||null, email||null, address||'', notes||'']
    )
    res.status(201).json(fmtSupplier(rows[0]))
  } catch (err) { next(err) }
}

async function update(req, res, next) {
  checkValidation(req)
  try {
    const { name, phone, email, address, notes } = req.body
    const { rows } = await query(
      `UPDATE suppliers SET name=$1,phone=$2,email=$3,address=$4,notes=$5,updated_at=NOW()
       WHERE id=$6 RETURNING *`,
      [name, phone||null, email||null, address||'', notes||'', req.params.id]
    )
    if (!rows.length) return res.status(404).json({ error: 'Supplier not found' })
    res.json(fmtSupplier(rows[0]))
  } catch (err) { next(err) }
}

async function remove(req, res, next) {
  try {
    const { rowCount } = await query('DELETE FROM suppliers WHERE id=$1', [req.params.id])
    if (!rowCount) return res.status(404).json({ error: 'Supplier not found' })
    res.json({ success: true })
  } catch (err) { next(err) }
}

module.exports = { getAll, getOne, create, update, remove }
