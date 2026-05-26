const { query, pool }     = require('../config/db')
const { checkValidation } = require('../middleware/errorHandler')

function fmt(r, items = []) {
  return {
    id:           r.id,
    name:         r.name,
    description:  r.description,
    validFrom:    r.valid_from,
    validTo:      r.valid_to,
    active:       r.active,
    restaurantId: r.restaurant_id,
    createdAt:    r.created_at,
    updatedAt:    r.updated_at,
    items:        items.map(i => ({
      id:          i.id,
      menuItemId:  i.menu_item_id,
      itemName:    i.item_name,
      originalPrice: parseFloat(i.original_price || 0),
      customPrice: parseFloat(i.custom_price),
    })),
  }
}

async function getAll(req, res, next) {
  try {
    const { rows } = await query(
      'SELECT * FROM price_books WHERE restaurant_id = $1 ORDER BY name',
      [req.restaurantId]
    )
    res.json(rows.map(r => fmt(r)))
  } catch (err) { next(err) }
}

async function getOne(req, res, next) {
  try {
    const { rows } = await query(
      'SELECT * FROM price_books WHERE id = $1 AND restaurant_id = $2',
      [req.params.id, req.restaurantId]
    )
    if (!rows.length) return res.status(404).json({ error: 'Price book not found' })

    const { rows: items } = await query(
      `SELECT pbi.*, m.name AS item_name, m.price AS original_price
       FROM price_book_items pbi
       JOIN menu_items m ON m.id = pbi.menu_item_id
       WHERE pbi.price_book_id = $1 ORDER BY m.name`,
      [req.params.id]
    )
    res.json(fmt(rows[0], items))
  } catch (err) { next(err) }
}

async function create(req, res, next) {
  if (!checkValidation(req, res)) return
  const { name, description, validFrom, validTo } = req.body
  try {
    const { rows } = await query(
      `INSERT INTO price_books (restaurant_id, name, description, valid_from, valid_to)
       VALUES ($1,$2,$3,$4,$5) RETURNING *`,
      [req.restaurantId, name, description || '', validFrom || null, validTo || null]
    )
    res.status(201).json(fmt(rows[0]))
  } catch (err) { next(err) }
}

async function update(req, res, next) {
  const bodyMap = { name: 'name', description: 'description', active: 'active',
                    validFrom: 'valid_from', validTo: 'valid_to' }
  const sets = [], params = []
  for (const [k, col] of Object.entries(bodyMap)) {
    if (req.body[k] !== undefined) { params.push(req.body[k]); sets.push(`${col} = $${params.length}`) }
  }
  if (!sets.length) return res.status(400).json({ error: 'Nothing to update' })
  params.push(req.params.id, req.restaurantId)
  try {
    const { rows } = await query(
      `UPDATE price_books SET ${sets.join(', ')}, updated_at=NOW()
       WHERE id = $${params.length - 1} AND restaurant_id = $${params.length} RETURNING *`,
      params
    )
    if (!rows.length) return res.status(404).json({ error: 'Price book not found' })
    res.json(fmt(rows[0]))
  } catch (err) { next(err) }
}

async function addItem(req, res, next) {
  const { menuItemId, customPrice } = req.body
  if (!menuItemId || customPrice === undefined) return res.status(400).json({ error: 'menuItemId and customPrice required' })
  try {
    const { rows } = await query(
      `INSERT INTO price_book_items (price_book_id, menu_item_id, custom_price)
       VALUES ($1,$2,$3) ON CONFLICT (price_book_id, menu_item_id)
       DO UPDATE SET custom_price = $3 RETURNING *`,
      [req.params.id, menuItemId, customPrice]
    )
    res.status(201).json(rows[0])
  } catch (err) { next(err) }
}

async function removeItem(req, res, next) {
  try {
    const { rowCount } = await query(
      'DELETE FROM price_book_items WHERE id = $1 AND price_book_id = $2',
      [req.params.itemId, req.params.id]
    )
    if (!rowCount) return res.status(404).json({ error: 'Item not found' })
    res.status(204).end()
  } catch (err) { next(err) }
}

async function remove(req, res, next) {
  try {
    const { rowCount } = await query(
      'DELETE FROM price_books WHERE id = $1 AND restaurant_id = $2',
      [req.params.id, req.restaurantId]
    )
    if (!rowCount) return res.status(404).json({ error: 'Price book not found' })
    res.status(204).end()
  } catch (err) { next(err) }
}

module.exports = { getAll, getOne, create, update, addItem, removeItem, remove }
