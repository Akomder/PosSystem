import { useState, useEffect } from 'react'
import { PlusCircle, RotateCcw, Plus, Trash2 } from 'lucide-react'
import clsx from 'clsx'
import { purchaseReturnsApi, suppliersApi } from '../services/api'
import Button from '../components/ui/Button'
import Modal from '../components/ui/Modal'
import Input from '../components/ui/Input'
import Badge from '../components/ui/Badge'
import EmptyState from '../components/ui/EmptyState'
import DateRangeFilter from '../components/ui/DateRangeFilter'
import { formatCurrency, formatDate } from '../utils/formatters'
import { useAuth } from '../context/AuthContext'

const STATUS_VARIANT = { pending: 'amber', approved: 'teal', completed: 'green' }

export default function PurchaseReturns() {
  const { user } = useAuth()
  const isAdmin = user?.role === 'Admin'
  const [returns, setReturns]     = useState([])
  const [loading, setLoading]     = useState(true)
  const [suppliers, setSuppliers] = useState([])
  const [dateRange, setDateRange] = useState(null)
  const [modalOpen, setModalOpen] = useState(false)
  const [saving, setSaving]       = useState(false)
  const [form, setForm]           = useState({ supplierId: '', referenceNo: '', reason: '', items: [] })
  const [detail, setDetail]       = useState(null)

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    try { setReturns(await purchaseReturnsApi.getAll()) } catch (_) {}
    setLoading(false)
  }

  async function openCreate() {
    if (!suppliers.length) { const s = await suppliersApi.getAll(); setSuppliers(s) }
    setForm({ supplierId: '', referenceNo: '', reason: '', items: [] })
    setModalOpen(true)
  }

  function addLine() { setForm(f => ({ ...f, items: [...f.items, { itemName: '', quantity: 1, unitCost: 0 }] })) }
  function removeLine(i) { setForm(f => ({ ...f, items: f.items.filter((_, idx) => idx !== i) })) }
  function updateLine(i, field, val) { setForm(f => { const items = [...f.items]; items[i] = { ...items[i], [field]: val }; return { ...f, items } }) }

  async function handleCreate() {
    setSaving(true)
    try {
      const created = await purchaseReturnsApi.create(form)
      setReturns(prev => [created, ...prev])
      setModalOpen(false)
    } catch (_) {}
    setSaving(false)
  }

  async function updateStatus(id, status) {
    await purchaseReturnsApi.updateStatus(id, status)
    await load()
  }

  const display = dateRange
    ? returns.filter(r => { const d = r.createdAt?.slice(0, 10); return d >= dateRange.from && d <= dateRange.to })
    : returns

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100">Purchase Returns</h2>
          <p className="text-sm text-gray-400 dark:text-gray-500 mt-0.5">Returns sent back to suppliers</p>
        </div>
        <div className="flex gap-2">
          <DateRangeFilter value={dateRange} onChange={setDateRange} />
          {isAdmin && <Button icon={PlusCircle} onClick={openCreate}>New Return</Button>}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <div className="lg:col-span-1 space-y-2">
          {loading ? (
            <div className="flex justify-center py-10"><div className="w-5 h-5 border-2 border-teal-500 border-t-transparent rounded-full animate-spin" /></div>
          ) : display.length === 0 ? (
            <EmptyState icon={RotateCcw} title="No purchase returns" description="Record returns sent back to suppliers" />
          ) : display.map(r => (
            <div key={r.id} onClick={async () => { const d = await purchaseReturnsApi.getOne(r.id); setDetail(d) }}
              className={clsx('p-4 rounded-xl border cursor-pointer transition-all',
                detail?.id === r.id
                  ? 'border-teal-300 dark:border-teal-700 bg-teal-50 dark:bg-teal-900/20'
                  : 'border-gray-100 dark:border-gray-700 bg-white dark:bg-gray-800 hover:border-gray-200 dark:hover:border-gray-600'
              )}
            >
              <div className="flex items-start justify-between">
                <div>
                  <p className="font-semibold text-gray-900 dark:text-gray-100">{r.id}</p>
                  <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">{r.supplierName || 'No supplier'}</p>
                  <p className="text-xs text-gray-400 dark:text-gray-500">{formatDate(r.createdAt)}</p>
                </div>
                <div className="text-right">
                  <Badge variant={STATUS_VARIANT[r.status]}>{r.status}</Badge>
                  <p className="text-sm font-bold text-gray-900 dark:text-gray-100 mt-1">{formatCurrency(r.total)}</p>
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="lg:col-span-2">
          {!detail ? (
            <div className="flex items-center justify-center h-48 text-sm text-gray-400">Select a return to view details</div>
          ) : (
            <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 overflow-hidden">
              <div className="px-5 py-4 border-b border-gray-100 dark:border-gray-700 flex items-center justify-between flex-wrap gap-2">
                <div>
                  <p className="font-bold text-gray-900 dark:text-gray-100">{detail.id}</p>
                  <p className="text-xs text-gray-400 dark:text-gray-500">{detail.supplierName} · {formatDate(detail.createdAt)}</p>
                  {detail.reason && <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{detail.reason}</p>}
                </div>
                {isAdmin && detail.status === 'pending' && (
                  <div className="flex gap-2">
                    <Button size="sm" onClick={() => updateStatus(detail.id, 'approved')}>Approve</Button>
                    <Button size="sm" onClick={() => updateStatus(detail.id, 'completed')}>Complete</Button>
                  </div>
                )}
              </div>
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-xs text-gray-500 dark:text-gray-400 uppercase border-b border-gray-100 dark:border-gray-700">
                    <th className="px-5 py-3 text-left">Item</th>
                    <th className="px-5 py-3 text-right">Qty</th>
                    <th className="px-5 py-3 text-right">Unit Cost</th>
                    <th className="px-5 py-3 text-right">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50 dark:divide-gray-700">
                  {(detail.items || []).map(i => (
                    <tr key={i.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                      <td className="px-5 py-3 text-gray-900 dark:text-gray-100">{i.itemName}</td>
                      <td className="px-5 py-3 text-right text-gray-700 dark:text-gray-300">{i.quantity}</td>
                      <td className="px-5 py-3 text-right text-gray-700 dark:text-gray-300">{formatCurrency(i.unitCost)}</td>
                      <td className="px-5 py-3 text-right font-semibold text-gray-900 dark:text-gray-100">{formatCurrency(i.lineTotal)}</td>
                    </tr>
                  ))}
                  <tr className="bg-gray-50 dark:bg-gray-700/30">
                    <td colSpan={3} className="px-5 py-3 text-right font-semibold text-gray-900 dark:text-gray-100">Total</td>
                    <td className="px-5 py-3 text-right font-bold text-teal-600 dark:text-teal-400">{formatCurrency(detail.total)}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      <Modal isOpen={modalOpen} onClose={() => setModalOpen(false)} title="New Purchase Return" size="lg"
        footer={<><Button variant="secondary" onClick={() => setModalOpen(false)}>Cancel</Button><Button loading={saving} onClick={handleCreate}>Create Return</Button></>}
      >
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300 block mb-1">Supplier</label>
              <select value={form.supplierId} onChange={e => setForm(f => ({...f, supplierId: e.target.value}))}
                className="w-full text-sm border border-gray-200 dark:border-gray-600 rounded-lg px-3 py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-teal-500"
              >
                <option value="">No supplier</option>
                {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
            <Input label="Reference No." value={form.referenceNo} onChange={e => setForm(f => ({...f, referenceNo: e.target.value}))} />
          </div>
          <Input label="Reason" value={form.reason} onChange={e => setForm(f => ({...f, reason: e.target.value}))} placeholder="e.g. Damaged goods" />
          <div>
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm font-medium text-gray-700 dark:text-gray-300">Items</p>
              <button onClick={addLine} className="text-xs text-teal-600 dark:text-teal-400 hover:underline flex items-center gap-1"><Plus size={12} /> Add line</button>
            </div>
            {form.items.map((line, i) => (
              <div key={i} className="grid grid-cols-12 gap-2 items-end mb-2">
                <div className="col-span-5"><input placeholder="Item name" value={line.itemName} onChange={e => updateLine(i, 'itemName', e.target.value)} className="w-full text-sm border border-gray-200 dark:border-gray-600 rounded-lg px-3 py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100" /></div>
                <div className="col-span-2"><input type="number" min={1} placeholder="Qty" value={line.quantity} onChange={e => updateLine(i, 'quantity', parseInt(e.target.value))} className="w-full text-sm border border-gray-200 dark:border-gray-600 rounded-lg px-3 py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100" /></div>
                <div className="col-span-3"><input type="number" min={0} step="0.01" placeholder="Unit cost" value={line.unitCost} onChange={e => updateLine(i, 'unitCost', parseFloat(e.target.value))} className="w-full text-sm border border-gray-200 dark:border-gray-600 rounded-lg px-3 py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100" /></div>
                <div className="col-span-2 flex justify-end"><button onClick={() => removeLine(i)} className="p-1.5 text-gray-400 hover:text-red-500 rounded transition-colors"><Trash2 size={14} /></button></div>
              </div>
            ))}
            {form.items.length === 0 && <p className="text-sm text-gray-400 text-center py-3">No items added</p>}
          </div>
        </div>
      </Modal>
    </div>
  )
}
