import { useState, useEffect } from 'react'
import { PlusCircle, PackageSearch, CheckCircle2, ChevronDown, ChevronUp, Trash2 } from 'lucide-react'
import clsx from 'clsx'
import { stockTakesApi } from '../services/api'
import Button from '../components/ui/Button'
import Modal from '../components/ui/Modal'
import Input from '../components/ui/Input'
import Badge from '../components/ui/Badge'
import EmptyState from '../components/ui/EmptyState'
import { formatDate } from '../utils/formatters'
import { useAuth } from '../context/AuthContext'

const STATUS_VARIANT = { draft: 'default', in_progress: 'amber', completed: 'green' }

export default function StockTakes() {
  const { user } = useAuth()
  const isAdmin = user?.role === 'Admin'
  const [items, setItems]           = useState([])
  const [loading, setLoading]       = useState(true)
  const [createOpen, setCreateOpen] = useState(false)
  const [form, setForm]             = useState({ name: '', notes: '' })
  const [saving, setSaving]         = useState(false)
  const [expanded, setExpanded]     = useState(null)
  const [detail, setDetail]         = useState({})

  useEffect(() => {
    load()
  }, [])

  async function load() {
    setLoading(true)
    try { setItems(await stockTakesApi.getAll()) } catch (_) {}
    setLoading(false)
  }

  async function handleCreate() {
    if (!form.name.trim()) return
    setSaving(true)
    try {
      const created = await stockTakesApi.create(form)
      setItems(prev => [created, ...prev])
      setCreateOpen(false)
      setForm({ name: '', notes: '' })
    } catch (_) {}
    setSaving(false)
  }

  async function loadDetail(id) {
    if (detail[id]) { setExpanded(expanded === id ? null : id); return }
    const d = await stockTakesApi.getOne(id)
    setDetail(prev => ({ ...prev, [id]: d }))
    setExpanded(id)
  }

  async function updateQty(stockTakeId, itemId, actualQty) {
    await stockTakesApi.updateItem(stockTakeId, itemId, { actualQty })
    const d = await stockTakesApi.getOne(stockTakeId)
    setDetail(prev => ({ ...prev, [stockTakeId]: d }))
  }

  async function complete(id) {
    await stockTakesApi.complete(id)
    await load()
    setDetail(prev => { const n = {...prev}; delete n[id]; return n })
    setExpanded(null)
  }

  async function remove(id) {
    if (!window.confirm('Delete this stock take?')) return
    await stockTakesApi.delete(id)
    setItems(prev => prev.filter(i => i.id !== id))
    if (expanded === id) setExpanded(null)
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100">Stock Takes</h2>
          <p className="text-sm text-gray-400 dark:text-gray-500 mt-0.5">Inventory count reconciliation</p>
        </div>
        {isAdmin && (
          <Button icon={PlusCircle} onClick={() => setCreateOpen(true)}>New Stock Take</Button>
        )}
      </div>

      {loading ? (
        <div className="flex justify-center py-16 text-gray-400">
          <div className="w-5 h-5 border-2 border-teal-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : items.length === 0 ? (
        <EmptyState icon={PackageSearch} title="No stock takes" description="Create a stock take to count your inventory" />
      ) : (
        <div className="space-y-2">
          {items.map(item => (
            <div key={item.id} className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700">
              <button
                className="w-full flex items-center justify-between px-5 py-4 text-left"
                onClick={() => loadDetail(item.id)}
              >
                <div className="flex items-center gap-4">
                  <div>
                    <p className="font-semibold text-gray-900 dark:text-gray-100">{item.name}</p>
                    <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">
                      {item.id} · {formatDate(item.createdAt)} · {item.conductedBy}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <Badge variant={STATUS_VARIANT[item.status]}>{item.status.replace('_', ' ')}</Badge>
                  {expanded === item.id ? <ChevronUp size={16} className="text-gray-400" /> : <ChevronDown size={16} className="text-gray-400" />}
                </div>
              </button>

              {expanded === item.id && detail[item.id] && (
                <div className="border-t border-gray-100 dark:border-gray-700 px-5 pb-5">
                  <div className="overflow-x-auto mt-4">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="text-xs text-gray-500 dark:text-gray-400 uppercase border-b border-gray-100 dark:border-gray-700">
                          <th className="pb-2 text-left">Item</th>
                          <th className="pb-2 text-right">Expected</th>
                          <th className="pb-2 text-right w-28">Actual</th>
                          <th className="pb-2 text-right">Variance</th>
                          <th className="pb-2 text-right">Value diff</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-50 dark:divide-gray-700">
                        {(detail[item.id].items || []).map(si => (
                          <tr key={si.id}>
                            <td className="py-2 text-gray-900 dark:text-gray-100">{si.itemName}</td>
                            <td className="py-2 text-right text-gray-500 dark:text-gray-400">{si.expectedQty}</td>
                            <td className="py-2 text-right">
                              {item.status !== 'completed' ? (
                                <input
                                  type="number"
                                  min={0}
                                  defaultValue={si.actualQty}
                                  onBlur={e => updateQty(item.id, si.id, parseInt(e.target.value))}
                                  className="w-20 text-sm text-right border border-gray-200 dark:border-gray-600 rounded-lg px-2 py-1 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                                />
                              ) : si.actualQty}
                            </td>
                            <td className={clsx('py-2 text-right font-medium',
                              si.variance > 0 ? 'text-green-600 dark:text-green-400' :
                              si.variance < 0 ? 'text-red-500 dark:text-red-400' : 'text-gray-400'
                            )}>
                              {si.variance > 0 ? '+' : ''}{si.variance}
                            </td>
                            <td className={clsx('py-2 text-right text-xs',
                              si.varianceValue > 0 ? 'text-green-600 dark:text-green-400' :
                              si.varianceValue < 0 ? 'text-red-500 dark:text-red-400' : 'text-gray-400'
                            )}>
                              {si.varianceValue > 0 ? '+' : ''}{si.varianceValue.toFixed(2)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  {isAdmin && item.status === 'in_progress' && (
                    <div className="flex gap-2 mt-4 justify-end">
                      <Button variant="danger" size="sm" icon={Trash2} onClick={() => remove(item.id)}>Delete</Button>
                      <Button size="sm" icon={CheckCircle2} onClick={() => complete(item.id)}>Complete Stock Take</Button>
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      <Modal isOpen={createOpen} onClose={() => setCreateOpen(false)} title="New Stock Take"
        footer={<><Button variant="secondary" onClick={() => setCreateOpen(false)}>Cancel</Button><Button loading={saving} onClick={handleCreate}>Create</Button></>}
      >
        <div className="space-y-4">
          <Input label="Name" required value={form.name} onChange={e => setForm(f => ({...f, name: e.target.value}))} placeholder="e.g. Weekly Count - Apr 2025" />
          <div>
            <label className="text-sm font-medium text-gray-700 dark:text-gray-300 block mb-1">Notes</label>
            <textarea rows={2} value={form.notes} onChange={e => setForm(f => ({...f, notes: e.target.value}))}
              className="w-full text-sm border border-gray-200 dark:border-gray-600 rounded-lg px-3 py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 resize-none focus:outline-none focus:ring-2 focus:ring-teal-500"
            />
          </div>
          <p className="text-xs text-gray-400 dark:text-gray-500">All current menu items will be auto-added with their current stock as the expected quantity.</p>
        </div>
      </Modal>
    </div>
  )
}
