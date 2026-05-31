/**
 * OrderSoundAlert
 *
 * Plays an audible cashier alert and shows a brief on-screen toast
 * whenever a new order arrives via Socket.IO.
 *
 * Rendered inside Layout — always active on every protected page.
 * Only plays for Cashier, Waiter, and Admin roles (not SuperAdmin).
 *
 * Web Audio requires a user gesture before sounds can play.
 * A small "🔔 Tap to enable sound" chip is shown until the user
 * clicks anywhere on the page.
 */
import { useState, useEffect, useRef, useCallback } from 'react'
import { Bell, X, ShoppingBag } from 'lucide-react'
import clsx from 'clsx'
import { onOrderCreated } from '../services/socket'
import { playCashierAlert, unlock, isUnlocked } from '../lib/soundAlert'
import { useAuth } from '../context/AuthContext'

export default function OrderSoundAlert() {
  const { user } = useAuth()
  const [soundEnabled, setSoundEnabled] = useState(false)
  const [toasts,       setToasts]       = useState([])   // [{ id, label }]
  const toastIdRef = useRef(0)

  // ── Roles that get cashier alerts ────────────────────────────────────────────
  const eligible = user && ['Admin', 'Cashier', 'Waiter'].includes(user.role)

  // ── Unlock audio on first interaction ────────────────────────────────────────
  useEffect(() => {
    if (!eligible) return
    const handleInteraction = () => {
      unlock()
      setSoundEnabled(true)
    }
    window.addEventListener('pointerdown', handleInteraction, { once: true })
    return () => window.removeEventListener('pointerdown', handleInteraction)
  }, [eligible])

  // ── Toast helper ──────────────────────────────────────────────────────────────
  const addToast = useCallback((label) => {
    const id = ++toastIdRef.current
    setToasts(prev => [...prev, { id, label }])
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id))
    }, 5000)
  }, [])

  const dismissToast = (id) => setToasts(prev => prev.filter(t => t.id !== id))

  // ── Socket subscription ───────────────────────────────────────────────────────
  useEffect(() => {
    if (!eligible) return
    const off = onOrderCreated(({ order }) => {
      if (!order) return
      // Play sound
      playCashierAlert()
      // Show toast
      const where = order.tableNumber
        ? `Table ${order.tableNumber}`
        : (order.orderType || 'Order')
      const count = order.items?.length ?? 0
      addToast(`${order.id} · ${where} · ${count} item${count !== 1 ? 's' : ''}`)
    })
    return () => off?.()
  }, [eligible, addToast])

  if (!eligible) return null

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
          Tap anywhere to enable order sound alerts
        </div>
      )}

      {/* ── New-order toast stack (bottom-right) ── */}
      <div className="fixed bottom-4 right-4 z-[60] flex flex-col gap-2 items-end pointer-events-none">
        {toasts.map(toast => (
          <div
            key={toast.id}
            className="pointer-events-auto flex items-center gap-3
                       bg-gray-900 border border-violet-500/50 text-white
                       text-xs font-medium px-4 py-3 rounded-2xl shadow-2xl
                       shadow-violet-500/20 animate-slide-up"
          >
            {/* Pulsing icon */}
            <span className="relative flex h-5 w-5 flex-shrink-0">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-violet-400 opacity-50" />
              <span className="relative inline-flex items-center justify-center rounded-full h-5 w-5 bg-violet-600">
                <ShoppingBag size={11} className="text-white" />
              </span>
            </span>
            <div>
              <p className="text-violet-300 text-[10px] uppercase tracking-wider font-semibold mb-0.5">New Order</p>
              <p className="text-gray-200">{toast.label}</p>
            </div>
            <button
              onClick={() => dismissToast(toast.id)}
              className="ml-2 text-gray-500 hover:text-gray-300 transition-colors"
            >
              <X size={13} />
            </button>
          </div>
        ))}
      </div>
    </>
  )
}
