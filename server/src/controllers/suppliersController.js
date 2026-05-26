const { query }           = require('../config/db')
const { checkValidation } = require('../middleware/errorHandler')

function fmtSupplier(r) {
  return {
    id:        r.id,
    name:      r.name,
    contact:   r.contact || '',
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
    const params = [req.restaurantId]
    let sql = 'SELECT * FROM suppliers WHERE restaurant_id = $1'
    if (search) {
      params.push(`%${search}%`)
      sql += ` AND (name ILIKE $${params.length} OR phone ILIKE $${params.length} OR email ILIKE $${params.length})`
    }
    sql += ' ORDER BY name'
    const { rows } = await query(sql, params)
    res.json(rows.map(fmtSupplier))
  } catch (err) { next(err) }
}

async function getOne(req, res, next) {
  try {
    const { rows } = await query(
      'SELECT * FROM suppliers WHERE id=$1 AND restaurant_id=$2',
      [req.params.id, req.restaurantId]
    )
    if (!rows.length) return res.status(404).json({ error: 'Supplier not found' })
    res.json(fmtSupplier(rows[0]))
  } catch (err) { next(err) }
}

async function create(req, res, next) {
  if (!checkValidation(req, res)) return
  try {
    const { name, contact, phone, email, address, notes } = req.body
    const { rows } = await query(
      `INSERT INTO suppliers (restaurant_id, name, contact, phone, email, address, notes)
       VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
      [req.restaurantId, name, contact || '', phone || null, email || null,
       address || '', notes || '']
    )
    res.status(201).json(fmtSupplier(rows[0]))
  } catch (err) { next(err) }
}

async function update(req, res, next) {
  if (!checkValidation(req, res)) return
  try {
    const { name, contact, phone, email, address, notes } = req.body
    const { rows } = await query(
      `UPDATE suppliers SET name=$1, contact=$2, phone=$3, email=$4,
       address=$5, notes=$6, updated_at=NOW()
       WHERE id=$7 AND restaurant_id=$8 RETURNING *`,
      [name, contact || '', phone || null, email || null,
       address || '', notes || '', req.params.id, req.restaurantId]
    )
    if (!rows.length) return res.status(404).json({ error: 'Supplier not found' })
    res.json(fmtSupplier(rows[0]))
  } catch (err) { next(err) }
}

async function remove(req, res, next) {
  try {
    const { rowCount } = await query(
      'DELETE FROM suppliers WHERE id=$1 AND restaurant_id=$2',
      [req.params.id, req.restaurantId]
    )
    if (!rowCount) return res.status(404).json({ error: 'Supplier not found' })
    res.status(204).end()
  } catch (err) { next(err) }
}

module.exports = { getAll, getOne, create, update, remove }
