import { useState, useEffect } from 'react'
import { BarChart2, TrendingUp, ShoppingBag, Users, UserCheck, DollarSign, Calendar, CreditCard, Download, Printer, Package, FileText } from 'lucide-react'
import clsx from 'clsx'
import { useSettings } from '../context/SettingsContext'
import { reportsApi } from '../services/api'
import DateRangeFilter from '../components/ui/DateRangeFilter'
import { APP_TIME_ZONE, formatCurrency, formatDate } from '../utils/formatters'

// ─── CSV export helper ────────────────────────────────────────────────────────
function exportCsv(filename, headers, rows) {
  const escape = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`
  const lines = [
    headers.map(escape).join(','),
    ...rows.map(row => row.map(escape).join(',')),
  ]
  const blob = new Blob(['﻿' + lines.join('\n')], { type: 'text/csv;charset=utf-8;' })
  const url  = URL.createObjectURL(blob)
  const a    = Object.assign(document.createElement('a'), { href: url, download: filename })
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

function buildCsvFilename(tab, period, dateRange) {
  const today = new Date().toLocaleDateString('en-CA', { timeZone: APP_TIME_ZONE }) // YYYY-MM-DD
  let from, to
  if (dateRange?.from && dateRange?.to) {
    from = dateRange.from
    to   = dateRange.to
  } else if (period === 'today') {
    from = today; to = today
  } else if (period === 'week') {
    const d = new Date(); d.setDate(d.getDate() - 6)
    from = d.toLocaleDateString('en-CA', { timeZone: APP_TIME_ZONE }); to = today
  } else if (period === 'month') {
    const d = new Date(); d.setDate(d.getDate() - 29)
    from = d.toLocaleDateString('en-CA', { timeZone: APP_TIME_ZONE }); to = today
  } else {
    const d = new Date(); d.setFullYear(d.getFullYear() - 1)
    from = d.toLocaleDateString('en-CA', { timeZone: APP_TIME_ZONE }); to = today
  }
  return `sale-report(${from}_to_${to}).csv`
}

function getExportConfig(tab, data, period, dateRange) {
  if (!data) return null
  const filename = buildCsvFilename(tab, period, dateRange)
  switch (tab) {
    case 'sales':
      if (!data.daily) return null
      return {
        filename,
        headers: ['Date', 'Orders', 'Revenue (LAK)', 'Avg Order (LAK)'],
        rows: [
          // Summary rows
          ['--- SUMMARY ---', '', '', ''],
          ['Total Revenue', '', data.summary?.totalRevenue ?? '', ''],
          ['Total Orders',  '', data.summary?.totalOrders  ?? '', ''],
          ['Average Order', '', '', data.summary?.avgOrder ?? ''],
          ['--- DAILY BREAKDOWN ---', '', '', ''],
          ...data.daily.map(r => [
            formatDate(r.date),
            r.orders,
            r.revenue,
            r.orders > 0 ? (r.revenue / r.orders).toFixed(0) : 0,
          ]),
        ],
      }
    case 'products':
      if (!Array.isArray(data)) return null
      return {
        filename,
        headers: ['#', 'Item Name', 'Category', 'Quantity Sold', 'Revenue (LAK)', 'Revenue Share %'],
        rows: (() => {
          const total = data.reduce((s, r) => s + (r.revenue || 0), 0) || 1
          return data.map((r, i) => [
            i + 1,
            r.name,
            r.category ?? '',
            r.qty,
            r.revenue,
            ((r.revenue / total) * 100).toFixed(1),
          ])
        })(),
      }
    case 'customers':
      if (!Array.isArray(data)) return null
      return {
        filename,
        headers: ['Customer Name', 'Phone', 'Total Visits', 'Total Spent (LAK)', 'Avg Per Visit (LAK)'],
        rows: data.map(r => [
          r.name,
          r.phone ?? '',
          r.visits,
          r.spent,
          r.visits > 0 ? (r.spent / r.visits).toFixed(0) : 0,
        ]),
      }
    case 'staff':
      if (!Array.isArray(data)) return null
      return {
        filename,
        headers: ['Staff Name', 'Orders Handled', 'Revenue (LAK)', 'Avg Per Order (LAK)'],
        rows: data.map(r => [
          r.staff,
          r.orders,
          r.revenue,
          r.orders > 0 ? (r.revenue / r.orders).toFixed(0) : 0,
        ]),
      }
    case 'finance':
      if (typeof data?.totalIncome !== 'number') return null
      return {
        filename,
        headers: ['Category', 'Amount (LAK)'],
        rows: [
          ['Sales Revenue',  data.salesRevenue],
          ['Other Income',   data.otherIncome],
          ['Total Income',   data.totalIncome],
          ['Total Expense',  data.totalExpense],
          ['Net Balance',    data.netBalance],
        ],
      }
    case 'eod':
      if (typeof data?.totalOrders !== 'number') return null
      return {
        filename,
        headers: ['Metric', 'Value'],
        rows: [
          ['Total Orders',   data.totalOrders],
          ['Subtotal (LAK)', data.subtotal],
          ['Discount (LAK)', data.discount],
          ['Total Sales (LAK)', data.total],
          ['Cash Income (LAK)', data.cashIncome],
          ['Cash Expense (LAK)', data.cashExpense],
          ['Net Balance (LAK)', data.netBalance],
          ['', ''],
          ['--- TOP ITEMS ---', ''],
          ...(data.items || []).map((i, idx) => [`${idx + 1}. ${i.name}`, `qty: ${i.qty}  revenue: ${i.revenue}`]),
        ],
      }
    case 'stockDaily':
      if (!Array.isArray(data)) return null
      return {
        filename,
        headers: ['Item', 'Category', 'Opening Stock', 'Sold', 'Remaining', 'Status'],
        rows: data.map(r => [
          r.name,
          r.category,
          r.openingQty,
          r.soldQty,
          r.currentQty,
          r.currentQty <= 0 ? 'Out of Stock' : r.currentQty <= 5 ? 'Low Stock' : 'OK',
        ]),
      }
    case 'salesDetail':
      if (!Array.isArray(data)) return null
      return {
        filename,
        headers: ['Order ID', 'Date & Time', 'Table', 'Waiter', 'Item Name', 'Modifiers', 'Qty', 'Unit Price (LAK)', 'Line Total (LAK)', 'Payment Method', 'Payment Status', 'Order Notes'],
        rows: data.map(r => [
          r.orderId,
          r.createdAt ? new Date(r.createdAt).toLocaleString('en-GB', { timeZone: APP_TIME_ZONE }) : '',
          r.tableNumber ?? '',
          r.waiter ?? '',
          r.name,
          r.modifiers ?? '',
          r.quantity,
          r.unitPrice,
          r.lineTotal,
          r.paymentMethod,
          r.paymentStatus,
          r.notes ?? '',
        ]),
      }
    default:
      return null
  }
}

const TABS = [
  { key: 'sales',       labelKey: 'reports.sales',       icon: TrendingUp },
  { key: 'products',    labelKey: 'reports.products',    icon: ShoppingBag },
  { key: 'customers',   labelKey: 'reports.customers',   icon: Users },
  { key: 'staff',       labelKey: 'reports.staff',       icon: UserCheck },
  { key: 'finance',     labelKey: 'reports.finance',     icon: DollarSign },
  { key: 'eod',         labelKey: 'reports.eod',         icon: Calendar },
  { key: 'stockDaily',  labelKey: 'reports.stockDaily',  icon: Package },
  { key: 'salesDetail', labelKey: 'reports.salesDetail', icon: FileText },
]

const PERIODS = [
  { value: 'today', labelKey: 'reports.today' },
  { value: 'week',  labelKey: 'reports.week'  },
  { value: 'month', labelKey: 'reports.month' },
  { value: 'year',  labelKey: 'reports.year'  },
]

export default function Reports() {
  const { t } = useSettings()

  const [tab,       setTab]       = useState('sales')
  const [period,    setPeriod]    = useState('week')
  const [dateRange, setDateRange] = useState(null)
  const [data,      setData]      = useState(null)
  const [loading,   setLoading]   = useState(false)

  const handleExportCsv = () => {
    const cfg = getExportConfig(tab, data, period, dateRange)
    if (cfg) exportCsv(cfg.filename, cfg.headers, cfg.rows)
  }

  const handlePrint = () => window.print()

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setData(null)
    let params
    if (dateRange?.from && dateRange?.to) {
      params = { from: dateRange.from, to: dateRange.to }
    } else if (period === 'today') {
      const today = new Date().toLocaleDateString('en-CA', { timeZone: APP_TIME_ZONE })
      params = { from: today, to: today }
    } else {
      params = { period }
    }
    const fetchers = {
      sales:       () => reportsApi.sales(params),
      products:    () => reportsApi.products(params),
      customers:   () => reportsApi.customers(params),
      staff:       () => reportsApi.staff(params),
      finance:     () => reportsApi.finance(params),
      eod:         () => reportsApi.eod(dateRange || period === 'today' ? params : {}),
      stockDaily:  () => reportsApi.stockDaily({}),
      salesDetail: () => reportsApi.salesDetail(params),
    }
    fetchers[tab]().then(d => {
      if (!cancelled) setData(d)
    }).catch(console.error).finally(() => {
      if (!cancelled) setLoading(false)
    })
    return () => { cancelled = true }
  }, [tab, period, dateRange])

  return (
    <div id="reports-page">
      {/* Print styles */}
      <style>{`
        @media print {
          body > * { display: none !important; }
          #reports-page { display: block !important; }
          .no-print { display: none !important; }
          #reports-page { padding: 0; }
        }
      `}</style>

      {/* Header */}
      <div className="flex items-start justify-between mb-5 no-print">
        <div>
          <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100">{t('reports.title')}</h2>
          <p className="text-sm text-gray-400 dark:text-gray-500 mt-0.5">{t('reports.subtitle')}</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {/* Export buttons */}
          {data && !loading && (
            <>
              <button
                onClick={handleExportCsv}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-gray-600 dark:text-gray-300 bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors"
              >
                <Download size={13} />
                Export CSV
              </button>
              <button
                onClick={handlePrint}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-gray-600 dark:text-gray-300 bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors"
              >
                <Printer size={13} />
                Print
              </button>
            </>
          )}
          <DateRangeFilter
            value={dateRange}
            onChange={r => { setDateRange(r) }}
          />
          {/* Period selector — disabled when custom date range is active */}
          {!dateRange && (
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
          )}
        </div>
        <p className="text-sm text-gray-500">{new Date().toLocaleDateString('en-US', { timeZone: APP_TIME_ZONE })}</p>
      </div>

      {/* Print header (only shows when printing) */}
      <div className="hidden print:block mb-4">
        <h2 className="text-xl font-bold">{t('reports.title')} — {TABS.find(tb => tb.key === tab)?.labelKey && t(TABS.find(tb => tb.key === tab).labelKey)}</h2>
        <p className="text-sm text-gray-500">{new Date().toLocaleDateString('en-US', { timeZone: APP_TIME_ZONE })}</p>
      </div>

      {/* Tab bar */}
      <div className="flex gap-1 mb-6 border-b border-gray-100 dark:border-gray-700 no-print">
        {TABS.map(({ key, labelKey, icon: Icon }) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={clsx(
              'flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors',
              tab === key
                ? 'border-teal-600 text-teal-600 dark:text-teal-400 dark:border-teal-400'
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
          <div className="w-4 h-4 border-2 border-teal-500 border-t-transparent rounded-full animate-spin" />
          {t('common.loading')}
        </div>
      )}

      {!loading && data && tab === 'sales'     && <SalesReport    data={data} t={t} />}
      {!loading && data && tab === 'products'  && <ProductsReport  data={data} t={t} />}
      {!loading && data && tab === 'customers' && <CustomersReport data={data} t={t} />}
      {!loading && data && tab === 'staff'     && <StaffReport     data={data} t={t} />}
      {!loading && data && tab === 'finance'   && <FinanceReport   data={data} t={t} />}
      {!loading && data && tab === 'eod'       && <EODReport       data={data} t={t} />}
      {!loading && data && tab === 'stockDaily'  && <StockDailyReport  data={data} t={t} />}
      {!loading && data && tab === 'salesDetail' && <SalesDetailReport data={data} t={t} />}
    </div>
  )
}

function StockDailyReport({ data, t }) {
  if (!Array.isArray(data)) return null
  return (
    <SimpleTable
      headers={[t('reports.col.item'), t('reports.col.category'), t('reports.stock.opening'), t('reports.stock.sold'), t('reports.stock.remaining')]}
      rows={data.map(r => [
        r.name,
        r.category,
        r.openingQty,
        r.soldQty,
        <span className={r.currentQty <= 0 ? 'text-red-500 font-semibold' : ''}>{r.currentQty}</span>,
      ])}
    />
  )
}

function SalesDetailReport({ data, t }) {
  if (!Array.isArray(data)) return null
  return (
    <SimpleTable
      headers={[
        t('reports.col.order'), t('reports.col.date'), t('reports.col.table'),
        t('reports.col.item'), t('reports.col.qty'), t('common.price'),
        t('reports.col.revenue'), t('reports.channel.method'), t('reports.col.status'),
      ]}
      rows={data.map(r => [
        r.orderId,
        formatDate(r.createdAt),
        r.tableNumber ?? '—',
        <div>
          <div className="font-medium text-gray-900 dark:text-gray-100">{r.name}</div>
          {r.modifiers && <div className="text-xs text-gray-400">{r.modifiers}</div>}
        </div>,
        r.quantity,
        formatCurrency(r.unitPrice),
        formatCurrency(r.lineTotal),
        r.paymentMethod,
        r.paymentStatus,
      ])}
    />
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
        <StatCard label={t('reports.totalOrders')}  value={data.summary.totalOrders}                  icon={BarChart2}  color="text-teal-600 dark:text-teal-400" bg="bg-teal-50 dark:bg-teal-900/20" />
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
                    className="h-1.5 bg-teal-500 rounded-full"
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
        <StatCard label={t('reports.col.balance')} value={formatCurrency(data.netBalance)}   icon={BarChart2}    color="text-teal-600 dark:text-teal-400" bg="bg-teal-50 dark:bg-teal-900/20" />
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
        <StatCard label={t('reports.eod.orders')}   value={data.totalOrders}             icon={BarChart2}   color="text-teal-600 dark:text-teal-400" bg="bg-teal-50 dark:bg-teal-900/20" />
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
            color="text-teal-600 dark:text-teal-400"
            bg="bg-teal-50 dark:bg-teal-900/20"
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
                      <div className="h-1.5 bg-teal-500 rounded-full" style={{ width: `${(r.revenue / total) * 100}%` }} />
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
