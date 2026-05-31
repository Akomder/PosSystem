import { useRef, useEffect, useState } from 'react'
import { X, Printer } from 'lucide-react'
import clsx from 'clsx'
import { getAuthToken } from '../services/api'

/**
 * ReceiptModal
 *
 * Loads server-generated HTML into an iframe and calls iframe.contentWindow.print().
 *
 * Props:
 *   orderId    — numeric id for receipt / kitchen / draft  (used for those types)
 *   entityId   — numeric id for return / purchase / purchase-return / cashflow
 *   type       — 'receipt' | 'kitchen' | 'draft' | 'return' | 'purchase' | 'purchase-return' | 'cashflow'
 *   onClose    — dismiss callback
 *
 * Thermal types (80mm):  receipt, kitchen, draft
 * A5 document types:     return, purchase, purchase-return, cashflow
 */

const THERMAL_TYPES = new Set(['receipt', 'kitchen', 'draft'])

function buildPath(type, orderId, entityId) {
  switch (type) {
    case 'receipt':          return `/api/print/${orderId}/receipt`
    case 'kitchen':          return `/api/print/${orderId}/kitchen-ticket`
    case 'draft':            return `/api/print/${orderId}/draft`
    case 'return':           return `/api/print/return/${entityId}`
    case 'purchase':         return `/api/print/purchase/${entityId}`
    case 'purchase-return':  return `/api/print/purchase-return/${entityId}`
    case 'cashflow':         return `/api/print/cashflow/${entityId}`
    default:                 return `/api/print/${orderId}/receipt`
  }
}

function titleFor(type) {
  switch (type) {
    case 'kitchen':         return 'Kitchen Ticket'
    case 'draft':           return 'Draft Order'
    case 'return':          return 'Return Invoice'
    case 'purchase':        return 'Purchase Order'
    case 'purchase-return': return 'Purchase Return'
    case 'cashflow':        return 'Cash In / Out'
    default:                return 'Receipt'
  }
}

export default function ReceiptModal({ orderId, entityId, type = 'receipt', onClose }) {
  const iframeRef = useRef(null)
  const [loading, setLoading] = useState(true)
  const [errored, setErrored] = useState(false)

  const token = getAuthToken() || ''

  const id     = entityId ?? orderId
  const path   = buildPath(type, orderId, entityId)
  const isA5   = !THERMAL_TYPES.has(type)

  useEffect(() => {
    if (!id) return
    setLoading(true)
    setErrored(false)

    fetch(path, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => {
        if (!r.ok) throw new Error('Failed to load')
        return r.text()
      })
      .then(html => {
        const iframe = iframeRef.current
        if (!iframe) return
        const doc = iframe.contentDocument || iframe.contentWindow?.document
        if (!doc) return
        doc.open()
        doc.write(html)
        doc.close()
        setLoading(false)
      })
      .catch(() => { setErrored(true); setLoading(false) })
  }, [id, type])

  const handlePrint = () => {
    const iframe = iframeRef.current
    if (!iframe?.contentWindow) return
    iframe.contentWindow.focus()
    iframe.contentWindow.print()
  }

  if (!id) return null

  // A5 documents get a wider modal
  const modalW = isA5 ? 'min(680px, 95vw)' : 'min(480px, 95vw)'
  const paperW = isA5 ? '148mm' : '80mm'

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div
        className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl flex flex-col overflow-hidden"
        style={{ width: modalW, height: 'min(700px, 90vh)' }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-gray-100 dark:border-gray-700 flex-shrink-0">
          <h2 className="text-sm font-bold text-gray-900 dark:text-gray-100">
            {titleFor(type)} Preview
          </h2>
          <div className="flex items-center gap-2">
            <button
              onClick={handlePrint}
              disabled={loading || errored}
              className={clsx(
                'flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-colors',
                'bg-teal-600 text-white hover:bg-teal-700 disabled:opacity-40'
              )}
            >
              <Printer size={13} />
              Print
            </button>
            <button
              onClick={onClose}
              className="p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
            >
              <X size={15} />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 relative overflow-hidden bg-gray-100 dark:bg-gray-900">
          {loading && (
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="w-8 h-8 border-2 border-teal-500 border-t-transparent rounded-full animate-spin" />
            </div>
          )}
          {errored && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-gray-500 dark:text-gray-400">
              <Printer size={32} className="opacity-30" />
              <p className="text-sm">Failed to load document</p>
            </div>
          )}

          <div className={clsx(
            'h-full overflow-auto flex justify-center py-4 px-2 transition-opacity',
            loading || errored ? 'opacity-0' : 'opacity-100'
          )}>
            <div className="bg-white shadow-lg" style={{ width: paperW, minHeight: '100px' }}>
              <iframe
                ref={iframeRef}
                title={titleFor(type)}
                className="w-full border-none block"
                style={{ width: paperW, minHeight: '200px', height: '100%' }}
                onLoad={() => {
                  const iframe = iframeRef.current
                  if (!iframe?.contentDocument?.body) return
                  const h = iframe.contentDocument.body.scrollHeight
                  if (h > 0) iframe.style.height = `${h}px`
                }}
              />
            </div>
          </div>
        </div>

        {/* Footer */}
        {!loading && !errored && (
          <div className="px-5 py-2 border-t border-gray-100 dark:border-gray-700 flex-shrink-0">
            <p className="text-xs text-gray-400 text-center">
              {isA5
                ? 'A5 document · Set paper size in browser print dialog'
                : 'Optimised for 80mm thermal paper · Use browser print dialog for paper size settings'}
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
