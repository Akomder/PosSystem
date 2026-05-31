import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Plus, Search, Store, Eye, Edit2, Trash2, Power,
  ChevronRight, DollarSign, ShoppingBag, Users, X, Megaphone, Send, CheckCircle,
} from 'lucide-react'
import clsx from 'clsx'
import { superadminApi } from '../../services/api'

// ─── helpers ──────────────────────────────────────────────────────────────────
function fmtCurrency(n) {
  if (!n && n !== 0) return '₭ 0'
  if (n >= 1_000_000) return '₭ ' + (n/1_000_000).toFixed(1) + 'M'
  if (n >= 1_000)     return '₭ ' + (n/1_000).toFixed(1) + 'K'
  return '₭ ' + n.toLocaleString()
}

const PLAN_STYLES = {
  basic:      'bg-gray-700/50 text-gray-300 border border-gray-600',
  pro:        'bg-blue-900/40 text-blue-300 border border-blue-700/50',
  enterprise: 'bg-violet-900/40 text-violet-300 border border-violet-700/50',
}
const STATUS_STYLES = {
  active:    'bg-emerald-900/40 text-emerald-400 border border-emerald-700/40',
  suspended: 'bg-amber-900/40 text-amber-400 border border-amber-700/40',
  inactive:  'bg-gray-700/50 text-gray-400 border border-gray-600',
}

// ─── RestaurantModal ──────────────────────────────────────────────────────────
function RestaurantModal({ onClose, onSave, initial }) {
  const isEdit = !!initial
  const [form, setForm] = useState({
    name: initial?.name || '',
    address: initial?.address || '',
    phone: initial?.phone || '',
    email: initial?.email || '',
    plan: initial?.plan || 'basic',
    currency: initial?.currency || 'LAK',
    taxRate: initial?.taxRate ?? 0.10,
    adminEmail: '',
    adminPassword: '',
  })
  const [saving, setSaving] = useState(false)
  const [error, setError]   = useState('')

  const set = (k, v) => setForm(p => ({ ...p, [k]: v }))

  const handleSave = async () => {
    if (!form.name.trim()) { setError('Restaurant name is required'); return }
    setSaving(true)
    setError('')
    try {
      await onSave(form)
      onClose()
    } catch (e) {
      setError(e.message || 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="bg-gray-900 border border-gray-700 rounded-2xl w-full max-w-md shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-800">
          <h2 className="text-sm font-semibold text-white">
            {isEdit ? 'Edit Restaurant' : 'Add New Restaurant'}
          </h2>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-300 transition-colors">
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="px-5 py-4 space-y-3 max-h-[70vh] overflow-y-auto">
          {error && <p className="text-xs text-red-400 bg-red-900/20 border border-red-700/40 px-3 py-2 rounded-lg">{error}</p>}

          <Field label="Restaurant Name *">
            <input className={inputCls} value={form.name} onChange={e => set('name', e.target.value)} placeholder="e.g. Green Garden" />
          </Field>
          <Field label="Address">
            <input className={inputCls} value={form.address} onChange={e => set('address', e.target.value)} placeholder="123 Main Street" />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Phone">
              <input className={inputCls} value={form.phone} onChange={e => set('phone', e.target.value)} placeholder="+856 20..." />
            </Field>
            <Field label="Email">
              <input className={inputCls} value={form.email} onChange={e => set('email', e.target.value)} placeholder="info@..." type="email" />
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Plan">
              <select className={inputCls} value={form.plan} onChange={e => set('plan', e.target.value)}>
                <option value="basic">Basic</option>
                <option value="pro">Pro</option>
                <option value="enterprise">Enterprise</option>
              </select>
            </Field>
            <Field label="Currency">
              <select className={inputCls} value={form.currency} onChange={e => set('currency', e.target.value)}>
                <option value="LAK">LAK (₭)</option>
                <option value="THB">THB (฿)</option>
                <option value="USD">USD ($)</option>
              </select>
            </Field>
          </div>
          <Field label="Tax Rate">
            <div className="relative">
              <input className={inputCls} type="number" min="0" max="1" step="0.01"
                value={form.taxRate} onChange={e => set('taxRate', parseFloat(e.target.value))} />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-500">
                = {(form.taxRate * 100).toFixed(0)}%
              </span>
            </div>
          </Field>

          {/* Admin user section — only for new restaurant */}
          {!isEdit && (
            <div className="border-t border-gray-800 pt-3 mt-1">
              <p className="text-xs text-gray-500 mb-3 font-medium uppercase tracking-wider">Admin Account (optional)</p>
              <Field label="Admin Email">
                <input className={inputCls} type="email" value={form.adminEmail}
                  onChange={e => set('adminEmail', e.target.value)} placeholder="admin@restaurant.com" />
              </Field>
              <Field label="Password">
                <input className={inputCls} value={form.adminPassword}
                  onChange={e => set('adminPassword', e.target.value)} />
              </Field>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-5 py-4 border-t border-gray-800">
          <button onClick={onClose} className="px-4 py-2 text-sm text-gray-400 hover:text-gray-200 transition-colors">
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-5 py-2 bg-violet-600 hover:bg-violet-500 disabled:opacity-50 text-white text-sm font-medium rounded-xl transition-colors"
          >
            {saving ? 'Saving…' : isEdit ? 'Save Changes' : 'Create Restaurant'}
          </button>
        </div>
      </div>
    </div>
  )
}

const inputCls = 'w-full bg-gray-800 border border-gray-700 text-gray-100 text-sm rounded-xl px-3 py-2 focus:outline-none focus:border-violet-500 placeholder-gray-600 transition-colors'

function Field({ label, children }) {
  return (
    <div>
      <label className="block text-xs text-gray-400 mb-1.5 font-medium">{label}</label>
      {children}
    </div>
  )
}

// ─── BroadcastModal ───────────────────────────────────────────────────────────
function BroadcastModal({ restaurants, onClose }) {
  const [subject,  setSubject]  = useState('')
  const [message,  setMessage]  = useState('')
  const [targeted, setTargeted] = useState(false)  // false = all active
  const [selected, setSelected] = useState([])     // selected restaurant rawIds
  const [sending,  setSending]  = useState(false)
  const [result,   setResult]   = useState(null)   // { sent, failed, total }
  const [error,    setError]    = useState('')

  const toggleRestaurant = (rawId) => {
    setSelected(s => s.includes(rawId) ? s.filter(x => x !== rawId) : [...s, rawId])
  }

  const handleSend = async () => {
    if (!subject.trim() || !message.trim()) { setError('Subject and message are required'); return }
    setSending(true)
    setError('')
    try {
      const body = { subject, message }
      if (targeted && selected.length) body.restaurantIds = selected
      const res = await superadminApi.broadcast(body)
      setResult(res)
    } catch(e) {
      setError(e.message || 'Failed to send broadcast')
    } finally { setSending(false) }
  }

  const activeCount = targeted ? selected.length : restaurants.filter(r => r.status === 'active').length

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="bg-gray-900 border border-gray-700 rounded-2xl w-full max-w-lg shadow-2xl">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-800">
          <div className="flex items-center gap-2">
            <Megaphone size={15} className="text-violet-400" />
            <h2 className="text-sm font-semibold text-white">Broadcast Announcement</h2>
          </div>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-300 transition-colors"><X size={16} /></button>
        </div>

        {result ? (
          <div className="p-6 text-center space-y-3">
            <div className="w-12 h-12 rounded-full bg-emerald-900/40 flex items-center justify-center mx-auto">
              <CheckCircle size={24} className="text-emerald-400" />
            </div>
            <h3 className="text-sm font-semibold text-white">Broadcast Sent</h3>
            <p className="text-xs text-gray-400">
              {result.sent} email{result.sent !== 1 ? 's' : ''} delivered
              {result.failed > 0 && <span className="text-red-400">, {result.failed} failed</span>}
            </p>
            <button onClick={onClose}
              className="mt-2 px-6 py-2 bg-violet-600 hover:bg-violet-500 text-white text-sm font-medium rounded-xl transition-colors">
              Done
            </button>
          </div>
        ) : (
          <div className="px-5 py-4 space-y-4 max-h-[75vh] overflow-y-auto">
            {error && <p className="text-xs text-red-400 bg-red-900/20 border border-red-700/40 px-3 py-2 rounded-lg">{error}</p>}

            <div>
              <label className="block text-xs font-medium text-gray-400 mb-1.5">Subject</label>
              <input className="w-full bg-gray-800 border border-gray-700 text-gray-100 text-sm rounded-xl px-3 py-2.5 focus:outline-none focus:border-violet-500 placeholder-gray-600"
                placeholder="Scheduled maintenance — 2 Jan 2026" value={subject}
                onChange={e => setSubject(e.target.value)} />
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-400 mb-1.5">Message</label>
              <textarea rows={5}
                className="w-full bg-gray-800 border border-gray-700 text-gray-100 text-sm rounded-xl px-3 py-2.5 focus:outline-none focus:border-violet-500 placeholder-gray-600 resize-none"
                placeholder="Write your announcement here…" value={message}
                onChange={e => setMessage(e.target.value)} />
            </div>

            {/* Target */}
            <div className="space-y-2">
              <label className="block text-xs font-medium text-gray-400">Recipients</label>
              <div className="flex gap-3">
                <button onClick={() => setTargeted(false)}
                  className={clsx('flex-1 py-2 text-xs rounded-xl border transition-colors',
                    !targeted ? 'bg-violet-600/20 border-violet-600/50 text-violet-300' : 'bg-gray-800 border-gray-700 text-gray-500 hover:text-gray-300')}>
                  All active restaurants
                </button>
                <button onClick={() => setTargeted(true)}
                  className={clsx('flex-1 py-2 text-xs rounded-xl border transition-colors',
                    targeted ? 'bg-violet-600/20 border-violet-600/50 text-violet-300' : 'bg-gray-800 border-gray-700 text-gray-500 hover:text-gray-300')}>
                  Select specific
                </button>
              </div>
              {targeted && (
                <div className="bg-gray-800 rounded-xl p-2 max-h-36 overflow-y-auto space-y-1">
                  {restaurants.map(r => (
                    <label key={r.rawId} className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-gray-700 cursor-pointer">
                      <input type="checkbox" className="accent-violet-500"
                        checked={selected.includes(r.rawId)}
                        onChange={() => toggleRestaurant(r.rawId)} />
                      <span className="text-xs text-gray-300">{r.name}</span>
                      <span className={clsx('ml-auto text-[10px] px-1.5 py-0.5 rounded-full',
                        r.status === 'active' ? 'bg-emerald-900/40 text-emerald-400' : 'bg-gray-700 text-gray-500')}>
                        {r.status}
                      </span>
                    </label>
                  ))}
                </div>
              )}
            </div>

            <p className="text-xs text-gray-600">
              Will send to Admin email(s) of {activeCount} restaurant{activeCount !== 1 ? 's' : ''}
              {targeted && !selected.length ? ' — select at least one restaurant' : ''}.
            </p>

            <div className="flex gap-3 pt-1">
              <button onClick={onClose}
                className="flex-1 py-2.5 text-sm text-gray-400 border border-gray-700 rounded-xl hover:border-gray-600 hover:text-gray-200 transition-colors">
                Cancel
              </button>
              <button onClick={handleSend}
                disabled={sending || !subject.trim() || !message.trim() || (targeted && !selected.length)}
                className="flex-1 flex items-center justify-center gap-2 py-2.5 text-sm font-medium bg-violet-600 hover:bg-violet-500 disabled:opacity-50 text-white rounded-xl transition-colors">
                {sending ? <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <Send size={14} />}
                {sending ? 'Sending…' : 'Send Broadcast'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// ─── ConfirmDialog ─────────────────────────────────────────────────────────────
function ConfirmDialog({ message, onConfirm, onCancel, danger }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="bg-gray-900 border border-gray-700 rounded-2xl w-full max-w-sm shadow-2xl p-6 space-y-4">
        <p className="text-sm text-gray-200">{message}</p>
        <div className="flex gap-3 justify-end">
          <button onClick={onCancel} className="px-4 py-2 text-sm text-gray-400 hover:text-gray-200">Cancel</button>
          <button
            onClick={onConfirm}
            className={clsx('px-4 py-2 text-sm font-medium rounded-xl transition-colors',
              danger ? 'bg-red-600 hover:bg-red-500 text-white' : 'bg-violet-600 hover:bg-violet-500 text-white'
            )}
          >
            Confirm
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Main Component ────────────────────────────────────────────────────────────
export default function Restaurants() {
  const [restaurants, setRestaurants] = useState([])
  const [loading, setLoading]         = useState(true)
  const [search, setSearch]           = useState('')
  const [planFilter, setPlanFilter]   = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [modal, setModal]             = useState(null) // null | 'add' | { edit: item }
  const [confirm, setConfirm]         = useState(null)
  const [broadcast, setBroadcast]     = useState(false)
  const navigate = useNavigate()

  const load = useCallback(() => {
    setLoading(true)
    superadminApi.getRestaurants({ search, plan: planFilter, status: statusFilter })
      .then(setRestaurants)
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [search, planFilter, statusFilter])

  useEffect(() => { load() }, [load])

  const handleCreate = async (form) => {
    await superadminApi.createRestaurant(form)
    load()
  }

  const handleUpdate = async (id, form) => {
    await superadminApi.updateRestaurant(id, form)
    load()
  }

  const handleDelete = (r) => {
    setConfirm({
      message: `Delete "${r.name}"? This cannot be undone and will remove all data.`,
      danger: true,
      onConfirm: async () => {
        await superadminApi.deleteRestaurant(r.rawId)
        setConfirm(null)
        load()
      },
    })
  }

  const handleToggleStatus = async (r) => {
    const next = r.status === 'active' ? 'suspended' : 'active'
    await superadminApi.toggleStatus(r.rawId, next)
    load()
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-white">Restaurants</h1>
          <p className="text-sm text-gray-500 mt-0.5">{restaurants.length} restaurant{restaurants.length !== 1 ? 's' : ''} found</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setBroadcast(true)}
            className="flex items-center gap-2 px-4 py-2 bg-gray-800 hover:bg-gray-700 border border-gray-700 text-gray-300 hover:text-white text-sm font-medium rounded-xl transition-colors"
          >
            <Megaphone size={15} /> Broadcast
          </button>
          <button
            onClick={() => setModal('add')}
            className="flex items-center gap-2 px-4 py-2 bg-violet-600 hover:bg-violet-500 text-white text-sm font-medium rounded-xl transition-colors shadow-lg shadow-violet-900/30"
          >
            <Plus size={15} /> Add Restaurant
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-3 flex-wrap">
        <div className="flex items-center gap-2 bg-gray-800 border border-gray-700 rounded-xl px-3 py-2 flex-1 min-w-48">
          <Search size={14} className="text-gray-500" />
          <input
            className="bg-transparent text-sm text-gray-100 placeholder-gray-600 focus:outline-none flex-1"
            placeholder="Search restaurants…"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        <select
          className="bg-gray-800 border border-gray-700 text-sm text-gray-300 rounded-xl px-3 py-2 focus:outline-none focus:border-violet-500"
          value={planFilter}
          onChange={e => setPlanFilter(e.target.value)}
        >
          <option value="">All Plans</option>
          <option value="basic">Basic</option>
          <option value="pro">Pro</option>
          <option value="enterprise">Enterprise</option>
        </select>
        <select
          className="bg-gray-800 border border-gray-700 text-sm text-gray-300 rounded-xl px-3 py-2 focus:outline-none focus:border-violet-500"
          value={statusFilter}
          onChange={e => setStatusFilter(e.target.value)}
        >
          <option value="">All Status</option>
          <option value="active">Active</option>
          <option value="suspended">Suspended</option>
          <option value="inactive">Inactive</option>
        </select>
      </div>

      {/* Table */}
      <div className="bg-gray-900 rounded-2xl border border-gray-800 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-800">
              {['Restaurant','Plan','Status','Staff','Tables','Today Orders','Today Revenue','Actions'].map(h => (
                <th key={h} className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-800/60">
            {loading && (
              <tr>
                <td colSpan={8} className="px-4 py-8 text-center text-gray-600 text-sm">Loading…</td>
              </tr>
            )}
            {!loading && restaurants.length === 0 && (
              <tr>
                <td colSpan={8} className="px-4 py-12 text-center">
                  <Store size={32} className="text-gray-700 mx-auto mb-2" />
                  <p className="text-gray-500 text-sm">No restaurants found</p>
                  <button onClick={() => setModal('add')} className="text-violet-400 text-xs mt-1 hover:text-violet-300">Add your first restaurant →</button>
                </td>
              </tr>
            )}
            {restaurants.map(r => (
              <tr key={r.id} className="hover:bg-gray-800/40 transition-colors group">
                {/* Name */}
                <td className="px-4 py-3">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-violet-900/40 border border-violet-800/40 flex items-center justify-center flex-shrink-0">
                      <Store size={15} className="text-violet-400" />
                    </div>
                    <div>
                      <p className="font-medium text-gray-100">{r.name}</p>
                      <p className="text-xs text-gray-600">{r.phone || r.email || r.address || '—'}</p>
                      {r.slug && (
                        <button
                          type="button"
                          onClick={() => navigator.clipboard.writeText(`${window.location.origin}/${r.slug}`)}
                          className="text-xs text-violet-500 hover:text-violet-300 mt-0.5 flex items-center gap-1"
                          title="Click to copy login URL"
                        >
                          <span className="font-mono">/{r.slug}</span>
                          <span className="text-gray-600 text-[10px]">copy</span>
                        </button>
                      )}
                    </div>
                  </div>
                </td>

                {/* Plan */}
                <td className="px-4 py-3">
                  <span className={clsx('text-xs px-2 py-0.5 rounded-full font-medium capitalize', PLAN_STYLES[r.plan] || PLAN_STYLES.basic)}>
                    {r.plan}
                  </span>
                </td>

                {/* Status */}
                <td className="px-4 py-3">
                  <span className={clsx('text-xs px-2 py-0.5 rounded-full font-medium capitalize', STATUS_STYLES[r.status] || STATUS_STYLES.inactive)}>
                    {r.status}
                  </span>
                </td>

                {/* Staff */}
                <td className="px-4 py-3">
                  <span className="flex items-center gap-1 text-gray-400 text-xs">
                    <Users size={12} /> {r.staffCount}
                  </span>
                </td>

                {/* Tables */}
                <td className="px-4 py-3 text-gray-400 text-xs">{r.tablesCount}</td>

                {/* Today Orders */}
                <td className="px-4 py-3">
                  <span className="flex items-center gap-1 text-gray-300 text-xs">
                    <ShoppingBag size={11} /> {r.todayOrders}
                  </span>
                </td>

                {/* Today Revenue */}
                <td className="px-4 py-3">
                  <span className="flex items-center gap-1 text-emerald-400 text-sm font-semibold">
                    <DollarSign size={12} /> {fmtCurrency(r.todayRevenue)}
                  </span>
                </td>

                {/* Actions */}
                <td className="px-4 py-3">
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={() => navigate(`/superadmin/restaurants/${r.rawId}`)}
                      className="p-1.5 text-gray-500 hover:text-violet-400 hover:bg-violet-900/20 rounded-lg transition-colors"
                      title="View detail"
                    >
                      <Eye size={14} />
                    </button>
                    <button
                      onClick={() => setModal({ edit: r })}
                      className="p-1.5 text-gray-500 hover:text-blue-400 hover:bg-blue-900/20 rounded-lg transition-colors"
                      title="Edit"
                    >
                      <Edit2 size={14} />
                    </button>
                    <button
                      onClick={() => handleToggleStatus(r)}
                      className={clsx('p-1.5 rounded-lg transition-colors',
                        r.status === 'active'
                          ? 'text-gray-500 hover:text-amber-400 hover:bg-amber-900/20'
                          : 'text-amber-400 hover:text-emerald-400 hover:bg-emerald-900/20'
                      )}
                      title={r.status === 'active' ? 'Suspend' : 'Activate'}
                    >
                      <Power size={14} />
                    </button>
                    <button
                      onClick={() => handleDelete(r)}
                      className="p-1.5 text-gray-500 hover:text-red-400 hover:bg-red-900/20 rounded-lg transition-colors"
                      title="Delete"
                    >
                      <Trash2 size={14} />
                    </button>
                    <button
                      onClick={() => navigate(`/superadmin/restaurants/${r.rawId}`)}
                      className="p-1.5 text-gray-600 hover:text-gray-300 rounded-lg transition-colors"
                    >
                      <ChevronRight size={14} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Modals */}
      {modal === 'add' && (
        <RestaurantModal onClose={() => setModal(null)} onSave={handleCreate} />
      )}
      {modal?.edit && (
        <RestaurantModal
          onClose={() => setModal(null)}
          onSave={(form) => handleUpdate(modal.edit.rawId, form)}
          initial={modal.edit}
        />
      )}
      {confirm && (
        <ConfirmDialog
          message={confirm.message}
          danger={confirm.danger}
          onConfirm={confirm.onConfirm}
          onCancel={() => setConfirm(null)}
        />
      )}
      {broadcast && (
        <BroadcastModal restaurants={restaurants} onClose={() => setBroadcast(false)} />
      )}
    </div>
  )
}
