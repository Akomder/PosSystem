import { useState, useEffect, useCallback } from 'react'
import { Plus, Pencil, Trash2, Search, Users } from 'lucide-react'
import { useSettings } from '../context/SettingsContext'
import { customersApi } from '../services/api'
import Button from '../components/ui/Button'
import Input from '../components/ui/Input'
import Select from '../components/ui/Select'
import Modal from '../components/ui/Modal'
import EmptyState from '../components/ui/EmptyState'
import Badge from '../components/ui/Badge'
import { formatCurrency, formatDate } from '../utils/formatters'

const GROUP_OPTIONS = [
  { value: 'General',  label: 'General'  },
  { value: 'VIP',      label: 'VIP'      },
  { value: 'Member',   label: 'Member'   },
  { value: 'Wholesale',label: 'Wholesale'},
]

const EMPTY_FORM = { name: '', phone: '', email: '', groupName: 'General', notes: '' }

export default function Customers() {
  const { t } = useSettings()

  const [customers, setCustomers] = useState([])
  const [loading,   setLoading]   = useState(true)
  const [search,    setSearch]    = useState('')
  const [group,     setGroup]     = useState('')
  const [modalOpen, setModalOpen] = useState(false)
  const [editing,   setEditing]   = useState(null)   // null = create
  const [form,      setForm]      = useState(EMPTY_FORM)
  const [saving,    setSaving]    = useState(false)
  const [error,     setError]     = useState('')

  const load = useCallback(async () => {
    try {
      setLoading(true)
      const params = {}
      if (search) params.search = search
      if (group)  params.group  = group
      const data = await customersApi.getAll(params)
      setCustomers(data)
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }, [search, group])

  useEffect(() => { load() }, [load])

  const openCreate = () => {
    setEditing(null)
    setForm(EMPTY_FORM)
    setError('')
    setModalOpen(true)
  }

  const openEdit = (c) => {
    setEditing(c)
    setForm({ name: c.name, phone: c.phone, email: c.email, groupName: c.groupName, notes: c.notes })
    setError('')
    setModalOpen(true)
  }

  const handleDelete = async (c) => {
    if (!window.confirm(`${t('customers.deleteConfirm')} (${c.name})`)) return
    try {
      await customersApi.delete(c.rawId)
      setCustomers(prev => prev.filter(x => x.rawId !== c.rawId))
    } catch (e) {
      alert(e.message)
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!form.name.trim()) { setError(t('customers.name') + ' is required'); return }
    setSaving(true)
    setError('')
    try {
      if (editing) {
        const updated = await customersApi.update(editing.rawId, form)
        setCustomers(prev => prev.map(x => x.rawId === updated.rawId ? updated : x))
      } else {
        const created = await customersApi.create(form)
        setCustomers(prev => [created, ...prev])
      }
      setModalOpen(false)
    } catch (e) {
      setError(e.message)
    } finally {
      setSaving(false)
    }
  }

  const groupBadge = (g) => {
    if (g === 'VIP')       return 'warning'
    if (g === 'Member')    return 'indigo'
    if (g === 'Wholesale') return 'blue'
    return 'default'
  }

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div>
          <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100">{t('customers.title')}</h2>
          <p className="text-sm text-gray-400 dark:text-gray-500 mt-0.5">{t('customers.subtitle')}</p>
        </div>
        <Button variant="primary" icon={Plus} onClick={openCreate}>
          {t('customers.add')}
        </Button>
      </div>

      {/* Filters */}
      <div className="flex gap-3 mb-5 flex-wrap">
        <div className="flex-1 min-w-48">
          <Input
            placeholder={t('customers.search')}
            value={search}
            onChange={e => setSearch(e.target.value)}
            icon={Search}
          />
        </div>
        <div className="w-44">
          <Select
            value={group}
            onChange={e => setGroup(e.target.value)}
            options={[
              { value: '', label: t('customers.allGroups') },
              ...GROUP_OPTIONS,
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
      ) : customers.length === 0 ? (
        <EmptyState
          icon={Users}
          title={t('customers.noCustomers')}
          description={t('customers.noCustomersDesc')}
          action={<Button variant="primary" icon={Plus} onClick={openCreate}>{t('customers.add')}</Button>}
        />
      ) : (
        <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 dark:border-gray-700">
                {[
                  t('customers.col.code'),
                  t('customers.col.name'),
                  t('customers.col.phone'),
                  t('customers.col.points'),
                  t('customers.col.spent'),
                  t('customers.col.since'),
                  t('customers.col.actions'),
                ].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50 dark:divide-gray-700">
              {customers.map(c => (
                <tr key={c.rawId} className="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
                  <td className="px-4 py-3 font-mono text-xs text-gray-500 dark:text-gray-400">{c.id}</td>
                  <td className="px-4 py-3">
                    <div className="font-medium text-gray-900 dark:text-gray-100">{c.name}</div>
                    <div className="flex items-center gap-1 mt-0.5">
                      <Badge variant={groupBadge(c.groupName)}>{c.groupName}</Badge>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-gray-600 dark:text-gray-400">{c.phone || '—'}</td>
                  <td className="px-4 py-3">
                    <span className="inline-flex items-center gap-1 bg-amber-50 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 px-2 py-0.5 rounded-full text-xs font-medium">
                      ★ {c.points}
                    </span>
                  </td>
                  <td className="px-4 py-3 font-medium text-gray-900 dark:text-gray-100">{formatCurrency(c.totalSpent)}</td>
                  <td className="px-4 py-3 text-gray-500 dark:text-gray-400 text-xs">{formatDate(c.createdAt)}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => openEdit(c)}
                        className="p-1.5 text-gray-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 rounded-lg transition-colors"
                      >
                        <Pencil size={14} />
                      </button>
                      <button
                        onClick={() => handleDelete(c)}
                        className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                      >
                        <Trash2 size={14} />
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
        title={editing ? t('customers.edit') : t('customers.add')}
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
          <Input
            label={t('customers.name')}
            value={form.name}
            onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
            required
          />
          <div className="grid grid-cols-2 gap-3">
            <Input
              label={t('customers.phone')}
              value={form.phone}
              onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
            />
            <Input
              label={t('customers.email')}
              type="email"
              value={form.email}
              onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
            />
          </div>
          <Select
            label={t('customers.groupName')}
            value={form.groupName}
            onChange={e => setForm(f => ({ ...f, groupName: e.target.value }))}
            options={GROUP_OPTIONS}
          />
          <div>
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-300 mb-1">
              {t('customers.notes')}
            </label>
            <textarea
              rows={3}
              value={form.notes}
              onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
              className="w-full rounded-xl border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
            />
          </div>
        </form>
      </Modal>
    </div>
  )
}
