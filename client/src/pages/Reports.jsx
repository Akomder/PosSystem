import { useState, useEffect } from 'react'
import { BarChart2, TrendingUp, ShoppingBag, Users, UserCheck, DollarSign, Calendar, CreditCard } from 'lucide-react'
import clsx from 'clsx'
import { useSettings } from '../context/SettingsContext'
import { reportsApi } from '../services/api'
import { formatCurrency, formatDate } from '../utils/formatters'

const TABS = [
  { key: 'sales',     labelKey: 'reports.sales',     icon: TrendingUp   },
  { key: 'products',  labelKey: 'reports.products',  icon: ShoppingBag  },
  { key: 'customers', labelKey: 'reports.customers', icon: Users        },
  { key: 'staff',     labelKey: 'reports.staff',     icon: UserCheck    },
  { key: 'finance',   labelKey: 'reports.finance',   icon: DollarSign   },
  { key: 'eod',       labelKey: 'reports.eod',       icon: Calendar     },
  { key: 'channel',   labelKey: 'reports.channel',   icon: CreditCard   },
]

const PERIODS = [
  { value: 'week',  labelKey: 'reports.week'  },
  { value: 'month', labelKey: 'reports.month' },
  { value: 'year',  labelKey: 'reports.year'  },
]

export default function Reports() {
  const { t } = useSettings()

  const [tab,    setTab]    = useState('sales')
  const [period, setPeriod] = useState('week')
  const [data,   setData]   = useState(null)
  const [loading,setLoading]= useState(false)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setData(null)
    const fetchers = {
      sales:     () => reportsApi.sales({ period }),
      products:  () => reportsApi.products({ period }),
      customers: () => reportsApi.customers({ period }),
      staff:     () => reportsApi.staff({ period }),
      finance:   () => reportsApi.finance({ period }),
      eod:       () => reportsApi.eod({}),
      channel:   () => reportsApi.channel({ period }),
    }
    fetchers[tab]().then(d => {
      if (!cancelled) setData(d)
    }).catch(console.error).finally(() => {
      if (!cancelled) setLoading(false)
    })
    return () => { cancelled = true }
  }, [tab, period])

  return (
    <div>
      {/* Header */}
      <div className="flex items-start justify-between mb-5">
        <div>
          <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100">{t('reports.title')}</h2>
          <p className="text-sm text-gray-400 dark:text-gray-500 mt-0.5">{t('reports.subtitle')}</p>
        </div>
        {/* Period selector */}
        <div className="flex gap-1 bg-gray-100 dark:bg-gray-700 rounded-xl p-1">
          {PERIODS.map(p => (
            <button
              key={p.value}
              onClick={() => setPeriod(p.value)}
              className={clsx(
                'px-3 py-1.5 rounded-lg text-xs font-medium transition-colors',
                period === p.value
                  ? 'bg-white dark:bg-gray-600 text-gray-900 dark:text-gray-100 shadow-sm'
                  : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
              )}
            >
              {t(p.labelKey)}
            </button>
          ))}
        </div>
      </div>

      {/* Tab bar */}
      <div className="flex gap-1 mb-6 border-b border-gray-100 dark:border-gray-700">
        {TABS.map(({ key, labelKey, icon: Icon }) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={clsx(
              'flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors',
              tab === key
                ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400 dark:border-indigo-400'
                : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
            )}
          >
            <Icon size={15} />
            {t(labelKey)}
          </button>
        ))}
      </div>

      {/* Content */}
      {loading && (
        <div className="flex items-center justify-center py-16 gap-2 text-gray-400">
          <div className="w-4 h-4 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
          {t('common.loading')}
        </div>
      )}

      {!loading && data && tab === 'sales'     && <SalesReport    data={data} t={t} />}
      {!loading && data && tab === 'products'  && <ProductsReport  data={data} t={t} />}
      {!loading && data && tab === 'customers' && <CustomersReport data={data} t={t} />}
      {!loading && data && tab === 'staff'     && <StaffReport     data={data} t={t} />}
      {!loading && data && tab === 'finance'   && <FinanceReport   data={data} t={t} />}
      {!loading && data && tab === 'eod'       && <EODReport       data={data} t={t} />}
      {!loading && data && tab === 'channel'   && <ChannelReport   data={data} t={t} />}
    </div>
  )
}

function StatCard({ label, value, icon: Icon, color, bg }) {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 p-4">
      <div className="flex items-center gap-3">
        <div className={clsx('w-10 h-10 rounded-xl flex items-center justify-center', bg)}>
          <Icon size={18} className={color} />
        </div>
        <div>
          <p className="text-xs text-gray-500 dark:text-gray-400">{label}</p>
          <p className="text-lg font-bold text-gray-900 dark:text-gray-100">{value}</p>
        </div>
      </div>
    </div>
  )
}

function SimpleTable({ headers, rows }) {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 overflow-hidden">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-gray-100 dark:border-gray-700">
            {headers.map(h => (
              <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-50 dark:divide-gray-700">
          {rows.length === 0 ? (
            <tr>
              <td colSpan={headers.length} className="px-4 py-8 text-center text-gray-400 dark:text-gray-500 text-sm">
                No data for this period
              </td>
            </tr>
          ) : rows.map((row, i) => (
            <tr key={i} className="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
              {row.map((cell, j) => (
                <td key={j} className="px-4 py-3 text-gray-700 dark:text-gray-300">{cell}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function SalesReport({ data, t }) {
  if (!data?.summary) return null
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-3 gap-4">
        <StatCard label={t('reports.totalRevenue')} value={formatCurrency(data.summary.totalRevenue)} icon={TrendingUp} color="text-green-600 dark:text-green-400" bg="bg-green-50 dark:bg-green-900/20" />
        <StatCard label={t('reports.totalOrders')}  value={data.summary.totalOrders}                  icon={BarChart2}  color="text-indigo-600 dark:text-indigo-400" bg="bg-indigo-50 dark:bg-indigo-900/20" />
        <StatCard label={t('reports.avgOrder')}     value={formatCurrency(data.summary.avgOrder)}     icon={DollarSign} color="text-amber-600 dark:text-amber-400"   bg="bg-amber-50 dark:bg-amber-900/20"  />
      </div>
      <SimpleTable
        headers={[t('reports.col.date'), t('reports.col.orders'), t('reports.col.revenue')]}
        rows={data.daily.map(r => [
          formatDate(r.date),
          r.orders,
          formatCurrency(r.revenue),
        ])}
      />
    </div>
  )
}

function ProductsReport({ data, t }) {
  if (!Array.isArray(data)) return null
  const max = data[0]?.qty || 1
  return (
    <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 overflow-hidden">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-gray-100 dark:border-gray-700">
            <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider w-8">#</th>
            <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">{t('reports.col.item')}</th>
            <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">{t('reports.col.qty')}</th>
            <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">{t('reports.col.revenue')}</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-50 dark:divide-gray-700">
          {data.length === 0 && (
            <tr><td colSpan={4} className="px-4 py-8 text-center text-gray-400 text-sm">No data for this period</td></tr>
          )}
          {data.map((r, i) => (
            <tr key={i} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
              <td className="px-4 py-3 text-gray-400 font-mono text-xs">{i + 1}</td>
              <td className="px-4 py-3">
                <div className="font-medium text-gray-900 dark:text-gray-100">{r.name}</div>
                <div className="mt-1 h-1.5 bg-gray-100 dark:bg-gray-700 rounded-full w-48">
                  <div
                    className="h-1.5 bg-indigo-500 rounded-full"
                    style={{ width: `${(r.qty / max) * 100}%` }}
                  />
                </div>
              </td>
              <td className="px-4 py-3 text-gray-700 dark:text-gray-300 font-medium">{r.qty}</td>
              <td className="px-4 py-3 text-gray-700 dark:text-gray-300">{formatCurrency(r.revenue)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function CustomersReport({ data, t }) {
  if (!Array.isArray(data)) return null
  return (
    <SimpleTable
      headers={[t('reports.col.name'), t('reports.col.visits'), t('reports.col.spent')]}
      rows={data.map(r => [r.name, r.visits, formatCurrency(r.spent)])}
    />
  )
}

function StaffReport({ data, t }) {
  if (!Array.isArray(data)) return null
  return (
    <SimpleTable
      headers={[t('reports.col.staff'), t('reports.col.orders'), t('reports.col.revenue')]}
      rows={data.map(r => [r.staff, r.orders, formatCurrency(r.revenue)])}
    />
  )
}

function FinanceReport({ data, t }) {
  if (typeof data?.totalIncome !== 'number') return null
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-3 gap-4">
        <StatCard label={t('reports.col.income')}  value={formatCurrency(data.totalIncome)}  icon={TrendingUp}   color="text-green-600 dark:text-green-400" bg="bg-green-50 dark:bg-green-900/20" />
        <StatCard label={t('reports.col.expense')} value={formatCurrency(data.totalExpense)} icon={DollarSign}   color="text-red-500 dark:text-red-400"     bg="bg-red-50 dark:bg-red-900/20"    />
        <StatCard label={t('reports.col.balance')} value={formatCurrency(data.netBalance)}   icon={BarChart2}    color="text-indigo-600 dark:text-indigo-400" bg="bg-indigo-50 dark:bg-indigo-900/20" />
      </div>
      <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 p-5 space-y-3">
        {[
          { label: 'Sales Revenue',      value: data.salesRevenue,  positive: true  },
          { label: 'Other Income',       value: data.otherIncome,   positive: true  },
          { label: 'Total Income',       value: data.totalIncome,   positive: true, bold: true },
          { label: 'Total Expense',      value: data.totalExpense,  positive: false },
          { label: 'Net Balance',        value: data.netBalance,    positive: data.netBalance >= 0, bold: true },
        ].map(row => (
          <div key={row.label} className={clsx('flex justify-between', row.bold && 'pt-2 border-t border-gray-100 dark:border-gray-700')}>
            <span className={clsx('text-sm', row.bold ? 'font-bold text-gray-900 dark:text-gray-100' : 'text-gray-600 dark:text-gray-400')}>
              {row.label}
            </span>
            <span className={clsx(
              'text-sm font-semibold',
              row.bold
                ? row.positive ? 'text-green-600 dark:text-green-400' : 'text-red-500 dark:text-red-400'
                : row.positive ? 'text-gray-900 dark:text-gray-100' : 'text-red-500 dark:text-red-400'
            )}>
              {formatCurrency(row.value)}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

function EODReport({ data, t }) {
  if (typeof data?.totalOrders !== 'number') return null
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard label={t('reports.eod.orders')}   value={data.totalOrders}             icon={BarChart2}   color="text-indigo-600 dark:text-indigo-400" bg="bg-indigo-50 dark:bg-indigo-900/20" />
        <StatCard label={t('reports.eod.revenue')}  value={formatCurrency(data.total)}   icon={TrendingUp}  color="text-green-600 dark:text-green-400"   bg="bg-green-50 dark:bg-green-900/20"   />
        <StatCard label={t('reports.eod.discount')} value={formatCurrency(data.discount)}icon={DollarSign}  color="text-amber-600 dark:text-amber-400"   bg="bg-amber-50 dark:bg-amber-900/20"   />
        <StatCard label={t('reports.eod.net')}      value={formatCurrency(data.netBalance)} icon={DollarSign} color="text-blue-600 dark:text-blue-400"  bg="bg-blue-50 dark:bg-blue-900/20"     />
      </div>

      <div className="grid grid-cols-2 gap-5">
        {/* Day summary */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 p-5 space-y-3">
          <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">{t('reports.eod.summary')}</p>
          {[
            { label: t('common.subtotal'),         value: data.subtotal,    positive: true },
            { label: t('orders.tax'),              value: data.tax,         positive: true },
            { label: t('sell.discount'),           value: -data.discount,   positive: false },
            { label: t('reports.eod.salesTotal'),  value: data.total,       positive: true,  bold: true },
            { label: t('cashflow.income'),         value: data.cashIncome,  positive: true },
            { label: t('cashflow.expense'),        value: -data.cashExpense,positive: false },
            { label: t('reports.eod.net'),         value: data.netBalance,  positive: data.netBalance >= 0, bold: true },
          ].map(row => (
            <div key={row.label} className={clsx('flex justify-between', row.bold && 'pt-2 border-t border-gray-100 dark:border-gray-700')}>
              <span className={clsx('text-sm', row.bold ? 'font-bold text-gray-900 dark:text-gray-100' : 'text-gray-500 dark:text-gray-400')}>
                {row.label}
              </span>
              <span className={clsx('text-sm font-semibold',
                row.bold
                  ? row.positive ? 'text-green-600 dark:text-green-400' : 'text-red-500 dark:text-red-400'
                  : row.positive ? 'text-gray-900 dark:text-gray-100'   : 'text-red-500 dark:text-red-400'
              )}>
                {formatCurrency(Math.abs(row.value))}
              </span>
            </div>
          ))}
        </div>

        {/* Top items for the day */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 overflow-hidden">
          <p className="px-4 pt-4 pb-2 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
            {t('reports.eod.topItems')}
          </p>
          <table className="w-full text-sm">
            <tbody className="divide-y divide-gray-50 dark:divide-gray-700">
              {(data.items || []).slice(0, 8).map((item, i) => (
                <tr key={i} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                  <td className="px-4 py-2 text-gray-400 text-xs w-6">{i+1}</td>
                  <td className="px-4 py-2 text-gray-900 dark:text-gray-100">{item.name}</td>
                  <td className="px-4 py-2 text-gray-500 dark:text-gray-400 text-right">×{item.qty}</td>
                  <td className="px-4 py-2 text-gray-700 dark:text-gray-300 text-right font-medium">{formatCurrency(item.revenue)}</td>
                </tr>
              ))}
              {(!data.items || data.items.length === 0) && (
                <tr><td colSpan={4} className="px-4 py-8 text-center text-gray-400 text-sm">No orders today</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

function ChannelReport({ data, t }) {
  if (!Array.isArray(data)) return null
  const total = data.reduce((s, r) => s + r.revenue, 0) || 1
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-3 gap-4">
        {data.map(r => (
          <StatCard
            key={r.channel}
            label={r.channel.charAt(0).toUpperCase() + r.channel.slice(1)}
            value={formatCurrency(r.revenue)}
            icon={DollarSign}
            color="text-indigo-600 dark:text-indigo-400"
            bg="bg-indigo-50 dark:bg-indigo-900/20"
          />
        ))}
      </div>
      <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100 dark:border-gray-700">
              {[t('reports.channel.method'), t('reports.col.orders'), t('reports.col.revenue'), t('reports.channel.share')].map(h => (
                <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50 dark:divide-gray-700">
            {data.length === 0 ? (
              <tr><td colSpan={4} className="px-4 py-8 text-center text-gray-400 text-sm">No data for this period</td></tr>
            ) : data.map((r, i) => (
              <tr key={i} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                <td className="px-4 py-3">
                  <span className="inline-flex items-center gap-1.5 font-medium text-gray-900 dark:text-gray-100 capitalize">
                    {r.channel}
                  </span>
                </td>
                <td className="px-4 py-3 text-gray-700 dark:text-gray-300">{r.orders}</td>
                <td className="px-4 py-3 font-semibold text-gray-900 dark:text-gray-100">{formatCurrency(r.revenue)}</td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <div className="flex-1 h-1.5 bg-gray-100 dark:bg-gray-700 rounded-full max-w-[80px]">
                      <div className="h-1.5 bg-indigo-500 rounded-full" style={{ width: `${(r.revenue / total) * 100}%` }} />
                    </div>
                    <span className="text-xs text-gray-500 dark:text-gray-400">{((r.revenue / total) * 100).toFixed(1)}%</span>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
