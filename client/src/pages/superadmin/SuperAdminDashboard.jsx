import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Store, TrendingUp, ShoppingBag, Activity,
  Users, DollarSign, ArrowUpRight, Clock,
} from 'lucide-react'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell,
} from 'recharts'
import clsx from 'clsx'
import { superadminApi } from '../../services/api'

// ─── helpers ──────────────────────────────────────────────────────────────────
function fmt(n) {
  if (!n && n !== 0) return '—'
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M'
  if (n >= 1_000)     return (n / 1_000).toFixed(1) + 'K'
  return n.toLocaleString()
}
function fmtCurrency(n) { return '₭ ' + fmt(n) }
function fmtDate(d) {
  if (!d) return '—'
  return new Date(d).toLocaleTimeString('en', { hour:'2-digit', minute:'2-digit' }) + ' · ' +
         new Date(d).toLocaleDateString('en', { month:'short', day:'numeric' })
}

const STATUS_COLORS = {
  Pending:     'bg-yellow-500/20 text-yellow-400',
  'In Progress':'bg-blue-500/20 text-blue-400',
  Served:      'bg-green-500/20 text-green-400',
  Closed:      'bg-gray-500/20 text-gray-400',
}

const CHART_COLORS = [
  '#7c3aed','#6d28d9','#5b21b6','#4c1d95','#8b5cf6','#a78bfa',
]

// ─── StatCard ─────────────────────────────────────────────────────────────────
function StatCard({ label, value, sub, icon: Icon, gradient, trend }) {
  return (
    <div className={clsx(
      'rounded-2xl p-5 border border-white/5 relative overflow-hidden',
      gradient,
    )}>
      <div className="flex items-start justify-between mb-4">
        <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center">
          <Icon size={18} className="text-white/80" />
        </div>
        {trend !== undefined && (
          <span className={clsx(
            'text-xs font-medium px-2 py-0.5 rounded-full',
            trend >= 0 ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400',
          )}>
            {trend >= 0 ? '+' : ''}{trend}%
          </span>
        )}
      </div>
      <p className="text-2xl font-bold text-white mb-1">{value}</p>
      <p className="text-xs text-white/60">{label}</p>
      {sub && <p className="text-xs text-white/40 mt-0.5">{sub}</p>}
    </div>
  )
}

// ─── CustomTooltip ────────────────────────────────────────────────────────────
function CustomTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-gray-800 border border-gray-700 rounded-xl px-3 py-2 shadow-xl">
      <p className="text-xs text-gray-400 mb-1">{label}</p>
      <p className="text-sm font-bold text-violet-300">{fmtCurrency(payload[0]?.value)}</p>
      {payload[1] && <p className="text-xs text-gray-400">{payload[1].value} orders</p>}
    </div>
  )
}

// ─── Main Component ────────────────────────────────────────────────────────────
export default function SuperAdminDashboard() {
  const [data, setData]       = useState(null)
  const [loading, setLoading] = useState(true)
  const navigate = useNavigate()

  useEffect(() => {
    superadminApi.overview()
      .then(setData)
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="flex items-center gap-3 text-gray-500">
          <div className="w-5 h-5 border-2 border-violet-500 border-t-transparent rounded-full animate-spin" />
          <span className="text-sm">Loading overview…</span>
        </div>
      </div>
    )
  }

  const s = data?.stats || {}

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-white">Super Admin Dashboard</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {new Date().toLocaleDateString('en', { weekday:'long', month:'long', day:'numeric', year:'numeric' })}
          </p>
        </div>
        <button
          onClick={() => navigate('/superadmin/restaurants')}
          className="flex items-center gap-2 px-4 py-2 bg-violet-600 hover:bg-violet-500 text-white text-sm font-medium rounded-xl transition-colors"
        >
          <Store size={15} />
          Manage Restaurants
        </button>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="Active Restaurants"
          value={s.activeRestaurants ?? 0}
          sub={`${s.totalRestaurants ?? 0} total`}
          icon={Store}
          gradient="bg-gradient-to-br from-violet-700 to-violet-900"
        />
        <StatCard
          label="Today's Revenue"
          value={fmtCurrency(s.todayRevenue ?? 0)}
          sub="All restaurants"
          icon={DollarSign}
          gradient="bg-gradient-to-br from-emerald-700 to-emerald-900"
        />
        <StatCard
          label="Today's Orders"
          value={s.todayOrders ?? 0}
          sub="All restaurants"
          icon={ShoppingBag}
          gradient="bg-gradient-to-br from-blue-700 to-blue-900"
        />
        <StatCard
          label="Active Orders"
          value={s.activeOrders ?? 0}
          sub="Currently open"
          icon={Activity}
          gradient="bg-gradient-to-br from-orange-700 to-orange-900"
        />
      </div>

      {/* Secondary stats */}
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-gray-900 rounded-2xl border border-gray-800 p-4 flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-indigo-900/40 flex items-center justify-center">
            <TrendingUp size={20} className="text-indigo-400" />
          </div>
          <div>
            <p className="text-2xl font-bold text-white">{fmtCurrency(s.monthlyRevenue ?? 0)}</p>
            <p className="text-xs text-gray-500">Monthly Revenue</p>
          </div>
        </div>
        <div className="bg-gray-900 rounded-2xl border border-gray-800 p-4 flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-pink-900/40 flex items-center justify-center">
            <Users size={20} className="text-pink-400" />
          </div>
          <div>
            <p className="text-2xl font-bold text-white">{s.totalStaff ?? 0}</p>
            <p className="text-xs text-gray-500">Total Staff</p>
          </div>
        </div>
      </div>

      {/* Charts + Table row */}
      <div className="grid grid-cols-5 gap-5">
        {/* Revenue by Restaurant chart */}
        <div className="col-span-3 bg-gray-900 rounded-2xl border border-gray-800 p-5">
          <div className="flex items-center justify-between mb-5">
            <div>
              <h3 className="text-sm font-semibold text-gray-100">Revenue by Restaurant</h3>
              <p className="text-xs text-gray-500">Last 7 days</p>
            </div>
          </div>
          {(data?.revenueByRestaurant || []).length === 0 ? (
            <div className="flex items-center justify-center h-48 text-gray-600 text-sm">No data yet</div>
          ) : (
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={data.revenueByRestaurant} margin={{ top:0, right:0, left:-15, bottom:0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#374151" vertical={false} />
                <XAxis dataKey="name" tick={{ fill:'#9ca3af', fontSize:11 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill:'#9ca3af', fontSize:11 }} axisLine={false} tickLine={false}
                       tickFormatter={v => v >= 1000 ? `${(v/1000).toFixed(0)}K` : v} />
                <Tooltip content={<CustomTooltip />} cursor={{ fill:'rgba(255,255,255,0.03)' }} />
                <Bar dataKey="revenue" radius={[6,6,0,0]}>
                  {(data?.revenueByRestaurant || []).map((_, i) => (
                    <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Weekly trend */}
        <div className="col-span-2 bg-gray-900 rounded-2xl border border-gray-800 p-5">
          <h3 className="text-sm font-semibold text-gray-100 mb-1">Weekly Trend</h3>
          <p className="text-xs text-gray-500 mb-4">All restaurants combined</p>
          <div className="space-y-2">
            {(data?.weeklyRevenue || []).map((d, i) => {
              const maxRev = Math.max(...(data?.weeklyRevenue || []).map(x => x.revenue), 1)
              const pct    = (d.revenue / maxRev) * 100
              const isToday = i === (data?.weeklyRevenue?.length ?? 0) - 1
              return (
                <div key={i} className="flex items-center gap-3">
                  <span className={clsx('text-xs w-7 flex-shrink-0', isToday ? 'text-violet-400 font-bold' : 'text-gray-500')}>
                    {d.day}
                  </span>
                  <div className="flex-1 h-2 bg-gray-800 rounded-full overflow-hidden">
                    <div
                      className={clsx('h-full rounded-full transition-all', isToday ? 'bg-violet-500' : 'bg-gray-600')}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <span className="text-xs text-gray-400 w-14 text-right">{fmtCurrency(d.revenue)}</span>
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {/* Recent Orders */}
      <div className="bg-gray-900 rounded-2xl border border-gray-800 overflow-hidden">
        <div className="flex items-center justify-between px-5 pt-5 pb-3">
          <div>
            <h3 className="text-sm font-semibold text-gray-100">Recent Orders</h3>
            <p className="text-xs text-gray-500">Latest across all restaurants</p>
          </div>
          <button
            onClick={() => navigate('/superadmin/restaurants')}
            className="flex items-center gap-1 text-xs text-violet-400 hover:text-violet-300 transition-colors"
          >
            View restaurants <ArrowUpRight size={12} />
          </button>
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-800">
              {['Order','Restaurant','Table','Waiter','Status','Total','Time'].map(h => (
                <th key={h} className="px-4 py-2.5 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-800/60">
            {(data?.recentOrders || []).length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-gray-600 text-sm">No orders yet</td>
              </tr>
            )}
            {(data?.recentOrders || []).map(o => (
              <tr key={o.id} className="hover:bg-gray-800/40 transition-colors">
                <td className="px-4 py-3 font-mono text-xs text-violet-400">{o.id}</td>
                <td className="px-4 py-3">
                  <span className="text-xs bg-gray-800 text-gray-300 px-2 py-0.5 rounded-lg">{o.restaurantName}</span>
                </td>
                <td className="px-4 py-3 text-gray-300">#{o.tableNumber}</td>
                <td className="px-4 py-3 text-gray-400 text-xs">{o.waiter}</td>
                <td className="px-4 py-3">
                  <span className={clsx('text-xs px-2 py-0.5 rounded-full font-medium', STATUS_COLORS[o.status] || 'bg-gray-700 text-gray-400')}>
                    {o.status}
                  </span>
                </td>
                <td className="px-4 py-3 text-gray-100 font-semibold">{fmtCurrency(o.total)}</td>
                <td className="px-4 py-3 text-gray-500 text-xs">
                  <span className="flex items-center gap-1"><Clock size={10} />{fmtDate(o.createdAt)}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
