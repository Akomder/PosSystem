import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  DollarSign, ShoppingBag, Users, Star,
  BarChart2, TrendingUp,
} from 'lucide-react'
import clsx from 'clsx'
import { useAuth } from '../context/AuthContext'
import { useApp }  from '../context/AppContext'
import { useSettings } from '../context/SettingsContext'
import { statsApi } from '../services/api'
import StatsCard      from '../components/ui/StatsCard'
import Card           from '../components/ui/Card'
import Badge          from '../components/ui/Badge'
import RevenueChart   from '../components/charts/RevenueChart'
import TopDishesChart from '../components/charts/TopDishesChart'
import { formatCurrency, formatTime, getTodayLabel } from '../utils/formatters'
import { getStatusVariant, STATUS_LABELS } from '../utils/orderHelpers'
import { getOccupancyStats } from '../utils/tableHelpers'

const CHART_PERIODS = [
  { value: 'week',  label: '7D'  },
  { value: 'month', label: '30D' },
  { value: 'year',  label: '1Y'  },
]

export default function Dashboard() {
  const { user }            = useAuth()
  const { orders, tables }  = useApp()
  const { t }               = useSettings()
  const navigate            = useNavigate()
  const [chartType,   setChartType]   = useState('bar')
  const [chartPeriod, setChartPeriod] = useState('week')
  const [chartMetric, setChartMetric] = useState('revenue')  // 'revenue' | 'orders'

  // Dashboard stats from API
  const [dashData,   setDashData]   = useState(null)
  const [periodData, setPeriodData] = useState([])

  useEffect(() => {
    statsApi.dashboard().then(setDashData).catch(console.error)
  }, [])

  useEffect(() => {
    statsApi.revenue(chartPeriod).then(setPeriodData).catch(console.error)
  }, [chartPeriod])

  const greeting = () => {
    const h = new Date().getHours()
    if (h < 12) return t('dash.greeting.morning')
    if (h < 17) return t('dash.greeting.afternoon')
    return t('dash.greeting.evening')
  }

  // Fallback to live context data when API stats not yet loaded
  const activeOrders  = orders.filter(o => ['Pending','In Progress'].includes(o.status))
  const occ           = getOccupancyStats(tables)
  const recentOrders  = [...orders]
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
    .slice(0, 6)

  const stats     = dashData?.stats
  const topDishes = dashData?.topDishes || []

  // Chart data from period API — labels may be 'Dy' (week), 'DD Mon' (month), 'Mon YYYY' (year)
  const chartData = periodData.map(r => ({
    day:     r.label,
    revenue: r.revenue,
    orders:  r.orders,
  }))

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">
          {greeting()}, {user?.name?.split(' ')[0]} 👋
        </h2>
        <p className="text-sm text-gray-400 dark:text-gray-500 mt-0.5">{getTodayLabel()}</p>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <StatsCard
          title={t('dash.todayRevenue')}
          value={formatCurrency(stats?.todayRevenue ?? 0)}
          change={`${stats?.completedOrders ?? 0} ${t('dash.paidOrders')}`}
          changeType="up"
          icon={DollarSign}
          color="indigo"
        />
        <StatsCard
          title={t('dash.activeOrders')}
          value={stats?.activeOrders ?? activeOrders.length}
          icon={ShoppingBag}
          color="blue"
          subtitle={`${orders.filter(o=>o.status==='Pending').length} ${t('dash.pending')} · ${orders.filter(o=>o.status==='In Progress').length} ${t('dash.inProgress')}`}
        />
        <StatsCard
          title={t('dash.tablesOccupied')}
          value={`${stats?.occupiedTables ?? occ.occupied} / ${stats?.totalTables ?? occ.total}`}
          change={`${stats?.availableTables ?? occ.available} ${t('dash.available')}`}
          changeType="up"
          icon={Users}
          color="amber"
        />
        <StatsCard
          title={t('dash.topDish')}
          value={topDishes[0]?.name || '—'}
          subtitle={topDishes[0] ? `${topDishes[0].qty} orders (30 days)` : t('common.noData')}
          icon={Star}
          color="green"
        />
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        {/* Revenue / Orders Chart */}
        <Card className="xl:col-span-2" padding={false}>
          <div className="flex items-center justify-between px-5 pt-5 pb-4 flex-wrap gap-2">
            <div>
              <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">{t('dash.revenueOverview')}</h3>
              <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">
                {CHART_PERIODS.find(p => p.value === chartPeriod)?.label}
              </p>
            </div>
            <div className="flex items-center gap-2">
              {/* Metric toggle */}
              <div className="flex items-center gap-1 bg-gray-100 dark:bg-gray-700 rounded-lg p-1">
                {[
                  { key: 'revenue', icon: <TrendingUp size={12} />, label: 'Revenue' },
                  { key: 'orders',  icon: <ShoppingBag size={12} />, label: 'Orders'  },
                ].map(m => (
                  <button
                    key={m.key}
                    onClick={() => setChartMetric(m.key)}
                    className={clsx(
                      'flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded-md transition-colors',
                      chartMetric === m.key
                        ? 'bg-white dark:bg-gray-600 text-indigo-600 dark:text-indigo-400 shadow-sm'
                        : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
                    )}
                  >
                    {m.icon} {m.label}
                  </button>
                ))}
              </div>
              {/* Chart type toggle */}
              <div className="flex items-center gap-1 bg-gray-100 dark:bg-gray-700 rounded-lg p-1">
                {['bar', 'line'].map((type) => (
                  <button
                    key={type}
                    onClick={() => setChartType(type)}
                    className={clsx(
                      'px-2.5 py-1 text-xs font-medium rounded-md transition-colors',
                      chartType === type
                        ? 'bg-white dark:bg-gray-600 text-indigo-600 dark:text-indigo-400 shadow-sm'
                        : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
                    )}
                  >
                    {type === 'bar' ? <BarChart2 size={12} /> : <TrendingUp size={12} />}
                  </button>
                ))}
              </div>
              {/* Period selector */}
              <div className="flex items-center gap-1 bg-gray-100 dark:bg-gray-700 rounded-lg p-1">
                {CHART_PERIODS.map(p => (
                  <button
                    key={p.value}
                    onClick={() => setChartPeriod(p.value)}
                    className={clsx(
                      'px-2.5 py-1 text-xs font-medium rounded-md transition-colors',
                      chartPeriod === p.value
                        ? 'bg-white dark:bg-gray-600 text-indigo-600 dark:text-indigo-400 shadow-sm'
                        : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
                    )}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
          <div className="px-5 pb-5">
            <RevenueChart data={chartData} type={chartType} metric={chartMetric} />
          </div>
        </Card>

        {/* Top Dishes */}
        <Card padding={false}>
          <div className="px-5 pt-5 pb-4">
            <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">{t('dash.topSelling')}</h3>
            <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">{t('dash.last30days')}</p>
          </div>
          <div className="px-5 pb-5">
            <TopDishesChart data={topDishes.map(d => ({ name: d.name, count: d.qty, revenue: d.revenue }))} />
          </div>
        </Card>
      </div>

      {/* Bottom Row */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        {/* Recent Orders */}
        <Card className="xl:col-span-2" padding={false}>
          <div className="flex items-center justify-between px-5 pt-5 pb-3">
            <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">{t('dash.recentOrders')}</h3>
            <button
              onClick={() => navigate('/orders')}
              className="text-xs text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 font-medium"
            >
              {t('dash.viewAll')}
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-t border-gray-100 dark:border-gray-700">
                  {[t('dash.col.order'), t('dash.col.table'), t('dash.col.items'), t('dash.col.total'), t('dash.col.status'), t('dash.col.time')].map((h) => (
                    <th
                      key={h}
                      className="px-5 py-3 text-left text-xs font-medium text-gray-400 dark:text-gray-500 uppercase tracking-wider"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50 dark:divide-gray-700">
                {recentOrders.map((order) => (
                  <tr
                    key={order.id}
                    onClick={() => navigate('/orders', { state: { selectedOrderId: order.id } })}
                    className="hover:bg-gray-50 dark:hover:bg-gray-700/50 cursor-pointer transition-colors"
                  >
                    <td className="px-5 py-3 font-medium text-gray-900 dark:text-gray-100">{order.id}</td>
                    <td className="px-5 py-3 text-gray-500 dark:text-gray-400">
                      T-{String(order.tableNumber).padStart(2, '0')}
                    </td>
                    <td className="px-5 py-3 text-gray-500 dark:text-gray-400">{order.items?.length ?? 0}</td>
                    <td className="px-5 py-3 font-medium text-gray-900 dark:text-gray-100">{formatCurrency(order.total)}</td>
                    <td className="px-5 py-3">
                      <Badge variant={getStatusVariant(order.status)}>
                        {STATUS_LABELS[order.status] || order.status}
                      </Badge>
                    </td>
                    <td className="px-5 py-3 text-gray-400 dark:text-gray-500 text-xs">{formatTime(order.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>

        {/* Table Mini-Map */}
        <Card padding={false}>
          <div className="flex items-center justify-between px-5 pt-5 pb-3">
            <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">{t('dash.floorPlan')}</h3>
            <button
              onClick={() => navigate('/tables')}
              className="text-xs text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 font-medium"
            >
              {t('dash.manage')}
            </button>
          </div>
          <div className="px-5 pb-2">
            <div className="grid grid-cols-5 gap-1.5">
              {tables.map((table) => (
                <div
                  key={table.id}
                  title={`Table ${table.tableNumber} — ${table.status}`}
                  className="aspect-square rounded-md flex items-center justify-center text-xs font-bold"
                  style={{
                    backgroundColor:
                      table.status === 'Available' ? '#DCFCE7' :
                      table.status === 'Occupied'  ? '#FEE2E2' : '#FEF3C7',
                    color:
                      table.status === 'Available' ? '#15803D' :
                      table.status === 'Occupied'  ? '#DC2626' : '#D97706',
                  }}
                >
                  {table.tableNumber}
                </div>
              ))}
            </div>
          </div>
          {/* Legend */}
          <div className="flex items-center gap-4 px-5 py-3 border-t border-gray-100 dark:border-gray-700">
            {[
              { color: '#DCFCE7', text: '#15803D', label: `${occ.available} ${t('dash.available')}` },
              { color: '#FEE2E2', text: '#DC2626', label: `${occ.occupied} ${t('dash.occupied')}`  },
              { color: '#FEF3C7', text: '#D97706', label: `${occ.reserved} ${t('dash.reserved')}`  },
            ].map((item) => (
              <div key={item.label} className="flex items-center gap-1.5">
                <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: item.color }} />
                <span className="text-xs text-gray-500 dark:text-gray-400">{item.label}</span>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  )
}
