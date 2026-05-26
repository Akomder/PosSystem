import { useRef, useEffect, useState } from 'react'
import { X, Printer, ExternalLink } from 'lucide-react'
import clsx from 'clsx'

/**
 * ReceiptModal
 *
 * Loads the server-generated receipt HTML into an iframe and provides a
 * print button that calls iframe.contentWindow.print() for a clean 80mm
 * thermal-style print dialog.
 *
 * Props:
 *   orderId    — raw numeric order id (the number, not "ORD-001")
 *   type       — 'receipt' | 'kitchen'  (default 'receipt')
 *   onClose    — dismiss callback
 */
export default function ReceiptModal({ orderId, type = 'receipt', onClose }) {
  const iframeRef  = useRef(null)
  const [loading, setLoading]  = useState(true)
  const [errored, setErrored]  = useState(false)

  const token = (() => {
    try { return JSON.parse(localStorage.getItem('pos_user') || 'null')?.token || '' } catch { return '' }
  })()

  // Build the URL — we'll fetch the HTML and inject it into the iframe
  // (avoids cross-origin issues when using srcdoc)
  const path = type === 'kitchen'
    ? `/api/print/${orderId}/kitchen-ticket`
    : `/api/print/${orderId}/receipt`

  useEffect(() => {
    if (!orderId) return
    setLoading(true)
    setErrored(false)

    fetch(path, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => {
        if (!r.ok) throw new Error('Failed to load receipt')
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
  }, [orderId, type])

  const handlePrint = () => {
    const iframe = iframeRef.current
    if (!iframe?.contentWindow) return
    iframe.contentWindow.focus()
    iframe.contentWindow.print()
  }

  if (!orderId) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl flex flex-col overflow-hidden"
        style={{ width: 'min(480px, 95vw)', height: 'min(700px, 90vh)' }}>

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-gray-100 dark:border-gray-700 flex-shrink-0">
          <h2 className="text-sm font-bold text-gray-900 dark:text-gray-100">
            {type === 'kitchen' ? 'Kitchen Ticket' : 'Receipt'} Preview
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
          {/* Loading */}
          {loading && (
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="w-8 h-8 border-2 border-teal-500 border-t-transparent rounded-full animate-spin" />
            </div>
          )}

          {/* Error */}
          {errored && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-gray-500 dark:text-gray-400">
              <Printer size={32} className="opacity-30" />
              <p className="text-sm">Failed to load receipt</p>
            </div>
          )}

          {/* Receipt iframe — centered like a paper slip */}
          <div className={clsx(
            'h-full overflow-auto flex justify-center py-4 px-2 transition-opacity',
            loading || errored ? 'opacity-0' : 'opacity-100'
          )}>
            <div className="bg-white shadow-lg" style={{ width: '80mm', minHeight: '100px' }}>
              <iframe
                ref={iframeRef}
                title={type === 'kitchen' ? 'Kitchen Ticket' : 'Receipt'}
                className="w-full border-none block"
                style={{ width: '80mm', minHeight: '200px', height: '100%' }}
                onLoad={() => {
                  // Adjust iframe height to match content
                  const iframe = iframeRef.current
                  if (!iframe?.contentDocument?.body) return
                  const h = iframe.contentDocument.body.scrollHeight
                  if (h > 0) iframe.style.height = `${h}px`
                }}
              />
            </div>
          </div>
        </div>

        {/* Footer hint */}
        {!loading && !errored && (
          <div className="px-5 py-2 border-t border-gray-100 dark:border-gray-700 flex-shrink-0">
            <p className="text-xs text-gray-400 text-center">
              Optimised for 80mm thermal paper · Use browser print dialog for paper size settings
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
