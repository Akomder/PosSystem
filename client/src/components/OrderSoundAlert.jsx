/**
 * OrderSoundAlert
 *
 * Plays an audible alert, shows a persistent toast, and fires a browser
 * notification whenever a new customer order arrives or a customer adds
 * items to an existing order.
 *
 * Rendered inside Layout — always active on every protected page.
 * Only fires for Admin, Cashier, and Waiter roles (not SuperAdmin).
 *
 * Web Audio requires a user gesture before sounds can play.
 * Browser Notifications require explicit permission (requested on mount).
 */
import { useState, useEffect, useRef, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { Bell, X, ShoppingBag, Plus } from 'lucide-react'
import clsx from 'clsx'
import { onOrderCreated, onOrderItemsAdded } from '../services/socket'
import { playCashierAlert, unlock, isUnlocked } from '../lib/soundAlert'
import { useSettings } from '../context/SettingsContext'
import { useAuth } from '../context/AuthContext'

// ── Browser Notification helper ───────────────────────────────────────────────
function requestNotifPermission() {
  if ('Notification' in window && Notification.permission === 'default') {
    Notification.requestPermission().catch(() => {})
  }
}

function showBrowserNotif(title, body, tag, onClickPath, navigate) {
  if (!('Notification' in window) || Notification.permission !== 'granted') return
  try {
    const n = new Notification(title, {
      body,
      icon: '/favicon.svg',
      badge: '/favicon.svg',
      tag,               // deduplicates identical order events
      requireInteraction: true,  // stays until staff dismisses
    })
    n.onclick = () => {
      window.focus()
      navigate(onClickPath)
      n.close()
    }
  } catch {}
}

export default function OrderSoundAlert() {
  const { user }   = useAuth()
  const { t }      = useSettings()
  const navigate   = useNavigate()
  const [soundEnabled, setSoundEnabled] = useState(false)
  const [toasts,       setToasts]       = useState([])   // [{ id, label, type }]
  const toastIdRef = useRef(0)

  // ── Roles that get cashier alerts ────────────────────────────────────────────
  const eligible = user && ['Admin', 'Cashier', 'Waiter', 'Chef'].includes(user.role)

  // ── Read setting from localStorage (default ON) ───────────────────────────────
  const [alertsOn, setAlertsOn] = useState(() => {
    const stored = localStorage.getItem('pos_sound_alerts')
    return stored === null ? true : stored === 'true'
  })

  // Keep in sync if another tab changes it
  useEffect(() => {
    const handler = (e) => {
      if (e.key === 'pos_sound_alerts') setAlertsOn(e.newValue !== 'false')
    }
    window.addEventListener('storage', handler)
    return () => window.removeEventListener('storage', handler)
  }, [])

  // ── Request browser notification permission on mount ─────────────────────────
  useEffect(() => {
    if (!eligible || !alertsOn) return
    requestNotifPermission()
  }, [eligible, alertsOn])

  // ── Unlock audio on first interaction ────────────────────────────────────────
  useEffect(() => {
    if (!eligible || !alertsOn) return
    if (isUnlocked()) { setSoundEnabled(true); return }
    const handleInteraction = () => {
      unlock()
      setSoundEnabled(true)
    }
    window.addEventListener('pointerdown', handleInteraction, { once: true })
    return () => window.removeEventListener('pointerdown', handleInteraction)
  }, [eligible, alertsOn])

  // ── Toast helper — toasts are persistent (require manual dismiss) ─────────────
  const addToast = useCallback((label, type = 'new') => {
    const id = ++toastIdRef.current
    setToasts(prev => [...prev, { id, label, type }])
  }, [])

  const dismissToast = useCallback((id) => {
    setToasts(prev => prev.filter(t => t.id !== id))
  }, [])

  // ── Socket subscription: new order ───────────────────────────────────────────
  useEffect(() => {
    if (!eligible || !alertsOn) return
    const off = onOrderCreated(({ order }) => {
      if (!order) return
      playCashierAlert()
      const where = order.tableNumber
        ? `Table ${order.tableNumber}`
        : (order.orderType || 'Order')
      const count = order.items?.length ?? 0
      const label = `${order.id} · ${where} · ${count} item${count !== 1 ? 's' : ''}`
      addToast(label, 'new')
      showBrowserNotif('🛎️ New Order!', label, `order-${order.id}`, '/orders', navigate)
    })
    return () => off?.()
  }, [eligible, alertsOn, addToast, navigate])

  // ── Socket subscription: customer added items to existing order ───────────────
  useEffect(() => {
    if (!eligible || !alertsOn) return
    const off = onOrderItemsAdded(({ order }) => {
      if (!order) return
      playCashierAlert()
      const where = order.tableNumber
        ? `Table ${order.tableNumber}`
        : (order.orderType || 'Order')
      const count = order.items?.length ?? 0
      const label = `${order.id} · ${where} · ${count} item${count !== 1 ? 's' : ''}`
      addToast(label, 'added')
      showBrowserNotif('➕ Items Added', label, `items-${order.id}-${Date.now()}`, '/orders', navigate)
    })
    return () => off?.()
  }, [eligible, alertsOn, addToast, navigate])

  if (!eligible || !alertsOn) return null

  return (
    <>
      {/* ── Sound unlock chip (shown until user interacts) ── */}
      {!soundEnabled && (
        <div
          className="fixed bottom-4 left-1/2 -translate-x-1/2 z-[60]
                     flex items-center gap-2 px-4 py-2 rounded-full
                     bg-gray-800/90 border border-gray-600 text-gray-300
                     text-xs font-medium shadow-lg backdrop-blur-sm
                     animate-pulse cursor-pointer select-none"
          onClick={() => { unlock(); setSoundEnabled(true) }}
        >
          <Bell size={13} className="text-amber-400" />
          {t('alert.enableSound')}
        </div>
      )}

      {/* ── New-order toast stack (bottom-right, persistent) ── */}
      <div className="fixed bottom-4 right-4 z-[60] flex flex-col gap-2 items-end pointer-events-none">
        {toasts.map(toast => (
          <div
            key={toast.id}
            className="pointer-events-auto flex items-center gap-3
                       bg-gray-900 border border-violet-500/50 text-white
                       text-xs font-medium px-4 py-3 rounded-2xl shadow-2xl
                       shadow-violet-500/20 animate-slide-up max-w-xs"
          >
            {/* Pulsing icon */}
            <span className="relative flex h-5 w-5 flex-shrink-0">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-violet-400 opacity-50" />
              <span className="relative inline-flex items-center justify-center rounded-full h-5 w-5 bg-violet-600">
                {toast.type === 'added'
                  ? <Plus size={11} className="text-white" />
                  : <ShoppingBag size={11} className="text-white" />
                }
              </span>
            </span>
            <div
              className="flex-1 cursor-pointer"
              onClick={() => { dismissToast(toast.id); navigate('/orders') }}
            >
              <p className="text-violet-300 text-[10px] uppercase tracking-wider font-semibold mb-0.5">
                {toast.type === 'added' ? t('alert.itemsAdded') : t('alert.newOrder')}
              </p>
              <p className="text-gray-200">{toast.label}</p>
            </div>
            <button
              onClick={() => dismissToast(toast.id)}
              className="ml-1 text-gray-500 hover:text-gray-300 transition-colors flex-shrink-0"
              title="Dismiss"
            >
              <X size={13} />
            </button>
          </div>
        ))}
      </div>
    </>
  )
}
