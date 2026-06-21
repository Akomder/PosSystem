import { useState, useEffect, useMemo } from 'react'
import {
  Package, Plus, Minus, History, AlertTriangle, CheckCircle,
  XCircle, Search, RefreshCw, TrendingUp, TrendingDown,
} from 'lucide-react'
import clsx from 'clsx'
import { menuApi } from '../services/api'
import { formatDate } from '../utils/formatters'

// ─── Status helpers ───────────────────────────────────────────────────────────
function stockStatus(item) {
  if (item.stockQuantity == null) return 'untracked'
  if (item.stockQuantity <= 0)    return 'out'
  if (item.stockQuantity <= item.lowStockThreshold) return 'low'
  return 'ok'
}

const STATUS_CONFIG = {
  ok:        { label: 'In Stock',   color: 'text-green-600 dark:text-green-400',  bg: 'bg-green-50 dark:bg-green-900/20',  icon: CheckCircle  },
  low:       { label: 'Low Stock',  color: 'text-amber-600 dark:text-amber-400',  bg: 'bg-amber-50 dark:bg-amber-900/20',  icon: AlertTriangle },
  out:       { label: 'Out',        color: 'text-red-600 dark:text-red-400',      bg: 'bg-red-50 dark:bg-red-900/20',      icon: XCircle       },
  untracked: { label: 'Untracked',  color: 'text-gray-400 dark:text-gray-500',    bg: 'bg-gray-50 dark:bg-gray-800',       icon: Package       },
}

// ─── Adjust Stock Modal ───────────────────────────────────────────────────────
function AdjustModal({ item, onClose, onSaved }) {
  const [mode,   setMode]   = useState('add')   // 'add' | 'remove' | 'set'
  const [qty,    setQty]    = useState('')
  const [reason, setReason] = useState('')
  const [saving, setSaving] = useState(false)
  const [error,  setError]  = useState('')

  const current = item.stockQuantity ?? 0

  async function handleSave() {
    const num = parseFloat(qty)
    if (!num || num <= 0) { setError('Enter a valid quantity'); return }
    let adjustment
    if (mode === 'add')    adjustment = num
    if (mode === 'remove') adjustment = -num
    if (mode === 'set')    adjustment = num - current
    if (adjustment === 0)  { setError('No change'); return }
    setSaving(true)
    setError('')
    try {
      const updated = await menuApi.adjustStock(item.id, adjustment, reason || modeLabel())
      onSaved(updated)
      onClose()
    } catch (err) {
      setError(err?.response?.data?.error || err.message || 'Failed')
    } finally { setSaving(false) }
  }

  function modeLabel() {
    return mode === 'add' ? 'Restock' : mode === 'remove' ? 'Removal / shrinkage' : 'Manual set'
  }

  const previewQty = () => {
    const n = parseFloat(qty) || 0
    if (mode === 'add')    return Math.max(0, current + n)
    if (mode === 'remove') return Math.max(0, current - n)
    if (mode === 'set')    return Math.max(0, n)
    return current
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-sm mx-4 overflow-hidden">
        {/* Header */}
        <div className="bg-teal-600 px-5 py-4 text-white">
          <p className="font-bold text-base">{item.name}</p>
          <p className="text-xs text-teal-100 mt-0.5">
            Current stock: <strong>{current}</strong>
            {item.lowStockThreshold ? ` · Alert below ${item.lowStockThreshold}` : ''}
          </p>
        </div>

        <div className="p-5 space-y-4">
          {/* Mode tabs */}
          <div className="flex gap-1 bg-gray-100 dark:bg-gray-700 rounded-xl p-1">
            {[
              { key: 'add',    label: 'Add Stock',   icon: Plus      },
              { key: 'remove', label: 'Remove',       icon: Minus     },
              { key: 'set',    label: 'Set to',       icon: RefreshCw },
            ].map(({ key, label, icon: Icon }) => (
              <button
                key={key}
                onClick={() => { setMode(key); setQty(''); setError('') }}
                className={clsx(
                  'flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-xs font-medium transition-colors',
                  mode === key
                    ? 'bg-white dark:bg-gray-600 text-gray-900 dark:text-gray-100 shadow-sm'
                    : 'text-gray-500 dark:text-gray-400'
                )}
              >
                <Icon size={12} />
                {label}
              </button>
            ))}
          </div>

          {/* Quantity input */}
          <div>
            <label className="text-xs font-semibold text-gray-600 dark:text-gray-400 block mb-1">
              {mode === 'set' ? 'New total quantity' : 'Quantity'}
            </label>
            <input
              type="number"
              min={0}
              step={1}
              autoFocus
              value={qty}
              onChange={e => { setQty(e.target.value); setError('') }}
              onKeyDown={e => e.key === 'Enter' && handleSave()}
              placeholder="0"
              className="w-full text-2xl font-bold text-center py-3 border-2 border-gray-200 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:border-teal-500"
            />
          </div>

          {/* Preview */}
          {qty !== '' && !isNaN(parseFloat(qty)) && (
            <div className="flex items-center justify-between px-4 py-2.5 bg-gray-50 dark:bg-gray-700/50 rounded-xl text-sm">
              <span className="text-gray-500 dark:text-gray-400">After adjustment</span>
              <span className="font-bold text-teal-600 dark:text-teal-400 text-lg">{previewQty()}</span>
            </div>
          )}

          {/* Reason */}
          <div>
            <label className="text-xs font-semibold text-gray-600 dark:text-gray-400 block mb-1">Reason (optional)</label>
            <input
              type="text"
              value={reason}
              onChange={e => setReason(e.target.value)}
              placeholder={modeLabel()}
              className="w-full text-sm border border-gray-200 dark:border-gray-600 rounded-xl px-3 py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-teal-500"
            />
          </div>

          {error && <p className="text-xs text-red-600 dark:text-red-400">{error}</p>}
        </div>

        <div className="flex gap-2 px-5 pb-5">
          <button onClick={onClose} className="flex-1 py-2.5 rounded-xl bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 text-sm font-medium hover:bg-gray-200 transition-colors">
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving || !qty}
            className="flex-[2] flex items-center justify-center gap-2 py-2.5 rounded-xl bg-teal-600 hover:bg-teal-700 text-white text-sm font-semibold disabled:opacity-40 transition-colors"
          >
            {saving ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : null}
            {mode === 'add' ? 'Add Stock' : mode === 'remove' ? 'Remove Stock' : 'Set Stock'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── History Panel ────────────────────────────────────────────────────────────
function HistoryPanel({ itemId, onClose }) {
  const [logs,    setLogs]    = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    menuApi.getStockHistory({ itemId, limit: 50 })
      .then(setLogs)
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [itemId])

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="bg-white dark:bg-gray-800 rounded-t-2xl sm:rounded-2xl shadow-2xl w-full max-w-md mx-0 sm:mx-4 max-h-[70vh] flex flex-col overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 dark:border-gray-700">
          <p className="font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2"><History size={16} /> Adjustment History</p>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700"><XCircle size={18} className="text-gray-400" /></button>
        </div>
        <div className="overflow-y-auto flex-1">
          {loading ? (
            <div className="flex justify-center py-10"><div className="w-5 h-5 border-2 border-teal-500 border-t-transparent rounded-full animate-spin" /></div>
          ) : logs.length === 0 ? (
            <p className="text-center py-10 text-sm text-gray-400">No adjustments yet</p>
          ) : (
            <div className="divide-y divide-gray-100 dark:divide-gray-700">
              {logs.map(log => (
                <div key={log.id} className="flex items-center gap-3 px-5 py-3">
                  <div className={clsx(
                    'flex items-center justify-center w-8 h-8 rounded-full flex-shrink-0',
                    log.adjustment > 0 ? 'bg-green-100 dark:bg-green-900/30' : 'bg-red-100 dark:bg-red-900/30'
                  )}>
                    {log.adjustment > 0
                      ? <TrendingUp size={14} className="text-green-600 dark:text-green-400" />
                      : <TrendingDown size={14} className="text-red-500 dark:text-red-400" />
                    }
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-800 dark:text-gray-200">
                      {log.adjustment > 0 ? '+' : ''}{log.adjustment} units
                    </p>
                    <p className="text-xs text-gray-400 truncate">{log.reason || '—'} · {log.staffName}</p>
                  </div>
                  <p className="text-xs text-gray-400 flex-shrink-0">{formatDate(log.createdAt)}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── Main Stock Page ──────────────────────────────────────────────────────────
export default function Stock() {
  const [items,      setItems]      = useState([])
  const [loading,    setLoading]    = useState(true)
  const [search,     setSearch]     = useState('')
  const [catFilter,  setCatFilter]  = useState('All')
  const [statusFilter, setStatusFilter] = useState('all') // 'all'|'ok'|'low'|'out'|'untracked'
  const [adjustItem, setAdjustItem] = useState(null)
  const [historyItem, setHistoryItem] = useState(null)

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    try { setItems(await menuApi.getAll()) } catch (_) {}
    setLoading(false)
  }

  function handleSaved(updated) {
    setItems(prev => prev.map(i =>
      i.id === updated.id ? { ...i, stockQuantity: updated.stockQuantity } : i
    ))
  }

  const categories = useMemo(() => {
    const cats = [...new Set(items.map(i => i.category).filter(Boolean))].sort()
    return ['All', ...cats]
  }, [items])

  const filtered = useMemo(() => {
    return items.filter(item => {
      if (catFilter !== 'All' && item.category !== catFilter) return false
      if (search && !item.name.toLowerCase().includes(search.toLowerCase())) return false
      if (statusFilter !== 'all' && stockStatus(item) !== statusFilter) return false
      return true
    })
  }, [items, catFilter, search, statusFilter])

  // Summary counts
  const counts = useMemo(() => {
    const tracked = items.filter(i => i.stockQuantity != null)
    return {
      total:     items.length,
      tracked:   tracked.length,
      out:       tracked.filter(i => i.stockQuantity <= 0).length,
      low:       tracked.filter(i => i.stockQuantity > 0 && i.stockQuantity <= i.lowStockThreshold).length,
    }
  }, [items])

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100">Stock Management</h2>
          <p className="text-sm text-gray-400 dark:text-gray-500 mt-0.5">Track, restock, and monitor inventory levels</p>
        </div>
        <button onClick={load} className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 text-xs font-medium hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors">
          <RefreshCw size={13} />
          Refresh
        </button>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Total Items',   value: counts.total,   color: 'text-gray-700 dark:text-gray-200',  bg: 'bg-white dark:bg-gray-800' },
          { label: 'Tracked',       value: counts.tracked, color: 'text-teal-600 dark:text-teal-400',  bg: 'bg-teal-50 dark:bg-teal-900/20' },
          { label: 'Low Stock',     value: counts.low,     color: 'text-amber-600 dark:text-amber-400',bg: 'bg-amber-50 dark:bg-amber-900/20' },
          { label: 'Out of Stock',  value: counts.out,     color: 'text-red-600 dark:text-red-400',    bg: 'bg-red-50 dark:bg-red-900/20' },
        ].map(c => (
          <div key={c.label} className={clsx('rounded-xl px-4 py-3 border border-gray-100 dark:border-gray-700', c.bg)}>
            <p className={clsx('text-2xl font-bold', c.color)}>{c.value}</p>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{c.label}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2 items-center">
        {/* Search */}
        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            placeholder="Search items…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-8 pr-3 py-1.5 text-sm border border-gray-200 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-teal-500 w-44"
          />
        </div>

        {/* Category pills */}
        <div className="flex gap-1.5 flex-wrap">
          {categories.map(cat => (
            <button
              key={cat}
              onClick={() => setCatFilter(cat)}
              className={clsx(
                'px-3 py-1 rounded-full text-xs font-medium transition-colors',
                catFilter === cat
                  ? 'bg-teal-600 text-white'
                  : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600'
              )}
            >
              {cat}
            </button>
          ))}
        </div>

        {/* Status filter */}
        <div className="flex gap-1.5 ml-auto flex-wrap">
          {[
            { key: 'all', label: 'All' },
            { key: 'ok',  label: 'In Stock' },
            { key: 'low', label: 'Low' },
            { key: 'out', label: 'Out' },
          ].map(f => (
            <button
              key={f.key}
              onClick={() => setStatusFilter(f.key)}
              className={clsx(
                'px-3 py-1 rounded-full text-xs font-medium transition-colors',
                statusFilter === f.key
                  ? 'bg-gray-800 dark:bg-gray-200 text-white dark:text-gray-900'
                  : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600'
              )}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      {loading ? (
        <div className="flex justify-center py-16">
          <div className="w-6 h-6 border-2 border-teal-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-xs text-gray-500 dark:text-gray-400 uppercase border-b border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/80">
                  <th className="px-4 py-3 text-left">Item</th>
                  <th className="px-4 py-3 text-left">Category</th>
                  <th className="px-4 py-3 text-right">Current Stock</th>
                  <th className="px-4 py-3 text-right">Alert Below</th>
                  <th className="px-4 py-3 text-center">Status</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50 dark:divide-gray-700">
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-12 text-center text-sm text-gray-400">No items match the filter</td>
                  </tr>
                ) : filtered.map(item => {
                  const status = stockStatus(item)
                  const cfg    = STATUS_CONFIG[status]
                  const Icon   = cfg.icon
                  return (
                    <tr key={item.id} className={clsx('hover:bg-gray-50 dark:hover:bg-gray-700/40 transition-colors', status === 'out' && 'bg-red-50/40 dark:bg-red-900/10')}>
                      {/* Item */}
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          {item.imageUrl ? (
                            <img src={item.imageUrl} alt="" className="w-9 h-9 rounded-lg object-cover flex-shrink-0 bg-gray-100" />
                          ) : (
                            <div className="w-9 h-9 rounded-lg bg-gray-100 dark:bg-gray-700 flex items-center justify-center flex-shrink-0">
                              <Package size={16} className="text-gray-400" />
                            </div>
                          )}
                          <div>
                            <p className="font-medium text-gray-900 dark:text-gray-100">{item.name}</p>
                            {item.productCode && <p className="text-xs text-gray-400">{item.productCode}</p>}
                          </div>
                        </div>
                      </td>

                      {/* Category */}
                      <td className="px-4 py-3 text-gray-500 dark:text-gray-400">{item.category || '—'}</td>

                      {/* Current stock */}
                      <td className="px-4 py-3 text-right">
                        {item.stockQuantity != null
                          ? <span className={clsx('font-bold text-base', status === 'out' ? 'text-red-600 dark:text-red-400' : status === 'low' ? 'text-amber-600 dark:text-amber-400' : 'text-gray-900 dark:text-gray-100')}>{item.stockQuantity}</span>
                          : <span className="text-gray-300 dark:text-gray-600">—</span>
                        }
                      </td>

                      {/* Alert threshold */}
                      <td className="px-4 py-3 text-right text-gray-400 dark:text-gray-500">
                        {item.lowStockThreshold ?? '—'}
                      </td>

                      {/* Status badge */}
                      <td className="px-4 py-3">
                        <div className="flex justify-center">
                          <span className={clsx('flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold', cfg.bg, cfg.color)}>
                            <Icon size={11} />
                            {cfg.label}
                          </span>
                        </div>
                      </td>

                      {/* Actions */}
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => setHistoryItem(item)}
                            title="View history"
                            className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                          >
                            <History size={15} />
                          </button>
                          <button
                            onClick={() => setAdjustItem(item)}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-teal-50 dark:bg-teal-900/20 text-teal-700 dark:text-teal-300 hover:bg-teal-100 dark:hover:bg-teal-900/40 text-xs font-semibold transition-colors"
                          >
                            <Plus size={13} />
                            Adjust
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Adjust Modal */}
      {adjustItem && (
        <AdjustModal
          item={adjustItem}
          onClose={() => setAdjustItem(null)}
          onSaved={handleSaved}
        />
      )}

      {/* History Panel */}
      {historyItem && (
        <HistoryPanel
          itemId={historyItem.id}
          onClose={() => setHistoryItem(null)}
        />
      )}
    </div>
  )
}
