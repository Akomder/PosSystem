const { query } = require('../config/db')

function fmt(r) {
  return {
    id:           r.id,
    userId:       r.user_id,
    userName:     r.user_name,
    action:       r.action,
    entityType:   r.entity_type,
    entityId:     r.entity_id,
    oldData:      r.old_data,
    newData:      r.new_data,
    ipAddress:    r.ip_address,
    restaurantId: r.restaurant_id,
    createdAt:    r.created_at,
  }
}

async function getAll(req, res, next) {
  try {
    const { entityType, userId, limit = 200, offset = 0 } = req.query
    let sql = 'SELECT * FROM audit_logs WHERE restaurant_id = $1'
    const params = [req.restaurantId]
    if (entityType) { params.push(entityType); sql += ` AND entity_type = $${params.length}` }
    if (userId)     { params.push(userId);     sql += ` AND user_id = $${params.length}` }
    sql += ` ORDER BY created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`
    params.push(parseInt(limit), parseInt(offset))
    const { rows } = await query(sql, params)
    res.json(rows.map(fmt))
  } catch (err) { next(err) }
}

// Helper: log an action (called from other controllers or middleware)
async function log({ restaurantId, userId, userName, action, entityType, entityId, oldData, newData, ipAddress }) {
  try {
    await query(
      `INSERT INTO audit_logs (restaurant_id, user_id, user_name, action, entity_type, entity_id, old_data, new_data, ip_address)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
      [restaurantId, userId || null, userName || '', action, entityType || '',
       entityId ? String(entityId) : '', oldData || null, newData || null, ipAddress || '']
    )
  } catch (_) { /* non-fatal */ }
}

module.exports = { getAll, log }
