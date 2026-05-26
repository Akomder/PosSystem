import { useState, useEffect, useCallback } from 'react'
import { UserCheck, PlusCircle, Pencil, Trash2, Search } from 'lucide-react'
import clsx from 'clsx'
import { staffApi } from '../services/api'
import Button from '../components/ui/Button'
import Modal from '../components/ui/Modal'
import Input from '../components/ui/Input'
import Select from '../components/ui/Select'
import Badge from '../components/ui/Badge'
import EmptyState from '../components/ui/EmptyState'
import { formatDate } from '../utils/formatters'
import { useAuth } from '../context/AuthContext'
import PlanLimitBanner from '../components/ui/PlanLimitBanner'

const PLAN_STAFF_LIMITS = { basic: 5, pro: 20, enterprise: Infinity }

const ROLE_OPTIONS = [
  { value: 'Admin',   label: 'Admin'   },
  { value: 'Waiter',  label: 'Waiter'  },
  { value: 'Cashier', label: 'Cashier' },
]

const STATUS_OPTIONS = [
  { value: 'active',   label: 'Active'   },
  { value: 'inactive', label: 'Inactive' },
  { value: 'on-leave', label: 'On Leave' },
]

const ROLE_VARIANT = { Admin: 'teal', Waiter: 'blue', Cashier: 'amber' }
const STATUS_VARIANT = { active: 'success', inactive: 'default', 'on-leave': 'warning' }

const EMPTY_FORM = { name: '', role: 'Waiter', email: '', password: '' }
const EMPTY_EDIT = { name: '', role: 'Waiter', status: 'active' }

const ROLE_TABS = ['All', 'Admin', 'Waiter', 'Cashier']

export default function Staff() {
  const { user } = useAuth()
  const isAdmin = user?.role === 'Admin'

  const [staff,     setStaff]     = useState([])
  const [loading,   setLoading]   = useState(true)
  const [search,    setSearch]    = useState('')
  const [roleTab,   setRoleTab]   = useState('All')
  const [inviteOpen,setInviteOpen]= useState(false)
  const [editItem,  setEditItem]  = useState(null)
  const [form,      setForm]      = useState(EMPTY_FORM)
  const [editForm,  setEditForm]  = useState(EMPTY_EDIT)
  const [saving,    setSaving]    = useState(false)
  const [error,     setError]     = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const params = {}
      if (roleTab !== 'All') params.role = roleTab
      setStaff(await staffApi.getAll(params))
    } catch (_) {}
    setLoading(false)
  }, [roleTab])

  useEffect(() => { load() }, [load])

  const filtered = staff.filter(s => {
    if (!search) return true
    const q = search.toLowerCase()
    return s.name.toLowerCase().includes(q) || (s.email || '').toLowerCase().includes(q)
  })

  function openInvite() {
    setForm(EMPTY_FORM)
    setError('')
    setInviteOpen(true)
  }

  function openEdit(s) {
    setEditItem(s)
    setEditForm({ name: s.name, role: s.role, status: s.status || 'active' })
    setError('')
  }

  async function handleInvite() {
    if (!form.name.trim() || !form.email.trim()) return
    setSaving(true)
    setError('')
    try {
      const created = await staffApi.create(form)
      setStaff(prev => [created, ...prev])
      setInviteOpen(false)
    } catch (e) {
      setError(e.message || 'Failed to create staff member')
    }
    setSaving(false)
  }

  async function handleEdit() {
    if (!editItem) return
    setSaving(true)
    setError('')
    try {
      const updated = await staffApi.update(editItem.id, editForm)
      setStaff(prev => prev.map(s => s.id === updated.id ? updated : s))
      setEditItem(null)
    } catch (e) {
      setError(e.message || 'Failed to update staff member')
    }
    setSaving(false)
  }

  async function handleDelete(s) {
    if (!window.confirm(`Delete ${s.name}? This cannot be undone.`)) return
    try {
      await staffApi.delete(s.id)
      setStaff(prev => prev.filter(x => x.id !== s.id))
    } catch (e) {
      alert(e.message || 'Failed to delete')
    }
  }

  const plan  = user?.restaurantPlan || 'basic'
  const limit = PLAN_STAFF_LIMITS[plan] ?? 5

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100">Staff</h2>
          <p className="text-sm text-gray-400 dark:text-gray-500 mt-0.5">Manage team members and their access</p>
        </div>
        {isAdmin && (
          <Button icon={PlusCircle} onClick={openInvite}>Invite Staff</Button>
        )}
      </div>
      <PlanLimitBanner used={staff.length} limit={limit} resource="staff members" plan={plan} />

      {/* Role filter tabs */}
      <div className="flex gap-2 flex-wrap items-center">
        {ROLE_TABS.map(r => (
          <button
            key={r}
            onClick={() => setRoleTab(r)}
            className={clsx(
              'px-3 py-1.5 rounded-lg text-sm font-medium transition-colors',
              roleTab === r
                ? 'bg-teal-600 text-white'
                : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-400 border border-gray-200 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700'
            )}
          >{r}</button>
        ))}
        <div className="ml-auto relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search staff…"
            className="pl-8 pr-3 py-1.5 text-sm border border-gray-200 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-teal-500"
          />
        </div>
      </div>

      {/* Table */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 overflow-hidden">
        {loading ? (
          <div className="flex justify-center py-16"><div className="w-5 h-5 border-2 border-teal-500 border-t-transparent rounded-full animate-spin" /></div>
        ) : filtered.length === 0 ? (
          <div className="py-12"><EmptyState icon={UserCheck} title="No staff members" description="Invite your first team member to get started" /></div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 dark:border-gray-700 text-xs text-gray-500 dark:text-gray-400 uppercase">
                <th className="px-5 py-3 text-left">Name</th>
                <th className="px-5 py-3 text-left">Role</th>
                <th className="px-5 py-3 text-left">Email</th>
                <th className="px-5 py-3 text-left">Status</th>
                <th className="px-5 py-3 text-left">Joined</th>
                {isAdmin && <th className="px-5 py-3 text-right">Actions</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50 dark:divide-gray-700">
              {filtered.map(s => (
                <tr key={s.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-teal-100 dark:bg-teal-900/50 flex items-center justify-center flex-shrink-0">
                        <span className="text-xs font-bold text-teal-700 dark:text-teal-300">
                          {s.name.charAt(0).toUpperCase()}
                        </span>
                      </div>
                      <span className="font-medium text-gray-900 dark:text-gray-100">{s.name}</span>
                    </div>
                  </td>
                  <td className="px-5 py-3">
                    <Badge variant={ROLE_VARIANT[s.role] || 'default'}>{s.role}</Badge>
                  </td>
                  <td className="px-5 py-3 text-gray-500 dark:text-gray-400">{s.email || '—'}</td>
                  <td className="px-5 py-3">
                    <Badge variant={STATUS_VARIANT[s.status] || 'default'} className="capitalize">
                      {s.status || 'active'}
                    </Badge>
                  </td>
                  <td className="px-5 py-3 text-gray-400 dark:text-gray-500 text-xs">{formatDate(s.createdAt)}</td>
                  {isAdmin && (
                    <td className="px-5 py-3">
                      <div className="flex gap-1 justify-end">
                        <button onClick={() => openEdit(s)} className="p-1.5 text-gray-400 hover:text-teal-600 hover:bg-teal-50 dark:hover:bg-teal-900/30 rounded-lg transition-colors"><Pencil size={13} /></button>
                        <button onClick={() => handleDelete(s)} className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"><Trash2 size={13} /></button>
                      </div>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Invite Modal */}
      <Modal
        isOpen={inviteOpen}
        onClose={() => setInviteOpen(false)}
        title="Invite Staff Member"
        footer={
          <>
            <Button variant="secondary" onClick={() => setInviteOpen(false)}>Cancel</Button>
            <Button loading={saving} onClick={handleInvite}>Send Invite</Button>
          </>
        }
      >
        <div className="space-y-4">
          {error && (
            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg px-4 py-2.5 text-sm text-red-700 dark:text-red-400">{error}</div>
          )}
          <Input label="Full Name" required value={form.name} onChange={e => setForm(f => ({...f, name: e.target.value}))} placeholder="e.g. John Doe" />
          <Select label="Role" required value={form.role} onChange={e => setForm(f => ({...f, role: e.target.value}))} options={ROLE_OPTIONS} />
          <Input label="Email" required type="email" value={form.email} onChange={e => setForm(f => ({...f, email: e.target.value}))} placeholder="staff@example.com" />
          <Input label="Password" type="password" value={form.password} onChange={e => setForm(f => ({...f, password: e.target.value}))} placeholder="Leave blank for default (changeme123)" />
        </div>
      </Modal>

      {/* Edit Modal */}
      <Modal
        isOpen={!!editItem}
        onClose={() => setEditItem(null)}
        title="Edit Staff Member"
        footer={
          <>
            <Button variant="secondary" onClick={() => setEditItem(null)}>Cancel</Button>
            <Button loading={saving} onClick={handleEdit}>Save Changes</Button>
          </>
        }
      >
        <div className="space-y-4">
          {error && (
            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg px-4 py-2.5 text-sm text-red-700 dark:text-red-400">{error}</div>
          )}
          <Input label="Full Name" value={editForm.name} onChange={e => setEditForm(f => ({...f, name: e.target.value}))} />
          <Select label="Role" value={editForm.role} onChange={e => setEditForm(f => ({...f, role: e.target.value}))} options={ROLE_OPTIONS} />
          <Select label="Status" value={editForm.status} onChange={e => setEditForm(f => ({...f, status: e.target.value}))} options={STATUS_OPTIONS} />
        </div>
      </Modal>
    </div>
  )
}
