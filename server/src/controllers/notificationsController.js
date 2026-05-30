'use strict'

const { query } = require('../config/db')

function fmt(r) {
  return {
    id:        r.id,
    type:      r.type,
    title:     r.title,
    body:      r.body,
    link:      r.link || '',
    urgent:    r.urgent,
    read:      r.read,
    createdAt: r.created_at,
  }
}

// GET /api/notifications
async function getAll(req, res, next) {
  try {
    const { rows } = await query(
      `SELECT * FROM notifications
       WHERE user_id = $1 AND restaurant_id = $2
       ORDER BY created_at DESC LIMIT 50`,
      [req.user.id, req.restaurantId]
    )
    res.json(rows.map(fmt))
  } catch (err) { next(err) }
}

// POST /api/notifications
async function create(req, res, next) {
  const { type, title, body, link, urgent } = req.body
  if (!type || !title || !body) {
    return res.status(400).json({ error: 'type, title, and body are required' })
  }
  try {
    const { rows } = await query(
      `INSERT INTO notifications (restaurant_id, user_id, type, title, body, link, urgent)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
      [req.restaurantId, req.user.id, type, title, body, link || '', urgent || false]
    )
    res.status(201).json(fmt(rows[0]))
  } catch (err) { next(err) }
}

// PATCH /api/notifications/mark-all-read
async function markAllRead(req, res, next) {
  try {
    await query(
      `UPDATE notifications SET read = TRUE
       WHERE user_id = $1 AND restaurant_id = $2 AND read = FALSE`,
      [req.user.id, req.restaurantId]
    )
    res.json({ ok: true })
  } catch (err) { next(err) }
}

// PATCH /api/notifications/:id/read
async function markRead(req, res, next) {
  try {
    const { rowCount } = await query(
      `UPDATE notifications SET read = TRUE
       WHERE id = $1 AND user_id = $2 AND restaurant_id = $3`,
      [req.params.id, req.user.id, req.restaurantId]
    )
    if (!rowCount) return res.status(404).json({ error: 'Notification not found' })
    res.json({ ok: true })
  } catch (err) { next(err) }
}

// DELETE /api/notifications
async function clearAll(req, res, next) {
  try {
    await query(
      `DELETE FROM notifications WHERE user_id = $1 AND restaurant_id = $2`,
      [req.user.id, req.restaurantId]
    )
    res.status(204).end()
  } catch (err) { next(err) }
}

module.exports = { getAll, create, markAllRead, markRead, clearAll }
