import { useState, useEffect, useCallback } from 'react'
import { Plus, Pencil, Trash2, Search, Truck } from 'lucide-react'
import { useSettings } from '../context/SettingsContext'
import { suppliersApi } from '../services/api'
import Button from '../components/ui/Button'
import Input from '../components/ui/Input'
import Modal from '../components/ui/Modal'
import EmptyState from '../components/ui/EmptyState'
import { formatDate } from '../utils/formatters'

const EMPTY_FORM = { name: '', phone: '', email: '', address: '', notes: '' }

export default function Suppliers() {
  const { t } = useSettings()

  const [suppliers, setSuppliers] = useState([])
  const [loading,   setLoading]   = useState(true)
  const [search,    setSearch]    = useState('')
  const [modalOpen, setModalOpen] = useState(false)
  const [editing,   setEditing]   = useState(null)
  const [form,      setForm]      = useState(EMPTY_FORM)
  const [saving,    setSaving]    = useState(false)
  const [error,     setError]     = useState('')

  const load = useCallback(async () => {
    try {
      setLoading(true)
      const params = {}
      if (search) params.search = search
      const data = await suppliersApi.getAll(params)
      setSuppliers(data)
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }, [search])

  useEffect(() => { load() }, [load])

  const openCreate = () => {
    setEditing(null)
    setForm(EMPTY_FORM)
    setError('')
    setModalOpen(true)
  }

  const openEdit = (s) => {
    setEditing(s)
    setForm({ name: s.name, phone: s.phone, email: s.email, address: s.address, notes: s.notes })
    setError('')
    setModalOpen(true)
  }

  const handleDelete = async (s) => {
    if (!window.confirm(`Delete supplier: ${s.name}?`)) return
    try {
      await suppliersApi.delete(s.rawId)
      setSuppliers(prev => prev.filter(x => x.rawId !== s.rawId))
    } catch (e) {
      alert(e.message)
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!form.name.trim()) { setError(t('suppliers.name') + ' is required'); return }
    setSaving(true)
    setError('')
    try {
      if (editing) {
        const updated = await suppliersApi.update(editing.rawId, form)
        setSuppliers(prev => prev.map(x => x.rawId === updated.rawId ? updated : x))
      } else {
        const created = await suppliersApi.create(form)
        setSuppliers(prev => [created, ...prev])
      }
      setModalOpen(false)
    } catch (e) {
      setError(e.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div>
          <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100">{t('suppliers.title')}</h2>
          <p className="text-sm text-gray-400 dark:text-gray-500 mt-0.5">{t('suppliers.subtitle')}</p>
        </div>
        <Button variant="primary" icon={Plus} onClick={openCreate}>
          {t('suppliers.add')}
        </Button>
      </div>

      {/* Search */}
      <div className="mb-5 max-w-sm">
        <Input
          placeholder={t('suppliers.search')}
          value={search}
          onChange={e => setSearch(e.target.value)}
          icon={Search}
        />
      </div>

      {/* Table */}
      {loading ? (
        <div className="flex items-center justify-center py-16 gap-2 text-gray-400">
          <div className="w-4 h-4 border-2 border-teal-500 border-t-transparent rounded-full animate-spin" />
          {t('common.loading')}
        </div>
      ) : suppliers.length === 0 ? (
        <EmptyState
          icon={Truck}
          title={t('suppliers.noSuppliers')}
          description={t('suppliers.noSuppliersDesc')}
          action={<Button variant="primary" icon={Plus} onClick={openCreate}>{t('suppliers.add')}</Button>}
        />
      ) : (
        <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 dark:border-gray-700">
                {[
                  t('suppliers.col.code'),
                  t('suppliers.col.name'),
                  t('suppliers.col.phone'),
                  t('suppliers.col.email'),
                  t('suppliers.col.address'),
                  t('suppliers.col.actions'),
                ].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50 dark:divide-gray-700">
              {suppliers.map(s => (
                <tr key={s.rawId} className="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
                  <td className="px-4 py-3 font-mono text-xs text-gray-500 dark:text-gray-400">{s.id}</td>
                  <td className="px-4 py-3 font-medium text-gray-900 dark:text-gray-100">{s.name}</td>
                  <td className="px-4 py-3 text-gray-600 dark:text-gray-400">{s.phone || '—'}</td>
                  <td className="px-4 py-3 text-gray-600 dark:text-gray-400">{s.email || '—'}</td>
                  <td className="px-4 py-3 text-gray-500 dark:text-gray-400 max-w-xs truncate">{s.address || '—'}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => openEdit(s)}
                        className="p-1.5 text-gray-400 hover:text-teal-600 dark:hover:text-teal-400 hover:bg-teal-50 dark:hover:bg-teal-900/20 rounded-lg transition-colors"
                      >
                        <Pencil size={14} />
                      </button>
                      <button
                        onClick={() => handleDelete(s)}
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
        title={editing ? t('suppliers.edit') : t('suppliers.add')}
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
            label={t('suppliers.name')}
            value={form.name}
            onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
            required
          />
          <div className="grid grid-cols-2 gap-3">
            <Input
              label={t('suppliers.phone')}
              value={form.phone}
              onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
            />
            <Input
              label={t('suppliers.email')}
              type="email"
              value={form.email}
              onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
            />
          </div>
          <Input
            label={t('suppliers.address')}
            value={form.address}
            onChange={e => setForm(f => ({ ...f, address: e.target.value }))}
          />
          <div>
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-300 mb-1">
              {t('suppliers.notes')}
            </label>
            <textarea
              rows={3}
              value={form.notes}
              onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
              className="w-full rounded-xl border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 resize-none"
            />
          </div>
        </form>
      </Modal>
    </div>
  )
}
