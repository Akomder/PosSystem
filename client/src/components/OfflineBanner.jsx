import { useState, useEffect, useCallback } from 'react'
import { WifiOff, Wifi, CheckCircle, RefreshCw } from 'lucide-react'
import clsx from 'clsx'
import { getPendingOrders, markSynced } from '../lib/offlineDb'
import { ordersApi } from '../services/api'

/**
 * OfflineBanner
 *
 * A fixed top banner that:
 *   • Turns amber when the device goes offline
 *   • Automatically syncs queued orders when connection is restored
 *   • Shows a brief green confirmation once sync is complete
 *
 * Place it inside the outermost provider wrapper (App.jsx) so it renders
 * on every page, including the full-screen Sell & Kitchen screens.
 */
export default function OfflineBanner() {
  const [isOnline,  setIsOnline]  = useState(navigator.onLine)
  const [phase,     setPhase]     = useState('idle') // 'idle' | 'syncing' | 'done'
  const [syncCount, setSyncCount] = useState(0)

  // ── Sync pending orders ────────────────────────────────────────────────────
  const syncPending = useCallback(async () => {
    let pending
    try { pending = await getPendingOrders() } catch { return }
    if (!pending.length) return

    setPhase('syncing')
    setSyncCount(pending.length)

    let synced = 0
    for (const record of pending) {
      try {
        // Re-submit the order
        const order   = await ordersApi.create(record.payload)
        const rawId   = parseInt(String(order.id).replace('ORD-', ''), 10)
        await ordersApi.updateStatus(rawId, 'Closed')
        await markSynced(record.localId)
        synced++
      } catch {
        // Leave record pending — will retry next reconnect
      }
    }

    if (synced > 0) {
      setPhase('done')
      setSyncCount(synced)
      setTimeout(() => setPhase('idle'), 4500)
    } else {
      setPhase('idle')
    }
  }, [])

  // ── Online / offline listeners ─────────────────────────────────────────────
  useEffect(() => {
    const onOnline  = () => { setIsOnline(true);  syncPending() }
    const onOffline = () => { setIsOnline(false); setPhase('idle') }

    window.addEventListener('online',  onOnline)
    window.addEventListener('offline', onOffline)
    return () => {
      window.removeEventListener('online',  onOnline)
      window.removeEventListener('offline', onOffline)
    }
  }, [syncPending])

  // Don't paint anything if online and nothing to show
  if (isOnline && phase === 'idle') return null

  const isAmber = !isOnline
  const isGreen = isOnline && (phase === 'syncing' || phase === 'done')

  return (
    <div
      role="status"
      aria-live="polite"
      className={clsx(
        'fixed top-0 inset-x-0 z-[70] flex items-center justify-center gap-2',
        'py-2 px-4 text-xs font-semibold tracking-wide transition-colors duration-300',
        isAmber && 'bg-amber-500 text-white',
        isGreen && 'bg-emerald-500 text-white',
      )}
    >
      {/* ── Offline ── */}
      {isAmber && (
        <>
          <WifiOff size={13} />
          <span>You're offline — orders will sync when connection is restored</span>
        </>
      )}

      {/* ── Syncing ── */}
      {isGreen && phase === 'syncing' && (
        <>
          <RefreshCw size={13} className="animate-spin" />
          <span>
            Back online — syncing {syncCount} order{syncCount !== 1 ? 's' : ''}…
          </span>
        </>
      )}

      {/* ── Done ── */}
      {isGreen && phase === 'done' && (
        <>
          <CheckCircle size={13} />
          <span>
            {syncCount} order{syncCount !== 1 ? 's' : ''} synced successfully
          </span>
          <Wifi size={13} className="ml-1 opacity-70" />
        </>
      )}
    </div>
  )
}
