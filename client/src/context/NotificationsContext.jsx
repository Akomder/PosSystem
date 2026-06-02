import { createContext, useContext, useReducer, useEffect, useCallback } from 'react'
import { onOrderCreated, onOrderUpdated, onStockLow, onQrPaymentAlert, onOrderItemsAdded, onOrderReturnRequested } from '../services/socket'
import { notificationsApi } from '../services/api'
import { playUrgentAlert } from '../lib/soundAlert'

// ─── Reducer ──────────────────────────────────────────────────────────────────
function reducer(state, action) {
  switch (action.type) {
    case 'LOAD':
      return action.payload
    case 'ADD':
      return [action.payload, ...state].slice(0, 50)
    case 'MARK_READ':
      return state.map(n => n.id === action.payload ? { ...n, read: true } : n)
    case 'MARK_ALL':
      return state.map(n => ({ ...n, read: true }))
    case 'CLEAR':
      return []
    default:
      return state
  }
}

// ─── Context ──────────────────────────────────────────────────────────────────
const Ctx = createContext(null)

export function NotificationsProvider({ children }) {
  const [notifications, dispatch] = useReducer(reducer, [])

  // Load from DB on mount
  useEffect(() => {
    notificationsApi.getAll()
      .then(data => dispatch({ type: 'LOAD', payload: data }))
      .catch(() => {}) // non-fatal — user may not be logged in yet
  }, [])

  // Save a notification to DB then add to local state
  const add = useCallback(async (notif) => {
    try {
      const saved = await notificationsApi.create(notif)
      dispatch({ type: 'ADD', payload: saved })
    } catch {
      // If the API call fails (e.g. offline), still show in local state with a temp id
      dispatch({
        type:    'ADD',
        payload: { ...notif, id: `tmp-${Date.now()}`, read: false, createdAt: new Date().toISOString() },
      })
    }
  }, [])

  const markRead = useCallback(async (id) => {
    if (String(id).startsWith('tmp-')) {
      dispatch({ type: 'MARK_READ', payload: id })
      return
    }
    try {
      await notificationsApi.markRead(id)
      dispatch({ type: 'MARK_READ', payload: id })
    } catch { dispatch({ type: 'MARK_READ', payload: id }) }
  }, [])

  const markAllRead = useCallback(async () => {
    try { await notificationsApi.markAllRead() } catch {}
    dispatch({ type: 'MARK_ALL' })
  }, [])

  const clearAll = useCallback(async () => {
    try { await notificationsApi.clearAll() } catch {}
    dispatch({ type: 'CLEAR' })
  }, [])

  // ── Socket subscriptions ───────────────────────────────────────────────────
  useEffect(() => {
    const offCreated = onOrderCreated(({ order }) => {
      if (!order) return
      const where = order.tableNumber ? `Table ${order.tableNumber}` : (order.orderType || 'Dine In')
      const count = order.items?.length ?? 0
      add({
        type:  'order_new',
        title: 'New Order',
        body:  `${order.id} · ${where} · ${count} item${count !== 1 ? 's' : ''}`,
        link:  '/orders',
      })
    })

    const offUpdated = onOrderUpdated(({ order }) => {
      if (!order) return
      const map = {
        'In Progress': { title: 'Order Cooking',   verb: 'now cooking'      },
        'Served':      { title: 'Order Ready',     verb: 'ready for pickup' },
        'Closed':      { title: 'Order Closed',    verb: 'closed'           },
        'Cancelled':   { title: 'Order Cancelled', verb: 'cancelled'        },
      }
      const info = map[order.status]
      if (!info) return
      const where = order.tableNumber ? ` · Table ${order.tableNumber}` : ''
      add({
        type:  'order_status',
        title: info.title,
        body:  `${order.id} is ${info.verb}${where}`,
        link:  '/orders',
      })
    })

    const offStock = onStockLow(({ items }) => {
      if (!items?.length) return
      items.forEach(item => {
        add({
          type:  'stock_low',
          title: 'Low Stock',
          body:  `${item.name} — ${item.stockQuantity} units left`,
          link:  '/menu',
        })
      })
    })

    const offItemsAdded = onOrderItemsAdded(({ order }) => {
      if (!order) return
      const where = order.tableNumber ? `Table ${order.tableNumber}` : (order.orderType || 'Dine In')
      const count = order.items?.length ?? 0
      add({
        type:  'order_new',
        title: 'Items Added',
        body:  `${order.id} · ${where} · now ${count} item${count !== 1 ? 's' : ''}`,
        link:  '/orders',
      })
    })

    const offQrPay = onQrPaymentAlert(({ order }) => {
      if (!order) return
      const amount = order.total?.toLocaleString?.() ?? order.total
      const cur    = order.currency || 'LAK'
      add({
        type:   'payment_qr',
        title:  '📱 QR Payment — Table ' + (order.tableNumber ?? ''),
        body:   `${order.id} · ${amount} ${cur} — customer ready to pay`,
        link:   '/orders',
        urgent: true,
      })
      playUrgentAlert()
    })

    const offReturn = onOrderReturnRequested(({ order, returnRecord }) => {
      if (!order) return
      const where = order.tableNumber ? `Table ${order.tableNumber}` : (order.orderType || 'Dine In')
      const count = returnRecord?.items?.length ?? 0
      add({
        type:  'order_return',
        title: '↩ Return Request',
        body:  `${order.id} · ${where} · ${count} item${count !== 1 ? 's' : ''}`,
        link:  '/orders',
      })
      playUrgentAlert()
    })

    return () => { offCreated?.(); offUpdated?.(); offStock?.(); offQrPay?.(); offItemsAdded?.(); offReturn?.() }
  }, [add])

  const unreadCount = notifications.filter(n => !n.read).length

  return (
    <Ctx.Provider value={{ notifications, unreadCount, markRead, markAllRead, clearAll }}>
      {children}
    </Ctx.Provider>
  )
}

export function useNotifications() {
  const ctx = useContext(Ctx)
  if (!ctx) throw new Error('useNotifications must be used within NotificationsProvider')
  return ctx
}
