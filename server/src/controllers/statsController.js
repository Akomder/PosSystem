const { query } = require('../config/db')

// Schema status values:
//   orders:           'Pending' | 'In Progress' | 'Served' | 'Closed'
//   restaurant_tables: 'Available' | 'Occupied' | 'Reserved'

// ─── GET /api/stats/dashboard ─────────────────────────────────────────────────
async function getDashboard(req, res, next) {
  try {
    const rid = req.restaurantId
    const rFilter       = rid ? `AND restaurant_id = ${rid}` : ''
    const rFilterTable  = rid ? `AND t.restaurant_id = ${rid}` : ''
    const rFilterMenu   = rid ? `AND restaurant_id = ${rid}` : ''

    const [
      revenueRes,
      ordersRes,
      tablesRes,
      menuRes,
      weeklyRes,
      topDishesRes,
      recentOrdersRes,
    ] = await Promise.all([
      // Today's revenue from Closed orders
      query(`
        SELECT COALESCE(SUM(total), 0) AS today_revenue
        FROM orders
        WHERE status = 'Closed'
          AND created_at::date = CURRENT_DATE
          ${rFilter}
      `),
      // Orders stats — active is ALL open orders; totals are today only
      query(`
        SELECT
          (SELECT COUNT(*) FROM orders WHERE created_at::date = CURRENT_DATE ${rFilter})             AS total_today,
          (SELECT COUNT(*) FROM orders WHERE status IN ('Pending','In Progress','Served') ${rFilter}) AS active,
          (SELECT COUNT(*) FROM orders WHERE status = 'Closed' AND created_at::date = CURRENT_DATE ${rFilter}) AS completed_today
      `),
      // Table occupancy
      query(`
        SELECT
          COUNT(*)                                          AS total,
          COUNT(*) FILTER (WHERE status = 'Occupied')  AS occupied,
          COUNT(*) FILTER (WHERE status = 'Available') AS available,
          COUNT(*) FILTER (WHERE status = 'Reserved')  AS reserved
        FROM restaurant_tables t WHERE 1=1 ${rFilterTable}
      `),
      // Menu items count
      query(`
        SELECT COUNT(*) AS total,
               COUNT(*) FILTER (WHERE available) AS available
        FROM menu_items WHERE 1=1 ${rFilterMenu}
      `),
      // Weekly revenue (last 7 days)
      query(`
        SELECT
          to_char(d::date, 'Dy') AS day,
          d::date                AS date,
          COALESCE(SUM(o.total), 0) AS revenue,
          COUNT(o.id)            AS orders
        FROM generate_series(
          CURRENT_DATE - INTERVAL '6 days',
          CURRENT_DATE,
          '1 day'
        ) AS d
        LEFT JOIN orders o
          ON o.created_at::date = d::date AND o.status = 'Closed' ${rFilter}
        GROUP BY d
        ORDER BY d
      `),
      // Top 5 dishes by qty sold (last 30 days)
      query(`
        SELECT
          oi.name,
          SUM(oi.quantity)                   AS qty,
          SUM(oi.quantity * oi.unit_price)   AS revenue
        FROM order_items oi
        JOIN orders o ON o.id = oi.order_id
        WHERE o.status = 'Closed'
          AND o.created_at >= CURRENT_DATE - INTERVAL '30 days'
          ${rFilter}
        GROUP BY oi.name
        ORDER BY qty DESC
        LIMIT 5
      `),
      // Recent 10 orders
      query(`
        SELECT id, table_number, waiter, status, total, created_at
        FROM orders WHERE 1=1 ${rFilter}
        ORDER BY created_at DESC
        LIMIT 10
      `),
    ])

    const revenue = parseFloat(revenueRes.rows[0].today_revenue)
    const orders  = ordersRes.rows[0]
    const tables  = tablesRes.rows[0]
    const menu    = menuRes.rows[0]

    res.json({
      stats: {
        todayRevenue:    revenue,
        totalOrders:     parseInt(orders.total_today),
        activeOrders:    parseInt(orders.active),
        completedOrders: parseInt(orders.completed_today),
        totalTables:     parseInt(tables.total),
        occupiedTables:  parseInt(tables.occupied),
        availableTables: parseInt(tables.available),
        totalMenuItems:  parseInt(menu.total),
        availableItems:  parseInt(menu.available),
      },
      weeklyRevenue: weeklyRes.rows.map(r => ({
        day:     r.day,
        date:    r.date,
        revenue: parseFloat(r.revenue),
        orders:  parseInt(r.orders),
      })),
      topDishes: topDishesRes.rows.map(r => ({
        name:    r.name,
        qty:     parseInt(r.qty),
        revenue: parseFloat(r.revenue),
      })),
      recentOrders: recentOrdersRes.rows.map(r => ({
        id:          `ORD-${String(r.id).padStart(3, '0')}`,
        tableNumber: r.table_number,
        waiter:      r.waiter,
        status:      r.status,
        total:       parseFloat(r.total),
        createdAt:   r.created_at,
      })),
    })
  } catch (err) { next(err) }
}

// ─── GET /api/stats/revenue?period=week|month|year ────────────────────────────
async function getRevenue(req, res, next) {
  try {
    const { period = 'week' } = req.query
    let interval, format, trunc
    if (period === 'month')      { interval = '29 days';   format = 'DD Mon'; trunc = 'day'   }
    else if (period === 'year')  { interval = '11 months'; format = 'Mon YYYY'; trunc = 'month' }
    else                         { interval = '6 days';    format = 'Dy';     trunc = 'day'   }

    const { rows } = await query(`
      SELECT
        to_char(d, $1) AS label,
        d              AS period_start,
        COALESCE(SUM(o.total), 0) AS revenue,
        COUNT(o.id)    AS orders
      FROM generate_series(
        date_trunc($2, CURRENT_DATE - INTERVAL '${interval}'),
        date_trunc($2, CURRENT_DATE),
        INTERVAL '1 ${trunc}'
      ) AS d
      LEFT JOIN orders o
        ON date_trunc($2, o.created_at) = d AND o.status = 'Closed'
      GROUP BY d
      ORDER BY d
    `, [format, trunc])

    res.json(rows.map(r => ({
      label:   r.label,
      revenue: parseFloat(r.revenue),
      orders:  parseInt(r.orders),
    })))
  } catch (err) { next(err) }
}

// ─── helper: period interval ─────────────────────────────────────────────────
function periodInterval(period) {
  if (period === 'year')  return "date_trunc('year', CURRENT_DATE)"
  if (period === 'month') return "CURRENT_DATE - INTERVAL '29 days'"
  return "CURRENT_DATE - INTERVAL '6 days'"
}

// ─── GET /api/stats/reports/sales ────────────────────────────────────────────
async function getReportSales(req, res, next) {
  try {
    const { period = 'week' } = req.query
    const since = periodInterval(period)
    const rid = req.restaurantId
    const rFilter = rid ? `AND restaurant_id = ${rid}` : ''

    const [summaryRes, dailyRes] = await Promise.all([
      query(`
        SELECT
          COALESCE(SUM(total), 0)    AS total_revenue,
          COUNT(*)                   AS total_orders,
          COALESCE(AVG(total), 0)    AS avg_order
        FROM orders
        WHERE status = 'Closed' AND created_at >= ${since} ${rFilter}
      `),
      query(`
        SELECT
          created_at::date AS date,
          COUNT(*)          AS orders,
          COALESCE(SUM(total), 0) AS revenue
        FROM orders
        WHERE status = 'Closed' AND created_at >= ${since} ${rFilter}
        GROUP BY date ORDER BY date
      `),
    ])

    const s = summaryRes.rows[0]
    res.json({
      summary: {
        totalRevenue: parseFloat(s.total_revenue),
        totalOrders:  parseInt(s.total_orders),
        avgOrder:     parseFloat(s.avg_order),
      },
      daily: dailyRes.rows.map(r => ({
        date:    r.date,
        orders:  parseInt(r.orders),
        revenue: parseFloat(r.revenue),
      })),
    })
  } catch (err) { next(err) }
}

// ─── GET /api/stats/reports/products ─────────────────────────────────────────
async function getReportProducts(req, res, next) {
  try {
    const { period = 'week' } = req.query
    const since = periodInterval(period)

    const { rows } = await query(`
      SELECT
        oi.name,
        SUM(oi.quantity)                 AS qty,
        SUM(oi.quantity * oi.unit_price) AS revenue
      FROM order_items oi
      JOIN orders o ON o.id = oi.order_id
      WHERE o.status = 'Closed' AND o.created_at >= ${since}
      GROUP BY oi.name
      ORDER BY qty DESC
      LIMIT 20
    `)

    res.json(rows.map(r => ({
      name:    r.name,
      qty:     parseInt(r.qty),
      revenue: parseFloat(r.revenue),
    })))
  } catch (err) { next(err) }
}

// ─── GET /api/stats/reports/customers ────────────────────────────────────────
async function getReportCustomers(req, res, next) {
  try {
    const { period = 'week' } = req.query
    const since = periodInterval(period)

    const { rows } = await query(`
      SELECT
        COALESCE(c.name, 'Walk-in') AS name,
        COUNT(DISTINCT o.id)         AS visits,
        COALESCE(SUM(o.total), 0)    AS spent
      FROM orders o
      LEFT JOIN customers c ON c.id = o.customer_id
      WHERE o.status = 'Closed' AND o.created_at >= ${since}
      GROUP BY c.name
      ORDER BY spent DESC
      LIMIT 20
    `)

    res.json(rows.map(r => ({
      name:   r.name,
      visits: parseInt(r.visits),
      spent:  parseFloat(r.spent),
    })))
  } catch (err) { next(err) }
}

// ─── GET /api/stats/reports/staff ────────────────────────────────────────────
async function getReportStaff(req, res, next) {
  try {
    const { period = 'week' } = req.query
    const since = periodInterval(period)

    const { rows } = await query(`
      SELECT
        COALESCE(waiter, 'Unassigned') AS staff,
        COUNT(*)                        AS orders,
        COALESCE(SUM(total), 0)         AS revenue
      FROM orders
      WHERE status = 'Closed' AND created_at >= ${since}
      GROUP BY waiter
      ORDER BY revenue DESC
    `)

    res.json(rows.map(r => ({
      staff:   r.staff,
      orders:  parseInt(r.orders),
      revenue: parseFloat(r.revenue),
    })))
  } catch (err) { next(err) }
}

// ─── GET /api/stats/reports/finance ──────────────────────────────────────────
async function getReportFinance(req, res, next) {
  try {
    const { period = 'week' } = req.query
    const since = periodInterval(period)

    const [salesRes, cashRes] = await Promise.all([
      query(`
        SELECT COALESCE(SUM(total), 0) AS revenue
        FROM orders
        WHERE status = 'Closed' AND created_at >= ${since}
      `),
      query(`
        SELECT
          COALESCE(SUM(amount) FILTER (WHERE type='income' AND status='paid'), 0)  AS income,
          COALESCE(SUM(amount) FILTER (WHERE type='expense' AND status='paid'), 0) AS expense
        FROM cash_flow_entries
        WHERE created_at >= ${since}
      `),
    ])

    const revenue = parseFloat(salesRes.rows[0].revenue)
    const income  = parseFloat(cashRes.rows[0].income)
    const expense = parseFloat(cashRes.rows[0].expense)

    res.json({
      salesRevenue: revenue,
      otherIncome:  income,
      totalIncome:  revenue + income,
      totalExpense: expense,
      netBalance:   revenue + income - expense,
    })
  } catch (err) { next(err) }
}

// ─── GET /api/stats/reports/eod ──────────────────────────────────────────────
async function getReportEOD(req, res, next) {
  try {
    // Default to today; allow ?date=YYYY-MM-DD
    const date = req.query.date || 'CURRENT_DATE'
    const safeDate = req.query.date
      ? `'${req.query.date.replace(/[^0-9-]/g, '')}'::date`
      : 'CURRENT_DATE'

    const [ordersRes, itemsRes, cashRes] = await Promise.all([
      query(`
        SELECT
          COUNT(*)                    AS total_orders,
          COALESCE(SUM(subtotal), 0)  AS subtotal,
          COALESCE(SUM(tax), 0)       AS tax,
          COALESCE(SUM(discount), 0)  AS discount,
          COALESCE(SUM(total), 0)     AS total
        FROM orders
        WHERE status = 'Closed' AND created_at::date = ${safeDate}
      `),
      query(`
        SELECT oi.name, SUM(oi.quantity) AS qty, SUM(oi.quantity * oi.unit_price) AS revenue
        FROM order_items oi
        JOIN orders o ON o.id = oi.order_id
        WHERE o.status = 'Closed' AND o.created_at::date = ${safeDate}
        GROUP BY oi.name ORDER BY qty DESC LIMIT 20
      `),
      query(`
        SELECT
          COALESCE(SUM(amount) FILTER (WHERE type='income'  AND status='paid'), 0) AS income,
          COALESCE(SUM(amount) FILTER (WHERE type='expense' AND status='paid'), 0) AS expense
        FROM cash_flow_entries WHERE created_at::date = ${safeDate}
      `),
    ])

    const o = ordersRes.rows[0]
    const c = cashRes.rows[0]
    res.json({
      date:        req.query.date || new Date().toISOString().slice(0, 10),
      totalOrders: parseInt(o.total_orders),
      subtotal:    parseFloat(o.subtotal),
      tax:         parseFloat(o.tax),
      discount:    parseFloat(o.discount),
      total:       parseFloat(o.total),
      cashIncome:  parseFloat(c.income),
      cashExpense: parseFloat(c.expense),
      netBalance:  parseFloat(o.total) + parseFloat(c.income) - parseFloat(c.expense),
      items: itemsRes.rows.map(r => ({
        name:    r.name,
        qty:     parseInt(r.qty),
        revenue: parseFloat(r.revenue),
      })),
    })
  } catch (err) { next(err) }
}

// ─── GET /api/stats/reports/channel ──────────────────────────────────────────
async function getReportChannel(req, res, next) {
  try {
    const { period = 'week' } = req.query
    const since = periodInterval(period)

    const { rows } = await query(`
      SELECT
        COALESCE(payment_method, 'cash') AS channel,
        COUNT(*)                          AS orders,
        COALESCE(SUM(total), 0)           AS revenue
      FROM orders
      WHERE status = 'Closed' AND created_at >= ${since}
      GROUP BY payment_method
      ORDER BY revenue DESC
    `)

    res.json(rows.map(r => ({
      channel: r.channel,
      orders:  parseInt(r.orders),
      revenue: parseFloat(r.revenue),
    })))
  } catch (err) { next(err) }
}

module.exports = { getDashboard, getRevenue, getReportSales, getReportProducts, getReportCustomers, getReportStaff, getReportFinance, getReportEOD, getReportChannel }
