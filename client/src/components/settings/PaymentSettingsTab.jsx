import { useState, useEffect, useCallback, useRef } from 'react'
import { QrCode, Upload, X, Check, RefreshCw, Save } from 'lucide-react'
import { settingsApi } from '../../services/api'
import clsx from 'clsx'

export default function PaymentSettingsTab({ isAdmin }) {
  const [loading,    setLoading]    = useState(true)
  const [saving,     setSaving]     = useState(false)
  const [toast,      setToast]      = useState(null)      // { type, msg }
  const [allSettings, setAllSettings] = useState({})      // full settings JSONB
  const [qrImage,    setQrImage]    = useState(null)      // base64 data URL | null
  const [dragOver,   setDragOver]   = useState(false)
  const fileInputRef = useRef(null)

  const showToast = useCallback((type, msg) => {
    setToast({ type, msg })
    setTimeout(() => setToast(null), 3500)
  }, [])

  // ── Load existing QR image on mount ────────────────────────────────────────
  useEffect(() => {
    let mounted = true
    setLoading(true)
    settingsApi.store.get()
      .then(data => {
        if (!mounted) return
        const s = data.settings || {}
        setAllSettings(s)
        setQrImage(s?.payment?.qrImageBase64 || null)
      })
      .catch(() => {})
      .finally(() => { if (mounted) setLoading(false) })
    return () => { mounted = false }
  }, [])

  // ── File validation + base64 conversion ────────────────────────────────────
  function handleFile(file) {
    if (!file) return
    if (!file.type.startsWith('image/')) {
      showToast('error', 'Please select an image file (PNG, JPG, WebP)')
      return
    }
    if (file.size > 2 * 1024 * 1024) {
      showToast('error', 'Image must be smaller than 2 MB')
      return
    }
    const reader = new FileReader()
    reader.onload = e => setQrImage(e.target.result)
    reader.readAsDataURL(file)
  }

  function handleDrop(e) {
    e.preventDefault()
    setDragOver(false)
    handleFile(e.dataTransfer.files[0])
  }

  // ── Save: deep-merge into existing settings JSONB ─────────────────────────
  async function handleSave() {
    setSaving(true)
    try {
      const merged = {
        ...allSettings,
        payment: {
          ...(allSettings.payment || {}),
          qrImageBase64: qrImage || null,
        },
      }
      await settingsApi.store.update({ settings: merged })
      setAllSettings(merged)
      showToast('success', 'Payment settings saved')
    } catch (e) {
      showToast('error', e.message || 'Failed to save')
    }
    setSaving(false)
  }

  // ── Loading ─────────────────────────────────────────────────────────────
  if (loading) return (
    <div className="flex justify-center py-16">
      <div className="w-5 h-5 border-2 border-teal-500 border-t-transparent rounded-full animate-spin" />
    </div>
  )

  return (
    <div className="space-y-5">

      {/* Toast */}
      {toast && (
        <div className={clsx(
          'flex items-center gap-2 px-4 py-3 rounded-xl text-sm font-medium',
          toast.type === 'success'
            ? 'bg-green-50 dark:bg-green-900/30 text-green-700 dark:text-green-400 border border-green-200 dark:border-green-800'
            : 'bg-red-50 dark:bg-red-900/30 text-red-700 dark:text-red-400 border border-red-200 dark:border-red-800',
        )}>
          {toast.type === 'success' ? <Check size={15} /> : <X size={15} />}
          {toast.msg}
        </div>
      )}

      {/* ── QR Banking Image ───────────────────────────────────────────────── */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100 dark:border-gray-700 flex items-center gap-2">
          <QrCode size={15} className="text-violet-600" />
          <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">QR Banking Image</p>
        </div>

        <div className="px-5 py-5 space-y-4">
          <p className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed max-w-lg">
            Upload your bank's static QR code (PromptPay, KhQR, BCEL One, etc.).
            When a customer selects <span className="font-semibold text-violet-600">QR Payment</span> on the order screen,
            this image will appear immediately so they can scan and pay — no need to wait for a cashier.
          </p>

          {/* Upload drop zone */}
          <div
            onDragOver={e => { e.preventDefault(); if (isAdmin) setDragOver(true) }}
            onDragLeave={() => setDragOver(false)}
            onDrop={isAdmin ? handleDrop : undefined}
            onClick={() => isAdmin && fileInputRef.current?.click()}
            className={clsx(
              'relative border-2 border-dashed rounded-xl flex flex-col items-center justify-center gap-3 transition-all',
              isAdmin ? 'cursor-pointer' : 'cursor-not-allowed opacity-60',
              dragOver
                ? 'border-violet-400 bg-violet-50 dark:bg-violet-900/20'
                : 'border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700/30 hover:border-violet-300 hover:bg-violet-50/50 dark:hover:bg-violet-900/10',
              qrImage ? 'py-6' : 'py-14',
            )}
          >
            {qrImage ? (
              /* ── Preview ── */
              <div className="flex flex-col items-center gap-3">
                <div className="relative">
                  <img
                    src={qrImage}
                    alt="QR Payment code"
                    className="w-52 h-52 object-contain rounded-xl border border-gray-200 dark:border-gray-600 bg-white p-3 shadow-sm"
                  />
                  {isAdmin && (
                    <button
                      type="button"
                      onClick={e => { e.stopPropagation(); setQrImage(null) }}
                      className="absolute -top-2.5 -right-2.5 w-7 h-7 bg-red-500 text-white rounded-full flex items-center justify-center hover:bg-red-600 shadow-md transition-colors"
                    >
                      <X size={13} />
                    </button>
                  )}
                </div>
                {isAdmin && (
                  <p className="text-xs text-gray-400 dark:text-gray-500">Click to replace the image</p>
                )}
              </div>
            ) : (
              /* ── Empty state ── */
              <>
                <div className="w-16 h-16 bg-violet-100 dark:bg-violet-900/40 rounded-full flex items-center justify-center">
                  <Upload size={26} className="text-violet-500 dark:text-violet-400" />
                </div>
                <div className="text-center">
                  <p className="text-sm font-medium text-gray-700 dark:text-gray-200">
                    Drop your QR image here or click to upload
                  </p>
                  <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">PNG, JPG, WebP · Max 2 MB</p>
                </div>
              </>
            )}

            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="sr-only"
              disabled={!isAdmin}
              onChange={e => { handleFile(e.target.files[0]); e.target.value = '' }}
            />
          </div>

          {/* Tip */}
          <div className="flex items-start gap-2 p-3 bg-violet-50 dark:bg-violet-900/20 rounded-lg border border-violet-100 dark:border-violet-800/50">
            <QrCode size={14} className="text-violet-500 flex-shrink-0 mt-0.5" />
            <p className="text-xs text-violet-700 dark:text-violet-400 leading-relaxed">
              Use a <span className="font-semibold">static QR code</span> (fixed amount is optional).
              Most banking apps let you download a static QR from your profile or payment settings.
            </p>
          </div>
        </div>
      </div>

      {/* Save button */}
      {isAdmin && (
        <div className="flex justify-end">
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-2 px-5 py-2.5 bg-teal-600 hover:bg-teal-700 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-semibold rounded-xl transition-colors shadow-sm"
          >
            {saving
              ? <><RefreshCw size={14} className="animate-spin" /> Saving…</>
              : <><Save size={14} /> Save Changes</>
            }
          </button>
        </div>
      )}
    </div>
  )
}
