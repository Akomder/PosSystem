const { Server } = require('socket.io')

let io = null

function initSocket(httpServer) {
  io = new Server(httpServer, {
    cors: {
      origin:      process.env.CLIENT_ORIGIN || 'http://localhost:5173',
      methods:     ['GET', 'POST'],
      credentials: true,
    },
  })

  io.on('connection', (socket) => {
    if (process.env.NODE_ENV === 'development') {
      console.log(`[Socket] Client connected: ${socket.id}`)
    }

    // All POS clients join the shared "pos" room
    socket.join('pos')

    // Customer QR pages join a table-specific room for push updates (no auth needed)
    socket.on('join:table', ({ tableId }) => {
      if (typeof tableId === 'string' && /^T-\d+$/.test(tableId)) {
        socket.join(`table:${tableId}`)
      }
    })

    socket.on('disconnect', () => {
      if (process.env.NODE_ENV === 'development') {
        console.log(`[Socket] Client disconnected: ${socket.id}`)
      }
    })
  })
}

function getIo() {
  if (!io) throw new Error('Socket.IO not initialized — call initSocket() first')
  return io
}

// ── Emit helpers ─────────────────────────────────────────────────────────────

function emitOrderCreated(order) {
  if (!io) return
  io.to('pos').emit('order:created', { order })
  if (order?.tableId) io.to(`table:${order.tableId}`).emit('order:customer_update', { order })
}

function emitOrderUpdated(orderId, status, order) {
  if (!io) return
  io.to('pos').emit('order:updated', { orderId, status, order })
  if (order?.tableId) io.to(`table:${order.tableId}`).emit('order:customer_update', { order })
}

function emitTableUpdated(tableId, status, table) {
  if (!io) return
  io.to('pos').emit('table:updated', { tableId, status, table })
}

// items = [{ id, name, stockQuantity, lowStockThreshold }]
function emitStockLow(items) {
  if (!io || !items?.length) return
  io.to('pos').emit('stock:low', { items })
}

// Fired when a QR-order customer selects "QR Payment" — alerts cashier/waiter immediately
function emitQrPaymentAlert(order) {
  if (!io) return
  io.to('pos').emit('payment:qr_alert', { order })
}

// Fired when a customer adds items to an existing open order
function emitOrderItemsAdded(order) {
  if (!io) return
  io.to('pos').emit('order:items_added', { order })
  if (order?.tableId) io.to(`table:${order.tableId}`).emit('order:customer_update', { order })
}

// Fired when a customer submits a return request (e.g. wants to return 2 beers)
function emitOrderReturnRequested(order, returnRecord) {
  if (!io) return
  io.to('pos').emit('order:return_requested', { order, returnRecord })
}

// Fired when a QR-order customer taps "Call Staff" for general assistance
function emitCallStaff({ tableId, tableNumber, restaurantId }) {
  if (!io) return
  io.to('pos').emit('call:staff', { tableId, tableNumber, restaurantId })
}

module.exports = { initSocket, getIo, emitOrderCreated, emitOrderUpdated, emitTableUpdated, emitStockLow, emitQrPaymentAlert, emitOrderItemsAdded, emitOrderReturnRequested, emitCallStaff }
