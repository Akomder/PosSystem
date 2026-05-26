import { createContext, useContext, useReducer, useEffect, useCallback } from 'react'
import { onOrderCreated, onOrderUpdated, onStockLow } from '../services/socket'

const MAX_NOTIFS = 50
const LS_KEY     = 'pos_notifications'

// ─── Helpers ──────────────────────────────────────────────────────────────────
function makeId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
}

function load() {
  try { return JSON.parse(localStorage.getItem(LS_KEY) || '[]') }
  catch { return [] }
}

function persist(list) {
  try { localStorage.setItem(LS_KEY, JSON.stringify(list)) }
  catch {}
}

// ─── Reducer ──────────────────────────────────────────────────────────────────
function reducer(state, action) {
  let next = state
  switch (action.type) {
    case 'ADD':
      next = [action.payload, ...state].slice(0, MAX_NOTIFS)
      break
    case 'MARK_READ':
      next = state.map(n => n.id === action.payload ? { ...n, read: true } : n)
      break
    case 'MARK_ALL':
      next = state.map(n => ({ ...n, read: true }))
      break
    case 'CLEAR':
      next = []
      break
    default:
      return state
  }
  persist(next)
  return next
}

// ─── Context ──────────────────────────────────────────────────────────────────
const Ctx = createContext(null)

export function NotificationsProvider({ children }) {
  const [notifications, dispatch] = useReducer(reducer, [], load)

  const add = useCallback((notif) => {
    dispatch({
      type:    'ADD',
      payload: { ...notif, id: makeId(), read: false, ts: new Date().toISOString() },
    })
  }, [])

  const markRead    = useCallback((id) => dispatch({ type: 'MARK_READ', payload: id }), [])
  const markAllRead = useCallback(()   => dispatch({ type: 'MARK_ALL'  }), [])
  const clearAll    = useCallback(()   => dispatch({ type: 'CLEAR'     }), [])

  // ── Socket subscriptions ───────────────────────────────────────────────────
  useEffect(() => {
    // New order placed (e.g. via QR scan or staff)
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

    // Order status changed
    const offUpdated = onOrderUpdated(({ order }) => {
      if (!order) return
      const map = {
        'In Progress': { title: 'Order Cooking',  verb: 'now cooking'      },
        'Served':      { title: 'Order Ready',    verb: 'ready for pickup' },
        'Closed':      { title: 'Order Closed',   verb: 'closed'           },
        'Cancelled':   { title: 'Order Cancelled',verb: 'cancelled'        },
      }
      const info = map[order.status]
      if (!info) return  // skip Pending — not worth notifying
      const where = order.tableNumber ? ` · Table ${order.tableNumber}` : ''
      add({
        type:  'order_status',
        title: info.title,
        body:  `${order.id} is ${info.verb}${where}`,
        link:  '/orders',
      })
    })

    // Low stock alert
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

    return () => { offCreated?.(); offUpdated?.(); offStock?.() }
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
