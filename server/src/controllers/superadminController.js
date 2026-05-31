const bcrypt  = require('bcryptjs')
const { query, pool } = require('../config/db')
const emailService = require('../services/emailService')
const { logAction } = require('../config/audit')

// ─── helpers ──────────────────────────────────────────────────────────────────
function fmtRestId(n) { return `REST-${String(n).padStart(3, '0')}` }

function fmtRestaurant(r) {
  return {
    id:             fmtRestId(r.id),
    rawId:          r.id,
    name:           r.name,
    slug:           r.slug || '',
    address:        r.address || '',
    phone:          r.phone  || '',
    email:          r.email  || '',
    logoUrl:        r.logo_url || null,
    plan:           r.plan,
    status:         r.status,
    taxRate:        parseFloat(r.tax_rate  || 0.10),
    currency:       r.currency || 'LAK',
    staffCount:     parseInt(r.staff_count  || 0),
    tablesCount:    parseInt(r.tables_count || 0),
    todayRevenue:   parseFloat(r.today_revenue  || 0),
    todayOrders:    parseInt(r.today_orders     || 0),
    monthlyRevenue: parseFloat(r.monthly_revenue || 0),
    activeOrders:   parseInt(r.active_orders    || 0),
    createdAt:      r.created_at,
  }
}

// ─── GET /api/superadmin/overview ────────────────────────────────────────────
async function getOverview(req, res, next) {
  try {
    const [statsRes, revenueByRestRes, recentOrdersRes, weeklyRes] = await Promise.all([
      // Cross-restaurant aggregate stats
      query(`
        SELECT
          (SELECT COUNT(*) FROM restaurants)                                           AS total_restaurants,
          (SELECT COUNT(*) FROM restaurants WHERE status='active')                     AS active_restaurants,
          (SELECT COALESCE(SUM(total),0) FROM orders
            WHERE status='Closed' AND created_at::date=CURRENT_DATE)                  AS today_revenue,
          (SELECT COUNT(*) FROM orders
            WHERE created_at::date=CURRENT_DATE)                                      AS today_orders,
          (SELECT COUNT(*) FROM orders
            WHERE status IN ('Pending','In Progress','Served'))                       AS active_orders,
          (SELECT COALESCE(SUM(total),0) FROM orders
            WHERE status='Closed'
            AND date_trunc('month',created_at)=date_trunc('month',CURRENT_DATE))      AS monthly_revenue,
          (SELECT COUNT(*) FROM staff)                                                 AS total_staff
      `),

      // Revenue per restaurant (last 7 days)
      query(`
        SELECT
          r.name,
          r.id,
          COALESCE(SUM(o.total),0)  AS revenue,
          COUNT(o.id)               AS orders
        FROM restaurants r
        LEFT JOIN orders o
          ON o.restaurant_id = r.id
          AND o.status = 'Closed'
          AND o.created_at >= CURRENT_DATE - INTERVAL '6 days'
        GROUP BY r.id, r.name
        ORDER BY revenue DESC
      `),

      // Recent 15 orders across all restaurants
      query(`
        SELECT o.id, o.table_number, o.waiter, o.status, o.total, o.created_at,
               r.name AS restaurant_name
        FROM orders o
        LEFT JOIN restaurants r ON r.id = o.restaurant_id
        ORDER BY o.created_at DESC
        LIMIT 15
      `),

      // Weekly revenue (last 7 days) across all restaurants
      query(`
        SELECT
          to_char(d::date,'Dy') AS day,
          d::date               AS date,
          COALESCE(SUM(o.total),0) AS revenue,
          COUNT(o.id)           AS orders
        FROM generate_series(
          CURRENT_DATE - INTERVAL '6 days',
          CURRENT_DATE,
          '1 day'
        ) AS d
        LEFT JOIN orders o
          ON o.created_at::date = d::date AND o.status='Closed'
        GROUP BY d ORDER BY d
      `),
    ])

    const s = statsRes.rows[0]
    res.json({
      stats: {
        totalRestaurants:  parseInt(s.total_restaurants),
        activeRestaurants: parseInt(s.active_restaurants),
        todayRevenue:      parseFloat(s.today_revenue),
        todayOrders:       parseInt(s.today_orders),
        activeOrders:      parseInt(s.active_orders),
        monthlyRevenue:    parseFloat(s.monthly_revenue),
        totalStaff:        parseInt(s.total_staff),
      },
      revenueByRestaurant: revenueByRestRes.rows.map(r => ({
        name:    r.name,
        revenue: parseFloat(r.revenue),
        orders:  parseInt(r.orders),
      })),
      recentOrders: recentOrdersRes.rows.map(r => ({
        id:             `ORD-${String(r.id).padStart(3,'0')}`,
        tableNumber:    r.table_number,
        waiter:         r.waiter,
        status:         r.status,
        total:          parseFloat(r.total),
        restaurantName: r.restaurant_name,
        createdAt:      r.created_at,
      })),
      weeklyRevenue: weeklyRes.rows.map(r => ({
        day:     r.day,
        date:    r.date,
        revenue: parseFloat(r.revenue),
        orders:  parseInt(r.orders),
      })),
    })
  } catch (err) { next(err) }
}

// ─── GET /api/superadmin/restaurants ─────────────────────────────────────────
async function getRestaurants(req, res, next) {
  try {
    const { search, status, plan } = req.query
    let sql = `
      SELECT r.*,
        (SELECT COUNT(*) FROM staff   s WHERE s.restaurant_id = r.id) AS staff_count,
        (SELECT COUNT(*) FROM restaurant_tables t WHERE t.restaurant_id = r.id) AS tables_count,
        (SELECT COALESCE(SUM(o.total),0) FROM orders o
          WHERE o.restaurant_id=r.id AND o.status='Closed'
          AND o.created_at::date=CURRENT_DATE) AS today_revenue,
        (SELECT COUNT(*) FROM orders o
          WHERE o.restaurant_id=r.id
          AND o.created_at::date=CURRENT_DATE) AS today_orders,
        (SELECT COALESCE(SUM(o.total),0) FROM orders o
          WHERE o.restaurant_id=r.id AND o.status='Closed'
          AND date_trunc('month',o.created_at)=date_trunc('month',CURRENT_DATE)) AS monthly_revenue,
        (SELECT COUNT(*) FROM orders o
          WHERE o.restaurant_id=r.id
          AND o.status IN ('Pending','In Progress','Served')) AS active_orders
      FROM restaurants r WHERE 1=1
    `
    const params = []
    if (search) { params.push(`%${search}%`); sql += ` AND r.name ILIKE $${params.length}` }
    if (status) { params.push(status);         sql += ` AND r.status = $${params.length}` }
    if (plan)   { params.push(plan);           sql += ` AND r.plan = $${params.length}` }
    sql += ' ORDER BY r.name'

    const { rows } = await query(sql, params)
    res.json(rows.map(fmtRestaurant))
  } catch (err) { next(err) }
}

// ─── GET /api/superadmin/restaurants/:id ─────────────────────────────────────
async function getRestaurant(req, res, next) {
  try {
    const { rows } = await query(`
      SELECT r.*,
        (SELECT COUNT(*) FROM staff   s WHERE s.restaurant_id = r.id) AS staff_count,
        (SELECT COUNT(*) FROM restaurant_tables t WHERE t.restaurant_id = r.id) AS tables_count,
        (SELECT COALESCE(SUM(o.total),0) FROM orders o
          WHERE o.restaurant_id=r.id AND o.status='Closed'
          AND o.created_at::date=CURRENT_DATE) AS today_revenue,
        (SELECT COUNT(*) FROM orders o
          WHERE o.restaurant_id=r.id
          AND o.created_at::date=CURRENT_DATE) AS today_orders,
        (SELECT COALESCE(SUM(o.total),0) FROM orders o
          WHERE o.restaurant_id=r.id AND o.status='Closed'
          AND date_trunc('month',o.created_at)=date_trunc('month',CURRENT_DATE)) AS monthly_revenue,
        (SELECT COUNT(*) FROM orders o
          WHERE o.restaurant_id=r.id
          AND o.status IN ('Pending','In Progress','Served')) AS active_orders
      FROM restaurants r WHERE r.id = $1
    `, [req.params.id])

    if (!rows.length) return res.status(404).json({ error: 'Restaurant not found' })

    // Recent orders + staff for detail view
    const [ordersRes, staffRes, weeklyRes] = await Promise.all([
      query(`
        SELECT id, table_number, waiter, status, total, created_at
        FROM orders WHERE restaurant_id=$1
        ORDER BY created_at DESC LIMIT 10
      `, [req.params.id]),
      query(`
        SELECT s.*, u.email FROM staff s
        LEFT JOIN users u ON u.id = s.user_id
        WHERE s.restaurant_id=$1 ORDER BY s.name
      `, [req.params.id]),
      query(`
        SELECT to_char(d::date,'Dy') AS day, d::date AS date,
               COALESCE(SUM(o.total),0) AS revenue, COUNT(o.id) AS orders
        FROM generate_series(CURRENT_DATE-INTERVAL '6 days', CURRENT_DATE, '1 day') AS d
        LEFT JOIN orders o
          ON o.created_at::date=d::date AND o.status='Closed' AND o.restaurant_id=$1
        GROUP BY d ORDER BY d
      `, [req.params.id]),
    ])

    res.json({
      restaurant: fmtRestaurant(rows[0]),
      recentOrders: ordersRes.rows.map(r => ({
        id:          `ORD-${String(r.id).padStart(3,'0')}`,
        tableNumber: r.table_number,
        waiter:      r.waiter,
        status:      r.status,
        total:       parseFloat(r.total),
        createdAt:   r.created_at,
      })),
      staff: staffRes.rows.map(s => ({
        id:    `STF-${String(s.id).padStart(3,'0')}`,
        name:  s.name,
        role:  s.role,
        email: s.email || '',
      })),
      weeklyRevenue: weeklyRes.rows.map(r => ({
        day:     r.day,
        date:    r.date,
        revenue: parseFloat(r.revenue),
        orders:  parseInt(r.orders),
      })),
    })
  } catch (err) { next(err) }
}

// ─── POST /api/superadmin/restaurants ────────────────────────────────────────
async function createRestaurant(req, res, next) {
  const { name, address='', phone='', email='', plan='basic', currency='LAK', taxRate=0.10, adminEmail, adminPassword, adminName } = req.body
  if (!name) return res.status(400).json({ error: 'name is required' })
  if (!adminEmail || !adminPassword || !adminName) return res.status(400).json({ error: 'adminName, adminEmail, and adminPassword are required' })

  const slug = name.toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/(^-|-$)/g,'')
  const client = await pool.connect()
  try {
    await client.query('BEGIN')

    // Create restaurant
    const restRes = await client.query(
      `INSERT INTO restaurants (name,slug,address,phone,email,plan,currency,tax_rate)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
      [name, slug, address, phone, email||'', plan, currency, taxRate]
    )
    const rest = restRes.rows[0]

    // Create admin user for this restaurant (required)
    const hash = await bcrypt.hash(adminPassword, 10)
    const userRes = await client.query(
      `INSERT INTO users (email, password_hash, role, restaurant_id)
       VALUES ($1,$2,'Admin',$3) RETURNING id`,
      [adminEmail.toLowerCase(), hash, rest.id]
    )
    await client.query(
      `INSERT INTO staff (name, role, user_id, restaurant_id) VALUES ($1,'Admin',$2,$3)`,
      [adminName, userRes.rows[0].id, rest.id]
    )

    await client.query('COMMIT')

    // Audit log
    logAction(req.user?.id, req.user?.email, rest.id, 'restaurant.created', 'restaurant', rest.id, { name, plan, adminEmail })

    // Send welcome email to restaurant admin (async, don't block)
    const tenantLoginUrl = `${process.env.APP_URL || 'http://localhost:5173'}/${slug}`
    emailService.sendRestaurantWelcome({
      to:             adminEmail,
      adminName,
      restaurantName: name,
      plan,
      password:       adminPassword,
      loginUrl:       tenantLoginUrl,
    }).catch(err => console.error('Restaurant welcome email failed:', err.message))

    // Return restaurant + admin credentials so UI can display them
    res.status(201).json({
      ...fmtRestaurant({ ...rest, staff_count:0, tables_count:0, today_revenue:0, today_orders:0, monthly_revenue:0, active_orders:0 }),
      adminCredentials: { name: adminName, email: adminEmail, loginUrl: tenantLoginUrl },
    })
  } catch (err) {
    await client.query('ROLLBACK')
    next(err)
  } finally { client.release() }
}

// ─── PUT /api/superadmin/restaurants/:id ─────────────────────────────────────
async function updateRestaurant(req, res, next) {
  const { name, address, phone, email, plan, currency, taxRate, status, logoUrl } = req.body
  const sets = [], params = []

  if (name     !== undefined) { params.push(name);      sets.push(`name=$${params.length}`) }
  if (address  !== undefined) { params.push(address);   sets.push(`address=$${params.length}`) }
  if (phone    !== undefined) { params.push(phone);     sets.push(`phone=$${params.length}`) }
  if (email    !== undefined) { params.push(email);     sets.push(`email=$${params.length}`) }
  if (plan     !== undefined) { params.push(plan);      sets.push(`plan=$${params.length}`) }
  if (currency !== undefined) { params.push(currency);  sets.push(`currency=$${params.length}`) }
  if (taxRate  !== undefined) { params.push(taxRate);   sets.push(`tax_rate=$${params.length}`) }
  if (status   !== undefined) { params.push(status);    sets.push(`status=$${params.length}`) }
  if (logoUrl  !== undefined) { params.push(logoUrl);   sets.push(`logo_url=$${params.length}`) }

  if (!sets.length) return res.status(400).json({ error: 'Nothing to update' })
  params.push(req.params.id)

  try {
    const { rows } = await query(
      `UPDATE restaurants SET ${sets.join(',')}, updated_at=NOW()
       WHERE id=$${params.length} RETURNING *`,
      params
    )
    if (!rows.length) return res.status(404).json({ error: 'Restaurant not found' })
    logAction(req.user?.id, req.user?.email, parseInt(req.params.id), 'restaurant.updated', 'restaurant', parseInt(req.params.id), req.body)
    res.json(fmtRestaurant({ ...rows[0], staff_count:0, tables_count:0, today_revenue:0, today_orders:0, monthly_revenue:0, active_orders:0 }))
  } catch (err) { next(err) }
}

// ─── PATCH /api/superadmin/restaurants/:id/status ────────────────────────────
async function toggleStatus(req, res, next) {
  const { status } = req.body
  const VALID = ['active','suspended','inactive']
  if (!VALID.includes(status)) return res.status(400).json({ error: `status must be: ${VALID.join(', ')}` })
  try {
    const { rows } = await query(
      `UPDATE restaurants SET status=$1, updated_at=NOW() WHERE id=$2 RETURNING *`,
      [status, req.params.id]
    )
    if (!rows.length) return res.status(404).json({ error: 'Restaurant not found' })
    logAction(req.user?.id, req.user?.email, parseInt(req.params.id), 'restaurant.status_changed', 'restaurant', parseInt(req.params.id), { status })
    res.json(fmtRestaurant({ ...rows[0], staff_count:0, tables_count:0, today_revenue:0, today_orders:0, monthly_revenue:0, active_orders:0 }))
  } catch (err) { next(err) }
}

// ─── DELETE /api/superadmin/restaurants/:id ───────────────────────────────────
async function deleteRestaurant(req, res, next) {
  try {
    // prevent deleting the last restaurant
    const countRes = await query(`SELECT COUNT(*) FROM restaurants`)
    if (parseInt(countRes.rows[0].count) <= 1) {
      return res.status(400).json({ error: 'Cannot delete the last restaurant' })
    }
    const { rowCount, rows: delRows } = await query(`DELETE FROM restaurants WHERE id=$1 RETURNING name`, [req.params.id])
    if (!rowCount) return res.status(404).json({ error: 'Restaurant not found' })
    logAction(req.user?.id, req.user?.email, null, 'restaurant.deleted', 'restaurant', parseInt(req.params.id), { name: delRows[0]?.name })
    res.status(204).end()
  } catch (err) { next(err) }
}

// ─── POST /api/superadmin/restaurants/:id/staff ───────────────────────────────
async function createRestaurantStaff(req, res, next) {
  const { name, role='Waiter', email, password } = req.body
  if (!name || !email) return res.status(400).json({ error: 'name and email required' })
  if (!password) return res.status(400).json({ error: 'password is required' })

  const restId = parseInt(req.params.id)
  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    const hash = await bcrypt.hash(password, 10)
    const userRes = await client.query(
      `INSERT INTO users (email, password_hash, role, restaurant_id)
       VALUES ($1,$2,$3,$4) RETURNING id`,
      [email.toLowerCase(), hash, role, restId]
    )
    const staffRes = await client.query(
      `INSERT INTO staff (name, role, user_id, restaurant_id) VALUES ($1,$2,$3,$4) RETURNING *`,
      [name, role, userRes.rows[0].id, restId]
    )
    await client.query('COMMIT')

    logAction(req.user?.id, req.user?.email, restId, 'staff.created', 'staff', staffRes.rows[0].id, { name, role, email })

    // Send staff welcome email (async)
    const restRes = await query('SELECT name FROM restaurants WHERE id=$1', [restId]).catch(()=>({rows:[]}))
    const restaurantName = restRes.rows[0]?.name || 'the restaurant'
    const loginUrl = `${process.env.APP_URL || 'http://localhost:5173'}/login`
    emailService.sendStaffWelcome({
      to: email, name, role, password, restaurantName, loginUrl,
    }).catch(err => console.error('Staff welcome email failed:', err.message))

    res.status(201).json({ id: `STF-${String(staffRes.rows[0].id).padStart(3,'0')}`, name, role, email })
  } catch (err) {
    await client.query('ROLLBACK')
    next(err)
  } finally { client.release() }
}

// ─── GET /api/superadmin/admins ───────────────────────────────────────────────
async function getAdmins(req, res, next) {
  try {
    const { rows } = await query(`
      SELECT u.id, u.email, u.created_at,
             s.name,
             (SELECT MAX(created_at) FROM password_reset_tokens WHERE user_id = u.id) AS last_login
      FROM users u
      LEFT JOIN staff s ON s.user_id = u.id
      WHERE u.role = 'SuperAdmin'
      ORDER BY u.created_at DESC
    `)
    res.json(rows.map(r => ({
      id:        r.id,
      name:      r.name || r.email.split('@')[0],
      email:     r.email,
      createdAt: r.created_at,
      lastLogin: r.last_login || null,
    })))
  } catch (err) { next(err) }
}

// ─── POST /api/superadmin/admins ──────────────────────────────────────────────
async function createAdmin(req, res, next) {
  const { name, email, password } = req.body
  if (!name || !email || !password) {
    return res.status(400).json({ error: 'name, email, and password are required' })
  }

  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    const hash = await bcrypt.hash(password, 10)
    const userRes = await client.query(
      `INSERT INTO users (email, password_hash, role, restaurant_id)
       VALUES ($1, $2, 'SuperAdmin', NULL) RETURNING id`,
      [email.toLowerCase().trim(), hash]
    )
    await client.query(
      `INSERT INTO staff (name, role, user_id, restaurant_id) VALUES ($1, 'SuperAdmin', $2, NULL)`,
      [name, userRes.rows[0].id]
    )
    await client.query('COMMIT')

    logAction(req.user?.id, req.user?.email, null, 'admin.created', 'user', userRes.rows[0].id, { name, email })
    res.status(201).json({ id: userRes.rows[0].id, name, email })
  } catch (err) {
    await client.query('ROLLBACK')
    if (err.code === '23505') return res.status(409).json({ error: 'Email already in use' })
    next(err)
  } finally { client.release() }
}

// ─── DELETE /api/superadmin/admins/:id ────────────────────────────────────────
async function deleteAdmin(req, res, next) {
  const targetId = parseInt(req.params.id)
  if (targetId === req.user?.id) {
    return res.status(400).json({ error: 'You cannot delete your own account' })
  }
  try {
    const { rowCount } = await query(
      `DELETE FROM users WHERE id = $1 AND role = 'SuperAdmin'`,
      [targetId]
    )
    if (!rowCount) return res.status(404).json({ error: 'SuperAdmin not found' })
    logAction(req.user?.id, req.user?.email, null, 'admin.deleted', 'user', targetId, {})
    res.status(204).end()
  } catch (err) { next(err) }
}

// ─── PATCH /api/superadmin/restaurants/:restaurantId/staff/:userId/password ──
async function resetStaffPassword(req, res, next) {
  const { newPassword } = req.body
  const { restaurantId, userId } = req.params

  if (!newPassword || newPassword.length < 6) {
    return res.status(400).json({ error: 'newPassword must be at least 6 characters' })
  }
  try {
    const hash = await bcrypt.hash(newPassword, 10)
    const { rowCount } = await query(
      `UPDATE users SET password_hash=$1, updated_at=NOW()
       WHERE id=$2 AND restaurant_id=$3`,
      [hash, userId, restaurantId]
    )
    if (!rowCount) return res.status(404).json({ error: 'Staff user not found' })
    logAction(req.user?.id, req.user?.email, parseInt(restaurantId), 'staff.password_reset', 'user', parseInt(userId), {})
    res.json({ success: true })
  } catch (err) { next(err) }
}

// ─── GET /api/superadmin/audit-log ───────────────────────────────────────────
async function getAuditLog(req, res, next) {
  try {
    const { action, restaurantId, from, to, page = 1 } = req.query
    const limit  = 50
    const offset = (parseInt(page) - 1) * limit

    const params = []
    const wheres = []

    if (action)       { params.push(action);        wheres.push(`al.action = $${params.length}`) }
    if (restaurantId) { params.push(restaurantId);  wheres.push(`al.restaurant_id = $${params.length}`) }
    if (from)         { params.push(from);           wheres.push(`al.created_at >= $${params.length}`) }
    if (to)           { params.push(to);             wheres.push(`al.created_at <= $${params.length}`) }

    const whereClause = wheres.length ? `WHERE ${wheres.join(' AND ')}` : ''

    const [logsRes, countRes] = await Promise.all([
      query(`
        SELECT al.id, al.actor_id, al.actor_email, al.restaurant_id, al.action,
               al.target_type, al.target_id, al.details, al.created_at,
               r.name AS restaurant_name
        FROM audit_log al
        LEFT JOIN restaurants r ON r.id = al.restaurant_id
        ${whereClause}
        ORDER BY al.created_at DESC
        LIMIT $${params.length + 1} OFFSET $${params.length + 2}
      `, [...params, limit, offset]),
      query(`SELECT COUNT(*) FROM audit_log al ${whereClause}`, params),
    ])

    res.json({
      logs: logsRes.rows.map(r => ({
        id:             r.id,
        actorId:        r.actor_id,
        actorEmail:     r.actor_email,
        restaurantId:   r.restaurant_id,
        restaurantName: r.restaurant_name || null,
        action:         r.action,
        targetType:     r.target_type,
        targetId:       r.target_id,
        details:        r.details,
        createdAt:      r.created_at,
      })),
      total: parseInt(countRes.rows[0].count),
      page:  parseInt(page),
      pages: Math.ceil(parseInt(countRes.rows[0].count) / limit),
    })
  } catch (err) { next(err) }
}

// ─── POST /api/superadmin/broadcast ──────────────────────────────────────────
async function broadcast(req, res, next) {
  const { subject, message, restaurantIds } = req.body
  if (!subject || !message) {
    return res.status(400).json({ error: 'subject and message are required' })
  }

  try {
    let sql, params
    if (restaurantIds?.length) {
      sql    = `SELECT DISTINCT u.email FROM users u WHERE u.role='Admin' AND u.restaurant_id = ANY($1)`
      params = [restaurantIds]
    } else {
      sql    = `SELECT DISTINCT u.email FROM users u JOIN restaurants r ON r.id=u.restaurant_id WHERE u.role='Admin' AND r.status='active'`
      params = []
    }
    const { rows } = await query(sql, params)

    let sent = 0, failed = 0
    for (const row of rows) {
      try {
        await emailService.sendMail({
          to:      row.email,
          subject,
          html:    `<div style="font-family:sans-serif;max-width:600px;margin:auto;padding:24px">
                      <h2 style="color:#4f46e5">${subject}</h2>
                      <div style="white-space:pre-wrap;color:#374151;line-height:1.7">${message}</div>
                      <hr style="margin:24px 0;border:none;border-top:1px solid #e5e7eb"/>
                      <p style="font-size:12px;color:#9ca3af">This message was sent by your POS System administrator.</p>
                    </div>`,
        })
        sent++
      } catch { failed++ }
    }

    logAction(req.user?.id, req.user?.email, null, 'broadcast.sent', null, null, { subject, sent, failed, targetCount: rows.length })
    res.json({ sent, failed, total: rows.length })
  } catch (err) { next(err) }
}

module.exports = {
  getOverview, getRestaurants, getRestaurant,
  createRestaurant, updateRestaurant, toggleStatus, deleteRestaurant,
  createRestaurantStaff,
  getAdmins, createAdmin, deleteAdmin,
  resetStaffPassword,
  getAuditLog,
  broadcast,
}
