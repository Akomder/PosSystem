import { useState, useEffect, useCallback } from 'react'
import { Plus, Pencil, Trash2, ChevronUp, ChevronDown, Check, X, GripVertical } from 'lucide-react'
import clsx from 'clsx'
import { menuApi } from '../services/api'

const PRESET_COLORS = [
  '#14b8a6', '#3b82f6', '#f97316', '#ec4899',
  '#8b5cf6', '#eab308', '#10b981', '#ef4444',
  '#6366f1', '#f43f5e', '#06b6d4', '#84cc16',
]

function ColorDot({ color, selected, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{ background: color }}
      className={clsx(
        'w-6 h-6 rounded-full border-2 transition-transform hover:scale-110',
        selected ? 'border-white ring-2 ring-offset-1 ring-gray-400' : 'border-transparent'
      )}
    />
  )
}

export default function CategoryManager({ open, onClose, onChanged }) {
  const [categories, setCategories] = useState([])
  const [loading,    setLoading]    = useState(true)
  const [saving,     setSaving]     = useState(false)
  const [error,      setError]      = useState(null)

  // Add form
  const [addName,  setAddName]  = useState('')
  const [addColor, setAddColor] = useState('#14b8a6')
  const [addError, setAddError] = useState(null)

  // Edit state: id → { name, color }
  const [editing, setEditing] = useState(null)  // { id, name, color }

  const load = useCallback(() => {
    setLoading(true)
    menuApi.getCategories()
      .then(data => setCategories(data))
      .catch(() => setError('Failed to load categories'))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => { if (open) load() }, [open, load])

  if (!open) return null

  // ── Reorder ───────────────────────────────────────────────────────────────
  async function move(index, dir) {
    const next = [...categories]
    const swap = index + dir
    if (swap < 0 || swap >= next.length) return
    ;[next[index], next[swap]] = [next[swap], next[index]]
    const reordered = next.map((c, i) => ({ ...c, sortOrder: i }))
    setCategories(reordered)
    try {
      await menuApi.reorderCategories(reordered.map(c => ({ id: c.id, sortOrder: c.sortOrder })))
      onChanged?.()
    } catch { load() }
  }

  // ── Add ───────────────────────────────────────────────────────────────────
  async function handleAdd(e) {
    e.preventDefault()
    if (!addName.trim()) { setAddError('Name is required'); return }
    setSaving(true); setAddError(null)
    try {
      const created = await menuApi.createCategory({ name: addName.trim(), color: addColor })
      setCategories(prev => [...prev, created])
      setAddName(''); setAddColor('#14b8a6')
      onChanged?.()
    } catch (err) {
      setAddError(err?.response?.data?.error || err?.message || 'Failed to add category')
    } finally { setSaving(false) }
  }

  // ── Save edit ─────────────────────────────────────────────────────────────
  async function saveEdit() {
    if (!editing.name.trim()) return
    setSaving(true)
    try {
      const updated = await menuApi.updateCategory(editing.id, { name: editing.name.trim(), color: editing.color })
      setCategories(prev => prev.map(c => c.id === editing.id ? updated : c))
      setEditing(null)
      onChanged?.()
    } catch (err) {
      setError(err?.response?.data?.error || 'Failed to save')
    } finally { setSaving(false) }
  }

  // ── Delete ────────────────────────────────────────────────────────────────
  async function handleDelete(cat) {
    if (cat.total > 0) {
      setError(`"${cat.name}" has ${cat.total} item${cat.total !== 1 ? 's' : ''}. Move or delete them first.`)
      return
    }
    if (!window.confirm(`Delete category "${cat.name}"?`)) return
    try {
      await menuApi.deleteCategory(cat.id)
      setCategories(prev => prev.filter(c => c.id !== cat.id))
      onChanged?.()
    } catch (err) {
      setError(err?.response?.data?.error || 'Failed to delete')
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-md flex flex-col max-h-[90vh]">

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 dark:border-gray-700">
          <div>
            <h2 className="text-base font-bold text-gray-900 dark:text-gray-100">Manage Categories</h2>
            <p className="text-xs text-gray-400 mt-0.5">Add, rename, reorder, or delete categories</p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        {/* Error banner */}
        {error && (
          <div className="mx-5 mt-3 px-4 py-2.5 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700 rounded-xl text-xs text-red-700 dark:text-red-400 flex items-start gap-2">
            <span className="flex-1">{error}</span>
            <button onClick={() => setError(null)}><X size={12} /></button>
          </div>
        )}

        {/* Category list */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-2">
          {loading ? (
            <div className="text-center py-8 text-sm text-gray-400">Loading…</div>
          ) : categories.length === 0 ? (
            <div className="text-center py-8 text-sm text-gray-400">No categories yet. Add one below.</div>
          ) : categories.map((cat, index) => (
            <div
              key={cat.id}
              className="flex items-center gap-3 px-3 py-2.5 rounded-xl bg-gray-50 dark:bg-gray-700/50 group"
            >
              {/* Drag handle (visual only) */}
              <GripVertical size={14} className="text-gray-300 dark:text-gray-600 flex-shrink-0" />

              {/* Color dot */}
              <span
                className="w-3 h-3 rounded-full flex-shrink-0"
                style={{ background: editing?.id === cat.id ? editing.color : cat.color }}
              />

              {editing?.id === cat.id ? (
                /* Edit mode */
                <div className="flex-1 flex flex-col gap-2">
                  <input
                    autoFocus
                    value={editing.name}
                    onChange={e => setEditing(p => ({ ...p, name: e.target.value }))}
                    onKeyDown={e => { if (e.key === 'Enter') saveEdit(); if (e.key === 'Escape') setEditing(null) }}
                    className="w-full text-sm bg-white dark:bg-gray-700 border border-teal-400 rounded-lg px-2.5 py-1.5 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-teal-500"
                  />
                  <div className="flex gap-1.5 flex-wrap">
                    {PRESET_COLORS.map(c => (
                      <ColorDot key={c} color={c} selected={editing.color === c} onClick={() => setEditing(p => ({ ...p, color: c }))} />
                    ))}
                  </div>
                </div>
              ) : (
                /* View mode */
                <div className="flex-1 min-w-0">
                  <span className="text-sm font-medium text-gray-800 dark:text-gray-200">{cat.name}</span>
                  <span className="ml-2 text-xs text-gray-400">{cat.total} item{cat.total !== 1 ? 's' : ''}</span>
                </div>
              )}

              {/* Actions */}
              <div className="flex items-center gap-1 flex-shrink-0">
                {editing?.id === cat.id ? (
                  <>
                    <button
                      onClick={saveEdit}
                      disabled={saving}
                      className="p-1.5 rounded-lg text-green-600 hover:bg-green-50 dark:hover:bg-green-900/30 transition-colors"
                    >
                      <Check size={14} />
                    </button>
                    <button
                      onClick={() => setEditing(null)}
                      className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors"
                    >
                      <X size={14} />
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      onClick={() => move(index, -1)}
                      disabled={index === 0}
                      className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                    >
                      <ChevronUp size={14} />
                    </button>
                    <button
                      onClick={() => move(index, 1)}
                      disabled={index === categories.length - 1}
                      className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                    >
                      <ChevronDown size={14} />
                    </button>
                    <button
                      onClick={() => setEditing({ id: cat.id, name: cat.name, color: cat.color })}
                      className="p-1.5 rounded-lg text-gray-400 hover:text-teal-600 hover:bg-teal-50 dark:hover:bg-teal-900/30 transition-colors"
                    >
                      <Pencil size={13} />
                    </button>
                    <button
                      onClick={() => handleDelete(cat)}
                      className="p-1.5 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/30 transition-colors"
                    >
                      <Trash2 size={13} />
                    </button>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Add new category */}
        <div className="px-5 pb-5 border-t border-gray-100 dark:border-gray-700 pt-4">
          <form onSubmit={handleAdd} className="space-y-3">
            <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Add Category</p>
            <div className="flex gap-2">
              <input
                value={addName}
                onChange={e => { setAddName(e.target.value); setAddError(null) }}
                placeholder="Category name…"
                className={clsx(
                  'flex-1 text-sm bg-gray-50 dark:bg-gray-700/50 border rounded-xl px-3 py-2.5 text-gray-900 dark:text-gray-100 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-teal-500',
                  addError ? 'border-red-400' : 'border-gray-200 dark:border-gray-600'
                )}
              />
              <button
                type="submit"
                disabled={saving || !addName.trim()}
                className="flex items-center gap-1.5 px-4 py-2.5 bg-teal-600 hover:bg-teal-700 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-medium rounded-xl transition-colors"
              >
                <Plus size={14} />
                Add
              </button>
            </div>
            {/* Color picker */}
            <div className="flex gap-1.5 flex-wrap">
              {PRESET_COLORS.map(c => (
                <ColorDot key={c} color={c} selected={addColor === c} onClick={() => setAddColor(c)} />
              ))}
            </div>
            {addError && <p className="text-xs text-red-500">{addError}</p>}
          </form>
        </div>
      </div>
    </div>
  )
}
