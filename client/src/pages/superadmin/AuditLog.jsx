import { useState, useEffect, useCallback } from 'react'
import { ScrollText, ChevronLeft, ChevronRight, Search, Filter } from 'lucide-react'
import clsx from 'clsx'
import { superadminApi } from '../../services/api'
import { APP_TIME_ZONE } from '../../utils/formatters'

// ─── Action badge colour map ──────────────────────────────────────────────────
const ACTION_COLORS = {
  'restaurant.created':       'bg-emerald-900/40 text-emerald-400 border-emerald-700/40',
  'restaurant.updated':       'bg-blue-900/40    text-blue-400    border-blue-700/40',
  'restaurant.status_changed':'bg-amber-900/40   text-amber-400   border-amber-700/40',
  'restaurant.deleted':       'bg-red-900/40     text-red-400     border-red-700/40',
  'staff.created':            'bg-violet-900/40  text-violet-400  border-violet-700/40',
  'staff.password_reset':     'bg-orange-900/40  text-orange-400  border-orange-700/40',
  'admin.created':            'bg-cyan-900/40    text-cyan-400    border-cyan-700/40',
  'admin.deleted':            'bg-red-900/40     text-red-400     border-red-700/40',
  'broadcast.sent':           'bg-indigo-900/40  text-indigo-400  border-indigo-700/40',
}

const ACTION_OPTIONS = [
  'restaurant.created', 'restaurant.updated', 'restaurant.status_changed', 'restaurant.deleted',
  'staff.created', 'staff.password_reset',
  'admin.created', 'admin.deleted',
  'broadcast.sent',
]

function ActionBadge({ action }) {
  const cls = ACTION_COLORS[action] || 'bg-gray-800 text-gray-400 border-gray-700'
  return (
    <span className={clsx('inline-flex items-center text-[10px] font-medium px-2 py-0.5 rounded-full border', cls)}>
      {action}
    </span>
  )
}

function DetailsCell({ details }) {
  const [open, setOpen] = useState(false)
  if (!details || !Object.keys(details).length) return <span className="text-gray-700 text-xs">—</span>
  return (
    <div>
      <button onClick={() => setOpen(o => !o)}
        className="text-xs text-violet-400 hover:text-violet-300 transition-colors">
        {open ? 'hide' : 'show'}
      </button>
      {open && (
        <pre className="mt-1 text-[10px] text-gray-400 bg-gray-800 rounded-lg p-2 max-w-xs overflow-x-auto">
          {JSON.stringify(details, null, 2)}
        </pre>
      )}
    </div>
  )
}

export default function AuditLog() {
  const [logs,    setLogs]    = useState([])
  const [total,   setTotal]   = useState(0)
  const [pages,   setPages]   = useState(1)
  const [page,    setPage]    = useState(1)
  const [loading, setLoading] = useState(true)

  const [filters, setFilters] = useState({ action: '', restaurantId: '', from: '', to: '' })

  const load = useCallback(async (pg = 1) => {
    setLoading(true)
    try {
      const params = { page: pg }
      if (filters.action)       params.action       = filters.action
      if (filters.restaurantId) params.restaurantId = filters.restaurantId
      if (filters.from)         params.from         = filters.from
      if (filters.to)           params.to           = filters.to

      const data = await superadminApi.getAuditLog(params)
      setLogs(data.logs)
      setTotal(data.total)
      setPages(data.pages)
      setPage(pg)
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }, [filters])

  useEffect(() => { load(1) }, [load])

  const fmtDate = (iso) => {
    if (!iso) return '—'
    const d = new Date(iso)
    return d.toLocaleString('en', { month:'short', day:'numeric', hour:'2-digit', minute:'2-digit', timeZone: APP_TIME_ZONE })
  }

  const setF = (k, v) => setFilters(f => ({ ...f, [k]: v }))

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-white">Audit Log</h1>
          <p className="text-sm text-gray-500 mt-0.5">All SuperAdmin actions — {total} entries</p>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-gray-900 border border-gray-800 rounded-2xl p-4">
        <div className="flex items-center gap-2 mb-3">
          <Filter size={13} className="text-gray-500" />
          <span className="text-xs font-medium text-gray-500">Filters</span>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div>
            <label className="block text-xs text-gray-600 mb-1">Action</label>
            <select
              className="w-full bg-gray-800 border border-gray-700 text-gray-300 text-xs rounded-xl px-3 py-2 focus:outline-none focus:border-violet-500"
              value={filters.action}
              onChange={e => setF('action', e.target.value)}
            >
              <option value="">All actions</option>
              {ACTION_OPTIONS.map(a => <option key={a} value={a}>{a}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs text-gray-600 mb-1">Restaurant ID</label>
            <input
              className="w-full bg-gray-800 border border-gray-700 text-gray-300 text-xs rounded-xl px-3 py-2 focus:outline-none focus:border-violet-500 placeholder-gray-700"
              placeholder="e.g. 3"
              value={filters.restaurantId}
              onChange={e => setF('restaurantId', e.target.value)}
            />
          </div>
          <div>
            <label className="block text-xs text-gray-600 mb-1">From date</label>
            <input type="date"
              className="w-full bg-gray-800 border border-gray-700 text-gray-300 text-xs rounded-xl px-3 py-2 focus:outline-none focus:border-violet-500"
              value={filters.from}
              onChange={e => setF('from', e.target.value)}
            />
          </div>
          <div>
            <label className="block text-xs text-gray-600 mb-1">To date</label>
            <input type="date"
              className="w-full bg-gray-800 border border-gray-700 text-gray-300 text-xs rounded-xl px-3 py-2 focus:outline-none focus:border-violet-500"
              value={filters.to}
              onChange={e => setF('to', e.target.value)}
            />
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center h-40 text-gray-500 text-sm">
            <div className="w-5 h-5 border-2 border-violet-500 border-t-transparent rounded-full animate-spin mr-3" />
            Loading…
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[700px]">
              <thead>
                <tr className="border-b border-gray-800">
                  <th className="text-left text-xs font-medium text-gray-500 px-4 py-3 w-36">Time</th>
                  <th className="text-left text-xs font-medium text-gray-500 px-4 py-3">Actor</th>
                  <th className="text-left text-xs font-medium text-gray-500 px-4 py-3">Action</th>
                  <th className="text-left text-xs font-medium text-gray-500 px-4 py-3">Restaurant</th>
                  <th className="text-left text-xs font-medium text-gray-500 px-4 py-3">Details</th>
                </tr>
              </thead>
              <tbody>
                {logs.map(log => (
                  <tr key={log.id} className="border-b border-gray-800/50 last:border-0 hover:bg-gray-800/20 transition-colors">
                    <td className="px-4 py-3 text-xs text-gray-500 whitespace-nowrap">{fmtDate(log.createdAt)}</td>
                    <td className="px-4 py-3">
                      <p className="text-xs text-gray-300 truncate max-w-[160px]">{log.actorEmail || '—'}</p>
                    </td>
                    <td className="px-4 py-3">
                      <ActionBadge action={log.action} />
                    </td>
                    <td className="px-4 py-3">
                      {log.restaurantName
                        ? <span className="text-xs text-gray-400">{log.restaurantName}</span>
                        : <span className="text-xs text-gray-700">—</span>}
                    </td>
                    <td className="px-4 py-3">
                      <DetailsCell details={log.details} />
                    </td>
                  </tr>
                ))}
                {!logs.length && (
                  <tr>
                    <td colSpan={5} className="px-4 py-12 text-center text-gray-600 text-sm">
                      No audit entries found
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        {pages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-gray-800">
            <span className="text-xs text-gray-600">Page {page} of {pages}</span>
            <div className="flex gap-2">
              <button
                disabled={page <= 1}
                onClick={() => load(page - 1)}
                className="p-1.5 rounded-lg text-gray-500 hover:text-gray-200 hover:bg-gray-800 disabled:opacity-30 transition-colors"
              >
                <ChevronLeft size={14} />
              </button>
              <button
                disabled={page >= pages}
                onClick={() => load(page + 1)}
                className="p-1.5 rounded-lg text-gray-500 hover:text-gray-200 hover:bg-gray-800 disabled:opacity-30 transition-colors"
              >
                <ChevronRight size={14} />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
