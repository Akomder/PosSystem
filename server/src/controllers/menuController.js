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
    imageUrl:       r.image_url || '',
    minStock:          r.min_stock ?? 0,
    maxStock:          r.max_stock ?? 9999,
    station:           r.station || 'Kitchen',
    stockQuantity:     r.stock_quantity != null ? parseFloat(r.stock_quantity) : null,
    lowStockThreshold: parseFloat(r.low_stock_threshold ?? 10),
    isPromotion:       r.is_promotion || false,
    promotionLabel:    r.promotion_label || null,
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
      `SELECT mc.id, mc.name, mc.sort_order AS "sortOrder", mc.color, mc.image_url AS "imageUrl",
              COUNT(mi.id)::int                                           AS total,
              COUNT(mi.id) FILTER (WHERE mi.available = TRUE)::int       AS available
       FROM menu_categories mc
       LEFT JOIN menu_items mi
         ON mi.restaurant_id = mc.restaurant_id AND mi.category = mc.name
       WHERE mc.restaurant_id = $1
       GROUP BY mc.id, mc.name, mc.sort_order, mc.color, mc.image_url
       ORDER BY mc.sort_order, mc.name`,
      [req.restaurantId]
    )
    res.json(rows)
  } catch (err) { next(err) }
}

// ─── POST /api/menu/categories ───────────────────────────────────────────────
async function createCategory(req, res, next) {
  const { name, color, imageUrl } = req.body
  if (!name?.trim()) return res.status(400).json({ error: 'Name is required' })
  try {
    const maxRow = await query(
      `SELECT COALESCE(MAX(sort_order), -1) + 1 AS next_order
       FROM menu_categories WHERE restaurant_id = $1`,
      [req.restaurantId]
    )
    const nextOrder = maxRow.rows[0].next_order
    const { rows } = await query(
      `INSERT INTO menu_categories (restaurant_id, name, sort_order, color, image_url)
       VALUES ($1, $2, $3, $4, $5) RETURNING id, name, sort_order AS "sortOrder", color, image_url AS "imageUrl"`,
      [req.restaurantId, name.trim(), nextOrder, color || '#14b8a6', imageUrl || '']
    )
    res.status(201).json({ ...rows[0], total: 0, available: 0 })
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ error: 'Category already exists' })
    next(err)
  }
}

// ─── PUT /api/menu/categories/:id ────────────────────────────────────────────
async function updateCategory(req, res, next) {
  const { name, color, imageUrl } = req.body
  const sets = [], params = []
  if (name?.trim())          { params.push(name.trim());  sets.push(`name = $${params.length}`) }
  if (color)                 { params.push(color);         sets.push(`color = $${params.length}`) }
  if (imageUrl !== undefined) { params.push(imageUrl || ''); sets.push(`image_url = $${params.length}`) }
  if (!sets.length) return res.status(400).json({ error: 'Nothing to update' })

  params.push(req.params.id, req.restaurantId)
  try {
    const old = await query(
      `SELECT name FROM menu_categories WHERE id = $1 AND restaurant_id = $2`,
      [req.params.id, req.restaurantId]
    )
    if (!old.rows.length) return res.status(404).json({ error: 'Category not found' })
    const oldName = old.rows[0].name

    await query(
      `UPDATE menu_categories SET ${sets.join(', ')} WHERE id = $${params.length - 1} AND restaurant_id = $${params.length}`,
      params
    )
    // Keep existing menu items in sync when renaming
    if (name?.trim() && name.trim() !== oldName) {
      await query(
        `UPDATE menu_items SET category = $1 WHERE category = $2 AND restaurant_id = $3`,
        [name.trim(), oldName, req.restaurantId]
      )
    }
    const { rows } = await query(
      `SELECT mc.id, mc.name, mc.sort_order AS "sortOrder", mc.color, mc.image_url AS "imageUrl",
              COUNT(mi.id)::int                                           AS total,
              COUNT(mi.id) FILTER (WHERE mi.available = TRUE)::int       AS available
       FROM menu_categories mc
       LEFT JOIN menu_items mi ON mi.restaurant_id = mc.restaurant_id AND mi.category = mc.name
       WHERE mc.id = $1 GROUP BY mc.id, mc.name, mc.sort_order, mc.color, mc.image_url`,
      [req.params.id]
    )
    res.json(rows[0])
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ error: 'Category name already exists' })
    next(err)
  }
}

// ─── DELETE /api/menu/categories/:id ─────────────────────────────────────────
async function deleteCategory(req, res, next) {
  try {
    const cat = await query(
      `SELECT name FROM menu_categories WHERE id = $1 AND restaurant_id = $2`,
      [req.params.id, req.restaurantId]
    )
    if (!cat.rows.length) return res.status(404).json({ error: 'Category not found' })
    const name = cat.rows[0].name

    const used = await query(
      `SELECT COUNT(*) FROM menu_items WHERE category = $1 AND restaurant_id = $2`,
      [name, req.restaurantId]
    )
    if (parseInt(used.rows[0].count) > 0) {
      return res.status(409).json({
        error: `Cannot delete — ${used.rows[0].count} item(s) still use this category. Move them first.`,
        count: parseInt(used.rows[0].count),
      })
    }
    await query(
      `DELETE FROM menu_categories WHERE id = $1 AND restaurant_id = $2`,
      [req.params.id, req.restaurantId]
    )
    res.status(204).end()
  } catch (err) { next(err) }
}

// ─── PATCH /api/menu/categories/reorder ──────────────────────────────────────
// Body: { order: [{ id, sortOrder }, ...] }
async function reorderCategories(req, res, next) {
  const { order } = req.body
  if (!Array.isArray(order) || !order.length) return res.status(400).json({ error: 'order array required' })
  try {
    for (const { id, sortOrder } of order) {
      await query(
        `UPDATE menu_categories SET sort_order = $1 WHERE id = $2 AND restaurant_id = $3`,
        [sortOrder, id, req.restaurantId]
      )
    }
    res.json({ ok: true })
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
          stockQuantity, lowStockThreshold, imageUrl, isPromotion, promotionLabel } = req.body
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

    // Keep the two stock fields in sync: if only one is supplied, mirror it to the other.
    const stockQtyVal = stockQuantity != null ? stockQuantity : (stock != null ? stock : null)
    const stockVal    = stock != null ? stock : (stockQuantity != null ? Math.round(stockQuantity) : 0)

    const ins = await query(
      `INSERT INTO menu_items
         (restaurant_id, name, category, price, description, tags, stock,
          product_code, cost_price, product_group, department, min_stock, max_stock, station,
          stock_quantity, low_stock_threshold, image_url, is_promotion, promotion_label)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19) RETURNING id`,
      [req.restaurantId, name, category, price, description || '', tags || [], stockVal,
       productCode || null, costPrice ?? 0, productGroup || '', department || '',
       minStock ?? 0, maxStock ?? 9999, station || 'Kitchen',
       stockQtyVal, lowStockThreshold ?? 10,
       imageUrl || '', isPromotion || false, promotionLabel || null]
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
    imageUrl: 'image_url',
    minStock: 'min_stock', maxStock: 'max_stock',
    station: 'station',
    stockQuantity: 'stock_quantity', lowStockThreshold: 'low_stock_threshold',
    isPromotion: 'is_promotion', promotionLabel: 'promotion_label',
  }
  // Mirror stock fields: editing one keeps the other in sync.
  const body = { ...req.body }
  if (body.stockQuantity !== undefined && body.stock === undefined && body.stockQuantity != null) {
    body.stock = Math.round(body.stockQuantity)
  } else if (body.stock !== undefined && body.stockQuantity === undefined) {
    body.stockQuantity = body.stock
  }

  const sets = [], params = []

  for (const [bodyKey, col] of Object.entries(bodyMap)) {
    if (body[bodyKey] !== undefined) {
      params.push(body[bodyKey])
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

// ─── PATCH /api/menu/:id/stock ───────────────────────────────────────────────
// Adjust stock quantity for a menu item (restock or shrinkage).
// Body: { adjustment: number, reason: string }
async function adjustStock(req, res, next) {
  try {
    const { adjustment, reason = '' } = req.body
    const adj = parseFloat(adjustment)
    if (isNaN(adj) || adj === 0) return res.status(400).json({ error: 'adjustment must be a non-zero number' })

    const rid = req.restaurantId

    // Fetch the item to know its current stock
    const existing = await query(
      'SELECT id, name, stock_quantity FROM menu_items WHERE id = $1 AND restaurant_id = $2',
      [req.params.id, rid]
    )
    if (!existing.rows.length) return res.status(404).json({ error: 'Menu item not found' })
    const item = existing.rows[0]

    // If stock_quantity was NULL, treat it as 0 before adjustment
    const currentQty = item.stock_quantity != null ? parseFloat(item.stock_quantity) : 0
    const newQty = Math.max(0, currentQty + adj)

    // Update both stock columns in sync
    await query(
      `UPDATE menu_items
         SET stock_quantity = $1,
             stock          = $2,
             available      = CASE WHEN $1 > 0 THEN TRUE ELSE available END
       WHERE id = $3 AND restaurant_id = $4`,
      [newQty, Math.round(newQty), req.params.id, rid]
    )

    // Log the adjustment
    await query(
      `INSERT INTO stock_adjustments (restaurant_id, menu_item_id, item_name, adjustment, reason, staff_name)
       VALUES ($1,$2,$3,$4,$5,$6)`,
      [rid, item.id, item.name, adj, reason, req.user?.name || '']
    )

    res.json({ id: item.id, name: item.name, stockQuantity: newQty, adjustment: adj })
  } catch (err) { next(err) }
}

// ─── GET /api/menu/stock/history?itemId=&limit= ───────────────────────────────
// Recent stock adjustment log for admin overview.
async function getStockHistory(req, res, next) {
  try {
    const { itemId, limit = 50 } = req.query
    let sql = `SELECT sa.id, sa.menu_item_id, sa.item_name, sa.adjustment, sa.reason, sa.staff_name, sa.created_at
               FROM stock_adjustments sa
               WHERE sa.restaurant_id = $1`
    const params = [req.restaurantId]
    if (itemId) { params.push(itemId); sql += ` AND sa.menu_item_id = $${params.length}` }
    sql += ` ORDER BY sa.created_at DESC LIMIT $${params.length + 1}`
    params.push(Math.min(parseInt(limit) || 50, 200))
    const { rows } = await query(sql, params)
    res.json(rows.map(r => ({
      id:         r.id,
      itemId:     r.menu_item_id,
      itemName:   r.item_name,
      adjustment: parseFloat(r.adjustment),
      reason:     r.reason,
      staffName:  r.staff_name,
      createdAt:  r.created_at,
    })))
  } catch (err) { next(err) }
}

module.exports = {
  getAllItems, getCategories, getItem, createItem, updateItem, toggleAvailability, deleteItem,
  createCategory, updateCategory, deleteCategory, reorderCategories,
  adjustStock, getStockHistory,
}
