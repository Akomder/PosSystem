const { query }           = require('../config/db')
const { checkValidation } = require('../middleware/errorHandler')

function fmtCustomer(r) {
  return {
    id:         r.id,
    name:       r.name,
    phone:      r.phone || '',
    email:      r.email || '',
    address:    r.address || '',
    groupName:  r.group_name || 'General',
    points:     r.loyalty_pts ?? 0,
    totalSpent: parseFloat(r.total_spent || 0),
    notes:      r.notes || '',
    createdAt:  r.created_at,
  }
}

async function getAll(req, res, next) {
  try {
    const { search, group } = req.query
    const params = [req.restaurantId]
    let sql = `
      SELECT c.*,
        COALESCE((
          SELECT SUM(o.total) FROM orders o
          WHERE o.customer_id = c.id AND o.status = 'Closed'
        ), 0) AS total_spent
      FROM customers c
      WHERE c.restaurant_id = $1
    `
    if (search) {
      params.push(`%${search}%`)
      sql += ` AND (c.name ILIKE $${params.length} OR c.phone ILIKE $${params.length} OR c.email ILIKE $${params.length})`
    }
    if (group) {
      params.push(group)
      sql += ` AND c.group_name = $${params.length}`
    }
    sql += ' ORDER BY c.created_at DESC'
    const { rows } = await query(sql, params)
    res.json(rows.map(fmtCustomer))
  } catch (err) { next(err) }
}

async function getOne(req, res, next) {
  try {
    const { rows } = await query(`
      SELECT c.*,
        COALESCE((
          SELECT SUM(o.total) FROM orders o
          WHERE o.customer_id = c.id AND o.status = 'Closed'
        ), 0) AS total_spent
      FROM customers c
      WHERE c.id = $1 AND c.restaurant_id = $2
    `, [req.params.id, req.restaurantId])
    if (!rows.length) return res.status(404).json({ error: 'Customer not found' })
    res.json(fmtCustomer(rows[0]))
  } catch (err) { next(err) }
}

async function create(req, res, next) {
  if (!checkValidation(req, res)) return
  try {
    const { name, phone, email, groupName, address, notes } = req.body
    const { rows } = await query(
      `INSERT INTO customers (restaurant_id, name, phone, email, group_name, address, notes)
       VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
      [req.restaurantId, name, phone || null, email || null,
       groupName || 'General', address || '', notes || '']
    )
    res.status(201).json(fmtCustomer({ ...rows[0], total_spent: 0 }))
  } catch (err) { next(err) }
}

async function update(req, res, next) {
  if (!checkValidation(req, res)) return
  try {
    const { name, phone, email, groupName, address, notes, points } = req.body
    const { rows } = await query(
      `UPDATE customers
       SET name=$1, phone=$2, email=$3, group_name=$4, address=$5, notes=$6,
           loyalty_pts=COALESCE($7, loyalty_pts), updated_at=NOW()
       WHERE id=$8 AND restaurant_id=$9 RETURNING *`,
      [name, phone || null, email || null, groupName || 'General',
       address || '', notes || '', points ?? null, req.params.id, req.restaurantId]
    )
    if (!rows.length) return res.status(404).json({ error: 'Customer not found' })
    res.json(fmtCustomer({ ...rows[0], total_spent: 0 }))
  } catch (err) { next(err) }
}

async function remove(req, res, next) {
  try {
    const { rowCount } = await query(
      'DELETE FROM customers WHERE id=$1 AND restaurant_id=$2',
      [req.params.id, req.restaurantId]
    )
    if (!rowCount) return res.status(404).json({ error: 'Customer not found' })
    res.status(204).end()
  } catch (err) { next(err) }
}

module.exports = { getAll, getOne, create, update, remove }
