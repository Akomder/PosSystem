import { useState, useCallback, useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import { PlusCircle, Search, Pencil, Package, Layers, ImageIcon, X } from 'lucide-react'
import clsx from 'clsx'
import { useApp } from '../context/AppContext'
import { useAuth } from '../context/AuthContext'
import { useSettings } from '../context/SettingsContext'
import { menuApi } from '../services/api'
import Button from '../components/ui/Button'
import Modal from '../components/ui/Modal'
import Input from '../components/ui/Input'
import Select from '../components/ui/Select'
import EmptyState from '../components/ui/EmptyState'
import PlanLimitBanner from '../components/ui/PlanLimitBanner'
import CategoryManager from '../components/CategoryManager'
import { formatCurrency } from '../utils/formatters'
import { getPlaceholderColor, getPlaceholderTextColor } from '../utils/tableHelpers'

const PLAN_MENU_LIMITS = { basic: 50, pro: 200, enterprise: Infinity }

const EMPTY_FORM = { name: '', category: '', price: '', available: true, imageUrl: '', isAvailable: true, isPromotion: false, promotionLabel: '' }

export default function Menu() {
  const { menuItems, addMenuItem, updateMenuItem, toggleMenuItemAvailability } = useApp()
  const { user } = useAuth()
  const { t }    = useSettings()
  const [searchParams, setSearchParams] = useSearchParams()

  const activeCategory = searchParams.get('category') || 'All'
  const setCategory    = (cat) => setSearchParams(cat === 'All' ? {} : { category: cat })

  const [search,    setSearch]    = useState('')
  const [modalOpen, setModalOpen] = useState(false)
  const [editItem,  setEditItem]  = useState(null)
  const [form,      setForm]      = useState(EMPTY_FORM)
  const [errors,    setErrors]    = useState({})
  const [saving,    setSaving]    = useState(false)
  const [saveError, setSaveError] = useState(null)

  const [categories, setCategories] = useState([])
  const [catMgrOpen, setCatMgrOpen] = useState(false)

  const isAdmin = user?.role === 'Admin'

  const loadCategories = useCallback(() => {
    menuApi.getCategories().then(data => setCategories(data)).catch(() => {})
  }, [])

  useEffect(() => { loadCategories() }, [loadCategories])

  // ── Filtering ──────────────────────────────────────────────
  const filtered = menuItems.filter(m => {
    const matchCat    = activeCategory === 'All' || m.category === activeCategory
    const q           = search.toLowerCase()
    const matchSearch = (m.name || '').toLowerCase().includes(q)
    return matchCat && matchSearch
  })

  const allTabs  = [{ id: 'all', name: 'All', color: '#6b7280' }, ...categories]
  const catCount = cat => cat === 'All'
    ? menuItems.length
    : menuItems.filter(m => m.category === cat).length

  // ── Open modals ────────────────────────────────────────────
  const openAdd = () => {
    setEditItem(null)
    setForm({ name: '', category: categories[0]?.name || '', price: '', available: true, imageUrl: '', isAvailable: true })
    setErrors({})
    setSaveError(null)
    setModalOpen(true)
  }

  const openEdit = (item) => {
    setEditItem(item)
    setForm({
      name:        item.name      || '',
      category:    item.category  || categories[0]?.name || '',
      price:       String(item.price ?? ''),
      available:      item.available,
      imageUrl:       item.imageUrl  || '',
      isAvailable:    item.isAvailable !== false,
      isPromotion:    item.isPromotion    || false,
      promotionLabel: item.promotionLabel || '',
    })
    setErrors({})
    setSaveError(null)
    setModalOpen(true)
  }

  // ── Image upload (auto-resizes to max 600px, JPEG 80%) ────
  const handleImageUpload = (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > 10 * 1024 * 1024) { alert('Image must be under 10 MB'); return }
    const reader = new FileReader()
    reader.onload = (ev) => {
      const img = new Image()
      img.onload = () => {
        const MAX    = 600
        const ratio  = Math.min(MAX / img.width, MAX / img.height, 1)
        const canvas = document.createElement('canvas')
        canvas.width  = Math.round(img.width  * ratio)
        canvas.height = Math.round(img.height * ratio)
        canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height)
        setForm(f => ({ ...f, imageUrl: canvas.toDataURL('image/jpeg', 0.8) }))
      }
      img.src = ev.target.result
    }
    reader.readAsDataURL(file)
    e.target.value = ''
  }

  // ── Validate & Save ────────────────────────────────────────
  const validate = () => {
    const e = {}
    if (!form.name.trim())                                      e.name  = 'Name is required'
    if (!form.price || isNaN(+form.price) || +form.price <= 0) e.price = 'Enter a valid price'
    if (!form.category)                                         e.category = 'Select a category'
    setErrors(e)
    return Object.keys(e).length === 0
  }

  const handleSave = async () => {
    if (!validate()) return
    setSaving(true); setSaveError(null)

    const itemData = {
      name:      form.name.trim(),
      category:  form.category,
      price:     parseFloat(form.price),
      available:   form.available,
      isAvailable: form.isAvailable !== false,
      description:       editItem?.description  || '',
      prepTime:          editItem?.prepTime     ?? 0,
      station:           editItem?.station      || 'Kitchen',
      tags:              editItem?.tags         || [],
      imageUrl:          form.imageUrl          || '',
      productCode:       editItem?.productCode  || '',
      costPrice:         editItem?.costPrice    ?? 0,
      productGroup:      editItem?.productGroup || '',
      department:        editItem?.department   || '',
      isPromotion:       form.isPromotion,
      promotionLabel:    form.promotionLabel.trim() || null,
    }

    try {
      if (editItem) {
        const rawId   = parseInt(String(editItem.id).replace('MI-', ''))
        const updated = await menuApi.update(rawId, itemData)
        updateMenuItem(updated)
      } else {
        const created = await menuApi.create(itemData)
        addMenuItem(created)
      }
      setModalOpen(false)
    } catch (err) {
      setSaveError(err.message || 'Failed to save')
    } finally {
      setSaving(false)
    }
  }

  const plan      = user?.restaurantPlan || 'basic'
  const menuLimit = PLAN_MENU_LIMITS[plan] ?? 50

  return (
    <div className="space-y-5">

      {/* Page header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100">{t('page.menu')}</h2>
          <p className="text-sm text-gray-400 dark:text-gray-500 mt-0.5">{menuItems.length} {t('menu.itemCount')}</p>
        </div>
        {isAdmin && (
          <div className="flex gap-2">
            <Button variant="secondary" icon={Layers} onClick={() => setCatMgrOpen(true)}>
              Categories
            </Button>
            <Button icon={PlusCircle} onClick={openAdd}>
              {t('menu.addItem')}
            </Button>
          </div>
        )}
      </div>

      <PlanLimitBanner used={menuItems.length} limit={menuLimit} resource="menu items" plan={plan} />

      {/* Category tabs + search */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex gap-1 flex-wrap">
          {allTabs.map(cat => {
            const active = activeCategory === cat.name
            return (
              <button
                key={cat.id}
                onClick={() => setCategory(cat.name)}
                className={clsx(
                  'px-4 py-2 text-sm font-medium rounded-full transition-colors flex items-center gap-1.5',
                  active
                    ? 'text-white shadow-sm'
                    : 'bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700',
                )}
                style={active ? { background: cat.color || '#14b8a6' } : {}}
              >
                {cat.id !== 'all' && (
                  <span
                    className="w-2 h-2 rounded-full flex-shrink-0"
                    style={{ background: active ? 'rgba(255,255,255,0.6)' : cat.color }}
                  />
                )}
                {cat.name}
                <span className={clsx(
                  'ml-0.5 text-xs px-1.5 py-0.5 rounded-full',
                  active ? 'bg-black/20 text-white' : 'bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400',
                )}>
                  {catCount(cat.name)}
                </span>
              </button>
            )
          })}
        </div>

        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-500" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder={t('menu.search')}
            className="pl-8 pr-3 py-2 text-sm border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder:text-gray-400 dark:placeholder:text-gray-500 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-500 w-56"
          />
        </div>
      </div>

      {/* Category manager modal */}
      <CategoryManager
        open={catMgrOpen}
        onClose={() => setCatMgrOpen(false)}
        onChanged={loadCategories}
      />

      {/* Item grid */}
      {filtered.length === 0 ? (
        <EmptyState icon={Package} title={t('menu.noItems')} description={t('menu.adjustSearch')} />
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
          {filtered.map(item => {
            const bgColor   = getPlaceholderColor(item.id)
            const textColor = getPlaceholderTextColor(item.id)
            const catColor  = categories.find(c => c.name === item.category)?.color || '#6b7280'
            return (
              <div
                key={item.id}
                className={clsx(
                  'bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 shadow-sm overflow-hidden flex flex-col transition-shadow hover:shadow-md',
                  !item.available && 'opacity-60',
                )}
              >
                {/* Thumbnail */}
                <div className="h-36 relative overflow-hidden flex-shrink-0">
                  {item.imageUrl ? (
                    <img
                      src={item.imageUrl}
                      alt={item.name}
                      className="w-full h-full object-cover"
                      onError={e => {
                        e.currentTarget.style.display = 'none'
                        e.currentTarget.nextSibling.style.display = 'flex'
                      }}
                    />
                  ) : null}
                  <div
                    className="w-full h-full items-center justify-center"
                    style={{ backgroundColor: bgColor, display: item.imageUrl ? 'none' : 'flex' }}
                  >
                    <span className="text-3xl font-black" style={{ color: textColor }}>
                      {item.name.slice(0, 2).toUpperCase()}
                    </span>
                  </div>


                  {/* Promotion badge */}
                  {item.isPromotion && (
                    <span className="absolute top-2 left-2 bg-rose-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full leading-none shadow-sm z-10">
                      {item.promotionLabel || 'PROMO'}
                    </span>
                  )}

                  {/* Unavailable overlay */}
                  {!item.available && (
                    <div className="absolute inset-0 bg-white/60 dark:bg-gray-900/60 flex items-center justify-center">
                      <span className="text-xs font-bold text-gray-500 dark:text-gray-300 bg-white dark:bg-gray-800 px-2 py-1 rounded-full border border-gray-200 dark:border-gray-600">
                        {t('menu.unavailable')}
                      </span>
                    </div>
                  )}
                </div>

                {/* Card body */}
                <div className="p-3 flex flex-col flex-1">
                  <div className="flex items-start justify-between gap-1 mb-2">
                    <p className="text-sm font-semibold text-gray-900 dark:text-gray-100 leading-tight">
                      {item.name}
                    </p>
                    <span className="text-sm font-bold text-teal-600 dark:text-teal-400 flex-shrink-0">
                      {formatCurrency(item.price)}
                    </span>
                  </div>

                  {/* Category pill */}
                  <span
                    className="self-start px-2 py-0.5 rounded-full text-xs font-medium text-white mb-auto"
                    style={{ background: catColor }}
                  >
                    {item.category}
                  </span>

                  {/* Footer */}
                  <div className="flex items-center justify-between pt-2 mt-2 border-t border-gray-100 dark:border-gray-700">
                    {isAdmin ? (
                      <button
                        onClick={() => toggleMenuItemAvailability(item.id)}
                        className={clsx(
                          'relative inline-flex h-5 w-9 items-center rounded-full transition-colors',
                          item.available ? 'bg-teal-600' : 'bg-gray-300 dark:bg-gray-600',
                        )}
                        title={item.available ? 'Mark unavailable' : 'Mark available'}
                      >
                        <span className={clsx(
                          'inline-block h-3.5 w-3.5 rounded-full bg-white shadow transition-transform',
                          item.available ? 'translate-x-4.5' : 'translate-x-0.5',
                        )} />
                      </button>
                    ) : (
                      <span className={`text-xs font-medium ${item.available ? 'text-green-600 dark:text-green-400' : 'text-gray-400 dark:text-gray-500'}`}>
                        {item.available ? t('menu.available') : t('menu.unavailable')}
                      </span>
                    )}

                    {isAdmin && (
                      <button
                        onClick={() => openEdit(item)}
                        className="p-1.5 text-gray-400 hover:text-teal-600 dark:hover:text-teal-400 hover:bg-teal-50 dark:hover:bg-teal-900/30 rounded-lg transition-colors"
                        title="Edit item"
                      >
                        <Pencil size={13} />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* ── Add / Edit Modal ─────────────────────────────────────── */}
      <Modal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editItem ? `Edit ${editItem.name}` : t('menu.addMenuItem')}
        size="sm"
        footer={
          <>
            <Button variant="secondary" onClick={() => setModalOpen(false)}>
              {t('common.cancel')}
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? 'Saving…' : (editItem ? t('menu.saveChanges') : t('menu.addItem'))}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          {saveError && (
            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg px-4 py-2.5 text-sm text-red-700 dark:text-red-400">
              {saveError}
            </div>
          )}

          <Input
            label={t('menu.itemName')}
            required
            value={form.name}
            onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
            placeholder="e.g. Grilled Chicken"
            error={errors.name}
            autoFocus
          />

          <Select
            label={t('menu.category')}
            required
            value={form.category}
            onChange={e => setForm(f => ({ ...f, category: e.target.value }))}
            options={categories.map(c => ({ value: c.name, label: c.name }))}
            error={errors.category}
          />

          <Input
            label={t('menu.price')}
            type="number"
            required
            value={form.price}
            onChange={e => setForm(f => ({ ...f, price: e.target.value }))}
            placeholder="0"
            error={errors.price}
          />

          {/* Image upload */}
          <div>
            <label className="text-sm font-medium text-gray-700 dark:text-gray-300 block mb-1.5">
              Image <span className="text-xs text-gray-400 font-normal">(optional)</span>
            </label>
            {form.imageUrl ? (
              <div className="relative w-full h-40 rounded-xl overflow-hidden border border-gray-200 dark:border-gray-600 bg-gray-100 dark:bg-gray-700">
                <img src={form.imageUrl} alt="Preview" className="w-full h-full object-cover" />
                <button
                  type="button"
                  onClick={() => setForm(f => ({ ...f, imageUrl: '' }))}
                  className="absolute top-2 right-2 p-1.5 bg-black/50 hover:bg-black/70 text-white rounded-full transition-colors"
                  title="Remove image"
                >
                  <X size={12} />
                </button>
                <button
                  type="button"
                  onClick={() => document.getElementById('menuImgUpload').click()}
                  className="absolute bottom-2 right-2 px-2.5 py-1 bg-black/50 hover:bg-black/70 text-white text-xs font-medium rounded-full transition-colors"
                >
                  Replace
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => document.getElementById('menuImgUpload').click()}
                className="w-full h-28 border-2 border-dashed border-gray-200 dark:border-gray-600 rounded-xl flex flex-col items-center justify-center gap-1.5 hover:border-teal-400 dark:hover:border-teal-500 hover:bg-teal-50/30 dark:hover:bg-teal-900/10 transition-colors"
              >
                <ImageIcon size={22} className="text-gray-300 dark:text-gray-500" />
                <p className="text-sm text-gray-400 dark:text-gray-500">Click to upload photo</p>
                <p className="text-xs text-gray-300 dark:text-gray-600">Auto-resized · max 10 MB</p>
              </button>
            )}
            <input id="menuImgUpload" type="file" accept="image/*" className="hidden" onChange={handleImageUpload} />
            <input
              type="url"
              value={form.imageUrl.startsWith('data:') ? '' : form.imageUrl}
              onChange={e => setForm(f => ({ ...f, imageUrl: e.target.value }))}
              placeholder="Or paste an image URL…"
              className="mt-2 w-full text-sm border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder:text-gray-300 dark:placeholder:text-gray-500 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-teal-500"
            />
          </div>

          {/* Availability toggle */}
          <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700/50 rounded-xl">
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
              {t('menu.availableToOrder')}
            </span>
            <button
              type="button"
              onClick={() => setForm(f => ({ ...f, available: !f.available }))}
              className={clsx(
                'relative inline-flex h-6 w-11 items-center rounded-full transition-colors',
                form.available ? 'bg-teal-600' : 'bg-gray-300 dark:bg-gray-600',
              )}
            >
              <span className={clsx(
                'inline-block h-4 w-4 rounded-full bg-white shadow transition-transform',
                form.available ? 'translate-x-6' : 'translate-x-1',
              )} />
            </button>
          </div>

          {/* QR ordering availability */}
          <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700/50 rounded-xl">
            <div>
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Available on QR Menu</span>
              <p className="text-xs text-gray-400 mt-0.5">Uncheck to show Out of Stock on customer QR page</p>
            </div>
            <button
              type="button"
              onClick={() => setForm(f => ({ ...f, isAvailable: !f.isAvailable }))}
              className={clsx(
                'relative inline-flex h-6 w-11 items-center rounded-full transition-colors flex-shrink-0',
                form.isAvailable ? 'bg-teal-600' : 'bg-gray-300 dark:bg-gray-600',
              )}
            >
              <span className={clsx(
                'inline-block h-4 w-4 rounded-full bg-white shadow transition-transform',
                form.isAvailable ? 'translate-x-6' : 'translate-x-1',
              )} />
            </button>
          </div>

          {/* Promotion */}
          <div className="rounded-xl border border-rose-100 dark:border-rose-900/40 bg-rose-50/50 dark:bg-rose-900/10 p-3 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Mark as Promotion</span>
                <p className="text-xs text-gray-400 mt-0.5">Shows a badge on this item in POS &amp; QR menu</p>
              </div>
              <button
                type="button"
                onClick={() => setForm(f => ({ ...f, isPromotion: !f.isPromotion }))}
                className={clsx(
                  'relative inline-flex h-6 w-11 items-center rounded-full transition-colors flex-shrink-0',
                  form.isPromotion ? 'bg-rose-500' : 'bg-gray-300 dark:bg-gray-600',
                )}
              >
                <span className={clsx(
                  'inline-block h-4 w-4 rounded-full bg-white shadow transition-transform',
                  form.isPromotion ? 'translate-x-6' : 'translate-x-1',
                )} />
              </button>
            </div>
            {form.isPromotion && (
              <Input
                label="Promotion label"
                value={form.promotionLabel}
                onChange={e => setForm(f => ({ ...f, promotionLabel: e.target.value }))}
                placeholder="e.g. Today's Special, 20% OFF"
              />
            )}
          </div>

        </div>
      </Modal>
    </div>
  )
}
