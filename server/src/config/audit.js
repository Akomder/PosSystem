/**
 * audit.js
 * Reusable helper to write to the audit_log table.
 * Called after every mutating SuperAdmin operation.
 */
const { query } = require('./db')

/**
 * @param {number|null} actorId
 * @param {string}      actorEmail
 * @param {number|null} restaurantId
 * @param {string}      action        e.g. 'restaurant.created', 'staff.password_reset'
 * @param {string|null} targetType    e.g. 'restaurant', 'user', 'staff'
 * @param {number|null} targetId
 * @param {object}      details       extra JSONB context
 */
async function logAction(actorId, actorEmail, restaurantId, action, targetType = null, targetId = null, details = {}) {
  try {
    await query(
      `INSERT INTO audit_log (actor_id, actor_email, restaurant_id, action, target_type, target_id, details)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [actorId, actorEmail, restaurantId, action, targetType, targetId, JSON.stringify(details)]
    )
  } catch (err) {
    // Never crash the main request because of a logging failure
    console.error('[AuditLog] Failed to log action:', err.message)
  }
}

module.exports = { logAction }
