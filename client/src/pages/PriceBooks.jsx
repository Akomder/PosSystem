import { useState, useEffect } from 'react'
import { PlusCircle, BookMarked, Pencil, Trash2, Plus } from 'lucide-react'
import clsx from 'clsx'
import { priceBooksApi, menuApi } from '../services/api'
import Button from '../components/ui/Button'
import Modal from '../components/ui/Modal'
import Input from '../components/ui/Input'
import Badge from '../components/ui/Badge'
import EmptyState from '../components/ui/EmptyState'
import { formatCurrency, formatDate } from '../utils/formatters'
import { useAuth } from '../context/AuthContext'

export default function PriceBooks() {
  const { user } = useAuth()
  const isAdmin = user?.role === 'Admin'
  const [books, setBooks]         = useState([])
  const [loading, setLoading]     = useState(true)
  const [modalOpen, setModalOpen] = useState(false)
  const [editBook, setEditBook]   = useState(null)
  const [form, setForm]           = useState({ name: '', description: '', validFrom: '', validTo: '' })
  const [saving, setSaving]       = useState(false)
  const [detail, setDetail]       = useState(null)
  const [menuItems, setMenuItems] = useState([])
  const [addItemOpen, setAddItemOpen] = useState(false)
  const [addForm, setAddForm]     = useState({ menuItemId: '', customPrice: '' })

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    try { setBooks(await priceBooksApi.getAll()) } catch (_) {}
    setLoading(false)
  }

  async function openDetail(book) {
    const d = await priceBooksApi.getOne(book.id)
    setDetail(d)
    if (!menuItems.length) {
      const m = await menuApi.getAll()
      setMenuItems(m)
    }
  }

  function openCreate() { setEditBook(null); setForm({ name: '', description: '', validFrom: '', validTo: '' }); setModalOpen(true) }
  function openEdit(book) { setEditBook(book); setForm({ name: book.name, description: book.description || '', validFrom: book.validFrom || '', validTo: book.validTo || '' }); setModalOpen(true) }

  async function handleSave() {
    if (!form.name.trim()) return
    setSaving(true)
    try {
      if (editBook) {
        const updated = await priceBooksApi.update(editBook.id, form)
        setBooks(prev => prev.map(b => b.id === updated.id ? updated : b))
      } else {
        const created = await priceBooksApi.create(form)
        setBooks(prev => [created, ...prev])
      }
      setModalOpen(false)
    } catch (_) {}
    setSaving(false)
  }

  async function handleDelete(id) {
    if (!window.confirm('Delete this price book?')) return
    await priceBooksApi.delete(id)
    setBooks(prev => prev.filter(b => b.id !== id))
    if (detail?.id === id) setDetail(null)
  }

  async function handleAddItem() {
    if (!addForm.menuItemId || !addForm.customPrice) return
    await priceBooksApi.addItem(detail.id, { menuItemId: parseInt(addForm.menuItemId), customPrice: parseFloat(addForm.customPrice) })
    const d = await priceBooksApi.getOne(detail.id)
    setDetail(d)
    setAddItemOpen(false)
    setAddForm({ menuItemId: '', customPrice: '' })
  }

  async function handleRemoveItem(itemId) {
    await priceBooksApi.removeItem(detail.id, itemId)
    setDetail(prev => ({ ...prev, items: prev.items.filter(i => i.id !== itemId) }))
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100">Price Books</h2>
          <p className="text-sm text-gray-400 dark:text-gray-500 mt-0.5">Manage custom pricing tiers</p>
        </div>
        {isAdmin && <Button icon={PlusCircle} onClick={openCreate}>New Price Book</Button>}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* List */}
        <div className="lg:col-span-1 space-y-2">
          {loading ? (
            <div className="flex justify-center py-10 text-gray-400">
              <div className="w-5 h-5 border-2 border-teal-500 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : books.length === 0 ? (
            <EmptyState icon={BookMarked} title="No price books" description="Create pricing tiers for different scenarios" />
          ) : books.map(book => (
            <div
              key={book.id}
              onClick={() => openDetail(book)}
              className={clsx(
                'p-4 rounded-xl border cursor-pointer transition-all',
                detail?.id === book.id
                  ? 'border-teal-300 dark:border-teal-700 bg-teal-50 dark:bg-teal-900/20'
                  : 'border-gray-100 dark:border-gray-700 bg-white dark:bg-gray-800 hover:border-gray-200 dark:hover:border-gray-600'
              )}
            >
              <div className="flex items-start justify-between">
                <div>
                  <p className="font-semibold text-gray-900 dark:text-gray-100">{book.name}</p>
                  {book.description && <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">{book.description}</p>}
                  {(book.validFrom || book.validTo) && (
                    <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                      {book.validFrom && `From ${book.validFrom}`}{book.validTo && ` → ${book.validTo}`}
                    </p>
                  )}
                </div>
                <Badge variant={book.active ? 'green' : 'default'}>{book.active ? 'Active' : 'Inactive'}</Badge>
              </div>
              {isAdmin && (
                <div className="flex gap-1 mt-3" onClick={e => e.stopPropagation()}>
                  <button onClick={() => openEdit(book)} className="p-1.5 text-gray-400 hover:text-teal-600 hover:bg-teal-50 dark:hover:bg-teal-900/30 rounded-lg transition-colors"><Pencil size={13} /></button>
                  <button onClick={() => handleDelete(book.id)} className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"><Trash2 size={13} /></button>
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Detail */}
        <div className="lg:col-span-2">
          {!detail ? (
            <div className="flex items-center justify-center h-48 text-gray-400 dark:text-gray-500 text-sm">
              Select a price book to view items
            </div>
          ) : (
            <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 overflow-hidden">
              <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 dark:border-gray-700">
                <h3 className="font-semibold text-gray-900 dark:text-gray-100">{detail.name}</h3>
                {isAdmin && (
                  <Button size="sm" icon={Plus} onClick={() => setAddItemOpen(true)}>Add Item</Button>
                )}
              </div>
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100 dark:border-gray-700 text-xs text-gray-500 dark:text-gray-400 uppercase">
                    <th className="px-5 py-3 text-left">Item</th>
                    <th className="px-5 py-3 text-right">Original Price</th>
                    <th className="px-5 py-3 text-right">Custom Price</th>
                    {isAdmin && <th className="px-5 py-3" />}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50 dark:divide-gray-700">
                  {(detail.items || []).length === 0 && (
                    <tr><td colSpan={4} className="px-5 py-8 text-center text-gray-400 text-sm">No items in this price book</td></tr>
                  )}
                  {(detail.items || []).map(i => (
                    <tr key={i.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                      <td className="px-5 py-3 text-gray-900 dark:text-gray-100">{i.itemName}</td>
                      <td className="px-5 py-3 text-right text-gray-500 dark:text-gray-400">{formatCurrency(i.originalPrice)}</td>
                      <td className="px-5 py-3 text-right font-semibold text-teal-600 dark:text-teal-400">{formatCurrency(i.customPrice)}</td>
                      {isAdmin && (
                        <td className="px-5 py-3 text-right">
                          <button onClick={() => handleRemoveItem(i.id)} className="p-1 text-gray-400 hover:text-red-500 rounded transition-colors"><Trash2 size={13} /></button>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Create/Edit Modal */}
      <Modal isOpen={modalOpen} onClose={() => setModalOpen(false)} title={editBook ? 'Edit Price Book' : 'New Price Book'}
        footer={<><Button variant="secondary" onClick={() => setModalOpen(false)}>Cancel</Button><Button loading={saving} onClick={handleSave}>Save</Button></>}
      >
        <div className="space-y-4">
          <Input label="Name" required value={form.name} onChange={e => setForm(f => ({...f, name: e.target.value}))} />
          <Input label="Description" value={form.description} onChange={e => setForm(f => ({...f, description: e.target.value}))} />
          <div className="grid grid-cols-2 gap-4">
            <Input label="Valid From" type="date" value={form.validFrom} onChange={e => setForm(f => ({...f, validFrom: e.target.value}))} />
            <Input label="Valid To" type="date" value={form.validTo} onChange={e => setForm(f => ({...f, validTo: e.target.value}))} />
          </div>
        </div>
      </Modal>

      {/* Add Item Modal */}
      <Modal isOpen={addItemOpen} onClose={() => setAddItemOpen(false)} title="Add Item to Price Book"
        footer={<><Button variant="secondary" onClick={() => setAddItemOpen(false)}>Cancel</Button><Button onClick={handleAddItem}>Add</Button></>}
      >
        <div className="space-y-4">
          <div>
            <label className="text-sm font-medium text-gray-700 dark:text-gray-300 block mb-1">Menu Item</label>
            <select value={addForm.menuItemId} onChange={e => setAddForm(f => ({...f, menuItemId: e.target.value}))}
              className="w-full text-sm border border-gray-200 dark:border-gray-600 rounded-lg px-3 py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-teal-500"
            >
              <option value="">Select item…</option>
              {menuItems.map(m => <option key={m.id} value={m.id}>{m.name} — {formatCurrency(m.price)}</option>)}
            </select>
          </div>
          <Input label="Custom Price" type="number" value={addForm.customPrice} onChange={e => setAddForm(f => ({...f, customPrice: e.target.value}))} placeholder="0.00" />
        </div>
      </Modal>
    </div>
  )
}
