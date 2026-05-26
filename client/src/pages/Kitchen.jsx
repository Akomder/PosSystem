import { useState, useEffect, useRef, useCallback } from 'react'
import { ChefHat, Clock, CheckCircle2, Flame, Bell, RefreshCw, Utensils, Check } from 'lucide-react'
import clsx from 'clsx'
import { ordersApi } from '../services/api'
import { onOrderCreated, onOrderUpdated } from '../services/socket'
import { useSettings } from '../context/SettingsContext'

// ─── Audio alert (Web Audio API — no deps) ───────────────────────────────────
function playAlert() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)()
    const tones = [880, 660]
    tones.forEach((freq, i) => {
      const osc  = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.connect(gain)
      gain.connect(ctx.destination)
      osc.type = 'sine'
      osc.frequency.value = freq
      const t0 = ctx.currentTime + i * 0.2
      gain.gain.setValueAtTime(0, t0)
      gain.gain.linearRampToValueAtTime(0.4, t0 + 0.02)
      gain.gain.exponentialRampToValueAtTime(0.001, t0 + 0.4)
      osc.start(t0)
      osc.stop(t0 + 0.4)
    })
  } catch (_) {}
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function normalize(data) {
  if (Array.isArray(data)) return data
  if (data?.orders) return data.orders
  if (data?.data)   return data.data
  return []
}

function elapsedStr(createdAt) {
  const secs = Math.max(0, Math.floor((Date.now() - new Date(createdAt)) / 1000))
  if (secs < 60)   return `${secs}s`
  if (secs < 3600) return `${Math.floor(secs / 60)}m ${secs % 60}s`
  return `${Math.floor(secs / 3600)}h ${Math.floor((secs % 3600) / 60)}m`
}

function urgencyStyle(createdAt) {
  const mins = (Date.now() - new Date(createdAt)) / 60000
  if (mins > 15) return { border: 'border-l-red-500',     bg: 'bg-red-950/30',     timer: 'text-red-400' }
  if (mins > 8)  return { border: 'border-l-amber-400',   bg: 'bg-amber-950/20',   timer: 'text-amber-400' }
  return             { border: 'border-l-emerald-500', bg: 'bg-emerald-950/15', timer: 'text-emerald-400' }
}

// ─── Lane config (matches DB CHECK constraint) ────────────────────────────────
// Valid statuses: 'Pending' | 'In Progress' | 'Served' | 'Closed' | 'Cancelled'
// Labels use translation keys — resolved at render time via useSettings()
const LANES = [
  {
    key:          'Pending',
    labelKey:     'kitchen.lane.new',
    Icon:         Bell,
    color:        'text-amber-400',
    headerBg:     'bg-amber-500/10 border-amber-500/30',
    nextStatus:   'In Progress',
    nextLabelKey: 'kitchen.action.startCooking',
    nextCls:      'bg-emerald-600 hover:bg-emerald-500',
  },
  {
    key:          'In Progress',
    labelKey:     'kitchen.lane.cooking',
    Icon:         Flame,
    color:        'text-orange-400',
    headerBg:     'bg-orange-500/10 border-orange-500/30',
    nextStatus:   'Served',
    nextLabelKey: 'kitchen.action.markServed',
    nextCls:      'bg-sky-600 hover:bg-sky-500',
  },
  {
    key:          'Served',
    labelKey:     'kitchen.lane.served',
    Icon:         CheckCircle2,
    color:        'text-emerald-400',
    headerBg:     'bg-emerald-500/10 border-emerald-500/30',
    nextStatus:   null,
    nextLabelKey: null,
    nextCls:      null,
  },
]

const ACTIVE_STATUSES = new Set(['Pending', 'In Progress', 'Served'])

// ─── Order card ───────────────────────────────────────────────────────────────
function OrderCard({ order, onAdvance, onItemDone, selectedStation, isNew }) {
  const { t } = useSettings()
  const lane = LANES.find(l => l.key === order.status)
  const urg  = urgencyStyle(order.createdAt)
  const [, forceRender] = useState(0)

  // Local elapsed timer — ticks every 10s
  useEffect(() => {
    const id = setInterval(() => forceRender(n => n + 1), 10_000)
    return () => clearInterval(id)
  }, [])

  // Filter items by selected station (show all when 'All')
  const allItems     = order.items || []
  const visibleItems = selectedStation === 'All'
    ? allItems
    : allItems.filter(i => (i.station || 'Kitchen') === selectedStation)

  return (
    <div className={clsx(
      'border-l-4 rounded-xl p-4 shadow-xl transition-all duration-300',
      urg.border, urg.bg,
      'bg-gray-800/60 backdrop-blur-sm',
      isNew && 'ring-2 ring-amber-400',
    )}>
      {/* Card header */}
      <div className="flex items-start justify-between mb-3">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-white font-extrabold text-base tracking-tight">
              {order.id}
            </span>
            {isNew && (
              <span className="px-1.5 py-0.5 bg-amber-500 text-amber-950 text-[10px] font-black rounded-full animate-pulse">
                {t('kitchen.new')}
              </span>
            )}
          </div>
          <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
            <Utensils size={10} className="text-gray-500" />
            <span className="text-xs text-gray-400">
              {order.tableNumber ? `Table ${order.tableNumber}` : (order.orderType || 'Dine In')}
            </span>
            <span className={clsx(
              'px-1.5 py-0.5 rounded text-[10px] font-semibold',
              (order.orderType || 'Dine In') === 'Dine In'   && 'bg-teal-900/40 text-teal-300',
              (order.orderType || 'Dine In') === 'Takeaway'  && 'bg-orange-900/40 text-orange-300',
              (order.orderType || 'Dine In') === 'Delivery'  && 'bg-blue-900/40 text-blue-300',
            )}>
              {order.orderType || 'Dine In'}
            </span>
            {order.waiter && order.waiter !== 'Unassigned' && (
              <span className="px-1.5 py-0.5 bg-gray-700 rounded text-[10px] text-gray-300 font-medium">
                {order.waiter}
              </span>
            )}
          </div>
        </div>

        {/* Timer */}
        <div className={clsx('flex items-center gap-1 text-xs font-mono font-semibold', urg.timer)}>
          <Clock size={11} />
          {elapsedStr(order.createdAt)}
        </div>
      </div>

      {/* Items list */}
      <div className="space-y-2 mb-3">
        {visibleItems.length === 0 ? (
          <p className="text-xs text-gray-500 italic">{t('kitchen.noItemsForStation')}</p>
        ) : visibleItems.map((item) => {
          const done = !!item.completedAt
          return (
            <div key={item.orderItemId} className={clsx('flex items-start gap-2', done && 'opacity-40')}>
              <span className={clsx(
                'flex-shrink-0 text-xs font-bold rounded px-1.5 py-0.5 min-w-[2rem] text-center tabular-nums',
                done ? 'bg-emerald-900/60 text-emerald-400 line-through' : 'text-white bg-gray-700',
              )}>
                {item.quantity}×
              </span>
              <div className="flex-1 min-w-0">
                <p className={clsx('text-sm font-medium leading-snug', done ? 'text-gray-500 line-through' : 'text-gray-100')}>
                  {item.name || 'Item'}
                </p>
                {/* Modifier tags */}
                {!done && item.modifiers?.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-0.5">
                    {item.modifiers.map((mod, mi) => (
                      <span key={mi} className="px-1.5 py-0.5 bg-indigo-900/50 text-indigo-300 text-[10px] rounded font-medium">
                        {mod.name}{mod.priceAdjustment !== 0 ? ` (${mod.priceAdjustment > 0 ? '+' : ''}${mod.priceAdjustment})` : ''}
                      </span>
                    ))}
                  </div>
                )}
                {/* Per-item notes */}
                {!done && item.notes && (
                  <p className="text-[11px] text-amber-300/80 italic mt-0.5 leading-tight">
                    ✎ {item.notes}
                  </p>
                )}
                {/* Station badge (shown when viewing 'All') */}
                {selectedStation === 'All' && item.station && item.station !== 'Kitchen' && (
                  <span className="inline-block mt-0.5 px-1.5 py-0.5 bg-purple-900/40 text-purple-300 text-[10px] rounded font-medium">
                    {item.station}
                  </span>
                )}
              </div>
              {/* Item done button */}
              {!done && (
                <button
                  onClick={() => onItemDone(order.id, item.orderItemId)}
                  title="Mark item done"
                  className="flex-shrink-0 w-6 h-6 flex items-center justify-center bg-emerald-700/40 hover:bg-emerald-600 text-emerald-400 hover:text-white rounded-lg transition-colors mt-0.5"
                >
                  <Check size={11} />
                </button>
              )}
            </div>
          )
        })}
      </div>

      {/* Order-level notes */}
      {order.notes && (
        <div className="mb-3 px-2.5 py-1.5 bg-amber-500/10 border border-amber-500/20 rounded-lg">
          <p className="text-xs text-amber-300 italic leading-tight">"{order.notes}"</p>
        </div>
      )}

      {/* Action */}
      {lane?.nextStatus ? (
        <button
          onClick={() => onAdvance(order.id, lane.nextStatus)}
          className={clsx(
            'w-full py-2 text-white text-sm font-bold rounded-lg transition-colors tracking-wide',
            lane.nextCls,
          )}
        >
          {t(lane.nextLabelKey)}
        </button>
      ) : (
        <div className="flex items-center justify-center gap-1.5 py-1.5 text-xs font-semibold text-emerald-400">
          <CheckCircle2 size={13} />
          {t('kitchen.waitingForPickup')}
        </div>
      )}
    </div>
  )
}

// ─── Kitchen page ─────────────────────────────────────────────────────────────
export default function Kitchen() {
  const { t } = useSettings()
  const [orders,          setOrders]          = useState([])
  const [loading,         setLoading]         = useState(true)
  const [newIds,          setNewIds]          = useState(new Set())
  const [selectedStation, setSelectedStation] = useState('All')
  const audioReady = useRef(false)

  // Unlock Web Audio on first tap/click (browser policy)
  useEffect(() => {
    const unlock = () => { audioReady.current = true }
    window.addEventListener('pointerdown', unlock, { once: true })
    return () => window.removeEventListener('pointerdown', unlock)
  }, [])

  // Load active orders on mount
  useEffect(() => {
    setLoading(true)
    Promise.all(
      ['Pending', 'In Progress', 'Served'].map(s => ordersApi.getAll({ status: s }))
    )
      .then(results => {
        const all = results.flatMap(normalize)
        setOrders(all)
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  // Socket — new order incoming
  useEffect(() => {
    const off = onOrderCreated(({ order }) => {
      if (!ACTIVE_STATUSES.has(order?.status)) return
      if (audioReady.current) playAlert()
      setOrders(prev =>
        prev.find(o => o.id === order.id) ? prev : [order, ...prev]
      )
      setNewIds(prev => new Set([...prev, order.id]))
      setTimeout(() => {
        setNewIds(prev => { const s = new Set(prev); s.delete(order.id); return s })
      }, 8000)
    })
    return off
  }, [])

  // Socket — order status changed or item marked done
  useEffect(() => {
    const off = onOrderUpdated(({ order }) => {
      if (!order) return
      setOrders(prev => {
        // Remove from board when Closed or Cancelled
        if (order.status === 'Closed' || order.status === 'Cancelled')
          return prev.filter(o => o.id !== order.id)
        // Update (items may have changed completedAt) or ignore if not active
        return prev.find(o => o.id === order.id)
          ? prev.map(o => o.id === order.id ? { ...o, ...order } : o)
          : ACTIVE_STATUSES.has(order.status) ? [order, ...prev] : prev
      })
    })
    return off
  }, [])

  // Advance an order to the next status
  // id here is the formatted string 'ORD-001'; strip prefix for the API call
  const advance = useCallback(async (formattedId, status) => {
    try {
      const numericId = parseInt(String(formattedId).replace(/\D/g, ''), 10)
      await ordersApi.updateStatus(numericId, status)
      // Optimistically update local state; socket will confirm
      setOrders(prev => prev.map(o => o.id === formattedId ? { ...o, status } : o))
    } catch (_) {}
  }, [])

  // Mark a single item done (kitchen bump)
  const markItemDone = useCallback(async (formattedOrderId, itemId) => {
    try {
      const numericOrderId = parseInt(String(formattedOrderId).replace(/\D/g, ''), 10)
      const updated = await ordersApi.markItemDone(numericOrderId, itemId)
      // Replace the order with the server response (has updated completedAt)
      if (updated) setOrders(prev => prev.map(o => o.id === updated.id ? updated : o))
    } catch (_) {}
  }, [])

  // Derive unique station list from current orders
  const stations = ['All', ...Array.from(
    new Set(orders.flatMap(o => o.items.map(i => i.station || 'Kitchen')))
  ).sort()]

  const laneOrders = (key) => {
    let lane = orders
      .filter(o => o.status === key)
      .sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt))
    // When a specific station is selected, hide orders that have no items for that station
    if (selectedStation !== 'All') {
      lane = lane.filter(o =>
        o.items.some(i => (i.station || 'Kitchen') === selectedStation)
      )
    }
    return lane
  }

  const totalActive = orders.length

  return (
    <div className="min-h-screen bg-gray-950 text-white flex flex-col">

      {/* ── Top bar ───────────────────────────────────────────────────────── */}
      <header className="flex items-center justify-between px-6 py-4 border-b border-gray-800 bg-gray-900/80 backdrop-blur-sm flex-shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-orange-600 rounded-xl flex items-center justify-center shadow-lg shadow-orange-900/40">
            <ChefHat size={22} className="text-white" />
          </div>
          <div>
            <h1 className="text-lg font-extrabold text-white tracking-tight">{t('kitchen.title')}</h1>
            <p className="text-xs text-gray-400">
              {loading ? t('common.loading') : `${totalActive} ${t('kitchen.inQueue')}`}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-4">
          {/* Current time */}
          <LiveClock />

          {/* Live dot */}
          <div className="flex items-center gap-2 px-3 py-1.5 bg-gray-800 rounded-full border border-gray-700">
            <span className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse" />
            <span className="text-xs text-gray-300 font-medium">{t('kitchen.live')}</span>
          </div>
        </div>
      </header>

      {/* ── Station filter bar ──────────────────────────────────────────── */}
      {stations.length > 1 && (
        <div className="flex items-center gap-2 px-6 py-2.5 bg-gray-900 border-b border-gray-800 flex-wrap flex-shrink-0">
          {stations.map(s => (
            <button
              key={s}
              onClick={() => setSelectedStation(s)}
              className={clsx(
                'px-3 py-1 text-xs font-semibold rounded-full transition-colors',
                selectedStation === s
                  ? 'bg-orange-600 text-white shadow-sm'
                  : 'bg-gray-800 text-gray-400 border border-gray-700 hover:bg-gray-700 hover:text-gray-200',
              )}
            >
              {s}
            </button>
          ))}
        </div>
      )}

      {/* ── Board ─────────────────────────────────────────────────────────── */}
      {loading ? (
        <div className="flex-1 flex items-center justify-center">
          <RefreshCw size={32} className="text-gray-600 animate-spin" />
        </div>
      ) : (
        <div className="flex-1 grid grid-cols-3 gap-4 p-5 min-h-0">
          {LANES.map(({ key, labelKey, Icon, color, headerBg, nextStatus, nextLabelKey, nextCls }) => {
            const cards = laneOrders(key)
            return (
              <div key={key} className="flex flex-col min-h-0">

                {/* Lane header */}
                <div className={clsx(
                  'flex items-center justify-between px-4 py-3 rounded-xl border mb-3 flex-shrink-0',
                  headerBg,
                )}>
                  <div className="flex items-center gap-2">
                    <Icon size={16} className={color} />
                    <span className="font-bold text-sm text-white">{t(labelKey)}</span>
                  </div>
                  <span className={clsx(
                    'w-6 h-6 flex items-center justify-center rounded-full text-xs font-black',
                    color, 'bg-white/10',
                  )}>
                    {cards.length}
                  </span>
                </div>

                {/* Cards scroll area */}
                <div className="flex-1 overflow-y-auto space-y-3 pr-0.5 pb-2">
                  {cards.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-40 text-gray-700">
                      <Icon size={30} className="mb-2 opacity-25" />
                      <p className="text-sm opacity-50">{t('kitchen.empty')}</p>
                    </div>
                  ) : cards.map(order => (
                    <OrderCard
                      key={order.id}
                      order={order}
                      onAdvance={advance}
                      onItemDone={markItemDone}
                      selectedStation={selectedStation}
                      isNew={newIds.has(order.id)}
                    />
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ─── Live clock ───────────────────────────────────────────────────────────────
function LiveClock() {
  const [time, setTime] = useState(new Date())
  useEffect(() => {
    const id = setInterval(() => setTime(new Date()), 1000)
    return () => clearInterval(id)
  }, [])
  return (
    <span className="text-sm font-mono text-gray-400 tabular-nums">
      {time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
    </span>
  )
}
