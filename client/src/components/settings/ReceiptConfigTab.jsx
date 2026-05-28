import { useState, useEffect } from 'react'
import {
  Save, RefreshCw, Eye, EyeOff, Printer,
  Store, FileText, Type, LayoutList,
} from 'lucide-react'
import clsx from 'clsx'
import { settingsApi } from '../../services/api'
import Button from '../ui/Button'

// ── Default config (must match printController DEFAULT_CONFIG) ─────────────────
const DEFAULT_CONFIG = {
  showLogo:           false,
  logoUrl:            '',
  showRestaurantName: true,
  showAddress:        true,
  showPhone:          true,
  showEmail:          false,
  showWebsite:        false,
  websiteText:        '',
  showOrderId:        true,
  showTableNumber:    true,
  showWaiter:         true,
  showDate:           true,
  showSubtotal:       true,
  showTax:            true,
  showDiscount:       true,
  showPaymentDetails: true,
  headerText:         '',
  footerText:         'Thank you for dining with us!',
  paperWidth:         '80mm',
  fontSize:           12,
  fontFamily:         'monospace',
  showDividers:       true,
}

// ── Mock order data for preview ───────────────────────────────────────────────
const MOCK_ORDER = {
  id:          'ORD-042',
  tableNumber: 5,
  waiter:      'Souphaphone',
  orderType:   'Dine In',
  createdAt:   new Date().toISOString(),
  notes:       '',
  subtotal:    142000,
  tax:         11360,
  discount:    0,
  total:       153360,
  items: [
    { name: 'Beef Pho',          quantity: 2, lineTotal: 80000,  modifiers: [], notes: '' },
    { name: 'Spring Rolls',      quantity: 1, lineTotal: 35000,  modifiers: [{ name: 'Extra sauce', priceAdjustment: 5000 }], notes: '' },
    { name: 'Coconut Juice',     quantity: 2, lineTotal: 27000,  modifiers: [], notes: '' },
  ],
  payments: [{ paymentMethod: 'Cash', amount: 153360 }],
}

// ── Toggle switch ─────────────────────────────────────────────────────────────
function Toggle({ checked, onChange }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className={clsx(
        'relative inline-flex h-5 w-9 flex-shrink-0 items-center rounded-full transition-colors duration-200',
        checked ? 'bg-teal-600' : 'bg-gray-200 dark:bg-gray-600',
      )}
    >
      <span className={clsx(
        'inline-block h-3.5 w-3.5 rounded-full bg-white shadow transition-transform duration-200',
        checked ? 'translate-x-4' : 'translate-x-0.5',
      )} />
    </button>
  )
}

// ── Setting row with toggle ────────────────────────────────────────────────────
function ToggleRow({ label, desc, cfgKey, config, onChange, children }) {
  return (
    <div className="py-2.5 border-b border-gray-100 dark:border-gray-700/60 last:border-0">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-medium text-gray-800 dark:text-gray-200">{label}</p>
          {desc && <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">{desc}</p>}
        </div>
        <Toggle checked={!!config[cfgKey]} onChange={v => onChange(cfgKey, v)} />
      </div>
      {children && config[cfgKey] && (
        <div className="mt-2">{children}</div>
      )}
    </div>
  )
}

// ── Section heading ───────────────────────────────────────────────────────────
function Section({ icon: Icon, title, children }) {
  return (
    <div className="mb-4">
      <div className="flex items-center gap-2 mb-2">
        <Icon size={13} className="text-teal-600 dark:text-teal-400 shrink-0" />
        <span className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">{title}</span>
      </div>
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 px-4">
        {children}
      </div>
    </div>
  )
}

// ── Text input row ────────────────────────────────────────────────────────────
function TextRow({ label, cfgKey, placeholder, config, onChange }) {
  return (
    <div className="py-2.5 border-b border-gray-100 dark:border-gray-700/60 last:border-0">
      <label className="text-xs font-medium text-gray-600 dark:text-gray-400 block mb-1">{label}</label>
      <input
        type="text"
        value={config[cfgKey] || ''}
        onChange={e => onChange(cfgKey, e.target.value)}
        placeholder={placeholder}
        className="w-full px-2.5 py-1.5 text-sm rounded-lg border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700/50 text-gray-800 dark:text-gray-100 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent"
      />
    </div>
  )
}

// ── Live receipt preview ──────────────────────────────────────────────────────
function ReceiptPreview({ config, storeInfo }) {
  const cur       = storeInfo.currency || 'LAK'
  const paperW    = config.paperWidth  || '80mm'
  const fontSize  = parseInt(config.fontSize) || 12
  const isM       = config.fontFamily === 'monospace'
  const fontClass = isM ? 'font-mono' : 'font-sans'

  const fmt = (n) => {
    const v = parseFloat(n || 0)
    return `${v.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })} ${cur}`
  }

  const now = new Date().toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' })

  return (
    <div
      className={clsx(
        'bg-white shadow-2xl mx-auto text-gray-900 transition-all duration-200',
        fontClass,
      )}
      style={{
        width:     paperW === '58mm' ? 220 : 300,
        minHeight: 200,
        padding:   '14px 12px',
        fontSize:  fontSize,
      }}
    >
      {/* Logo */}
      {config.showLogo && config.logoUrl && (
        <div className="text-center mb-2">
          <img src={config.logoUrl} alt="logo" className="max-h-12 max-w-28 object-contain mx-auto" />
        </div>
      )}

      {/* Restaurant header */}
      <div className="text-center mb-2">
        {config.showRestaurantName && (
          <div className="font-bold" style={{ fontSize: fontSize + 4 }}>{storeInfo.name || 'My Restaurant'}</div>
        )}
        {config.showAddress && storeInfo.address && (
          <div style={{ fontSize: fontSize - 2, color: '#666' }}>{storeInfo.address}</div>
        )}
        {config.showPhone && storeInfo.phone && (
          <div style={{ fontSize: fontSize - 2, color: '#666' }}>Tel: {storeInfo.phone}</div>
        )}
        {config.showEmail && storeInfo.email && (
          <div style={{ fontSize: fontSize - 2, color: '#666' }}>{storeInfo.email}</div>
        )}
        {config.showWebsite && config.websiteText && (
          <div style={{ fontSize: fontSize - 2, color: '#666' }}>{config.websiteText}</div>
        )}
        {config.headerText && (
          <div style={{ fontSize: fontSize - 1, color: '#555', fontStyle: 'italic', marginTop: 2 }}>{config.headerText}</div>
        )}
        <div className="font-bold mt-1" style={{ fontSize: fontSize + 1 }}>— RECEIPT —</div>
        <div style={{ fontSize: fontSize - 2, color: '#555', marginTop: 2, lineHeight: 1.5 }}>
          {config.showOrderId     && <span>Order: {MOCK_ORDER.id}<br/></span>}
          {config.showTableNumber && <span>Table: {MOCK_ORDER.tableNumber}<br/></span>}
          {config.showWaiter      && <span>Waiter: {MOCK_ORDER.waiter}<br/></span>}
          {config.showDate        && <span>{now}</span>}
        </div>
      </div>

      {config.showDividers && <div className="border-t border-dashed border-gray-400 my-1.5" />}

      {/* Items */}
      <table className="w-full" style={{ fontSize: fontSize, borderCollapse: 'collapse' }}>
        <thead>
          <tr style={{ fontSize: fontSize - 2, borderBottom: '1px solid #ccc', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
            <th className="text-left pb-1" style={{ width: '55%' }}>Item</th>
            <th className="text-center pb-1" style={{ width: '10%' }}>Qty</th>
            <th className="text-right pb-1" style={{ width: '35%' }}>Amount</th>
          </tr>
        </thead>
        <tbody>
          {MOCK_ORDER.items.map((item, i) => (
            <>
              <tr key={i}>
                <td className="py-0.5 align-top" style={{ lineHeight: 1.3 }}>{item.name}</td>
                <td className="py-0.5 text-center align-top">{item.quantity}×</td>
                <td className="py-0.5 text-right align-top font-semibold">{fmt(item.lineTotal)}</td>
              </tr>
              {item.modifiers.map((m, j) => (
                <tr key={`m${j}`}>
                  <td colSpan={2} style={{ fontSize: fontSize - 2, color: '#777', paddingLeft: 8 }}>↳ {m.name} (+{fmt(m.priceAdjustment)})</td>
                  <td />
                </tr>
              ))}
            </>
          ))}
        </tbody>
      </table>

      {/* Totals */}
      {config.showDividers && <div className="border-t border-dashed border-gray-400 my-1.5" />}
      <div style={{ fontSize: fontSize - 1 }}>
        {config.showSubtotal && (
          <div className="flex justify-between py-0.5"><span>Subtotal</span><span>{fmt(MOCK_ORDER.subtotal)}</span></div>
        )}
        {config.showTax && (
          <div className="flex justify-between py-0.5"><span>Tax</span><span>{fmt(MOCK_ORDER.tax)}</span></div>
        )}
        {config.showDiscount && MOCK_ORDER.discount > 0 && (
          <div className="flex justify-between py-0.5 text-green-600"><span>Discount</span><span>-{fmt(MOCK_ORDER.discount)}</span></div>
        )}
        <div className="flex justify-between font-bold border-t border-gray-800 mt-1 pt-1" style={{ fontSize: fontSize + 2 }}>
          <span>TOTAL</span><span>{fmt(MOCK_ORDER.total)}</span>
        </div>
      </div>

      {/* Payment details */}
      {config.showPaymentDetails && (
        <>
          {config.showDividers && <div className="border-t border-dashed border-gray-400 my-1.5" />}
          <div style={{ fontSize: fontSize - 2, color: '#666', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 2 }}>Payment</div>
          {MOCK_ORDER.payments.map((p, i) => (
            <div key={i} className="flex justify-between" style={{ fontSize: fontSize - 1 }}>
              <span className="capitalize">{p.paymentMethod}</span>
              <span>{fmt(p.amount)}</span>
            </div>
          ))}
        </>
      )}

      {/* Footer */}
      {config.showDividers && <div className="border-t border-dashed border-gray-400 my-1.5" />}
      <div className="text-center" style={{ fontSize: fontSize - 2, color: '#888', lineHeight: 1.5 }}>
        {config.footerText || 'Thank you for dining with us!'}
      </div>
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────
export default function ReceiptConfigTab({ isAdmin }) {
  const [config,    setConfig]    = useState(DEFAULT_CONFIG)
  const [original,  setOriginal]  = useState(DEFAULT_CONFIG)
  const [storeInfo, setStoreInfo] = useState({})
  const [loading,   setLoading]   = useState(true)
  const [saving,    setSaving]    = useState(false)
  const [toast,     setToast]     = useState(null)
  const [previewOpen, setPreviewOpen] = useState(true)

  // Load store info + current receipt config
  useEffect(() => {
    setLoading(true)
    settingsApi.getStore()
      .then(data => {
        setStoreInfo({
          name:     data.name,
          phone:    data.phone,
          email:    data.email,
          address:  data.address,
          currency: data.currency,
          logoUrl:  data.logoUrl,
        })
        const saved = data.settings?.receipt || {}
        const merged = { ...DEFAULT_CONFIG, ...saved }
        setConfig(merged)
        setOriginal(merged)
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  function handleChange(key, value) {
    setConfig(prev => ({ ...prev, [key]: value }))
  }

  async function handleSave() {
    setSaving(true)
    try {
      // Merge into existing store settings to avoid overwriting other settings
      const storeData = await settingsApi.getStore()
      const existingSettings = storeData.settings || {}
      await settingsApi.updateStore({
        settings: { ...existingSettings, receipt: config },
      })
      setOriginal(config)
      showToast('success', 'Receipt layout saved!')
    } catch (err) {
      showToast('error', err.message || 'Failed to save')
    }
    setSaving(false)
  }

  function handleReset() {
    setConfig(original)
  }

  function showToast(type, msg) {
    setToast({ type, msg })
    setTimeout(() => setToast(null), 3000)
  }

  const isDirty = JSON.stringify(config) !== JSON.stringify(original)

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="w-8 h-8 border-2 border-teal-500 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="relative">
      {/* Toast */}
      {toast && (
        <div className={clsx(
          'fixed top-5 right-5 z-50 px-4 py-2.5 rounded-xl shadow-lg text-sm font-medium text-white transition-all',
          toast.type === 'success' ? 'bg-teal-600' : 'bg-red-500',
        )}>
          {toast.msg}
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between mb-5 flex-wrap gap-3">
        <div>
          <h3 className="text-base font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2">
            <Printer size={16} className="text-teal-600 dark:text-teal-400" />
            Receipt Layout
          </h3>
          <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">
            Customise what appears on customer receipts. Changes apply instantly to all future prints.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setPreviewOpen(p => !p)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
          >
            {previewOpen ? <EyeOff size={13} /> : <Eye size={13} />}
            {previewOpen ? 'Hide' : 'Show'} Preview
          </button>
          {isAdmin && (
            <>
              {isDirty && (
                <button
                  onClick={handleReset}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                >
                  <RefreshCw size={13} />
                  Reset
                </button>
              )}
              <Button size="sm" icon={Save} onClick={handleSave} loading={saving} disabled={!isDirty && !saving}>
                Save Changes
              </Button>
            </>
          )}
        </div>
      </div>

      <div className={clsx('grid gap-6', previewOpen ? 'lg:grid-cols-[1fr_320px]' : 'grid-cols-1')}>

        {/* ── Left: Settings panel ─────────────────────────────────────────── */}
        <div className="space-y-0 max-w-2xl">

          {/* Branding */}
          <Section icon={Store} title="Branding">
            <ToggleRow label="Show Logo" desc="Display restaurant logo at the top" cfgKey="showLogo" config={config} onChange={handleChange}>
              <input
                type="text"
                value={config.logoUrl || ''}
                onChange={e => handleChange('logoUrl', e.target.value)}
                placeholder="https://... or base64 data URL"
                className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700/50 text-gray-800 dark:text-gray-100 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-teal-500"
              />
              {config.logoUrl && (
                <div className="mt-2 flex items-center gap-2">
                  <img src={config.logoUrl} alt="logo preview" className="h-8 object-contain bg-white rounded border border-gray-200 px-1" />
                  <span className="text-xs text-gray-400">Logo preview</span>
                </div>
              )}
            </ToggleRow>
            <ToggleRow label="Restaurant Name"      cfgKey="showRestaurantName" config={config} onChange={handleChange} />
            <ToggleRow label="Address"              cfgKey="showAddress"        config={config} onChange={handleChange} />
            <ToggleRow label="Phone Number"         cfgKey="showPhone"          config={config} onChange={handleChange} />
            <ToggleRow label="Email Address"        cfgKey="showEmail"          config={config} onChange={handleChange} />
            <ToggleRow label="Website / Social"     cfgKey="showWebsite"        config={config} onChange={handleChange}>
              <input
                type="text"
                value={config.websiteText || ''}
                onChange={e => handleChange('websiteText', e.target.value)}
                placeholder="e.g. www.myrestaurant.com or @myrestaurant"
                className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700/50 text-gray-800 dark:text-gray-100 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-teal-500"
              />
            </ToggleRow>
          </Section>

          {/* Order info */}
          <Section icon={FileText} title="Order Information">
            <ToggleRow label="Order Number"   cfgKey="showOrderId"     config={config} onChange={handleChange} />
            <ToggleRow label="Table Number"   cfgKey="showTableNumber" config={config} onChange={handleChange} />
            <ToggleRow label="Waiter Name"    cfgKey="showWaiter"      config={config} onChange={handleChange} />
            <ToggleRow label="Date & Time"    cfgKey="showDate"        config={config} onChange={handleChange} />
          </Section>

          {/* Totals */}
          <Section icon={LayoutList} title="Totals & Payment">
            <ToggleRow label="Subtotal line"     cfgKey="showSubtotal"       config={config} onChange={handleChange} />
            <ToggleRow label="Tax line"          cfgKey="showTax"            config={config} onChange={handleChange} />
            <ToggleRow label="Discount line"     cfgKey="showDiscount"       config={config} onChange={handleChange} />
            <ToggleRow label="Payment details"   cfgKey="showPaymentDetails" config={config} onChange={handleChange} />
            <ToggleRow label="Dashed dividers"   desc="Show separator lines between sections" cfgKey="showDividers" config={config} onChange={handleChange} />
          </Section>

          {/* Text */}
          <Section icon={Type} title="Custom Text">
            <TextRow label="Header text" cfgKey="headerText" placeholder="e.g. Promotion or tagline…" config={config} onChange={handleChange} />
            <TextRow label="Footer / Thank-you message" cfgKey="footerText" placeholder="Thank you for dining with us!" config={config} onChange={handleChange} />
          </Section>

          {/* Layout */}
          <Section icon={Printer} title="Layout">
            {/* Paper width */}
            <div className="py-2.5 border-b border-gray-100 dark:border-gray-700/60">
              <p className="text-sm font-medium text-gray-800 dark:text-gray-200 mb-2">Paper Width</p>
              <div className="flex gap-2">
                {['58mm', '80mm'].map(w => (
                  <button
                    key={w}
                    onClick={() => handleChange('paperWidth', w)}
                    className={clsx(
                      'px-4 py-1.5 rounded-lg text-sm font-medium border transition-colors',
                      config.paperWidth === w
                        ? 'bg-teal-600 text-white border-teal-600'
                        : 'bg-white dark:bg-gray-700 border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-300 hover:border-teal-400',
                    )}
                  >
                    {w}
                  </button>
                ))}
              </div>
            </div>

            {/* Font size */}
            <div className="py-2.5 border-b border-gray-100 dark:border-gray-700/60">
              <p className="text-sm font-medium text-gray-800 dark:text-gray-200 mb-2">Font Size</p>
              <div className="flex gap-2">
                {[{ label: 'Small', value: 10 }, { label: 'Normal', value: 12 }, { label: 'Large', value: 14 }].map(s => (
                  <button
                    key={s.value}
                    onClick={() => handleChange('fontSize', s.value)}
                    className={clsx(
                      'px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors',
                      config.fontSize === s.value
                        ? 'bg-teal-600 text-white border-teal-600'
                        : 'bg-white dark:bg-gray-700 border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-300 hover:border-teal-400',
                    )}
                  >
                    {s.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Font family */}
            <div className="py-2.5">
              <p className="text-sm font-medium text-gray-800 dark:text-gray-200 mb-2">Font Style</p>
              <div className="flex gap-2">
                {[{ label: 'Monospace (Thermal)', value: 'monospace' }, { label: 'Sans-serif', value: 'sans' }].map(f => (
                  <button
                    key={f.value}
                    onClick={() => handleChange('fontFamily', f.value)}
                    className={clsx(
                      'px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors',
                      config.fontFamily === f.value
                        ? 'bg-teal-600 text-white border-teal-600'
                        : 'bg-white dark:bg-gray-700 border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-300 hover:border-teal-400',
                    )}
                  >
                    {f.label}
                  </button>
                ))}
              </div>
            </div>
          </Section>
        </div>

        {/* ── Right: Live preview ──────────────────────────────────────────── */}
        {previewOpen && (
          <div className="lg:sticky lg:top-4 self-start">
            <div className="mb-2 flex items-center gap-2">
              <Eye size={13} className="text-gray-400" />
              <span className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Live Preview</span>
            </div>
            <div className="overflow-auto rounded-2xl border border-gray-200 dark:border-gray-700 bg-gray-100 dark:bg-gray-900 p-4" style={{ maxHeight: 640 }}>
              <div className="flex justify-center">
                <ReceiptPreview config={config} storeInfo={storeInfo} />
              </div>
            </div>
            <p className="text-xs text-gray-400 dark:text-gray-500 text-center mt-2">
              Sample data · actual receipt uses real order info
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
