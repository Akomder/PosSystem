import { useState, useEffect } from 'react'
import { Coffee, Plus, Trash2, Check } from 'lucide-react'
import { useSettings } from '../context/SettingsContext'
import { staffApi, menuApi, consumptionsApi } from '../services/api'
import { formatCurrency, formatDate } from '../utils/formatters'
import Button from '../components/ui/Button'
import Select from '../components/ui/Select'

// Records employee withdrawals (food/drinks taken by staff). Each submission
// deducts inventory and is charged to the employee as a debt.
export default function StaffConsumption() {
  const { t } = useSettings()
  const [staff, setStaff]   = useState([])
  const [menu, setMenu]     = useState([])
  const [history, setHistory] = useState([])

  const [staffId, setStaffId] = useState('')
  const [cart, setCart]       = useState([])   // [{ menuItemId, name, costPrice, quantity }]
  const [note, setNote]       = useState('')
  const [picker, setPicker]   = useState('')
  const [saving, setSaving]   = useState(false)

  const load = () => consumptionsApi.getAll().then(setHistory).catch(() => {})

  useEffect(() => {
    staffApi.getAll().then(setStaff).catch(() => {})
    menuApi.getAll().then(setMenu).catch(() => {})
    load()
  }, [])

  function addItem() {
    if (!picker) return
    const m = menu.find(x => String(x.id) === String(picker))
    if (!m) return
    setCart(c => {
      const found = c.find(x => x.menuItemId === m.id)
      if (found) return c.map(x => x.menuItemId === m.id ? { ...x, quantity: x.quantity + 1 } : x)
      return [...c, { menuItemId: m.id, name: m.name, costPrice: m.costPrice || 0, quantity: 1 }]
    })
    setPicker('')
  }

  const total = cart.reduce((s, i) => s + i.costPrice * i.quantity, 0)

  async function submit() {
    if (!staffId || !cart.length) return
    setSaving(true)
    try {
      await consumptionsApi.create({
        staffId: parseInt(staffId),
        items: cart.map(i => ({ menuItemId: i.menuItemId, quantity: i.quantity })),
        note,
      })
      setCart([]); setNote(''); setStaffId('')
      await load()
    } catch (e) { alert(e.message || 'Failed to record consumption') }
    setSaving(false)
  }

  return (
    <div>
      <div className="mb-5">
        <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2">
          <Coffee size={20} /> {t('consumption.title')}
        </h2>
        <p className="text-sm text-gray-400 dark:text-gray-500 mt-0.5">{t('consumption.subtitle')}</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* New consumption form */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 p-5 space-y-4">
          <Select
            label={t('consumption.employee')}
            value={staffId}
            onChange={e => setStaffId(e.target.value)}
            options={[{ value: '', label: '—' }, ...staff.map(s => ({ value: s.id, label: s.name }))]}
          />

          <div className="flex items-end gap-2">
            <div className="flex-1">
              <Select
                label={t('consumption.addItem')}
                value={picker}
                onChange={e => setPicker(e.target.value)}
                options={[{ value: '', label: '—' }, ...menu.map(m => ({ value: m.id, label: m.name }))]}
              />
            </div>
            <Button icon={Plus} onClick={addItem} disabled={!picker}>{t('common.add')}</Button>
          </div>

          {/* Cart */}
          <div className="space-y-2">
            {cart.length === 0 && <p className="text-sm text-gray-400 text-center py-3">{t('consumption.noItems')}</p>}
            {cart.map(i => (
              <div key={i.menuItemId} className="flex items-center gap-2 px-3 py-2 rounded-lg border border-gray-100 dark:border-gray-700">
                <span className="flex-1 text-sm text-gray-700 dark:text-gray-300">{i.name}</span>
                <input
                  type="number" min={1} value={i.quantity}
                  onChange={e => setCart(c => c.map(x => x.menuItemId === i.menuItemId ? { ...x, quantity: Math.max(1, parseInt(e.target.value) || 1) } : x))}
                  className="w-16 px-2 py-1 text-sm rounded border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                />
                <span className="text-sm text-gray-500 w-24 text-right">{formatCurrency(i.costPrice * i.quantity)}</span>
                <button onClick={() => setCart(c => c.filter(x => x.menuItemId !== i.menuItemId))} className="text-gray-400 hover:text-red-500">
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
          </div>

          <input
            value={note}
            onChange={e => setNote(e.target.value)}
            placeholder={t('consumption.notePlaceholder')}
            className="w-full px-3 py-2 text-sm rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
          />

          <div className="flex items-center justify-between pt-2 border-t border-gray-100 dark:border-gray-700">
            <span className="text-sm text-gray-500">{t('consumption.totalCost')}</span>
            <span className="text-lg font-bold text-gray-900 dark:text-gray-100">{formatCurrency(total)}</span>
          </div>

          <Button fullWidth icon={Check} loading={saving} disabled={!staffId || !cart.length} onClick={submit}>
            {t('consumption.record')}
          </Button>
        </div>

        {/* History */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 overflow-hidden">
          <p className="px-5 pt-4 pb-2 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
            {t('consumption.recent')}
          </p>
          <div className="divide-y divide-gray-50 dark:divide-gray-700 max-h-[480px] overflow-y-auto">
            {history.length === 0 && <p className="text-sm text-gray-400 text-center py-8">{t('consumption.noHistory')}</p>}
            {history.map(h => (
              <div key={h.id} className="flex items-center justify-between px-5 py-3">
                <div>
                  <p className="text-sm font-medium text-gray-900 dark:text-gray-100">{h.staffName}</p>
                  <p className="text-xs text-gray-400">{formatDate(h.createdAt)}{h.note ? ` · ${h.note}` : ''}</p>
                </div>
                <span className="text-sm font-semibold text-gray-700 dark:text-gray-300">{formatCurrency(h.total)}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
