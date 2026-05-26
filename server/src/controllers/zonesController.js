const { query }           = require('../config/db')
const { checkValidation } = require('../middleware/errorHandler')

function fmt(r) {
  return {
    id:           r.id,
    name:         r.name,
    description:  r.description,
    color:        r.color,
    restaurantId: r.restaurant_id,
    createdAt:    r.created_at,
    updatedAt:    r.updated_at,
  }
}

async function getAll(req, res, next) {
  try {
    const { rows } = await query(
      'SELECT * FROM table_zones WHERE restaurant_id = $1 ORDER BY name',
      [req.restaurantId]
    )
    res.json(rows.map(fmt))
  } catch (err) { next(err) }
}

async function getOne(req, res, next) {
  try {
    const { rows } = await query(
      'SELECT * FROM table_zones WHERE id = $1 AND restaurant_id = $2',
      [req.params.id, req.restaurantId]
    )
    if (!rows.length) return res.status(404).json({ error: 'Zone not found' })
    res.json(fmt(rows[0]))
  } catch (err) { next(err) }
}

async function create(req, res, next) {
  if (!checkValidation(req, res)) return
  const { name, description, color } = req.body
  try {
    const { rows } = await query(
      `INSERT INTO table_zones (restaurant_id, name, description, color)
       VALUES ($1,$2,$3,$4) RETURNING *`,
      [req.restaurantId, name, description || '', color || '#6366F1']
    )
    res.status(201).json(fmt(rows[0]))
  } catch (err) { next(err) }
}

async function update(req, res, next) {
  if (!checkValidation(req, res)) return
  const bodyMap = { name: 'name', description: 'description', color: 'color' }
  const sets = [], params = []
  for (const [k, col] of Object.entries(bodyMap)) {
    if (req.body[k] !== undefined) { params.push(req.body[k]); sets.push(`${col} = $${params.length}`) }
  }
  if (!sets.length) return res.status(400).json({ error: 'Nothing to update' })
  params.push(req.params.id, req.restaurantId)
  try {
    const { rows } = await query(
      `UPDATE table_zones SET ${sets.join(', ')}, updated_at = NOW()
       WHERE id = $${params.length - 1} AND restaurant_id = $${params.length} RETURNING *`,
      params
    )
    if (!rows.length) return res.status(404).json({ error: 'Zone not found' })
    res.json(fmt(rows[0]))
  } catch (err) { next(err) }
}

async function remove(req, res, next) {
  try {
    const { rowCount } = await query(
      'DELETE FROM table_zones WHERE id = $1 AND restaurant_id = $2',
      [req.params.id, req.restaurantId]
    )
    if (!rowCount) return res.status(404).json({ error: 'Zone not found' })
    res.status(204).end()
  } catch (err) { next(err) }
}

module.exports = { getAll, getOne, create, update, remove }
