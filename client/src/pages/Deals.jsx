import { useState, useEffect, useCallback } from 'react'
import { Plus, Pencil, Trash2, ImagePlus, X, ToggleLeft, ToggleRight, Tag } from 'lucide-react'
import clsx from 'clsx'
import { dealsApi } from '../services/api'
import { useSettings } from '../context/SettingsContext'
import { formatCurrency } from '../utils/formatters'
import Button from '../components/ui/Button'
import Input  from '../components/ui/Input'
import Modal  from '../components/ui/Modal'

const EMPTY = { title: '', description: '', imageUrl: '', price: '', active: true, sortOrder: 0 }

function compressImage(file, cb) {
  if (!file) return
  if (file.size > 10 * 1024 * 1024) { alert('Image must be under 10 MB'); return }
  const reader = new FileReader()
  reader.onload = ev => {
    const img = new Image()
    img.onload = () => {
      const MAX    = 800
      const ratio  = Math.min(MAX / img.width, MAX / img.height, 1)
      const canvas = document.createElement('canvas')
      canvas.width  = Math.round(img.width  * ratio)
      canvas.height = Math.round(img.height * ratio)
      canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height)
      cb(canvas.toDataURL('image/jpeg', 0.85))
    }
    img.src = ev.target.result
  }
  reader.readAsDataURL(file)
}

export default function Deals() {
  const { t } = useSettings()
  const [deals,   setDeals]   = useState([])
  const [loading, setLoading] = useState(true)
  const [saving,    setSaving]    = useState(false)
  const [error,     setError]     = useState('')

  const [editDeal, setEditDeal] = useState(null) // null = closed, {} = new, deal = editing
  const [form,     setForm]     = useState(EMPTY)
  const [delDeal,  setDelDeal]  = useState(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const data = await dealsApi.getAll()
      setDeals(data)
    } catch {}
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  const openNew  = () => { setForm(EMPTY); setError(''); setEditDeal({}) }
  const openEdit = d => { setForm({ title: d.title, description: d.description || '', imageUrl: d.imageUrl || '', price: d.price != null ? String(d.price) : '', active: d.active, sortOrder: d.sortOrder }); setError(''); setEditDeal(d) }

  const handleImageUpload = e => {
    compressImage(e.target.files?.[0], url => setForm(f => ({ ...f, imageUrl: url })))
    e.target.value = ''
  }

  const handleSave = async () => {
    if (!form.title.trim()) { setError('Title is required'); return }
    setSaving(true)
    setError('')
    try {
      const body = {
        title:       form.title.trim(),
        description: form.description.trim() || null,
        imageUrl:    form.imageUrl || null,
        price:       form.price !== '' ? parseFloat(form.price) : null,
        active:      form.active,
        sortOrder:   parseInt(form.sortOrder) || 0,
      }
      if (editDeal?.id) {
        await dealsApi.update(editDeal.id, body)
      } else {
        await dealsApi.create(body)
      }
      setEditDeal(null)
      load()
    } catch (err) {
      setError(err?.response?.data?.error || err?.message || 'Failed to save')
    } finally {
      setSaving(false)
    }
  }

  const handleToggle = async (deal) => {
    try {
      await dealsApi.update(deal.id, { active: !deal.active })
      load()
    } catch {}
  }

  const handleDelete = async () => {
    if (!delDeal) return
    setSaving(true)
    try {
      await dealsApi.delete(delDeal.id)
      setDelDeal(null)
      load()
    } catch (err) {
      alert(err?.response?.data?.error || err?.message || 'Failed to delete')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2">
            <Tag size={20} className="text-rose-500" /> {t('deals.title')}
          </h1>
          <p className="text-sm text-gray-400 mt-0.5">{t('deals.subtitle')}</p>
        </div>
        <Button onClick={openNew} className="flex items-center gap-2">
          <Plus size={16} /> {t('deals.add')}
        </Button>
      </div>

      {/* Grid */}
      {loading ? (
        <div className="text-center py-20 text-gray-400 text-sm">Loading…</div>
      ) : deals.length === 0 ? (
        <div className="text-center py-20 text-gray-400">
          <Tag size={40} className="mx-auto mb-3 opacity-30" />
          <p className="font-medium">{t('deals.empty.title')}</p>
          <p className="text-sm mt-1">{t('deals.empty.desc')}</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {deals.map(deal => (
            <div key={deal.id} className={clsx('bg-white dark:bg-gray-800 rounded-2xl border overflow-hidden shadow-sm flex flex-col transition-all', deal.active ? 'border-gray-100 dark:border-gray-700' : 'border-dashed border-gray-300 dark:border-gray-600 opacity-60')}>
              {/* Image */}
              <div className="relative w-full aspect-[16/9] bg-gradient-to-br from-rose-50 to-orange-50 dark:from-gray-700 dark:to-gray-750 flex items-center justify-center overflow-hidden">
                {deal.imageUrl
                  ? <img src={deal.imageUrl} alt={deal.title} className="w-full h-full object-cover" />
                  : <Tag size={36} className="text-rose-200 dark:text-rose-800" />
                }
                {!deal.active && (
                  <span className="absolute top-2 right-2 bg-gray-800/70 text-white text-[10px] font-bold px-2 py-0.5 rounded-full">{t('deals.inactive')}</span>
                )}
              </div>

              {/* Content */}
              <div className="flex-1 p-4 space-y-1">
                <p className="font-bold text-gray-900 dark:text-gray-100 line-clamp-1">{deal.title}</p>
                {deal.description && <p className="text-xs text-gray-500 dark:text-gray-400 line-clamp-2">{deal.description}</p>}
                <div className="flex items-center gap-2 flex-wrap mt-1">
                  {deal.price != null && (
                    <p className="text-sm font-bold text-rose-600 dark:text-rose-400">{formatCurrency(deal.price)}</p>
                  )}
                  {deal.price != null
                    ? <span className="text-[10px] bg-teal-100 dark:bg-teal-900/30 text-teal-700 dark:text-teal-400 px-1.5 py-0.5 rounded-full font-semibold">Orderable</span>
                    : <span className="text-[10px] bg-gray-100 dark:bg-gray-700 text-gray-400 px-1.5 py-0.5 rounded-full">Display only</span>
                  }
                </div>
              </div>

              {/* Actions */}
              <div className="flex items-center gap-2 px-4 pb-4">
                <button
                  onClick={() => handleToggle(deal)}
                  className={clsx('flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-xl text-xs font-semibold transition-colors', deal.active ? 'bg-teal-50 dark:bg-teal-900/20 text-teal-700 dark:text-teal-400 hover:bg-teal-100' : 'bg-gray-100 dark:bg-gray-700 text-gray-500 hover:bg-gray-200')}
                >
                  {deal.active ? <ToggleRight size={14} /> : <ToggleLeft size={14} />}
                  {deal.active ? t('deals.active') : t('deals.inactive_label')}
                </button>
                <button onClick={() => openEdit(deal)} className="p-2 rounded-xl bg-gray-100 dark:bg-gray-700 text-gray-500 hover:bg-blue-50 hover:text-blue-600 transition-colors">
                  <Pencil size={14} />
                </button>
                <button onClick={() => setDelDeal(deal)} className="p-2 rounded-xl bg-gray-100 dark:bg-gray-700 text-gray-500 hover:bg-red-50 hover:text-red-600 transition-colors">
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── Add / Edit Modal ── */}
      <Modal isOpen={editDeal !== null} onClose={() => setEditDeal(null)} title={editDeal?.id ? t('deals.edit') : t('deals.new')}>
        <div className="space-y-4">
          {/* Image upload */}
          <div>
            <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-2">{t('deals.image')}</label>
            <div className="relative w-full aspect-[16/9] bg-gray-100 dark:bg-gray-700 rounded-xl overflow-hidden flex items-center justify-center border-2 border-dashed border-gray-300 dark:border-gray-600">
              {form.imageUrl
                ? <>
                    <img src={form.imageUrl} alt="" className="w-full h-full object-cover" />
                    <button
                      onClick={() => setForm(f => ({ ...f, imageUrl: '' }))}
                      className="absolute top-2 right-2 bg-black/50 text-white rounded-full p-1 hover:bg-black/70 transition-colors"
                    >
                      <X size={12} />
                    </button>
                  </>
                : <label className="cursor-pointer flex flex-col items-center gap-2 text-gray-400 hover:text-gray-600 transition-colors">
                    <ImagePlus size={28} />
                    <span className="text-xs">{t('deals.image.upload')}</span>
                    <input type="file" accept="image/*" className="hidden" onChange={handleImageUpload} />
                  </label>
              }
            </div>
            {form.imageUrl && (
              <label className="mt-2 inline-flex items-center gap-1.5 text-xs text-teal-600 dark:text-teal-400 cursor-pointer hover:underline">
                <ImagePlus size={12} /> {t('deals.image.change')}
                <input type="file" accept="image/*" className="hidden" onChange={handleImageUpload} />
              </label>
            )}
          </div>

          {/* Title */}
          <div>
            <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">{t('deals.field.title')} <span className="text-red-500">*</span></label>
            <Input
              placeholder="e.g. Buy 1 Beer Get 1 Free"
              value={form.title}
              onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">{t('deals.field.description')}</label>
            <textarea
              rows={2}
              placeholder={t('deals.field.description.ph')}
              value={form.description}
              onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
              className="w-full px-3 py-2.5 text-sm bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-500 text-gray-900 dark:text-gray-100 resize-none"
            />
          </div>

          {/* Price */}
          <div>
            <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
              {t('deals.field.price')} <span className="text-gray-400 font-normal">{t('deals.field.price.hint')}</span>
            </label>
            <Input
              type="number"
              min="0"
              step="1000"
              placeholder="0"
              value={form.price}
              onChange={e => setForm(f => ({ ...f, price: e.target.value }))}
            />
          </div>

          {/* Active toggle */}
          <div className="flex items-center justify-between py-2 border-t border-gray-100 dark:border-gray-700">
            <div>
              <p className="text-sm font-medium text-gray-700 dark:text-gray-200">{t('deals.field.active')}</p>
              <p className="text-xs text-gray-400">{t('deals.field.active.hint')}</p>
            </div>
            <button
              onClick={() => setForm(f => ({ ...f, active: !f.active }))}
              className={clsx('w-11 h-6 rounded-full transition-colors relative flex-shrink-0', form.active ? 'bg-teal-500' : 'bg-gray-300 dark:bg-gray-600')}
            >
              <span className={clsx('absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform', form.active ? 'translate-x-5' : 'translate-x-0.5')} />
            </button>
          </div>

          {error && (
            <p className="text-xs text-red-500 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700 rounded-lg px-3 py-2">{error}</p>
          )}

          <div className="flex gap-3 pt-1">
            <Button variant="ghost" className="flex-1" onClick={() => setEditDeal(null)}>{t('common.cancel')}</Button>
            <Button className="flex-1" onClick={handleSave} disabled={saving}>
              {saving ? t('deals.saving') : t('deals.save')}
            </Button>
          </div>
        </div>
      </Modal>

      {/* ── Delete confirm ── */}
      <Modal isOpen={!!delDeal} onClose={() => setDelDeal(null)} title={t('deals.delete.title')}>
        {delDeal && (
          <div className="space-y-4">
            <p className="text-sm text-gray-600 dark:text-gray-300">
              {t('deals.delete.confirm')} <strong>{delDeal.title}</strong>{t('deals.delete.body')}
            </p>
            <div className="flex gap-3">
              <Button variant="ghost" className="flex-1" onClick={() => setDelDeal(null)}>{t('common.cancel')}</Button>
              <Button variant="danger" className="flex-1" onClick={handleDelete} disabled={saving}>{t('deals.delete.confirm')}</Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}
