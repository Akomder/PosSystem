const { query }           = require('../config/db')
const { checkValidation } = require('../middleware/errorHandler')

// ─── format helper ────────────────────────────────────────────────────────────
function fmtId(n) { return `MI-${String(n).padStart(3, '0')}` }

function fmt(r) {
  return {
    id:          fmtId(r.id),
    name:        r.name,
    category:    r.category,
    price:       parseFloat(r.price),
    description: r.description,
    tags:        r.tags || [],
    available:   r.available,
    stock:       r.stock,
    prepTime:    r.prep_time,
    createdAt:   r.created_at,
    updatedAt:   r.updated_at,
  }
}

// ─── GET /api/menu ────────────────────────────────────────────────────────────
async function getAllItems(req, res, next) {
  try {
    const { category, available, search } = req.query
    let sql = 'SELECT * FROM menu_items WHERE 1=1'
    const params = []

    if (category)  { params.push(category);       sql += ` AND category = $${params.length}` }
    if (available !== undefined) {
      params.push(available === 'true')
      sql += ` AND available = $${params.length}`
    }
    if (search) {
      params.push(`%${search}%`)
      sql += ` AND (name ILIKE $${params.length} OR description ILIKE $${params.length})`
    }
    sql += ' ORDER BY category, name'

    const { rows } = await query(sql, params)
    res.json(rows.map(fmt))
  } catch (err) { next(err) }
}

// ─── GET /api/menu/categories ────────────────────────────────────────────────
async function getCategories(req, res, next) {
  try {
    const { rows } = await query(
      `SELECT category, COUNT(*) AS total,
              SUM(CASE WHEN available THEN 1 ELSE 0 END) AS available
       FROM menu_items GROUP BY category ORDER BY category`
    )
    res.json(rows)
  } catch (err) { next(err) }
}

// ─── GET /api/menu/:id ────────────────────────────────────────────────────────
async function getItem(req, res, next) {
  try {
    const { rows } = await query('SELECT * FROM menu_items WHERE id = $1', [req.params.id])
    if (!rows.length) return res.status(404).json({ error: 'Menu item not found' })
    res.json(fmt(rows[0]))
  } catch (err) { next(err) }
}

// ─── POST /api/menu ───────────────────────────────────────────────────────────
async function createItem(req, res, next) {
  if (!checkValidation(req, res)) return
  const { name, category, price, description, tags, stock } = req.body
  try {
    const { rows } = await query(
      `INSERT INTO menu_items (name, category, price, description, tags, stock)
       VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
      [name, category, price, description || '', tags || [], stock ?? 0]
    )
    res.status(201).json(fmt(rows[0]))
  } catch (err) { next(err) }
}

// ─── PUT /api/menu/:id ────────────────────────────────────────────────────────
async function updateItem(req, res, next) {
  if (!checkValidation(req, res)) return
  const bodyMap = { name: 'name', category: 'category', price: 'price',
                    description: 'description', tags: 'tags', stock: 'stock', available: 'available' }
  const sets = [], params = []

  for (const [bodyKey, col] of Object.entries(bodyMap)) {
    if (req.body[bodyKey] !== undefined) {
      params.push(req.body[bodyKey])
      sets.push(`${col} = $${params.length}`)
    }
  }
  if (!sets.length) return res.status(400).json({ error: 'Nothing to update' })

  params.push(req.params.id)
  try {
    const { rows } = await query(
      `UPDATE menu_items SET ${sets.join(', ')}, updated_at = NOW()
       WHERE id = $${params.length} RETURNING *`,
      params
    )
    if (!rows.length) return res.status(404).json({ error: 'Menu item not found' })
    res.json(fmt(rows[0]))
  } catch (err) { next(err) }
}

// ─── PATCH /api/menu/:id/availability ─────────────────────────────────────────
async function toggleAvailability(req, res, next) {
  try {
    const { rows } = await query(
      `UPDATE menu_items SET available = NOT available, updated_at = NOW()
       WHERE id = $1 RETURNING *`,
      [req.params.id]
    )
    if (!rows.length) return res.status(404).json({ error: 'Menu item not found' })
    res.json(fmt(rows[0]))
  } catch (err) { next(err) }
}

// ─── DELETE /api/menu/:id ─────────────────────────────────────────────────────
async function deleteItem(req, res, next) {
  try {
    const { rowCount } = await query('DELETE FROM menu_items WHERE id = $1', [req.params.id])
    if (!rowCount) return res.status(404).json({ error: 'Menu item not found' })
    res.status(204).end()
  } catch (err) { next(err) }
}

module.exports = { getAllItems, getCategories, getItem, createItem, updateItem, toggleAvailability, deleteItem }
