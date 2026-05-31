import { useState, useCallback, useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import { PlusCircle, Search, Pencil, Package, Settings2, Trash2, ChevronDown, ChevronRight, Plus, ImageIcon, X, Layers } from 'lucide-react'
import clsx from 'clsx'
import { useApp } from '../context/AppContext'
import { useAuth } from '../context/AuthContext'
import { useSettings } from '../context/SettingsContext'
import { menuApi, modifiersApi } from '../services/api'
import Badge from '../components/ui/Badge'
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

const TAG_OPTIONS = ['vegetarian', 'vegan', 'gluten-free', 'spicy', 'contains-nuts']

const STATION_OPTIONS = ['Kitchen', 'Grill', 'Bar', 'Pastry', 'Cold Kitchen']

const EMPTY_FORM = {
  name: '', category: 'Starters', price: '', description: '',
  stock: '', prepTime: '', tags: [], available: true,
  productCode: '', costPrice: '', productGroup: '', department: '',
  minStock: '', maxStock: '', station: 'Kitchen',
  stockQuantity: null, lowStockThreshold: '10',
  imageUrl: '',
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

  // Dynamic categories
  const [categories,    setCategories]    = useState([])
  const [catMgrOpen,    setCatMgrOpen]    = useState(false)

  const loadCategories = useCallback(() => {
    menuApi.getCategories().then(data => setCategories(data)).catch(() => {})
  }, [])

  useEffect(() => { loadCategories() }, [loadCategories])

  // Modifier groups state
  const [modGroups,       setModGroups]       = useState([])
  const [modModalOpen,    setModModalOpen]    = useState(false)
  const [itemGroupIds,    setItemGroupIds]    = useState([])   // groups assigned to item being edited
  const [expandedGroup,   setExpandedGroup]   = useState(null) // id of expanded group in manager
  const [groupForm,       setGroupForm]       = useState({ name: '', selectionType: 'single', required: false, minSelections: 0, maxSelections: 1 })
  const [editingGroup,    setEditingGroup]    = useState(null) // group being edited
  const [optionForms,     setOptionForms]     = useState({})  // { [groupId]: { name, priceAdjustment } }

  const isAdmin = user?.role === 'Admin'

  // Load modifier groups
  const loadGroups = useCallback(async () => {
    if (!isAdmin) return
    try { setModGroups(await modifiersApi.getGroups()) } catch {}
  }, [isAdmin])

  useEffect(() => { loadGroups() }, [loadGroups])

  // Filtered items
  const filtered = menuItems.filter((m) => {
    const matchCat = activeCategory === 'All' || m.category === activeCategory
    const q = search.toLowerCase()
    const matchSearch =
      (m.name        || '').toLowerCase().includes(q) ||
      (m.description || '').toLowerCase().includes(q)
    return matchCat && matchSearch
  })

  const allCategoryTabs = [{ id: 'all', name: 'All', color: '#6b7280', sortOrder: -1 }, ...categories]

  const catCount = (cat) =>
    cat === 'All'
      ? menuItems.length
      : menuItems.filter((m) => m.category === cat).length

  // ── Form helpers ──────────────────────────────────────────
  const openEdit = (item) => {
    setEditItem(item)
    setForm({
      name:         item.name         || '',
      category:     item.category     || 'Starters',
      price:        String(item.price ?? ''),
      description:  item.description  || '',
      stock:        String(item.stock  ?? ''),
      prepTime:     String(item.prepTime ?? ''),
      tags:         [...(item.tags || [])],
      available:    item.available,
      productCode:  item.productCode || '',
      costPrice:    item.costPrice != null ? String(item.costPrice) : '',
      productGroup: item.productGroup || '',
      department:   item.department || '',
      minStock:          item.minStock != null ? String(item.minStock) : '',
      maxStock:          item.maxStock != null ? String(item.maxStock) : '',
      station:           item.station || 'Kitchen',
      stockQuantity:     item.stockQuantity != null ? String(item.stockQuantity) : null,
      lowStockThreshold: item.lowStockThreshold != null ? String(item.lowStockThreshold) : '10',
      imageUrl:          item.imageUrl || '',
    })
    // Pre-select already-assigned modifier groups
    setItemGroupIds((item.modifierGroups || []).map(g => g.id))
    setErrors({})
    setModalOpen(true)
  }

  const openAdd = () => {
    setEditItem(null)
    setForm(EMPTY_FORM)
    setItemGroupIds([])
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
      name:         form.name.trim(),
      category:     form.category,
      price:        parseFloat(form.price),
      description:  form.description.trim(),
      stock:        parseInt(form.stock, 10),
      tags:         form.tags,
      available:    form.available,
      productCode:  form.productCode.trim() || undefined,
      costPrice:    form.costPrice !== '' ? parseFloat(form.costPrice) : 0,
      productGroup: form.productGroup.trim(),
      department:   form.department.trim(),
      minStock:          form.minStock !== '' ? parseInt(form.minStock, 10) : 0,
      maxStock:          form.maxStock !== '' ? parseInt(form.maxStock, 10) : 9999,
      station:           form.station || 'Kitchen',
      stockQuantity:     form.stockQuantity !== null && form.stockQuantity !== ''
                           ? parseFloat(form.stockQuantity)
                           : null,
      lowStockThreshold: form.lowStockThreshold !== '' ? parseFloat(form.lowStockThreshold) : 10,
      imageUrl:          form.imageUrl || '',
    }
    try {
      if (editItem) {
        const rawId = parseInt(String(editItem.id).replace('MI-', ''))
        const updated = await menuApi.update(rawId, itemData)
        // Save modifier group assignments
        await modifiersApi.setItemGroups(rawId, itemGroupIds)
        updateMenuItem({ ...updated, modifierGroups: modGroups.filter(g => itemGroupIds.includes(g.id)) })
      } else {
        const created = await menuApi.create(itemData)
        const rawId = created.id
        if (itemGroupIds.length) await modifiersApi.setItemGroups(rawId, itemGroupIds)
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

  // ── Image upload ──────────────────────────────────────────
  const handleImageUpload = (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > 5 * 1024 * 1024) { alert('Image must be under 5 MB'); return }
    const reader = new FileReader()
    reader.onload = (ev) => setForm(f => ({ ...f, imageUrl: ev.target.result }))
    reader.readAsDataURL(file)
    // Reset input so the same file can be re-selected after removal
    e.target.value = ''
  }

  // ── Modifier group helpers ─────────────────────────────────
  const saveGroup = async () => {
    if (!groupForm.name.trim()) return
    try {
      if (editingGroup) {
        const updated = await modifiersApi.updateGroup(editingGroup.id, groupForm)
        setModGroups(prev => prev.map(g => g.id === updated.id ? { ...g, ...updated } : g))
      } else {
        const created = await modifiersApi.createGroup(groupForm)
        setModGroups(prev => [...prev, created])
      }
      setGroupForm({ name: '', selectionType: 'single', required: false, minSelections: 0, maxSelections: 1 })
      setEditingGroup(null)
    } catch (err) { alert(err.message) }
  }

  const deleteGroup = async (groupId) => {
    if (!confirm('Delete this modifier group and all its options?')) return
    try {
      await modifiersApi.deleteGroup(groupId)
      setModGroups(prev => prev.filter(g => g.id !== groupId))
    } catch (err) { alert(err.message) }
  }

  const saveOption = async (groupId) => {
    const f = optionForms[groupId] || {}
    if (!f.name?.trim()) return
    try {
      const opt = await modifiersApi.addOption(groupId, { name: f.name, priceAdjustment: parseFloat(f.priceAdjustment) || 0 })
      setModGroups(prev => prev.map(g => g.id === groupId ? { ...g, options: [...(g.options || []), opt] } : g))
      setOptionForms(prev => ({ ...prev, [groupId]: { name: '', priceAdjustment: '' } }))
    } catch (err) { alert(err.message) }
  }

  const deleteOption = async (groupId, optId) => {
    try {
      await modifiersApi.deleteOption(optId)
      setModGroups(prev => prev.map(g => g.id === groupId ? { ...g, options: (g.options || []).filter(o => o.id !== optId) } : g))
    } catch (err) { alert(err.message) }
  }

  const stockBadge = (stock) => {
    if (stock === 0)  return { label: t('menu.outOfStock'), cls: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400'    }
    if (stock <= 5)   return { label: `${t('menu.lowStock')}: ${stock}`, cls: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400' }
    return               { label: `${t('menu.inStock')}: ${stock}`, cls: 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400' }
  }

  const plan      = user?.restaurantPlan || 'basic'
  const menuLimit = PLAN_MENU_LIMITS[plan] ?? 50

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100">{t('page.menu')}</h2>
          <p className="text-sm text-gray-400 dark:text-gray-500 mt-0.5">{menuItems.length} {t('menu.itemCount')}</p>
        </div>
        {isAdmin && (
          <div className="flex gap-2">
            <Button variant="secondary" icon={Settings2} onClick={() => setModModalOpen(true)}>
              Modifier Groups
            </Button>
            <Button icon={PlusCircle} onClick={openAdd}>
              {t('menu.addItem')}
            </Button>
          </div>
        )}
      </div>
      <PlanLimitBanner used={menuItems.length} limit={menuLimit} resource="menu items" plan={plan} />

      {/* Category Tabs + Search */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex gap-1 flex-wrap items-center">
          {allCategoryTabs.map((cat) => {
            const isActive = activeCategory === cat.name
            return (
              <button
                key={cat.id}
                onClick={() => setCategory(cat.name)}
                className={clsx(
                  'px-4 py-2 text-sm font-medium rounded-full transition-colors flex items-center gap-1.5',
                  isActive
                    ? 'text-white shadow-sm'
                    : 'bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700',
                )}
                style={isActive ? { background: cat.color || '#14b8a6' } : {}}
              >
                {cat.id !== 'all' && (
                  <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: isActive ? 'rgba(255,255,255,0.6)' : cat.color }} />
                )}
                {cat.name}
                <span className={clsx(
                  'ml-0.5 text-xs px-1.5 py-0.5 rounded-full',
                  isActive ? 'bg-black/20 text-white' : 'bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400',
                )}>
                  {catCount(cat.name)}
                </span>
              </button>
            )
          })}
          {isAdmin && (
            <button
              onClick={() => setCatMgrOpen(true)}
              className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-gray-500 dark:text-gray-400 bg-white dark:bg-gray-800 border border-dashed border-gray-300 dark:border-gray-600 rounded-full hover:border-teal-400 hover:text-teal-600 transition-colors"
            >
              <Layers size={12} />
              Manage
            </button>
          )}
        </div>
        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-500" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t('menu.search')}
            className="pl-8 pr-3 py-2 text-sm border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder:text-gray-400 dark:placeholder:text-gray-500 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-500 w-56"
          />
        </div>
      </div>

      {/* Category Manager modal */}
      <CategoryManager
        open={catMgrOpen}
        onClose={() => setCatMgrOpen(false)}
        onChanged={() => { loadCategories() }}
      />

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
                {/* Image / placeholder */}
                <div className="h-36 relative overflow-hidden flex-shrink-0">
                  {item.imageUrl ? (
                    <img
                      src={item.imageUrl}
                      alt={item.name}
                      className="w-full h-full object-cover"
                      onError={e => { e.currentTarget.style.display = 'none'; e.currentTarget.nextSibling.style.display = 'flex' }}
                    />
                  ) : null}
                  {/* Fallback shown when no image OR image fails to load */}
                  <div
                    className="w-full h-full items-center justify-center"
                    style={{ backgroundColor: bgColor, display: item.imageUrl ? 'none' : 'flex' }}
                  >
                    <span className="text-3xl font-black" style={{ color: textColor }}>
                      {item.name.slice(0, 2).toUpperCase()}
                    </span>
                  </div>
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
                    <span className="text-sm font-bold text-teal-600 dark:text-teal-400 flex-shrink-0">
                      {formatCurrency(item.price)}
                    </span>
                  </div>
                  {item.productCode && (
                    <p className="text-xs text-gray-400 dark:text-gray-500 font-mono mb-0.5">{item.productCode}</p>
                  )}
                  <p className="text-xs text-gray-400 dark:text-gray-500 line-clamp-2 mb-2 flex-1">{item.description}</p>

                  {/* Tags */}
                  {(item.tags?.length > 0 || item.modifierGroups?.length > 0) && (
                    <div className="flex flex-wrap gap-1 mb-2">
                      {(item.tags || []).map((tag) => (
                        <span key={tag} className="px-1.5 py-0.5 bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400 text-xs rounded-full">
                          {tag}
                        </span>
                      ))}
                      {item.modifierGroups?.length > 0 && (
                        <span className="px-1.5 py-0.5 bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-300 text-xs rounded-full font-medium">
                          {item.modifierGroups.length} modifier{item.modifierGroups.length !== 1 ? 's' : ''}
                        </span>
                      )}
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
                          item.available ? 'bg-teal-600' : 'bg-gray-300 dark:bg-gray-600',
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

      {/* ── Modifier Groups Manager Modal ───────────────────────── */}
      <Modal
        isOpen={modModalOpen}
        onClose={() => { setModModalOpen(false); setEditingGroup(null); setGroupForm({ name: '', selectionType: 'single', required: false, minSelections: 0, maxSelections: 1 }) }}
        title="Modifier Groups"
        size="md"
        footer={<Button variant="secondary" onClick={() => setModModalOpen(false)}>Close</Button>}
      >
        <div className="space-y-5">
          {/* Create / Edit form */}
          <div className="p-4 bg-gray-50 dark:bg-gray-700/50 rounded-xl space-y-3">
            <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">
              {editingGroup ? 'Edit Group' : 'New Group'}
            </p>
            <div className="grid grid-cols-2 gap-3">
              <Input
                label="Group Name"
                value={groupForm.name}
                onChange={e => setGroupForm(f => ({ ...f, name: e.target.value }))}
                placeholder="e.g. Choose Size"
              />
              <Select
                label="Selection Type"
                value={groupForm.selectionType}
                onChange={e => setGroupForm(f => ({ ...f, selectionType: e.target.value }))}
                options={[{ value: 'single', label: 'Single (radio)' }, { value: 'multiple', label: 'Multiple (checkbox)' }]}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Input
                label="Max Selections"
                type="number"
                value={groupForm.maxSelections}
                onChange={e => setGroupForm(f => ({ ...f, maxSelections: parseInt(e.target.value) || 1 }))}
              />
              <div className="flex items-center gap-2 mt-5">
                <input
                  type="checkbox"
                  id="modRequired"
                  checked={groupForm.required}
                  onChange={e => setGroupForm(f => ({ ...f, required: e.target.checked }))}
                  className="rounded text-teal-600"
                />
                <label htmlFor="modRequired" className="text-sm text-gray-700 dark:text-gray-300">Required</label>
              </div>
            </div>
            <div className="flex gap-2">
              <button onClick={saveGroup} className="px-3 py-1.5 bg-teal-600 text-white text-xs font-semibold rounded-lg hover:bg-teal-700 transition-colors">
                {editingGroup ? 'Update' : 'Create Group'}
              </button>
              {editingGroup && (
                <button onClick={() => { setEditingGroup(null); setGroupForm({ name: '', selectionType: 'single', required: false, minSelections: 0, maxSelections: 1 }) }}
                  className="px-3 py-1.5 bg-gray-100 dark:bg-gray-600 text-gray-700 dark:text-gray-300 text-xs font-semibold rounded-lg hover:bg-gray-200 transition-colors">
                  Cancel
                </button>
              )}
            </div>
          </div>

          {/* Groups list */}
          <div className="space-y-2">
            {modGroups.length === 0 && (
              <p className="text-sm text-gray-400 text-center py-4">No modifier groups yet</p>
            )}
            {modGroups.map(g => (
              <div key={g.id} className="border border-gray-200 dark:border-gray-600 rounded-xl overflow-hidden">
                {/* Group header */}
                <div className="flex items-center justify-between px-3 py-2.5 bg-white dark:bg-gray-800">
                  <button
                    className="flex items-center gap-2 flex-1 text-left"
                    onClick={() => setExpandedGroup(expandedGroup === g.id ? null : g.id)}
                  >
                    {expandedGroup === g.id ? <ChevronDown size={14} className="text-gray-400" /> : <ChevronRight size={14} className="text-gray-400" />}
                    <span className="text-sm font-semibold text-gray-800 dark:text-gray-200">{g.name}</span>
                    <span className="text-xs text-gray-400">{g.selectionType === 'single' ? 'Single' : `Multi(${g.maxSelections})`}{g.required ? ' · Required' : ''}</span>
                    <span className="text-xs text-gray-400">{g.options?.length || 0} options</span>
                  </button>
                  <div className="flex gap-1">
                    <button
                      onClick={() => { setEditingGroup(g); setGroupForm({ name: g.name, selectionType: g.selectionType, required: g.required, minSelections: g.minSelections, maxSelections: g.maxSelections }) }}
                      className="p-1.5 text-gray-400 hover:text-teal-600 rounded-lg hover:bg-teal-50 dark:hover:bg-teal-900/20 transition-colors"
                    >
                      <Pencil size={12} />
                    </button>
                    <button
                      onClick={() => deleteGroup(g.id)}
                      className="p-1.5 text-gray-400 hover:text-red-500 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                </div>

                {/* Options */}
                {expandedGroup === g.id && (
                  <div className="border-t border-gray-100 dark:border-gray-700 px-3 py-2 space-y-1.5 bg-gray-50/50 dark:bg-gray-800/30">
                    {(g.options || []).map(opt => (
                      <div key={opt.id} className="flex items-center justify-between text-sm">
                        <span className="text-gray-700 dark:text-gray-300">{opt.name}</span>
                        <div className="flex items-center gap-2">
                          {opt.priceAdjustment !== 0 && (
                            <span className={clsx('text-xs font-medium', opt.priceAdjustment > 0 ? 'text-gray-500' : 'text-green-600 dark:text-green-400')}>
                              {opt.priceAdjustment > 0 ? '+' : ''}{formatCurrency(opt.priceAdjustment)}
                            </span>
                          )}
                          <button onClick={() => deleteOption(g.id, opt.id)} className="p-1 text-gray-300 hover:text-red-500 transition-colors">
                            <Trash2 size={11} />
                          </button>
                        </div>
                      </div>
                    ))}
                    {/* Add option */}
                    <div className="flex gap-1.5 mt-2">
                      <input
                        placeholder="Option name"
                        value={optionForms[g.id]?.name || ''}
                        onChange={e => setOptionForms(prev => ({ ...prev, [g.id]: { ...(prev[g.id] || {}), name: e.target.value } }))}
                        className="flex-1 px-2.5 py-1.5 text-xs border border-gray-200 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-1 focus:ring-teal-500"
                      />
                      <input
                        placeholder="+/- price"
                        type="number"
                        step="500"
                        value={optionForms[g.id]?.priceAdjustment || ''}
                        onChange={e => setOptionForms(prev => ({ ...prev, [g.id]: { ...(prev[g.id] || {}), priceAdjustment: e.target.value } }))}
                        className="w-20 px-2.5 py-1.5 text-xs border border-gray-200 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-1 focus:ring-teal-500"
                      />
                      <button onClick={() => saveOption(g.id)} className="p-1.5 bg-teal-600 text-white rounded-lg hover:bg-teal-700 transition-colors">
                        <Plus size={12} />
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </Modal>

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

          {/* ── Image upload ── */}
          <div>
            <label className="text-sm font-medium text-gray-700 dark:text-gray-300 block mb-1.5">
              Item Image <span className="text-gray-400 font-normal">(optional)</span>
            </label>
            {form.imageUrl ? (
              <div className="relative w-full h-44 rounded-xl overflow-hidden border border-gray-200 dark:border-gray-600 bg-gray-100 dark:bg-gray-700">
                <img src={form.imageUrl} alt="Preview" className="w-full h-full object-cover" />
                <button
                  type="button"
                  onClick={() => setForm(f => ({ ...f, imageUrl: '' }))}
                  className="absolute top-2 right-2 p-1.5 bg-black/50 hover:bg-black/70 text-white rounded-full transition-colors"
                  title="Remove image"
                >
                  <X size={13} />
                </button>
                <button
                  type="button"
                  onClick={() => document.getElementById('imgUpload').click()}
                  className="absolute bottom-2 right-2 px-2.5 py-1 bg-black/50 hover:bg-black/70 text-white text-xs font-medium rounded-full transition-colors"
                >
                  Replace
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => document.getElementById('imgUpload').click()}
                className="w-full h-32 border-2 border-dashed border-gray-200 dark:border-gray-600 rounded-xl flex flex-col items-center justify-center gap-1.5 hover:border-teal-400 dark:hover:border-teal-500 hover:bg-teal-50/30 dark:hover:bg-teal-900/10 transition-colors cursor-pointer"
              >
                <ImageIcon size={24} className="text-gray-300 dark:text-gray-500" />
                <p className="text-sm text-gray-400 dark:text-gray-500">Click to upload photo</p>
                <p className="text-xs text-gray-300 dark:text-gray-600">PNG, JPG up to 5 MB</p>
              </button>
            )}
            <input id="imgUpload" type="file" accept="image/*" className="hidden" onChange={handleImageUpload} />
            {/* URL alternative */}
            <input
              type="url"
              value={form.imageUrl.startsWith('data:') ? '' : form.imageUrl}
              onChange={e => setForm(f => ({ ...f, imageUrl: e.target.value }))}
              placeholder="Or paste an image URL…"
              className="mt-2 w-full text-sm border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder:text-gray-300 dark:placeholder:text-gray-500 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-teal-500"
            />
          </div>

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
              options={categories.map((c) => ({ value: c.name, label: c.name }))}
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

          <Select
            label="Kitchen Station"
            value={form.station}
            onChange={(e) => setForm((f) => ({ ...f, station: e.target.value }))}
            options={STATION_OPTIONS.map((s) => ({ value: s, label: s }))}
          />

          <div>
            <label className="text-sm font-medium text-gray-700 dark:text-gray-300 block mb-1">{t('menu.description')}</label>
            <textarea
              value={form.description}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              placeholder={t('menu.descPlaceholder')}
              maxLength={200}
              rows={2}
              className="w-full rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-sm text-gray-900 dark:text-gray-100 placeholder:text-gray-400 dark:placeholder:text-gray-500 px-3 py-2.5 resize-none focus:outline-none focus:ring-2 focus:ring-teal-500"
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
            />
            <Input
              label={t('menu.prepTime')}
              type="number"
              value={form.prepTime}
              onChange={(e) => setForm((f) => ({ ...f, prepTime: e.target.value }))}
              placeholder="10"
            />
          </div>

          {/* Extended product info */}
          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Product Code"
              value={form.productCode}
              onChange={(e) => setForm((f) => ({ ...f, productCode: e.target.value }))}
              placeholder="e.g. ITEM-001"
            />
            <Input
              label="Cost Price"
              type="number"
              value={form.costPrice}
              onChange={(e) => setForm((f) => ({ ...f, costPrice: e.target.value }))}
              placeholder="0.00"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Product Group"
              value={form.productGroup}
              onChange={(e) => setForm((f) => ({ ...f, productGroup: e.target.value }))}
              placeholder="e.g. Seafood"
            />
            <Input
              label="Department"
              value={form.department}
              onChange={(e) => setForm((f) => ({ ...f, department: e.target.value }))}
              placeholder="e.g. Kitchen"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Min Stock"
              type="number"
              value={form.minStock}
              onChange={(e) => setForm((f) => ({ ...f, minStock: e.target.value }))}
              placeholder="0"
            />
            <Input
              label="Max Stock"
              type="number"
              value={form.maxStock}
              onChange={(e) => setForm((f) => ({ ...f, maxStock: e.target.value }))}
              placeholder="9999"
            />
          </div>

          {/* Inventory tracking */}
          <div className="p-3 bg-gray-50 dark:bg-gray-700/50 rounded-xl space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-700 dark:text-gray-300">Track Inventory</p>
                <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">Deduct stock on each sale; alert when running low</p>
              </div>
              <button
                type="button"
                onClick={() => setForm(f => ({
                  ...f,
                  stockQuantity: f.stockQuantity === null ? '' : null,
                }))}
                className={clsx(
                  'relative inline-flex h-6 w-11 items-center rounded-full transition-colors flex-shrink-0',
                  form.stockQuantity !== null ? 'bg-teal-600' : 'bg-gray-300 dark:bg-gray-600',
                )}
              >
                <span className={clsx(
                  'inline-block h-4 w-4 rounded-full bg-white shadow transition-transform',
                  form.stockQuantity !== null ? 'translate-x-6' : 'translate-x-1',
                )} />
              </button>
            </div>
            {form.stockQuantity !== null && (
              <div className="grid grid-cols-2 gap-3 pt-1">
                <Input
                  label="Current Stock"
                  type="number"
                  value={form.stockQuantity}
                  onChange={e => setForm(f => ({ ...f, stockQuantity: e.target.value }))}
                  placeholder="0"
                />
                <Input
                  label="Low-Stock Alert At"
                  type="number"
                  value={form.lowStockThreshold}
                  onChange={e => setForm(f => ({ ...f, lowStockThreshold: e.target.value }))}
                  placeholder="10"
                />
              </div>
            )}
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
                      ? 'bg-teal-100 dark:bg-teal-900/40 border-teal-300 dark:border-teal-700 text-teal-700 dark:text-teal-300'
                      : 'bg-gray-50 dark:bg-gray-700 border-gray-200 dark:border-gray-600 text-gray-500 dark:text-gray-400 hover:border-gray-300 dark:hover:border-gray-500',
                  )}
                >
                  {tag}
                </button>
              ))}
            </div>
          </div>

          {/* Modifier Groups assignment */}
          {modGroups.length > 0 && (
            <div>
              <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Modifier Groups</p>
              <div className="space-y-1.5">
                {modGroups.map(g => (
                  <label key={g.id} className="flex items-center gap-2.5 cursor-pointer p-2 hover:bg-gray-50 dark:hover:bg-gray-700/50 rounded-lg">
                    <input
                      type="checkbox"
                      checked={itemGroupIds.includes(g.id)}
                      onChange={e => setItemGroupIds(prev =>
                        e.target.checked ? [...prev, g.id] : prev.filter(id => id !== g.id)
                      )}
                      className="rounded text-teal-600"
                    />
                    <span className="text-sm text-gray-700 dark:text-gray-300">{g.name}</span>
                    <span className="text-xs text-gray-400">
                      {g.selectionType === 'single' ? 'Single' : `Multi (max ${g.maxSelections})`}
                      {g.required ? ' · Required' : ''}
                      {g.options?.length ? ` · ${g.options.length} options` : ''}
                    </span>
                  </label>
                ))}
              </div>
            </div>
          )}

          {/* Available toggle */}
          <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700/50 rounded-xl">
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">{t('menu.availableToOrder')}</span>
            <button
              type="button"
              onClick={() => setForm((f) => ({ ...f, available: !f.available }))}
              className={clsx(
                'relative inline-flex h-6 w-11 items-center rounded-full transition-colors',
                form.available ? 'bg-teal-600' : 'bg-gray-300 dark:bg-gray-600',
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
