const bcrypt   = require('bcryptjs')
const jwt      = require('jsonwebtoken')
const { query }          = require('../config/db')
const { checkValidation } = require('../middleware/errorHandler')

// ─── helpers ────────────────────────────────────────────────────────────────
function fmtUserId(n)  { return `USR-${String(n).padStart(3, '0')}` }
function fmtStaffId(n) { return `STF-${String(n).padStart(3, '0')}` }

function signAccess(payload) {
  return jwt.sign(payload, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '8h',
  })
}
function signRefresh(payload) {
  return jwt.sign(payload, process.env.JWT_REFRESH_SECRET, {
    expiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d',
  })
}

// ─── POST /api/auth/login ────────────────────────────────────────────────────
async function login(req, res, next) {
  if (!checkValidation(req, res)) return

  const { email, password } = req.body

  try {
    // 1. Find user
    const { rows } = await query(
      'SELECT * FROM users WHERE email = $1',
      [email.toLowerCase().trim()]
    )
    if (!rows.length) {
      return res.status(401).json({ error: 'Invalid email or password' })
    }
    const user = rows[0]

    // 2. Check password
    const match = await bcrypt.compare(password, user.password_hash)
    if (!match) {
      return res.status(401).json({ error: 'Invalid email or password' })
    }

    // 3. Get linked staff profile + restaurant plan (may not exist)
    const [staffRes, restRes] = await Promise.all([
      query('SELECT * FROM staff WHERE user_id = $1', [user.id]),
      user.restaurant_id
        ? query('SELECT plan FROM restaurants WHERE id = $1', [user.restaurant_id])
        : Promise.resolve({ rows: [] }),
    ])
    const staff          = staffRes.rows[0] || null
    const restaurantPlan = restRes.rows[0]?.plan || null

    // 4. Build JWT payload
    const payload = {
      id:             user.id,
      staffId:        staff ? staff.id : null,
      name:           staff ? staff.name : user.email,
      email:          user.email,
      role:           user.role,
      avatar:         staff ? staff.avatar : null,
      restaurantId:   user.restaurant_id || null,
      restaurantPlan,
      isSuperAdmin:   user.role === 'SuperAdmin',
    }

    const token        = signAccess(payload)
    const refreshToken = signRefresh({ id: user.id, email: user.email })

    // 5. Send response (shape matches frontend AuthContext expectations)
    res.json({
      token,
      refreshToken,
      user: {
        id:             fmtUserId(user.id),
        staffId:        staff ? fmtStaffId(staff.id) : null,
        name:           payload.name,
        email:          user.email,
        role:           user.role,
        avatar:         staff ? staff.avatar : null,
        restaurantId:   user.restaurant_id || null,
        restaurantPlan,
        isSuperAdmin:   user.role === 'SuperAdmin',
      },
    })
  } catch (err) {
    next(err)
  }
}

// ─── GET /api/auth/me ─────────────────────────────────────────────────────────
async function getMe(req, res, next) {
  try {
    const { rows } = await query(
      `SELECT u.id, u.email, u.role,
              s.id   AS staff_id,
              s.name AS staff_name,
              s.avatar,
              s.tables_assigned
       FROM users u
       LEFT JOIN staff s ON s.user_id = u.id
       WHERE u.id = $1`,
      [req.user.id]
    )
    if (!rows.length) {
      return res.status(404).json({ error: 'User not found' })
    }
    const r = rows[0]
    res.json({
      id:              fmtUserId(r.id),
      staffId:         r.staff_id ? fmtStaffId(r.staff_id) : null,
      name:            r.staff_name || r.email,
      email:           r.email,
      role:            r.role,
      avatar:          r.avatar,
      tablesAssigned:  r.tables_assigned || [],
    })
  } catch (err) {
    next(err)
  }
}

// ─── POST /api/auth/refresh ───────────────────────────────────────────────────
async function refresh(req, res, next) {
  const { refreshToken } = req.body
  if (!refreshToken) {
    return res.status(400).json({ error: 'refreshToken required' })
  }
  try {
    const decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET)
    const { rows } = await query(
      `SELECT u.id, u.email, u.role,
              s.id AS staff_id, s.name AS staff_name, s.avatar
       FROM users u
       LEFT JOIN staff s ON s.user_id = u.id
       WHERE u.id = $1`,
      [decoded.id]
    )
    if (!rows.length) return res.status(401).json({ error: 'User not found' })
    const r = rows[0]
    const payload = {
      id:      r.id,
      staffId: r.staff_id || null,
      name:    r.staff_name || r.email,
      email:   r.email,
      role:    r.role,
      avatar:  r.avatar || null,
    }
    res.json({ token: signAccess(payload) })
  } catch (err) {
    return res.status(401).json({ error: 'Invalid or expired refresh token' })
  }
}

// ─── PUT /api/auth/profile ────────────────────────────────────────────────────
async function updateProfile(req, res, next) {
  const { name } = req.body
  if (!name?.trim()) return res.status(400).json({ error: 'Name is required' })
  try {
    // Update the linked staff record's name
    const { rows } = await query(
      `UPDATE staff SET name = $1, updated_at = NOW()
       WHERE user_id = $2 RETURNING id, name`,
      [name.trim(), req.user.id]
    )
    if (!rows.length) return res.status(404).json({ error: 'Staff profile not found' })
    res.json({ name: rows[0].name })
  } catch (err) { next(err) }
}

// ─── POST /api/auth/change-password ──────────────────────────────────────────
async function changePassword(req, res, next) {
  const { currentPassword, newPassword } = req.body
  if (!currentPassword || !newPassword) {
    return res.status(400).json({ error: 'currentPassword and newPassword are required' })
  }
  if (newPassword.length < 6) {
    return res.status(400).json({ error: 'New password must be at least 6 characters' })
  }
  try {
    const { rows } = await query('SELECT password_hash FROM users WHERE id = $1', [req.user.id])
    if (!rows.length) return res.status(404).json({ error: 'User not found' })

    const match = await bcrypt.compare(currentPassword, rows[0].password_hash)
    if (!match) return res.status(401).json({ error: 'Current password is incorrect' })

    const hash = await bcrypt.hash(newPassword, 10)
    await query('UPDATE users SET password_hash = $1, updated_at = NOW() WHERE id = $2', [hash, req.user.id])
    res.json({ message: 'Password changed successfully' })
  } catch (err) { next(err) }
}

module.exports = { login, getMe, refresh, updateProfile, changePassword }
