import { useState, useEffect } from 'react'
import { PlusCircle, Tag, Pencil, Trash2 } from 'lucide-react'
import clsx from 'clsx'
import { promotionsApi } from '../services/api'
import Button from '../components/ui/Button'
import Modal from '../components/ui/Modal'
import Input from '../components/ui/Input'
import Select from '../components/ui/Select'
import Badge from '../components/ui/Badge'
import EmptyState from '../components/ui/EmptyState'
import { formatCurrency, formatDate } from '../utils/formatters'
import { useAuth } from '../context/AuthContext'

const TYPE_LABELS = { percent: '% Off', fixed: 'Fixed Off', buy_x_get_y: 'Buy X Get Y' }
const TYPE_VARIANT = { percent: 'teal', fixed: 'amber', buy_x_get_y: 'green' }

const EMPTY_FORM = { name: '', type: 'percent', value: '', minOrderValue: '', validFrom: '', validTo: '', usageLimit: '' }

export default function Promotions() {
  const { user } = useAuth()
  const isAdmin = user?.role === 'Admin'
  const [promos, setPromos]       = useState([])
  const [loading, setLoading]     = useState(true)
  const [modalOpen, setModalOpen] = useState(false)
  const [editPromo, setEditPromo] = useState(null)
  const [form, setForm]           = useState(EMPTY_FORM)
  const [saving, setSaving]       = useState(false)

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    try { setPromos(await promotionsApi.getAll()) } catch (_) {}
    setLoading(false)
  }

  function openCreate() { setEditPromo(null); setForm(EMPTY_FORM); setModalOpen(true) }
  function openEdit(p) {
    setEditPromo(p)
    setForm({
      name: p.name, type: p.type, value: String(p.value),
      minOrderValue: String(p.minOrderValue),
      validFrom: p.validFrom || '', validTo: p.validTo || '',
      usageLimit: p.usageLimit != null ? String(p.usageLimit) : '',
    })
    setModalOpen(true)
  }

  async function handleSave() {
    if (!form.name.trim()) return
    setSaving(true)
    const payload = {
      name: form.name, type: form.type, value: parseFloat(form.value) || 0,
      minOrderValue: parseFloat(form.minOrderValue) || 0,
      validFrom: form.validFrom || null, validTo: form.validTo || null,
      usageLimit: form.usageLimit ? parseInt(form.usageLimit) : null,
    }
    try {
      if (editPromo) {
        const updated = await promotionsApi.update(editPromo.id, payload)
        setPromos(prev => prev.map(p => p.id === updated.id ? updated : p))
      } else {
        const created = await promotionsApi.create(payload)
        setPromos(prev => [created, ...prev])
      }
      setModalOpen(false)
    } catch (_) {}
    setSaving(false)
  }

  async function toggleActive(p) {
    const updated = await promotionsApi.update(p.id, { active: !p.active })
    setPromos(prev => prev.map(x => x.id === updated.id ? updated : x))
  }

  async function handleDelete(id) {
    if (!window.confirm('Delete this promotion?')) return
    await promotionsApi.delete(id)
    setPromos(prev => prev.filter(p => p.id !== id))
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100">Promotions</h2>
          <p className="text-sm text-gray-400 dark:text-gray-500 mt-0.5">Manage discount campaigns and offers</p>
        </div>
        {isAdmin && <Button icon={PlusCircle} onClick={openCreate}>New Promotion</Button>}
      </div>

      {loading ? (
        <div className="flex justify-center py-16"><div className="w-5 h-5 border-2 border-teal-500 border-t-transparent rounded-full animate-spin" /></div>
      ) : promos.length === 0 ? (
        <EmptyState icon={Tag} title="No promotions" description="Create discount campaigns and special offers" />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {promos.map(p => (
            <div key={p.id} className={clsx(
              'bg-white dark:bg-gray-800 rounded-xl border shadow-sm overflow-hidden',
              p.active ? 'border-gray-100 dark:border-gray-700' : 'border-gray-100 dark:border-gray-700 opacity-60'
            )}>
              <div className="px-4 pt-4 pb-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2 flex-1 min-w-0">
                    <div className={clsx('w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0',
                      p.type === 'percent' ? 'bg-teal-50 dark:bg-teal-900/30' :
                      p.type === 'fixed'   ? 'bg-amber-50 dark:bg-amber-900/30' : 'bg-green-50 dark:bg-green-900/30'
                    )}>
                      <Tag size={14} className={
                        p.type === 'percent' ? 'text-teal-600 dark:text-teal-400' :
                        p.type === 'fixed'   ? 'text-amber-600 dark:text-amber-400' : 'text-green-600 dark:text-green-400'
                      } />
                    </div>
                    <div className="min-w-0">
                      <p className="font-semibold text-gray-900 dark:text-gray-100 truncate">{p.name}</p>
                      <Badge variant={TYPE_VARIANT[p.type]} className="mt-0.5">{TYPE_LABELS[p.type]}</Badge>
                    </div>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="text-xl font-bold text-teal-600 dark:text-teal-400">
                      {p.type === 'percent' ? `${p.value}%` : formatCurrency(p.value)}
                    </p>
                  </div>
                </div>

                <div className="mt-3 space-y-1">
                  {p.minOrderValue > 0 && (
                    <p className="text-xs text-gray-400 dark:text-gray-500">Min order: {formatCurrency(p.minOrderValue)}</p>
                  )}
                  {(p.validFrom || p.validTo) && (
                    <p className="text-xs text-gray-400 dark:text-gray-500">
                      {p.validFrom && formatDate(p.validFrom)} {p.validTo && `→ ${formatDate(p.validTo)}`}
                    </p>
                  )}
                  {p.usageLimit && (
                    <p className="text-xs text-gray-400 dark:text-gray-500">{p.usageCount} / {p.usageLimit} used</p>
                  )}
                </div>
              </div>

              <div className="flex items-center justify-between px-4 py-2.5 border-t border-gray-100 dark:border-gray-700">
                <button
                  onClick={() => toggleActive(p)}
                  className={clsx('relative inline-flex h-5 w-9 items-center rounded-full transition-colors', p.active ? 'bg-teal-600' : 'bg-gray-300 dark:bg-gray-600')}
                >
                  <span className={clsx('inline-block h-3.5 w-3.5 rounded-full bg-white shadow transition-transform', p.active ? 'translate-x-4.5' : 'translate-x-0.5')} />
                </button>
                {isAdmin && (
                  <div className="flex gap-1">
                    <button onClick={() => openEdit(p)} className="p-1.5 text-gray-400 hover:text-teal-600 hover:bg-teal-50 dark:hover:bg-teal-900/30 rounded-lg transition-colors"><Pencil size={13} /></button>
                    <button onClick={() => handleDelete(p.id)} className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"><Trash2 size={13} /></button>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      <Modal isOpen={modalOpen} onClose={() => setModalOpen(false)} title={editPromo ? 'Edit Promotion' : 'New Promotion'}
        footer={<><Button variant="secondary" onClick={() => setModalOpen(false)}>Cancel</Button><Button loading={saving} onClick={handleSave}>Save</Button></>}
      >
        <div className="space-y-4">
          <Input label="Name" required value={form.name} onChange={e => setForm(f => ({...f, name: e.target.value}))} placeholder="e.g. 10% Weekend Discount" />
          <div className="grid grid-cols-2 gap-4">
            <Select label="Type" value={form.type} onChange={e => setForm(f => ({...f, type: e.target.value}))}
              options={[{value:'percent',label:'Percentage'},{value:'fixed',label:'Fixed Amount'},{value:'buy_x_get_y',label:'Buy X Get Y'}]}
            />
            <Input label={form.type === 'percent' ? 'Percentage (%)' : 'Discount Amount'} type="number" value={form.value} onChange={e => setForm(f => ({...f, value: e.target.value}))} placeholder="0" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Input label="Min Order Value" type="number" value={form.minOrderValue} onChange={e => setForm(f => ({...f, minOrderValue: e.target.value}))} placeholder="0.00" />
            <Input label="Usage Limit" type="number" value={form.usageLimit} onChange={e => setForm(f => ({...f, usageLimit: e.target.value}))} placeholder="Unlimited" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Input label="Valid From" type="date" value={form.validFrom} onChange={e => setForm(f => ({...f, validFrom: e.target.value}))} />
            <Input label="Valid To" type="date" value={form.validTo} onChange={e => setForm(f => ({...f, validTo: e.target.value}))} />
          </div>
        </div>
      </Modal>
    </div>
  )
}
