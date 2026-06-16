const { query, pool }     = require('../config/db')
const { checkValidation } = require('../middleware/errorHandler')
const { emitTableUpdated } = require('../config/socket')

function fmt(r) {
  return {
    id:          r.id,
    guestName:   r.guest_name,
    guestPhone:  r.guest_phone || null,
    partySize:   r.party_size,
    reservedAt:  r.reserved_at,
    tableId:     r.table_id    || null,
    status:      r.status,
    notes:       r.notes       || null,
    createdAt:   r.created_at,
  }
}

// GET /api/reservations?date=YYYY-MM-DD
async function getAll(req, res, next) {
  try {
    const rid = req.restaurantId
    const date = req.query.date || new Date().toISOString().slice(0, 10)
    const { rows } = await query(
      `SELECT * FROM reservations
       WHERE restaurant_id=$1
         AND reserved_at::date = $2::date
       ORDER BY reserved_at`,
      [rid, date]
    )
    res.json(rows.map(fmt))
  } catch (err) { next(err) }
}

// GET /api/reservations/upcoming — next 7 days
async function getUpcoming(req, res, next) {
  try {
    const rid = req.restaurantId
    const { rows } = await query(
      `SELECT * FROM reservations
       WHERE restaurant_id=$1
         AND status = 'upcoming'
         AND reserved_at >= NOW()
         AND reserved_at <  NOW() + INTERVAL '7 days'
       ORDER BY reserved_at`,
      [rid]
    )
    res.json(rows.map(fmt))
  } catch (err) { next(err) }
}

// POST /api/reservations
async function create(req, res, next) {
  if (!checkValidation(req, res)) return
  const { guestName, guestPhone, partySize, reservedAt, tableId, notes } = req.body
  const rid = req.restaurantId
  try {
    const { rows } = await query(
      `INSERT INTO reservations (restaurant_id, guest_name, guest_phone, party_size, reserved_at, table_id, notes)
       VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
      [rid, guestName, guestPhone || null, partySize || 1, reservedAt, tableId || null, notes || null]
    )
    res.status(201).json(fmt(rows[0]))
  } catch (err) { next(err) }
}

// PATCH /api/reservations/:id
async function update(req, res, next) {
  const { guestName, guestPhone, partySize, reservedAt, tableId, notes, status } = req.body
  const rid = req.restaurantId
  const sets = [], params = []
  if (guestName   !== undefined) { params.push(guestName);   sets.push(`guest_name  = $${params.length}`) }
  if (guestPhone  !== undefined) { params.push(guestPhone);  sets.push(`guest_phone = $${params.length}`) }
  if (partySize   !== undefined) { params.push(partySize);   sets.push(`party_size  = $${params.length}`) }
  if (reservedAt  !== undefined) { params.push(reservedAt);  sets.push(`reserved_at = $${params.length}`) }
  if (tableId     !== undefined) { params.push(tableId);     sets.push(`table_id    = $${params.length}`) }
  if (notes       !== undefined) { params.push(notes);       sets.push(`notes       = $${params.length}`) }
  if (status      !== undefined) { params.push(status);      sets.push(`status      = $${params.length}`) }
  if (!sets.length) return res.status(400).json({ error: 'Nothing to update' })
  params.push(req.params.id, rid)
  try {
    const { rows } = await query(
      `UPDATE reservations SET ${sets.join(', ')} WHERE id=$${params.length-1} AND restaurant_id=$${params.length} RETURNING *`,
      params
    )
    if (!rows.length) return res.status(404).json({ error: 'Reservation not found' })
    res.json(fmt(rows[0]))
  } catch (err) { next(err) }
}

// PATCH /api/reservations/:id/seat — mark seated, assign table, open order
async function seat(req, res, next) {
  const { tableId } = req.body
  const rid = req.restaurantId
  if (!tableId) return res.status(400).json({ error: 'tableId is required' })

  const client = await pool.connect()
  try {
    await client.query('BEGIN')

    const rRes = await client.query(
      `SELECT * FROM reservations WHERE id=$1 AND restaurant_id=$2 FOR UPDATE`,
      [req.params.id, rid]
    )
    if (!rRes.rows.length) { await client.query('ROLLBACK'); return res.status(404).json({ error: 'Reservation not found' }) }
    const resv = rRes.rows[0]
    if (resv.status !== 'upcoming') { await client.query('ROLLBACK'); return res.status(400).json({ error: 'Reservation is not upcoming' }) }

    const tRes = await client.query(
      `SELECT * FROM restaurant_tables WHERE id=$1 AND restaurant_id=$2 FOR UPDATE`,
      [tableId, rid]
    )
    if (!tRes.rows.length) { await client.query('ROLLBACK'); return res.status(404).json({ error: 'Table not found' }) }
    const table = tRes.rows[0]
    if (table.status !== 'Available') { await client.query('ROLLBACK'); return res.status(400).json({ error: 'Table is not available' }) }

    // Create a new order for the party
    const ordRes = await client.query(
      `INSERT INTO orders (restaurant_id, table_id, table_number, channel, status, payment_status, subtotal, total, created_at, updated_at)
       VALUES ($1,$2,$3,'dine-in','Pending','unpaid',0,0,NOW(),NOW()) RETURNING id`,
      [rid, table.id, table.number]
    )
    const newOrderId = ordRes.rows[0].id

    // Mark table occupied
    await client.query(
      `UPDATE restaurant_tables SET status='Occupied', current_order_id=$1 WHERE id=$2`,
      [newOrderId, table.id]
    )

    // Mark reservation seated
    await client.query(
      `UPDATE reservations SET status='seated', table_id=$1 WHERE id=$2`,
      [table.id, resv.id]
    )

    await client.query('COMMIT')

    const updatedTable = (await query(`SELECT * FROM restaurant_tables WHERE id=$1`, [table.id])).rows[0]
    const ft = {
      id: `T-${String(updatedTable.id).padStart(2,'0')}`,
      tableNumber: updatedTable.number,
      status: updatedTable.status,
      currentOrderId: `ORD-${String(newOrderId).padStart(3,'0')}`,
    }
    emitTableUpdated(ft.id, ft.status, ft)

    res.json({ reservation: fmt({ ...resv, status: 'seated', table_id: table.id }), tableId: table.id, orderId: newOrderId })
  } catch (err) {
    await client.query('ROLLBACK')
    next(err)
  } finally { client.release() }
}

// PATCH /api/reservations/:id/cancel
async function cancel(req, res, next) {
  const rid = req.restaurantId
  const newStatus = req.body.noShow ? 'no_show' : 'cancelled'
  try {
    const { rows } = await query(
      `UPDATE reservations SET status=$1 WHERE id=$2 AND restaurant_id=$3 RETURNING *`,
      [newStatus, req.params.id, rid]
    )
    if (!rows.length) return res.status(404).json({ error: 'Reservation not found' })
    res.json(fmt(rows[0]))
  } catch (err) { next(err) }
}

module.exports = { getAll, getUpcoming, create, update, seat, cancel }
