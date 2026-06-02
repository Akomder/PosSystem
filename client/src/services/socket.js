import { io } from 'socket.io-client'

let socket = null

export function connectSocket(token) {
  // Return existing socket regardless of connection state — Socket.IO handles
  // reconnection internally. Creating a new instance would lose all listeners.
  if (socket) return socket

  socket = io('/', {
    auth: { token },
    transports: ['websocket', 'polling'],
    autoConnect: true,
    reconnection: true,
    reconnectionAttempts: 10,
    reconnectionDelay: 1500,
  })

  socket.on('connect', () => {
    socket.emit('join', 'pos')
  })

  return socket
}

export function disconnectSocket() {
  if (socket) {
    socket.disconnect()
    socket = null
  }
}

export function getSocket() {
  return socket
}

// ─── Typed event subscriptions ────────────────────────────────────────────────
export function onOrderCreated(cb) {
  socket?.on('order:created', cb)
  return () => socket?.off('order:created', cb)
}

export function onOrderUpdated(cb) {
  socket?.on('order:updated', cb)
  return () => socket?.off('order:updated', cb)
}

export function onTableUpdated(cb) {
  socket?.on('table:updated', cb)
  return () => socket?.off('table:updated', cb)
}

export function onStockLow(cb) {
  socket?.on('stock:low', cb)
  return () => socket?.off('stock:low', cb)
}

export function onQrPaymentAlert(cb) {
  socket?.on('payment:qr_alert', cb)
  return () => socket?.off('payment:qr_alert', cb)
}

export function onOrderItemsAdded(cb) {
  socket?.on('order:items_added', cb)
  return () => socket?.off('order:items_added', cb)
}
