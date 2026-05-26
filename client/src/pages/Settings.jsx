import { useState, useEffect, useCallback } from 'react'
import {
  Settings2, PlusCircle, Pencil, Trash2, Check, X,
  Store, Phone, Mail, MapPin, Percent, DollarSign,
  Save, RefreshCw,
} from 'lucide-react'
import clsx from 'clsx'
import { settingsApi, salesChannelsApi } from '../services/api'
import Button from '../components/ui/Button'
import EmptyState from '../components/ui/EmptyState'
import { useAuth } from '../context/AuthContext'

// ─── Tab definitions ──────────────────────────────────────────────────────────
const TABS = [
  { key: 'store',             label: 'Store'             },
  { key: 'cancel_reasons',    label: 'Cancel Reasons'    },
  { key: 'note_templates',    label: 'Note Templates'    },
  { key: 'processing_sectors',label: 'Processing Sectors'},
  { key: 'print_templates',   label: 'Print Templates'   },
  { key: 'sales_channels',    label: 'Sales Channels'    },
]

const API_MAP = {
  cancel_reasons:     settingsApi.cancelReasons,
  note_templates:     settingsApi.noteTemplates,
  processing_sectors: settingsApi.processingSectors,
  print_templates:    settingsApi.printTemplates,
  sales_channels:     salesChannelsApi,
}

const FIELDS_MAP = {
  cancel_reasons:     [{ key: 'name', label: 'Reason', type: 'text', required: true }],
  note_templates:     [{ key: 'name', label: 'Name', type: 'text', required: true }, { key: 'text', label: 'Template Text', type: 'textarea' }],
  processing_sectors: [{ key: 'name', label: 'Sector Name', type: 'text', required: true }, { key: 'description', label: 'Description', type: 'text' }],
  print_templates:    [
    { key: 'name',    label: 'Template Name',    type: 'text',     required: true },
    { key: 'type',    label: 'Type',             type: 'select',   options: ['receipt','kitchen','label'] },
    { key: 'content', label: 'Template Content', type: 'textarea' },
  ],
  sales_channels:     [
    { key: 'name',        label: 'Channel Name', type: 'text', required: true },
    { key: 'description', label: 'Description',  type: 'text' },
  ],
}

// ─── POS parameter toggle definitions ─────────────────────────────────────────
const POS_TOGGLES = [
  { key: 'productAttributes',      label: 'Product Attributes',        desc: 'Enable attribute variants (size, colour, etc.) on menu items' },
  { key: 'productUnits',           label: 'Product Units',             desc: 'Track stock in custom units (kg, litre, piece…)' },
  { key: 'productManufacturing',   label: 'Product Manufacturing',     desc: 'Enable bill-of-materials for produced items' },
  { key: 'quickAddProducts',       label: 'Quick Add Products',        desc: 'Show a shortcut to add new products from the sell screen' },
  { key: 'loyaltyPoints',          label: 'Loyalty Points',            desc: 'Award and redeem customer loyalty points on orders' },
  { key: 'editTransactionTime',    label: 'Allow Edit Transaction Time',desc: 'Let staff adjust the timestamp of completed orders' },
  { key: 'printEstimates',         label: 'Print Estimates',           desc: 'Allow printing an estimate/proforma before finalising' },
]

// ─── Toggle component ─────────────────────────────────────────────────────────
function Toggle({ checked, onChange }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className={clsx(
        'relative inline-flex h-6 w-11 flex-shrink-0 items-center rounded-full transition-colors duration-200',
        checked ? 'bg-teal-600' : 'bg-gray-200 dark:bg-gray-600',
      )}
    >
      <span className={clsx(
        'inline-block h-4.5 w-4.5 rounded-full bg-white shadow transition-transform duration-200',
        checked ? 'translate-x-5.5' : 'translate-x-0.5',
      )} />
    </button>
  )
}

// ─── Store tab ────────────────────────────────────────────────────────────────
function StoreTab({ isAdmin }) {
  const [loading,  setLoading]  = useState(true)
  const [saving,   setSaving]   = useState(false)
  const [toast,    setToast]    = useState(null)   // { type, msg }
  const [info,     setInfo]     = useState({
    name: '', phone: '', email: '', address: '',
    taxRate: '', currency: 'USD', logoUrl: '',
  })
  const [posParams, setPosParams] = useState(
    Object.fromEntries(POS_TOGGLES.map(t => [t.key, false]))
  )

  const showToast = useCallback((type, msg) => {
    setToast({ type, msg })
    setTimeout(() => setToast(null), 3000)
  }, [])

  useEffect(() => {
    let mounted = true
    setLoading(true)
    settingsApi.store.get()
      .then(data => {
        if (!mounted) return
        setInfo({
          name:     data.name      || '',
          phone:    data.phone     || '',
          email:    data.email     || '',
          address:  data.address   || '',
          taxRate:  data.taxRate   != null ? String(data.taxRate) : '',
          currency: data.currency  || 'USD',
          logoUrl:  data.logoUrl   || '',
        })
        const saved = data.settings || {}
        setPosParams(prev => ({ ...prev, ...saved }))
      })
      .catch(() => {})
      .finally(() => { if (mounted) setLoading(false) })
    return () => { mounted = false }
  }, [])

  async function handleSave() {
    setSaving(true)
    try {
      await settingsApi.store.update({
        name:     info.name     || undefined,
        phone:    info.phone    || undefined,
        email:    info.email    || undefined,
        address:  info.address  || undefined,
        taxRate:  info.taxRate  ? parseFloat(info.taxRate) : undefined,
        currency: info.currency || undefined,
        logoUrl:  info.logoUrl  || undefined,
        settings: posParams,
      })
      showToast('success', 'Store settings saved')
    } catch (e) {
      showToast('error', e.message || 'Failed to save')
    }
    setSaving(false)
  }

  if (loading) {
    return (
      <div className="flex justify-center py-16">
        <div className="w-5 h-5 border-2 border-teal-500 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="space-y-5">

      {/* Toast */}
      {toast && (
        <div className={clsx(
          'flex items-center gap-2 px-4 py-3 rounded-xl text-sm font-medium',
          toast.type === 'success'
            ? 'bg-green-50 dark:bg-green-900/30 text-green-700 dark:text-green-400 border border-green-200 dark:border-green-800'
            : 'bg-red-50 dark:bg-red-900/30 text-red-700 dark:text-red-400 border border-red-200 dark:border-red-800',
        )}>
          {toast.type === 'success' ? <Check size={15} /> : <X size={15} />}
          {toast.msg}
        </div>
      )}

      {/* ── Store Information ─────────────────────────────────────────────── */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100 dark:border-gray-700 flex items-center gap-2">
          <Store size={15} className="text-teal-600" />
          <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">Store Information</p>
        </div>
        <div className="px-5 py-5 grid grid-cols-1 sm:grid-cols-2 gap-4">

          {/* Restaurant Name */}
          <div className="sm:col-span-2">
            <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5">Restaurant Name</label>
            <input
              type="text"
              value={info.name}
              onChange={e => setInfo(p => ({ ...p, name: e.target.value }))}
              disabled={!isAdmin}
              placeholder="Bella Vista"
              className="w-full text-sm bg-gray-50 dark:bg-gray-700/50 border border-gray-200 dark:border-gray-600 rounded-lg px-3 py-2.5 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent disabled:opacity-60 disabled:cursor-not-allowed"
            />
          </div>

          {/* Phone */}
          <div>
            <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5">
              <span className="flex items-center gap-1"><Phone size={11} /> Phone</span>
            </label>
            <input
              type="tel"
              value={info.phone}
              onChange={e => setInfo(p => ({ ...p, phone: e.target.value }))}
              disabled={!isAdmin}
              placeholder="+1 555 000 0000"
              className="w-full text-sm bg-gray-50 dark:bg-gray-700/50 border border-gray-200 dark:border-gray-600 rounded-lg px-3 py-2.5 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent disabled:opacity-60 disabled:cursor-not-allowed"
            />
          </div>

          {/* Email */}
          <div>
            <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5">
              <span className="flex items-center gap-1"><Mail size={11} /> Email</span>
            </label>
            <input
              type="email"
              value={info.email}
              onChange={e => setInfo(p => ({ ...p, email: e.target.value }))}
              disabled={!isAdmin}
              placeholder="info@restaurant.com"
              className="w-full text-sm bg-gray-50 dark:bg-gray-700/50 border border-gray-200 dark:border-gray-600 rounded-lg px-3 py-2.5 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent disabled:opacity-60 disabled:cursor-not-allowed"
            />
          </div>

          {/* Address */}
          <div className="sm:col-span-2">
            <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5">
              <span className="flex items-center gap-1"><MapPin size={11} /> Address</span>
            </label>
            <textarea
              value={info.address}
              onChange={e => setInfo(p => ({ ...p, address: e.target.value }))}
              disabled={!isAdmin}
              rows={2}
              placeholder="123 Main Street, City, Country"
              className="w-full text-sm bg-gray-50 dark:bg-gray-700/50 border border-gray-200 dark:border-gray-600 rounded-lg px-3 py-2.5 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent resize-none disabled:opacity-60 disabled:cursor-not-allowed"
            />
          </div>

          {/* Tax Rate */}
          <div>
            <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5">
              <span className="flex items-center gap-1"><Percent size={11} /> Tax Rate (%)</span>
            </label>
            <input
              type="number"
              min="0"
              max="100"
              step="0.1"
              value={info.taxRate}
              onChange={e => setInfo(p => ({ ...p, taxRate: e.target.value }))}
              disabled={!isAdmin}
              placeholder="10"
              className="w-full text-sm bg-gray-50 dark:bg-gray-700/50 border border-gray-200 dark:border-gray-600 rounded-lg px-3 py-2.5 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent disabled:opacity-60 disabled:cursor-not-allowed"
            />
          </div>

          {/* Currency */}
          <div>
            <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5">
              <span className="flex items-center gap-1"><DollarSign size={11} /> Currency</span>
            </label>
            <select
              value={info.currency}
              onChange={e => setInfo(p => ({ ...p, currency: e.target.value }))}
              disabled={!isAdmin}
              className="w-full text-sm bg-gray-50 dark:bg-gray-700/50 border border-gray-200 dark:border-gray-600 rounded-lg px-3 py-2.5 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {['USD','EUR','GBP','AUD','CAD','JPY','CNY','LAK','THB','MYR','SGD'].map(c => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>

        </div>
      </div>

      {/* ── POS Parameters ────────────────────────────────────────────────── */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100 dark:border-gray-700 flex items-center gap-2">
          <Settings2 size={15} className="text-teal-600" />
          <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">POS Parameters</p>
        </div>
        <div className="divide-y divide-gray-50 dark:divide-gray-700">
          {POS_TOGGLES.map(toggle => (
            <div key={toggle.key} className="flex items-center justify-between px-5 py-4">
              <div className="min-w-0 pr-6">
                <p className="text-sm font-medium text-gray-800 dark:text-gray-100">{toggle.label}</p>
                <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">{toggle.desc}</p>
              </div>
              <Toggle
                checked={!!posParams[toggle.key]}
                onChange={val => {
                  if (!isAdmin) return
                  setPosParams(p => ({ ...p, [toggle.key]: val }))
                }}
              />
            </div>
          ))}
        </div>
      </div>

      {/* ── Save button ───────────────────────────────────────────────────── */}
      {isAdmin && (
        <div className="flex justify-end">
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-2 px-5 py-2.5 bg-teal-600 hover:bg-teal-700 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-semibold rounded-xl transition-colors shadow-sm"
          >
            {saving
              ? <><RefreshCw size={14} className="animate-spin" /> Saving…</>
              : <><Save size={14} /> Save Changes</>
            }
          </button>
        </div>
      )}
    </div>
  )
}

// ─── Main Settings page ───────────────────────────────────────────────────────
export default function Settings() {
  const { user } = useAuth()
  const isAdmin = user?.role === 'Admin'
  const [tab,     setTab]     = useState('store')
  const [items,   setItems]   = useState([])
  const [loading, setLoading] = useState(true)
  const [editId,  setEditId]  = useState(null)
  const [addMode, setAddMode] = useState(false)
  const [form,    setForm]    = useState({})
  const [saving,  setSaving]  = useState(false)

  useEffect(() => {
    if (tab === 'store') return
    loadTab()
  }, [tab])

  async function loadTab() {
    setLoading(true)
    setEditId(null)
    setAddMode(false)
    try { setItems(await API_MAP[tab].getAll()) } catch (_) {}
    setLoading(false)
  }

  function startAdd() {
    setAddMode(true)
    setEditId(null)
    setForm({})
  }

  function startEdit(item) {
    setEditId(item.id)
    setAddMode(false)
    setForm({ ...item })
  }

  async function handleSave() {
    setSaving(true)
    try {
      if (addMode) {
        const created = await API_MAP[tab].create(form)
        setItems(prev => [...prev, created])
      } else {
        const updated = await API_MAP[tab].update(editId, form)
        setItems(prev => prev.map(i => i.id === updated.id ? updated : i))
      }
      setAddMode(false)
      setEditId(null)
      setForm({})
    } catch (_) {}
    setSaving(false)
  }

  async function handleDelete(id) {
    if (!window.confirm('Delete this entry?')) return
    await API_MAP[tab].delete(id)
    setItems(prev => prev.filter(i => i.id !== id))
  }

  async function toggleActive(item) {
    const updated = await API_MAP[tab].update(item.id, { active: !item.active })
    setItems(prev => prev.map(i => i.id === updated.id ? updated : i))
  }

  const fields = FIELDS_MAP[tab]

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100">Settings</h2>
          <p className="text-sm text-gray-400 dark:text-gray-500 mt-0.5">Configure system-wide settings</p>
        </div>
      </div>

      {/* Tab bar */}
      <div className="flex gap-1 border-b border-gray-100 dark:border-gray-700 overflow-x-auto">
        {TABS.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={clsx('px-4 py-2.5 text-sm font-medium border-b-2 transition-colors whitespace-nowrap',
              tab === t.key
                ? 'border-teal-600 text-teal-600 dark:text-teal-400 dark:border-teal-400'
                : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
            )}
          >{t.label}</button>
        ))}
      </div>

      {/* ── Store tab ────────────────────────────────────────────────────── */}
      {tab === 'store' && <StoreTab isAdmin={isAdmin} />}

      {/* ── Generic list tabs ─────────────────────────────────────────────── */}
      {tab !== 'store' && (
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 dark:border-gray-700">
            <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">{TABS.find(t => t.key === tab)?.label}</p>
            {isAdmin && (
              <Button size="sm" icon={PlusCircle} onClick={startAdd}>Add New</Button>
            )}
          </div>

          {/* Inline add form */}
          {addMode && (
            <div className="px-5 py-4 bg-teal-50 dark:bg-teal-900/20 border-b border-teal-100 dark:border-teal-800/50">
              <div className="flex items-start gap-3 flex-wrap">
                {fields.map(f => (
                  <div key={f.key} className="flex-1 min-w-40">
                    {f.type === 'textarea' ? (
                      <textarea placeholder={f.label} value={form[f.key] || ''} onChange={e => setForm(prev => ({...prev, [f.key]: e.target.value}))} rows={2}
                        className="w-full text-sm border border-gray-200 dark:border-gray-600 rounded-lg px-3 py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 resize-none focus:outline-none focus:ring-2 focus:ring-teal-500"
                      />
                    ) : f.type === 'select' ? (
                      <select value={form[f.key] || ''} onChange={e => setForm(prev => ({...prev, [f.key]: e.target.value}))}
                        className="w-full text-sm border border-gray-200 dark:border-gray-600 rounded-lg px-3 py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-teal-500"
                      >
                        {f.options.map(o => <option key={o} value={o}>{o}</option>)}
                      </select>
                    ) : (
                      <input type="text" placeholder={f.label} value={form[f.key] || ''} onChange={e => setForm(prev => ({...prev, [f.key]: e.target.value}))}
                        className="w-full text-sm border border-gray-200 dark:border-gray-600 rounded-lg px-3 py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-teal-500"
                      />
                    )}
                  </div>
                ))}
                <div className="flex gap-1 pt-1">
                  <button onClick={handleSave} className="p-2 bg-teal-600 hover:bg-teal-700 text-white rounded-lg transition-colors"><Check size={14} /></button>
                  <button onClick={() => setAddMode(false)} className="p-2 bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 text-gray-500 hover:text-gray-700 rounded-lg transition-colors"><X size={14} /></button>
                </div>
              </div>
            </div>
          )}

          {loading ? (
            <div className="flex justify-center py-10"><div className="w-5 h-5 border-2 border-teal-500 border-t-transparent rounded-full animate-spin" /></div>
          ) : items.length === 0 ? (
            <div className="py-10 px-5 text-center">
              <EmptyState icon={Settings2} title="Nothing here yet" description="Add your first entry above" />
            </div>
          ) : (
            <table className="w-full text-sm">
              <tbody className="divide-y divide-gray-50 dark:divide-gray-700">
                {items.map(item => (
                  <tr key={item.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                    {editId === item.id ? (
                      <>
                        {fields.map(f => (
                          <td key={f.key} className="px-5 py-3">
                            {f.type === 'textarea' ? (
                              <textarea rows={2} value={form[f.key] || ''} onChange={e => setForm(prev => ({...prev, [f.key]: e.target.value}))}
                                className="w-full text-sm border border-gray-200 dark:border-gray-600 rounded-lg px-3 py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 resize-none focus:outline-none focus:ring-2 focus:ring-teal-500"
                              />
                            ) : f.type === 'select' ? (
                              <select value={form[f.key] || ''} onChange={e => setForm(prev => ({...prev, [f.key]: e.target.value}))}
                                className="w-full text-sm border border-gray-200 dark:border-gray-600 rounded-lg px-3 py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-teal-500"
                              >
                                {f.options.map(o => <option key={o} value={o}>{o}</option>)}
                              </select>
                            ) : (
                              <input type="text" value={form[f.key] || ''} onChange={e => setForm(prev => ({...prev, [f.key]: e.target.value}))}
                                className="w-full text-sm border border-gray-200 dark:border-gray-600 rounded-lg px-3 py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-teal-500"
                              />
                            )}
                          </td>
                        ))}
                        <td className="px-5 py-3">
                          <div className="flex gap-1 justify-end">
                            <button onClick={handleSave} className="p-1.5 bg-teal-600 text-white rounded-lg"><Check size={13} /></button>
                            <button onClick={() => setEditId(null)} className="p-1.5 border border-gray-200 dark:border-gray-600 text-gray-500 rounded-lg"><X size={13} /></button>
                          </div>
                        </td>
                      </>
                    ) : (
                      <>
                        {fields.map(f => (
                          <td key={f.key} className="px-5 py-3 text-gray-700 dark:text-gray-300">
                            {f.type === 'textarea' ? (
                              <span className="line-clamp-1 text-gray-500 dark:text-gray-400">{item[f.key]}</span>
                            ) : (
                              <span className={f.key === 'name' ? 'font-medium text-gray-900 dark:text-gray-100' : ''}>{item[f.key]}</span>
                            )}
                          </td>
                        ))}
                        <td className="px-5 py-3">
                          <div className="flex gap-1 justify-end items-center">
                            {'active' in item && (
                              <button onClick={() => toggleActive(item)}
                                className={clsx('relative inline-flex h-5 w-9 items-center rounded-full transition-colors', item.active ? 'bg-teal-600' : 'bg-gray-300 dark:bg-gray-600')}
                              >
                                <span className={clsx('inline-block h-3.5 w-3.5 rounded-full bg-white shadow transition-transform', item.active ? 'translate-x-4.5' : 'translate-x-0.5')} />
                              </button>
                            )}
                            {isAdmin && (
                              <>
                                <button onClick={() => startEdit(item)} className="p-1.5 text-gray-400 hover:text-teal-600 hover:bg-teal-50 dark:hover:bg-teal-900/30 rounded-lg transition-colors"><Pencil size={13} /></button>
                                <button onClick={() => handleDelete(item.id)} className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"><Trash2 size={13} /></button>
                              </>
                            )}
                          </div>
                        </td>
                      </>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  )
}
