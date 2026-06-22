const { query } = require('../config/db')

function fmt(r) {
  return {
    id:           r.id,
    title:        r.title,
    description:  r.description || null,
    imageUrl:     r.image_url   || null,
    price:        r.price !== null ? parseFloat(r.price) : null,
    active:       r.active,
    sortOrder:    r.sort_order,
    restaurantId: r.restaurant_id,
    createdAt:    r.created_at,
    updatedAt:    r.updated_at,
  }
}

async function getAll(req, res, next) {
  try {
    const { active } = req.query
    let sql = 'SELECT * FROM deals WHERE restaurant_id = $1'
    const params = [req.restaurantId]
    if (active !== undefined) { params.push(active === 'true'); sql += ` AND active = $${params.length}` }
    sql += ' ORDER BY sort_order ASC, created_at DESC'
    const { rows } = await query(sql, params)
    res.json(rows.map(fmt))
  } catch (err) { next(err) }
}

async function create(req, res, next) {
  const { title, description, imageUrl, price, active, sortOrder } = req.body
  if (!title?.trim()) return res.status(400).json({ error: 'title is required' })
  try {
    const { rows } = await query(
      `INSERT INTO deals (restaurant_id, title, description, image_url, price, active, sort_order)
       VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
      [req.restaurantId, title.trim(), description || null, imageUrl || null,
       price != null ? price : null, active !== false, sortOrder || 0]
    )
    res.status(201).json(fmt(rows[0]))
  } catch (err) { next(err) }
}

async function update(req, res, next) {
  const bodyMap = {
    title: 'title', description: 'description', imageUrl: 'image_url',
    price: 'price', active: 'active', sortOrder: 'sort_order',
  }
  const sets = [], params = []
  for (const [k, col] of Object.entries(bodyMap)) {
    if (req.body[k] !== undefined) { params.push(req.body[k]); sets.push(`${col} = $${params.length}`) }
  }
  if (!sets.length) return res.status(400).json({ error: 'Nothing to update' })
  params.push(req.params.id, req.restaurantId)
  try {
    const { rows } = await query(
      `UPDATE deals SET ${sets.join(', ')}, updated_at=NOW()
       WHERE id = $${params.length - 1} AND restaurant_id = $${params.length} RETURNING *`,
      params
    )
    if (!rows.length) return res.status(404).json({ error: 'Deal not found' })
    res.json(fmt(rows[0]))
  } catch (err) { next(err) }
}

async function remove(req, res, next) {
  try {
    const { rowCount } = await query(
      'DELETE FROM deals WHERE id = $1 AND restaurant_id = $2',
      [req.params.id, req.restaurantId]
    )
    if (!rowCount) return res.status(404).json({ error: 'Deal not found' })
    res.status(204).end()
  } catch (err) { next(err) }
}

// Public endpoint — no auth, used by QR customer page
async function getPublicDeals(req, res, next) {
  try {
    const { rows } = await query(
      `SELECT d.* FROM deals d
       JOIN restaurant_tables t ON t.restaurant_id = d.restaurant_id
       WHERE t.id = $1 AND d.active = true
       ORDER BY d.sort_order ASC, d.created_at DESC`,
      [req.params.tableId]
    )
    res.json(rows.map(fmt))
  } catch (err) { next(err) }
}

// Public endpoint by restaurant_id (for Sell page via authenticated call with active filter)
async function getPublicDealsByRestaurant(req, res, next) {
  try {
    const { rows } = await query(
      'SELECT * FROM deals WHERE restaurant_id = $1 AND active = true ORDER BY sort_order ASC, created_at DESC',
      [req.restaurantId]
    )
    res.json(rows.map(fmt))
  } catch (err) { next(err) }
}

module.exports = { getAll, create, update, remove, getPublicDeals, getPublicDealsByRestaurant }
