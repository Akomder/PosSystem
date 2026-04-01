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
}

function emitOrderUpdated(orderId, status, order) {
  if (!io) return
  io.to('pos').emit('order:updated', { orderId, status, order })
}

function emitTableUpdated(tableId, status, table) {
  if (!io) return
  io.to('pos').emit('table:updated', { tableId, status, table })
}

module.exports = { initSocket, getIo, emitOrderCreated, emitOrderUpdated, emitTableUpdated }
