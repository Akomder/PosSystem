import { useState } from 'react'
import { X, MessageSquare, Check } from 'lucide-react'
import clsx from 'clsx'
import { formatCurrency } from '../utils/formatters'

/**
 * ModifierModal
 * Opens when a menu item has modifier groups.
 * Props:
 *  item          — menu item object (with modifierGroups[])
 *  onConfirm(selections, notes) — called with:
 *      selections: [{ modifierOptionId, name, priceAdjustment }]
 *      notes: string
 *  onClose       — dismiss without adding
 */
export default function ModifierModal({ item, onConfirm, onClose }) {
  if (!item) return null

  const groups = item.modifierGroups || []

  // selections: { [groupId]: Set<optionId> }  (for single: Set of size ≤1)
  const [selections, setSelections] = useState(() => {
    const init = {}
    groups.forEach(g => { init[g.id] = new Set() })
    return init
  })
  const [notes, setNotes] = useState('')

  const toggle = (group, option) => {
    setSelections(prev => {
      const next = { ...prev }
      const set  = new Set(prev[group.id])

      if (group.selectionType === 'single') {
        // Radio behaviour — clear then set
        set.clear()
        if (!prev[group.id].has(option.id)) set.add(option.id)
      } else {
        // Checkbox behaviour — respect max_selections
        if (set.has(option.id)) {
          set.delete(option.id)
        } else {
          if (set.size < group.maxSelections) set.add(option.id)
        }
      }
      next[group.id] = set
      return next
    })
  }

  // Validation: all required groups must have ≥ minSelections chosen
  const isValid = groups.every(g => {
    if (!g.required) return true
    return (selections[g.id]?.size || 0) >= Math.max(1, g.minSelections)
  })

  // Build flat array of chosen modifier objects
  const buildSelections = () => {
    const result = []
    groups.forEach(g => {
      ;(selections[g.id] || new Set()).forEach(optId => {
        const opt = g.options.find(o => o.id === optId)
        if (opt) result.push({ modifierOptionId: opt.id, name: opt.name, priceAdjustment: opt.priceAdjustment })
      })
    })
    return result
  }

  // Compute running price delta
  const priceAdj = buildSelections().reduce((s, m) => s + m.priceAdjustment, 0)
  const finalPrice = item.price + priceAdj

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-md overflow-hidden flex flex-col max-h-[90vh]">

        {/* Header */}
        <div className="flex items-start justify-between px-5 pt-5 pb-3 border-b border-gray-100 dark:border-gray-700 flex-shrink-0">
          <div>
            <h2 className="text-base font-bold text-gray-900 dark:text-gray-100">{item.name}</h2>
            <p className="text-sm text-teal-600 dark:text-teal-400 font-semibold mt-0.5">
              {formatCurrency(finalPrice)}
              {priceAdj !== 0 && (
                <span className="text-xs ml-1.5 text-gray-400">
                  (base {formatCurrency(item.price)}{priceAdj > 0 ? ' +' : ' '}{formatCurrency(priceAdj)})
                </span>
              )}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        {/* Modifier groups */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">
          {groups.map(group => (
            <div key={group.id}>
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-200">
                  {group.name}
                </h3>
                <div className="flex items-center gap-1.5">
                  {group.required && (
                    <span className="text-[10px] px-1.5 py-0.5 bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 rounded font-semibold">
                      Required
                    </span>
                  )}
                  <span className="text-[10px] text-gray-400">
                    {group.selectionType === 'single' ? 'Pick 1' : `Up to ${group.maxSelections}`}
                  </span>
                </div>
              </div>

              <div className="space-y-1.5">
                {(group.options || []).filter(o => o.available).map(opt => {
                  const selected = selections[group.id]?.has(opt.id)
                  return (
                    <button
                      key={opt.id}
                      onClick={() => toggle(group, opt)}
                      className={clsx(
                        'w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl border-2 text-left transition-all',
                        selected
                          ? 'border-teal-500 bg-teal-50 dark:bg-teal-900/25'
                          : 'border-gray-200 dark:border-gray-600 hover:border-teal-300 dark:hover:border-teal-600'
                      )}
                    >
                      <div className="flex items-center gap-2.5">
                        {/* Radio / checkbox indicator */}
                        <div className={clsx(
                          'flex items-center justify-center flex-shrink-0 transition-all',
                          group.selectionType === 'single'
                            ? 'w-4 h-4 rounded-full border-2'
                            : 'w-4 h-4 rounded border-2',
                          selected
                            ? 'border-teal-500 bg-teal-500'
                            : 'border-gray-300 dark:border-gray-500'
                        )}>
                          {selected && <Check size={9} className="text-white" strokeWidth={3} />}
                        </div>
                        <span className="text-sm text-gray-800 dark:text-gray-200">{opt.name}</span>
                      </div>
                      {opt.priceAdjustment !== 0 && (
                        <span className={clsx(
                          'text-xs font-semibold',
                          opt.priceAdjustment > 0 ? 'text-gray-600 dark:text-gray-400' : 'text-green-600 dark:text-green-400'
                        )}>
                          {opt.priceAdjustment > 0 ? '+' : ''}{formatCurrency(opt.priceAdjustment)}
                        </span>
                      )}
                    </button>
                  )
                })}
              </div>

              {/* Validation hint */}
              {group.required && (selections[group.id]?.size || 0) === 0 && (
                <p className="text-xs text-red-500 mt-1.5 ml-1">Please select an option</p>
              )}
            </div>
          ))}

          {/* Per-item notes */}
          <div>
            <label className="flex items-center gap-1.5 text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5">
              <MessageSquare size={12} />
              Special instructions (optional)
            </label>
            <textarea
              rows={2}
              placeholder="e.g. no onions, extra spicy…"
              value={notes}
              onChange={e => setNotes(e.target.value)}
              className="w-full px-3 py-2 text-sm bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-500 resize-none text-gray-900 dark:text-gray-100 placeholder-gray-400"
            />
          </div>
        </div>

        {/* Footer */}
        <div className="flex gap-2 px-5 pb-5 pt-3 border-t border-gray-100 dark:border-gray-700 flex-shrink-0">
          <button
            onClick={onClose}
            className="flex-1 py-2.5 rounded-xl border border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-300 text-sm font-medium hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={() => isValid && onConfirm(buildSelections(), notes)}
            disabled={!isValid}
            className={clsx(
              'flex-[2] py-2.5 rounded-xl text-white text-sm font-semibold transition-colors',
              isValid
                ? 'bg-teal-600 hover:bg-teal-700'
                : 'bg-gray-300 dark:bg-gray-600 cursor-not-allowed'
            )}
          >
            Add to Order · {formatCurrency(finalPrice)}
          </button>
        </div>
      </div>
    </div>
  )
}
