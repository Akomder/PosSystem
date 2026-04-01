import { useState, useEffect, useCallback } from 'react'
import { Plus, Search, BookOpen, TrendingUp, TrendingDown, Wallet } from 'lucide-react'
import clsx from 'clsx'
import { useSettings } from '../context/SettingsContext'
import { cashflowApi } from '../services/api'
import Button from '../components/ui/Button'
import Input from '../components/ui/Input'
import Select from '../components/ui/Select'
import Modal from '../components/ui/Modal'
import EmptyState from '../components/ui/EmptyState'
import Badge from '../components/ui/Badge'
import { formatCurrency } from '../utils/formatters'

const CATEGORY_OPTIONS_INCOME = [
  { value: 'Sales',       label: 'Sales'        },
  { value: 'Catering',    label: 'Catering'     },
  { value: 'Other Income',label: 'Other Income' },
]
const CATEGORY_OPTIONS_EXPENSE = [
  { value: 'Food & Beverage', label: 'Food & Beverage' },
  { value: 'Utilities',       label: 'Utilities'       },
  { value: 'Salaries',        label: 'Salaries'        },
  { value: 'Rent',            label: 'Rent'            },
  { value: 'Marketing',       label: 'Marketing'       },
  { value: 'Other Expense',   label: 'Other Expense'   },
]

const EMPTY_FORM = { type: 'income', category: '', amount: '', note: '', createdBy: '' }

export default function CashFlow() {
  const { t } = useSettings()

  const [entries,  setEntries]  = useState([])
  const [summary,  setSummary]  = useState({ totalIncome: 0, totalExpense: 0, balance: 0, openingBalance: 0, closingBalance: 0 })
  const [loading,  setLoading]  = useState(true)
  const [search,   setSearch]   = useState('')
  const [typeFilter,   setTypeFilter]   = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [modalOpen, setModalOpen] = useState(false)
  const [form,      setForm]      = useState(EMPTY_FORM)
  const [saving,    setSaving]    = useState(false)
  const [error,     setError]     = useState('')

  const load = useCallback(async () => {
    try {
      setLoading(true)
      const params = {}
      if (search)       params.search = search
      if (typeFilter)   params.type   = typeFilter
      if (statusFilter) params.status = statusFilter
      const data = await cashflowApi.getAll(params)
      setEntries(data.entries)
      setSummary(data.summary)
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }, [search, typeFilter, statusFilter])

  useEffect(() => { load() }, [load])

  const openModal = (defaultType = 'income') => {
    setForm({ ...EMPTY_FORM, type: defaultType })
    setError('')
    setModalOpen(true)
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!form.amount || isNaN(parseFloat(form.amount))) { setError('Valid amount required'); return }
    setSaving(true)
    setError('')
    try {
      await cashflowApi.create({
        ...form,
        amount: parseFloat(form.amount),
        category: form.category || (form.type === 'income' ? 'Other Income' : 'Other Expense'),
      })
      setModalOpen(false)
      load()
    } catch (e) {
      setError(e.message)
    } finally {
      setSaving(false)
    }
  }

  const handleStatusChange = async (id, status) => {
    try {
      const updated = await cashflowApi.updateStatus(id, status)
      setEntries(prev => prev.map(e => e.id === updated.id ? updated : e))
      load() // refresh summary
    } catch (e) {
      alert(e.message)
    }
  }

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this entry?')) return
    try {
      await cashflowApi.delete(id)
      load()
    } catch (e) {
      alert(e.message)
    }
  }

  const categoryOptions = form.type === 'income' ? CATEGORY_OPTIONS_INCOME : CATEGORY_OPTIONS_EXPENSE

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div>
          <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100">{t('cashflow.title')}</h2>
          <p className="text-sm text-gray-400 dark:text-gray-500 mt-0.5">{t('cashflow.subtitle')}</p>
        </div>
        <div className="flex gap-2">
          <Button variant="success" icon={Plus} onClick={() => openModal('income')}>
            {t('cashflow.addIncome')}
          </Button>
          <Button variant="danger" icon={Plus} onClick={() => openModal('expense')}>
            {t('cashflow.addExpense')}
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
        {[
          { label: t('cashflow.openingBalance'), value: summary.openingBalance, icon: Wallet,       color: 'text-gray-600 dark:text-gray-300',    bg: 'bg-gray-50 dark:bg-gray-700/50'       },
          { label: t('cashflow.totalIncome'),    value: summary.totalIncome,    icon: TrendingUp,   color: 'text-green-600 dark:text-green-400',  bg: 'bg-green-50 dark:bg-green-900/20'     },
          { label: t('cashflow.totalExpense'),   value: summary.totalExpense,   icon: TrendingDown, color: 'text-red-600 dark:text-red-400',      bg: 'bg-red-50 dark:bg-red-900/20'         },
          { label: t('cashflow.closingBalance'), value: summary.closingBalance, icon: Wallet,       color: 'text-indigo-600 dark:text-indigo-400', bg: 'bg-indigo-50 dark:bg-indigo-900/20'  },
        ].map(card => (
          <div key={card.label} className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 p-4">
            <div className="flex items-center gap-3">
              <div className={clsx('w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0', card.bg)}>
                <card.icon size={16} className={card.color} />
              </div>
              <div>
                <p className="text-xs text-gray-500 dark:text-gray-400">{card.label}</p>
                <p className={clsx('text-base font-bold', card.color)}>{formatCurrency(card.value)}</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex gap-3 mb-5 flex-wrap">
        <div className="flex-1 min-w-48">
          <Input
            placeholder={t('cashflow.search')}
            value={search}
            onChange={e => setSearch(e.target.value)}
            icon={Search}
          />
        </div>
        <div className="w-36">
          <Select
            value={typeFilter}
            onChange={e => setTypeFilter(e.target.value)}
            options={[
              { value: '', label: t('cashflow.allTypes') },
              { value: 'income',  label: t('cashflow.income')  },
              { value: 'expense', label: t('cashflow.expense') },
            ]}
          />
        </div>
        <div className="w-36">
          <Select
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value)}
            options={[
              { value: '', label: t('cashflow.allStatuses') },
              { value: 'paid',      label: t('cashflow.paid')      },
              { value: 'cancelled', label: t('cashflow.cancelled') },
            ]}
          />
        </div>
      </div>

      {/* Table */}
      {loading ? (
        <div className="flex items-center justify-center py-16 gap-2 text-gray-400">
          <div className="w-4 h-4 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
          {t('common.loading')}
        </div>
      ) : entries.length === 0 ? (
        <EmptyState
          icon={BookOpen}
          title={t('cashflow.noEntries')}
          description={t('cashflow.noEntriesDesc')}
          action={
            <div className="flex gap-2">
              <Button variant="success" icon={Plus} onClick={() => openModal('income')}>{t('cashflow.addIncome')}</Button>
              <Button variant="danger"  icon={Plus} onClick={() => openModal('expense')}>{t('cashflow.addExpense')}</Button>
            </div>
          }
        />
      ) : (
        <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 dark:border-gray-700">
                {[
                  t('cashflow.col.code'),
                  t('cashflow.col.type'),
                  t('cashflow.col.category'),
                  t('cashflow.col.note'),
                  t('cashflow.col.amount'),
                  t('cashflow.col.status'),
                  t('cashflow.col.actions'),
                ].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50 dark:divide-gray-700">
              {entries.map(e => (
                <tr key={e.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
                  <td className="px-4 py-3 font-mono text-xs text-gray-500 dark:text-gray-400">{e.code}</td>
                  <td className="px-4 py-3">
                    <Badge variant={e.type === 'income' ? 'success' : 'danger'}>
                      {e.type === 'income' ? t('cashflow.income') : t('cashflow.expense')}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 text-gray-700 dark:text-gray-300">{e.category}</td>
                  <td className="px-4 py-3 text-gray-500 dark:text-gray-400 max-w-xs truncate">{e.note || '—'}</td>
                  <td className={clsx(
                    'px-4 py-3 font-semibold',
                    e.type === 'income' ? 'text-green-600 dark:text-green-400' : 'text-red-500 dark:text-red-400'
                  )}>
                    {e.type === 'expense' ? '-' : '+'}{formatCurrency(e.amount)}
                  </td>
                  <td className="px-4 py-3">
                    <Badge variant={e.status === 'paid' ? 'success' : 'default'}>
                      {e.status === 'paid' ? t('cashflow.paid') : t('cashflow.cancelled')}
                    </Badge>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1">
                      {e.status !== 'paid' && (
                        <button
                          onClick={() => handleStatusChange(e.id, 'paid')}
                          className="px-2 py-1 text-xs text-green-600 dark:text-green-400 hover:bg-green-50 dark:hover:bg-green-900/20 rounded-lg transition-colors"
                        >
                          {t('cashflow.markPaid')}
                        </button>
                      )}
                      {e.status !== 'cancelled' && (
                        <button
                          onClick={() => handleStatusChange(e.id, 'cancelled')}
                          className="px-2 py-1 text-xs text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                        >
                          {t('cashflow.markCancelled')}
                        </button>
                      )}
                      <button
                        onClick={() => handleDelete(e.id)}
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

      {/* Modal */}
      <Modal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title={form.type === 'income' ? t('cashflow.addIncome') : t('cashflow.addExpense')}
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
          <div className="flex gap-2">
            {['income', 'expense'].map(type => (
              <button
                key={type}
                type="button"
                onClick={() => setForm(f => ({ ...f, type, category: '' }))}
                className={clsx(
                  'flex-1 py-2 rounded-xl text-sm font-medium transition-colors',
                  form.type === type
                    ? type === 'income'
                      ? 'bg-green-600 text-white'
                      : 'bg-red-500 text-white'
                    : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300'
                )}
              >
                {type === 'income' ? t('cashflow.income') : t('cashflow.expense')}
              </button>
            ))}
          </div>
          <Select
            label={t('cashflow.category')}
            value={form.category}
            onChange={e => setForm(f => ({ ...f, category: e.target.value }))}
            options={[{ value: '', label: '— Select —' }, ...categoryOptions]}
          />
          <Input
            label={t('cashflow.amount')}
            type="number"
            min="0"
            step="0.01"
            value={form.amount}
            onChange={e => setForm(f => ({ ...f, amount: e.target.value }))}
            required
          />
          <Input
            label={t('cashflow.note')}
            value={form.note}
            onChange={e => setForm(f => ({ ...f, note: e.target.value }))}
          />
          <Input
            label={t('cashflow.createdBy')}
            value={form.createdBy}
            onChange={e => setForm(f => ({ ...f, createdBy: e.target.value }))}
          />
        </form>
      </Modal>
    </div>
  )
}
