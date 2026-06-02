const bcrypt              = require('bcryptjs')
const { query, pool }     = require('../config/db')
const { checkValidation } = require('../middleware/errorHandler')
const emailService        = require('../services/emailService')
const PLAN_LIMITS         = require('../config/planLimits')

// ─── format helpers ───────────────────────────────────────────────────────────
function fmtStaffId(n) { return `STF-${String(n).padStart(3, '0')}` }
function fmtUserId(n)  { return n ? `USR-${String(n).padStart(3, '0')}` : null }

function fmt(r) {
  return {
    id:             fmtStaffId(r.id),
    name:           r.name,
    role:           r.role,
    email:          r.email || null,       // from users join
    avatar:         r.avatar,
    tablesAssigned: r.tables_assigned || [],
    userId:         fmtUserId(r.user_id),
    createdAt:      r.created_at,
    updatedAt:      r.updated_at,
  }
}

// ─── GET /api/staff ───────────────────────────────────────────────────────────
async function getAllStaff(req, res, next) {
  try {
    const { role } = req.query
    const rid = req.restaurantId
    let sql = `
      SELECT s.*, u.email
      FROM staff s
      LEFT JOIN users u ON u.id = s.user_id
      WHERE 1=1
    `
    const params = []
    if (rid)  { params.push(rid);  sql += ` AND s.restaurant_id = $${params.length}` }
    if (role) { params.push(role); sql += ` AND s.role = $${params.length}` }
    sql += ' ORDER BY s.name'
    const { rows } = await query(sql, params)
    res.json(rows.map(fmt))
  } catch (err) { next(err) }
}

// ─── GET /api/staff/:id ───────────────────────────────────────────────────────
async function getStaffMember(req, res, next) {
  try {
    const rawId = parseInt(String(req.params.id).replace('STF-', ''), 10)
    const { rows } = await query(
      `SELECT s.*, u.email FROM staff s LEFT JOIN users u ON u.id = s.user_id WHERE s.id = $1`,
      [rawId]
    )
    if (!rows.length) return res.status(404).json({ error: 'Staff member not found' })
    res.json(fmt(rows[0]))
  } catch (err) { next(err) }
}

// ─── POST /api/staff ──────────────────────────────────────────────────────────
async function createStaff(req, res, next) {
  if (!checkValidation(req, res)) return
  const { name, role, email, avatar, password } = req.body

  const client = await pool.connect()
  try {
    await client.query('BEGIN')

    const rid = req.restaurantId || null

    // ── Plan limit check ────────────────────────────────────────────────────
    if (rid) {
      const restRes = await client.query(`SELECT plan FROM restaurants WHERE id=$1`, [rid])
      const plan = restRes.rows[0]?.plan || 'basic'
      const limit = PLAN_LIMITS[plan]?.maxStaff ?? 5
      const countRes = await client.query(`SELECT COUNT(*) FROM staff WHERE restaurant_id=$1`, [rid])
      const current = parseInt(countRes.rows[0].count)
      if (current >= limit) {
        await client.query('ROLLBACK')
        return res.status(403).json({
          error: `Plan limit reached. Your ${plan} plan allows up to ${limit} staff members. Upgrade to add more.`,
          limitType: 'staff', current, limit, plan,
        })
      }
    }

    if (!password) {
      await client.query('ROLLBACK')
      return res.status(400).json({ error: 'Password is required' })
    }
    const hash = await bcrypt.hash(password, 10)
    const userRes = await client.query(
      `INSERT INTO users (email, password_hash, role, restaurant_id) VALUES ($1, $2, $3, $4) RETURNING id`,
      [email.toLowerCase(), hash, role, rid]
    )
    const userId = userRes.rows[0].id

    const staffRes = await client.query(
      `INSERT INTO staff (name, role, avatar, user_id, restaurant_id) VALUES ($1,$2,$3,$4,$5) RETURNING *`,
      [name, role, avatar || null, userId, rid]
    )
    await client.query('COMMIT')

    const staff = { ...staffRes.rows[0], email }

    // Send welcome email asynchronously (don't block response)
    if (email) {
      const loginUrl = `${process.env.APP_URL || 'http://localhost:5173'}/login`
      // Fetch restaurant name for the email
      let restaurantName = 'the restaurant'
      if (rid) {
        const rRes = await query('SELECT name FROM restaurants WHERE id = $1', [rid]).catch(() => ({ rows: [] }))
        if (rRes.rows[0]) restaurantName = rRes.rows[0].name
      }
      emailService.sendStaffWelcome({
        to:             email,
        name,
        role,
        password:       password,
        restaurantName,
        loginUrl,
      }).catch(err => console.error('Staff welcome email failed:', err.message))
    }

    res.status(201).json(fmt(staff))
  } catch (err) {
    await client.query('ROLLBACK')
    next(err)
  } finally {
    client.release()
  }
}

// ─── PUT /api/staff/:id ───────────────────────────────────────────────────────
async function updateStaff(req, res, next) {
  if (!checkValidation(req, res)) return
  const rawId = parseInt(String(req.params.id).replace('STF-', ''), 10)
  const { name, role, status, avatar, tablesAssigned } = req.body

  const staffSets = [], staffParams = []
  if (name           !== undefined) { staffParams.push(name);           staffSets.push(`name = $${staffParams.length}`) }
  if (role           !== undefined) { staffParams.push(role);           staffSets.push(`role = $${staffParams.length}`) }
  if (status         !== undefined) { staffParams.push(status);         staffSets.push(`status = $${staffParams.length}`) }
  if (avatar         !== undefined) { staffParams.push(avatar);         staffSets.push(`avatar = $${staffParams.length}`) }
  if (tablesAssigned !== undefined) { staffParams.push(tablesAssigned); staffSets.push(`tables_assigned = $${staffParams.length}`) }

  if (!staffSets.length) return res.status(400).json({ error: 'Nothing to update' })

  const client = await pool.connect()
  try {
    await client.query('BEGIN')

    staffParams.push(rawId)
    const { rows } = await client.query(
      `UPDATE staff SET ${staffSets.join(', ')}, updated_at = NOW()
       WHERE id = $${staffParams.length} RETURNING *`,
      staffParams
    )
    if (!rows.length) {
      await client.query('ROLLBACK')
      return res.status(404).json({ error: 'Staff member not found' })
    }

    // Keep users table in sync for role changes (auth reads role from users)
    if (role !== undefined && rows[0].user_id) {
      await client.query(
        `UPDATE users SET role = $1, updated_at = NOW() WHERE id = $2`,
        [role, rows[0].user_id]
      )
    }

    await client.query('COMMIT')

    const full = await query(
      `SELECT s.*, u.email FROM staff s LEFT JOIN users u ON u.id = s.user_id WHERE s.id = $1`,
      [rows[0].id]
    )
    res.json(fmt(full.rows[0]))
  } catch (err) {
    await client.query('ROLLBACK')
    next(err)
  } finally {
    client.release()
  }
}

// ─── DELETE /api/staff/:id ────────────────────────────────────────────────────
async function deleteStaff(req, res, next) {
  try {
    const rawId = parseInt(String(req.params.id).replace('STF-', ''), 10)
    const { rowCount } = await query('DELETE FROM staff WHERE id = $1', [rawId])
    if (!rowCount) return res.status(404).json({ error: 'Staff member not found' })
    res.status(204).end()
  } catch (err) { next(err) }
}

module.exports = { getAllStaff, getStaffMember, createStaff, updateStaff, deleteStaff }
