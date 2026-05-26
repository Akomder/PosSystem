const { query } = require('../config/db')

// ─── format helpers ───────────────────────────────────────────────────────────
function fmtOption(r) {
  return {
    id:               r.id,
    name:             r.name,
    priceAdjustment:  parseFloat(r.price_adjustment || 0),
    available:        r.available,
  }
}

function fmtGroup(r) {
  return {
    id:             r.id,
    name:           r.name,
    selectionType:  r.selection_type,
    required:       r.required,
    minSelections:  r.min_selections,
    maxSelections:  r.max_selections,
    options:        (r.options || []).map(fmtOption),
    createdAt:      r.created_at,
  }
}

// ─── base query helper ────────────────────────────────────────────────────────
const GROUP_SELECT = `
  SELECT mg.*,
    COALESCE(
      json_agg(
        json_build_object(
          'id',               mo.id,
          'name',             mo.name,
          'price_adjustment', mo.price_adjustment,
          'available',        mo.available
        ) ORDER BY mo.id
      ) FILTER (WHERE mo.id IS NOT NULL),
    '[]'::json) AS options
  FROM modifier_groups mg
  LEFT JOIN modifier_options mo ON mo.group_id = mg.id
`

// ─── GET /api/modifiers/groups ────────────────────────────────────────────────
async function getGroups(req, res, next) {
  try {
    const { rows } = await query(
      `${GROUP_SELECT}
       WHERE mg.restaurant_id = $1
       GROUP BY mg.id
       ORDER BY mg.name`,
      [req.restaurantId]
    )
    res.json(rows.map(fmtGroup))
  } catch (err) { next(err) }
}

// ─── GET /api/modifiers/groups/:id ───────────────────────────────────────────
async function getGroup(req, res, next) {
  try {
    const { rows } = await query(
      `${GROUP_SELECT}
       WHERE mg.id = $1 AND mg.restaurant_id = $2
       GROUP BY mg.id`,
      [req.params.id, req.restaurantId]
    )
    if (!rows.length) return res.status(404).json({ error: 'Modifier group not found' })
    res.json(fmtGroup(rows[0]))
  } catch (err) { next(err) }
}

// ─── POST /api/modifiers/groups ───────────────────────────────────────────────
async function createGroup(req, res, next) {
  const { name, selectionType = 'single', required = false, minSelections = 0, maxSelections = 1 } = req.body
  if (!name) return res.status(400).json({ error: 'name is required' })
  try {
    const { rows } = await query(
      `INSERT INTO modifier_groups
         (restaurant_id, name, selection_type, required, min_selections, max_selections)
       VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
      [req.restaurantId, name, selectionType, required, minSelections, maxSelections]
    )
    // Return with empty options array
    res.status(201).json(fmtGroup({ ...rows[0], options: [] }))
  } catch (err) { next(err) }
}

// ─── PUT /api/modifiers/groups/:id ───────────────────────────────────────────
async function updateGroup(req, res, next) {
  const { name, selectionType, required, minSelections, maxSelections } = req.body
  const sets = [], params = []
  if (name           !== undefined) { params.push(name);           sets.push(`name=$${params.length}`) }
  if (selectionType  !== undefined) { params.push(selectionType);  sets.push(`selection_type=$${params.length}`) }
  if (required       !== undefined) { params.push(required);       sets.push(`required=$${params.length}`) }
  if (minSelections  !== undefined) { params.push(minSelections);  sets.push(`min_selections=$${params.length}`) }
  if (maxSelections  !== undefined) { params.push(maxSelections);  sets.push(`max_selections=$${params.length}`) }
  if (!sets.length) return res.status(400).json({ error: 'Nothing to update' })

  params.push(req.params.id, req.restaurantId)
  try {
    const { rows } = await query(
      `UPDATE modifier_groups SET ${sets.join(', ')}
       WHERE id=$${params.length - 1} AND restaurant_id=$${params.length} RETURNING *`,
      params
    )
    if (!rows.length) return res.status(404).json({ error: 'Modifier group not found' })

    // Fetch with options
    const full = await query(
      `${GROUP_SELECT} WHERE mg.id = $1 GROUP BY mg.id`, [rows[0].id]
    )
    res.json(fmtGroup(full.rows[0]))
  } catch (err) { next(err) }
}

// ─── DELETE /api/modifiers/groups/:id ────────────────────────────────────────
async function deleteGroup(req, res, next) {
  try {
    const { rowCount } = await query(
      'DELETE FROM modifier_groups WHERE id=$1 AND restaurant_id=$2',
      [req.params.id, req.restaurantId]
    )
    if (!rowCount) return res.status(404).json({ error: 'Modifier group not found' })
    res.status(204).end()
  } catch (err) { next(err) }
}

// ─── POST /api/modifiers/groups/:id/options ───────────────────────────────────
async function addOption(req, res, next) {
  const { name, priceAdjustment = 0, available = true } = req.body
  if (!name) return res.status(400).json({ error: 'name is required' })
  try {
    // Verify group belongs to this restaurant
    const gRes = await query(
      'SELECT id FROM modifier_groups WHERE id=$1 AND restaurant_id=$2',
      [req.params.id, req.restaurantId]
    )
    if (!gRes.rows.length) return res.status(404).json({ error: 'Modifier group not found' })

    const { rows } = await query(
      `INSERT INTO modifier_options (group_id, restaurant_id, name, price_adjustment, available)
       VALUES ($1,$2,$3,$4,$5) RETURNING *`,
      [req.params.id, req.restaurantId, name, priceAdjustment, available]
    )
    res.status(201).json(fmtOption(rows[0]))
  } catch (err) { next(err) }
}

// ─── PUT /api/modifiers/options/:id ──────────────────────────────────────────
async function updateOption(req, res, next) {
  const { name, priceAdjustment, available } = req.body
  const sets = [], params = []
  if (name             !== undefined) { params.push(name);            sets.push(`name=$${params.length}`) }
  if (priceAdjustment  !== undefined) { params.push(priceAdjustment); sets.push(`price_adjustment=$${params.length}`) }
  if (available        !== undefined) { params.push(available);       sets.push(`available=$${params.length}`) }
  if (!sets.length) return res.status(400).json({ error: 'Nothing to update' })

  params.push(req.params.id, req.restaurantId)
  try {
    const { rows } = await query(
      `UPDATE modifier_options SET ${sets.join(', ')}
       WHERE id=$${params.length - 1} AND restaurant_id=$${params.length} RETURNING *`,
      params
    )
    if (!rows.length) return res.status(404).json({ error: 'Modifier option not found' })
    res.json(fmtOption(rows[0]))
  } catch (err) { next(err) }
}

// ─── DELETE /api/modifiers/options/:id ───────────────────────────────────────
async function deleteOption(req, res, next) {
  try {
    const { rowCount } = await query(
      'DELETE FROM modifier_options WHERE id=$1 AND restaurant_id=$2',
      [req.params.id, req.restaurantId]
    )
    if (!rowCount) return res.status(404).json({ error: 'Modifier option not found' })
    res.status(204).end()
  } catch (err) { next(err) }
}

// ─── PUT /api/modifiers/menu-items/:menuItemId/groups ────────────────────────
// Replace the full set of modifier groups assigned to a menu item
async function setItemGroups(req, res, next) {
  const { groupIds = [] } = req.body   // array of modifier_group ids
  const menuItemId = req.params.menuItemId
  try {
    // Verify menu item belongs to restaurant
    const mRes = await query(
      'SELECT id FROM menu_items WHERE id=$1 AND restaurant_id=$2',
      [menuItemId, req.restaurantId]
    )
    if (!mRes.rows.length) return res.status(404).json({ error: 'Menu item not found' })

    // Replace assignment
    await query('DELETE FROM menu_item_modifier_groups WHERE menu_item_id=$1', [menuItemId])
    for (let i = 0; i < groupIds.length; i++) {
      await query(
        'INSERT INTO menu_item_modifier_groups (menu_item_id, modifier_group_id, sort_order) VALUES ($1,$2,$3)',
        [menuItemId, groupIds[i], i]
      )
    }
    res.json({ menuItemId: parseInt(menuItemId), groupIds })
  } catch (err) { next(err) }
}

module.exports = {
  getGroups, getGroup,
  createGroup, updateGroup, deleteGroup,
  addOption, updateOption, deleteOption,
  setItemGroups,
}
