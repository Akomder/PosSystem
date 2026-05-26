import { useState, useEffect, useCallback } from 'react'
import { Search, FileText } from 'lucide-react'
import clsx from 'clsx'
import { useSettings } from '../context/SettingsContext'
import { ordersApi } from '../services/api'
import Input from '../components/ui/Input'
import Select from '../components/ui/Select'
import EmptyState from '../components/ui/EmptyState'
import Badge from '../components/ui/Badge'
import DateRangeFilter from '../components/ui/DateRangeFilter'
import { formatCurrency } from '../utils/formatters'

function formatDateTime(iso) {
  if (!iso) return '—'
  const d = new Date(iso)
  return d.toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

const PAYMENT_VARIANT = { cash: 'success', transfer: 'blue', card: 'teal', default: 'default' }

export default function Invoices() {
  const { t } = useSettings()
  const [invoices,   setInvoices]   = useState([])
  const [loading,    setLoading]    = useState(true)
  const [search,     setSearch]     = useState('')
  const [selected,   setSelected]   = useState(null)
  const [dateRange,  setDateRange]  = useState(null)

  const load = useCallback(async () => {
    try {
      setLoading(true)
      const data = await ordersApi.getAll({ status: 'Closed', limit: 200 })
      setInvoices(data)
    } catch (e) { console.error(e) }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { load() }, [load])

  const filtered = invoices.filter(inv => {
    const q = search.toLowerCase()
    const matchSearch = !search || inv.id.toLowerCase().includes(q) || String(inv.tableNumber).includes(q)
    const matchDate = !dateRange || (() => {
      const d = inv.createdAt?.slice(0, 10)
      return d >= dateRange.from && d <= dateRange.to
    })()
    return matchSearch && matchDate
  })

  return (
    <div>
      {/* Header */}
      <div className="flex items-start justify-between mb-5">
        <div>
          <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100">{t('invoices.title')}</h2>
          <p className="text-sm text-gray-400 dark:text-gray-500 mt-0.5">{t('invoices.subtitle')}</p>
        </div>
      </div>

      {/* Search + Date filter */}
      <div className="flex gap-3 mb-5 flex-wrap">
        <div className="flex-1 min-w-48 max-w-sm">
          <Input placeholder={t('invoices.search')} value={search} onChange={e => setSearch(e.target.value)} icon={Search} />
        </div>
        <DateRangeFilter value={dateRange} onChange={setDateRange} />
      </div>

      {/* Content */}
      {loading ? (
        <div className="flex items-center justify-center py-16 gap-2 text-gray-400">
          <div className="w-4 h-4 border-2 border-teal-500 border-t-transparent rounded-full animate-spin" />
          {t('common.loading')}
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState icon={FileText} title={t('invoices.noInvoices')} description={t('invoices.noInvoicesDesc')} />
      ) : (
        <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 dark:border-gray-700">
                {[
                  t('invoices.col.code'),
                  t('invoices.col.time'),
                  t('invoices.col.table'),
                  t('invoices.col.waiter'),
                  t('invoices.col.items'),
                  t('invoices.col.payment'),
                  t('invoices.col.discount'),
                  t('invoices.col.total'),
                  t('invoices.col.change'),
                ].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50 dark:divide-gray-700">
              {filtered.map(inv => (
                <tr
                  key={inv.id}
                  onClick={() => setSelected(selected?.id === inv.id ? null : inv)}
                  className="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors cursor-pointer"
                >
                  <td className="px-4 py-3 font-mono text-xs text-teal-600 dark:text-teal-400 font-semibold">{inv.id}</td>
                  <td className="px-4 py-3 text-gray-500 dark:text-gray-400 text-xs whitespace-nowrap">{formatDateTime(inv.createdAt)}</td>
                  <td className="px-4 py-3 text-gray-700 dark:text-gray-300">
                    {inv.tableNumber ? `${t('common.table')} ${inv.tableNumber}` : '—'}
                  </td>
                  <td className="px-4 py-3 text-gray-700 dark:text-gray-300">{inv.waiter || '—'}</td>
                  <td className="px-4 py-3 text-gray-500 dark:text-gray-400">{inv.items?.length || 0}</td>
                  <td className="px-4 py-3">
                    <Badge variant={PAYMENT_VARIANT[inv.paymentMethod] || 'default'}>
                      {inv.paymentMethod || 'cash'}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 text-gray-700 dark:text-gray-300">
                    {inv.discount > 0 ? <span className="text-red-500">-{formatCurrency(inv.discount)}</span> : '—'}
                  </td>
                  <td className="px-4 py-3 font-semibold text-gray-900 dark:text-gray-100">{formatCurrency(inv.total)}</td>
                  <td className="px-4 py-3 text-gray-700 dark:text-gray-300">
                    {inv.changeAmount > 0 ? formatCurrency(inv.changeAmount) : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Detail drawer */}
      {selected && (
        <div className="fixed inset-y-0 right-0 w-80 bg-white dark:bg-gray-800 border-l border-gray-200 dark:border-gray-700 shadow-2xl z-30 flex flex-col">
          <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 dark:border-gray-700">
            <div>
              <p className="font-bold text-gray-900 dark:text-gray-100">{selected.id}</p>
              <p className="text-xs text-gray-400">{formatDateTime(selected.createdAt)}</p>
            </div>
            <button
              onClick={() => setSelected(null)}
              className="p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
            >
              ×
            </button>
          </div>
          <div className="flex-1 overflow-y-auto p-5 space-y-4">
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <p className="text-xs text-gray-400">{t('common.table')}</p>
                <p className="font-medium text-gray-900 dark:text-gray-100">{selected.tableNumber || '—'}</p>
              </div>
              <div>
                <p className="text-xs text-gray-400">{t('common.waiter')}</p>
                <p className="font-medium text-gray-900 dark:text-gray-100">{selected.waiter || '—'}</p>
              </div>
              <div>
                <p className="text-xs text-gray-400">{t('invoices.col.payment')}</p>
                <Badge variant={PAYMENT_VARIANT[selected.paymentMethod] || 'default'}>
                  {selected.paymentMethod || 'cash'}
                </Badge>
              </div>
              <div>
                <p className="text-xs text-gray-400">{t('invoices.col.currency')}</p>
                <p className="font-medium text-gray-900 dark:text-gray-100">{selected.currency || 'LAK'}</p>
              </div>
            </div>

            {/* Items */}
            <div>
              <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">{t('orders.items')}</p>
              <div className="space-y-1.5">
                {(selected.items || []).map((item, i) => (
                  <div key={i} className="flex justify-between text-sm">
                    <span className="text-gray-700 dark:text-gray-300">{item.name} ×{item.quantity}</span>
                    <span className="text-gray-900 dark:text-gray-100 font-medium">{formatCurrency(item.lineTotal)}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Totals */}
            <div className="border-t border-gray-100 dark:border-gray-700 pt-3 space-y-1.5 text-sm">
              <div className="flex justify-between text-gray-500 dark:text-gray-400">
                <span>{t('common.subtotal')}</span>
                <span>{formatCurrency(selected.subtotal)}</span>
              </div>
              {selected.discount > 0 && (
                <div className="flex justify-between text-red-500">
                  <span>{t('sell.discount')}</span>
                  <span>-{formatCurrency(selected.discount)}</span>
                </div>
              )}
              <div className="flex justify-between text-gray-500 dark:text-gray-400">
                <span>{t('orders.tax')}</span>
                <span>{formatCurrency(selected.tax)}</span>
              </div>
              <div className="flex justify-between font-bold text-gray-900 dark:text-gray-100 text-base pt-1 border-t border-gray-100 dark:border-gray-700">
                <span>{t('common.total')}</span>
                <span>{formatCurrency(selected.total)}</span>
              </div>
              {selected.cashTendered > 0 && (
                <>
                  <div className="flex justify-between text-gray-500 dark:text-gray-400">
                    <span>{t('sell.cashTendered')}</span>
                    <span>{formatCurrency(selected.cashTendered)}</span>
                  </div>
                  <div className="flex justify-between font-semibold text-green-600 dark:text-green-400">
                    <span>{t('sell.change')}</span>
                    <span>{formatCurrency(selected.changeAmount)}</span>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
