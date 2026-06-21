import { useState } from 'react'
import { Calendar, ChevronDown, X } from 'lucide-react'
import clsx from 'clsx'
import { APP_TIME_ZONE, formatDateKey } from '../../utils/formatters'

const PRESETS = [
  { label: 'Today',       getValue: () => { const d = today(); return { from: d, to: d } } },
  { label: 'Yesterday',   getValue: () => { const d = addDays(today(), -1); return { from: d, to: d } } },
  { label: 'This week',   getValue: () => ({ from: startOfWeek(), to: today() }) },
  { label: 'Last 7 days', getValue: () => ({ from: addDays(today(), -6), to: today() }) },
  { label: 'This month',  getValue: () => ({ from: startOfMonth(), to: today() }) },
  { label: 'Last month',  getValue: () => { const s = addDays(startOfMonth(), -1); return { from: startOfMonth(s), to: s } } },
  { label: 'This quarter',getValue: () => ({ from: startOfQuarter(), to: today() }) },
  { label: 'This year',   getValue: () => ({ from: startOfYear(), to: today() }) },
]

function today() {
  return formatDateKey(new Date(), APP_TIME_ZONE)
}
function addDays(dateStr, n) {
  const d = new Date(`${dateStr}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + n)
  return d.toISOString().slice(0, 10)
}
function startOfWeek() {
  const d = new Date(`${today()}T00:00:00Z`)
  const day = d.getUTCDay()
  d.setUTCDate(d.getUTCDate() - (day === 0 ? 6 : day - 1))
  return d.toISOString().slice(0, 10)
}
function startOfMonth(date) {
  const d = new Date(`${(date || today())}T00:00:00Z`)
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1)).toISOString().slice(0, 10)
}
function startOfQuarter() {
  const d = new Date(`${today()}T00:00:00Z`)
  const q = Math.floor(d.getUTCMonth() / 3) * 3
  return new Date(Date.UTC(d.getUTCFullYear(), q, 1)).toISOString().slice(0, 10)
}
function startOfYear() {
  return `${new Date(`${today()}T00:00:00Z`).getUTCFullYear()}-01-01`
}

export default function DateRangeFilter({ value, onChange, className }) {
  const [open, setOpen]     = useState(false)
  const [custom, setCustom] = useState({ from: '', to: '' })
  const [showCustom, setShowCustom] = useState(false)

  const { from, to } = value || {}

  function applyPreset(preset) {
    onChange(preset.getValue())
    setOpen(false)
    setShowCustom(false)
  }

  function applyCustom() {
    if (custom.from && custom.to) {
      onChange({ from: custom.from, to: custom.to })
      setOpen(false)
    }
  }

  function clear() {
    onChange(null)
    setOpen(false)
  }

  const label = from && to
    ? from === to ? from : `${from} → ${to}`
    : 'Date range'

  return (
    <div className={clsx('relative', className)}>
      <button
        onClick={() => setOpen(o => !o)}
        className={clsx(
          'flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-medium border transition-colors',
          from
            ? 'bg-teal-50 dark:bg-teal-900/30 border-teal-200 dark:border-teal-700 text-teal-700 dark:text-teal-300'
            : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700'
        )}
      >
        <Calendar size={14} />
        <span>{label}</span>
        {from ? (
          <X size={13} onClick={e => { e.stopPropagation(); clear() }} className="ml-0.5 hover:text-red-500" />
        ) : (
          <ChevronDown size={13} />
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-1 z-50 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl shadow-xl w-64 p-2">
          <div className="space-y-0.5">
            {PRESETS.map(p => (
              <button
                key={p.label}
                onClick={() => applyPreset(p)}
                className="w-full text-left px-3 py-2 text-sm rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
              >
                {p.label}
              </button>
            ))}
            <button
              onClick={() => setShowCustom(v => !v)}
              className="w-full text-left px-3 py-2 text-sm rounded-lg text-teal-600 dark:text-teal-400 hover:bg-teal-50 dark:hover:bg-teal-900/20 transition-colors font-medium"
            >
              Custom range…
            </button>
          </div>

          {showCustom && (
            <div className="border-t border-gray-100 dark:border-gray-700 pt-3 mt-2 space-y-2 px-1">
              <div>
                <label className="text-xs text-gray-500 dark:text-gray-400 mb-1 block">From</label>
                <input
                  type="date"
                  value={custom.from}
                  onChange={e => setCustom(c => ({ ...c, from: e.target.value }))}
                  className="w-full text-sm px-3 py-1.5 border border-gray-200 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                />
              </div>
              <div>
                <label className="text-xs text-gray-500 dark:text-gray-400 mb-1 block">To</label>
                <input
                  type="date"
                  value={custom.to}
                  onChange={e => setCustom(c => ({ ...c, to: e.target.value }))}
                  className="w-full text-sm px-3 py-1.5 border border-gray-200 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                />
              </div>
              <button
                onClick={applyCustom}
                disabled={!custom.from || !custom.to}
                className="w-full py-2 bg-teal-600 hover:bg-teal-700 disabled:opacity-50 text-white text-sm font-medium rounded-lg transition-colors"
              >
                Apply
              </button>
            </div>
          )}
        </div>
      )}

      {open && (
        <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
      )}
    </div>
  )
}
