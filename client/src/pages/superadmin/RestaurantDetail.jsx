import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  ArrowLeft, Store, DollarSign, ShoppingBag, Activity,
  Users, Clock, TrendingUp, Plus, X, Mail, KeyRound,
} from 'lucide-react'
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts'
import clsx from 'clsx'
import { superadminApi } from '../../services/api'

// ─── helpers ──────────────────────────────────────────────────────────────────
function fmtCurrency(n) {
  if (!n && n !== 0) return '₭ 0'
  if (n >= 1_000_000) return '₭ ' + (n/1_000_000).toFixed(1) + 'M'
  if (n >= 1_000)     return '₭ ' + (n/1_000).toFixed(1) + 'K'
  return '₭ ' + n.toLocaleString()
}

const STATUS_COLORS = {
  Pending:      'bg-yellow-500/20 text-yellow-400 border border-yellow-700/30',
  'In Progress':'bg-blue-500/20  text-blue-400  border border-blue-700/30',
  Served:       'bg-green-500/20 text-green-400 border border-green-700/30',
  Closed:       'bg-gray-700/40  text-gray-400  border border-gray-600/30',
}
const PLAN_STYLES = {
  basic:      'bg-gray-700/50 text-gray-300',
  pro:        'bg-blue-900/40 text-blue-300',
  enterprise: 'bg-violet-900/40 text-violet-300',
}
const STATUS_BADGE = {
  active:    'bg-emerald-900/40 text-emerald-400',
  suspended: 'bg-amber-900/40 text-amber-400',
  inactive:  'bg-gray-700/50 text-gray-400',
}
const ROLE_COLORS = {
  Admin:   'bg-violet-900/40 text-violet-300',
  Waiter:  'bg-blue-900/40 text-blue-300',
  Cashier: 'bg-amber-900/40 text-amber-400',
}

function StatCard({ label, value, icon: Icon, color, bg }) {
  return (
    <div className="bg-gray-800/60 border border-gray-700/60 rounded-2xl p-4">
      <div className="flex items-center gap-3">
        <div className={clsx('w-10 h-10 rounded-xl flex items-center justify-center', bg)}>
          <Icon size={17} className={color} />
        </div>
        <div>
          <p className="text-xs text-gray-500">{label}</p>
          <p className="text-lg font-bold text-gray-100">{value}</p>
        </div>
      </div>
    </div>
  )
}

function AddStaffModal({ restaurantId, onClose, onAdded }) {
  const [form, setForm] = useState({ name:'', email:'', role:'Waiter', password:'changeme123' })
  const [saving, setSaving] = useState(false)
  const [error, setError]   = useState('')
  const set = (k,v) => setForm(p => ({...p,[k]:v}))

  const handleSave = async () => {
    if (!form.name || !form.email) { setError('Name and email are required'); return }
    setSaving(true)
    try {
      await superadminApi.createStaff(restaurantId, form)
      onAdded()
      onClose()
    } catch(e) {
      setError(e.message || 'Failed to add staff')
    } finally { setSaving(false) }
  }

  const inputCls = 'w-full bg-gray-800 border border-gray-700 text-gray-100 text-sm rounded-xl px-3 py-2 focus:outline-none focus:border-violet-500 placeholder-gray-600'
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="bg-gray-900 border border-gray-700 rounded-2xl w-full max-w-sm shadow-2xl">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-800">
          <h3 className="text-sm font-semibold text-white">Add Staff Member</h3>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-300"><X size={16} /></button>
        </div>
        <div className="px-5 py-4 space-y-3">
          {error && <p className="text-xs text-red-400 bg-red-900/20 px-3 py-2 rounded-lg border border-red-700/40">{error}</p>}
          {[
            { label:'Name', key:'name', placeholder:'Full name', type:'text' },
            { label:'Email', key:'email', placeholder:'email@example.com', type:'email' },
            { label:'Password', key:'password', placeholder:'Password', type:'text' },
          ].map(f => (
            <div key={f.key}>
              <label className="block text-xs text-gray-400 mb-1.5">{f.label}</label>
              <input className={inputCls} type={f.type} value={form[f.key]}
                onChange={e => set(f.key, e.target.value)} placeholder={f.placeholder} />
            </div>
          ))}
          <div>
            <label className="block text-xs text-gray-400 mb-1.5">Role</label>
            <select className={inputCls} value={form.role} onChange={e => set('role', e.target.value)}>
              <option value="Waiter">Waiter</option>
              <option value="Cashier">Cashier</option>
              <option value="Admin">Admin</option>
            </select>
          </div>
        </div>
        <div className="flex justify-end gap-3 px-5 py-4 border-t border-gray-800">
          <button onClick={onClose} className="text-sm text-gray-400 hover:text-gray-200 px-4 py-2">Cancel</button>
          <button onClick={handleSave} disabled={saving}
            className="px-5 py-2 bg-violet-600 hover:bg-violet-500 text-white text-sm font-medium rounded-xl transition-colors disabled:opacity-50">
            {saving ? 'Adding…' : 'Add Staff'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Custom Tooltip ────────────────────────────────────────────────────────────
function Tooltip2({ active, payload, label }) {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-gray-800 border border-gray-700 rounded-xl px-3 py-2 shadow-xl">
      <p className="text-xs text-gray-400 mb-1">{label}</p>
      <p className="text-sm font-bold text-violet-300">{fmtCurrency(payload[0]?.value)}</p>
    </div>
  )
}

// ─── Reset Password Modal ──────────────────────────────────────────────────────
function ResetPasswordModal({ restaurantId, staff, onClose }) {
  const [newPassword, setNewPassword] = useState('')
  const [saving,      setSaving]      = useState(false)
  const [done,        setDone]        = useState(false)
  const [error,       setError]       = useState('')

  // Parse raw staff id number from "STF-001" format
  const userId = staff.rawUserId || staff.id.replace(/\D/g,'')

  const handleSave = async () => {
    if (newPassword.length < 6) { setError('Password must be at least 6 characters'); return }
    setSaving(true)
    setError('')
    try {
      await superadminApi.resetStaffPassword(restaurantId, userId, newPassword)
      setDone(true)
    } catch(e) {
      setError(e.message || 'Failed to reset password')
    } finally { setSaving(false) }
  }

  const inputCls = 'w-full bg-gray-800 border border-gray-700 text-gray-100 text-sm rounded-xl px-3 py-2 focus:outline-none focus:border-violet-500 placeholder-gray-600'
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="bg-gray-900 border border-gray-700 rounded-2xl w-full max-w-sm shadow-2xl">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-800">
          <div className="flex items-center gap-2">
            <KeyRound size={15} className="text-violet-400" />
            <h3 className="text-sm font-semibold text-white">Reset Password</h3>
          </div>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-300"><X size={16} /></button>
        </div>
        <div className="px-5 py-4 space-y-3">
          <p className="text-xs text-gray-500">
            Setting a new password for <strong className="text-gray-300">{staff.name}</strong>
          </p>
          {error && <p className="text-xs text-red-400 bg-red-900/20 px-3 py-2 rounded-lg border border-red-700/40">{error}</p>}
          {done
            ? <div className="flex items-center gap-2 text-xs text-emerald-400 bg-emerald-900/20 px-3 py-2 rounded-lg border border-emerald-700/40">
                <span>✓</span> Password reset successfully.
              </div>
            : <>
                <div>
                  <label className="block text-xs text-gray-400 mb-1.5">New Password</label>
                  <input className={inputCls} type="password" placeholder="min 6 characters"
                    value={newPassword} onChange={e => setNewPassword(e.target.value)} autoFocus />
                </div>
                <div className="flex justify-end gap-3 pt-1">
                  <button onClick={onClose} className="text-sm text-gray-400 hover:text-gray-200 px-4 py-2">Cancel</button>
                  <button onClick={handleSave} disabled={saving}
                    className="px-5 py-2 bg-violet-600 hover:bg-violet-500 text-white text-sm font-medium rounded-xl transition-colors disabled:opacity-50">
                    {saving ? 'Resetting…' : 'Reset Password'}
                  </button>
                </div>
              </>
          }
        </div>
        {done && (
          <div className="px-5 pb-4">
            <button onClick={onClose}
              className="w-full py-2 bg-gray-800 hover:bg-gray-700 text-sm text-gray-200 rounded-xl transition-colors">
              Close
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Main Component ────────────────────────────────────────────────────────────
export default function RestaurantDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [data, setData]         = useState(null)
  const [loading, setLoading]   = useState(true)
  const [addStaff, setAddStaff] = useState(false)
  const [resetPw,  setResetPw]  = useState(null)  // staff object to reset

  const load = () => {
    setLoading(true)
    superadminApi.getRestaurant(id)
      .then(setData)
      .catch(console.error)
      .finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [id])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="flex items-center gap-3 text-gray-500">
          <div className="w-5 h-5 border-2 border-violet-500 border-t-transparent rounded-full animate-spin" />
          <span className="text-sm">Loading restaurant…</span>
        </div>
      </div>
    )
  }

  if (!data) {
    return (
      <div className="text-center py-20 text-gray-500">
        <Store size={48} className="mx-auto mb-3 text-gray-700" />
        <p>Restaurant not found</p>
      </div>
    )
  }

  const r = data.restaurant

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => navigate('/superadmin/restaurants')}
          className="p-2 text-gray-500 hover:text-gray-200 hover:bg-gray-800 rounded-xl transition-colors"
        >
          <ArrowLeft size={16} />
        </button>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-bold text-white">{r.name}</h1>
            <span className={clsx('text-xs px-2 py-0.5 rounded-full capitalize font-medium', PLAN_STYLES[r.plan])}>
              {r.plan}
            </span>
            <span className={clsx('text-xs px-2 py-0.5 rounded-full capitalize font-medium', STATUS_BADGE[r.status])}>
              {r.status}
            </span>
          </div>
          <p className="text-sm text-gray-500 mt-0.5">{r.address || r.phone || r.email || r.id}</p>
        </div>
        <button
          onClick={() => setAddStaff(true)}
          className="flex items-center gap-2 px-4 py-2 bg-violet-600 hover:bg-violet-500 text-white text-sm font-medium rounded-xl transition-colors"
        >
          <Plus size={14} /> Add Staff
        </button>
      </div>

      {/* Info Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard label="Today Revenue" value={fmtCurrency(r.todayRevenue)} icon={DollarSign} color="text-emerald-400" bg="bg-emerald-900/30" />
        <StatCard label="Today Orders" value={r.todayOrders} icon={ShoppingBag} color="text-blue-400" bg="bg-blue-900/30" />
        <StatCard label="Active Orders" value={r.activeOrders} icon={Activity} color="text-orange-400" bg="bg-orange-900/30" />
        <StatCard label="Staff" value={r.staffCount} icon={Users} color="text-violet-400" bg="bg-violet-900/30" />
      </div>

      {/* Monthly + Tables info */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-gray-800/60 border border-gray-700/60 rounded-2xl p-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-teal-900/30 flex items-center justify-center">
            <TrendingUp size={17} className="text-teal-400" />
          </div>
          <div>
            <p className="text-xs text-gray-500">Monthly Revenue</p>
            <p className="text-lg font-bold text-gray-100">{fmtCurrency(r.monthlyRevenue)}</p>
          </div>
        </div>
        <div className="bg-gray-800/60 border border-gray-700/60 rounded-2xl p-4 col-span-2">
          <p className="text-xs text-gray-500 mb-1">Restaurant Details</p>
          <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
            {[
              ['Tables', r.tablesCount],
              ['Currency', r.currency],
              ['Tax Rate', (r.taxRate * 100).toFixed(0) + '%'],
              ['Phone', r.phone || '—'],
              ['Email', r.email || '—'],
              ['Address', r.address || '—'],
            ].map(([k, v]) => (
              <div key={k} className="flex gap-2">
                <span className="text-gray-600">{k}:</span>
                <span className="text-gray-300 truncate">{v}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Revenue chart */}
      <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5">
        <h3 className="text-sm font-semibold text-gray-100 mb-1">Revenue (Last 7 days)</h3>
        <p className="text-xs text-gray-500 mb-4">Daily breakdown for this restaurant</p>
        <ResponsiveContainer width="100%" height={160}>
          <AreaChart data={data.weeklyRevenue} margin={{ top:0, right:0, left:-20, bottom:0 }}>
            <defs>
              <linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#7c3aed" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#7c3aed" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" vertical={false} />
            <XAxis dataKey="day" tick={{ fill:'#9ca3af', fontSize:11 }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fill:'#9ca3af', fontSize:11 }} axisLine={false} tickLine={false}
                   tickFormatter={v => v >= 1000 ? `${(v/1000).toFixed(0)}K` : v} />
            <Tooltip content={<Tooltip2 />} cursor={{ stroke:'#6d28d9', strokeWidth:1, strokeDasharray:'4 4' }} />
            <Area type="monotone" dataKey="revenue" stroke="#7c3aed" strokeWidth={2}
                  fill="url(#revGrad)" dot={false} activeDot={{ r:4, fill:'#7c3aed' }} />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* Bottom: Orders + Staff */}
      <div className="grid grid-cols-2 gap-5">
        {/* Recent Orders */}
        <div className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden">
          <div className="px-4 pt-4 pb-2">
            <h3 className="text-sm font-semibold text-gray-100">Recent Orders</h3>
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-800">
                {['Order','Table','Status','Total'].map(h => (
                  <th key={h} className="px-4 py-2 text-left text-xs text-gray-500 font-medium">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800/60">
              {(data.recentOrders || []).length === 0 && (
                <tr><td colSpan={4} className="px-4 py-8 text-center text-gray-600 text-xs">No orders yet</td></tr>
              )}
              {(data.recentOrders || []).map(o => (
                <tr key={o.id} className="hover:bg-gray-800/30">
                  <td className="px-4 py-2.5 font-mono text-xs text-violet-400">{o.id}</td>
                  <td className="px-4 py-2.5 text-gray-400 text-xs">#{o.tableNumber}</td>
                  <td className="px-4 py-2.5">
                    <span className={clsx('text-xs px-1.5 py-0.5 rounded-full', STATUS_COLORS[o.status])}>
                      {o.status}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-gray-200 font-medium text-xs">{fmtCurrency(o.total)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Staff */}
        <div className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden">
          <div className="flex items-center justify-between px-4 pt-4 pb-2">
            <h3 className="text-sm font-semibold text-gray-100">Staff</h3>
            <button
              onClick={() => setAddStaff(true)}
              className="flex items-center gap-1 text-xs text-violet-400 hover:text-violet-300 transition-colors"
            >
              <Plus size={12} /> Add
            </button>
          </div>
          <div className="divide-y divide-gray-800/60">
            {(data.staff || []).length === 0 && (
              <div className="px-4 py-8 text-center text-gray-600 text-xs">No staff yet</div>
            )}
            {(data.staff || []).map(s => (
              <div key={s.id} className="flex items-center gap-3 px-4 py-3 hover:bg-gray-800/30 transition-colors group">
                <div className="w-8 h-8 rounded-full bg-gray-700 flex items-center justify-center flex-shrink-0">
                  <span className="text-xs font-bold text-gray-300">
                    {s.name.slice(0,2).toUpperCase()}
                  </span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-gray-200 font-medium truncate">{s.name}</p>
                  <div className="flex items-center gap-1 text-xs text-gray-500">
                    <Mail size={10} /> {s.email || '—'}
                  </div>
                </div>
                <span className={clsx('text-xs px-2 py-0.5 rounded-full font-medium', ROLE_COLORS[s.role] || 'bg-gray-700 text-gray-400')}>
                  {s.role}
                </span>
                <button
                  onClick={() => setResetPw(s)}
                  title="Reset password"
                  className="opacity-0 group-hover:opacity-100 p-1.5 text-gray-600 hover:text-violet-400 hover:bg-violet-900/20 rounded-lg transition-all"
                >
                  <KeyRound size={13} />
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>

      {addStaff && (
        <AddStaffModal restaurantId={id} onClose={() => setAddStaff(false)} onAdded={load} />
      )}
      {resetPw && (
        <ResetPasswordModal restaurantId={id} staff={resetPw} onClose={() => setResetPw(null)} />
      )}
    </div>
  )
}
