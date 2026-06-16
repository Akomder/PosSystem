import { useState, useEffect, useCallback } from 'react'
import { Store, DoorOpen, DoorClosed } from 'lucide-react'
import { shiftsApi } from '../../services/api'
import { useAuth }     from '../../context/AuthContext'
import { useSettings } from '../../context/SettingsContext'
import Modal  from '../ui/Modal'
import Button from '../ui/Button'

// Open/Close Store control — the open shift IS the business day. Lets staff
// open/close the day from anywhere so post-midnight bills stay on the right day.
export default function StoreToggle({ onChange }) {
  const { user } = useAuth()
  const { t }    = useSettings()
  const [shift, setShift]   = useState(null)
  const [open, setOpen]     = useState(false)
  const [cash, setCash]     = useState('')
  const [busy, setBusy]     = useState(false)
  const [err, setErr]       = useState('')

  const canManage = ['Admin', 'Cashier', 'Waiter'].includes(user?.role)

  const refresh = useCallback(async () => {
    try { setShift(await shiftsApi.getCurrent()) } catch { /* ignore */ }
  }, [])

  useEffect(() => { refresh() }, [refresh])

  async function submit() {
    setBusy(true); setErr('')
    try {
      if (shift) await shiftsApi.close(shift.id, { closingCash: parseFloat(cash) || 0 })
      else       await shiftsApi.open({ openingCash: parseFloat(cash) || 0 })
      setOpen(false); setCash('')
      await refresh()
      onChange?.()
    } catch (e) {
      setErr(e.message || 'Failed')
    } finally { setBusy(false) }
  }

  const isOpen = !!shift

  return (
    <>
      <button
        onClick={() => canManage && setOpen(true)}
        disabled={!canManage}
        title={isOpen ? t('shift.storeOpen') : t('shift.storeClosed')}
        className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-colors disabled:cursor-default ${
          isOpen
            ? 'bg-green-50 dark:bg-green-900/30 text-green-700 dark:text-green-400 hover:bg-green-100'
            : 'bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400 hover:bg-gray-200'
        }`}
      >
        <Store size={14} />
        <span className="hidden sm:inline">{isOpen ? t('shift.storeOpen') : t('shift.storeClosed')}</span>
        <span className={`w-2 h-2 rounded-full ${isOpen ? 'bg-green-500' : 'bg-gray-400'}`} />
      </button>

      <Modal
        isOpen={open}
        onClose={() => !busy && setOpen(false)}
        title={isOpen ? t('shift.closeStore') : t('shift.openStore')}
        size="sm"
        footer={
          <>
            <Button variant="secondary" onClick={() => setOpen(false)} disabled={busy}>
              {t('common.cancel')}
            </Button>
            <Button
              variant={isOpen ? 'danger' : 'success'}
              icon={isOpen ? DoorClosed : DoorOpen}
              onClick={submit}
              loading={busy}
            >
              {isOpen ? t('shift.closeStore') : t('shift.openStore')}
            </Button>
          </>
        }
      >
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-3">
          {isOpen ? t('shift.closeStoreHint') : t('shift.openStoreHint')}
        </p>
        <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
          {isOpen ? t('shift.closingCash') : t('shift.openingCash')}
        </label>
        <input
          type="number"
          value={cash}
          onChange={e => setCash(e.target.value)}
          className="w-full px-3 py-2 text-sm rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
          placeholder="0"
        />
        {err && <p className="text-xs text-red-500 mt-2">{err}</p>}
      </Modal>
    </>
  )
}
