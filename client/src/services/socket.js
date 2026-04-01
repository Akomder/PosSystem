import { io } from 'socket.io-client'

let socket = null

export function connectSocket(token) {
  if (socket?.connected) return socket

  socket = io('/', {
    auth: { token },
    transports: ['websocket', 'polling'],
    autoConnect: true,
    reconnection: true,
    reconnectionAttempts: 10,
    reconnectionDelay: 1500,
  })

  socket.on('connect', () => {
    console.log('[socket] connected:', socket.id)
    socket.emit('join', 'pos')   // join the pos room
  })
  socket.on('disconnect', (reason) => {
    console.log('[socket] disconnected:', reason)
  })
  socket.on('connect_error', (err) => {
    console.warn('[socket] connect error:', err.message)
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
