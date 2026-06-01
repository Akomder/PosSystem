import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { X, Users, ClipboardList, PlusCircle, Trash2, Layers, Pencil, LayoutGrid, Map, FolderDown } from 'lucide-react'
import clsx from 'clsx'
import { useApp } from '../context/AppContext'
import { useSettings } from '../context/SettingsContext'
import { useAuth } from '../context/AuthContext'
import TableCard from '../components/tables/TableCard'
import { batchDownloadQRCodes } from '../utils/batchDownloadQR'
import TableMapEditor from '../components/tables/TableMapEditor'
import QRCodeModal from '../components/tables/QRCodeModal'
import Badge from '../components/ui/Badge'
import Button from '../components/ui/Button'
import Select from '../components/ui/Select'
import Modal from '../components/ui/Modal'
import Input from '../components/ui/Input'
import { getOccupancyStats, getTableStatusVariant } from '../utils/tableHelpers'
import { zonesApi, tablesApi, settingsApi } from '../services/api'
import PlanLimitBanner from '../components/ui/PlanLimitBanner'

const PLAN_TABLE_LIMITS = { basic: Infinity, pro: Infinity, enterprise: Infinity }

const FILTERS = ['All', 'Available', 'Occupied', 'Reserved']

const STATUS_OPTIONS = [
  { value: 'Available', label: 'Available' },
  { value: 'Occupied',  label: 'Occupied'  },
  { value: 'Reserved',  label: 'Reserved'  },
]

const ZONE_COLORS = ['#14b8a6','#10b981','#f59e0b','#ef4444','#3b82f6','#8b5cf6','#ec4899','#14b8a6']

export default function Tables() {
  const { tables, updateTableStatus, addTableToContext, removeTableFromContext } = useApp()
  const { t } = useSettings()
  const { user } = useAuth()
  const navigate = useNavigate()
  const isAdmin = user?.role === 'Admin'

  const [viewMode,     setViewMode]     = useState('grid') // 'grid' | 'map'
  const [filter,       setFilter]       = useState('All')
  const [zoneFilter,   setZoneFilter]   = useState('all')
  const [zones,        setZones]        = useState([])
  const [selected,     setSelected]     = useState(null)
  const [drawerOpen,   setDrawerOpen]   = useState(false)
  const [confirmClear, setConfirmClear] = useState(false)
  const [saving,       setSaving]       = useState(false)
  const [qrTable,      setQrTable]      = useState(null)

  // Add table modal
  const [addTableOpen, setAddTableOpen] = useState(false)
  const [tableForm,    setTableForm]    = useState({ number: '', capacity: '2', section: 'Main Hall' })
  const [tableFormSaving, setTableFormSaving] = useState(false)

  // Zone management modal
  const [zoneModalOpen, setZoneModalOpen] = useState(false)
  const [zoneForm,      setZoneForm]      = useState({ name: '', color: '#14b8a6', description: '' })
  const [editingZone,   setEditingZone]   = useState(null)
  const [zoneSaving,    setZoneSaving]    = useState(false)

  // Floor plan settings (canvas size + decorations)
  const [storeSettings,   setStoreSettings]   = useState({})
  const [restaurantName,  setRestaurantName]  = useState('')
  const [floorPlan,       setFloorPlan]       = useState({ cols: 20, rows: 14, decorations: [] })

  useEffect(() => {
    zonesApi.getAll().then(setZones).catch(() => {})
    settingsApi.store.get().then(data => {
      if (data.name) setRestaurantName(data.name)
      const s = data.settings || {}
      setStoreSettings(s)
      const fp = s.floorPlan || {}
      setFloorPlan({
        cols:        fp.cols        || 20,
        rows:        fp.rows        || 14,
        decorations: fp.decorations || [],
      })
    }).catch(() => {})
  }, [])

  async function handleAddTable() {
    if (!tableForm.number) return
    setTableFormSaving(true)
    try {
      const created = await tablesApi.create({
        number: parseInt(tableForm.number),
        capacity: parseInt(tableForm.capacity) || 2,
        section: tableForm.section || 'Main Hall',
      })
      // Optimistically add to context if function exists, else reload page
      if (typeof addTableToContext === 'function') addTableToContext(created)
      setAddTableOpen(false)
      setTableForm({ number: '', capacity: '2', section: 'Main Hall' })
    } catch (e) { alert(e.message || 'Failed to add table') }
    setTableFormSaving(false)
  }

  async function handleDeleteTable(tbl) {
    if (!window.confirm(`Delete Table ${tbl.tableNumber}?`)) return
    const rawId = parseInt(String(tbl.id).replace('T-', ''))
    try {
      await tablesApi.delete(rawId)
      if (typeof removeTableFromContext === 'function') removeTableFromContext(tbl.id)
      if (selected?.id === tbl.id) closeDrawer()
    } catch (e) { alert(e.message || 'Failed to delete table') }
  }

  async function handleZoneSave() {
    setZoneSaving(true)
    try {
      if (editingZone) {
        const updated = await zonesApi.update(editingZone.id, zoneForm)
        setZones(prev => prev.map(z => z.id === updated.id ? updated : z))
      } else {
        const created = await zonesApi.create(zoneForm)
        setZones(prev => [...prev, created])
      }
      setZoneForm({ name: '', color: '#14b8a6', description: '' })
      setEditingZone(null)
    } catch (e) { alert(e.message || 'Failed to save zone') }
    setZoneSaving(false)
  }

  async function handleZoneDelete(zone) {
    if (!window.confirm(`Delete zone "${zone.name}"?`)) return
    try {
      await zonesApi.delete(zone.id)
      setZones(prev => prev.filter(z => z.id !== zone.id))
      if (zoneFilter === String(zone.id)) setZoneFilter('all')
    } catch (e) { alert(e.message || 'Failed to delete zone') }
  }

  // ── Floor plan handlers ──────────────────────────────────────────────────────
  async function saveFloorPlanSettings(partialFp) {
    const newFp = { ...floorPlan, ...partialFp }
    setFloorPlan(newFp)
    try {
      await settingsApi.store.update({ settings: { ...storeSettings, floorPlan: newFp } })
      setStoreSettings(prev => ({ ...prev, floorPlan: newFp }))
    } catch (e) { console.error('Failed to save floor plan settings:', e) }
  }

  function handleTableCreated(table) {
    if (typeof addTableToContext === 'function') addTableToContext(table)
  }

  const occ = getOccupancyStats(tables)

  const filteredTables = tables.filter(tbl => {
    const matchStatus = filter === 'All' || tbl.status === filter
    const matchZone = zoneFilter === 'all' || String(tbl.zoneId) === String(zoneFilter)
    return matchStatus && matchZone
  })

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

  const plan       = user?.restaurantPlan || 'basic'
  const tableLimit = PLAN_TABLE_LIMITS[plan] ?? 10

  return (
    <div className="relative">
      <PlanLimitBanner used={tables.length} limit={tableLimit} resource="tables" plan={plan} />
      {/* Header */}
      <div className="flex items-start justify-between mb-5 flex-wrap gap-3">
        <div>
          <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100">{t('dash.floorPlan')}</h2>
          <p className="text-sm text-gray-400 dark:text-gray-500 mt-0.5">{t('tables.subtitle')}</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {isAdmin && (
            <>
              <Button size="sm" variant="secondary" icon={Layers} onClick={() => { setZoneModalOpen(true); setEditingZone(null); setZoneForm({ name: '', color: '#14b8a6', description: '' }) }}>
                Manage Zones
              </Button>
              <Button size="sm" variant="secondary" icon={FolderDown} onClick={() => batchDownloadQRCodes(tables, window.location.origin, restaurantName)}>
                Download All QRs
              </Button>
              <Button size="sm" icon={PlusCircle} onClick={() => setAddTableOpen(true)}>
                Add Table
              </Button>
            </>
          )}

          {/* Grid / Map view toggle */}
          <div className="flex items-center bg-gray-100 dark:bg-gray-700 rounded-lg p-0.5">
            <button
              onClick={() => setViewMode('grid')}
              className={clsx(
                'flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all',
                viewMode === 'grid'
                  ? 'bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-100 shadow-sm'
                  : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200',
              )}
            >
              <LayoutGrid size={13} />
              Grid
            </button>
            <button
              onClick={() => setViewMode('map')}
              className={clsx(
                'flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all',
                viewMode === 'map'
                  ? 'bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-100 shadow-sm'
                  : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200',
              )}
            >
              <Map size={13} />
              Floor Plan
            </button>
          </div>
        </div>
      </div>

      {/* Counts row */}
      <div className="flex items-center gap-2 flex-wrap mb-5">
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

      {viewMode === 'grid' ? (
        <>
          {/* Filter Bar */}
          <div className="flex gap-2 mb-5 flex-wrap">
            {FILTERS.map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={clsx(
                  'px-4 py-1.5 rounded-full text-sm font-medium transition-colors',
                  filter === f
                    ? 'bg-teal-600 text-white shadow-sm'
                    : 'bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700',
                )}
              >
                {f}
                <span className={clsx(
                  'ml-1.5 text-xs px-1.5 py-0.5 rounded-full',
                  filter === f ? 'bg-teal-500 text-white' : 'bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400',
                )}>
                  {filterCount(f)}
                </span>
              </button>
            ))}
          </div>

          {/* Zone filter */}
          {zones.length > 0 && (
            <div className="flex gap-2 mb-5 flex-wrap">
              <button
                onClick={() => setZoneFilter('all')}
                className={clsx(
                  'px-3 py-1 rounded-full text-xs font-medium transition-colors',
                  zoneFilter === 'all'
                    ? 'bg-teal-600 text-white'
                    : 'bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700'
                )}
              >All Zones</button>
              {zones.map(z => (
                <button
                  key={z.id}
                  onClick={() => setZoneFilter(String(z.id))}
                  className={clsx(
                    'px-3 py-1 rounded-full text-xs font-medium transition-colors',
                    zoneFilter === String(z.id)
                      ? 'text-white'
                      : 'bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700'
                  )}
                  style={zoneFilter === String(z.id) ? { backgroundColor: z.color || '#14b8a6' } : {}}
                >{z.name}</button>
              ))}
            </div>
          )}

          {/* Card Grid */}
          <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-5 gap-3">
            {filteredTables.map((table) => (
              <div key={table.id} className="relative group">
                <TableCard
                  table={table}
                  onClick={openDrawer}
                  isSelected={selected?.id === table.id && drawerOpen}
                  onQRClick={setQrTable}
                />
                {isAdmin && (
                  <button
                    onClick={e => { e.stopPropagation(); handleDeleteTable(table) }}
                    className="absolute top-1 right-1 p-1 bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg text-gray-400 hover:text-red-500 hover:border-red-300 opacity-0 group-hover:opacity-100 transition-all shadow-sm"
                    title="Delete table"
                  >
                    <Trash2 size={11} />
                  </button>
                )}
              </div>
            ))}
          </div>
        </>
      ) : (
        /* Floor Plan Map View */
        <TableMapEditor
          tables={tables}
          zones={zones}
          isAdmin={isAdmin}
          onTableClick={openDrawer}
          onQRClick={setQrTable}
          selectedId={selected?.id && drawerOpen ? selected.id : null}
          canvasSize={{ cols: floorPlan.cols, rows: floorPlan.rows }}
          onCanvasSizeChange={({ cols, rows }) => saveFloorPlanSettings({ cols, rows })}
          decorations={floorPlan.decorations}
          onSaveDecorations={decs => saveFloorPlanSettings({ decorations: decs })}
          onTableCreated={handleTableCreated}
        />
      )}

      {/* ── QR Code Modal ──────────────────────────────────── */}
      <QRCodeModal
        isOpen={!!qrTable}
        onClose={() => setQrTable(null)}
        table={qrTable}
        restaurantName={restaurantName}
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
                  <div className="flex items-center justify-between p-3 bg-teal-50 dark:bg-teal-900/30 rounded-xl border border-teal-100 dark:border-teal-700">
                    <div className="flex items-center gap-2">
                      <ClipboardList size={16} className="text-teal-600 dark:text-teal-400" />
                      <span className="text-sm font-semibold text-teal-800 dark:text-teal-300">{linkedOrder.id}</span>
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

              {/* Zone info */}
              {selected.zoneId && zones.find(z => z.id === selected.zoneId) && (
                <div className="pt-2 border-t border-gray-100 dark:border-gray-700">
                  <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">Zone</p>
                  <p className="text-sm text-gray-700 dark:text-gray-300">{zones.find(z => z.id === selected.zoneId)?.name}</p>
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
      {/* ── Add Table Modal ──────────────────────────────────── */}
      <Modal
        isOpen={addTableOpen}
        onClose={() => setAddTableOpen(false)}
        title="Add New Table"
        footer={
          <>
            <Button variant="secondary" onClick={() => setAddTableOpen(false)}>Cancel</Button>
            <Button loading={tableFormSaving} onClick={handleAddTable}>Add Table</Button>
          </>
        }
      >
        <div className="space-y-4">
          <Input
            label="Table Number"
            required
            type="number"
            min={1}
            value={tableForm.number}
            onChange={e => setTableForm(f => ({...f, number: e.target.value}))}
            placeholder="e.g. 10"
          />
          <Input
            label="Capacity (seats)"
            type="number"
            min={1}
            value={tableForm.capacity}
            onChange={e => setTableForm(f => ({...f, capacity: e.target.value}))}
            placeholder="2"
          />
          <Input
            label="Section"
            value={tableForm.section}
            onChange={e => setTableForm(f => ({...f, section: e.target.value}))}
            placeholder="Main Hall"
          />
        </div>
      </Modal>

      {/* ── Zone Management Modal ────────────────────────────── */}
      <Modal
        isOpen={zoneModalOpen}
        onClose={() => setZoneModalOpen(false)}
        title="Manage Zones"
        size="lg"
        footer={<Button variant="secondary" onClick={() => setZoneModalOpen(false)}>Close</Button>}
      >
        <div className="space-y-4">
          {/* Zone form */}
          <div className="bg-gray-50 dark:bg-gray-700/50 rounded-xl p-4 space-y-3">
            <p className="text-sm font-semibold text-gray-700 dark:text-gray-300">{editingZone ? 'Edit Zone' : 'New Zone'}</p>
            <div className="grid grid-cols-2 gap-3">
              <Input
                label="Zone Name"
                value={zoneForm.name}
                onChange={e => setZoneForm(f => ({...f, name: e.target.value}))}
                placeholder="e.g. Terrace"
              />
              <Input
                label="Description"
                value={zoneForm.description}
                onChange={e => setZoneForm(f => ({...f, description: e.target.value}))}
                placeholder="Optional"
              />
            </div>
            <div>
              <p className="text-xs font-medium text-gray-600 dark:text-gray-400 mb-1.5">Color</p>
              <div className="flex gap-2 flex-wrap">
                {ZONE_COLORS.map(c => (
                  <button
                    key={c}
                    onClick={() => setZoneForm(f => ({...f, color: c}))}
                    className={clsx('w-7 h-7 rounded-full transition-all', zoneForm.color === c ? 'ring-2 ring-offset-2 ring-gray-400 scale-110' : '')}
                    style={{ backgroundColor: c }}
                  />
                ))}
              </div>
            </div>
            <div className="flex gap-2">
              <Button onClick={handleZoneSave} loading={zoneSaving} size="sm">
                {editingZone ? 'Update Zone' : 'Add Zone'}
              </Button>
              {editingZone && (
                <Button variant="secondary" size="sm" onClick={() => { setEditingZone(null); setZoneForm({ name: '', color: '#14b8a6', description: '' }) }}>
                  Cancel
                </Button>
              )}
            </div>
          </div>

          {/* Zone list */}
          {zones.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-4">No zones yet</p>
          ) : (
            <div className="space-y-2">
              {zones.map(z => (
                <div key={z.id} className="flex items-center justify-between px-3 py-2.5 bg-white dark:bg-gray-800 rounded-lg border border-gray-100 dark:border-gray-700">
                  <div className="flex items-center gap-3">
                    <div className="w-4 h-4 rounded-full flex-shrink-0" style={{ backgroundColor: z.color || '#14b8a6' }} />
                    <div>
                      <p className="text-sm font-medium text-gray-900 dark:text-gray-100">{z.name}</p>
                      {z.description && <p className="text-xs text-gray-400">{z.description}</p>}
                    </div>
                  </div>
                  <div className="flex gap-1">
                    <button
                      onClick={() => { setEditingZone(z); setZoneForm({ name: z.name, color: z.color || '#14b8a6', description: z.description || '' }) }}
                      className="p-1.5 text-gray-400 hover:text-teal-600 hover:bg-teal-50 dark:hover:bg-teal-900/30 rounded-lg transition-colors"
                    >
                      <Pencil size={12} />
                    </button>
                    <button
                      onClick={() => handleZoneDelete(z)}
                      className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </Modal>
    </div>
  )
}
