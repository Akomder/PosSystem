import { useState, useCallback } from 'react'
import { useSearchParams } from 'react-router-dom'
import { PlusCircle, Search, Pencil, Package } from 'lucide-react'
import clsx from 'clsx'
import { useApp } from '../context/AppContext'
import { useAuth } from '../context/AuthContext'
import { useSettings } from '../context/SettingsContext'
import { menuApi } from '../services/api'
import Badge from '../components/ui/Badge'
import Button from '../components/ui/Button'
import Modal from '../components/ui/Modal'
import Input from '../components/ui/Input'
import Select from '../components/ui/Select'
import EmptyState from '../components/ui/EmptyState'
import { formatCurrency } from '../utils/formatters'
import { getPlaceholderColor, getPlaceholderTextColor } from '../utils/tableHelpers'

const CATEGORIES = ['All', 'Starters', 'Mains', 'Drinks', 'Desserts']

const TAG_OPTIONS = ['vegetarian', 'vegan', 'gluten-free', 'spicy', 'contains-nuts']

const EMPTY_FORM = {
  name: '', category: 'Starters', price: '', description: '',
  stock: '', prepTime: '', tags: [], available: true,
}

export default function Menu() {
  const { menuItems, addMenuItem, updateMenuItem, toggleMenuItemAvailability } = useApp()
  const { user } = useAuth()
  const { t } = useSettings()
  const [searchParams, setSearchParams] = useSearchParams()

  const activeCategory = searchParams.get('category') || 'All'
  const setCategory    = (cat) => setSearchParams(cat === 'All' ? {} : { category: cat })

  const [search,     setSearch]     = useState('')
  const [modalOpen,  setModalOpen]  = useState(false)
  const [editItem,   setEditItem]   = useState(null)   // null = add mode
  const [form,       setForm]       = useState(EMPTY_FORM)
  const [errors,     setErrors]     = useState({})
  const [saving,     setSaving]     = useState(false)
  const [saveError,  setSaveError]  = useState(null)

  const isAdmin = user?.role === 'Admin'

  // Filtered items
  const filtered = menuItems.filter((m) => {
    const matchCat = activeCategory === 'All' || m.category === activeCategory
    const matchSearch =
      m.name.toLowerCase().includes(search.toLowerCase()) ||
      m.description.toLowerCase().includes(search.toLowerCase())
    return matchCat && matchSearch
  })

  const catCount = (cat) =>
    cat === 'All'
      ? menuItems.length
      : menuItems.filter((m) => m.category === cat).length

  // ── Form helpers ──────────────────────────────────────────
  const openAdd = () => {
    setEditItem(null)
    setForm(EMPTY_FORM)
    setErrors({})
    setModalOpen(true)
  }

  const openEdit = (item) => {
    setEditItem(item)
    setForm({
      name:        item.name,
      category:    item.category,
      price:       String(item.price),
      description: item.description,
      stock:       String(item.stock),
      prepTime:    String(item.prepTime),
      tags:        [...item.tags],
      available:   item.available,
    })
    setErrors({})
    setModalOpen(true)
  }

  const validate = () => {
    const e = {}
    if (!form.name.trim())       e.name     = 'Name is required'
    if (!form.price || isNaN(+form.price) || +form.price <= 0)
                                  e.price    = 'Enter a valid price'
    if (form.stock === '' || isNaN(+form.stock) || +form.stock < 0)
                                  e.stock    = 'Enter a valid stock quantity'
    setErrors(e)
    return Object.keys(e).length === 0
  }

  const handleSave = async () => {
    if (!validate()) return
    setSaving(true)
    setSaveError(null)
    const itemData = {
      name:        form.name.trim(),
      category:    form.category,
      price:       parseFloat(form.price),
      description: form.description.trim(),
      stock:       parseInt(form.stock, 10),
      tags:        form.tags,
      available:   form.available,
    }
    try {
      if (editItem) {
        const rawId = parseInt(editItem.id.replace('MI-', ''))
        const updated = await menuApi.update(rawId, itemData)
        updateMenuItem(updated)
      } else {
        const created = await menuApi.create(itemData)
        addMenuItem(created)
      }
      setModalOpen(false)
    } catch (err) {
      setSaveError(err.message || 'Failed to save item')
    } finally {
      setSaving(false)
    }
  }

  const toggleTag = (tag) => {
    setForm((f) => ({
      ...f,
      tags: f.tags.includes(tag) ? f.tags.filter((tg) => tg !== tag) : [...f.tags, tag],
    }))
  }

  const stockBadge = (stock) => {
    if (stock === 0)  return { label: t('menu.outOfStock'), cls: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400'    }
    if (stock <= 5)   return { label: `${t('menu.lowStock')}: ${stock}`, cls: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400' }
    return               { label: `${t('menu.inStock')}: ${stock}`, cls: 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400' }
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100">{t('page.menu')}</h2>
          <p className="text-sm text-gray-400 dark:text-gray-500 mt-0.5">{menuItems.length} {t('menu.itemCount')}</p>
        </div>
        {isAdmin && (
          <Button icon={PlusCircle} onClick={openAdd}>
            {t('menu.addItem')}
          </Button>
        )}
      </div>

      {/* Category Tabs + Search */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex gap-1 flex-wrap">
          {CATEGORIES.map((cat) => (
            <button
              key={cat}
              onClick={() => setCategory(cat)}
              className={clsx(
                'px-4 py-2 text-sm font-medium rounded-full transition-colors',
                activeCategory === cat
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700',
              )}
            >
              {cat}
              <span className={clsx(
                'ml-1.5 text-xs px-1.5 py-0.5 rounded-full',
                activeCategory === cat ? 'bg-indigo-500' : 'bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400',
              )}>
                {catCount(cat)}
              </span>
            </button>
          ))}
        </div>
        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-500" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t('menu.search')}
            className="pl-8 pr-3 py-2 text-sm border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder:text-gray-400 dark:placeholder:text-gray-500 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 w-56"
          />
        </div>
      </div>

      {/* Item Grid */}
      {filtered.length === 0 ? (
        <EmptyState
          icon={Package}
          title={t('menu.noItems')}
          description={t('menu.adjustSearch')}
        />
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
          {filtered.map((item) => {
            const stock = stockBadge(item.stock)
            const bgColor   = getPlaceholderColor(item.id)
            const textColor = getPlaceholderTextColor(item.id)
            return (
              <div
                key={item.id}
                className={clsx(
                  'bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 shadow-sm overflow-hidden',
                  'flex flex-col transition-shadow hover:shadow-md',
                  !item.available && 'opacity-60',
                )}
              >
                {/* Image placeholder */}
                <div
                  className="h-36 flex items-center justify-center relative"
                  style={{ backgroundColor: bgColor }}
                >
                  <span className="text-3xl font-black" style={{ color: textColor }}>
                    {item.name.slice(0, 2).toUpperCase()}
                  </span>
                  {/* Stock badge */}
                  <span className={`absolute top-2 right-2 px-2 py-0.5 rounded-full text-xs font-medium ${stock.cls}`}>
                    {stock.label}
                  </span>
                  {!item.available && (
                    <div className="absolute inset-0 bg-white/60 dark:bg-gray-900/60 flex items-center justify-center">
                      <span className="text-xs font-bold text-gray-500 dark:text-gray-300 bg-white dark:bg-gray-800 px-2 py-1 rounded-full border border-gray-200 dark:border-gray-600">
                        {t('menu.unavailable')}
                      </span>
                    </div>
                  )}
                </div>

                {/* Info */}
                <div className="p-3 flex flex-col flex-1">
                  <div className="flex items-start justify-between gap-1 mb-1">
                    <p className="text-sm font-semibold text-gray-900 dark:text-gray-100 leading-tight">{item.name}</p>
                    <span className="text-sm font-bold text-indigo-600 dark:text-indigo-400 flex-shrink-0">
                      {formatCurrency(item.price)}
                    </span>
                  </div>

                  <p className="text-xs text-gray-400 dark:text-gray-500 line-clamp-2 mb-2 flex-1">{item.description}</p>

                  {/* Tags */}
                  {item.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1 mb-2">
                      {item.tags.map((tag) => (
                        <span
                          key={tag}
                          className="px-1.5 py-0.5 bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400 text-xs rounded-full"
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                  )}

                  {/* Footer */}
                  <div className="flex items-center justify-between pt-2 border-t border-gray-100 dark:border-gray-700">
                    {/* Availability toggle */}
                    {isAdmin ? (
                      <button
                        onClick={() => toggleMenuItemAvailability(item.id)}
                        className={clsx(
                          'relative inline-flex h-5 w-9 items-center rounded-full transition-colors',
                          item.available ? 'bg-indigo-600' : 'bg-gray-300 dark:bg-gray-600',
                        )}
                        title={item.available ? 'Mark unavailable' : 'Mark available'}
                      >
                        <span
                          className={clsx(
                            'inline-block h-3.5 w-3.5 rounded-full bg-white shadow transition-transform',
                            item.available ? 'translate-x-4.5' : 'translate-x-0.5',
                          )}
                        />
                      </button>
                    ) : (
                      <span className={`text-xs font-medium ${item.available ? 'text-green-600 dark:text-green-400' : 'text-gray-400 dark:text-gray-500'}`}>
                        {item.available ? t('menu.available') : t('menu.unavailable')}
                      </span>
                    )}

                    {isAdmin && (
                      <button
                        onClick={() => openEdit(item)}
                        className="p-1.5 text-gray-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 rounded-lg transition-colors"
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

      {/* ── Add / Edit Modal ─────────────────────────────────── */}
      <Modal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editItem ? `${t('menu.editPrefix')} ${editItem.name}` : t('menu.addMenuItem')}
        size="md"
        footer={
          <>
            <Button variant="secondary" onClick={() => setModalOpen(false)}>{t('common.cancel')}</Button>
            <Button onClick={handleSave}>{editItem ? t('menu.saveChanges') : t('menu.addItem')}</Button>
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
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            placeholder="e.g. Grilled Salmon"
            error={errors.name}
          />

          <div className="grid grid-cols-2 gap-4">
            <Select
              label={t('menu.category')}
              required
              value={form.category}
              onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}
              options={['Starters','Mains','Drinks','Desserts'].map((c) => ({ value: c, label: c }))}
            />
            <Input
              label={t('menu.price')}
              type="number"
              required
              value={form.price}
              onChange={(e) => setForm((f) => ({ ...f, price: e.target.value }))}
              placeholder="0.00"
              error={errors.price}
            />
          </div>

          <div>
            <label className="text-sm font-medium text-gray-700 dark:text-gray-300 block mb-1">{t('menu.description')}</label>
            <textarea
              value={form.description}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              placeholder={t('menu.descPlaceholder')}
              maxLength={200}
              rows={2}
              className="w-full rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-sm text-gray-900 dark:text-gray-100 placeholder:text-gray-400 dark:placeholder:text-gray-500 px-3 py-2.5 resize-none focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Input
              label={t('menu.stockQty')}
              type="number"
              required
              value={form.stock}
              onChange={(e) => setForm((f) => ({ ...f, stock: e.target.value }))}
              placeholder="0"
              error={errors.stock}
            />
            <Input
              label={t('menu.prepTime')}
              type="number"
              value={form.prepTime}
              onChange={(e) => setForm((f) => ({ ...f, prepTime: e.target.value }))}
              placeholder="10"
            />
          </div>

          {/* Tags */}
          <div>
            <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">{t('menu.dietaryTags')}</p>
            <div className="flex flex-wrap gap-2">
              {TAG_OPTIONS.map((tag) => (
                <button
                  key={tag}
                  type="button"
                  onClick={() => toggleTag(tag)}
                  className={clsx(
                    'px-3 py-1 rounded-full text-xs font-medium border transition-colors',
                    form.tags.includes(tag)
                      ? 'bg-indigo-100 dark:bg-indigo-900/40 border-indigo-300 dark:border-indigo-700 text-indigo-700 dark:text-indigo-300'
                      : 'bg-gray-50 dark:bg-gray-700 border-gray-200 dark:border-gray-600 text-gray-500 dark:text-gray-400 hover:border-gray-300 dark:hover:border-gray-500',
                  )}
                >
                  {tag}
                </button>
              ))}
            </div>
          </div>

          {/* Available toggle */}
          <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700/50 rounded-xl">
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">{t('menu.availableToOrder')}</span>
            <button
              type="button"
              onClick={() => setForm((f) => ({ ...f, available: !f.available }))}
              className={clsx(
                'relative inline-flex h-6 w-11 items-center rounded-full transition-colors',
                form.available ? 'bg-indigo-600' : 'bg-gray-300 dark:bg-gray-600',
              )}
            >
              <span
                className={clsx(
                  'inline-block h-4 w-4 rounded-full bg-white shadow transition-transform',
                  form.available ? 'translate-x-6' : 'translate-x-1',
                )}
              />
            </button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
