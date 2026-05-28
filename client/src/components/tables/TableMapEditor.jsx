import { useState, useRef, useEffect } from 'react'
import {
  Save, ZoomIn, ZoomOut, Move,
  QrCode, Pencil, LayoutGrid, X,
} from 'lucide-react'
import clsx from 'clsx'
import Button from '../ui/Button'
import { getTableBorderColor, getTableBgColor } from '../../utils/tableHelpers'
import { tablesApi, zonesApi } from '../../services/api'

// ── Constants ──────────────────────────────────────────────────────────────────
const CELL     = 72
const MIN_W    = 1
const MIN_H    = 1
const MAX_WH   = 6
const MIN_COLS = 10, MAX_COLS = 60
const MIN_ROWS = 8,  MAX_ROWS = 40

// ── Decoration type configs ────────────────────────────────────────────────────
const DECO_TYPES = [
  { type: 'bar',      label: 'Bar',      color: '#374151', w: 4, h: 1 },
  { type: 'kitchen',  label: 'Kitchen',  color: '#78350f', w: 3, h: 2 },
  { type: 'entrance', label: 'Entrance', color: '#16a34a', w: 2, h: 1 },
  { type: 'window',   label: 'Window',   color: '#7dd3fc', w: 3, h: 1 },
  { type: 'pillar',   label: 'Pillar',   color: '#6b7280', w: 1, h: 1 },
  { type: 'wall',     label: 'Wall',     color: '#1f2937', w: 4, h: 1 },
  { type: 'restroom', label: 'Restroom', color: '#3b82f6', w: 2, h: 2 },
]

function decoConfig(type) {
  return DECO_TYPES.find(d => d.type === type) || { color: '#9ca3af', label: type }
}

// ── Layout helpers ─────────────────────────────────────────────────────────────
function numId(tableId) {
  return parseInt(String(tableId).replace(/\D/g, ''), 10)
}

function isLayoutSaved(tables) {
  return tables.some(t => t.mapX > 0 || t.mapY > 0)
}

function autoArrange(tables) {
  const perRow = Math.min(5, Math.ceil(Math.sqrt(tables.length + 1)))
  const result = {}
  tables.forEach((t, i) => {
    result[t.id] = {
      x: (i % perRow) * 3 + 1,
      y: Math.floor(i / perRow) * 3 + 1,
      w: t.mapW > 0 ? t.mapW : 2,
      h: t.mapH > 0 ? t.mapH : 2,
      shape: t.mapShape || 'rect',
    }
  })
  return result
}

function buildLayout(tables) {
  if (!isLayoutSaved(tables)) return autoArrange(tables)
  const result = {}
  tables.forEach(t => {
    result[t.id] = {
      x:     t.mapX ?? 0,
      y:     t.mapY ?? 0,
      w:     t.mapW > 0 ? t.mapW : 2,
      h:     t.mapH > 0 ? t.mapH : 2,
      shape: t.mapShape || 'rect',
    }
  })
  return result
}

function buildZoneLayout(zones) {
  const result = {}
  zones.forEach(z => {
    result[z.id] = {
      x: z.mapX ?? 0,
      y: z.mapY ?? 0,
      w: z.mapW > 0 ? z.mapW : 4,
      h: z.mapH > 0 ? z.mapH : 3,
    }
  })
  return result
}

const STATUS_COLORS = {
  Available: '#22c55e',
  Occupied:  '#ef4444',
  Reserved:  '#f59e0b',
}

// ── MapAddTablePopup ───────────────────────────────────────────────────────────
function MapAddTablePopup({ cellX, cellY, zoom, onConfirm, onClose }) {
  const [num,    setNum]    = useState('')
  const [cap,    setCap]    = useState('2')
  const [shape,  setShape]  = useState('rect')
  const [saving, setSaving] = useState(false)

  const cz = CELL * zoom

  async function handleSubmit(e) {
    e.preventDefault()
    if (!num) return
    setSaving(true)
    try {
      await onConfirm({ x: cellX, y: cellY, number: parseInt(num), capacity: parseInt(cap) || 2, shape })
    } finally {
      setSaving(false)
    }
  }

  return (
    <div
      className="absolute z-50 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-xl shadow-2xl p-3"
      style={{ left: cellX * cz, top: cellY * cz, width: 200 }}
      onMouseDown={e => e.stopPropagation()}
      onClick={e => e.stopPropagation()}
    >
      <form onSubmit={handleSubmit} className="space-y-2.5">
        <div className="flex items-center justify-between">
          <p className="text-xs font-semibold text-gray-700 dark:text-gray-200">New Table</p>
          <button type="button" onClick={onClose} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors">
            <X size={13} />
          </button>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="text-xs text-gray-500 dark:text-gray-400 mb-0.5 block">Table #</label>
            <input
              autoFocus
              type="number" min={1}
              value={num}
              onChange={e => setNum(e.target.value)}
              required
              placeholder="e.g. 5"
              className="w-full text-sm px-2 py-1.5 rounded-lg border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700/60 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-teal-500"
            />
          </div>
          <div>
            <label className="text-xs text-gray-500 dark:text-gray-400 mb-0.5 block">Seats</label>
            <input
              type="number" min={1}
              value={cap}
              onChange={e => setCap(e.target.value)}
              placeholder="2"
              className="w-full text-sm px-2 py-1.5 rounded-lg border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700/60 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-teal-500"
            />
          </div>
        </div>
        <div className="flex gap-1">
          {[['rect','▭ Rect'],['round','● Round']].map(([v, label]) => (
            <button
              key={v} type="button"
              onClick={() => setShape(v)}
              className={clsx(
                'flex-1 text-xs py-1 rounded-lg font-medium transition-colors',
                shape === v
                  ? 'bg-teal-600 text-white'
                  : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600',
              )}
            >
              {label}
            </button>
          ))}
        </div>
        <button
          type="submit"
          disabled={!num || saving}
          className="w-full text-sm py-1.5 bg-teal-600 hover:bg-teal-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg font-medium transition-colors"
        >
          {saving ? 'Adding…' : 'Add Table Here'}
        </button>
      </form>
    </div>
  )
}

// ── Main Component ─────────────────────────────────────────────────────────────
export default function TableMapEditor({
  tables,
  zones       = [],
  isAdmin,
  onTableClick,
  onQRClick,
  selectedId,
  canvasSize  = { cols: 20, rows: 14 },
  onCanvasSizeChange,
  onTableCreated,
  decorations = [],
  onSaveDecorations,
}) {
  // Derived canvas dimensions (read from props, use ref for global handlers)
  const canvasSizeRef = useRef(canvasSize)
  useEffect(() => { canvasSizeRef.current = canvasSize }, [canvasSize])

  // ── Core state ───────────────────────────────────────────────────────────────
  const [editMode,    setEditMode]    = useState(false)
  const [layout,      setLayout]      = useState(() => buildLayout(tables))
  const [selId,       setSelId]       = useState(null)
  const [saving,      setSaving]      = useState(false)
  const [dirty,       setDirty]       = useState(false)
  const [zoom,        setZoom]        = useState(1)

  // Zone layer
  const [zoneLayout,  setZoneLayout]  = useState(() => buildZoneLayout(zones))
  const [selZoneId,   setSelZoneId]   = useState(null)

  // Decoration layer (local copy — saved with layout)
  const [localDecos,  setLocalDecos]  = useState(decorations)
  const [selDecoId,   setSelDecoId]   = useState(null)

  // Click-to-add
  const [cellClick,   setCellClick]   = useState(null)   // { x, y } | null

  // Canvas size editor (edit mode)
  const [canvasInput, setCanvasInput] = useState({
    cols: String(canvasSize.cols),
    rows: String(canvasSize.rows),
  })

  // ── Stable refs ──────────────────────────────────────────────────────────────
  const dragRef       = useRef(null)
  const resizeRef     = useRef(null)
  const zoneDragRef   = useRef(null)
  const zoneResizeRef = useRef(null)
  const decoDragRef   = useRef(null)
  const decoResizeRef = useRef(null)
  const zoomRef       = useRef(zoom)
  useEffect(() => { zoomRef.current = zoom }, [zoom])

  // ── Sync effects ─────────────────────────────────────────────────────────────

  // Sync tables (new additions / deletions)
  useEffect(() => {
    setLayout(prev => {
      const next = { ...prev }
      tables.forEach((t, i) => {
        if (!next[t.id]) {
          const perRow = Math.min(5, tables.length)
          next[t.id] = { x: (i % perRow) * 3 + 1, y: Math.floor(i / perRow) * 3 + 1, w: 2, h: 2, shape: 'rect' }
        }
      })
      Object.keys(next).forEach(id => { if (!tables.find(t => t.id === id)) delete next[id] })
      return next
    })
  }, [tables])

  // Sync zones
  useEffect(() => {
    setZoneLayout(prev => {
      const next = { ...prev }
      zones.forEach(z => { if (!next[z.id]) next[z.id] = { x: 0, y: 0, w: 4, h: 3 } })
      Object.keys(next).forEach(id => { if (!zones.find(z => String(z.id) === id)) delete next[id] })
      return next
    })
  }, [zones])

  // Sync decorations from prop
  useEffect(() => { setLocalDecos(decorations) }, [decorations])

  // Sync canvas size input label
  useEffect(() => {
    setCanvasInput({ cols: String(canvasSize.cols), rows: String(canvasSize.rows) })
  }, [canvasSize.cols, canvasSize.rows])

  // ── Global pointer handler ───────────────────────────────────────────────────
  useEffect(() => {
    function onMove(e) {
      const z  = zoomRef.current
      const cz = CELL * z
      const { cols, rows } = canvasSizeRef.current

      // Table drag
      if (dragRef.current) {
        const { id, mx0, my0, x0, y0, w, h } = dragRef.current
        const dx = Math.round((e.clientX - mx0) / cz)
        const dy = Math.round((e.clientY - my0) / cz)
        setLayout(prev => ({
          ...prev,
          [id]: { ...prev[id], x: Math.max(0, Math.min(cols - w, x0 + dx)), y: Math.max(0, Math.min(rows - h, y0 + dy)) },
        }))
      }

      // Table resize
      if (resizeRef.current) {
        const { id, corner, mx0, my0, x0, y0, w0, h0 } = resizeRef.current
        const dw = Math.round((e.clientX - mx0) / cz)
        const dh = Math.round((e.clientY - my0) / cz)
        let nx = x0, ny = y0, nw = w0, nh = h0
        if (corner === 'se') { nw = w0 + dw;       nh = h0 + dh }
        if (corner === 'sw') { nw = w0 - dw; nx = x0 + (w0 - Math.max(MIN_W, Math.min(MAX_WH, w0 - dw))); nh = h0 + dh }
        if (corner === 'ne') { nw = w0 + dw;       nh = h0 - dh; ny = y0 + (h0 - Math.max(MIN_H, Math.min(MAX_WH, h0 - dh))) }
        if (corner === 'nw') { nw = w0 - dw; nx = x0 + (w0 - Math.max(MIN_W, Math.min(MAX_WH, w0 - dw))); nh = h0 - dh; ny = y0 + (h0 - Math.max(MIN_H, Math.min(MAX_WH, h0 - dh))) }
        nw = Math.max(MIN_W, Math.min(MAX_WH, nw))
        nh = Math.max(MIN_H, Math.min(MAX_WH, nh))
        setLayout(prev => ({
          ...prev, [id]: { ...prev[id], x: Math.max(0, nx), y: Math.max(0, ny), w: nw, h: nh },
        }))
      }

      // Zone drag
      if (zoneDragRef.current) {
        const { id, mx0, my0, x0, y0, w, h } = zoneDragRef.current
        const dx = Math.round((e.clientX - mx0) / cz)
        const dy = Math.round((e.clientY - my0) / cz)
        setZoneLayout(prev => ({
          ...prev,
          [id]: { ...prev[id], x: Math.max(0, Math.min(cols - w, x0 + dx)), y: Math.max(0, Math.min(rows - h, y0 + dy)) },
        }))
      }

      // Zone resize
      if (zoneResizeRef.current) {
        const { id, corner, mx0, my0, x0, y0, w0, h0 } = zoneResizeRef.current
        const dw = Math.round((e.clientX - mx0) / cz)
        const dh = Math.round((e.clientY - my0) / cz)
        let nx = x0, ny = y0, nw = w0, nh = h0
        if (corner === 'se') { nw = w0 + dw;       nh = h0 + dh }
        if (corner === 'sw') { nw = w0 - dw; nx = x0 + (w0 - Math.max(1, w0 - dw)); nh = h0 + dh }
        if (corner === 'ne') { nw = w0 + dw;       nh = h0 - dh; ny = y0 + (h0 - Math.max(1, h0 - dh)) }
        if (corner === 'nw') { nw = w0 - dw; nx = x0 + (w0 - Math.max(1, w0 - dw)); nh = h0 - dh; ny = y0 + (h0 - Math.max(1, h0 - dh)) }
        nw = Math.max(1, Math.min(cols, nw))
        nh = Math.max(1, Math.min(rows, nh))
        setZoneLayout(prev => ({
          ...prev, [id]: { ...prev[id], x: Math.max(0, Math.min(cols - nw, nx)), y: Math.max(0, Math.min(rows - nh, ny)), w: nw, h: nh },
        }))
      }

      // Decoration drag
      if (decoDragRef.current) {
        const { id, mx0, my0, x0, y0, w, h } = decoDragRef.current
        const dx = Math.round((e.clientX - mx0) / cz)
        const dy = Math.round((e.clientY - my0) / cz)
        setLocalDecos(prev => prev.map(d =>
          d.id === id
            ? { ...d, x: Math.max(0, Math.min(cols - w, x0 + dx)), y: Math.max(0, Math.min(rows - h, y0 + dy)) }
            : d
        ))
      }

      // Decoration resize
      if (decoResizeRef.current) {
        const { id, corner, mx0, my0, x0, y0, w0, h0 } = decoResizeRef.current
        const dw = Math.round((e.clientX - mx0) / cz)
        const dh = Math.round((e.clientY - my0) / cz)
        let nx = x0, ny = y0, nw = w0, nh = h0
        if (corner === 'se') { nw = w0 + dw;       nh = h0 + dh }
        if (corner === 'sw') { nw = w0 - dw; nx = x0 + (w0 - Math.max(1, w0 - dw)); nh = h0 + dh }
        if (corner === 'ne') { nw = w0 + dw;       nh = h0 - dh; ny = y0 + (h0 - Math.max(1, h0 - dh)) }
        if (corner === 'nw') { nw = w0 - dw; nx = x0 + (w0 - Math.max(1, w0 - dw)); nh = h0 - dh; ny = y0 + (h0 - Math.max(1, h0 - dh)) }
        nw = Math.max(1, Math.min(cols, nw))
        nh = Math.max(1, Math.min(rows, nh))
        setLocalDecos(prev => prev.map(d =>
          d.id === id
            ? { ...d, x: Math.max(0, Math.min(cols - nw, nx)), y: Math.max(0, Math.min(rows - nh, ny)), w: nw, h: nh }
            : d
        ))
      }
    }

    function onUp() {
      const anyActive = dragRef.current || resizeRef.current || zoneDragRef.current ||
                        zoneResizeRef.current || decoDragRef.current || decoResizeRef.current
      if (anyActive) setDirty(true)
      dragRef.current       = null
      resizeRef.current     = null
      zoneDragRef.current   = null
      zoneResizeRef.current = null
      decoDragRef.current   = null
      decoResizeRef.current = null
    }

    document.addEventListener('mousemove', onMove)
    document.addEventListener('mouseup',   onUp)
    return () => {
      document.removeEventListener('mousemove', onMove)
      document.removeEventListener('mouseup',   onUp)
    }
  }, [])

  // ── Actions ──────────────────────────────────────────────────────────────────

  async function handleSave() {
    setSaving(true)
    try {
      // Save table positions
      await Promise.all(
        tables.map(t => {
          const p = layout[t.id]
          if (!p) return Promise.resolve()
          return tablesApi.update(numId(t.id), { mapX: p.x, mapY: p.y, mapW: p.w, mapH: p.h, mapShape: p.shape })
        })
      )
      // Save zone positions
      if (zones.length > 0) {
        await Promise.all(
          zones.map(z => {
            const p = zoneLayout[z.id]
            if (!p) return Promise.resolve()
            return zonesApi.update(z.id, { mapX: p.x, mapY: p.y, mapW: p.w, mapH: p.h })
          })
        )
      }
      // Save decorations
      if (onSaveDecorations) onSaveDecorations(localDecos)

      setDirty(false)
      setEditMode(false)
      setSelId(null)
      setSelZoneId(null)
      setSelDecoId(null)
      setCellClick(null)
    } catch (err) {
      alert(err.message || 'Failed to save layout')
    }
    setSaving(false)
  }

  function handleCancel() {
    setLayout(buildLayout(tables))
    setZoneLayout(buildZoneLayout(zones))
    setLocalDecos(decorations)
    setDirty(false)
    setEditMode(false)
    setSelId(null)
    setSelZoneId(null)
    setSelDecoId(null)
    setCellClick(null)
  }

  function handleAutoArrange() {
    setLayout(autoArrange(tables))
    setDirty(true)
  }

  function changeShape(tableId, shape) {
    setLayout(prev => ({ ...prev, [tableId]: { ...prev[tableId], shape } }))
    setDirty(true)
  }

  function adjustZoom(delta) {
    setZoom(z => Math.max(0.4, Math.min(2, parseFloat((z + delta).toFixed(1)))))
  }

  function handleApplyCanvasSize() {
    const c = Math.max(MIN_COLS, Math.min(MAX_COLS, parseInt(canvasInput.cols) || canvasSize.cols))
    const r = Math.max(MIN_ROWS, Math.min(MAX_ROWS, parseInt(canvasInput.rows) || canvasSize.rows))
    // Clamp tables within new bounds
    setLayout(prev => {
      const next = { ...prev }
      Object.keys(next).forEach(id => {
        const p = next[id]
        next[id] = { ...p, x: Math.max(0, Math.min(c - p.w, p.x)), y: Math.max(0, Math.min(r - p.h, p.y)) }
      })
      return next
    })
    // Clamp zones
    setZoneLayout(prev => {
      const next = { ...prev }
      Object.keys(next).forEach(id => {
        const p = next[id]
        next[id] = { ...p, x: Math.max(0, Math.min(c - p.w, p.x)), y: Math.max(0, Math.min(r - p.h, p.y)) }
      })
      return next
    })
    if (onCanvasSizeChange) onCanvasSizeChange({ cols: c, rows: r })
  }

  async function handleMapCreate({ x, y, number, capacity, shape }) {
    const created = await tablesApi.create({ number, capacity, section: 'Main Hall' })
    await tablesApi.update(numId(created.id), { mapX: x, mapY: y, mapW: 2, mapH: 2, mapShape: shape })
    setLayout(prev => ({ ...prev, [created.id]: { x, y, w: 2, h: 2, shape } }))
    setCellClick(null)
    setDirty(true)
    if (onTableCreated) onTableCreated({ ...created, mapX: x, mapY: y, mapW: 2, mapH: 2, mapShape: shape })
  }

  function addDecoration(dt) {
    setLocalDecos(prev => [
      ...prev,
      { id: String(Date.now()), type: dt.type, label: dt.label, x: 0, y: 0, w: dt.w, h: dt.h },
    ])
    setDirty(true)
  }

  // ── Render ───────────────────────────────────────────────────────────────────
  const COLS = canvasSize.cols
  const ROWS = canvasSize.rows

  return (
    <div className="space-y-3">

      {/* ── Toolbar ─────────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between flex-wrap gap-2">

        {/* Left: Zoom */}
        <div className="flex items-center gap-1.5">
          <button onClick={() => adjustZoom(0.1)} title="Zoom in"
            className="p-1.5 rounded-lg border border-gray-200 dark:border-gray-600 text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors">
            <ZoomIn size={14} />
          </button>
          <span className="text-xs text-gray-500 dark:text-gray-400 min-w-[38px] text-center font-mono tabular-nums">
            {Math.round(zoom * 100)}%
          </span>
          <button onClick={() => adjustZoom(-0.1)} title="Zoom out"
            className="p-1.5 rounded-lg border border-gray-200 dark:border-gray-600 text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors">
            <ZoomOut size={14} />
          </button>
          <button onClick={() => setZoom(1)} title="Reset zoom"
            className="ml-1 px-2 py-1 text-xs rounded-lg border border-gray-200 dark:border-gray-600 text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors">
            100%
          </button>
        </div>

        {/* Center: Canvas size (edit mode) */}
        {editMode && (
          <div className="flex items-center gap-1.5 text-xs">
            <span className="text-gray-400 dark:text-gray-500 font-medium">Canvas:</span>
            <input
              type="number" min={MIN_COLS} max={MAX_COLS}
              value={canvasInput.cols}
              onChange={e => setCanvasInput(p => ({ ...p, cols: e.target.value }))}
              className="w-14 text-center px-1.5 py-1 rounded-lg border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700/60 text-gray-800 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-teal-500 text-xs"
            />
            <span className="text-gray-400 dark:text-gray-500">×</span>
            <input
              type="number" min={MIN_ROWS} max={MAX_ROWS}
              value={canvasInput.rows}
              onChange={e => setCanvasInput(p => ({ ...p, rows: e.target.value }))}
              className="w-14 text-center px-1.5 py-1 rounded-lg border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700/60 text-gray-800 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-teal-500 text-xs"
            />
            <button
              onClick={handleApplyCanvasSize}
              className="px-2.5 py-1 bg-teal-600 hover:bg-teal-700 text-white rounded-lg font-medium transition-colors text-xs"
            >
              Apply
            </button>
          </div>
        )}

        {/* Right: Edit / Save controls */}
        <div className="flex items-center gap-2">
          {editMode ? (
            <>
              <Button size="sm" variant="secondary" icon={LayoutGrid} onClick={handleAutoArrange}>
                Auto Arrange
              </Button>
              <Button size="sm" variant="secondary" onClick={handleCancel}>Cancel</Button>
              <Button size="sm" icon={Save} onClick={handleSave} loading={saving}>
                {dirty ? 'Save Layout' : 'Saved ✓'}
              </Button>
            </>
          ) : isAdmin ? (
            <Button size="sm" variant="secondary" icon={Pencil} onClick={() => setEditMode(true)}>
              Edit Layout
            </Button>
          ) : null}
        </div>
      </div>

      {/* ── Edit-mode hint ───────────────────────────────────────────────────── */}
      {editMode && (
        <div className="flex items-center gap-2 px-3 py-2 bg-teal-50 dark:bg-teal-900/20 border border-teal-200 dark:border-teal-700 rounded-xl text-xs text-teal-700 dark:text-teal-300">
          <Move size={12} className="shrink-0" />
          <span>
            <strong>Drag</strong> tables/zones to reposition ·{' '}
            <strong>Corners</strong> to resize ·{' '}
            <strong>Click empty space</strong> to add a table ·{' '}
            <strong>Shape buttons</strong> appear on selection
          </span>
        </div>
      )}

      {/* ── Canvas ──────────────────────────────────────────────────────────── */}
      <div
        className="relative overflow-auto rounded-2xl border border-gray-200 dark:border-gray-700 bg-slate-50 dark:bg-gray-900"
        style={{ maxHeight: 620 }}
      >
        {/* Inner canvas */}
        <div
          className="relative select-none"
          style={{
            width:           COLS * CELL * zoom,
            height:          ROWS * CELL * zoom,
            backgroundImage: `
              linear-gradient(to right, rgba(100,116,139,0.18) 1px, transparent 1px),
              linear-gradient(to bottom, rgba(100,116,139,0.18) 1px, transparent 1px)
            `,
            backgroundSize: `${CELL * zoom}px ${CELL * zoom}px`,
          }}
          onClick={e => {
            if (!editMode) return
            if (e.target !== e.currentTarget) return
            // Close any open popups / deselect
            setCellClick(null)
            setSelId(null)
            setSelZoneId(null)
            setSelDecoId(null)
            // Compute cell
            const rect = e.currentTarget.getBoundingClientRect()
            const cz   = CELL * zoom
            const col  = Math.floor((e.clientX - rect.left) / cz)
            const row  = Math.floor((e.clientY - rect.top)  / cz)
            // Only open popup on truly empty cells
            const occupied = Object.values(layout).some(p =>
              col >= p.x && col < p.x + p.w && row >= p.y && row < p.y + p.h
            )
            if (!occupied) setCellClick({ x: col, y: row })
          }}
        >

          {/* ── Decoration layer (z-index 3) ─────────────────────────────── */}
          {localDecos.map(d => {
            const cfg       = decoConfig(d.type)
            const isSelDeco = editMode && selDecoId === d.id
            const cz        = CELL * zoom
            const left      = d.x * cz
            const top       = d.y * cz
            const w         = d.w * cz
            const h         = d.h * cz

            return (
              <div key={d.id} className="absolute" style={{ zIndex: isSelDeco ? 8 : 3, pointerEvents: 'none', left: 0, top: 0, width: 0, height: 0 }}>

                {/* Decoration body */}
                <div
                  className={clsx('absolute flex items-center justify-center overflow-hidden rounded-lg', editMode && 'cursor-move')}
                  style={{
                    left, top, width: w, height: h,
                    backgroundColor: cfg.color + 'cc',
                    border: `2px solid ${cfg.color}`,
                    pointerEvents: editMode ? 'auto' : 'none',
                  }}
                  onMouseDown={editMode ? e => {
                    e.preventDefault(); e.stopPropagation()
                    setSelDecoId(d.id); setSelId(null); setSelZoneId(null); setCellClick(null)
                    decoDragRef.current = { id: d.id, mx0: e.clientX, my0: e.clientY, x0: d.x, y0: d.y, w: d.w, h: d.h }
                  } : undefined}
                  onClick={e => {
                    e.stopPropagation()
                    if (editMode) { setSelDecoId(d.id); setSelId(null); setSelZoneId(null); setCellClick(null) }
                  }}
                >
                  <span style={{ fontSize: Math.max(7, Math.round(9 * zoom)), color: '#fff', fontWeight: 700, textAlign: 'center', padding: '2px 4px', lineHeight: 1.2 }}>
                    {d.label || d.type}
                  </span>
                </div>

                {/* Resize handles */}
                {isSelDeco && (['nw','ne','sw','se']).map(corner => {
                  const hSize = Math.max(8, Math.round(10 * zoom))
                  const hOff  = -(hSize / 2)
                  return (
                    <div key={corner}
                      className="absolute bg-white dark:bg-gray-900 rounded-sm hover:bg-teal-100 dark:hover:bg-teal-800 transition-colors"
                      style={{
                        width: hSize, height: hSize,
                        border: `2px solid ${cfg.color}`,
                        left: left + (corner.includes('e') ? w + hOff : hOff),
                        top:  top  + (corner.includes('s') ? h + hOff : hOff),
                        cursor: `${corner}-resize`, zIndex: 15, pointerEvents: 'auto',
                      }}
                      onMouseDown={e => {
                        e.preventDefault(); e.stopPropagation()
                        decoResizeRef.current = { id: d.id, corner, mx0: e.clientX, my0: e.clientY, x0: d.x, y0: d.y, w0: d.w, h0: d.h }
                      }}
                    />
                  )
                })}

                {/* Delete popup */}
                {isSelDeco && (
                  <div
                    className="absolute flex items-center gap-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-xl shadow-2xl px-3 py-1.5 z-50"
                    style={{ left, top: top + h + Math.round(6 * zoom), pointerEvents: 'auto' }}
                    onMouseDown={e => e.stopPropagation()}
                  >
                    <span className="text-xs text-gray-500 dark:text-gray-400">{d.label || d.type}</span>
                    <button
                      onClick={() => { setLocalDecos(prev => prev.filter(dec => dec.id !== d.id)); setSelDecoId(null); setDirty(true) }}
                      className="text-xs text-red-500 hover:text-red-700 dark:hover:text-red-400 font-medium transition-colors"
                    >
                      Delete
                    </button>
                  </div>
                )}
              </div>
            )
          })}

          {/* ── Zone layer (z-index 5) ───────────────────────────────────── */}
          {zones.map(zone => {
            const p           = zoneLayout[zone.id]
            if (!p) return null
            // In view mode, skip zones that haven't been placed yet (mapW === 0)
            if (!editMode && zone.mapW === 0) return null

            const isSelZone = editMode && String(selZoneId) === String(zone.id)
            const cz        = CELL * zoom
            const zoneColor = zone.color || '#6366f1'
            const left      = p.x * cz
            const top       = p.y * cz
            const w         = p.w * cz
            const h         = p.h * cz

            return (
              <div key={zone.id} className="absolute" style={{ zIndex: isSelZone ? 8 : 5, pointerEvents: 'none', left: 0, top: 0, width: 0, height: 0 }}>

                {/* Zone body */}
                <div
                  className={clsx('absolute overflow-hidden', editMode && 'cursor-move')}
                  style={{
                    left, top, width: w, height: h,
                    backgroundColor: zoneColor + '2a',
                    border: `2px dashed ${zoneColor}`,
                    borderRadius: 12,
                    pointerEvents: editMode ? 'auto' : 'none',
                  }}
                  onMouseDown={editMode ? e => {
                    e.preventDefault(); e.stopPropagation()
                    setSelZoneId(String(zone.id)); setSelId(null); setCellClick(null)
                    zoneDragRef.current = { id: zone.id, mx0: e.clientX, my0: e.clientY, x0: p.x, y0: p.y, w: p.w, h: p.h }
                  } : undefined}
                  onClick={e => {
                    e.stopPropagation()
                    if (editMode) { setSelZoneId(String(zone.id)); setSelId(null); setCellClick(null) }
                  }}
                >
                  <span style={{ fontSize: Math.max(8, Math.round(10 * zoom)), color: zoneColor, padding: '3px 6px', display: 'block', fontWeight: 700, lineHeight: 1.4 }}>
                    {zone.name}
                  </span>
                </div>

                {/* Zone resize handles */}
                {isSelZone && (['nw','ne','sw','se']).map(corner => {
                  const hSize = Math.max(8, Math.round(10 * zoom))
                  const hOff  = -(hSize / 2)
                  return (
                    <div key={corner}
                      className="absolute bg-white dark:bg-gray-900 rounded-sm hover:opacity-80 transition-opacity"
                      style={{
                        width: hSize, height: hSize,
                        border: `2px solid ${zoneColor}`,
                        left: left + (corner.includes('e') ? w + hOff : hOff),
                        top:  top  + (corner.includes('s') ? h + hOff : hOff),
                        cursor: `${corner}-resize`, zIndex: 12, pointerEvents: 'auto',
                      }}
                      onMouseDown={e => {
                        e.preventDefault(); e.stopPropagation()
                        zoneResizeRef.current = { id: zone.id, corner, mx0: e.clientX, my0: e.clientY, x0: p.x, y0: p.y, w0: p.w, h0: p.h }
                      }}
                    />
                  )
                })}
              </div>
            )
          })}

          {/* ── Table layer (z-index 10) ─────────────────────────────────── */}
          {tables.map(table => {
            const pos = layout[table.id]
            if (!pos) return null

            const isSelEdit = editMode && selId === table.id
            const isSelView = !editMode && selectedId === table.id
            const isRound   = pos.shape === 'round'
            const cz        = CELL * zoom
            const bRadius   = isRound ? '50%' : `${Math.round(10 * zoom)}px`
            const borderPx  = Math.max(2, Math.round(2.5 * zoom))
            const left      = pos.x * cz
            const top       = pos.y * cz
            const w         = pos.w * cz
            const h         = pos.h * cz

            return (
              <div key={table.id} className="absolute" style={{ zIndex: isSelEdit ? 30 : 10, pointerEvents: 'none', left: 0, top: 0, width: 0, height: 0 }}>

                {/* Table body */}
                <div
                  className={clsx(
                    'absolute flex flex-col items-center justify-center overflow-hidden transition-shadow duration-150',
                    editMode ? 'cursor-move' : 'cursor-pointer hover:shadow-xl',
                    (isSelEdit || isSelView) && 'ring-2 ring-teal-500 ring-offset-1',
                  )}
                  style={{
                    left, top, width: w, height: h,
                    borderRadius:    bRadius,
                    border:          `${borderPx}px solid ${getTableBorderColor(table.status)}`,
                    backgroundColor: getTableBgColor(table.status),
                    boxShadow:       isSelEdit ? '0 4px 24px rgba(20,184,166,0.35)' : '0 1px 4px rgba(0,0,0,0.07)',
                    pointerEvents:   'auto',
                  }}
                  onMouseDown={e => {
                    if (!editMode) return
                    e.preventDefault(); e.stopPropagation()
                    setSelId(table.id); setSelZoneId(null); setSelDecoId(null); setCellClick(null)
                    dragRef.current = { id: table.id, mx0: e.clientX, my0: e.clientY, x0: pos.x, y0: pos.y, w: pos.w, h: pos.h }
                  }}
                  onClick={e => {
                    e.stopPropagation()
                    if (!editMode) onTableClick(table)
                    else { setSelId(table.id); setSelZoneId(null); setSelDecoId(null); setCellClick(null) }
                  }}
                >
                  <span className="font-black text-gray-800 dark:text-gray-100 leading-none"
                    style={{ fontSize: Math.max(10, Math.round(16 * zoom)) }}>
                    {table.tableNumber}
                  </span>
                  <span className="text-gray-500 dark:text-gray-400 leading-none mt-0.5"
                    style={{ fontSize: Math.max(7, Math.round(9 * zoom)) }}>
                    {table.capacity}p
                  </span>
                  {/* Status dot */}
                  <span className="absolute rounded-full shadow-sm" style={{
                    width:  Math.max(5, Math.round(7 * zoom)),
                    height: Math.max(5, Math.round(7 * zoom)),
                    top:    Math.round(4 * zoom),
                    right:  Math.round(4 * zoom),
                    backgroundColor: STATUS_COLORS[table.status] || '#6b7280',
                  }} />
                  {/* Waiter chip */}
                  {!editMode && table.status === 'Occupied' && table.waiter && zoom >= 0.8 && (
                    <span className="absolute bottom-1 px-1.5 py-0.5 bg-white/80 dark:bg-gray-900/70 rounded-full text-gray-600 dark:text-gray-300 font-medium truncate max-w-full"
                      style={{ fontSize: Math.max(6, Math.round(8 * zoom)) }}>
                      {table.waiter}
                    </span>
                  )}
                  {/* QR icon */}
                  {!editMode && zoom >= 0.7 && (
                    <button
                      onClick={e => { e.stopPropagation(); onQRClick(table) }}
                      className="absolute text-gray-300 hover:text-teal-600 dark:hover:text-teal-400 transition-colors"
                      style={{ bottom: Math.round(3 * zoom), right: Math.round(3 * zoom) }}
                      title="Show QR code"
                    >
                      <QrCode size={Math.max(7, Math.round(9 * zoom))} />
                    </button>
                  )}
                </div>

                {/* Resize handles */}
                {isSelEdit && (['nw','ne','sw','se']).map(corner => {
                  const hSize = Math.max(8, Math.round(10 * zoom))
                  const hOff  = -(hSize / 2)
                  return (
                    <div key={corner}
                      className="absolute bg-white dark:bg-gray-900 border-2 border-teal-500 rounded-sm hover:bg-teal-100 dark:hover:bg-teal-800 transition-colors"
                      style={{
                        width: hSize, height: hSize,
                        left: left + (corner.includes('e') ? w + hOff : hOff),
                        top:  top  + (corner.includes('s') ? h + hOff : hOff),
                        cursor: `${corner}-resize`, zIndex: 40, pointerEvents: 'auto',
                      }}
                      onMouseDown={e => {
                        e.preventDefault(); e.stopPropagation()
                        resizeRef.current = { id: table.id, corner, mx0: e.clientX, my0: e.clientY, x0: pos.x, y0: pos.y, w0: pos.w, h0: pos.h }
                      }}
                    />
                  )
                })}

                {/* Shape selector popup */}
                {isSelEdit && (
                  <div
                    className="absolute flex gap-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-xl shadow-2xl px-2 py-1.5 z-50"
                    style={{ left, top: top + h + Math.round(6 * zoom), pointerEvents: 'auto' }}
                    onMouseDown={e => e.stopPropagation()}
                  >
                    <span className="text-xs text-gray-400 dark:text-gray-500 mr-1 self-center">Shape:</span>
                    {[['rect','▭ Rect'],['round','● Round']].map(([v, label]) => (
                      <button key={v} onClick={() => changeShape(table.id, v)}
                        className={clsx(
                          'text-xs px-2 py-0.5 rounded-lg font-medium transition-colors',
                          pos.shape === v
                            ? 'bg-teal-600 text-white shadow-sm'
                            : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700',
                        )}>
                        {label}
                      </button>
                    ))}
                    <div className="w-px bg-gray-200 dark:bg-gray-600 mx-0.5" />
                    <span className="text-xs text-gray-400 dark:text-gray-500 self-center font-mono">
                      {pos.w}×{pos.h}
                    </span>
                  </div>
                )}
              </div>
            )
          })}

          {/* ── Click-to-add popup ───────────────────────────────────────── */}
          {editMode && cellClick && (
            <MapAddTablePopup
              cellX={cellClick.x}
              cellY={cellClick.y}
              zoom={zoom}
              onConfirm={handleMapCreate}
              onClose={() => setCellClick(null)}
            />
          )}

        </div>
      </div>

      {/* ── Decoration toolbar (edit mode) ──────────────────────────────────── */}
      {editMode && (
        <div className="flex items-center flex-wrap gap-2 px-3 py-2.5 bg-gray-50 dark:bg-gray-800/60 border border-gray-200 dark:border-gray-700 rounded-xl">
          <span className="text-xs text-gray-400 dark:text-gray-500 font-medium shrink-0">Add element:</span>
          {DECO_TYPES.map(dt => (
            <button
              key={dt.type}
              onClick={() => addDecoration(dt)}
              className="text-xs px-2.5 py-1 rounded-lg border text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-700 hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors font-medium"
              style={{ borderColor: dt.color, borderLeftWidth: 3 }}
            >
              + {dt.label}
            </button>
          ))}
        </div>
      )}

      {/* ── Legend + table count ─────────────────────────────────────────────── */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-4 flex-wrap">
          {[['Available','#22c55e'],['Occupied','#ef4444'],['Reserved','#f59e0b']].map(([label, color]) => (
            <div key={label} className="flex items-center gap-1.5">
              <span className="inline-block w-3 h-3 rounded-full border border-white dark:border-gray-700 shadow-sm" style={{ backgroundColor: color }} />
              <span className="text-xs text-gray-500 dark:text-gray-400">{label}</span>
            </div>
          ))}
          {!editMode && zones.filter(z => z.mapW > 0).map(z => (
            <div key={z.id} className="flex items-center gap-1.5">
              <span className="inline-block w-3 h-3 rounded border-2" style={{ borderColor: z.color || '#6366f1', backgroundColor: (z.color || '#6366f1') + '2a' }} />
              <span className="text-xs text-gray-500 dark:text-gray-400">{z.name}</span>
            </div>
          ))}
        </div>
        <div className="flex items-center gap-3">
          {editMode && (
            <span className="text-xs text-gray-400 dark:text-gray-500">
              {COLS}×{ROWS} grid · Click canvas to deselect
            </span>
          )}
        </div>
      </div>
    </div>
  )
}
