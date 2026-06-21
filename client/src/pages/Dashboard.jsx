import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  DollarSign, ShoppingBag, LayoutGrid, Star,
  TrendingUp, Clock, Activity, AlertTriangle, ArrowUpRight,
  Zap, ChevronRight, BarChart2,
} from 'lucide-react'
import clsx from 'clsx'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  Cell, AreaChart, Area, CartesianGrid,
} from 'recharts'
import { useAuth }     from '../context/AuthContext'
import { useApp }      from '../context/AppContext'
import { useSettings } from '../context/SettingsContext'
import { statsApi, auditLogsApi } from '../services/api'
import RevenueChart   from '../components/charts/RevenueChart'
import TopDishesChart from '../components/charts/TopDishesChart'
import Badge          from '../components/ui/Badge'
import { formatCurrency, formatTime, getTodayLabel, formatRelativeTime, getCurrentHourInTimeZone } from '../utils/formatters'
import { getStatusVariant, STATUS_LABELS } from '../utils/orderHelpers'
import { getOccupancyStats } from '../utils/tableHelpers'

const CHART_PERIODS = [
  { value: 'today', label: 'Today' },
  { value: 'week',  label: '7D'    },
  { value: 'month', label: '30D'   },
  { value: 'year',  label: '1Y'    },
]

const DISH_PERIODS = [
  { value: 'today', label: 'Today' },
  { value: 'week',  label: 'Week'  },
  { value: 'month', label: 'Month' },
  { value: 'year',  label: 'Year'  },
]

// ─── Liquid Stat Card ─────────────────────────────────────────────────────────
function LiquidCard({ label, value, sub, icon: Icon, gradient, blob1, blob2, shadow, onClick }) {
  return (
    <div
      onClick={onClick}
      className={clsx(
        'relative overflow-hidden rounded-2xl p-5 text-white',
        'shadow-lg transition-all duration-300 hover:-translate-y-0.5 hover:shadow-xl',
        gradient, shadow, onClick && 'cursor-pointer',
      )}
    >
      {/* Liquid blobs */}
      <div className={clsx('absolute -top-6 -right-6 w-32 h-32 rounded-full blur-2xl opacity-50', blob1)} />
      <div className={clsx('absolute -bottom-4 -left-4 w-24 h-24 rounded-full blur-2xl opacity-40', blob2)} />
      <div className="absolute top-1/2 left-1/2 w-40 h-10 -translate-x-1/2 -translate-y-1/2 blur-3xl opacity-20 bg-white rounded-full" />

      <div className="relative z-10">
        {/* Icon + label */}
        <div className="flex items-center justify-between mb-4">
          <span className="text-xs font-semibold uppercase tracking-widest opacity-80">{label}</span>
          <div className="w-9 h-9 rounded-xl bg-white/20 backdrop-blur-sm flex items-center justify-center shadow-inner">
            <Icon size={16} />
          </div>
        </div>
        {/* Big value */}
        <p className="text-2xl font-extrabold tracking-tight leading-none mb-1.5">{value}</p>
        {/* Subtitle */}
        {sub && <p className="text-xs opacity-75 font-medium">{sub}</p>}
      </div>
    </div>
  )
}

// ─── Glass Card wrapper ────────────────────────────────────────────────────────
function GlassCard({ children, className = '', padding = true }) {
  return (
    <div className={clsx(
      'rounded-2xl bg-white dark:bg-gray-800/90 border border-gray-100 dark:border-gray-700/60',
      'shadow-sm backdrop-blur-sm',
      padding && 'p-5',
      className,
    )}>
      {children}
    </div>
  )
}

// ─── Section header ──────────────────────────────────────────────────────────
function SectionHeader({ title, subtitle, action, icon: Icon }) {
  return (
    <div className="flex items-center justify-between mb-4">
      <div className="flex items-center gap-2">
        {Icon && <Icon size={15} className="text-teal-500" />}
        <div>
          <h3 className="text-sm font-bold text-gray-900 dark:text-gray-100 leading-none">{title}</h3>
          {subtitle && <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">{subtitle}</p>}
        </div>
      </div>
      {action}
    </div>
  )
}

// ─── Main Dashboard ───────────────────────────────────────────────────────────
export default function Dashboard() {
  const { user }           = useAuth()
  const { orders, tables } = useApp()
  const { t }              = useSettings()
  const navigate           = useNavigate()

  const [chartPeriod,    setChartPeriod]    = useState('week')
  const [chartMetric,    setChartMetric]    = useState('revenue')
  const [chartType,      setChartType]      = useState('bar')
  const [dashData,       setDashData]       = useState(null)
  const [periodData,     setPeriodData]     = useState([])
  const [topDishCat,     setTopDishCat]     = useState('All')
  const [topDishesPeriod, setTopDishesPeriod] = useState('month')
  const [topDishesData,  setTopDishesData]  = useState(null) // null = use dashData, array = overridden
  const [topDishLoading, setTopDishLoading] = useState(false)
  const [activityLog,    setActivityLog]    = useState([])

  useEffect(() => {
    statsApi.dashboard().then(setDashData).catch(console.error)
    auditLogsApi.getAll({ limit: 12 }).then(setActivityLog).catch(() => {})
  }, [])

  useEffect(() => {
    statsApi.revenue(chartPeriod).then(setPeriodData).catch(console.error)
  }, [chartPeriod])

  useEffect(() => {
    setTopDishLoading(true)
    setTopDishCat('All')
    statsApi.topDishes(topDishesPeriod)
      .then(data => { setTopDishesData(data); setTopDishLoading(false) })
      .catch(() => setTopDishLoading(false))
  }, [topDishesPeriod])

  const greeting = () => {
    const h = getCurrentHourInTimeZone()
    if (h < 12) return t('dash.greeting.morning')
    if (h < 17) return t('dash.greeting.afternoon')
    return t('dash.greeting.evening')
  }

  const activeOrders  = orders.filter(o => ['Pending', 'In Progress'].includes(o.status))
  const occ           = getOccupancyStats(tables)
  const recentOrders  = [...orders]
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
    .slice(0, 7)

  const stats         = dashData?.stats
  const topDishes     = topDishesData ?? (dashData?.topDishes || [])
  const hourlyOrders  = dashData?.hourlyOrders  || []
  const lowStockItems = dashData?.lowStockItems || []

  const topDishCategories = ['All', ...Array.from(new Set(topDishes.map(d => d.category).filter(Boolean)))]
  const filteredTopDishes = topDishCat === 'All' ? topDishes : topDishes.filter(d => d.category === topDishCat)

  const hourlyData = Array.from({ length: 24 }, (_, h) => {
    const found = hourlyOrders.find(r => Number(r.hour) === h)
    return { hour: h, orders: found ? Number(found.orders || found.count) : 0 }
  })

  const chartData = periodData.map(r => ({
    day:     r.label,
    revenue: r.revenue,
    orders:  r.orders,
  }))

  const ACTION_META = {
    create: { color: 'bg-emerald-500', label: 'Created' },
    update: { color: 'bg-teal-500',    label: 'Updated' },
    delete: { color: 'bg-red-500',     label: 'Deleted' },
    login:  { color: 'bg-blue-500',    label: 'Login'   },
  }

  // Occupancy ring — percentage
  const occupancyPct = occ.total > 0 ? Math.round((occ.occupied / occ.total) * 100) : 0

  return (
    <div className="space-y-5">

      {/* ── Hero Banner ──────────────────────────────────────────────────────── */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-teal-600 via-teal-500 to-cyan-500 shadow-xl shadow-teal-500/20 p-6 text-white">
        {/* Liquid blobs */}
        <div className="absolute -top-10 -right-10 w-56 h-56 rounded-full bg-white/10 blur-3xl liquid-blob" />
        <div className="absolute bottom-0 left-40 w-40 h-40 rounded-full bg-cyan-300/20 blur-2xl" />
        <div className="absolute top-4 left-1/3 w-24 h-24 rounded-full bg-teal-300/15 blur-2xl liquid-blob-2" />

        <div className="relative z-10 flex items-center justify-between flex-wrap gap-4">
          {/* Left: greeting */}
          <div>
            <p className="text-teal-100 text-sm font-medium mb-0.5 flex items-center gap-1.5">
              <Zap size={13} className="opacity-80" />
              {getTodayLabel()}
            </p>
            <h2 className="text-2xl font-extrabold tracking-tight">
              {greeting()}, {user?.name?.split(' ')[0]} 👋
            </h2>
            <div className="flex items-center gap-3 mt-2.5 text-xs text-teal-100">
              <span className="flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse inline-block" />
                {stats?.activeOrders ?? activeOrders.length} active orders
              </span>
              <span className="opacity-40">·</span>
              <span>{stats?.occupiedTables ?? occ.occupied}/{stats?.totalTables ?? occ.total} tables occupied</span>
              <span className="opacity-40">·</span>
              <span>{stats?.totalOrders ?? 0} orders today</span>
            </div>
          </div>

          {/* Right: Today Revenue pill */}
          <div className="bg-white/15 backdrop-blur-md rounded-2xl px-5 py-3 border border-white/20 shadow-lg text-right">
            <p className="text-teal-100 text-xs mb-0.5">Today's Revenue</p>
            <p className="text-3xl font-black tracking-tight">{formatCurrency(stats?.todayRevenue ?? 0)}</p>
            <p className="text-teal-200 text-xs mt-0.5">{stats?.completedOrders ?? 0} paid orders</p>
          </div>
        </div>
      </div>

      {/* ── Low Stock Alert ──────────────────────────────────────────────────── */}
      {lowStockItems.length > 0 && (
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-amber-500 to-orange-500 p-4 text-white shadow-lg shadow-amber-500/20">
          <div className="absolute -right-4 -top-4 w-20 h-20 rounded-full bg-white/15 blur-2xl" />
          <div className="relative z-10 flex items-start gap-3">
            <div className="w-8 h-8 rounded-xl bg-white/20 flex items-center justify-center flex-shrink-0 mt-0.5">
              <AlertTriangle size={15} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold mb-2">
                Low Stock Alert — {lowStockItems.length} {lowStockItems.length === 1 ? 'item' : 'items'} need restocking
              </p>
              <div className="flex gap-2 flex-wrap">
                {lowStockItems.map(item => (
                  <span
                    key={item.id}
                    className="inline-flex items-center gap-1 px-2.5 py-1 bg-white/20 backdrop-blur-sm text-white text-xs font-semibold rounded-full border border-white/20"
                  >
                    {item.name}
                    <span className="opacity-75">· {item.stock}/{item.minStock}</span>
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Stat Cards ───────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
        <LiquidCard
          label={t('dash.todayRevenue')}
          value={formatCurrency(stats?.todayRevenue ?? 0)}
          sub={`${stats?.completedOrders ?? 0} ${t('dash.paidOrders')}`}
          icon={DollarSign}
          gradient="bg-gradient-to-br from-teal-500 to-teal-700"
          blob1="bg-cyan-300"
          blob2="bg-teal-300"
          shadow="shadow-teal-600/30"
        />
        <LiquidCard
          label={t('dash.activeOrders')}
          value={stats?.activeOrders ?? activeOrders.length}
          sub={`${orders.filter(o => o.status === 'Pending').length} pending · ${orders.filter(o => o.status === 'In Progress').length} in progress`}
          icon={ShoppingBag}
          gradient="bg-gradient-to-br from-blue-500 to-indigo-600"
          blob1="bg-blue-300"
          blob2="bg-indigo-300"
          shadow="shadow-blue-600/30"
          onClick={() => navigate('/orders')}
        />
        <LiquidCard
          label={t('dash.tablesOccupied')}
          value={`${stats?.occupiedTables ?? occ.occupied}/${stats?.totalTables ?? occ.total}`}
          sub={`${occupancyPct}% occupancy`}
          icon={LayoutGrid}
          gradient="bg-gradient-to-br from-orange-400 to-orange-600"
          blob1="bg-amber-300"
          blob2="bg-red-300"
          shadow="shadow-orange-500/30"
          onClick={() => navigate('/tables')}
        />
        <LiquidCard
          label={t('dash.topDish')}
          value={topDishes[0]?.name ? topDishes[0].name.length > 14 ? topDishes[0].name.slice(0, 13) + '…' : topDishes[0].name : '—'}
          sub={topDishes[0] ? `${topDishes[0].qty} orders · 30 days` : t('common.noData')}
          icon={Star}
          gradient="bg-gradient-to-br from-emerald-500 to-green-700"
          blob1="bg-green-300"
          blob2="bg-emerald-300"
          shadow="shadow-emerald-600/30"
        />
      </div>

      {/* ── Charts Row ───────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">

        {/* Revenue / Orders Chart */}
        <GlassCard className="xl:col-span-2" padding={false}>
          <div className="px-5 pt-5 pb-4 flex items-center justify-between flex-wrap gap-2 border-b border-gray-100 dark:border-gray-700/60">
            <div>
              <h3 className="text-sm font-bold text-gray-900 dark:text-gray-100">{t('dash.revenueOverview')}</h3>
              <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">
                {chartPeriod === 'today' ? 'Hourly today' : `${CHART_PERIODS.find(p => p.value === chartPeriod)?.label} trend`}
              </p>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              {/* Metric */}
              <div className="flex gap-1 bg-gray-100 dark:bg-gray-700 rounded-xl p-1">
                {[
                  { k: 'revenue', icon: TrendingUp,   label: 'Revenue' },
                  { k: 'orders',  icon: ShoppingBag,  label: 'Orders'  },
                ].map(({ k, icon: Ic, label }) => (
                  <button
                    key={k}
                    onClick={() => setChartMetric(k)}
                    className={clsx(
                      'flex items-center gap-1 px-2.5 py-1 text-xs font-semibold rounded-lg transition-all',
                      chartMetric === k
                        ? 'bg-teal-600 text-white shadow-sm'
                        : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200',
                    )}
                  >
                    <Ic size={11} /> {label}
                  </button>
                ))}
              </div>
              {/* Chart type */}
              <div className="flex gap-1 bg-gray-100 dark:bg-gray-700 rounded-xl p-1">
                {[
                  { k: 'bar',  icon: BarChart2   },
                  { k: 'line', icon: TrendingUp  },
                ].map(({ k, icon: Ic }) => (
                  <button
                    key={k}
                    onClick={() => setChartType(k)}
                    className={clsx(
                      'flex items-center justify-center w-7 h-7 rounded-lg transition-all',
                      chartType === k
                        ? 'bg-teal-600 text-white shadow-sm'
                        : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200',
                    )}
                  >
                    <Ic size={12} />
                  </button>
                ))}
              </div>
              {/* Period */}
              <div className="flex gap-1 bg-gray-100 dark:bg-gray-700 rounded-xl p-1">
                {CHART_PERIODS.map(p => (
                  <button
                    key={p.value}
                    onClick={() => setChartPeriod(p.value)}
                    className={clsx(
                      'px-2.5 py-1 text-xs font-semibold rounded-lg transition-all',
                      chartPeriod === p.value
                        ? 'bg-teal-600 text-white shadow-sm'
                        : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200',
                    )}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
          <div className="px-5 py-5">
            <RevenueChart data={chartData} type={chartType} metric={chartMetric} />
          </div>
        </GlassCard>

        {/* Top Dishes */}
        <GlassCard padding={false}>
          <div className="px-5 pt-5 pb-3 border-b border-gray-100 dark:border-gray-700/60">
            <div className="flex items-start justify-between gap-2 mb-3">
              <div>
                <h3 className="text-sm font-bold text-gray-900 dark:text-gray-100">{t('dash.topSelling')}</h3>
                <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">
                  {topDishLoading ? 'Loading…' : DISH_PERIODS.find(p => p.value === topDishesPeriod)?.label}
                </p>
              </div>
              {/* Period filter */}
              <div className="flex gap-1 bg-gray-100 dark:bg-gray-700 rounded-xl p-1 flex-shrink-0">
                {DISH_PERIODS.map(p => (
                  <button
                    key={p.value}
                    onClick={() => setTopDishesPeriod(p.value)}
                    className={clsx(
                      'px-2.5 py-1 text-xs font-semibold rounded-lg transition-all',
                      topDishesPeriod === p.value
                        ? 'bg-teal-600 text-white shadow-sm'
                        : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200',
                    )}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            </div>
            {/* Category filter pills */}
            {topDishCategories.length > 1 && (
              <div className="flex gap-1.5 flex-wrap">
                {topDishCategories.map(cat => (
                  <button
                    key={cat}
                    onClick={() => setTopDishCat(cat)}
                    className={clsx(
                      'px-2.5 py-1 rounded-full text-xs font-medium transition-colors',
                      topDishCat === cat
                        ? 'bg-teal-500 text-white'
                        : 'bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600'
                    )}
                  >
                    {cat}
                  </button>
                ))}
              </div>
            )}
          </div>
          <div className="px-5 py-5">
            <TopDishesChart data={filteredTopDishes.map(d => ({ name: d.name, count: d.qty, revenue: d.revenue }))} />
          </div>
        </GlassCard>
      </div>

      {/* ── Bottom Row ─────────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">

        {/* Recent Orders */}
        <GlassCard className="xl:col-span-2" padding={false}>
          <div className="px-5 pt-5 pb-3 border-b border-gray-100 dark:border-gray-700/60 flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-gray-900 dark:text-gray-100">{t('dash.recentOrders')}</h3>
              <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">Latest {recentOrders.length} transactions</p>
            </div>
            <button
              onClick={() => navigate('/orders')}
              className="flex items-center gap-1 text-xs font-semibold text-teal-600 dark:text-teal-400 hover:text-teal-700 dark:hover:text-teal-300 transition-colors"
            >
              {t('dash.viewAll')} <ChevronRight size={13} />
            </button>
          </div>
          <div className="divide-y divide-gray-50 dark:divide-gray-700/60">
            {recentOrders.length === 0 ? (
              <p className="px-5 py-8 text-center text-sm text-gray-400">No recent orders</p>
            ) : recentOrders.map(order => (
              <div
                key={order.id}
                onClick={() => navigate('/orders', { state: { selectedOrderId: order.id } })}
                className="flex items-center gap-4 px-5 py-3 hover:bg-gray-50 dark:hover:bg-gray-700/40 cursor-pointer transition-colors group"
              >
                {/* Status indicator dot */}
                <div className={clsx(
                  'w-2 h-2 rounded-full flex-shrink-0',
                  order.status === 'Closed'      ? 'bg-emerald-500' :
                  order.status === 'In Progress' ? 'bg-teal-500 animate-pulse' :
                  order.status === 'Served'      ? 'bg-blue-500' :
                  'bg-amber-500 animate-pulse',
                )} />
                {/* Order ID */}
                <span className="w-20 text-xs font-bold text-gray-900 dark:text-gray-100 font-mono flex-shrink-0">{order.id}</span>
                {/* Table */}
                <span className="w-14 text-xs text-gray-500 dark:text-gray-400 flex-shrink-0">
                  T-{String(order.tableNumber).padStart(2, '0')}
                </span>
                {/* Items */}
                <span className="flex-1 text-xs text-gray-400 dark:text-gray-500 truncate">
                  {order.items?.length ?? 0} items
                </span>
                {/* Total */}
                <span className="text-xs font-bold text-gray-900 dark:text-gray-100 w-24 text-right flex-shrink-0">
                  {formatCurrency(order.total)}
                </span>
                {/* Status badge */}
                <span className="w-24 flex-shrink-0">
                  <Badge variant={getStatusVariant(order.status)}>
                    {STATUS_LABELS[order.status] || order.status}
                  </Badge>
                </span>
                {/* Time */}
                <span className="text-xs text-gray-400 dark:text-gray-500 flex-shrink-0 w-14 text-right">
                  {formatTime(order.createdAt)}
                </span>
                <ArrowUpRight size={13} className="text-gray-300 dark:text-gray-600 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0" />
              </div>
            ))}
          </div>
        </GlassCard>

        {/* Table Occupancy Card */}
        <GlassCard padding={false}>
          <div className="px-5 pt-5 pb-3 border-b border-gray-100 dark:border-gray-700/60 flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-gray-900 dark:text-gray-100">{t('dash.floorPlan')}</h3>
              <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">{occupancyPct}% occupied</p>
            </div>
            <button
              onClick={() => navigate('/tables')}
              className="flex items-center gap-1 text-xs font-semibold text-teal-600 dark:text-teal-400 hover:text-teal-700 transition-colors"
            >
              {t('dash.manage')} <ChevronRight size={13} />
            </button>
          </div>

          {/* Occupancy bar */}
          <div className="px-5 pt-4 pb-3">
            <div className="flex gap-1 mb-3">
              {[
                { label: `${occ.available}`, sub: t('dash.available'), pct: occ.total ? occ.available / occ.total : 0, from: 'from-emerald-400', to: 'to-emerald-500' },
                { label: `${occ.occupied}`,  sub: t('dash.occupied'),  pct: occ.total ? occ.occupied  / occ.total : 0, from: 'from-red-400',    to: 'to-red-500'    },
                { label: `${occ.reserved}`,  sub: t('dash.reserved'),  pct: occ.total ? occ.reserved  / occ.total : 0, from: 'from-amber-400', to: 'to-amber-500'  },
              ].map(seg => seg.pct > 0 && (
                <div
                  key={seg.sub}
                  className={clsx('h-2 rounded-full bg-gradient-to-r transition-all', seg.from, seg.to)}
                  style={{ width: `${seg.pct * 100}%` }}
                />
              ))}
            </div>
            <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-emerald-500 inline-block" /> {occ.available} free</span>
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-500 inline-block" /> {occ.occupied} busy</span>
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-amber-500 inline-block" /> {occ.reserved} reserved</span>
            </div>
          </div>

          {/* Table grid */}
          <div className="px-5 pb-5">
            <div className="grid grid-cols-5 gap-1.5">
              {tables.map(table => (
                <button
                  key={table.id}
                  onClick={() => navigate('/tables')}
                  title={`Table ${table.tableNumber} — ${table.status}`}
                  className={clsx(
                    'aspect-square rounded-xl flex items-center justify-center text-xs font-bold transition-all hover:scale-110',
                    table.status === 'Available'
                      ? 'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-400'
                      : table.status === 'Occupied'
                        ? 'bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-400'
                        : 'bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-400',
                  )}
                >
                  {table.tableNumber}
                </button>
              ))}
              {tables.length === 0 && (
                <div className="col-span-5 py-6 text-center text-xs text-gray-400">No tables configured</div>
              )}
            </div>
          </div>
        </GlassCard>
      </div>

      {/* ── Hourly Traffic + Activity ─────────────────────────────────────────── */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">

        {/* Hourly Chart */}
        <GlassCard className="xl:col-span-2" padding={false}>
          <div className="px-5 pt-5 pb-4 border-b border-gray-100 dark:border-gray-700/60">
            <SectionHeader
              title="Hourly Traffic Today"
              subtitle="Number of orders per hour"
              icon={Clock}
            />
          </div>
          <div className="px-5 py-5">
            <ResponsiveContainer width="100%" height={160}>
              <BarChart data={hourlyData} margin={{ top: 0, right: 0, left: -22, bottom: 0 }}>
                <defs>
                  <linearGradient id="hourlyGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor="#14b8a6" stopOpacity={1}   />
                    <stop offset="95%" stopColor="#0d9488" stopOpacity={0.7} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
                <XAxis
                  dataKey="hour"
                  tickFormatter={h => h % 6 === 0 ? `${h}h` : ''}
                  tick={{ fontSize: 10, fill: '#9ca3af' }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fontSize: 10, fill: '#9ca3af' }}
                  axisLine={false}
                  tickLine={false}
                  allowDecimals={false}
                />
                <Tooltip
                  formatter={v => [v, 'Orders']}
                  labelFormatter={h => `${h}:00 – ${h + 1}:00`}
                  contentStyle={{
                    fontSize: 12, borderRadius: 10, border: '1px solid #e5e7eb',
                    boxShadow: '0 4px 6px -1px rgba(0,0,0,.1)',
                  }}
                />
                <Bar dataKey="orders" radius={[4, 4, 0, 0]} maxBarSize={28}>
                  {hourlyData.map((entry, i) => (
                    <Cell
                      key={i}
                      fill={entry.orders > 0 ? 'url(#hourlyGrad)' : '#e5e7eb'}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </GlassCard>

        {/* Activity Feed */}
        <GlassCard padding={false}>
          <div className="px-5 pt-5 pb-4 border-b border-gray-100 dark:border-gray-700/60 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Activity size={15} className="text-teal-500" />
              <div>
                <h3 className="text-sm font-bold text-gray-900 dark:text-gray-100">Recent Activity</h3>
                <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">System events</p>
              </div>
            </div>
            <button
              onClick={() => navigate('/audit-log')}
              className="flex items-center gap-1 text-xs font-semibold text-teal-600 dark:text-teal-400 hover:underline"
            >
              View all <ChevronRight size={12} />
            </button>
          </div>
          <div className="overflow-y-auto" style={{ maxHeight: 220 }}>
            {activityLog.length === 0 ? (
              <p className="px-5 py-8 text-center text-xs text-gray-400">No activity yet</p>
            ) : (
              <div className="px-5 py-3 space-y-3">
                {activityLog.map((log, i) => {
                  const meta = ACTION_META[log.action] || { color: 'bg-gray-400', label: log.action }
                  return (
                    <div key={log.id} className="flex items-start gap-3">
                      {/* Timeline dot */}
                      <div className="flex flex-col items-center flex-shrink-0">
                        <div className={clsx('w-2 h-2 rounded-full mt-1.5 flex-shrink-0', meta.color)} />
                        {i < activityLog.length - 1 && (
                          <div className="w-px flex-1 bg-gray-100 dark:bg-gray-700 mt-1" style={{ minHeight: 16 }} />
                        )}
                      </div>
                      {/* Content */}
                      <div className="flex-1 min-w-0 pb-2">
                        <div className="flex items-center gap-1.5 mb-0.5">
                          <span className={clsx(
                            'px-1.5 py-0.5 rounded-md text-white text-xs font-bold leading-none',
                            meta.color,
                          )}>
                            {meta.label}
                          </span>
                          <span className="text-xs font-medium text-gray-700 dark:text-gray-300 truncate capitalize">
                            {log.entityType}{log.entityId ? ` #${log.entityId}` : ''}
                          </span>
                        </div>
                        <p className="text-xs text-gray-400 dark:text-gray-500">
                          {log.userName || 'System'} · {formatRelativeTime(log.createdAt)}
                        </p>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </GlassCard>
      </div>

    </div>
  )
}
