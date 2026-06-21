const { query } = require('../config/db')

// ─── Period helper ─────────────────────────────────────────────────────────────
// Returns a safe SQL date expression (never user input — derived from allowlisted string)
function periodInterval(period) {
  if (period === 'year')  return "date_trunc('year', CURRENT_DATE)"
  if (period === 'month') return "CURRENT_DATE - INTERVAL '29 days'"
  if (period === 'today') return 'CURRENT_DATE'
  return "CURRENT_DATE - INTERVAL '6 days'"
}

// ─── GET /api/stats/dashboard ─────────────────────────────────────────────────
async function getDashboard(req, res, next) {
  try {
    const rid = req.restaurantId
    // Parameterize restaurant_id — never interpolate into SQL
    const rp  = rid ? [rid] : []
    const rf  = rid ? 'AND restaurant_id = $1' : ''
    const rfO = rid ? 'AND o.restaurant_id = $1' : ''
    const rfT = rid ? 'AND t.restaurant_id = $1' : ''

    // "Today" follows the open business day (shift) so post-midnight sales stay on
    // the night they were rung up. When no shift is open, fall back to calendar date.
    // openShiftId is a DB-derived integer — safe to inline.
    let openShiftId = null
    if (rid) {
      const shiftRes = await query(
        `SELECT id FROM shifts WHERE restaurant_id = $1 AND status = 'open' ORDER BY opened_at DESC LIMIT 1`,
        rp
      )
      openShiftId = shiftRes.rows[0]?.id || null
    }
    const dayCond  = openShiftId ? `shift_id = ${openShiftId}`   : `created_at::date = CURRENT_DATE`
    const dayCondO = openShiftId ? `o.shift_id = ${openShiftId}` : `o.created_at::date = CURRENT_DATE`

    const [
      revenueRes,
      ordersRes,
      tablesRes,
      menuRes,
      weeklyRes,
      topDishesRes,
      recentOrdersRes,
      hourlyRes,
      lowStockRes,
    ] = await Promise.all([
      // Today's revenue from Closed orders (business day)
      query(
        `SELECT COALESCE(SUM(total), 0) AS today_revenue
         FROM orders
         WHERE status = 'Closed' AND ${dayCond} ${rf}`,
        rp
      ),
      // Orders stats — active is ALL open orders; totals are this business day
      query(
        `SELECT
           (SELECT COUNT(*) FROM orders WHERE ${dayCond} ${rf})                                   AS total_today,
           (SELECT COUNT(*) FROM orders WHERE status IN ('Pending','In Progress','Served') ${rf}) AS active,
           (SELECT COUNT(*) FROM orders WHERE status = 'Closed' AND ${dayCond} ${rf}) AS completed_today`,
        rp
      ),
      // Table occupancy
      query(
        `SELECT
           COUNT(*)                                          AS total,
           COUNT(*) FILTER (WHERE status = 'Occupied')  AS occupied,
           COUNT(*) FILTER (WHERE status = 'Available') AS available,
           COUNT(*) FILTER (WHERE status = 'Reserved')  AS reserved
         FROM restaurant_tables t WHERE 1=1 ${rfT}`,
        rp
      ),
      // Menu items count
      query(
        `SELECT COUNT(*) AS total, COUNT(*) FILTER (WHERE available) AS available
         FROM menu_items WHERE 1=1 ${rf}`,
        rp
      ),
      // Weekly revenue (last 7 days)
      query(
        `SELECT
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
           ON o.created_at::date = d::date AND o.status = 'Closed' ${rfO}
         GROUP BY d ORDER BY d`,
        rp
      ),
      // Top 10 dishes by qty sold (last 30 days), include category
      query(
        `SELECT
           oi.name,
           COALESCE(mi.category, '') AS category,
           SUM(oi.quantity)                   AS qty,
           SUM(oi.quantity * oi.unit_price)   AS revenue
         FROM order_items oi
         JOIN orders o ON o.id = oi.order_id
         LEFT JOIN menu_items mi ON mi.name = oi.name AND mi.restaurant_id = o.restaurant_id
         WHERE o.status = 'Closed'
           AND o.created_at >= CURRENT_DATE - INTERVAL '30 days' ${rfO}
         GROUP BY oi.name, mi.category ORDER BY qty DESC LIMIT 10`,
        rp
      ),
      // Recent 10 orders
      query(
        `SELECT id, table_number, waiter, status, total, created_at
         FROM orders WHERE 1=1 ${rf} ORDER BY created_at DESC LIMIT 10`,
        rp
      ),
      // Hourly orders for this business day (for guest count chart)
      query(
        `SELECT
           EXTRACT(HOUR FROM created_at)::int AS hour,
           COUNT(*)                            AS orders,
           COALESCE(SUM(total), 0)             AS revenue
         FROM orders
         WHERE status = 'Closed' AND ${dayCond} ${rf}
         GROUP BY hour ORDER BY hour`,
        rp
      ),
      // Low stock items
      query(
        `SELECT id, name, stock_quantity AS stock, low_stock_threshold AS min_stock
         FROM menu_items
         WHERE ${rid ? 'restaurant_id = $1 AND' : ''} stock_quantity IS NOT NULL
           AND stock_quantity <= low_stock_threshold
         ORDER BY stock_quantity ASC LIMIT 10`,
        rp
      ),
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
        name:     r.name,
        category: r.category || '',
        qty:      parseInt(r.qty),
        revenue:  parseFloat(r.revenue),
      })),
      recentOrders: recentOrdersRes.rows.map(r => ({
        id:          `ORD-${String(r.id).padStart(3, '0')}`,
        tableNumber: r.table_number,
        waiter:      r.waiter,
        status:      r.status,
        total:       parseFloat(r.total),
        createdAt:   r.created_at,
      })),
      hourlyOrders: hourlyRes.rows.map(r => ({
        hour:    r.hour,
        orders:  parseInt(r.orders),
        revenue: parseFloat(r.revenue),
      })),
      lowStockItems: lowStockRes.rows.map(r => ({
        id:       r.id,
        name:     r.name,
        stock:    r.stock,
        minStock: r.min_stock,
      })),
    })
  } catch (err) { next(err) }
}

// ─── GET /api/stats/revenue?period=week|month|year ────────────────────────────
async function getRevenue(req, res, next) {
  try {
    const { period = 'week' } = req.query
    const rid = req.restaurantId
    let interval, format, trunc
    if (period === 'today')      { interval = null;         format = 'HH24';     trunc = 'hour'  }
    else if (period === 'month') { interval = '29 days';   format = 'DD Mon';   trunc = 'day'   }
    else if (period === 'year')  { interval = '11 months'; format = 'Mon YYYY'; trunc = 'month' }
    else                         { interval = '6 days';    format = 'Dy';       trunc = 'day'   }

    // $1=format, $2=trunc are safe (non-user-derived); $3=rid if present
    const params = [format, trunc]
    const rFilter = rid ? (params.push(rid), `AND o.restaurant_id = $${params.length}`) : ''

    let rows
    if (period === 'today') {
      // Hourly series for today (0–23)
      const { rows: r } = await query(`
        SELECT
          to_char(d, $1)            AS label,
          d                         AS period_start,
          COALESCE(SUM(o.total), 0) AS revenue,
          COUNT(o.id)               AS orders
        FROM generate_series(
          date_trunc('hour', CURRENT_DATE::timestamptz),
          date_trunc('hour', CURRENT_DATE::timestamptz) + INTERVAL '23 hours',
          INTERVAL '1 hour'
        ) AS d
        LEFT JOIN orders o
          ON date_trunc('hour', o.created_at) = d AND o.status = 'Closed' ${rFilter}
        GROUP BY d ORDER BY d
      `, params)
      rows = r
    } else {
      const { rows: r } = await query(`
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
          ON date_trunc($2, o.created_at) = d AND o.status = 'Closed' ${rFilter}
        GROUP BY d
        ORDER BY d
      `, params)
      rows = r
    }

    res.json(rows.map(r => ({
      label:   r.label,
      revenue: parseFloat(r.revenue),
      orders:  parseInt(r.orders),
    })))
  } catch (err) { next(err) }
}

// ─── GET /api/stats/reports/sales ────────────────────────────────────────────
async function getReportSales(req, res, next) {
  try {
    const { period = 'week' } = req.query
    const since = periodInterval(period)
    const rid = req.restaurantId
    const params = rid ? [rid] : []
    const rFilter = rid ? 'AND restaurant_id = $1' : ''

    const [summaryRes, dailyRes] = await Promise.all([
      query(
        `SELECT
           COALESCE(SUM(total), 0)    AS total_revenue,
           COUNT(*)                   AS total_orders,
           COALESCE(AVG(total), 0)    AS avg_order
         FROM orders
         WHERE status = 'Closed' AND created_at >= ${since} ${rFilter}`,
        params
      ),
      query(
        `SELECT
           created_at::date AS date,
           COUNT(*)          AS orders,
           COALESCE(SUM(total), 0) AS revenue
         FROM orders
         WHERE status = 'Closed' AND created_at >= ${since} ${rFilter}
         GROUP BY date ORDER BY date`,
        params
      ),
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
    const rid = req.restaurantId
    const params = rid ? [rid] : []
    const rFilter = rid ? 'AND o.restaurant_id = $1' : ''

    const { rows } = await query(
      `SELECT
         oi.name,
         SUM(oi.quantity)                 AS qty,
         SUM(oi.quantity * oi.unit_price) AS revenue
       FROM order_items oi
       JOIN orders o ON o.id = oi.order_id
       WHERE o.status = 'Closed' AND o.created_at >= ${since} ${rFilter}
       GROUP BY oi.name ORDER BY qty DESC LIMIT 20`,
      params
    )

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
    const rid = req.restaurantId
    const params = rid ? [rid] : []
    const rFilter = rid ? 'AND o.restaurant_id = $1' : ''

    const { rows } = await query(
      `SELECT
         COALESCE(c.name, 'Walk-in') AS name,
         COUNT(DISTINCT o.id)         AS visits,
         COALESCE(SUM(o.total), 0)    AS spent
       FROM orders o
       LEFT JOIN customers c ON c.id = o.customer_id
       WHERE o.status = 'Closed' AND o.created_at >= ${since} ${rFilter}
       GROUP BY c.name ORDER BY spent DESC LIMIT 20`,
      params
    )

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
    const rid = req.restaurantId
    const params = rid ? [rid] : []
    const rFilter = rid ? 'AND restaurant_id = $1' : ''

    const { rows } = await query(
      `SELECT
         COALESCE(waiter, 'Unassigned') AS staff,
         COUNT(*)                        AS orders,
         COALESCE(SUM(total), 0)         AS revenue
       FROM orders
       WHERE status = 'Closed' AND created_at >= ${since} ${rFilter}
       GROUP BY waiter ORDER BY revenue DESC`,
      params
    )

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
    const rid = req.restaurantId
    const params = rid ? [rid] : []
    const rFilter = rid ? 'AND restaurant_id = $1' : ''

    const [salesRes, cashRes] = await Promise.all([
      query(
        `SELECT COALESCE(SUM(total), 0) AS revenue
         FROM orders
         WHERE status = 'Closed' AND created_at >= ${since} ${rFilter}`,
        params
      ),
      query(
        `SELECT
           COALESCE(SUM(amount) FILTER (WHERE type='income'  AND status='paid'), 0) AS income,
           COALESCE(SUM(amount) FILTER (WHERE type='expense' AND status='paid'), 0) AS expense
         FROM cash_flow_entries
         WHERE created_at >= ${since} ${rFilter}`,
        params
      ),
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
// End-of-day by business day. Resolution: explicit ?shiftId → that shift;
// explicit ?date → that calendar date (historical); neither → current open
// shift, else most-recent shift, else calendar today. Shift mode attributes
// post-midnight bills to the night they were rung up.
async function getReportEOD(req, res, next) {
  try {
    const rid = req.restaurantId

    // Decide whether to report by shift (business day) or calendar date.
    let shift = null
    if (req.query.shiftId) {
      const r = await query(
        `SELECT * FROM shifts WHERE id = $1 ${rid ? 'AND restaurant_id = $2' : ''}`,
        rid ? [req.query.shiftId, rid] : [req.query.shiftId]
      )
      shift = r.rows[0] || null
    } else if (!req.query.date && rid) {
      // Default: current open shift, else the most recent shift
      const r = await query(
        `SELECT * FROM shifts WHERE restaurant_id = $1
         ORDER BY (status = 'open') DESC, opened_at DESC LIMIT 1`,
        [rid]
      )
      shift = r.rows[0] || null
    }

    let ordersSql, itemsSql, cashSql, params, label

    if (shift) {
      // Shift mode — mirror the predicate used by shiftsController.getSummary.
      // $1 rid, $2 shiftId, $3 opened_at, $4 closed_at
      params = [rid, shift.id, shift.opened_at, shift.closed_at]
      const dayFilter = `(o.shift_id = $2 OR (o.shift_id IS NULL AND o.created_at >= $3
        AND ($4::timestamptz IS NULL OR o.created_at <= $4)))`
      const cashWindow = `created_at >= $3 AND ($4::timestamptz IS NULL OR created_at <= $4) AND restaurant_id = $1`
      ordersSql = `SELECT COUNT(*) AS total_orders, COALESCE(SUM(o.subtotal),0) AS subtotal,
                          COALESCE(SUM(o.discount),0) AS discount, COALESCE(SUM(o.total),0) AS total
                   FROM orders o WHERE o.status='Closed' AND o.restaurant_id = $1 AND ${dayFilter}`
      itemsSql  = `SELECT oi.name, SUM(oi.quantity) AS qty, SUM(oi.quantity*oi.unit_price) AS revenue
                   FROM order_items oi JOIN orders o ON o.id = oi.order_id
                   WHERE o.status='Closed' AND o.restaurant_id = $1 AND ${dayFilter}
                   GROUP BY oi.name ORDER BY qty DESC LIMIT 20`
      cashSql   = `SELECT COALESCE(SUM(amount) FILTER (WHERE type='income'  AND status='paid'),0) AS income,
                          COALESCE(SUM(amount) FILTER (WHERE type='expense' AND status='paid'),0) AS expense
                   FROM cash_flow_entries WHERE ${cashWindow}`
      label = (shift.opened_at instanceof Date ? shift.opened_at.toISOString() : String(shift.opened_at)).slice(0, 10)
    } else {
      // Calendar-date mode (explicit date or no shifts exist yet)
      params = []
      let dateSql
      if (req.query.date) {
        const dateStr = req.query.date.replace(/[^0-9-]/g, '')
        params.push(dateStr); dateSql = `$${params.length}::date`
      } else { dateSql = 'CURRENT_DATE' }
      const rFilter = rid ? (params.push(rid), `AND restaurant_id = $${params.length}`) : ''
      const rFilterJoin = rid ? `AND o.restaurant_id = $${params.length}` : ''
      ordersSql = `SELECT COUNT(*) AS total_orders, COALESCE(SUM(subtotal),0) AS subtotal,
                          COALESCE(SUM(discount),0) AS discount, COALESCE(SUM(total),0) AS total
                   FROM orders WHERE status='Closed' AND created_at::date = ${dateSql} ${rFilter}`
      itemsSql  = `SELECT oi.name, SUM(oi.quantity) AS qty, SUM(oi.quantity*oi.unit_price) AS revenue
                   FROM order_items oi JOIN orders o ON o.id = oi.order_id
                   WHERE o.status='Closed' AND o.created_at::date = ${dateSql} ${rFilterJoin}
                   GROUP BY oi.name ORDER BY qty DESC LIMIT 20`
      cashSql   = `SELECT COALESCE(SUM(amount) FILTER (WHERE type='income'  AND status='paid'),0) AS income,
                          COALESCE(SUM(amount) FILTER (WHERE type='expense' AND status='paid'),0) AS expense
                   FROM cash_flow_entries WHERE created_at::date = ${dateSql} ${rFilter}`
      label = req.query.date || new Date().toISOString().slice(0, 10)
    }

    const [ordersRes, itemsRes, cashRes] = await Promise.all([
      query(ordersSql, params), query(itemsSql, params), query(cashSql, params),
    ])

    const o = ordersRes.rows[0]
    const c = cashRes.rows[0]
    res.json({
      date:        label,
      shiftId:     shift?.id || null,
      totalOrders: parseInt(o.total_orders),
      subtotal:    parseFloat(o.subtotal),
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
    const rid = req.restaurantId
    const params = rid ? [rid] : []
    const rFilter = rid ? 'AND restaurant_id = $1' : ''

    const { rows } = await query(
      `SELECT
         COALESCE(payment_method, 'cash') AS channel,
         COUNT(*)                          AS orders,
         COALESCE(SUM(total), 0)           AS revenue
       FROM orders
       WHERE status = 'Closed' AND created_at >= ${since} ${rFilter}
       GROUP BY payment_method ORDER BY revenue DESC`,
      params
    )

    res.json(rows.map(r => ({
      channel: r.channel,
      orders:  parseInt(r.orders),
      revenue: parseFloat(r.revenue),
    })))
  } catch (err) { next(err) }
}

// ─── GET /api/stats/reports/stock-daily?shiftId=|date= ───────────────────────
// Per-item opening / sold / remaining for one business day (e.g. counting beer).
async function getReportStockDaily(req, res, next) {
  try {
    const rid = req.restaurantId
    const params = []
    const rf = rid ? (params.push(rid), `AND mi.restaurant_id = $${params.length}`) : ''

    // Day filter for sales: prefer shiftId, else a date (default today).
    let soldFilter
    if (req.query.shiftId) {
      params.push(parseInt(req.query.shiftId) || 0)
      soldFilter = `o.shift_id = $${params.length}`
    } else {
      const dateStr = (req.query.date || '').replace(/[^0-9-]/g, '')
      if (dateStr) { params.push(dateStr); soldFilter = `o.created_at::date = $${params.length}::date` }
      else         { soldFilter = `o.created_at::date = CURRENT_DATE` }
    }
    const rfJoin = rid ? `AND o.restaurant_id = $1` : ''

    const { rows } = await query(
      `SELECT mi.id, mi.name, mi.category,
              mi.stock_quantity AS current_qty,
              COALESCE((
                SELECT SUM(oi.quantity)
                FROM order_items oi
                JOIN orders o ON o.id = oi.order_id
                WHERE oi.menu_item_id = mi.id
                  AND o.status = 'Closed' AND ${soldFilter} ${rfJoin}
              ), 0) AS sold_qty
       FROM menu_items mi
       WHERE mi.stock_quantity IS NOT NULL ${rf}
       ORDER BY mi.category, mi.name`,
      params
    )

    res.json(rows.map(r => {
      const current = parseFloat(r.current_qty) || 0
      const sold    = parseFloat(r.sold_qty) || 0
      return {
        id:         r.id,
        name:       r.name,
        category:   r.category,
        openingQty: current + sold,
        soldQty:    sold,
        currentQty: current,
      }
    }))
  } catch (err) { next(err) }
}

// ─── GET /api/stats/reports/sales-detail?period=|shiftId= ────────────────────
// One row per sold line item with complete detail.
async function getReportSalesDetail(req, res, next) {
  try {
    const rid = req.restaurantId
    const params = []
    const rf = rid ? (params.push(rid), `AND o.restaurant_id = $${params.length}`) : ''

    let dayFilter
    if (req.query.shiftId) {
      params.push(parseInt(req.query.shiftId) || 0)
      dayFilter = `o.shift_id = $${params.length}`
    } else {
      dayFilter = `o.created_at >= ${periodInterval(req.query.period || 'week')}`
    }

    const { rows } = await query(
      `SELECT o.id AS order_id, o.created_at, o.table_number, o.waiter,
              o.payment_method, o.payment_status, o.discount AS order_discount,
              oi.name, oi.quantity, oi.unit_price,
              (oi.quantity * oi.unit_price) AS line_total,
              COALESCE((
                SELECT string_agg(oim.name, ', ')
                FROM order_item_modifiers oim WHERE oim.order_item_id = oi.id
              ), '') AS modifiers
       FROM order_items oi
       JOIN orders o ON o.id = oi.order_id
       WHERE o.status = 'Closed' AND ${dayFilter} ${rf}
       ORDER BY o.created_at DESC, oi.id`,
      params
    )

    res.json(rows.map(r => ({
      orderId:       `ORD-${String(r.order_id).padStart(3, '0')}`,
      createdAt:     r.created_at,
      tableNumber:   r.table_number,
      waiter:        r.waiter,
      name:          r.name,
      modifiers:     r.modifiers,
      quantity:      parseFloat(r.quantity),
      unitPrice:     parseFloat(r.unit_price),
      lineTotal:     parseFloat(r.line_total),
      orderDiscount: parseFloat(r.order_discount || 0),
      paymentMethod: r.payment_method,
      paymentStatus: r.payment_status,
    })))
  } catch (err) { next(err) }
}

// ─── GET /api/stats/top-dishes?period=today|week|month|year ──────────────────
async function getTopDishes(req, res, next) {
  try {
    const { period = 'month' } = req.query
    const rid = req.restaurantId
    const since = periodInterval(period)
    const params = rid ? [rid] : []
    const rFilter = rid ? 'AND o.restaurant_id = $1' : ''

    const { rows } = await query(
      `SELECT
         oi.name,
         COALESCE(mi.category, '') AS category,
         SUM(oi.quantity)                   AS qty,
         SUM(oi.quantity * oi.unit_price)   AS revenue
       FROM order_items oi
       JOIN orders o ON o.id = oi.order_id
       LEFT JOIN menu_items mi ON mi.name = oi.name AND mi.restaurant_id = o.restaurant_id
       WHERE o.status = 'Closed'
         AND o.created_at >= ${since} ${rFilter}
       GROUP BY oi.name, mi.category ORDER BY qty DESC LIMIT 10`,
      params
    )

    res.json(rows.map(r => ({
      name:     r.name,
      category: r.category || '',
      qty:      parseInt(r.qty),
      revenue:  parseFloat(r.revenue),
    })))
  } catch (err) { next(err) }
}

module.exports = {
  getDashboard, getRevenue, getTopDishes,
  getReportSales, getReportProducts, getReportCustomers,
  getReportStaff, getReportFinance, getReportEOD, getReportChannel,
  getReportStockDaily, getReportSalesDetail,
}
