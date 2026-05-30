import { useState, useEffect } from 'react'
import { PlusCircle, AlertTriangle, Plus, Trash2 } from 'lucide-react'
import clsx from 'clsx'
import { damageRecordsApi, menuApi } from '../services/api'
import Button from '../components/ui/Button'
import Modal from '../components/ui/Modal'
import Input from '../components/ui/Input'
import EmptyState from '../components/ui/EmptyState'
import DateRangeFilter from '../components/ui/DateRangeFilter'
import { formatCurrency, formatDate } from '../utils/formatters'
import { useAuth } from '../context/AuthContext'
import { useSettings } from '../context/SettingsContext'

export default function DamageRecords() {
  const { user } = useAuth()
  const { t } = useSettings()
  const isAdmin = user?.role === 'Admin'
  const [records, setRecords]     = useState([])
  const [loading, setLoading]     = useState(true)
  const [menuItems, setMenuItems] = useState([])
  const [dateRange, setDateRange] = useState(null)
  const [modalOpen, setModalOpen] = useState(false)
  const [saving, setSaving]       = useState(false)
  const [form, setForm]           = useState({ reason: '', notes: '', items: [] })
  const [detail, setDetail]       = useState(null)

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    try { setRecords(await damageRecordsApi.getAll()) } catch (_) {}
    setLoading(false)
  }

  async function openCreate() {
    if (!menuItems.length) { const m = await menuApi.getAll(); setMenuItems(m) }
    setForm({ reason: '', notes: '', items: [] })
    setModalOpen(true)
  }

  function addLine() { setForm(f => ({ ...f, items: [...f.items, { menuItemId: '', itemName: '', quantity: 1, unitCost: 0 }] })) }
  function removeLine(i) { setForm(f => ({ ...f, items: f.items.filter((_, idx) => idx !== i) })) }
  function updateLine(i, field, val) { setForm(f => { const items = [...f.items]; items[i] = { ...items[i], [field]: val }; return { ...f, items } }) }
  function selectMenuItem(i, menuItemId) {
    const m = menuItems.find(m => String(m.id) === String(menuItemId))
    if (m) {
      updateLine(i, 'menuItemId', menuItemId)
      updateLine(i, 'itemName', m.name)
      updateLine(i, 'unitCost', m.costPrice || 0)
    }
  }

  async function handleCreate() {
    if (!form.items.length) return
    setSaving(true)
    try {
      const created = await damageRecordsApi.create(form)
      setRecords(prev => [created, ...prev])
      setModalOpen(false)
    } catch (_) {}
    setSaving(false)
  }

  async function handleDelete(id) {
    if (!window.confirm('Delete this damage record?')) return
    await damageRecordsApi.delete(id)
    setRecords(prev => prev.filter(r => r.id !== id))
    if (detail?.id === id) setDetail(null)
  }

  const display = dateRange
    ? records.filter(r => { const d = r.createdAt?.slice(0, 10); return d >= dateRange.from && d <= dateRange.to })
    : records

  const totalValue = display.reduce((s, r) => s + r.totalValue, 0)

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100">{t('damage.title')}</h2>
          <p className="text-sm text-gray-400 dark:text-gray-500 mt-0.5">{t('damage.subtitle')}</p>
        </div>
        <div className="flex gap-2">
          <DateRangeFilter value={dateRange} onChange={setDateRange} />
          <Button icon={PlusCircle} onClick={openCreate}>{t('damage.record')}</Button>
        </div>
      </div>

      {/* Summary card */}
      <div className="bg-red-50 dark:bg-red-900/20 border border-red-100 dark:border-red-800/50 rounded-xl px-5 py-4">
        <p className="text-xs font-medium text-red-600 dark:text-red-400 uppercase tracking-wider">{t('damage.totalValue')}</p>
        <p className="text-2xl font-bold text-red-700 dark:text-red-300 mt-1">{formatCurrency(totalValue)}</p>
        <p className="text-xs text-red-500 dark:text-red-400/70 mt-0.5">
          {display.length} {t('damage.records')}{dateRange ? ` ${t('damage.inPeriod')}` : ` ${t('damage.total')}`}
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <div className="lg:col-span-1 space-y-2">
          {loading ? (
            <div className="flex justify-center py-10"><div className="w-5 h-5 border-2 border-teal-500 border-t-transparent rounded-full animate-spin" /></div>
          ) : display.length === 0 ? (
            <EmptyState icon={AlertTriangle} title={t('damage.noRecords')} description={t('damage.noRecordsDesc')} />
          ) : display.map(r => (
            <div key={r.id} onClick={async () => { const d = await damageRecordsApi.getOne(r.id); setDetail(d) }}
              className={clsx('p-4 rounded-xl border cursor-pointer transition-all',
                detail?.id === r.id
                  ? 'border-red-300 dark:border-red-700 bg-red-50 dark:bg-red-900/20'
                  : 'border-gray-100 dark:border-gray-700 bg-white dark:bg-gray-800 hover:border-gray-200 dark:hover:border-gray-600'
              )}
            >
              <div className="flex items-start justify-between">
                <div>
                  <p className="font-semibold text-gray-900 dark:text-gray-100">{r.id}</p>
                  <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">{r.reason || t('damage.noReason')}</p>
                  <p className="text-xs text-gray-400 dark:text-gray-500">{formatDate(r.createdAt)} · {r.recordedBy}</p>
                </div>
                <p className="text-sm font-bold text-red-600 dark:text-red-400">{formatCurrency(r.totalValue)}</p>
              </div>
            </div>
          ))}
        </div>

        <div className="lg:col-span-2">
          {!detail ? (
            <div className="flex items-center justify-center h-48 text-sm text-gray-400">{t('damage.selectRecord')}</div>
          ) : (
            <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 overflow-hidden">
              <div className="px-5 py-4 border-b border-gray-100 dark:border-gray-700 flex items-center justify-between">
                <div>
                  <p className="font-bold text-gray-900 dark:text-gray-100">{detail.id}</p>
                  <p className="text-xs text-gray-400 dark:text-gray-500">{formatDate(detail.createdAt)} · {detail.recordedBy}</p>
                  {detail.reason && <p className="text-xs text-red-500 dark:text-red-400 mt-1">{detail.reason}</p>}
                </div>
                {isAdmin && (
                  <Button size="sm" variant="danger" icon={Trash2} onClick={() => handleDelete(detail.id)}>{t('common.delete')}</Button>
                )}
              </div>
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-xs text-gray-500 dark:text-gray-400 uppercase border-b border-gray-100 dark:border-gray-700">
                    <th className="px-5 py-3 text-left">{t('damage.col.item')}</th>
                    <th className="px-5 py-3 text-right">{t('damage.col.qty')}</th>
                    <th className="px-5 py-3 text-right">{t('damage.col.unitCost')}</th>
                    <th className="px-5 py-3 text-right">{t('damage.col.loss')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50 dark:divide-gray-700">
                  {(detail.items || []).map(i => (
                    <tr key={i.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                      <td className="px-5 py-3 text-gray-900 dark:text-gray-100">{i.itemName}</td>
                      <td className="px-5 py-3 text-right text-gray-700 dark:text-gray-300">{i.quantity}</td>
                      <td className="px-5 py-3 text-right text-gray-700 dark:text-gray-300">{formatCurrency(i.unitCost)}</td>
                      <td className="px-5 py-3 text-right font-semibold text-red-600 dark:text-red-400">{formatCurrency(i.lineTotal)}</td>
                    </tr>
                  ))}
                  <tr className="bg-red-50/50 dark:bg-red-900/10">
                    <td colSpan={3} className="px-5 py-3 text-right font-semibold text-gray-900 dark:text-gray-100">{t('damage.totalLoss')}</td>
                    <td className="px-5 py-3 text-right font-bold text-red-600 dark:text-red-400">{formatCurrency(detail.totalValue)}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      <Modal isOpen={modalOpen} onClose={() => setModalOpen(false)} title={t('damage.recordModal')} size="lg"
        footer={<><Button variant="secondary" onClick={() => setModalOpen(false)}>{t('common.cancel')}</Button><Button loading={saving} onClick={handleCreate}>{t('damage.saveRecord')}</Button></>}
      >
        <div className="space-y-4">
          <Input label={t('damage.reason')} value={form.reason} onChange={e => setForm(f => ({...f, reason: e.target.value}))} placeholder="e.g. Expired, Spilled, Broken" />
          <div>
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm font-medium text-gray-700 dark:text-gray-300">{t('damage.damagedItems')}</p>
              <button onClick={addLine} className="text-xs text-teal-600 dark:text-teal-400 hover:underline flex items-center gap-1"><Plus size={12} /> {t('damage.addItem')}</button>
            </div>
            {form.items.map((line, i) => (
              <div key={i} className="grid grid-cols-12 gap-2 items-end mb-2">
                <div className="col-span-5">
                  <select value={line.menuItemId} onChange={e => selectMenuItem(i, e.target.value)}
                    className="w-full text-sm border border-gray-200 dark:border-gray-600 rounded-lg px-3 py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-teal-500"
                  >
                    <option value="">{t('common.selectItem')}</option>
                    {menuItems.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                  </select>
                </div>
                <div className="col-span-2"><input type="number" min={1} placeholder="Qty" value={line.quantity} onChange={e => updateLine(i, 'quantity', parseInt(e.target.value))} className="w-full text-sm border border-gray-200 dark:border-gray-600 rounded-lg px-3 py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100" /></div>
                <div className="col-span-3"><input type="number" min={0} step="0.01" placeholder="Unit cost" value={line.unitCost} onChange={e => updateLine(i, 'unitCost', parseFloat(e.target.value))} className="w-full text-sm border border-gray-200 dark:border-gray-600 rounded-lg px-3 py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100" /></div>
                <div className="col-span-2 flex justify-end"><button onClick={() => removeLine(i)} className="p-1.5 text-gray-400 hover:text-red-500 rounded transition-colors"><Trash2 size={14} /></button></div>
              </div>
            ))}
            {form.items.length === 0 && <p className="text-sm text-gray-400 text-center py-3">{t('damage.noItems')}</p>}
          </div>
        </div>
      </Modal>
    </div>
  )
}
