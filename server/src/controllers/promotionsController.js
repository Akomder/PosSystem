const { query }           = require('../config/db')
const { checkValidation } = require('../middleware/errorHandler')

function fmt(r) {
  return {
    id:            r.id,
    name:          r.name,
    type:          r.type,
    value:         parseFloat(r.value),
    minOrderValue: parseFloat(r.min_order_value),
    validFrom:     r.valid_from,
    validTo:       r.valid_to,
    active:        r.active,
    usageCount:    r.usage_count,
    usageLimit:    r.usage_limit,
    restaurantId:  r.restaurant_id,
    createdAt:     r.created_at,
    updatedAt:     r.updated_at,
  }
}

async function getAll(req, res, next) {
  try {
    const { active } = req.query
    let sql = 'SELECT * FROM promotions WHERE restaurant_id = $1'
    const params = [req.restaurantId]
    if (active !== undefined) { params.push(active === 'true'); sql += ` AND active = $${params.length}` }
    sql += ' ORDER BY name'
    const { rows } = await query(sql, params)
    res.json(rows.map(fmt))
  } catch (err) { next(err) }
}

async function getOne(req, res, next) {
  try {
    const { rows } = await query(
      'SELECT * FROM promotions WHERE id = $1 AND restaurant_id = $2',
      [req.params.id, req.restaurantId]
    )
    if (!rows.length) return res.status(404).json({ error: 'Promotion not found' })
    res.json(fmt(rows[0]))
  } catch (err) { next(err) }
}

async function create(req, res, next) {
  if (!checkValidation(req, res)) return
  const { name, type, value, minOrderValue, validFrom, validTo, usageLimit } = req.body
  try {
    const { rows } = await query(
      `INSERT INTO promotions (restaurant_id, name, type, value, min_order_value, valid_from, valid_to, usage_limit)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
      [req.restaurantId, name, type || 'percent', value || 0, minOrderValue || 0,
       validFrom || null, validTo || null, usageLimit || null]
    )
    res.status(201).json(fmt(rows[0]))
  } catch (err) { next(err) }
}

async function update(req, res, next) {
  const bodyMap = { name: 'name', type: 'type', value: 'value', active: 'active',
                    minOrderValue: 'min_order_value', validFrom: 'valid_from',
                    validTo: 'valid_to', usageLimit: 'usage_limit' }
  const sets = [], params = []
  for (const [k, col] of Object.entries(bodyMap)) {
    if (req.body[k] !== undefined) { params.push(req.body[k]); sets.push(`${col} = $${params.length}`) }
  }
  if (!sets.length) return res.status(400).json({ error: 'Nothing to update' })
  params.push(req.params.id, req.restaurantId)
  try {
    const { rows } = await query(
      `UPDATE promotions SET ${sets.join(', ')}, updated_at=NOW()
       WHERE id = $${params.length - 1} AND restaurant_id = $${params.length} RETURNING *`,
      params
    )
    if (!rows.length) return res.status(404).json({ error: 'Promotion not found' })
    res.json(fmt(rows[0]))
  } catch (err) { next(err) }
}

// Apply a promotion to an order total — returns discount amount
async function apply(req, res, next) {
  const { orderTotal } = req.body
  if (orderTotal === undefined) return res.status(400).json({ error: 'orderTotal required' })
  try {
    const { rows } = await query(
      `SELECT * FROM promotions
       WHERE id = $1 AND restaurant_id = $2 AND active = true
         AND (valid_from IS NULL OR valid_from <= CURRENT_DATE)
         AND (valid_to   IS NULL OR valid_to   >= CURRENT_DATE)
         AND (usage_limit IS NULL OR usage_count < usage_limit)`,
      [req.params.id, req.restaurantId]
    )
    if (!rows.length) return res.status(404).json({ error: 'Promotion not found or not applicable' })

    const promo = rows[0]
    if (parseFloat(orderTotal) < parseFloat(promo.min_order_value)) {
      return res.status(400).json({ error: `Minimum order value is ${promo.min_order_value}` })
    }

    let discount = 0
    if (promo.type === 'percent') discount = parseFloat(orderTotal) * parseFloat(promo.value) / 100
    else if (promo.type === 'fixed') discount = Math.min(parseFloat(promo.value), parseFloat(orderTotal))

    res.json({ discount: parseFloat(discount.toFixed(2)), promotion: fmt(promo) })
  } catch (err) { next(err) }
}

async function remove(req, res, next) {
  try {
    const { rowCount } = await query(
      'DELETE FROM promotions WHERE id = $1 AND restaurant_id = $2',
      [req.params.id, req.restaurantId]
    )
    if (!rowCount) return res.status(404).json({ error: 'Promotion not found' })
    res.status(204).end()
  } catch (err) { next(err) }
}

module.exports = { getAll, getOne, create, update, apply, remove }
