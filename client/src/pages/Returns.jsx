import { useState, useEffect, useCallback } from 'react'
import { Plus, Search, RotateCcw } from 'lucide-react'
import clsx from 'clsx'
import { useSettings } from '../context/SettingsContext'
import { returnsApi, ordersApi } from '../services/api'
import Button from '../components/ui/Button'
import Input from '../components/ui/Input'
import Select from '../components/ui/Select'
import Modal from '../components/ui/Modal'
import EmptyState from '../components/ui/EmptyState'
import Badge from '../components/ui/Badge'
import { formatCurrency, formatDate } from '../utils/formatters'

const EMPTY_FORM = { orderId: '', reason: '', items: [] }

const STATUS_VARIANT = { pending: 'warning', approved: 'success', rejected: 'danger' }

export default function Returns() {
  const { t } = useSettings()
  const [returns,    setReturns]    = useState([])
  const [loading,    setLoading]    = useState(true)
  const [search,     setSearch]     = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [modalOpen,  setModalOpen]  = useState(false)
  const [form,       setForm]       = useState(EMPTY_FORM)
  const [saving,     setSaving]     = useState(false)
  const [error,      setError]      = useState('')
  const [orderSearch, setOrderSearch] = useState('')
  const [orderResults, setOrderResults] = useState([])

  const load = useCallback(async () => {
    try {
      setLoading(true)
      const params = {}
      if (search)       params.search = search
      if (statusFilter) params.status = statusFilter
      const data = await returnsApi.getAll(params)
      setReturns(data)
    } catch (e) { console.error(e) }
    finally { setLoading(false) }
  }, [search, statusFilter])

  useEffect(() => { load() }, [load])

  // Order search for modal
  useEffect(() => {
    if (!orderSearch.trim()) { setOrderResults([]); return }
    const timer = setTimeout(async () => {
      try {
        const data = await ordersApi.getAll({ status: 'Closed' })
        const q = orderSearch.toLowerCase()
        setOrderResults(data.filter(o =>
          String(o.id).toLowerCase().includes(q) || String(o.tableNumber).includes(q)
        ).slice(0, 8))
      } catch {}
    }, 300)
    return () => clearTimeout(timer)
  }, [orderSearch])

  const openModal = () => {
    setForm(EMPTY_FORM)
    setOrderSearch('')
    setOrderResults([])
    setError('')
    setModalOpen(true)
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!form.reason.trim()) { setError('Reason is required'); return }
    setSaving(true)
    setError('')
    try {
      await returnsApi.create({
        orderId: form.orderId ? parseInt(String(form.orderId).replace('ORD-', ''), 10) : null,
        reason:  form.reason,
        items:   form.items,
      })
      setModalOpen(false)
      load()
    } catch (e) {
      setError(e.message)
    } finally {
      setSaving(false)
    }
  }

  const handleStatus = async (id, status) => {
    try {
      const updated = await returnsApi.updateStatus(id, status)
      setReturns(prev => prev.map(r => r.id === updated.id ? updated : r))
    } catch (e) { alert(e.message) }
  }

  const handleDelete = async (id) => {
    if (!window.confirm(t('returns.deleteConfirm'))) return
    try {
      await returnsApi.delete(id)
      load()
    } catch (e) { alert(e.message) }
  }

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div>
          <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100">{t('returns.title')}</h2>
          <p className="text-sm text-gray-400 dark:text-gray-500 mt-0.5">{t('returns.subtitle')}</p>
        </div>
        <Button variant="primary" icon={Plus} onClick={openModal}>
          {t('returns.add')}
        </Button>
      </div>

      {/* Filters */}
      <div className="flex gap-3 mb-5">
        <div className="flex-1 min-w-48">
          <Input placeholder={t('returns.search')} value={search} onChange={e => setSearch(e.target.value)} icon={Search} />
        </div>
        <div className="w-40">
          <Select
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value)}
            options={[
              { value: '',         label: t('returns.allStatuses') },
              { value: 'pending',  label: t('returns.pending')     },
              { value: 'approved', label: t('returns.approved')    },
              { value: 'rejected', label: t('returns.rejected')    },
            ]}
          />
        </div>
      </div>

      {/* Table */}
      {loading ? (
        <div className="flex items-center justify-center py-16 gap-2 text-gray-400">
          <div className="w-4 h-4 border-2 border-teal-500 border-t-transparent rounded-full animate-spin" />
          {t('common.loading')}
        </div>
      ) : returns.length === 0 ? (
        <EmptyState
          icon={RotateCcw}
          title={t('returns.noReturns')}
          description={t('returns.noReturnsDesc')}
          action={<Button variant="primary" icon={Plus} onClick={openModal}>{t('returns.add')}</Button>}
        />
      ) : (
        <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 dark:border-gray-700">
                {[
                  t('returns.col.code'),
                  t('returns.col.order'),
                  t('returns.col.reason'),
                  t('returns.col.refund'),
                  t('returns.col.status'),
                  t('returns.col.date'),
                  t('returns.col.actions'),
                ].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50 dark:divide-gray-700">
              {returns.map(r => (
                <tr key={r.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
                  <td className="px-4 py-3 font-mono text-xs text-gray-500 dark:text-gray-400">{`RET-${String(r.id).padStart(3,'0')}`}</td>
                  <td className="px-4 py-3 text-gray-700 dark:text-gray-300">{r.orderId || '—'}</td>
                  <td className="px-4 py-3 text-gray-700 dark:text-gray-300 max-w-xs truncate">{r.reason}</td>
                  <td className="px-4 py-3 font-semibold text-red-500 dark:text-red-400">{formatCurrency(r.total)}</td>
                  <td className="px-4 py-3">
                    <Badge variant={STATUS_VARIANT[r.status] || 'default'}>
                      {t(`returns.${r.status}`)}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 text-gray-500 dark:text-gray-400 text-xs">{formatDate(r.createdAt)}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1">
                      {r.status === 'pending' && (
                        <>
                          <button
                            onClick={() => handleStatus(r.id, 'approved')}
                            className="px-2 py-1 text-xs text-green-600 dark:text-green-400 hover:bg-green-50 dark:hover:bg-green-900/20 rounded-lg transition-colors"
                          >
                            {t('returns.approve')}
                          </button>
                          <button
                            onClick={() => handleStatus(r.id, 'rejected')}
                            className="px-2 py-1 text-xs text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                          >
                            {t('returns.reject')}
                          </button>
                        </>
                      )}
                      <button
                        onClick={() => handleDelete(r.id)}
                        className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                      >
                        ×
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Create Modal */}
      <Modal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title={t('returns.add')}
        footer={
          <div className="flex gap-2 justify-end">
            <Button variant="secondary" onClick={() => setModalOpen(false)}>{t('common.cancel')}</Button>
            <Button variant="primary" onClick={handleSubmit} disabled={saving}>
              {saving ? t('common.saving') : t('common.save')}
            </Button>
          </div>
        }
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && <p className="text-sm text-red-500">{error}</p>}

          {/* Order search */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
              {t('returns.linkedOrder')} <span className="text-gray-400 font-normal">({t('returns.optional')})</span>
            </label>
            {form.orderId ? (
              <div className="flex items-center justify-between bg-teal-50 dark:bg-teal-900/20 rounded-xl px-3 py-2">
                <span className="text-sm font-medium text-teal-700 dark:text-teal-300">{form.orderId}</span>
                <button
                  type="button"
                  onClick={() => setForm(f => ({ ...f, orderId: '' }))}
                  className="text-teal-400 hover:text-teal-600 text-xs"
                >
                  ×
                </button>
              </div>
            ) : (
              <div className="relative">
                <input
                  placeholder={t('returns.searchOrder')}
                  value={orderSearch}
                  onChange={e => setOrderSearch(e.target.value)}
                  className="w-full px-3 py-2 text-sm bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-500 text-gray-900 dark:text-gray-100"
                />
                {orderResults.length > 0 && (
                  <div className="absolute left-0 right-0 top-full z-20 mt-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-xl shadow-lg overflow-hidden">
                    {orderResults.map(o => (
                      <button
                        key={o.id}
                        type="button"
                        onClick={() => {
                          setForm(f => ({ ...f, orderId: o.id }))
                          setOrderSearch('')
                          setOrderResults([])
                        }}
                        className="w-full flex items-center justify-between px-4 py-2.5 hover:bg-teal-50 dark:hover:bg-teal-900/20 text-left"
                      >
                        <span className="text-sm font-medium text-gray-900 dark:text-gray-100">{o.id}</span>
                        <span className="text-xs text-gray-400">{t('common.table')} {o.tableNumber} · {formatCurrency(o.total)}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
              {t('returns.reason')} *
            </label>
            <textarea
              rows={3}
              placeholder={t('returns.reasonPlaceholder')}
              value={form.reason}
              onChange={e => setForm(f => ({ ...f, reason: e.target.value }))}
              className="w-full px-3 py-2 text-sm bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-500 text-gray-900 dark:text-gray-100 resize-none"
            />
          </div>
        </form>
      </Modal>
    </div>
  )
}
