const { query }           = require('../config/db')
const { checkValidation } = require('../middleware/errorHandler')
const PLAN_LIMITS         = require('../config/planLimits')

// ─── format helper ────────────────────────────────────────────────────────────
function fmt(r) {
  return {
    id:             r.id,
    name:           r.name,
    category:       r.category,
    price:          parseFloat(r.price),
    description:    r.description,
    tags:           r.tags || [],
    available:      r.available,
    stock:          r.stock,
    prepTime:       r.prep_time,
    productCode:    r.product_code || '',
    costPrice:      parseFloat(r.cost_price || 0),
    productGroup:   r.product_group || '',
    department:     r.department || '',
    minStock:          r.min_stock ?? 0,
    maxStock:          r.max_stock ?? 9999,
    station:           r.station || 'Kitchen',
    stockQuantity:     r.stock_quantity != null ? parseFloat(r.stock_quantity) : null,
    lowStockThreshold: parseFloat(r.low_stock_threshold ?? 10),
    createdAt:         r.created_at,
    updatedAt:      r.updated_at,
    modifierGroups: (r.modifier_groups || []).map(g => ({
      id:            g.id,
      name:          g.name,
      selectionType: g.selection_type,
      required:      g.required,
      minSelections: g.min_selections,
      maxSelections: g.max_selections,
      options:       (g.options || []).map(o => ({
        id:              o.id,
        name:            o.name,
        priceAdjustment: parseFloat(o.price_adjustment || 0),
        available:       o.available,
      })),
    })),
  }
}

// ─── base query that includes modifier groups ─────────────────────────────────
const MENU_SELECT = `
  SELECT mi.*,
    COALESCE((
      SELECT json_agg(json_build_object(
        'id',             mg.id,
        'name',           mg.name,
        'selection_type', mg.selection_type,
        'required',       mg.required,
        'min_selections', mg.min_selections,
        'max_selections', mg.max_selections,
        'options', COALESCE((
          SELECT json_agg(json_build_object(
            'id',               mo.id,
            'name',             mo.name,
            'price_adjustment', mo.price_adjustment,
            'available',        mo.available
          ) ORDER BY mo.id)
          FROM modifier_options mo WHERE mo.group_id = mg.id
        ), '[]'::json)
      ) ORDER BY mimg.sort_order)
      FROM menu_item_modifier_groups mimg
      JOIN modifier_groups mg ON mg.id = mimg.modifier_group_id
      WHERE mimg.menu_item_id = mi.id
    ), '[]'::json) AS modifier_groups
  FROM menu_items mi
`

// ─── GET /api/menu ────────────────────────────────────────────────────────────
async function getAllItems(req, res, next) {
  try {
    const { category, available, search } = req.query
    const params = [req.restaurantId]
    let sql = `${MENU_SELECT} WHERE mi.restaurant_id = $1`

    if (category) {
      params.push(category)
      sql += ` AND mi.category = $${params.length}`
    }
    if (available !== undefined) {
      params.push(available === 'true')
      sql += ` AND mi.available = $${params.length}`
    }
    if (search) {
      params.push(`%${search}%`)
      sql += ` AND (mi.name ILIKE $${params.length} OR mi.description ILIKE $${params.length})`
    }
    sql += ' ORDER BY mi.category, mi.name'

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
       FROM menu_items WHERE restaurant_id = $1
       GROUP BY category ORDER BY category`,
      [req.restaurantId]
    )
    res.json(rows)
  } catch (err) { next(err) }
}

// ─── GET /api/menu/:id ────────────────────────────────────────────────────────
async function getItem(req, res, next) {
  try {
    const { rows } = await query(
      `${MENU_SELECT} WHERE mi.id = $1 AND mi.restaurant_id = $2`,
      [req.params.id, req.restaurantId]
    )
    if (!rows.length) return res.status(404).json({ error: 'Menu item not found' })
    res.json(fmt(rows[0]))
  } catch (err) { next(err) }
}

// ─── POST /api/menu ───────────────────────────────────────────────────────────
async function createItem(req, res, next) {
  if (!checkValidation(req, res)) return
  const { name, category, price, description, tags, stock,
          productCode, costPrice, productGroup, department, minStock, maxStock, station,
          stockQuantity, lowStockThreshold } = req.body
  try {
    // ── Plan limit check ────────────────────────────────────────────────────
    const rid = req.restaurantId
    if (rid) {
      const restRes = await query(`SELECT plan FROM restaurants WHERE id=$1`, [rid])
      const plan = restRes.rows[0]?.plan || 'basic'
      const limit = PLAN_LIMITS[plan]?.maxMenuItems ?? 50
      const countRes = await query(`SELECT COUNT(*) FROM menu_items WHERE restaurant_id=$1`, [rid])
      const current = parseInt(countRes.rows[0].count)
      if (current >= limit) {
        return res.status(403).json({
          error: `Plan limit reached. Your ${plan} plan allows up to ${limit} menu items. Upgrade to add more.`,
          limitType: 'menuItems', current, limit, plan,
        })
      }
    }

    const ins = await query(
      `INSERT INTO menu_items
         (restaurant_id, name, category, price, description, tags, stock,
          product_code, cost_price, product_group, department, min_stock, max_stock, station,
          stock_quantity, low_stock_threshold)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16) RETURNING id`,
      [req.restaurantId, name, category, price, description || '', tags || [], stock ?? 0,
       productCode || null, costPrice ?? 0, productGroup || '', department || '',
       minStock ?? 0, maxStock ?? 9999, station || 'Kitchen',
       stockQuantity != null ? stockQuantity : null, lowStockThreshold ?? 10]
    )
    const { rows } = await query(`${MENU_SELECT} WHERE mi.id = $1`, [ins.rows[0].id])
    res.status(201).json(fmt(rows[0]))
  } catch (err) { next(err) }
}

// ─── PUT /api/menu/:id ────────────────────────────────────────────────────────
async function updateItem(req, res, next) {
  if (!checkValidation(req, res)) return
  const bodyMap = {
    name: 'name', category: 'category', price: 'price',
    description: 'description', tags: 'tags', stock: 'stock', available: 'available',
    productCode: 'product_code', costPrice: 'cost_price',
    productGroup: 'product_group', department: 'department',
    minStock: 'min_stock', maxStock: 'max_stock',
    station: 'station',
    stockQuantity: 'stock_quantity', lowStockThreshold: 'low_stock_threshold',
  }
  const sets = [], params = []

  for (const [bodyKey, col] of Object.entries(bodyMap)) {
    if (req.body[bodyKey] !== undefined) {
      params.push(req.body[bodyKey])
      sets.push(`${col} = $${params.length}`)
    }
  }
  if (!sets.length) return res.status(400).json({ error: 'Nothing to update' })

  params.push(req.params.id, req.restaurantId)
  try {
    const upd = await query(
      `UPDATE menu_items SET ${sets.join(', ')}, updated_at = NOW()
       WHERE id = $${params.length - 1} AND restaurant_id = $${params.length} RETURNING id`,
      params
    )
    if (!upd.rows.length) return res.status(404).json({ error: 'Menu item not found' })
    const { rows } = await query(`${MENU_SELECT} WHERE mi.id = $1`, [upd.rows[0].id])
    res.json(fmt(rows[0]))
  } catch (err) { next(err) }
}

// ─── PATCH /api/menu/:id/availability ─────────────────────────────────────────
async function toggleAvailability(req, res, next) {
  try {
    const upd = await query(
      `UPDATE menu_items SET available = NOT available, updated_at = NOW()
       WHERE id = $1 AND restaurant_id = $2 RETURNING id`,
      [req.params.id, req.restaurantId]
    )
    if (!upd.rows.length) return res.status(404).json({ error: 'Menu item not found' })
    const { rows } = await query(`${MENU_SELECT} WHERE mi.id = $1`, [upd.rows[0].id])
    res.json(fmt(rows[0]))
  } catch (err) { next(err) }
}

// ─── DELETE /api/menu/:id ─────────────────────────────────────────────────────
async function deleteItem(req, res, next) {
  try {
    const { rowCount } = await query(
      'DELETE FROM menu_items WHERE id = $1 AND restaurant_id = $2',
      [req.params.id, req.restaurantId]
    )
    if (!rowCount) return res.status(404).json({ error: 'Menu item not found' })
    res.status(204).end()
  } catch (err) { next(err) }
}

module.exports = { getAllItems, getCategories, getItem, createItem, updateItem, toggleAvailability, deleteItem }
