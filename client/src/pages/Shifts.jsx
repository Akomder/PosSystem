import { useState, useEffect } from 'react'
import { Clock, PlayCircle, StopCircle } from 'lucide-react'
import clsx from 'clsx'
import { shiftsApi } from '../services/api'
import Button from '../components/ui/Button'
import Modal from '../components/ui/Modal'
import Input from '../components/ui/Input'
import Badge from '../components/ui/Badge'
import EmptyState from '../components/ui/EmptyState'
import { formatCurrency, formatDate, formatTime } from '../utils/formatters'
import { useAuth } from '../context/AuthContext'
import { useSettings } from '../context/SettingsContext'

export default function Shifts() {
  const { user } = useAuth()
  const { t } = useSettings()
  const canManage = ['Admin','Cashier','Waiter'].includes(user?.role)
  const [shifts, setShifts]       = useState([])
  const [current, setCurrent]     = useState(null)
  const [loading, setLoading]     = useState(true)
  const [openModal, setOpenModal] = useState(false)
  const [closeModal, setCloseModal] = useState(false)
  const [form, setForm]           = useState({ openingCash: '', notes: '' })
  const [closeForm, setCloseForm] = useState({ closingCash: '', notes: '' })
  const [saving, setSaving]       = useState(false)
  const [err, setErr]             = useState('')

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    try {
      const [all, cur] = await Promise.all([shiftsApi.getAll(), shiftsApi.getCurrent()])
      setShifts(all)
      setCurrent(cur)
    } catch (_) {}
    setLoading(false)
  }

  async function handleOpen() {
    setSaving(true); setErr('')
    try {
      await shiftsApi.open({ openingCash: parseFloat(form.openingCash) || 0, notes: form.notes })
      setOpenModal(false)
      setForm({ openingCash: '', notes: '' })
      await load()
    } catch (e) { setErr(e.message || 'Failed to open shift') }
    setSaving(false)
  }

  async function handleClose() {
    if (!current) return
    setSaving(true); setErr('')
    try {
      await shiftsApi.close(current.id, { closingCash: parseFloat(closeForm.closingCash) || 0, notes: closeForm.notes })
      setCloseModal(false)
      setCloseForm({ closingCash: '', notes: '' })
      await load()
    } catch (e) { setErr(e.message || 'Failed to close shift') }
    setSaving(false)
  }

  const duration = (start, end) => {
    const ms = new Date(end || Date.now()) - new Date(start)
    const h = Math.floor(ms / 3600000)
    const m = Math.floor((ms % 3600000) / 60000)
    return `${h}h ${m}m`
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100">{t('shifts.title')}</h2>
          <p className="text-sm text-gray-400 dark:text-gray-500 mt-0.5">{t('shifts.subtitle')}</p>
        </div>
        {canManage && (
          current
            ? <Button icon={StopCircle} variant="danger" onClick={() => setCloseModal(true)}>{t('shifts.closeShift')}</Button>
            : <Button icon={PlayCircle} onClick={() => setOpenModal(true)}>{t('shifts.openShift')}</Button>
        )}
      </div>

      {/* Active shift banner */}
      {current && (
        <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800/50 rounded-xl px-5 py-4">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                <p className="text-sm font-semibold text-green-700 dark:text-green-300">{t('shifts.active')}</p>
              </div>
              <p className="text-xs text-green-600 dark:text-green-400">
                {t('shifts.openedBy')} {current.openedBy} {t('shifts.at')} {formatTime(current.openedAt)} · {t('shifts.duration')}: {duration(current.openedAt, null)}
              </p>
            </div>
            <div className="flex items-center gap-6">
              <div>
                <p className="text-xs text-green-600 dark:text-green-400">{t('shifts.openingCash')}</p>
                <p className="text-lg font-bold text-green-700 dark:text-green-300">{formatCurrency(current.openingCash)}</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Shift history */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100 dark:border-gray-700">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">{t('shifts.history')}</h3>
        </div>
        {loading ? (
          <div className="flex justify-center py-10"><div className="w-5 h-5 border-2 border-teal-500 border-t-transparent rounded-full animate-spin" /></div>
        ) : shifts.filter(s => s.status === 'closed').length === 0 ? (
          <div className="px-5 py-10 text-center">
            <EmptyState icon={Clock} title={t('shifts.noClosedShifts')} description={t('shifts.noClosedShiftsDesc')} />
          </div>
        ) : (
          <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[720px]">
            <thead>
              <tr className="text-xs text-gray-500 dark:text-gray-400 uppercase border-b border-gray-100 dark:border-gray-700">
                <th className="px-5 py-3 text-left">{t('shifts.col.openedBy')}</th>
                <th className="px-5 py-3 text-left">{t('shifts.col.date')}</th>
                <th className="px-5 py-3 text-right">{t('shifts.col.duration')}</th>
                <th className="px-5 py-3 text-right">{t('shifts.col.opening')}</th>
                <th className="px-5 py-3 text-right">{t('shifts.col.expected')}</th>
                <th className="px-5 py-3 text-right">{t('shifts.col.actual')}</th>
                <th className="px-5 py-3 text-right">{t('shifts.col.variance')}</th>
                <th className="px-5 py-3 text-right">{t('shifts.col.sales')}</th>
                <th className="px-5 py-3 text-right">{t('shifts.col.orders')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50 dark:divide-gray-700">
              {shifts.filter(s => s.status === 'closed').map(s => {
                const variance = s.cashVariance ?? (s.closingCash - s.expectedCash)
                const varOk    = Math.abs(variance) <= 10000
                return (
                  <tr key={s.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                    <td className="px-5 py-3 text-gray-900 dark:text-gray-100">{s.openedBy}</td>
                    <td className="px-5 py-3 text-gray-500 dark:text-gray-400">{formatDate(s.openedAt)}</td>
                    <td className="px-5 py-3 text-right text-gray-500 dark:text-gray-400">{duration(s.openedAt, s.closedAt)}</td>
                    <td className="px-5 py-3 text-right text-gray-700 dark:text-gray-300">{formatCurrency(s.openingCash)}</td>
                    <td className="px-5 py-3 text-right text-gray-700 dark:text-gray-300">{formatCurrency(s.expectedCash ?? 0)}</td>
                    <td className="px-5 py-3 text-right text-gray-700 dark:text-gray-300">{formatCurrency(s.closingCash)}</td>
                    <td className={clsx('px-5 py-3 text-right font-semibold',
                      varOk ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400')}>
                      {variance >= 0 ? '+' : ''}{formatCurrency(variance)}
                    </td>
                    <td className="px-5 py-3 text-right font-semibold text-green-600 dark:text-green-400">{formatCurrency(s.totalSales)}</td>
                    <td className="px-5 py-3 text-right text-gray-700 dark:text-gray-300">{s.totalOrders}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
          </div>
        )}
      </div>

      {/* Open Shift Modal */}
      <Modal isOpen={openModal} onClose={() => { setOpenModal(false); setErr('') }} title={t('shifts.openNewShift')}
        footer={<><Button variant="secondary" onClick={() => { setOpenModal(false); setErr('') }}>{t('common.cancel')}</Button><Button loading={saving} icon={PlayCircle} onClick={handleOpen}>{t('shifts.openShift')}</Button></>}
      >
        <div className="space-y-4">
          <Input label={t('shifts.openingCash')} type="number" value={form.openingCash} onChange={e => setForm(f => ({...f, openingCash: e.target.value}))} placeholder="0.00" />
          <div>
            <label className="text-sm font-medium text-gray-700 dark:text-gray-300 block mb-1">{t('shifts.notes')}</label>
            <textarea rows={2} value={form.notes} onChange={e => setForm(f => ({...f, notes: e.target.value}))}
              className="w-full text-sm border border-gray-200 dark:border-gray-600 rounded-lg px-3 py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 resize-none focus:outline-none focus:ring-2 focus:ring-teal-500"
            />
          </div>
          {err && <p className="text-sm text-red-500">{err}</p>}
        </div>
      </Modal>

      {/* Close Shift Modal */}
      <Modal isOpen={closeModal} onClose={() => { setCloseModal(false); setErr('') }} title={t('shifts.closeCurrentShift')}
        footer={<><Button variant="secondary" onClick={() => { setCloseModal(false); setErr('') }}>{t('common.cancel')}</Button><Button loading={saving} variant="danger" icon={StopCircle} onClick={handleClose}>{t('shifts.closeShift')}</Button></>}
      >
        <div className="space-y-4">
          {current && (
            <>
              {/* Shift summary */}
              <div className="bg-gray-50 dark:bg-gray-700/50 rounded-xl px-4 py-3 text-sm space-y-1">
                <p className="text-gray-500 dark:text-gray-400">
                  {t('shifts.openedBy')} <span className="font-medium text-gray-900 dark:text-gray-100">{current.openedBy}</span>
                  {' · '}{t('shifts.duration')}: <span className="font-medium">{duration(current.openedAt, null)}</span>
                </p>
                <div className="grid grid-cols-2 gap-x-6 gap-y-1 mt-2 pt-2 border-t border-gray-200 dark:border-gray-600">
                  <div>
                    <p className="text-xs text-gray-400 dark:text-gray-500">{t('shifts.openingCash')}</p>
                    <p className="font-semibold text-gray-900 dark:text-gray-100">{formatCurrency(current.openingCash)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-400 dark:text-gray-500">{t('shifts.cashSales')}</p>
                    <p className="font-semibold text-gray-900 dark:text-gray-100">{formatCurrency(current.cashSalesTotal ?? 0)}</p>
                  </div>
                  <div className="col-span-2 pt-1 border-t border-gray-200 dark:border-gray-600">
                    <p className="text-xs text-gray-400 dark:text-gray-500">{t('shifts.expectedCash')}</p>
                    <p className="font-bold text-teal-600 dark:text-teal-400 text-base">{formatCurrency(current.expectedCash ?? 0)}</p>
                  </div>
                </div>
              </div>

              {/* Closing cash input + live variance */}
              <Input label={t('shifts.actualCash')} type="number" value={closeForm.closingCash}
                onChange={e => setCloseForm(f => ({...f, closingCash: e.target.value}))} placeholder="0.00" />

              {closeForm.closingCash !== '' && (() => {
                const actual   = parseFloat(closeForm.closingCash) || 0
                const expected = current.expectedCash ?? 0
                const variance = actual - expected
                const ok       = Math.abs(variance) <= 10000
                return (
                  <div className={clsx('flex items-center justify-between px-4 py-2.5 rounded-xl text-sm font-semibold',
                    ok ? 'bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400'
                       : 'bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400')}>
                    <span>{ok ? t('shifts.varianceOk') : t('shifts.varianceBad')}</span>
                    <span>{variance >= 0 ? '+' : ''}{formatCurrency(variance)}</span>
                  </div>
                )
              })()}
            </>
          )}

          <div>
            <label className="text-sm font-medium text-gray-700 dark:text-gray-300 block mb-1">{t('shifts.notes')}</label>
            <textarea rows={2} value={closeForm.notes} onChange={e => setCloseForm(f => ({...f, notes: e.target.value}))}
              className="w-full text-sm border border-gray-200 dark:border-gray-600 rounded-lg px-3 py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 resize-none focus:outline-none focus:ring-2 focus:ring-teal-500"
            />
          </div>
          {err && <p className="text-sm text-red-500">{err}</p>}
        </div>
      </Modal>
    </div>
  )
}
