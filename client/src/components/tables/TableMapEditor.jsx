import { useState, useRef, useEffect } from 'react'
import {
  Save, ZoomIn, ZoomOut, RefreshCw, Move,
  QrCode, Pencil, LayoutGrid,
} from 'lucide-react'
import clsx from 'clsx'
import Button from '../ui/Button'
import { getTableBorderColor, getTableBgColor } from '../../utils/tableHelpers'
import { tablesApi } from '../../services/api'

// ── Constants ──────────────────────────────────────────────────────────────────
const CELL   = 72    // px per grid cell at zoom = 1
const COLS   = 20    // canvas columns
const ROWS   = 14    // canvas rows
const MIN_W  = 1
const MIN_H  = 1
const MAX_WH = 6

// ── Helpers ────────────────────────────────────────────────────────────────────
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
      x:     t.mapX     ?? 0,
      y:     t.mapY     ?? 0,
      w:     t.mapW > 0 ? t.mapW : 2,
      h:     t.mapH > 0 ? t.mapH : 2,
      shape: t.mapShape || 'rect',
    }
  })
  return result
}

const STATUS_COLORS = {
  Available: '#22c55e',
  Occupied:  '#ef4444',
  Reserved:  '#f59e0b',
}

// ── Component ──────────────────────────────────────────────────────────────────
export default function TableMapEditor({
  tables,
  isAdmin,
  onTableClick,
  onQRClick,
  selectedId,
}) {
  const [editMode,  setEditMode]  = useState(false)
  const [layout,    setLayout]    = useState(() => buildLayout(tables))
  const [selId,     setSelId]     = useState(null)    // selected in edit mode
  const [saving,    setSaving]    = useState(false)
  const [dirty,     setDirty]     = useState(false)
  const [zoom,      setZoom]      = useState(1)

  // Stable refs — no stale closures in global event handlers
  const dragRef    = useRef(null)
  const resizeRef  = useRef(null)
  const zoomRef    = useRef(zoom)
  useEffect(() => { zoomRef.current = zoom }, [zoom])

  // Sync tables list (new table added / table deleted)
  useEffect(() => {
    setLayout(prev => {
      const next = { ...prev }
      // Auto-place any new table not yet in the layout
      tables.forEach((t, i) => {
        if (!next[t.id]) {
          const perRow = Math.min(5, tables.length)
          next[t.id] = {
            x: (i % perRow) * 3 + 1,
            y: Math.floor(i / perRow) * 3 + 1,
            w: 2, h: 2, shape: 'rect',
          }
        }
      })
      // Remove stale IDs
      Object.keys(next).forEach(id => {
        if (!tables.find(t => t.id === id)) delete next[id]
      })
      return next
    })
  }, [tables])

  // Global pointer listeners — use refs so no stale closures
  useEffect(() => {
    function onMove(e) {
      const z = zoomRef.current
      if (dragRef.current) {
        const { id, mx0, my0, x0, y0, w, h } = dragRef.current
        const dx = Math.round((e.clientX - mx0) / (z * CELL))
        const dy = Math.round((e.clientY - my0) / (z * CELL))
        const nx = Math.max(0, Math.min(COLS - w, x0 + dx))
        const ny = Math.max(0, Math.min(ROWS - h, y0 + dy))
        setLayout(prev => ({ ...prev, [id]: { ...prev[id], x: nx, y: ny } }))
      }

      if (resizeRef.current) {
        const { id, corner, mx0, my0, x0, y0, w0, h0 } = resizeRef.current
        const dw = Math.round((e.clientX - mx0) / (z * CELL))
        const dh = Math.round((e.clientY - my0) / (z * CELL))
        let nx = x0, ny = y0, nw = w0, nh = h0

        if (corner === 'se') { nw = w0 + dw;       nh = h0 + dh }
        if (corner === 'sw') { nw = w0 - dw; nx = x0 + (w0 - Math.max(MIN_W, Math.min(MAX_WH, w0 - dw))); nh = h0 + dh }
        if (corner === 'ne') { nw = w0 + dw;       nh = h0 - dh; ny = y0 + (h0 - Math.max(MIN_H, Math.min(MAX_WH, h0 - dh))) }
        if (corner === 'nw') { nw = w0 - dw; nx = x0 + (w0 - Math.max(MIN_W, Math.min(MAX_WH, w0 - dw))); nh = h0 - dh; ny = y0 + (h0 - Math.max(MIN_H, Math.min(MAX_WH, h0 - dh))) }

        nw = Math.max(MIN_W, Math.min(MAX_WH, nw))
        nh = Math.max(MIN_H, Math.min(MAX_WH, nh))
        nx = Math.max(0, nx)
        ny = Math.max(0, ny)
        setLayout(prev => ({ ...prev, [id]: { ...prev[id], x: nx, y: ny, w: nw, h: nh } }))
      }
    }

    function onUp() {
      if (dragRef.current || resizeRef.current) setDirty(true)
      dragRef.current  = null
      resizeRef.current = null
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
      await Promise.all(
        tables.map(t => {
          const p = layout[t.id]
          if (!p) return Promise.resolve()
          return tablesApi.update(numId(t.id), {
            mapX: p.x, mapY: p.y, mapW: p.w, mapH: p.h, mapShape: p.shape,
          })
        })
      )
      setDirty(false)
      setEditMode(false)
      setSelId(null)
    } catch (err) {
      alert(err.message || 'Failed to save layout')
    }
    setSaving(false)
  }

  function handleCancel() {
    setLayout(buildLayout(tables))
    setDirty(false)
    setEditMode(false)
    setSelId(null)
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

  // ── Render ───────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-3">

      {/* Toolbar */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        {/* Zoom controls */}
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => adjustZoom(0.1)}
            title="Zoom in"
            className="p-1.5 rounded-lg border border-gray-200 dark:border-gray-600 text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
          >
            <ZoomIn size={14} />
          </button>
          <span className="text-xs text-gray-500 dark:text-gray-400 min-w-[38px] text-center font-mono tabular-nums">
            {Math.round(zoom * 100)}%
          </span>
          <button
            onClick={() => adjustZoom(-0.1)}
            title="Zoom out"
            className="p-1.5 rounded-lg border border-gray-200 dark:border-gray-600 text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
          >
            <ZoomOut size={14} />
          </button>
          <button
            onClick={() => setZoom(1)}
            title="Reset zoom"
            className="ml-1 px-2 py-1 text-xs rounded-lg border border-gray-200 dark:border-gray-600 text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
          >
            100%
          </button>
        </div>

        {/* Edit / Save controls */}
        <div className="flex items-center gap-2">
          {editMode ? (
            <>
              <Button size="sm" variant="secondary" icon={LayoutGrid} onClick={handleAutoArrange}>
                Auto Arrange
              </Button>
              <Button size="sm" variant="secondary" onClick={handleCancel}>
                Cancel
              </Button>
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

      {/* Edit-mode hint */}
      {editMode && (
        <div className="flex items-center gap-2 px-3 py-2 bg-teal-50 dark:bg-teal-900/20 border border-teal-200 dark:border-teal-700 rounded-xl text-xs text-teal-700 dark:text-teal-300">
          <Move size={12} className="shrink-0" />
          <span>
            <strong>Drag</strong> tables to reposition ·{' '}
            <strong>Corner handles</strong> to resize ·{' '}
            <strong>Shape buttons</strong> (appear on selection) to change table shape
          </span>
        </div>
      )}

      {/* Canvas */}
      <div
        className="relative overflow-auto rounded-2xl border border-gray-200 dark:border-gray-700 bg-slate-50 dark:bg-gray-900"
        style={{ maxHeight: 560 }}
        onClick={e => {
          // Deselect when clicking the canvas background in edit mode
          if (editMode && e.target === e.currentTarget) setSelId(null)
        }}
      >
        {/* Inner canvas — sized by COLS × ROWS × CELL × zoom */}
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
          onClick={e => { if (editMode && e.target === e.currentTarget) setSelId(null) }}
        >
          {tables.map(table => {
            const pos = layout[table.id]
            if (!pos) return null

            const isSelEdit = editMode && selId === table.id
            const isSelView = !editMode && selectedId === table.id
            const isRound   = pos.shape === 'round'
            const cz        = CELL * zoom
            const bRadius   = isRound ? '50%' : `${Math.round(10 * zoom)}px`
            const borderPx  = Math.max(2, Math.round(2.5 * zoom))

            // Absolute positions of this table on the canvas
            const left = pos.x * cz
            const top  = pos.y * cz
            const w    = pos.w * cz
            const h    = pos.h * cz

            return (
              <div key={table.id} className="absolute" style={{ zIndex: isSelEdit ? 30 : 10, pointerEvents: 'none', left: 0, top: 0, width: 0, height: 0 }}>

                {/* Table body */}
                <div
                  className={clsx(
                    'absolute flex flex-col items-center justify-center overflow-hidden',
                    'transition-shadow duration-150',
                    editMode ? 'cursor-move' : 'cursor-pointer hover:shadow-xl',
                    (isSelEdit || isSelView) && 'ring-2 ring-teal-500 ring-offset-1',
                  )}
                  style={{
                    left,
                    top,
                    width:           w,
                    height:          h,
                    borderRadius:    bRadius,
                    border:          `${borderPx}px solid ${getTableBorderColor(table.status)}`,
                    backgroundColor: getTableBgColor(table.status),
                    boxShadow:       isSelEdit
                      ? '0 4px 24px rgba(20,184,166,0.35)'
                      : '0 1px 4px rgba(0,0,0,0.07)',
                    pointerEvents:   'auto',
                  }}
                  onMouseDown={e => {
                    if (!editMode) return
                    e.preventDefault()
                    e.stopPropagation()
                    setSelId(table.id)
                    dragRef.current = {
                      id: table.id,
                      mx0: e.clientX, my0: e.clientY,
                      x0: pos.x, y0: pos.y,
                      w: pos.w, h: pos.h,
                    }
                  }}
                  onClick={e => {
                    e.stopPropagation()
                    if (!editMode) onTableClick(table)
                    else setSelId(table.id)
                  }}
                >
                  {/* Table number */}
                  <span
                    className="font-black text-gray-800 dark:text-gray-100 leading-none"
                    style={{ fontSize: Math.max(10, Math.round(16 * zoom)) }}
                  >
                    {table.tableNumber}
                  </span>

                  {/* Capacity */}
                  <span
                    className="text-gray-500 dark:text-gray-400 leading-none mt-0.5"
                    style={{ fontSize: Math.max(7, Math.round(9 * zoom)) }}
                  >
                    {table.capacity}p
                  </span>

                  {/* Status dot */}
                  <span
                    className="absolute rounded-full shadow-sm"
                    style={{
                      width:           Math.max(5, Math.round(7 * zoom)),
                      height:          Math.max(5, Math.round(7 * zoom)),
                      top:             Math.round(4 * zoom),
                      right:           Math.round(4 * zoom),
                      backgroundColor: STATUS_COLORS[table.status] || '#6b7280',
                    }}
                  />

                  {/* Waiter chip (occupied, view mode) */}
                  {!editMode && table.status === 'Occupied' && table.waiter && zoom >= 0.8 && (
                    <span
                      className="absolute bottom-1 px-1.5 py-0.5 bg-white/80 dark:bg-gray-900/70 rounded-full text-gray-600 dark:text-gray-300 font-medium truncate max-w-full"
                      style={{ fontSize: Math.max(6, Math.round(8 * zoom)) }}
                    >
                      {table.waiter}
                    </span>
                  )}

                  {/* QR icon (view mode) */}
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

                {/* Resize handles — only for selected table in edit mode */}
                {isSelEdit && (['nw','ne','sw','se']).map(corner => {
                  const hSize = Math.max(8, Math.round(10 * zoom))
                  const hOff  = -(hSize / 2)
                  return (
                    <div
                      key={corner}
                      className="absolute bg-white dark:bg-gray-900 border-2 border-teal-500 rounded-sm hover:bg-teal-100 dark:hover:bg-teal-800 transition-colors"
                      style={{
                        width:   hSize,
                        height:  hSize,
                        left:    left + (corner.includes('e') ? w + hOff : hOff),
                        top:     top  + (corner.includes('s') ? h + hOff : hOff),
                        cursor:  `${corner}-resize`,
                        zIndex:  40,
                        pointerEvents: 'auto',
                      }}
                      onMouseDown={e => {
                        e.preventDefault()
                        e.stopPropagation()
                        resizeRef.current = {
                          id: table.id, corner,
                          mx0: e.clientX, my0: e.clientY,
                          x0: pos.x, y0: pos.y, w0: pos.w, h0: pos.h,
                        }
                      }}
                    />
                  )
                })}

                {/* Shape selector popup — only for selected table in edit mode */}
                {isSelEdit && (
                  <div
                    className="absolute flex gap-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-xl shadow-2xl px-2 py-1.5 z-50"
                    style={{
                      left:          left,
                      top:           top + h + Math.round(6 * zoom),
                      pointerEvents: 'auto',
                    }}
                    onMouseDown={e => e.stopPropagation()}
                  >
                    <span className="text-xs text-gray-400 dark:text-gray-500 mr-1 self-center">Shape:</span>
                    {[['rect', '▭ Rect'], ['round', '● Round']].map(([v, label]) => (
                      <button
                        key={v}
                        onClick={() => changeShape(table.id, v)}
                        className={clsx(
                          'text-xs px-2 py-0.5 rounded-lg font-medium transition-colors',
                          pos.shape === v
                            ? 'bg-teal-600 text-white shadow-sm'
                            : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700',
                        )}
                      >
                        {label}
                      </button>
                    ))}
                    <div className="w-px bg-gray-200 dark:bg-gray-600 mx-0.5" />
                    {/* Size indicator */}
                    <span className="text-xs text-gray-400 dark:text-gray-500 self-center font-mono">
                      {pos.w}×{pos.h}
                    </span>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* Legend + table count */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-4 flex-wrap">
          {[['Available','#22c55e'],['Occupied','#ef4444'],['Reserved','#f59e0b']].map(([label, color]) => (
            <div key={label} className="flex items-center gap-1.5">
              <span
                className="inline-block w-3 h-3 rounded-full border border-white dark:border-gray-700 shadow-sm"
                style={{ backgroundColor: color }}
              />
              <span className="text-xs text-gray-500 dark:text-gray-400">{label}</span>
            </div>
          ))}
        </div>
        {editMode && (
          <span className="text-xs text-gray-400 dark:text-gray-500">
            Click the canvas background to deselect
          </span>
        )}
      </div>
    </div>
  )
}
