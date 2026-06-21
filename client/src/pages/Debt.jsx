import { useState, useEffect, useCallback } from 'react'
import { Plus, Search, AlertCircle, CheckCircle, Clock, Wallet, Trash2, CreditCard, ChevronDown, ChevronUp, Receipt } from 'lucide-react'
import clsx from 'clsx'
import { useSettings } from '../context/SettingsContext'
import { debtsApi, customersApi, ordersApi } from '../services/api'
import Button from '../components/ui/Button'
import Input from '../components/ui/Input'
import Modal from '../components/ui/Modal'
import EmptyState from '../components/ui/EmptyState'
import Badge from '../components/ui/Badge'
import { APP_TIME_ZONE, formatCurrency } from '../utils/formatters'

const STATUS_VARIANTS = {
  unpaid:  'danger',
  partial: 'warning',
  paid:    'success',
}

const STATUS_ICONS = {
  unpaid:  AlertCircle,
  partial: Clock,
  paid:    CheckCircle,
}

const EMPTY_FORM = {
  type:        'customer',   // 'customer' | 'manual'
  customerId:  '',
  debtorName:  '',
  debtorPhone: '',
  amount:      '',
  description: '',
  dueDate:     '',
  orderId:     '',           // raw numeric order id
  orderLabel:  '',           // display string
}

function StatCard({ label, value, sub, color = 'gray' }) {
  const colors = {
    red:    'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300',
    yellow: 'bg-yellow-50 dark:bg-yellow-900/20 text-yellow-700 dark:text-yellow-300',
    teal:   'bg-teal-50 dark:bg-teal-900/20 text-teal-700 dark:text-teal-300',
    gray:   'bg-gray-50 dark:bg-gray-700/40 text-gray-700 dark:text-gray-300',
  }
  return (
    <div className={clsx('rounded-2xl p-4', colors[color])}>
      <p className="text-xs font-medium opacity-70 mb-1">{label}</p>
      <p className="text-2xl font-bold">{value}</p>
      {sub && <p className="text-xs opacity-60 mt-0.5">{sub}</p>}
    </div>
  )
}

function DebtRow({ debt, onPay, onDelete }) {
  const { t } = useSettings()
  const [expanded, setExpanded] = useState(false)
  const [payments, setPayments] = useState(null)
  const Icon = STATUS_ICONS[debt.status] || AlertCircle

  const loadPayments = async () => {
    if (payments !== null) { setExpanded(e => !e); return }
    try {
      const d = await debtsApi.getOne(debt.id)
      setPayments(d.payments || [])
      setExpanded(true)
    } catch {}
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden">
      <div className="flex items-center gap-4 px-5 py-4">
        {/* Avatar */}
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-orange-400 to-red-500 flex items-center justify-center text-white font-bold text-sm flex-shrink-0">
          {debt.displayName.charAt(0).toUpperCase()}
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="font-semibold text-gray-900 dark:text-gray-100 truncate">{debt.displayName}</p>
            {debt.isCustomer && (
              <span className="text-[10px] bg-teal-100 dark:bg-teal-900/40 text-teal-700 dark:text-teal-300 px-1.5 py-0.5 rounded-full font-medium">Customer</span>
            )}
            {debt.orderId && (
              <span className="text-[10px] bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 px-1.5 py-0.5 rounded-full font-medium flex items-center gap-0.5">
                <Receipt size={9} />
                {t('debt.bill')} #{debt.orderId}
              </span>
            )}
          </div>
          {debt.displayPhone && (
            <p className="text-xs text-gray-400 mt-0.5">{debt.displayPhone}</p>
          )}
          {debt.description && (
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 truncate">{debt.description}</p>
          )}
        </div>

        {/* Amounts */}
        <div className="text-right flex-shrink-0">
          <p className="text-lg font-bold text-red-600 dark:text-red-400">{formatCurrency(debt.remaining)}</p>
          <p className="text-xs text-gray-400">{t('debt.of')} {formatCurrency(debt.amount)}</p>
        </div>

        {/* Status */}
        <div className="flex-shrink-0">
          <Badge variant={STATUS_VARIANTS[debt.status]}>
            <Icon size={11} className="inline mr-1" />
            {t(`debt.status.${debt.status}`)}
          </Badge>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-1.5 flex-shrink-0">
          {debt.status !== 'paid' && (
            <button
              onClick={() => onPay(debt)}
              className="p-2 rounded-xl text-teal-600 hover:bg-teal-50 dark:hover:bg-teal-900/30 transition-colors"
              title={t('debt.recordPayment')}
            >
              <CreditCard size={16} />
            </button>
          )}
          <button
            onClick={loadPayments}
            className="p-2 rounded-xl text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
            title={t('debt.history')}
          >
            {expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          </button>
          <button
            onClick={() => onDelete(debt)}
            className="p-2 rounded-xl text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
            title={t('common.delete')}
          >
            <Trash2 size={16} />
          </button>
        </div>
      </div>

      {/* Expanded payment history */}
      {expanded && (
        <div className="border-t border-gray-100 dark:border-gray-700 px-5 py-3 bg-gray-50 dark:bg-gray-700/30">
          {debt.dueDate && (
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">
              Due: <span className="font-medium">{new Date(debt.dueDate).toLocaleDateString('en-US', { timeZone: APP_TIME_ZONE })}</span>
            </p>
          )}
          <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2">{t('debt.payments')}</p>
          {payments === null ? (
            <p className="text-xs text-gray-400">{t('common.loading')}…</p>
          ) : payments.length === 0 ? (
            <p className="text-xs text-gray-400">{t('debt.noPayments')}</p>
          ) : (
            <div className="space-y-1.5">
              {payments.map(p => (
                <div key={p.id} className="flex items-center justify-between text-xs">
                  <span className="text-gray-500 dark:text-gray-400">
                    {new Date(p.createdAt).toLocaleString('en-US', { timeZone: APP_TIME_ZONE })}
                    {p.note && ` — ${p.note}`}
                  </span>
                  <span className="font-semibold text-teal-600 dark:text-teal-400">+{formatCurrency(p.amount)}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default function Debt() {
  const { t } = useSettings()

  const [debts,   setDebts]   = useState([])
  const [summary, setSummary] = useState({ unpaidCount: 0, partialCount: 0, totalRemaining: 0 })
  const [loading, setLoading] = useState(true)
  const [search,  setSearch]  = useState('')
  const [statusFilter, setStatusFilter] = useState('')

  // Modals
  const [addOpen,  setAddOpen]  = useState(false)
  const [payDebt,  setPayDebt]  = useState(null)
  const [delDebt,  setDelDebt]  = useState(null)
  const [saving,   setSaving]   = useState(false)

  // Form state
  const [form,      setForm]      = useState(EMPTY_FORM)
  const [customers, setCustomers] = useState([])
  const [openOrders, setOpenOrders] = useState([])
  const [ordersLoading, setOrdersLoading] = useState(false)

  // Payment form
  const [payAmount, setPayAmount] = useState('')
  const [payNote,   setPayNote]   = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const params = {}
      if (statusFilter) params.status = statusFilter
      if (search)       params.search = search
      const d = await debtsApi.getAll(params)
      setDebts(d.debts || [])
      setSummary(d.summary || { unpaidCount: 0, partialCount: 0, totalRemaining: 0 })
    } catch {}
    setLoading(false)
  }, [statusFilter, search])

  useEffect(() => { load() }, [load])

  const openAdd = async () => {
    setForm(EMPTY_FORM)

    // Load customers + open orders in parallel
    setOrdersLoading(true)
    try {
      const [custData, orderData] = await Promise.all([
        customers.length ? Promise.resolve(customers) : customersApi.getAll({ limit: 500 }).then(d => d.customers || d || []),
        ordersApi.getAll({ status: 'Pending', limit: 200 }),
      ])
      setCustomers(Array.isArray(custData) ? custData : [])
      // Also fetch served orders (bill printed but not closed)
      const servedData = await ordersApi.getAll({ status: 'Served', limit: 200 })
      setOpenOrders([...(orderData || []), ...(servedData || [])])
    } catch {}
    setOrdersLoading(false)
    setAddOpen(true)
  }

  // When a bill is selected, auto-fill amount and description
  const handleOrderSelect = (orderId) => {
    if (!orderId) {
      setForm(f => ({ ...f, orderId: '', orderLabel: '', amount: '', description: '' }))
      return
    }
    const order = openOrders.find(o => String(o.rawId) === String(orderId))
    if (!order) return
    setForm(f => ({
      ...f,
      orderId:     String(order.rawId),
      orderLabel:  order.id,
      amount:      String(order.total),
      description: `${t('debt.bill')} ${order.id}${order.tableNumber ? ` — ${t('debt.table')} ${order.tableNumber}` : ''}`,
    }))
  }

  const handleCreate = async () => {
    if (!form.amount || parseFloat(form.amount) <= 0) return
    if (form.type === 'customer' && !form.customerId) return
    if (form.type === 'manual'   && !form.debtorName.trim()) return

    setSaving(true)
    try {
      const body = {
        amount:      parseFloat(form.amount),
        description: form.description || undefined,
        dueDate:     form.dueDate     || undefined,
        orderId:     form.orderId     ? parseInt(form.orderId) : undefined,
      }
      if (form.type === 'customer') {
        body.customerId = parseInt(form.customerId)
      } else {
        body.debtorName  = form.debtorName.trim()
        body.debtorPhone = form.debtorPhone.trim() || undefined
      }
      await debtsApi.create(body)
      setAddOpen(false)
      load()
    } catch {}
    setSaving(false)
  }

  const handlePayment = async () => {
    if (!payAmount || parseFloat(payAmount) <= 0) return
    setSaving(true)
    try {
      await debtsApi.recordPayment(payDebt.id, {
        amount: parseFloat(payAmount),
        note:   payNote || undefined,
      })
      setPayDebt(null)
      setPayAmount('')
      setPayNote('')
      load()
    } catch {}
    setSaving(false)
  }

  const handleDelete = async () => {
    if (!delDebt) return
    setSaving(true)
    try {
      await debtsApi.delete(delDebt.id)
      setDelDebt(null)
      load()
    } catch {}
    setSaving(false)
  }

  return (
    <div className="flex flex-col h-full bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <div className="bg-white dark:bg-gray-800 border-b border-gray-100 dark:border-gray-700 px-6 py-5 flex items-center justify-between flex-shrink-0">
        <div>
          <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">{t('debt.title')}</h1>
          <p className="text-sm text-gray-400 mt-0.5">{t('debt.subtitle')}</p>
        </div>
        <Button onClick={openAdd} className="flex items-center gap-2">
          <Plus size={16} />
          {t('debt.addDebt')}
        </Button>
      </div>

      <div className="flex-1 overflow-y-auto p-6 space-y-5">
        {/* Summary cards */}
        <div className="grid grid-cols-3 gap-4">
          <StatCard
            label={t('debt.totalUnpaid')}
            value={formatCurrency(summary.totalRemaining)}
            sub={`${summary.unpaidCount + summary.partialCount} ${t('debt.openDebts')}`}
            color="red"
          />
          <StatCard
            label={t('debt.unpaid')}
            value={summary.unpaidCount}
            sub={t('debt.fullyUnpaid')}
            color="yellow"
          />
          <StatCard
            label={t('debt.partial')}
            value={summary.partialCount}
            sub={t('debt.partiallyPaid')}
            color="teal"
          />
        </div>

        {/* Filters */}
        <div className="flex gap-3">
          <div className="flex-1">
            <Input
              placeholder={t('debt.searchPlaceholder')}
              value={search}
              onChange={e => setSearch(e.target.value)}
              icon={Search}
            />
          </div>
          <select
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value)}
            className="px-3 py-2 text-sm bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-xl text-gray-700 dark:text-gray-300 focus:outline-none focus:ring-2 focus:ring-teal-500"
          >
            <option value="">{t('debt.allStatuses')}</option>
            <option value="unpaid">{t('debt.status.unpaid')}</option>
            <option value="partial">{t('debt.status.partial')}</option>
            <option value="paid">{t('debt.status.paid')}</option>
          </select>
        </div>

        {/* List */}
        {loading ? (
          <div className="flex justify-center py-16 text-gray-400">{t('common.loading')}…</div>
        ) : debts.length === 0 ? (
          <EmptyState
            icon={Wallet}
            title={t('debt.noDebts')}
            description={t('debt.noDebtsDesc')}
          />
        ) : (
          <div className="space-y-3">
            {debts.map(debt => (
              <DebtRow
                key={debt.id}
                debt={debt}
                onPay={d => { setPayDebt(d); setPayAmount(''); setPayNote('') }}
                onDelete={d => setDelDebt(d)}
              />
            ))}
          </div>
        )}
      </div>

      {/* ── Add Debt Modal ─────────────────────────────────────────────────────── */}
      <Modal isOpen={addOpen} onClose={() => setAddOpen(false)} title={t('debt.addDebtTitle')}>
        <div className="space-y-4">

          {/* ── Bill picker ─────────────────────────────────────────────────────── */}
          <div>
            <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
              {t('debt.attachBill')}
              <span className="ml-1 text-gray-400 font-normal">({t('common.optional')})</span>
            </label>
            {ordersLoading ? (
              <p className="text-xs text-gray-400 py-2">{t('common.loading')}…</p>
            ) : openOrders.length === 0 ? (
              <p className="text-xs text-gray-400 py-2 italic">{t('debt.noOpenBills')}</p>
            ) : (
              <select
                value={form.orderId}
                onChange={e => handleOrderSelect(e.target.value)}
                className="w-full px-3 py-2.5 text-sm bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-500 text-gray-900 dark:text-gray-100"
              >
                <option value="">{t('debt.selectBillPlaceholder')}</option>
                {openOrders.map(o => (
                  <option key={o.rawId} value={o.rawId}>
                    {o.id}
                    {o.tableNumber ? ` — ${t('debt.table')} ${o.tableNumber}` : ''}
                    {o.waiter ? ` (${o.waiter})` : ''}
                    {` — ${formatCurrency(o.total)}`}
                  </option>
                ))}
              </select>
            )}
            {form.orderId && (
              <button
                onClick={() => handleOrderSelect('')}
                className="mt-1 text-xs text-gray-400 hover:text-red-500 transition-colors"
              >
                ✕ {t('debt.clearBill')}
              </button>
            )}
          </div>

          {/* Divider */}
          <div className="flex items-center gap-3">
            <div className="flex-1 border-t border-gray-100 dark:border-gray-700" />
            <span className="text-xs text-gray-400">{t('debt.debtorType')}</span>
            <div className="flex-1 border-t border-gray-100 dark:border-gray-700" />
          </div>

          {/* Type toggle */}
          <div className="flex gap-2">
            {['customer', 'manual'].map(type => (
              <button
                key={type}
                onClick={() => setForm(f => ({ ...f, type, customerId: '', debtorName: '', debtorPhone: '' }))}
                className={clsx(
                  'flex-1 py-2 rounded-xl text-sm font-medium transition-colors',
                  form.type === type
                    ? 'bg-teal-600 text-white'
                    : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                )}
              >
                {type === 'customer' ? t('debt.registeredCustomer') : t('debt.newPerson')}
              </button>
            ))}
          </div>

          {/* Customer selector */}
          {form.type === 'customer' ? (
            <div>
              <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">{t('debt.selectCustomer')}</label>
              <select
                value={form.customerId}
                onChange={e => setForm(f => ({ ...f, customerId: e.target.value }))}
                className="w-full px-3 py-2.5 text-sm bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-500 text-gray-900 dark:text-gray-100"
              >
                <option value="">{t('debt.selectCustomerPlaceholder')}</option>
                {customers.map(c => (
                  <option key={c.id} value={c.id}>{c.name}{c.phone ? ` — ${c.phone}` : ''}</option>
                ))}
              </select>
            </div>
          ) : (
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">{t('debt.debtorName')}</label>
                <Input
                  placeholder={t('debt.debtorNamePlaceholder')}
                  value={form.debtorName}
                  onChange={e => setForm(f => ({ ...f, debtorName: e.target.value }))}
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">{t('debt.debtorPhone')}</label>
                <Input
                  placeholder="020 xxxx xxxx"
                  value={form.debtorPhone}
                  onChange={e => setForm(f => ({ ...f, debtorPhone: e.target.value }))}
                />
              </div>
            </div>
          )}

          {/* Amount — auto-filled when a bill is selected, still editable */}
          <div>
            <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
              {t('debt.amount')}
              {form.orderId && <span className="ml-1 text-teal-500 text-[10px]">({t('debt.fromBill')})</span>}
            </label>
            <Input
              type="number"
              min="0"
              step="1000"
              placeholder="0"
              value={form.amount}
              onChange={e => setForm(f => ({ ...f, amount: e.target.value }))}
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">{t('debt.description')}</label>
            <Input
              placeholder={t('debt.descriptionPlaceholder')}
              value={form.description}
              onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
            />
          </div>

          {/* Due date */}
          <div>
            <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">{t('debt.dueDate')}</label>
            <input
              type="date"
              value={form.dueDate}
              onChange={e => setForm(f => ({ ...f, dueDate: e.target.value }))}
              className="w-full px-3 py-2.5 text-sm bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-500 text-gray-900 dark:text-gray-100"
            />
          </div>

          <div className="flex gap-3 pt-1">
            <Button variant="ghost" className="flex-1" onClick={() => setAddOpen(false)}>{t('common.cancel')}</Button>
            <Button className="flex-1" onClick={handleCreate} disabled={saving}>{t('debt.create')}</Button>
          </div>
        </div>
      </Modal>

      {/* ── Record Payment Modal ───────────────────────────────────────────────── */}
      <Modal isOpen={!!payDebt} onClose={() => setPayDebt(null)} title={t('debt.recordPayment')}>
        {payDebt && (
          <div className="space-y-4">
            <div className="bg-gray-50 dark:bg-gray-700/40 rounded-xl px-4 py-3 text-sm">
              <p className="font-semibold text-gray-800 dark:text-gray-100">{payDebt.displayName}</p>
              {payDebt.orderId && (
                <p className="text-xs text-blue-600 dark:text-blue-400 mt-0.5 flex items-center gap-1">
                  <Receipt size={11} /> {t('debt.bill')} #{payDebt.orderId}
                </p>
              )}
              <p className="text-gray-500 dark:text-gray-400 mt-0.5">
                {t('debt.remaining')}: <span className="font-bold text-red-600 dark:text-red-400">{formatCurrency(payDebt.remaining)}</span>
              </p>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">{t('debt.paymentAmount')}</label>
              <Input
                autoFocus
                type="number"
                min="0"
                step="1000"
                placeholder="0"
                value={payAmount}
                onChange={e => setPayAmount(e.target.value)}
              />
              <button
                onClick={() => setPayAmount(String(payDebt.remaining))}
                className="mt-1.5 text-xs text-teal-600 dark:text-teal-400 hover:underline"
              >
                {t('debt.payFull')} ({formatCurrency(payDebt.remaining)})
              </button>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">{t('debt.paymentNote')}</label>
              <Input
                placeholder={t('debt.paymentNotePlaceholder')}
                value={payNote}
                onChange={e => setPayNote(e.target.value)}
              />
            </div>
            <div className="flex gap-3 pt-1">
              <Button variant="ghost" className="flex-1" onClick={() => setPayDebt(null)}>{t('common.cancel')}</Button>
              <Button className="flex-1" onClick={handlePayment} disabled={saving}>{t('debt.confirmPayment')}</Button>
            </div>
          </div>
        )}
      </Modal>

      {/* ── Delete confirm ─────────────────────────────────────────────────────── */}
      <Modal isOpen={!!delDebt} onClose={() => setDelDebt(null)} title={t('common.confirmDelete')}>
        {delDebt && (
          <div className="space-y-4">
            <p className="text-sm text-gray-600 dark:text-gray-300">
              {t('debt.deleteConfirmPrefix')} <strong>{delDebt.displayName}</strong>? {t('debt.deleteConfirmSuffix')}
            </p>
            <div className="flex gap-3">
              <Button variant="ghost" className="flex-1" onClick={() => setDelDebt(null)}>{t('common.cancel')}</Button>
              <Button variant="danger" className="flex-1" onClick={handleDelete} disabled={saving}>{t('common.delete')}</Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}
