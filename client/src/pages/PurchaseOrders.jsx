import { useState, useEffect } from 'react'
import { PlusCircle, ShoppingBag, Plus, Trash2, Printer } from 'lucide-react'
import clsx from 'clsx'
import { purchaseOrdersApi, suppliersApi, menuApi } from '../services/api'
import ReceiptModal from '../components/ReceiptModal'
import Button from '../components/ui/Button'
import Modal from '../components/ui/Modal'
import Input from '../components/ui/Input'
import Badge from '../components/ui/Badge'
import EmptyState from '../components/ui/EmptyState'
import DateRangeFilter from '../components/ui/DateRangeFilter'
import { formatCurrency, formatDate } from '../utils/formatters'
import { useAuth } from '../context/AuthContext'
import { useSettings } from '../context/SettingsContext'

const STATUS_VARIANT = { draft: 'default', ordered: 'amber', received: 'green', cancelled: 'red' }

export default function PurchaseOrders() {
  const { user } = useAuth()
  const { t } = useSettings()
  const isAdmin = user?.role === 'Admin'
  const [orders, setOrders]         = useState([])
  const [loading, setLoading]       = useState(true)
  const [suppliers, setSuppliers]   = useState([])
  const [menuItems, setMenuItems]   = useState([])
  const [statusFilter, setStatus]   = useState('')
  const [dateRange, setDateRange]   = useState(null)
  const [modalOpen, setModalOpen]   = useState(false)
  const [saving, setSaving]         = useState(false)
  const [form, setForm]             = useState({ supplierId: '', referenceNo: '', expectedAt: '', notes: '', items: [] })
  const [detail, setDetail]         = useState(null)
  const [printId, setPrintId]       = useState(null)

  const STATUS_TABS = [
    { key: '',           label: t('po.status.all')       },
    { key: 'draft',      label: t('po.status.draft')     },
    { key: 'ordered',    label: t('po.status.ordered')   },
    { key: 'received',   label: t('po.status.received')  },
    { key: 'cancelled',  label: t('po.status.cancelled') },
  ]

  useEffect(() => { load() }, [statusFilter])

  async function load() {
    setLoading(true)
    try {
      const params = {}
      if (statusFilter) params.status = statusFilter
      setOrders(await purchaseOrdersApi.getAll(params))
    } catch (_) {}
    setLoading(false)
  }

  async function openCreate() {
    if (!suppliers.length) { const s = await suppliersApi.getAll(); setSuppliers(s) }
    if (!menuItems.length) { const m = await menuApi.getAll(); setMenuItems(m) }
    setForm({ supplierId: '', referenceNo: '', expectedAt: '', notes: '', items: [] })
    setModalOpen(true)
  }

  function addLine() { setForm(f => ({ ...f, items: [...f.items, { menuItemId: '', itemName: '', quantityOrdered: 1, unitCost: 0 }] })) }
  function removeLine(i) { setForm(f => ({ ...f, items: f.items.filter((_, idx) => idx !== i) })) }
  function updateLine(i, field, val) { setForm(f => { const items = [...f.items]; items[i] = { ...items[i], [field]: val }; return { ...f, items } }) }

  async function handleCreate() {
    setSaving(true)
    try {
      const created = await purchaseOrdersApi.create(form)
      setOrders(prev => [created, ...prev])
      setModalOpen(false)
    } catch (_) {}
    setSaving(false)
  }

  async function updateStatus(id, status) {
    await purchaseOrdersApi.updateStatus(id, status)
    await load()
    if (detail?.id === id) {
      const d = await purchaseOrdersApi.getOne(id)
      setDetail(d)
    }
  }

  const displayOrders = dateRange
    ? orders.filter(o => {
        const d = o.createdAt?.slice(0, 10)
        return d >= dateRange.from && d <= dateRange.to
      })
    : orders

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100">{t('po.title')}</h2>
          <p className="text-sm text-gray-400 dark:text-gray-500 mt-0.5">{t('po.subtitle')}</p>
        </div>
        <div className="flex items-center gap-2">
          <DateRangeFilter value={dateRange} onChange={setDateRange} />
          {isAdmin && <Button icon={PlusCircle} onClick={openCreate}>{t('po.new')}</Button>}
        </div>
      </div>

      {/* Status tabs */}
      <div className="flex gap-1">
        {STATUS_TABS.map(tab => (
          <button key={tab.key} onClick={() => setStatus(tab.key)}
            className={clsx('px-3 py-1.5 rounded-lg text-sm font-medium transition-colors',
              statusFilter === tab.key
                ? 'bg-teal-600 text-white'
                : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-400 border border-gray-200 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700'
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* List */}
        <div className="lg:col-span-1 space-y-2">
          {loading ? (
            <div className="flex justify-center py-10"><div className="w-5 h-5 border-2 border-teal-500 border-t-transparent rounded-full animate-spin" /></div>
          ) : displayOrders.length === 0 ? (
            <EmptyState icon={ShoppingBag} title={t('po.noOrders')} description={t('po.noOrdersDesc')} />
          ) : displayOrders.map(o => (
            <div key={o.id} onClick={async () => { const d = await purchaseOrdersApi.getOne(o.id); setDetail(d) }}
              className={clsx('p-4 rounded-xl border cursor-pointer transition-all',
                detail?.id === o.id
                  ? 'border-teal-300 dark:border-teal-700 bg-teal-50 dark:bg-teal-900/20'
                  : 'border-gray-100 dark:border-gray-700 bg-white dark:bg-gray-800 hover:border-gray-200 dark:hover:border-gray-600'
              )}
            >
              <div className="flex items-start justify-between">
                <div>
                  <p className="font-semibold text-gray-900 dark:text-gray-100">{o.id}</p>
                  <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">{o.supplierName || t('po.noSupplier')}</p>
                  <p className="text-xs text-gray-400 dark:text-gray-500">{formatDate(o.createdAt)}</p>
                </div>
                <div className="text-right">
                  <Badge variant={STATUS_VARIANT[o.status]}>{o.status}</Badge>
                  <p className="text-sm font-bold text-gray-900 dark:text-gray-100 mt-1">{formatCurrency(o.total)}</p>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Detail */}
        <div className="lg:col-span-2">
          {!detail ? (
            <div className="flex items-center justify-center h-48 text-sm text-gray-400">{t('po.selectOrder')}</div>
          ) : (
            <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 overflow-hidden">
              <div className="px-5 py-4 border-b border-gray-100 dark:border-gray-700 flex items-center justify-between flex-wrap gap-2">
                <div>
                  <p className="font-bold text-gray-900 dark:text-gray-100">{detail.id}</p>
                  <p className="text-xs text-gray-400 dark:text-gray-500">{detail.supplierName} · {formatDate(detail.createdAt)}</p>
                </div>
                <div className="flex gap-2 items-center">
                  {isAdmin && detail.status === 'draft' && (
                    <Button size="sm" onClick={() => updateStatus(detail.id, 'ordered')}>{t('po.markOrdered')}</Button>
                  )}
                  {isAdmin && detail.status === 'ordered' && (
                    <Button size="sm" onClick={() => updateStatus(detail.id, 'received')}>{t('po.markReceived')}</Button>
                  )}
                  {isAdmin && detail.status === 'draft' && (
                    <Button size="sm" variant="danger" onClick={() => updateStatus(detail.id, 'cancelled')}>{t('common.cancel')}</Button>
                  )}
                  <button
                    onClick={() => setPrintId(detail._id || detail.id)}
                    className="p-1.5 text-gray-400 hover:text-teal-600 hover:bg-teal-50 dark:hover:bg-teal-900/20 rounded-lg transition-colors"
                    title="Print purchase order"
                  >
                    <Printer size={16} />
                  </button>
                </div>
              </div>
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-xs text-gray-500 dark:text-gray-400 uppercase border-b border-gray-100 dark:border-gray-700">
                    <th className="px-5 py-3 text-left">{t('po.col.item')}</th>
                    <th className="px-5 py-3 text-right">{t('po.col.ordered')}</th>
                    <th className="px-5 py-3 text-right">{t('po.col.received')}</th>
                    <th className="px-5 py-3 text-right">{t('po.col.unitCost')}</th>
                    <th className="px-5 py-3 text-right">{t('po.col.total')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50 dark:divide-gray-700">
                  {(detail.items || []).map(i => (
                    <tr key={i.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                      <td className="px-5 py-3 text-gray-900 dark:text-gray-100">{i.itemName}</td>
                      <td className="px-5 py-3 text-right text-gray-700 dark:text-gray-300">{i.quantityOrdered}</td>
                      <td className="px-5 py-3 text-right text-gray-700 dark:text-gray-300">{i.quantityReceived}</td>
                      <td className="px-5 py-3 text-right text-gray-700 dark:text-gray-300">{formatCurrency(i.unitCost)}</td>
                      <td className="px-5 py-3 text-right font-semibold text-gray-900 dark:text-gray-100">{formatCurrency(i.lineTotal)}</td>
                    </tr>
                  ))}
                  <tr className="bg-gray-50 dark:bg-gray-700/30">
                    <td colSpan={4} className="px-5 py-3 text-right font-semibold text-gray-900 dark:text-gray-100">{t('common.total')}</td>
                    <td className="px-5 py-3 text-right font-bold text-teal-600 dark:text-teal-400">{formatCurrency(detail.total)}</td>
                  </tr>
                </tbody>
              </table>
              {detail.notes && (
                <div className="px-5 py-3 text-sm text-gray-500 dark:text-gray-400 border-t border-gray-100 dark:border-gray-700">
                  <span className="font-medium">{t('po.notes')}:</span> {detail.notes}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Create Modal */}
      <Modal isOpen={modalOpen} onClose={() => setModalOpen(false)} title={t('po.newModal')} size="lg"
        footer={<><Button variant="secondary" onClick={() => setModalOpen(false)}>{t('common.cancel')}</Button><Button loading={saving} onClick={handleCreate}>{t('po.createOrder')}</Button></>}
      >
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300 block mb-1">{t('po.supplier')}</label>
              <select value={form.supplierId} onChange={e => setForm(f => ({...f, supplierId: e.target.value}))}
                className="w-full text-sm border border-gray-200 dark:border-gray-600 rounded-lg px-3 py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-teal-500"
              >
                <option value="">{t('po.noSupplier')}</option>
                {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
            <Input label={t('po.referenceNo')} value={form.referenceNo} onChange={e => setForm(f => ({...f, referenceNo: e.target.value}))} placeholder="PO-2025-001" />
          </div>
          <Input label={t('po.expectedDate')} type="date" value={form.expectedAt} onChange={e => setForm(f => ({...f, expectedAt: e.target.value}))} />

          <div>
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm font-medium text-gray-700 dark:text-gray-300">{t('po.items')}</p>
              <button onClick={addLine} className="text-xs text-teal-600 dark:text-teal-400 hover:underline flex items-center gap-1">
                <Plus size={12} /> {t('po.addLine')}
              </button>
            </div>
            <div className="space-y-2">
              {form.items.map((line, i) => (
                <div key={i} className="grid grid-cols-12 gap-2 items-end">
                  <div className="col-span-5">
                    <input placeholder="Item name" value={line.itemName}
                      onChange={e => updateLine(i, 'itemName', e.target.value)}
                      className="w-full text-sm border border-gray-200 dark:border-gray-600 rounded-lg px-3 py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                    />
                  </div>
                  <div className="col-span-2">
                    <input type="number" min={1} placeholder="Qty" value={line.quantityOrdered}
                      onChange={e => updateLine(i, 'quantityOrdered', parseInt(e.target.value))}
                      className="w-full text-sm border border-gray-200 dark:border-gray-600 rounded-lg px-3 py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                    />
                  </div>
                  <div className="col-span-3">
                    <input type="number" min={0} step="0.01" placeholder="Unit cost" value={line.unitCost}
                      onChange={e => updateLine(i, 'unitCost', parseFloat(e.target.value))}
                      className="w-full text-sm border border-gray-200 dark:border-gray-600 rounded-lg px-3 py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                    />
                  </div>
                  <div className="col-span-2 flex justify-end">
                    <button onClick={() => removeLine(i)} className="p-1.5 text-gray-400 hover:text-red-500 rounded transition-colors"><Trash2 size={14} /></button>
                  </div>
                </div>
              ))}
              {form.items.length === 0 && <p className="text-sm text-gray-400 text-center py-3">{t('po.noItems')}</p>}
            </div>
          </div>
        </div>
      </Modal>

      {/* Print Modal */}
      {printId && (
        <ReceiptModal
          entityId={printId}
          type="purchase"
          onClose={() => setPrintId(null)}
        />
      )}
    </div>
  )
}
