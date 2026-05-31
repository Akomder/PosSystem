import { createContext, useContext, useReducer, useEffect, useCallback } from 'react'
import { ordersApi, tablesApi, menuApi } from '../services/api'
import { onOrderCreated, onOrderUpdated, onTableUpdated, onStockLow } from '../services/socket'
import { useAuth } from './AuthContext'
import {
  cacheMenu,      getCachedMenu,
  cacheTables,    getCachedTables,
} from '../lib/offlineDb'

// ── Actions ──────────────────────────────────────────────────────────────────
const A = {
  SET_ORDERS:           'SET_ORDERS',
  SET_TABLES:           'SET_TABLES',
  SET_MENU:             'SET_MENU',
  SET_LOADING:          'SET_LOADING',
  ADD_ORDER:            'ADD_ORDER',
  UPDATE_ORDER:         'UPDATE_ORDER',
  UPDATE_TABLE:         'UPDATE_TABLE',
  ADD_TABLE:            'ADD_TABLE',
  REMOVE_TABLE:         'REMOVE_TABLE',
  ADD_MENU_ITEM:        'ADD_MENU_ITEM',
  UPDATE_MENU_ITEM:     'UPDATE_MENU_ITEM',
  TOGGLE_SIDEBAR:       'TOGGLE_SIDEBAR',
  ADD_STOCK_ALERTS:     'ADD_STOCK_ALERTS',
  DISMISS_STOCK_ALERT:  'DISMISS_STOCK_ALERT',
}

// ── Reducer ───────────────────────────────────────────────────────────────────
function appReducer(state, action) {
  switch (action.type) {
    case A.SET_ORDERS:    return { ...state, orders:    action.payload, loading: { ...state.loading, orders: false } }
    case A.SET_TABLES:    return { ...state, tables:    action.payload, loading: { ...state.loading, tables: false } }
    case A.SET_MENU:      return { ...state, menuItems: action.payload, loading: { ...state.loading, menu:   false } }
    case A.SET_LOADING:   return { ...state, loading: { ...state.loading, ...action.payload } }

    case A.ADD_ORDER:
      return { ...state, orders: [action.payload, ...state.orders] }

    case A.UPDATE_ORDER:
      return {
        ...state,
        orders: state.orders.map(o =>
          o.id === action.payload.id ? { ...o, ...action.payload } : o
        ),
      }

    case A.UPDATE_TABLE:
      return {
        ...state,
        tables: state.tables.map(t =>
          t.id === action.payload.id ? { ...t, ...action.payload } : t
        ),
      }

    case A.ADD_TABLE:
      return { ...state, tables: [...state.tables, action.payload] }

    case A.REMOVE_TABLE:
      return { ...state, tables: state.tables.filter(t => t.id !== action.payload) }

    case A.ADD_MENU_ITEM:
      return { ...state, menuItems: [action.payload, ...state.menuItems] }

    case A.UPDATE_MENU_ITEM:
      return {
        ...state,
        menuItems: state.menuItems.map(m =>
          m.id === action.payload.id ? { ...m, ...action.payload } : m
        ),
      }

    case A.TOGGLE_SIDEBAR:
      return { ...state, sidebarOpen: !state.sidebarOpen }

    case A.ADD_STOCK_ALERTS:
      return {
        ...state,
        stockAlerts: [
          ...state.stockAlerts,
          ...action.payload.map(a => ({ ...a, _key: `${a.id}-${Date.now()}` })),
        ],
      }

    case A.DISMISS_STOCK_ALERT:
      return {
        ...state,
        stockAlerts: state.stockAlerts.filter(a => a._key !== action.payload),
      }

    default: return state
  }
}

// ── Context ───────────────────────────────────────────────────────────────────
const AppContext = createContext(null)

export function AppProvider({ children }) {
  const { user } = useAuth()
  const [state, dispatch] = useReducer(appReducer, {
    orders:      [],
    tables:      [],
    menuItems:   [],
    stockAlerts: [],
    sidebarOpen: true,
    loading:     { orders: true, tables: true, menu: true },
  })

  // ── Bootstrap: fetch all data when the user is authenticated ─────────────
  useEffect(() => {
    if (!user) return   // not logged in — skip (data will load after login)
    if (user.isSuperAdmin) return  // SuperAdmin uses its own API, skip restaurant data

    dispatch({ type: A.SET_LOADING, payload: { orders: true, tables: true, menu: true } })

    ordersApi.getAll({ limit: 200 })
      .then(data => dispatch({ type: A.SET_ORDERS, payload: data }))
      .catch(() => dispatch({ type: A.SET_LOADING, payload: { orders: false } }))

    tablesApi.getAll()
      .then(data => {
        dispatch({ type: A.SET_TABLES, payload: data })
        cacheTables(data).catch(() => {}) // persist for offline use
      })
      .catch(async () => {
        // Network failure — try the last cached copy
        const cached = await getCachedTables().catch(() => null)
        if (cached) dispatch({ type: A.SET_TABLES, payload: cached })
        else dispatch({ type: A.SET_LOADING, payload: { tables: false } })
      })

    menuApi.getAll()
      .then(data => {
        dispatch({ type: A.SET_MENU, payload: data })
        cacheMenu(data).catch(() => {}) // persist for offline use
      })
      .catch(async () => {
        // Network failure — try the last cached copy
        const cached = await getCachedMenu().catch(() => null)
        if (cached) dispatch({ type: A.SET_MENU, payload: cached })
        else dispatch({ type: A.SET_LOADING, payload: { menu: false } })
      })
  }, [user?.id])   // re-run whenever the logged-in user changes

  // ── Socket.IO real-time updates ───────────────────────────────────────────
  useEffect(() => {
    const offCreated = onOrderCreated(({ order }) => {
      dispatch({ type: A.ADD_ORDER, payload: order })
    })
    const offUpdated = onOrderUpdated(({ order }) => {
      dispatch({ type: A.UPDATE_ORDER, payload: order })
    })
    const offTable = onTableUpdated(({ table }) => {
      if (table) dispatch({ type: A.UPDATE_TABLE, payload: table })
    })
    const offStock = onStockLow(({ items }) => {
      if (items?.length) dispatch({ type: A.ADD_STOCK_ALERTS, payload: items })
    })
    return () => { offCreated?.(); offUpdated?.(); offTable?.(); offStock?.() }
  }, [])

  // ── Action creators ───────────────────────────────────────────────────────
  const addOrder = useCallback((order) =>
    dispatch({ type: A.ADD_ORDER, payload: order }), [])

  const updateOrder = useCallback((order) =>
    dispatch({ type: A.UPDATE_ORDER, payload: order }), [])

  const updateOrderStatus = useCallback(async (id, status) => {
    const updated = await ordersApi.updateStatus(id, status)
    dispatch({ type: A.UPDATE_ORDER, payload: updated })
    return updated
  }, [])

  const updateTableStatus = useCallback(async (id, status) => {
    // id = formatted "T-01" — extract the raw integer for the API call
    const rawId = parseInt(id.replace('T-', ''), 10)
    const updated = await tablesApi.updateStatus(rawId, status)
    dispatch({ type: A.UPDATE_TABLE, payload: updated })
    return updated
  }, [])

  const updateTable = useCallback((tableData) =>
    dispatch({ type: A.UPDATE_TABLE, payload: tableData }), [])

  const addTableToContext = useCallback((table) =>
    dispatch({ type: A.ADD_TABLE, payload: table }), [])

  const removeTableFromContext = useCallback((id) =>
    dispatch({ type: A.REMOVE_TABLE, payload: id }), [])

  const addMenuItem = useCallback((item) =>
    dispatch({ type: A.ADD_MENU_ITEM, payload: item }), [])

  const updateMenuItem = useCallback((item) =>
    dispatch({ type: A.UPDATE_MENU_ITEM, payload: item }), [])

  const toggleMenuItemAvailability = useCallback(async (id) => {
    const rawId = parseInt(id.replace('MI-', ''))
    const updated = await menuApi.toggleAvail(rawId)
    dispatch({ type: A.UPDATE_MENU_ITEM, payload: updated })
    return updated
  }, [])

  const toggleSidebar = useCallback(() =>
    dispatch({ type: A.TOGGLE_SIDEBAR }), [])

  const dismissStockAlert = useCallback((_key) =>
    dispatch({ type: A.DISMISS_STOCK_ALERT, payload: _key }), [])

  return (
    <AppContext.Provider
      value={{
        ...state,
        addOrder,
        updateOrder,
        updateOrderStatus,
        updateTableStatus,
        updateTable,
        addTableToContext,
        removeTableFromContext,
        addMenuItem,
        updateMenuItem,
        toggleMenuItemAvailability,
        toggleSidebar,
        dismissStockAlert,
      }}
    >
      {children}
    </AppContext.Provider>
  )
}

export function useApp() {
  const ctx = useContext(AppContext)
  if (!ctx) throw new Error('useApp must be used within AppProvider')
  return ctx
}
