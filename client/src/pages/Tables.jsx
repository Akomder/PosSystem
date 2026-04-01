import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { X, Users, ClipboardList } from 'lucide-react'
import clsx from 'clsx'
import { useApp } from '../context/AppContext'
import { useSettings } from '../context/SettingsContext'
import TableCard from '../components/tables/TableCard'
import QRCodeModal from '../components/tables/QRCodeModal'
import Badge from '../components/ui/Badge'
import Button from '../components/ui/Button'
import Select from '../components/ui/Select'
import { getOccupancyStats, getTableStatusVariant } from '../utils/tableHelpers'

const FILTERS = ['All', 'Available', 'Occupied', 'Reserved']

const STATUS_OPTIONS = [
  { value: 'Available', label: 'Available' },
  { value: 'Occupied',  label: 'Occupied'  },
  { value: 'Reserved',  label: 'Reserved'  },
]

export default function Tables() {
  const { tables, updateTableStatus } = useApp()
  const { t } = useSettings()
  const navigate = useNavigate()

  const [filter,       setFilter]       = useState('All')
  const [selected,     setSelected]     = useState(null)
  const [drawerOpen,   setDrawerOpen]   = useState(false)
  const [confirmClear, setConfirmClear] = useState(false)
  const [saving,       setSaving]       = useState(false)
  const [qrTable,      setQrTable]      = useState(null)

  const occ = getOccupancyStats(tables)

  const filteredTables = tables.filter(tbl =>
    filter === 'All' ? true : tbl.status === filter
  )

  const filterCount = (f) =>
    f === 'All' ? tables.length : tables.filter(tbl => tbl.status === f).length

  const openDrawer = (table) => {
    setSelected({ ...table })
    setDrawerOpen(true)
    setConfirmClear(false)
  }

  const closeDrawer = () => {
    setDrawerOpen(false)
    setSelected(null)
    setConfirmClear(false)
  }

  const handleStatusChange = (newStatus) => {
    if (newStatus === 'Available' && selected?.status === 'Occupied') {
      setConfirmClear(true)
      return
    }
    applyStatusChange(newStatus)
  }

  const applyStatusChange = async (newStatus) => {
    setSaving(true)
    try {
      const updated = await updateTableStatus(selected.id, newStatus)
      setSelected(updated)
    } catch (err) {
      console.error('Failed to update table status:', err)
    } finally {
      setSaving(false)
      setConfirmClear(false)
    }
  }

  const linkedOrder = selected?.currentOrderId
    ? { id: selected.currentOrderId }
    : null

  return (
    <div className="relative">
      {/* Header */}
      <div className="flex items-start justify-between mb-5">
        <div>
          <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100">{t('dash.floorPlan')}</h2>
          <p className="text-sm text-gray-400 dark:text-gray-500 mt-0.5">{t('tables.subtitle')}</p>
        </div>
        {/* Counts */}
        <div className="flex items-center gap-2 flex-wrap justify-end">
          {[
            { label: `${occ.total} ${t('tables.tables')}`,  color: 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300'       },
            { label: `${occ.available} ${t('tables.free')}`, color: 'bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-400' },
            { label: `${occ.occupied} ${t('tables.busy')}`,  color: 'bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-400'        },
            { label: `${occ.reserved} ${t('tables.rsrvd')}`, color: 'bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-400' },
          ].map((item) => (
            <span key={item.label} className={`px-3 py-1 rounded-full text-xs font-medium ${item.color}`}>
              {item.label}
            </span>
          ))}
        </div>
      </div>

      {/* Filter Bar */}
      <div className="flex gap-2 mb-5 flex-wrap">
        {FILTERS.map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={clsx(
              'px-4 py-1.5 rounded-full text-sm font-medium transition-colors',
              filter === f
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700',
            )}
          >
            {f}
            <span className={clsx(
              'ml-1.5 text-xs px-1.5 py-0.5 rounded-full',
              filter === f ? 'bg-indigo-500 text-white' : 'bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400',
            )}>
              {filterCount(f)}
            </span>
          </button>
        ))}
      </div>

      {/* Grid */}
      <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-5 gap-3">
        {filteredTables.map((table) => (
          <TableCard
            key={table.id}
            table={table}
            onClick={openDrawer}
            isSelected={selected?.id === table.id && drawerOpen}
            onQRClick={setQrTable}
          />
        ))}
      </div>

      {/* ── QR Code Modal ──────────────────────────────────── */}
      <QRCodeModal
        isOpen={!!qrTable}
        onClose={() => setQrTable(null)}
        table={qrTable}
      />

      {/* ── Slide-Over Drawer ──────────────────────────────── */}
      {drawerOpen && selected && (
        <>
          {/* Overlay */}
          <div
            className="fixed inset-0 bg-black/20 dark:bg-black/40 z-30"
            onClick={closeDrawer}
          />
          {/* Panel */}
          <div className="fixed top-0 right-0 h-full w-96 bg-white dark:bg-gray-800 shadow-2xl z-40 flex flex-col slide-in">
            {/* Drawer Header */}
            <div className="flex items-center justify-between px-6 py-5 border-b border-gray-100 dark:border-gray-700">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100">{t('common.table')} {selected.tableNumber}</h3>
                  <Badge variant={getTableStatusVariant(selected.status)}>
                    {selected.status}
                  </Badge>
                </div>
                <div className="flex items-center gap-1 text-sm text-gray-400 dark:text-gray-500 mt-0.5">
                  <Users size={13} />
                  <span>{selected.capacity} {t('common.seats')} · {selected.section || 'Main Hall'}</span>
                </div>
              </div>
              <button
                onClick={closeDrawer}
                className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
              >
                <X size={16} />
              </button>
            </div>

            {/* Drawer Body */}
            <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
              {/* Status change */}
              <div>
                <Select
                  label={t('tables.changeStatus')}
                  value={selected.status}
                  onChange={(e) => handleStatusChange(e.target.value)}
                  options={STATUS_OPTIONS}
                  disabled={saving}
                />
                {confirmClear && (
                  <div className="mt-3 p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 rounded-xl">
                    <p className="text-sm text-amber-800 dark:text-amber-300 font-medium mb-2">
                      {t('tables.confirmClear')}
                    </p>
                    <p className="text-xs text-amber-700 dark:text-amber-400 mb-3">
                      {t('tables.confirmClearDesc')}
                    </p>
                    <div className="flex gap-2">
                      <Button size="sm" variant="warning" onClick={() => applyStatusChange('Available')} disabled={saving}>
                        {saving ? t('common.saving') : t('tables.yesClear')}
                      </Button>
                      <Button size="sm" variant="secondary" onClick={() => setConfirmClear(false)}>
                        {t('common.cancel')}
                      </Button>
                    </div>
                  </div>
                )}
              </div>

              {/* Linked order */}
              {linkedOrder && (
                <div>
                  <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">
                    {t('tables.currentOrder')}
                  </p>
                  <div className="flex items-center justify-between p-3 bg-indigo-50 dark:bg-indigo-900/30 rounded-xl border border-indigo-100 dark:border-indigo-700">
                    <div className="flex items-center gap-2">
                      <ClipboardList size={16} className="text-indigo-600 dark:text-indigo-400" />
                      <span className="text-sm font-semibold text-indigo-800 dark:text-indigo-300">{linkedOrder.id}</span>
                    </div>
                    <Button
                      size="sm"
                      variant="primary"
                      onClick={() => {
                        closeDrawer()
                        navigate('/orders', { state: { selectedOrderId: linkedOrder.id } })
                      }}
                    >
                      {t('tables.viewOrder')}
                    </Button>
                  </div>
                </div>
              )}

              {/* Waiter info */}
              {selected.waiter && (
                <div className="pt-2 border-t border-gray-100 dark:border-gray-700">
                  <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">
                    {t('tables.assignedWaiter')}
                  </p>
                  <p className="text-sm text-gray-700 dark:text-gray-300">{selected.waiter}</p>
                </div>
              )}

              {/* Section info */}
              <div className="pt-2 border-t border-gray-100 dark:border-gray-700">
                <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">
                  {t('common.section')}
                </p>
                <p className="text-sm text-gray-700 dark:text-gray-300">{selected.section || 'Main Hall'}</p>
              </div>
            </div>

            {/* Drawer Footer */}
            <div className="px-6 py-4 border-t border-gray-100 dark:border-gray-700 flex gap-2">
              {selected.status !== 'Available' && (
                <Button
                  variant="secondary"
                  fullWidth
                  onClick={() => handleStatusChange('Available')}
                  disabled={saving}
                >
                  {t('tables.markAvailable')}
                </Button>
              )}
              {selected.status !== 'Reserved' && (
                <Button
                  variant="warning"
                  fullWidth
                  onClick={() => handleStatusChange('Reserved')}
                  disabled={saving}
                >
                  {t('tables.markReserved')}
                </Button>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  )
}
