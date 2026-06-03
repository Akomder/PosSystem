import { useState, useEffect, useCallback } from 'react'
import {
  BookUser, Plus, X, ChevronRight, ArrowDownLeft, ArrowUpRight,
  CreditCard, AlertTriangle, CheckCircle2, Search, Ban, RefreshCw,
  Wallet, Users, TrendingUp,
} from 'lucide-react'
import clsx from 'clsx'
import { useSettings } from '../context/SettingsContext'
import { useAuth } from '../context/AuthContext'

// ─── API ──────────────────────────────────────────────────────────────────────
const BASE = '/api/house-accounts'
async function apiFetch(path, opts = {}) {
  const token = localStorage.getItem('pos_sa_user')
    ? JSON.parse(localStorage.getItem('pos_sa_user') || '{}').token
    : JSON.parse(localStorage.getItem('pos_user') || '{}').token
  const res = await fetch(`${BASE}${path}`, {
    ...opts,
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}`, ...(opts.headers || {}) },
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data.error || 'Request failed')
  return data
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function fmtCurrency(n) {
  return new Intl.NumberFormat('lo-LA', { style: 'currency', currency: 'LAK', maximumFractionDigits: 0 }).format(n || 0)
}
function fmtDate(iso) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
}
function fmtDateTime(iso) {
  if (!iso) return '—'
  const d = new Date(iso)
  return `${d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })} ${d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
}

const STATUS_STYLE = {
  active:    { label: 'Active',    cls: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30' },
  suspended: { label: 'Suspended', cls: 'bg-amber-500/15   text-amber-400   border-amber-500/30' },
  closed:    { label: 'Closed',    cls: 'bg-gray-500/15    text-gray-400    border-gray-500/30' },
}

const GROUP_STYLE = {
  VIP:       'bg-amber-500/20 text-amber-300',
  Member:    'bg-teal-500/20  text-teal-300',
  Wholesale: 'bg-blue-500/20  text-blue-300',
  General:   'bg-gray-500/20  text-gray-400',
}

// ─── Summary card ─────────────────────────────────────────────────────────────
function SummaryCard({ icon: Icon, label, value, sub, color }) {
  return (
    <div className="bg-gray-800/60 border border-gray-700/50 rounded-2xl p-5 flex items-start gap-4">
      <div className={clsx('w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0', color)}>
        <Icon size={20} className="text-white" />
      </div>
      <div>
        <p className="text-xs text-gray-500 font-medium uppercase tracking-wider">{label}</p>
        <p className="text-xl font-extrabold text-white mt-0.5">{value}</p>
        {sub && <p className="text-xs text-gray-500 mt-0.5">{sub}</p>}
      </div>
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────
export default function HouseAccounts() {
  const { t } = useSettings()
  const { user } = useAuth()
  const isAdmin = user?.role === 'Admin'

  const [accounts,    setAccounts]    = useState([])
  const [summary,     setSummary]     = useState({ activeCount: 0, totalOutstanding: 0, totalLimit: 0 })
  const [loading,     setLoading]     = useState(true)
  const [search,      setSearch]      = useState('')
  const [filterStatus, setFilterStatus] = useState('')

  // Selected account for detail drawer
  const [selected,    setSelected]    = useState(null)
  const [txLoading,   setTxLoading]   = useState(false)
  const [transactions, setTransactions] = useState([])

  // Modals
  const [showCreate,  setShowCreate]  = useState(false)
  const [showPayment, setShowPayment] = useState(false)
  const [showEdit,    setShowEdit]    = useState(false)
  const [saving,      setSaving]      = useState(false)
  const [error,       setError]       = useState('')

  // Form state — create
  const [customers,   setCustomers]   = useState([])
  const [newCustomer, setNewCustomer] = useState('')
  const [newLimit,    setNewLimit]    = useState('')
  const [newNotes,    setNewNotes]    = useState('')

  // Form state — payment
  const [payAmount,   setPayAmount]   = useState('')
  const [payNote,     setPayNote]     = useState('')

  // Form state — edit account
  const [editLimit,   setEditLimit]   = useState('')
  const [editStatus,  setEditStatus]  = useState('active')
  const [editNotes,   setEditNotes]   = useState('')

  // ── Fetch accounts ──
  const load = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (search)       params.set('search', search)
      if (filterStatus) params.set('status', filterStatus)
      const data = await apiFetch(`?${params}`)
      setAccounts(data.accounts || [])
      setSummary(data.summary || { activeCount: 0, totalOutstanding: 0, totalLimit: 0 })
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }, [search, filterStatus])

  useEffect(() => { load() }, [load])

  // ── Fetch transactions when account is selected ──
  const openAccount = useCallback(async (acc) => {
    setSelected(acc)
    setTransactions([])
    setTxLoading(true)
    try {
      const data = await apiFetch(`/${acc.id}`)
      setSelected(data.account)
      setTransactions(data.transactions || [])
    } catch {}
    setTxLoading(false)
  }, [])

  // Load customer list when create modal opens
  useEffect(() => {
    if (!showCreate) return
    fetch('/api/customers', { headers: { Authorization: `Bearer ${JSON.parse(localStorage.getItem('pos_user') || '{}').token}` } })
      .then(r => r.json())
      .then(d => setCustomers(Array.isArray(d) ? d : (d.customers || [])))
      .catch(() => {})
  }, [showCreate])

  // ── Create account ──
  const handleCreate = async (e) => {
    e.preventDefault()
    if (!newCustomer) return
    setSaving(true); setError('')
    try {
      const acc = await apiFetch('', {
        method: 'POST',
        body: JSON.stringify({ customerId: parseInt(newCustomer), creditLimit: parseFloat(newLimit) || 0, notes: newNotes }),
      })
      setAccounts(prev => [acc, ...prev])
      setShowCreate(false)
      setNewCustomer(''); setNewLimit(''); setNewNotes('')
      load()
    } catch (e) { setError(e.message) }
    setSaving(false)
  }

  // ── Record payment ──
  const handlePayment = async (e) => {
    e.preventDefault()
    if (!payAmount || !selected) return
    setSaving(true); setError('')
    try {
      const res = await apiFetch(`/${selected.id}/payment`, {
        method: 'POST',
        body: JSON.stringify({ amount: parseFloat(payAmount), description: payNote }),
      })
      setSelected(prev => ({ ...prev, balance: res.newBalance }))
      setTransactions(prev => [res.transaction, ...prev])
      setAccounts(prev => prev.map(a => a.id === selected.id ? { ...a, balance: res.newBalance } : a))
      setShowPayment(false)
      setPayAmount(''); setPayNote('')
      load()
    } catch (e) { setError(e.message) }
    setSaving(false)
  }

  // ── Settle full balance ──
  const handleSettleFull = async () => {
    if (!selected || selected.balance <= 0) return
    setSaving(true); setError('')
    try {
      const res = await apiFetch(`/${selected.id}/payment`, {
        method: 'POST',
        body: JSON.stringify({ amount: selected.balance, description: 'Full settlement' }),
      })
      setSelected(prev => ({ ...prev, balance: res.newBalance }))
      setTransactions(prev => [res.transaction, ...prev])
      setAccounts(prev => prev.map(a => a.id === selected.id ? { ...a, balance: res.newBalance } : a))
      load()
    } catch (e) { setError(e.message) }
    setSaving(false)
  }

  // ── Edit account ──
  const openEdit = () => {
    setEditLimit(selected.creditLimit || '')
    setEditStatus(selected.status)
    setEditNotes(selected.notes || '')
    setShowEdit(true)
  }
  const handleEdit = async (e) => {
    e.preventDefault()
    setSaving(true); setError('')
    try {
      const updated = await apiFetch(`/${selected.id}`, {
        method: 'PUT',
        body: JSON.stringify({ creditLimit: parseFloat(editLimit) || 0, status: editStatus, notes: editNotes }),
      })
      setSelected(updated)
      setAccounts(prev => prev.map(a => a.id === updated.id ? updated : a))
      setShowEdit(false)
      load()
    } catch (e) { setError(e.message) }
    setSaving(false)
  }

  return (
    <div className="min-h-screen bg-gray-950 text-white p-6">
      {/* ── Header ── */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-violet-600 rounded-xl flex items-center justify-center shadow-lg shadow-violet-900/40">
            <BookUser size={20} className="text-white" />
          </div>
          <div>
            <h1 className="text-xl font-extrabold text-white">{t('houseAccounts.title')}</h1>
            <p className="text-xs text-gray-400">{t('houseAccounts.subtitle')}</p>
          </div>
        </div>
        {isAdmin && (
          <button
            onClick={() => { setShowCreate(true); setError('') }}
            className="flex items-center gap-2 px-4 py-2.5 bg-violet-600 hover:bg-violet-500 text-white text-sm font-semibold rounded-xl transition-colors"
          >
            <Plus size={15} />
            {t('houseAccounts.newAccount')}
          </button>
        )}
      </div>

      {/* ── Summary cards ── */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <SummaryCard icon={Users}      label={t('houseAccounts.activeAccounts')} value={summary.activeCount}                         color="bg-violet-600"  />
        <SummaryCard icon={Wallet}     label={t('houseAccounts.totalOwed')}      value={fmtCurrency(summary.totalOutstanding)}        color="bg-rose-600"    />
        <SummaryCard icon={TrendingUp} label={t('houseAccounts.totalLimit')}     value={summary.totalLimit > 0 ? fmtCurrency(summary.totalLimit) : t('houseAccounts.noLimit')} color="bg-emerald-600" />
      </div>

      {/* ── Filters ── */}
      <div className="flex flex-wrap gap-3 mb-5">
        <div className="relative flex-1 min-w-48">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder={t('houseAccounts.searchPlaceholder')}
            className="w-full pl-9 pr-4 py-2 bg-gray-800 border border-gray-700 rounded-xl text-sm text-white placeholder-gray-500 focus:outline-none focus:border-violet-500"
          />
        </div>
        <select
          value={filterStatus}
          onChange={e => setFilterStatus(e.target.value)}
          className="px-3 py-2 bg-gray-800 border border-gray-700 rounded-xl text-sm text-white focus:outline-none focus:border-violet-500"
        >
          <option value="">{t('common.all')}</option>
          <option value="active">{t('houseAccounts.active')}</option>
          <option value="suspended">{t('houseAccounts.suspended')}</option>
          <option value="closed">{t('houseAccounts.closed')}</option>
        </select>
      </div>

      {/* ── Split layout: list + drawer ── */}
      <div className={clsx('flex gap-5', selected && 'xl:grid xl:grid-cols-5')}>
        {/* Account list */}
        <div className={clsx('flex-1', selected && 'xl:col-span-3')}>
          {loading ? (
            <div className="flex items-center justify-center h-40">
              <RefreshCw size={24} className="text-gray-600 animate-spin" />
            </div>
          ) : accounts.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-40 text-gray-600">
              <BookUser size={32} className="mb-2 opacity-30" />
              <p className="text-sm">{t('houseAccounts.noAccounts')}</p>
            </div>
          ) : (
            <div className="space-y-2">
              {accounts.map(acc => {
                const st = STATUS_STYLE[acc.status] || STATUS_STYLE.active
                const overLimit = acc.creditLimit > 0 && acc.balance > acc.creditLimit
                return (
                  <div
                    key={acc.id}
                    onClick={() => openAccount(acc)}
                    className={clsx(
                      'flex items-center gap-4 px-5 py-4 bg-gray-800/60 border rounded-2xl cursor-pointer transition-all hover:border-violet-500/50',
                      selected?.id === acc.id ? 'border-violet-500 bg-violet-500/5' : 'border-gray-700/50',
                    )}
                  >
                    {/* Avatar */}
                    <div className="w-10 h-10 rounded-full bg-gray-700 flex items-center justify-center text-sm font-bold text-gray-300 flex-shrink-0">
                      {acc.customerName?.charAt(0)?.toUpperCase() || '?'}
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-white text-sm truncate">{acc.customerName}</span>
                        <span className={clsx('px-1.5 py-0.5 rounded text-[10px] font-semibold', GROUP_STYLE[acc.customerGroup] || GROUP_STYLE.General)}>
                          {acc.customerGroup}
                        </span>
                      </div>
                      <div className="flex items-center gap-3 mt-0.5">
                        <span className={clsx('text-[10px] px-1.5 py-0.5 rounded-full border font-medium', st.cls)}>
                          {st.label}
                        </span>
                        {acc.creditLimit > 0 && (
                          <span className="text-xs text-gray-500">{t('houseAccounts.limit')}: {fmtCurrency(acc.creditLimit)}</span>
                        )}
                      </div>
                    </div>

                    {/* Balance */}
                    <div className="text-right flex-shrink-0">
                      <p className={clsx('text-base font-extrabold', acc.balance > 0 ? (overLimit ? 'text-rose-400' : 'text-amber-400') : 'text-emerald-400')}>
                        {fmtCurrency(acc.balance)}
                      </p>
                      {overLimit && (
                        <div className="flex items-center gap-1 justify-end mt-0.5">
                          <AlertTriangle size={10} className="text-rose-400" />
                          <span className="text-[10px] text-rose-400">{t('houseAccounts.overLimit')}</span>
                        </div>
                      )}
                    </div>

                    <ChevronRight size={15} className="text-gray-600 flex-shrink-0" />
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* ── Detail drawer ── */}
        {selected && (
          <div className="xl:col-span-2 bg-gray-800/60 border border-gray-700/50 rounded-2xl p-5 flex flex-col h-fit sticky top-6">
            {/* Drawer header */}
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-violet-600/20 flex items-center justify-center text-base font-bold text-violet-300">
                  {selected.customerName?.charAt(0)?.toUpperCase()}
                </div>
                <div>
                  <p className="font-bold text-white">{selected.customerName}</p>
                  <span className={clsx('text-[10px] px-1.5 py-0.5 rounded-full border font-medium', (STATUS_STYLE[selected.status] || STATUS_STYLE.active).cls)}>
                    {(STATUS_STYLE[selected.status] || STATUS_STYLE.active).label}
                  </span>
                </div>
              </div>
              <button onClick={() => setSelected(null)} className="text-gray-500 hover:text-gray-300">
                <X size={16} />
              </button>
            </div>

            {/* Balance highlight */}
            <div className="bg-gray-900/60 rounded-xl p-4 mb-4 text-center border border-gray-700/50">
              <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">{t('houseAccounts.balance')}</p>
              <p className={clsx('text-3xl font-black', selected.balance > 0 ? 'text-amber-400' : 'text-emerald-400')}>
                {fmtCurrency(selected.balance)}
              </p>
              {selected.creditLimit > 0 && (
                <p className="text-xs text-gray-500 mt-1">
                  {t('houseAccounts.limit')}: {fmtCurrency(selected.creditLimit)}
                  {' · '}{Math.round((selected.balance / selected.creditLimit) * 100)}% {t('houseAccounts.used')}
                </p>
              )}
              {!selected.creditLimit && (
                <p className="text-xs text-gray-600 mt-1">{t('houseAccounts.noLimit')}</p>
              )}
            </div>

            {/* Action buttons */}
            <div className="flex gap-2 mb-5">
              <button
                onClick={() => { setShowPayment(true); setError('') }}
                disabled={selected.balance <= 0 || saving}
                className="flex-1 flex items-center justify-center gap-1.5 py-2.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white text-sm font-semibold rounded-xl transition-colors"
              >
                <ArrowDownLeft size={14} />
                {t('houseAccounts.recordPayment')}
              </button>
              <button
                onClick={handleSettleFull}
                disabled={selected.balance <= 0 || saving}
                className="flex items-center justify-center gap-1.5 px-3 py-2.5 bg-sky-600 hover:bg-sky-500 disabled:opacity-40 text-white text-sm font-semibold rounded-xl transition-colors"
                title={t('houseAccounts.settleAll')}
              >
                <CheckCircle2 size={14} />
              </button>
              {isAdmin && (
                <button
                  onClick={openEdit}
                  className="flex items-center justify-center gap-1.5 px-3 py-2.5 bg-gray-700 hover:bg-gray-600 text-white text-sm font-semibold rounded-xl transition-colors"
                  title={t('common.edit')}
                >
                  <CreditCard size={14} />
                </button>
              )}
            </div>

            {/* Transactions */}
            <p className="text-xs text-gray-500 uppercase tracking-wider font-semibold mb-3">{t('houseAccounts.history')}</p>
            {txLoading ? (
              <div className="flex items-center justify-center h-20">
                <RefreshCw size={18} className="text-gray-600 animate-spin" />
              </div>
            ) : transactions.length === 0 ? (
              <p className="text-sm text-gray-600 text-center py-6">{t('houseAccounts.noTransactions')}</p>
            ) : (
              <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
                {transactions.map(tx => (
                  <div key={tx.id} className="flex items-start gap-3 py-2.5 border-b border-gray-700/40 last:border-0">
                    <div className={clsx(
                      'w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5',
                      tx.type === 'charge'  ? 'bg-rose-500/20'    : 'bg-emerald-500/20',
                    )}>
                      {tx.type === 'charge'
                        ? <ArrowUpRight   size={12} className="text-rose-400" />
                        : <ArrowDownLeft  size={12} className="text-emerald-400" />
                      }
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-gray-300 font-medium truncate">{tx.description || tx.type}</p>
                      <p className="text-[10px] text-gray-600">{fmtDateTime(tx.createdAt)}</p>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className={clsx('text-sm font-bold', tx.type === 'charge' ? 'text-rose-400' : 'text-emerald-400')}>
                        {tx.type === 'charge' ? '+' : '-'}{fmtCurrency(tx.amount)}
                      </p>
                      <p className="text-[10px] text-gray-600">{fmtCurrency(tx.balanceAfter)}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* ══ Create Account Modal ══ */}
      {showCreate && (
        <Modal title={t('houseAccounts.newAccount')} onClose={() => setShowCreate(false)}>
          <form onSubmit={handleCreate} className="space-y-4">
            {error && <p className="text-sm text-rose-400 bg-rose-500/10 border border-rose-500/20 px-3 py-2 rounded-lg">{error}</p>}
            <div>
              <label className="block text-xs text-gray-400 mb-1">{t('houseAccounts.customer')} *</label>
              <select
                value={newCustomer}
                onChange={e => setNewCustomer(e.target.value)}
                required
                className="w-full px-3 py-2.5 bg-gray-700 border border-gray-600 rounded-xl text-sm text-white focus:outline-none focus:border-violet-500"
              >
                <option value="">{t('houseAccounts.selectCustomer')}</option>
                {customers.map(c => (
                  <option key={c.id} value={c.id}>{c.name} {c.groupName !== 'General' ? `(${c.groupName})` : ''}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1">{t('houseAccounts.creditLimit')} <span className="text-gray-600">({t('houseAccounts.zeroMeansUnlimited')})</span></label>
              <input
                type="number" min="0" step="1000"
                value={newLimit}
                onChange={e => setNewLimit(e.target.value)}
                placeholder="0"
                className="w-full px-3 py-2.5 bg-gray-700 border border-gray-600 rounded-xl text-sm text-white focus:outline-none focus:border-violet-500"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1">{t('common.notes')}</label>
              <textarea
                value={newNotes}
                onChange={e => setNewNotes(e.target.value)}
                rows={2}
                className="w-full px-3 py-2.5 bg-gray-700 border border-gray-600 rounded-xl text-sm text-white focus:outline-none focus:border-violet-500 resize-none"
              />
            </div>
            <div className="flex gap-2 pt-1">
              <button type="button" onClick={() => setShowCreate(false)} className="flex-1 py-2.5 bg-gray-700 hover:bg-gray-600 text-white text-sm font-semibold rounded-xl transition-colors">
                {t('common.cancel')}
              </button>
              <button type="submit" disabled={saving} className="flex-1 py-2.5 bg-violet-600 hover:bg-violet-500 disabled:opacity-50 text-white text-sm font-semibold rounded-xl transition-colors">
                {saving ? t('common.saving') : t('houseAccounts.create')}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* ══ Record Payment Modal ══ */}
      {showPayment && selected && (
        <Modal title={t('houseAccounts.recordPayment')} onClose={() => setShowPayment(false)}>
          <form onSubmit={handlePayment} className="space-y-4">
            {error && <p className="text-sm text-rose-400 bg-rose-500/10 border border-rose-500/20 px-3 py-2 rounded-lg">{error}</p>}
            <div className="bg-gray-700/40 rounded-xl p-3 text-center">
              <p className="text-xs text-gray-400">{t('houseAccounts.currentBalance')}</p>
              <p className="text-2xl font-black text-amber-400">{fmtCurrency(selected.balance)}</p>
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1">{t('houseAccounts.paymentAmount')} *</label>
              <input
                type="number" min="1" step="1000" max={selected.balance}
                value={payAmount}
                onChange={e => setPayAmount(e.target.value)}
                required
                className="w-full px-3 py-2.5 bg-gray-700 border border-gray-600 rounded-xl text-sm text-white focus:outline-none focus:border-emerald-500"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1">{t('common.notes')}</label>
              <input
                type="text"
                value={payNote}
                onChange={e => setPayNote(e.target.value)}
                placeholder={t('houseAccounts.paymentNotePlaceholder')}
                className="w-full px-3 py-2.5 bg-gray-700 border border-gray-600 rounded-xl text-sm text-white focus:outline-none focus:border-emerald-500"
              />
            </div>
            <div className="flex gap-2 pt-1">
              <button type="button" onClick={() => setShowPayment(false)} className="flex-1 py-2.5 bg-gray-700 hover:bg-gray-600 text-white text-sm font-semibold rounded-xl transition-colors">
                {t('common.cancel')}
              </button>
              <button type="submit" disabled={saving} className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-sm font-semibold rounded-xl transition-colors">
                {saving ? t('common.saving') : t('houseAccounts.confirmPayment')}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* ══ Edit Account Modal ══ */}
      {showEdit && selected && isAdmin && (
        <Modal title={t('houseAccounts.editAccount')} onClose={() => setShowEdit(false)}>
          <form onSubmit={handleEdit} className="space-y-4">
            {error && <p className="text-sm text-rose-400 bg-rose-500/10 border border-rose-500/20 px-3 py-2 rounded-lg">{error}</p>}
            <div>
              <label className="block text-xs text-gray-400 mb-1">{t('houseAccounts.creditLimit')}</label>
              <input
                type="number" min="0" step="1000"
                value={editLimit}
                onChange={e => setEditLimit(e.target.value)}
                className="w-full px-3 py-2.5 bg-gray-700 border border-gray-600 rounded-xl text-sm text-white focus:outline-none focus:border-violet-500"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-2">{t('common.status')}</label>
              <div className="flex gap-2">
                {['active', 'suspended', 'closed'].map(s => (
                  <button
                    key={s} type="button"
                    onClick={() => setEditStatus(s)}
                    className={clsx(
                      'flex-1 py-2 text-xs font-semibold rounded-lg border transition-colors capitalize',
                      editStatus === s
                        ? (STATUS_STYLE[s]?.cls || 'bg-violet-500/20 text-violet-300 border-violet-500/40')
                        : 'bg-gray-700 border-gray-600 text-gray-400 hover:bg-gray-600',
                    )}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1">{t('common.notes')}</label>
              <textarea
                value={editNotes}
                onChange={e => setEditNotes(e.target.value)}
                rows={2}
                className="w-full px-3 py-2.5 bg-gray-700 border border-gray-600 rounded-xl text-sm text-white focus:outline-none focus:border-violet-500 resize-none"
              />
            </div>
            <div className="flex gap-2 pt-1">
              <button type="button" onClick={() => setShowEdit(false)} className="flex-1 py-2.5 bg-gray-700 hover:bg-gray-600 text-white text-sm font-semibold rounded-xl">
                {t('common.cancel')}
              </button>
              <button type="submit" disabled={saving} className="flex-1 py-2.5 bg-violet-600 hover:bg-violet-500 disabled:opacity-50 text-white text-sm font-semibold rounded-xl">
                {saving ? t('common.saving') : t('common.save')}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  )
}

// ─── Generic modal wrapper ────────────────────────────────────────────────────
function Modal({ title, onClose, children }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="bg-gray-800 border border-gray-700 rounded-2xl shadow-2xl w-full max-w-md">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-700">
          <h3 className="font-bold text-white">{title}</h3>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-300"><X size={18} /></button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  )
}
