const { query }           = require('../config/db')
const { checkValidation } = require('../middleware/errorHandler')

// ─── Generic simple-settings CRUD factory ────────────────────────────────────
function makeSimpleCrud(table, fmtRow) {
  return {
    async getAll(req, res, next) {
      try {
        const { rows } = await query(
          `SELECT * FROM ${table} WHERE restaurant_id = $1 ORDER BY name`,
          [req.restaurantId]
        )
        res.json(rows.map(fmtRow))
      } catch (err) { next(err) }
    },

    async create(req, res, next) {
      if (!checkValidation(req, res)) return
      const { name } = req.body
      try {
        const { rows } = await query(
          `INSERT INTO ${table} (restaurant_id, name) VALUES ($1,$2) RETURNING *`,
          [req.restaurantId, name]
        )
        res.status(201).json(fmtRow(rows[0]))
      } catch (err) { next(err) }
    },

    async update(req, res, next) {
      const bodyMap = { name: 'name', active: 'active', text: 'text',
                        description: 'description', content: 'content', type: 'type' }
      const sets = [], params = []
      for (const [k, col] of Object.entries(bodyMap)) {
        if (req.body[k] !== undefined) { params.push(req.body[k]); sets.push(`${col} = $${params.length}`) }
      }
      if (!sets.length) return res.status(400).json({ error: 'Nothing to update' })
      params.push(req.params.id, req.restaurantId)
      try {
        const { rows } = await query(
          `UPDATE ${table} SET ${sets.join(', ')}, updated_at=NOW()
           WHERE id = $${params.length - 1} AND restaurant_id = $${params.length} RETURNING *`,
          params
        )
        if (!rows.length) return res.status(404).json({ error: 'Not found' })
        res.json(fmtRow(rows[0]))
      } catch (err) { next(err) }
    },

    async remove(req, res, next) {
      try {
        const { rowCount } = await query(
          `DELETE FROM ${table} WHERE id = $1 AND restaurant_id = $2`,
          [req.params.id, req.restaurantId]
        )
        if (!rowCount) return res.status(404).json({ error: 'Not found' })
        res.status(204).end()
      } catch (err) { next(err) }
    },
  }
}

// ─── Cancel Reasons ───────────────────────────────────────────────────────────
const cancelReasons = makeSimpleCrud('cancel_reasons', r => ({
  id: r.id, name: r.name, active: r.active,
  createdAt: r.created_at, updatedAt: r.updated_at,
}))

// ─── Note Templates ───────────────────────────────────────────────────────────
const noteTemplates = makeSimpleCrud('note_templates', r => ({
  id: r.id, name: r.name, text: r.text, active: r.active,
  createdAt: r.created_at, updatedAt: r.updated_at,
}))

// ─── Processing Sectors ───────────────────────────────────────────────────────
const processingSectors = makeSimpleCrud('processing_sectors', r => ({
  id: r.id, name: r.name, description: r.description, active: r.active,
  createdAt: r.created_at, updatedAt: r.updated_at,
}))

// ─── Print Templates ──────────────────────────────────────────────────────────
const printTemplates = makeSimpleCrud('print_templates', r => ({
  id: r.id, type: r.type, name: r.name, content: r.content, active: r.active,
  createdAt: r.created_at, updatedAt: r.updated_at,
}))

// ─── Store (restaurant) settings ─────────────────────────────────────────────

async function getStore(req, res, next) {
  try {
    const { rows } = await query(
      `SELECT name, phone, email, address, currency, logo_url, settings
       FROM restaurants WHERE id = $1`,
      [req.restaurantId]
    )
    if (!rows.length) return res.status(404).json({ error: 'Restaurant not found' })
    const r = rows[0]
    res.json({
      name:     r.name,
      phone:    r.phone,
      email:    r.email,
      address:  r.address,
      currency: r.currency,
      logoUrl:  r.logo_url,
      settings: r.settings || {},
    })
  } catch (err) { next(err) }
}

async function updateStore(req, res, next) {
  const { name, phone, email, address, currency, settings } = req.body
  const sets = [], params = []

  if (name     !== undefined) { params.push(name);                    sets.push(`name     = $${params.length}`) }
  if (phone    !== undefined) { params.push(phone);                   sets.push(`phone    = $${params.length}`) }
  if (email    !== undefined) { params.push(email);                   sets.push(`email    = $${params.length}`) }
  if (address  !== undefined) { params.push(address);                 sets.push(`address  = $${params.length}`) }
  if (currency !== undefined) { params.push(currency);                sets.push(`currency = $${params.length}`) }
  if (settings !== undefined) { params.push(JSON.stringify(settings)); sets.push(`settings = $${params.length}`) }

  if (!sets.length) return res.status(400).json({ error: 'Nothing to update' })
  params.push(req.restaurantId)

  try {
    const { rows } = await query(
      `UPDATE restaurants SET ${sets.join(', ')}, updated_at = NOW()
       WHERE id = $${params.length} RETURNING *`,
      params
    )
    if (!rows.length) return res.status(404).json({ error: 'Restaurant not found' })
    const r = rows[0]
    res.json({
      name:     r.name,
      phone:    r.phone,
      email:    r.email,
      address:  r.address,
      currency: r.currency,
      logoUrl:  r.logo_url,
      settings: r.settings || {},
    })
  } catch (err) { next(err) }
}

module.exports = { cancelReasons, noteTemplates, processingSectors, printTemplates, getStore, updateStore }
