import { useState, useEffect, useRef } from 'react'
import {
  Save, RefreshCw, Printer,
  Store, FileText, Type, LayoutList, Tag,
  AlignLeft, AlignCenter, AlignRight, Upload, X,
  ChevronDown, ChevronUp, UtensilsCrossed,
  RotateCcw, ShoppingBag, DollarSign, ArrowLeftRight,
} from 'lucide-react'
import clsx from 'clsx'
import { settingsApi } from '../../services/api'
import Button from '../ui/Button'

// ── Font options (must mirror printController FONT_MAP) ───────────────────────
const FONT_OPTIONS = [
  { value: 'monospace', label: 'Courier (Thermal)', css: "'Courier New', Courier, monospace" },
  { value: 'sans',      label: 'System Sans-serif', css: "system-ui, Arial, sans-serif" },
  { value: 'arial',     label: 'Arial',             css: "Arial, Helvetica, sans-serif" },
  { value: 'serif',     label: 'Georgia (Serif)',   css: "Georgia, 'Times New Roman', serif" },
  { value: 'times',     label: 'Times New Roman',   css: "'Times New Roman', Times, serif" },
]

// ── Default config (must match printController DEFAULT_CONFIG) ─────────────────
const DEFAULT_CONFIG = {
  showLogo:            false,
  logoUrl:             '',
  showRestaurantName:  true,
  restaurantNameSize:  'large',
  restaurantNameBold:  true,
  showAddress:         true,
  showPhone:           true,
  showEmail:           false,
  showWebsite:         false,
  websiteText:         '',
  headerText:          '',
  headerAlign:         'center',
  showOrderId:         true,
  showTableNumber:     true,
  showWaiter:          true,
  showOrderType:       false,
  showDate:            true,
  showUnitPrice:       false,
  showSubtotal:        true,
  showDiscount:        true,
  showPaymentDetails:  true,
  showSignatureLine:   false,
  signatureLabel:      'Signature: ____________________',
  // ── QR Payment ──────────────────────────────────────────────────────────────
  showQrPayment:       false,
  qrPaymentLabel:      'Scan to Pay',
  // ── Alt currencies on receipt ────────────────────────────────────────────────
  showAltCurrencies:   false,
  footerText:          'Thank you for dining with us!',
  footerAlign:         'center',
  labelReceipt:        'RECEIPT',
  labelTable:          'Table',
  labelWaiter:         'Waiter',
  labelOrder:          'Order',
  labelOrderType:      'Type',
  labelSubtotal:       'Subtotal',
  labelTotal:          'TOTAL',
  labelDiscount:       'Discount',
  labelPayment:        'Payment',
  paperWidth:          '80mm',
  fontSize:            12,
  fontFamily:          'monospace',
  showDividers:        true,
  dividerStyle:        'dashed',
}

// ── Mock order for live preview ───────────────────────────────────────────────
const MOCK = {
  id:          'ORD-042',
  tableNumber: 5,
  waiter:      'Souphaphone',
  orderType:   'Dine In',
  createdAt:   new Date().toISOString(),
  subtotal:    142000,
  discount:    0,
  total:       142000,
  items: [
    { name: 'Beef Pho',      quantity: 2, lineTotal: 80000, modifiers: [], notes: '' },
    { name: 'Spring Rolls',  quantity: 1, lineTotal: 35000, modifiers: [{ name: 'Extra sauce', priceAdjustment: 5000 }], notes: '' },
    { name: 'Coconut Juice', quantity: 2, lineTotal: 27000, modifiers: [], notes: '' },
  ],
  payments: [{ paymentMethod: 'Cash', amount: 142000 }],
}

// ─── Shared UI atoms ──────────────────────────────────────────────────────────
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
      {children && config[cfgKey] && <div className="mt-2">{children}</div>}
    </div>
  )
}

function TextInput({ value, onChange, placeholder, className = '' }) {
  return (
    <input
      type="text"
      value={value || ''}
      onChange={e => onChange(e.target.value)}
      placeholder={placeholder}
      className={clsx(
        'w-full px-2.5 py-1.5 text-sm rounded-lg border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700/50 text-gray-800 dark:text-gray-100 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent',
        className,
      )}
    />
  )
}

function AlignBtns({ value, onChange }) {
  return (
    <div className="flex gap-1">
      {[{ v: 'left', Icon: AlignLeft }, { v: 'center', Icon: AlignCenter }, { v: 'right', Icon: AlignRight }].map(({ v, Icon }) => (
        <button key={v} onClick={() => onChange(v)}
          className={clsx('p-1.5 rounded-lg border transition-colors',
            value === v ? 'bg-teal-600 text-white border-teal-600' : 'bg-white dark:bg-gray-700 border-gray-200 dark:border-gray-600 text-gray-500 hover:border-teal-400',
          )}>
          <Icon size={14} />
        </button>
      ))}
    </div>
  )
}

function ChipGroup({ options, value, onChange }) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map(o => (
        <button key={o.value} onClick={() => onChange(o.value)}
          className={clsx('px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors',
            value === o.value ? 'bg-teal-600 text-white border-teal-600' : 'bg-white dark:bg-gray-700 border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-300 hover:border-teal-400',
          )}
          style={o.fontCss ? { fontFamily: o.fontCss } : undefined}>
          {o.label}
        </button>
      ))}
    </div>
  )
}

// ── {Variable} badge — shows orange in template panel ────────────────────────
function VarTag({ label }) {
  return (
    <span className="inline-block font-mono text-[10px] px-1 py-0.5 rounded bg-orange-50 border border-orange-200 text-orange-600 leading-tight"
          style={{ fontFamily: 'monospace' }}>
      {'{' + label + '}'}
    </span>
  )
}

// ── Template Panel — mirrors receipt layout but shows {placeholders} ──────────
function TemplatePanel({ config }) {
  const fontSize = Math.max(8, Math.min(18, parseInt(config.fontSize) || 12))
  const fontCss  = (FONT_OPTIONS.find(f => f.value === config.fontFamily) || FONT_OPTIONS[0]).css
  const paperPx  = config.paperWidth === '58mm' ? 220 : 300
  const hAlign   = config.headerAlign || 'center'
  const fAlign   = config.footerAlign || 'center'
  const nameFs   = config.restaurantNameSize === 'xlarge' ? fontSize + 6 : config.restaurantNameSize === 'normal' ? fontSize + 2 : fontSize + 4
  const divStyle = {
    dashed: { borderTop: '1px dashed #f97316', margin: '5px 0', opacity: 0.4 },
    solid:  { borderTop: '2px solid #f97316',  margin: '5px 0', opacity: 0.4 },
    double: { borderTop: '3px double #f97316', margin: '5px 0', opacity: 0.4 },
  }[config.dividerStyle] || { borderTop: '1px dashed #f97316', margin: '5px 0', opacity: 0.4 }

  const lbl = (key, fallback) => config[key] || fallback

  return (
    <div style={{ width: paperPx, minHeight: 200, padding: '14px 12px', fontSize, fontFamily: fontCss, background: '#fff', color: '#111' }}
         className="shadow-2xl">

      {/* Logo */}
      {config.showLogo && (
        <div style={{ textAlign: 'center', marginBottom: 6 }}>
          {config.logoUrl
            ? <img src={config.logoUrl} alt="logo" style={{ maxHeight: 48, maxWidth: 120, objectFit: 'contain' }} />
            : <div style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 48, height: 48, background: '#f3f4f6', borderRadius: 8, border: '1px dashed #d1d5db' }}>
                <UtensilsCrossed size={20} color="#9ca3af" />
              </div>
          }
        </div>
      )}

      {/* Header */}
      <div style={{ textAlign: hAlign, marginBottom: 8 }}>
        {config.showRestaurantName && (
          <div style={{ fontSize: nameFs, fontWeight: config.restaurantNameBold !== false ? 'bold' : 'normal' }}>
            <VarTag label="restaurant_name" />
          </div>
        )}
        {config.showAddress && (
          <div style={{ fontSize: fontSize - 2, color: '#888', marginTop: 2 }}><VarTag label="address" /></div>
        )}
        {config.showPhone && (
          <div style={{ fontSize: fontSize - 2, color: '#888', marginTop: 2 }}>Tel: <VarTag label="phone" /></div>
        )}
        {config.showEmail && (
          <div style={{ fontSize: fontSize - 2, color: '#888', marginTop: 2 }}><VarTag label="email" /></div>
        )}
        {config.showWebsite && (
          <div style={{ fontSize: fontSize - 2, color: '#888', marginTop: 2 }}><VarTag label="website" /></div>
        )}
        {config.headerText && (
          <div style={{ fontSize: fontSize - 1, color: '#666', fontStyle: 'italic', marginTop: 3 }}>{config.headerText}</div>
        )}
        <div style={{ fontSize: fontSize + 1, fontWeight: 'bold', marginTop: 6 }}>— {lbl('labelReceipt', 'RECEIPT')} —</div>
        <div style={{ fontSize: fontSize - 2, color: '#555', marginTop: 3, lineHeight: 1.8 }}>
          {config.showOrderId     && <><span style={{ color: '#888' }}>{lbl('labelOrder', 'Order')}:</span> <VarTag label="order_id" /><br /></>}
          {config.showTableNumber && <><span style={{ color: '#888' }}>{lbl('labelTable', 'Table')}:</span> <VarTag label="table_no" /><br /></>}
          {config.showOrderType   && <><span style={{ color: '#888' }}>{lbl('labelOrderType', 'Type')}:</span> <VarTag label="order_type" /><br /></>}
          {config.showWaiter      && <><span style={{ color: '#888' }}>{lbl('labelWaiter', 'Waiter')}:</span> <VarTag label="waiter_name" /><br /></>}
          {config.showDate        && <><VarTag label="date_time" /></>}
        </div>
      </div>

      {config.showDividers && <div style={divStyle} />}

      {/* Items table */}
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize }}>
        <thead>
          <tr style={{ fontSize: fontSize - 2, borderBottom: '1px solid #e5e7eb', textTransform: 'uppercase', letterSpacing: '0.5px', color: '#6b7280' }}>
            <th style={{ textAlign: 'left', paddingBottom: 3, width: '55%' }}>Item</th>
            <th style={{ textAlign: 'center', paddingBottom: 3, width: '10%' }}>Qty</th>
            <th style={{ textAlign: 'right', paddingBottom: 3, width: '35%' }}>Amount</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td style={{ padding: '5px 0', verticalAlign: 'top' }}><VarTag label="item_name" /></td>
            <td style={{ padding: '5px 0', textAlign: 'center', verticalAlign: 'top' }}><VarTag label="qty" /></td>
            <td style={{ padding: '5px 0', textAlign: 'right', verticalAlign: 'top' }}><VarTag label="amount" /></td>
          </tr>
          {config.showUnitPrice && (
            <tr>
              <td colSpan={2} style={{ fontSize: fontSize - 2, color: '#aaa', paddingLeft: 4, paddingBottom: 4 }}>
                @ <VarTag label="unit_price" /> each
              </td>
              <td />
            </tr>
          )}
          <tr style={{ opacity: 0.45 }}>
            <td style={{ padding: '4px 0', verticalAlign: 'top' }}><VarTag label="item_name" /></td>
            <td style={{ padding: '4px 0', textAlign: 'center', verticalAlign: 'top' }}><VarTag label="qty" /></td>
            <td style={{ padding: '4px 0', textAlign: 'right', verticalAlign: 'top' }}><VarTag label="amount" /></td>
          </tr>
          <tr style={{ opacity: 0.2 }}>
            <td style={{ padding: '4px 0', verticalAlign: 'top' }}><VarTag label="item_name" /></td>
            <td style={{ padding: '4px 0', textAlign: 'center', verticalAlign: 'top' }}><VarTag label="qty" /></td>
            <td style={{ padding: '4px 0', textAlign: 'right', verticalAlign: 'top' }}><VarTag label="amount" /></td>
          </tr>
        </tbody>
      </table>

      {/* Totals */}
      {config.showDividers && <div style={divStyle} />}
      <div style={{ fontSize: fontSize - 1 }}>
        {config.showSubtotal && (
          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '2px 0' }}>
            <span style={{ color: '#888' }}>{lbl('labelSubtotal', 'Subtotal')}</span>
            <VarTag label="subtotal" />
          </div>
        )}
        {config.showDiscount && (
          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '2px 0', color: '#16a34a' }}>
            <span>{lbl('labelDiscount', 'Discount')}</span>
            <VarTag label="discount" />
          </div>
        )}
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: fontSize + 2, fontWeight: 'bold', borderTop: '1px solid #111', marginTop: 3, paddingTop: 3 }}>
          <span>{lbl('labelTotal', 'TOTAL')}</span>
          <VarTag label="total_amount" />
        </div>
      </div>

      {/* Payment */}
      {config.showPaymentDetails && (
        <>
          {config.showDividers && <div style={divStyle} />}
          <div style={{ fontSize: fontSize - 2, textTransform: 'uppercase', letterSpacing: '0.5px', color: '#555', marginBottom: 3 }}>{lbl('labelPayment', 'Payment')}</div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: fontSize - 1 }}>
            <VarTag label="payment_method" />
            <VarTag label="amount_paid" />
          </div>
        </>
      )}

      {/* Signature line */}
      {config.showSignatureLine && (
        <>
          {config.showDividers && <div style={divStyle} />}
          <div style={{ fontSize: fontSize - 1, marginTop: 4, color: '#888' }}>{config.signatureLabel || 'Signature: ____________________'}</div>
        </>
      )}

      {/* Alt currency totals placeholder */}
      {config.showAltCurrencies && (
        <>
          {config.showDividers && <div style={divStyle} />}
          <div style={{ fontSize: fontSize - 2, color: '#555', textAlign: 'center', lineHeight: 1.8 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '1px 0' }}>
              <span style={{ color: '#888' }}>$ USD</span>
              <span>≈ <VarTag label="usd_total" /></span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '1px 0' }}>
              <span style={{ color: '#888' }}>฿ THB</span>
              <span>≈ <VarTag label="thb_total" /></span>
            </div>
          </div>
        </>
      )}

      {/* Footer */}
      {config.showDividers && <div style={divStyle} />}
      <div style={{ textAlign: fAlign, fontSize: fontSize - 2, color: '#aaa', marginTop: 4, lineHeight: 1.5 }}>
        {config.footerText || <VarTag label="footer_text" />}
      </div>

      {/* QR payment placeholder — always at the very bottom */}
      {config.showQrPayment && (
        <>
          {config.showDividers && <div style={divStyle} />}
          <div style={{ textAlign: 'center', marginTop: 6, marginBottom: 4 }}>
            <div style={{ fontSize: fontSize - 2, color: '#555', marginBottom: 5, fontWeight: 600, letterSpacing: 0.3 }}>
              {config.qrPaymentLabel || 'Scan to Pay'}
            </div>
            <div style={{ width: 80, height: 80, margin: '0 auto', background: '#f3f4f6', border: '1.5px dashed #d1d5db', borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <span style={{ fontSize: 9, color: '#9ca3af', textAlign: 'center', lineHeight: 1.4 }}>QR<br/>Code</span>
            </div>
          </div>
        </>
      )}
    </div>
  )
}

// ── Live receipt preview (real data) ─────────────────────────────────────────
function ReceiptPreview({ config, storeInfo }) {
  const cur      = storeInfo.currency || 'LAK'
  const fontSize = Math.max(8, Math.min(18, parseInt(config.fontSize) || 12))
  const fontCss  = (FONT_OPTIONS.find(f => f.value === config.fontFamily) || FONT_OPTIONS[0]).css
  const paperPx  = config.paperWidth === '58mm' ? 220 : 300
  const hAlign   = config.headerAlign || 'center'
  const fAlign   = config.footerAlign || 'center'
  const nameFs   = config.restaurantNameSize === 'xlarge' ? fontSize + 6 : config.restaurantNameSize === 'normal' ? fontSize + 2 : fontSize + 4
  const divStyle = {
    dashed: { borderTop: '1px dashed #aaa', margin: '5px 0' },
    solid:  { borderTop: '2px solid #888',  margin: '5px 0' },
    double: { borderTop: '3px double #666', margin: '5px 0' },
  }[config.dividerStyle] || { borderTop: '1px dashed #aaa', margin: '5px 0' }

  const fmt = n => `${parseFloat(n || 0).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })} ${cur}`
  const lbl = (key, fallback) => config[key] || fallback
  const now = new Date().toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' })

  return (
    <div style={{ width: paperPx, minHeight: 200, padding: '14px 12px', fontSize, fontFamily: fontCss, background: '#fff', color: '#111' }}
         className="shadow-2xl">

      {config.showLogo && config.logoUrl && (
        <div style={{ textAlign: 'center', marginBottom: 6 }}>
          <img src={config.logoUrl} alt="logo" style={{ maxHeight: 48, maxWidth: 120, objectFit: 'contain' }} />
        </div>
      )}

      <div style={{ textAlign: hAlign, marginBottom: 8 }}>
        {config.showRestaurantName && (
          <div style={{ fontSize: nameFs, fontWeight: config.restaurantNameBold !== false ? 'bold' : 'normal', letterSpacing: 0.5 }}>
            {storeInfo.name || 'My Restaurant'}
          </div>
        )}
        {config.showAddress && storeInfo.address && <div style={{ fontSize: fontSize - 2, color: '#666', marginTop: 2 }}>{storeInfo.address}</div>}
        {config.showPhone && storeInfo.phone && <div style={{ fontSize: fontSize - 2, color: '#666', marginTop: 2 }}>Tel: {storeInfo.phone}</div>}
        {config.showEmail && storeInfo.email && <div style={{ fontSize: fontSize - 2, color: '#666', marginTop: 2 }}>{storeInfo.email}</div>}
        {config.showWebsite && config.websiteText && <div style={{ fontSize: fontSize - 2, color: '#666', marginTop: 2 }}>{config.websiteText}</div>}
        {config.headerText && <div style={{ fontSize: fontSize - 1, color: '#444', fontStyle: 'italic', marginTop: 3 }}>{config.headerText}</div>}
        <div style={{ fontSize: fontSize + 1, fontWeight: 'bold', marginTop: 6 }}>— {lbl('labelReceipt', 'RECEIPT')} —</div>
        <div style={{ fontSize: fontSize - 2, color: '#555', marginTop: 3, lineHeight: 1.5 }}>
          {config.showOrderId     && <>{lbl('labelOrder', 'Order')}: {MOCK.id}<br /></>}
          {config.showTableNumber && <>{lbl('labelTable', 'Table')}: {MOCK.tableNumber}<br /></>}
          {config.showOrderType   && <>{lbl('labelOrderType', 'Type')}: {MOCK.orderType}<br /></>}
          {config.showWaiter      && <>{lbl('labelWaiter', 'Waiter')}: {MOCK.waiter}<br /></>}
          {config.showDate        && <>{now}</>}
        </div>
      </div>

      {config.showDividers && <div style={divStyle} />}

      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize }}>
        <thead>
          <tr style={{ fontSize: fontSize - 2, borderBottom: '1px solid #ccc', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
            <th style={{ textAlign: 'left', paddingBottom: 3, width: '55%' }}>Item</th>
            <th style={{ textAlign: 'center', paddingBottom: 3, width: '10%' }}>Qty</th>
            <th style={{ textAlign: 'right', paddingBottom: 3, width: '35%' }}>Amount</th>
          </tr>
        </thead>
        <tbody>
          {MOCK.items.map((item, i) => (
            <tr key={i}>
              <td style={{ padding: '3px 0', verticalAlign: 'top', lineHeight: 1.3 }}>{item.name}</td>
              <td style={{ padding: '3px 0', textAlign: 'center', verticalAlign: 'top' }}>{item.quantity}×</td>
              <td style={{ padding: '3px 0', textAlign: 'right', fontWeight: 600, verticalAlign: 'top' }}>{fmt(item.lineTotal)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {config.showDividers && <div style={divStyle} />}
      <div style={{ fontSize: fontSize - 1 }}>
        {config.showSubtotal && (
          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '2px 0' }}>
            <span>{lbl('labelSubtotal', 'Subtotal')}</span><span>{fmt(MOCK.subtotal)}</span>
          </div>
        )}
        {config.showDiscount && MOCK.discount > 0 && (
          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '2px 0', color: '#16a34a' }}>
            <span>{lbl('labelDiscount', 'Discount')}</span><span>-{fmt(MOCK.discount)}</span>
          </div>
        )}
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: fontSize + 2, fontWeight: 'bold', borderTop: '1px solid #111', marginTop: 3, paddingTop: 3 }}>
          <span>{lbl('labelTotal', 'TOTAL')}</span><span>{fmt(MOCK.total)}</span>
        </div>
      </div>

      {config.showPaymentDetails && (
        <>
          {config.showDividers && <div style={divStyle} />}
          <div style={{ fontSize: fontSize - 2, textTransform: 'uppercase', letterSpacing: '0.5px', color: '#555', marginBottom: 3 }}>{lbl('labelPayment', 'Payment')}</div>
          {MOCK.payments.map((p, i) => (
            <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: fontSize - 1, padding: '1px 0', textTransform: 'capitalize' }}>
              <span>{p.paymentMethod}</span><span>{fmt(p.amount)}</span>
            </div>
          ))}
        </>
      )}

      {config.showSignatureLine && (
        <>
          {config.showDividers && <div style={divStyle} />}
          <div style={{ fontSize: fontSize - 1, marginTop: 4 }}>{config.signatureLabel || 'Signature: ____________________'}</div>
        </>
      )}

      {/* Alt currency totals */}
      {config.showAltCurrencies && !(storeInfo.exchangeRates?.USD || storeInfo.exchangeRates?.THB) && (
        <>
          {config.showDividers && <div style={divStyle} />}
          <div style={{ fontSize: fontSize - 2, color: '#bbb', textAlign: 'center', fontStyle: 'italic' }}>
            Set USD / THB rates in Store settings
          </div>
        </>
      )}
      {config.showAltCurrencies && (storeInfo.exchangeRates?.USD || storeInfo.exchangeRates?.THB) && (
        <>
          {config.showDividers && <div style={divStyle} />}
          <div style={{ fontSize: fontSize - 2, color: '#555' }}>
            {storeInfo.exchangeRates?.USD && (
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '1px 0' }}>
                <span style={{ color: '#888' }}>$ USD</span>
                <span>≈ {(MOCK.total * storeInfo.exchangeRates.USD).toFixed(2)}</span>
              </div>
            )}
            {storeInfo.exchangeRates?.THB && (
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '1px 0' }}>
                <span style={{ color: '#888' }}>฿ THB</span>
                <span>≈ {(MOCK.total * storeInfo.exchangeRates.THB).toFixed(2)}</span>
              </div>
            )}
          </div>
        </>
      )}

      {config.showDividers && <div style={divStyle} />}
      <div style={{ textAlign: fAlign, fontSize: fontSize - 2, color: '#777', marginTop: 4, lineHeight: 1.5 }}>
        {config.footerText || 'Thank you for dining with us!'}
      </div>

      {/* QR payment — always at the very bottom */}
      {config.showQrPayment && (
        <>
          {config.showDividers && <div style={divStyle} />}
          <div style={{ textAlign: 'center', margin: '6px 0 4px' }}>
            <div style={{ fontSize: fontSize - 2, color: '#555', marginBottom: 5, fontWeight: 600, letterSpacing: 0.3 }}>
              {config.qrPaymentLabel || 'Scan to Pay'}
            </div>
            {storeInfo.paymentQrImage ? (
              <img src={storeInfo.paymentQrImage} alt="QR" style={{ width: 80, height: 80, objectFit: 'contain', margin: '0 auto', display: 'block' }} />
            ) : (
              <div style={{ width: 80, height: 80, margin: '0 auto', background: '#f3f4f6', border: '1.5px dashed #d1d5db', borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <span style={{ fontSize: 9, color: '#9ca3af', textAlign: 'center', lineHeight: 1.4 }}>Upload QR<br/>in Payments</span>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}

// ── Collapsible config section ────────────────────────────────────────────────
function ConfigSection({ icon: Icon, title, defaultOpen = false, children }) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div className="border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden mb-3">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-4 py-3 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
      >
        <div className="flex items-center gap-2">
          <Icon size={14} className="text-teal-600 dark:text-teal-400" />
          <span className="text-sm font-semibold text-gray-700 dark:text-gray-200">{title}</span>
        </div>
        {open ? <ChevronUp size={15} className="text-gray-400" /> : <ChevronDown size={15} className="text-gray-400" />}
      </button>
      {open && (
        <div className="px-4 bg-white dark:bg-gray-800 border-t border-gray-100 dark:border-gray-700">
          {children}
        </div>
      )}
    </div>
  )
}

// ── Kitchen Template Panel ────────────────────────────────────────────────────
function KitchenTemplatePanel({ config }) {
  const fontSize = Math.max(8, Math.min(18, parseInt(config.fontSize) || 12))
  const fontCss  = (FONT_OPTIONS.find(f => f.value === config.fontFamily) || FONT_OPTIONS[0]).css
  const divStyle = { borderTop: '1px dashed #f97316', margin: '5px 0', opacity: 0.4 }
  return (
    <div style={{ width: 300, minHeight: 200, padding: '14px 12px', fontSize, fontFamily: fontCss, background: '#fff', color: '#111' }} className="shadow-2xl">
      <div style={{ textAlign: 'center', marginBottom: 8 }}>
        <div style={{ fontSize: fontSize + 2, fontWeight: 'bold' }}>— KITCHEN TICKET —</div>
        <div style={{ fontSize: fontSize - 1, color: '#555', marginTop: 4, lineHeight: 1.8 }}>
          Order: <VarTag label="order_id" /><br />
          Table: <VarTag label="table_no" /><br />
          <VarTag label="date_time" />
        </div>
      </div>
      <div style={divStyle} />
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize }}>
        <thead>
          <tr style={{ fontSize: fontSize - 2, borderBottom: '1px solid #ccc', textTransform: 'uppercase' }}>
            <th style={{ textAlign: 'left', paddingBottom: 3, width: '70%' }}>Item</th>
            <th style={{ textAlign: 'center', paddingBottom: 3 }}>Qty</th>
          </tr>
        </thead>
        <tbody>
          <tr><td style={{ padding: '4px 0' }}><VarTag label="item_name" /></td><td style={{ textAlign: 'center' }}><VarTag label="qty" /></td></tr>
          <tr style={{ opacity: 0.5 }}><td style={{ padding: '4px 0' }}><VarTag label="item_name" /></td><td style={{ textAlign: 'center' }}><VarTag label="qty" /></td></tr>
          <tr style={{ opacity: 0.2 }}><td style={{ padding: '4px 0' }}><VarTag label="item_name" /></td><td style={{ textAlign: 'center' }}><VarTag label="qty" /></td></tr>
        </tbody>
      </table>
      <div style={divStyle} />
      <div style={{ textAlign: 'center', fontSize: fontSize - 2, color: '#aaa', marginTop: 4 }}>Waiter: <VarTag label="waiter_name" /></div>
    </div>
  )
}

function KitchenPreviewPanel() {
  const now = new Date().toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' })
  const kitchenItems = [
    { name: 'Beef Pho', quantity: 2, notes: 'Less noodle' },
    { name: 'Spring Rolls', quantity: 1, notes: '' },
    { name: 'Coconut Juice', quantity: 2, notes: '' },
  ]
  return (
    <div style={{ width: 300, minHeight: 200, padding: '14px 12px', fontFamily: "'Courier New', monospace", fontSize: 12, background: '#fff', color: '#111' }} className="shadow-2xl">
      <div style={{ textAlign: 'center', marginBottom: 8 }}>
        <div style={{ fontSize: 14, fontWeight: 'bold' }}>— KITCHEN TICKET —</div>
        <div style={{ fontSize: 10, color: '#555', marginTop: 4, lineHeight: 1.8 }}>
          Order: ORD-042<br />Table: 5<br />{now}
        </div>
      </div>
      <div style={{ borderTop: '1px dashed #aaa', margin: '5px 0' }} />
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
        <thead>
          <tr style={{ fontSize: 10, borderBottom: '1px solid #ccc', textTransform: 'uppercase' }}>
            <th style={{ textAlign: 'left', paddingBottom: 3, width: '70%' }}>Item</th>
            <th style={{ textAlign: 'center', paddingBottom: 3 }}>Qty</th>
          </tr>
        </thead>
        <tbody>
          {kitchenItems.map((i, idx) => (
            <tr key={idx}>
              <td style={{ padding: '4px 0', lineHeight: 1.4 }}>
                <strong>{i.name}</strong>
                {i.notes && <div style={{ fontSize: 10, color: '#777', paddingLeft: 6 }}>↳ {i.notes}</div>}
              </td>
              <td style={{ textAlign: 'center', fontWeight: 'bold' }}>{i.quantity}×</td>
            </tr>
          ))}
        </tbody>
      </table>
      <div style={{ borderTop: '1px dashed #aaa', margin: '5px 0' }} />
      <div style={{ textAlign: 'center', fontSize: 10, color: '#aaa', marginTop: 4 }}>Waiter: Souphaphone</div>
    </div>
  )
}

// ── Draft Template Panel ──────────────────────────────────────────────────────
function DraftTemplatePanel({ config }) {
  const fontSize = Math.max(8, Math.min(18, parseInt(config.fontSize) || 12))
  const fontCss  = (FONT_OPTIONS.find(f => f.value === config.fontFamily) || FONT_OPTIONS[0]).css
  const divStyle = { borderTop: '1px dashed #f97316', margin: '5px 0', opacity: 0.4 }
  return (
    <div style={{ width: 300, minHeight: 200, padding: '14px 12px', fontSize, fontFamily: fontCss, background: '#fff', color: '#111', position: 'relative', overflow: 'hidden' }} className="shadow-2xl">
      <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-50%) rotate(-35deg)', fontSize: 36, fontWeight: 900, color: 'rgba(239,68,68,.1)', pointerEvents: 'none', whiteSpace: 'nowrap', letterSpacing: 3 }}>DRAFT</div>
      <div style={{ textAlign: 'center', marginBottom: 8 }}>
        <VarTag label="restaurant_name" />
        <div style={{ fontSize: fontSize - 2, color: '#888', marginTop: 2 }}>Tel: <VarTag label="phone" /></div>
        <div style={{ marginTop: 6, fontWeight: 'bold', fontSize: fontSize + 1, color: '#dc2626', border: '1.5px solid #dc2626', padding: '2px 8px', display: 'inline-block' }}>— DRAFT ORDER —</div>
        <div style={{ fontSize: fontSize - 2, color: '#555', marginTop: 4, lineHeight: 1.8 }}>
          Order: <VarTag label="order_id" /><br />
          Table: <VarTag label="table_no" /><br />
          Waiter: <VarTag label="waiter_name" /><br />
          <VarTag label="date_time" />
        </div>
      </div>
      <div style={divStyle} />
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize }}>
        <thead><tr style={{ fontSize: fontSize - 2, borderBottom: '1px solid #ccc', textTransform: 'uppercase' }}>
          <th style={{ textAlign: 'left', width: '55%', paddingBottom: 3 }}>Item</th>
          <th style={{ textAlign: 'center', width: '10%' }}>Qty</th>
          <th style={{ textAlign: 'right', width: '35%' }}>Amount</th>
        </tr></thead>
        <tbody>
          <tr><td style={{ padding: '4px 0' }}><VarTag label="item_name" /></td><td style={{ textAlign: 'center' }}><VarTag label="qty" /></td><td style={{ textAlign: 'right' }}><VarTag label="amount" /></td></tr>
          <tr style={{ opacity: 0.5 }}><td style={{ padding: '4px 0' }}><VarTag label="item_name" /></td><td style={{ textAlign: 'center' }}><VarTag label="qty" /></td><td style={{ textAlign: 'right' }}><VarTag label="amount" /></td></tr>
          <tr style={{ opacity: 0.2 }}><td style={{ padding: '4px 0' }}><VarTag label="item_name" /></td><td style={{ textAlign: 'center' }}><VarTag label="qty" /></td><td style={{ textAlign: 'right' }}><VarTag label="amount" /></td></tr>
        </tbody>
      </table>
      <div style={divStyle} />
      <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 'bold', fontSize: fontSize + 1, borderTop: '1px solid #111', paddingTop: 3 }}>
        <span>TOTAL</span><VarTag label="total_amount" />
      </div>
      <div style={divStyle} />
      <div style={{ textAlign: 'center', fontSize: fontSize - 2, color: '#aaa', fontStyle: 'italic' }}>⚠ This is a draft — not a final receipt</div>
    </div>
  )
}

function DraftPreviewPanel({ config, storeInfo }) {
  const fontSize = Math.max(8, Math.min(18, parseInt(config.fontSize) || 12))
  const fontCss  = (FONT_OPTIONS.find(f => f.value === config.fontFamily) || FONT_OPTIONS[0]).css
  const cur = storeInfo.currency || 'LAK'
  const fmt = n => `${parseFloat(n||0).toLocaleString()} ${cur}`
  const now = new Date().toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' })
  return (
    <div style={{ width: 300, minHeight: 200, padding: '14px 12px', fontSize, fontFamily: fontCss, background: '#fff', color: '#111', position: 'relative', overflow: 'hidden' }} className="shadow-2xl">
      <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-50%) rotate(-35deg)', fontSize: 36, fontWeight: 900, color: 'rgba(239,68,68,.1)', pointerEvents: 'none', whiteSpace: 'nowrap', letterSpacing: 3 }}>DRAFT</div>
      <div style={{ textAlign: 'center', marginBottom: 8 }}>
        <div style={{ fontSize: fontSize + 3, fontWeight: 'bold' }}>{storeInfo.name || 'My Restaurant'}</div>
        {storeInfo.phone && <div style={{ fontSize: fontSize - 2, color: '#888', marginTop: 2 }}>Tel: {storeInfo.phone}</div>}
        <div style={{ marginTop: 6, fontWeight: 'bold', fontSize: fontSize + 1, color: '#dc2626', border: '1.5px solid #dc2626', padding: '2px 8px', display: 'inline-block' }}>— DRAFT ORDER —</div>
        <div style={{ fontSize: fontSize - 2, color: '#555', marginTop: 4, lineHeight: 1.8 }}>
          Order: ORD-042<br />Table: 5<br />Waiter: Souphaphone<br />{now}
        </div>
      </div>
      <div style={{ borderTop: '1px dashed #aaa', margin: '5px 0' }} />
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize }}>
        <thead><tr style={{ fontSize: fontSize - 2, borderBottom: '1px solid #ccc', textTransform: 'uppercase' }}>
          <th style={{ textAlign: 'left', width: '55%' }}>Item</th><th style={{ textAlign: 'center' }}>Qty</th><th style={{ textAlign: 'right' }}>Amount</th>
        </tr></thead>
        <tbody>
          {MOCK.items.map((item, i) => <tr key={i}><td style={{ padding: '3px 0' }}>{item.name}</td><td style={{ textAlign: 'center' }}>{item.quantity}×</td><td style={{ textAlign: 'right' }}>{fmt(item.lineTotal)}</td></tr>)}
        </tbody>
      </table>
      <div style={{ borderTop: '1px dashed #aaa', margin: '5px 0' }} />
      <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 'bold', fontSize: fontSize + 1, borderTop: '1px solid #111', paddingTop: 3 }}>
        <span>TOTAL</span><span>{fmt(MOCK.total)}</span>
      </div>
      <div style={{ borderTop: '1px dashed #aaa', margin: '5px 0' }} />
      <div style={{ textAlign: 'center', fontSize: fontSize - 2, color: '#aaa', fontStyle: 'italic' }}>⚠ This is a draft — not a final receipt</div>
    </div>
  )
}

// ── Shared A5 document wrapper ────────────────────────────────────────────────
const A5_W = 400
function A5Doc({ children }) {
  return (
    <div style={{ width: A5_W, fontFamily: 'Arial, sans-serif', fontSize: 10, color: '#111', background: '#fff', padding: '14px 16px', lineHeight: 1.4 }} className="shadow-2xl">
      {children}
    </div>
  )
}
function A5Divider() { return <div style={{ borderTop: '1px dashed #bbb', margin: '6px 0' }} /> }
function A5SigRow({ labels }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-around', marginTop: 24, textAlign: 'center' }}>
      {labels.map((l, i) => (
        <div key={i} style={{ flex: 1, padding: '0 8px' }}>
          <div style={{ borderTop: '1px solid #333', marginTop: 20, paddingTop: 3, fontSize: 9, color: '#555' }}>{l}</div>
        </div>
      ))}
    </div>
  )
}
function A5Table({ headers, rows }) {
  return (
    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 9.5, margin: '6px 0' }}>
      <thead>
        <tr>{headers.map((h, i) => <th key={i} style={{ background: '#f3f4f6', padding: '4px 3px', border: '1px solid #ddd', textAlign: typeof h === 'object' ? h.align || 'center' : 'center', fontWeight: 700 }}>{typeof h === 'object' ? h.label : h}</th>)}</tr>
      </thead>
      <tbody>
        {rows.map((row, ri) => (
          <tr key={ri} style={{ opacity: ri > 0 ? Math.max(0.2, 1 - ri * 0.35) : 1 }}>
            {row.map((cell, ci) => <td key={ci} style={{ padding: '3px', border: '1px solid #e5e7eb', textAlign: typeof headers[ci] === 'object' ? headers[ci].align || 'center' : 'center' }}>{cell}</td>)}
          </tr>
        ))}
      </tbody>
    </table>
  )
}
function A5Info({ label, value }) {
  return <div style={{ margin: '2px 0', fontSize: 10 }}><span style={{ color: '#666' }}>{label}:</span> <strong>{value}</strong></div>
}

// ── Return Invoice panels ─────────────────────────────────────────────────────
function ReturnTemplatePanel() {
  return (
    <A5Doc>
      <div style={{ textAlign: 'center', marginBottom: 6 }}>
        <VarTag label="restaurant_name" /><span style={{ margin: '0 4px', color: '#aaa' }}>·</span><VarTag label="address" /><span style={{ margin: '0 4px', color: '#aaa' }}>·</span><VarTag label="phone" />
      </div>
      <div style={{ textAlign: 'center', fontWeight: 800, fontSize: 14, margin: '8px 0 2px' }}>RETURN INVOICE</div>
      <div style={{ textAlign: 'center', fontSize: 10, color: '#555' }}>ID: <VarTag label="return_id" /> &nbsp;·&nbsp; <VarTag label="date" /></div>
      <A5Divider />
      <A5Info label="Order Ref" value={<VarTag label="order_ref" />} />
      <A5Info label="Processed By" value={<VarTag label="processed_by" />} />
      <A5Info label="Reason" value={<VarTag label="reason" />} />
      <A5Divider />
      <A5Table
        headers={['#', { label: 'Item', align: 'left' }, 'Qty', 'Unit Price', 'Total']}
        rows={[
          ['1', <VarTag label="item_name" />, <VarTag label="qty" />, <VarTag label="unit_price" />, <VarTag label="line_total" />],
          ['2', <VarTag label="item_name" />, <VarTag label="qty" />, <VarTag label="unit_price" />, <VarTag label="line_total" />],
        ]}
      />
      <div style={{ textAlign: 'right', fontWeight: 800, fontSize: 12, borderTop: '2px solid #111', paddingTop: 3, marginTop: 4 }}>
        Total Refund: <VarTag label="total_refund" />
      </div>
      <A5Divider />
      <A5SigRow labels={['Processed By', 'Customer Signature']} />
    </A5Doc>
  )
}
function ReturnPreviewPanel() {
  const date = new Date().toLocaleDateString('en-US', { dateStyle: 'medium' })
  return (
    <A5Doc>
      <div style={{ textAlign: 'center', fontSize: 9, color: '#555', marginBottom: 4 }}>My Restaurant · 123 Main St · Tel: 020-555-0001</div>
      <div style={{ textAlign: 'center', fontWeight: 800, fontSize: 14, margin: '8px 0 2px' }}>RETURN INVOICE</div>
      <div style={{ textAlign: 'center', fontSize: 10, color: '#555' }}>ID: RET-0001 &nbsp;·&nbsp; {date}</div>
      <A5Divider />
      <A5Info label="Order Ref" value="ORD-042" />
      <A5Info label="Processed By" value="Souphaphone" />
      <A5Info label="Reason" value="Wrong item delivered" />
      <A5Divider />
      <A5Table
        headers={['#', { label: 'Item', align: 'left' }, 'Qty', 'Unit Price', 'Total']}
        rows={[
          ['1', 'Spring Rolls', '1', '35,000 LAK', '35,000 LAK'],
          ['2', 'Coconut Juice', '2', '13,500 LAK', '27,000 LAK'],
        ]}
      />
      <div style={{ textAlign: 'right', fontWeight: 800, fontSize: 12, borderTop: '2px solid #111', paddingTop: 3, marginTop: 4 }}>
        Total Refund: 62,000 LAK
      </div>
      <A5Divider />
      <A5SigRow labels={['Processed By', 'Customer Signature']} />
    </A5Doc>
  )
}

// ── Purchase Receipt panels ───────────────────────────────────────────────────
function PurchaseTemplatePanel() {
  return (
    <A5Doc>
      <div style={{ textAlign: 'center', fontSize: 9, color: '#555', marginBottom: 4 }}><VarTag label="restaurant_name" /> · <VarTag label="address" /></div>
      <div style={{ textAlign: 'center', fontWeight: 800, fontSize: 14, margin: '8px 0 2px' }}>PURCHASE ORDER RECEIPT</div>
      <div style={{ textAlign: 'center', fontSize: 10, color: '#555' }}>PO: <VarTag label="po_id" /> &nbsp;·&nbsp; <VarTag label="date" /></div>
      <A5Divider />
      <div style={{ display: 'flex', gap: 16 }}>
        <div style={{ flex: 1 }}>
          <A5Info label="Supplier" value={<VarTag label="supplier_name" />} />
          <A5Info label="Reference No" value={<VarTag label="reference_no" />} />
        </div>
        <div style={{ flex: 1 }}>
          <A5Info label="Status" value={<VarTag label="status" />} />
          <A5Info label="Expected" value={<VarTag label="expected_date" />} />
        </div>
      </div>
      <A5Divider />
      <A5Table
        headers={['#', { label: 'Item', align: 'left' }, 'Ordered', 'Received', 'Unit Cost', 'Total']}
        rows={[
          ['1', <VarTag label="item_name" />, <VarTag label="qty_ordered" />, <VarTag label="qty_received" />, <VarTag label="unit_cost" />, <VarTag label="line_total" />],
          ['2', <VarTag label="item_name" />, <VarTag label="qty_ordered" />, <VarTag label="qty_received" />, <VarTag label="unit_cost" />, <VarTag label="line_total" />],
        ]}
      />
      <div style={{ textAlign: 'right', fontWeight: 800, fontSize: 12, borderTop: '2px solid #111', paddingTop: 3, marginTop: 4 }}>
        Total: <VarTag label="total" />
      </div>
      <A5SigRow labels={['Created By', 'Supplier Representative', 'Approved By']} />
    </A5Doc>
  )
}
function PurchasePreviewPanel() {
  const date = new Date().toLocaleDateString('en-US', { dateStyle: 'medium' })
  return (
    <A5Doc>
      <div style={{ textAlign: 'center', fontSize: 9, color: '#555', marginBottom: 4 }}>My Restaurant · 123 Main St</div>
      <div style={{ textAlign: 'center', fontWeight: 800, fontSize: 14, margin: '8px 0 2px' }}>PURCHASE ORDER RECEIPT</div>
      <div style={{ textAlign: 'center', fontSize: 10, color: '#555' }}>PO: PO-0001 &nbsp;·&nbsp; {date}</div>
      <A5Divider />
      <div style={{ display: 'flex', gap: 16 }}>
        <div style={{ flex: 1 }}>
          <A5Info label="Supplier" value="Fresh Market Co." />
          <A5Info label="Reference No" value="REF-2025-001" />
        </div>
        <div style={{ flex: 1 }}>
          <A5Info label="Status" value="ordered" />
          <A5Info label="Expected" value={date} />
        </div>
      </div>
      <A5Divider />
      <A5Table
        headers={['#', { label: 'Item', align: 'left' }, 'Ordered', 'Received', 'Unit Cost', 'Total']}
        rows={[
          ['1', 'Beef (kg)', '10', '—', '45,000', '450,000'],
          ['2', 'Rice (bag)', '5', '—', '80,000', '400,000'],
        ]}
      />
      <div style={{ textAlign: 'right', fontWeight: 800, fontSize: 12, borderTop: '2px solid #111', paddingTop: 3, marginTop: 4 }}>
        Total: 850,000 LAK
      </div>
      <A5SigRow labels={['Created By', 'Supplier Representative', 'Approved By']} />
    </A5Doc>
  )
}

// ── Purchase Return panels ────────────────────────────────────────────────────
function PurchaseReturnTemplatePanel() {
  return (
    <A5Doc>
      <div style={{ textAlign: 'center', fontSize: 9, color: '#555', marginBottom: 4 }}><VarTag label="restaurant_name" /> · <VarTag label="address" /></div>
      <div style={{ textAlign: 'center', fontWeight: 800, fontSize: 14, margin: '8px 0 2px' }}>PURCHASE RETURN</div>
      <div style={{ textAlign: 'center', fontSize: 10, color: '#555' }}>ID: <VarTag label="return_id" /> &nbsp;·&nbsp; <VarTag label="date" /></div>
      <A5Divider />
      <div style={{ display: 'flex', gap: 16 }}>
        <div style={{ flex: 1 }}>
          <A5Info label="Supplier" value={<VarTag label="supplier_name" />} />
          <A5Info label="PO Reference" value={<VarTag label="po_reference" />} />
        </div>
        <div style={{ flex: 1 }}>
          <A5Info label="Status" value={<VarTag label="status" />} />
          <A5Info label="Reason" value={<VarTag label="reason" />} />
        </div>
      </div>
      <A5Divider />
      <A5Table
        headers={['#', { label: 'Item', align: 'left' }, 'Qty', 'Unit Cost', 'Total']}
        rows={[
          ['1', <VarTag label="item_name" />, <VarTag label="qty" />, <VarTag label="unit_cost" />, <VarTag label="line_total" />],
          ['2', <VarTag label="item_name" />, <VarTag label="qty" />, <VarTag label="unit_cost" />, <VarTag label="line_total" />],
        ]}
      />
      <div style={{ textAlign: 'right', fontWeight: 800, fontSize: 12, borderTop: '2px solid #111', paddingTop: 3, marginTop: 4 }}>
        Total Return: <VarTag label="total_return" />
      </div>
      <A5SigRow labels={['Created By', 'Supplier Received']} />
    </A5Doc>
  )
}
function PurchaseReturnPreviewPanel() {
  const date = new Date().toLocaleDateString('en-US', { dateStyle: 'medium' })
  return (
    <A5Doc>
      <div style={{ textAlign: 'center', fontSize: 9, color: '#555', marginBottom: 4 }}>My Restaurant · 123 Main St</div>
      <div style={{ textAlign: 'center', fontWeight: 800, fontSize: 14, margin: '8px 0 2px' }}>PURCHASE RETURN</div>
      <div style={{ textAlign: 'center', fontSize: 10, color: '#555' }}>ID: PR-0001 &nbsp;·&nbsp; {date}</div>
      <A5Divider />
      <div style={{ display: 'flex', gap: 16 }}>
        <div style={{ flex: 1 }}>
          <A5Info label="Supplier" value="Fresh Market Co." />
          <A5Info label="PO Reference" value="PO-0001" />
        </div>
        <div style={{ flex: 1 }}>
          <A5Info label="Status" value="pending" />
          <A5Info label="Reason" value="Damaged goods" />
        </div>
      </div>
      <A5Divider />
      <A5Table
        headers={['#', { label: 'Item', align: 'left' }, 'Qty', 'Unit Cost', 'Total']}
        rows={[
          ['1', 'Beef (kg)', '3', '45,000', '135,000'],
          ['2', 'Rice (bag)', '1', '80,000', '80,000'],
        ]}
      />
      <div style={{ textAlign: 'right', fontWeight: 800, fontSize: 12, borderTop: '2px solid #111', paddingTop: 3, marginTop: 4 }}>
        Total Return: 215,000 LAK
      </div>
      <A5SigRow labels={['Created By', 'Supplier Received']} />
    </A5Doc>
  )
}

// ── Cash In / Out panels ──────────────────────────────────────────────────────
function CashFlowTemplatePanel() {
  return (
    <A5Doc>
      <div style={{ textAlign: 'center', fontSize: 9, color: '#555', marginBottom: 4 }}><VarTag label="restaurant_name" /> · <VarTag label="address" /></div>
      <div style={{ textAlign: 'center', fontWeight: 800, fontSize: 13, margin: '8px 0 2px' }}>
        PHIẾU THU · CASH RECEIPT
        <div style={{ fontSize: 10, fontWeight: 400, color: '#888', marginTop: 2 }}>or &nbsp; PHIẾU CHI · PAYMENT SLIP</div>
      </div>
      <div style={{ textAlign: 'center', fontSize: 9, color: '#888' }}>ID: <VarTag label="entry_id" /> &nbsp;·&nbsp; <VarTag label="date" /></div>
      <div style={{ borderTop: '1px dashed #22c55e', margin: '6px 0', opacity: 0.6 }} />
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 10 }}>
        <tbody>
          <tr><td style={{ border: 'none', padding: '4px 0', color: '#666', width: '40%' }}>Description:</td><td style={{ border: 'none', padding: '4px 0' }}><strong><VarTag label="description" /></strong></td></tr>
          <tr><td style={{ border: 'none', padding: '4px 0', color: '#666' }}>Category:</td><td style={{ border: 'none', padding: '4px 0' }}><VarTag label="category" /></td></tr>
          <tr><td style={{ border: 'none', padding: '4px 0', color: '#666' }}>Reference:</td><td style={{ border: 'none', padding: '4px 0' }}><VarTag label="reference" /></td></tr>
        </tbody>
      </table>
      <A5Divider />
      <div style={{ textAlign: 'center', margin: '10px 0' }}>
        <div style={{ fontSize: 9, color: '#555', marginBottom: 3 }}>Amount</div>
        <div style={{ fontSize: 20, fontWeight: 900, color: '#16a34a' }}><VarTag label="amount" /></div>
        <div style={{ fontSize: 9, color: '#888', marginTop: 2 }}>green = income · red = expense</div>
      </div>
      <A5Divider />
      <A5SigRow labels={['Cashier', 'Payer / Recipient', 'Accountant']} />
    </A5Doc>
  )
}
function CashFlowPreviewPanel() {
  const date = new Date().toLocaleDateString('en-US', { dateStyle: 'long' })
  return (
    <A5Doc>
      <div style={{ textAlign: 'center', fontSize: 9, color: '#555', marginBottom: 4 }}>My Restaurant · 123 Main St</div>
      <div style={{ textAlign: 'center', fontWeight: 800, fontSize: 13, margin: '8px 0 2px' }}>PHIẾU THU · CASH RECEIPT</div>
      <div style={{ textAlign: 'center', fontSize: 9, color: '#888' }}>ID: 1 &nbsp;·&nbsp; {date}</div>
      <div style={{ borderTop: '1px dashed #22c55e', margin: '6px 0', opacity: 0.6 }} />
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 10 }}>
        <tbody>
          <tr><td style={{ border: 'none', padding: '4px 0', color: '#666', width: '40%' }}>Description:</td><td style={{ border: 'none', padding: '4px 0' }}><strong>Catering event payment</strong></td></tr>
          <tr><td style={{ border: 'none', padding: '4px 0', color: '#666' }}>Category:</td><td style={{ border: 'none', padding: '4px 0' }}>Catering</td></tr>
          <tr><td style={{ border: 'none', padding: '4px 0', color: '#666' }}>Reference:</td><td style={{ border: 'none', padding: '4px 0' }}>EVT-2025-001</td></tr>
        </tbody>
      </table>
      <A5Divider />
      <div style={{ textAlign: 'center', margin: '10px 0' }}>
        <div style={{ fontSize: 9, color: '#555', marginBottom: 3 }}>Amount Received</div>
        <div style={{ fontSize: 22, fontWeight: 900, color: '#16a34a', letterSpacing: 0.5 }}>500,000 LAK</div>
      </div>
      <A5Divider />
      <A5SigRow labels={['Cashier', 'Payer Signature', 'Accountant']} />
    </A5Doc>
  )
}

// ── Main component ────────────────────────────────────────────────────────────
const TEMPLATE_TABS = [
  { id: 'receipt',          label: 'Receipt',          icon: FileText,        configurable: true  },
  { id: 'kitchen',          label: 'Kitchen',          icon: UtensilsCrossed, configurable: false },
  { id: 'draft',            label: 'Draft Order',      icon: FileText,        configurable: false },
  { id: 'return',           label: 'Return Invoice',   icon: RotateCcw,       configurable: false },
  { id: 'purchase',         label: 'Purchase',         icon: ShoppingBag,     configurable: false },
  { id: 'purchase-return',  label: 'Purch. Return',    icon: ArrowLeftRight,  configurable: false },
  { id: 'cashflow',         label: 'Cash In / Out',    icon: DollarSign,      configurable: false },
]

export default function ReceiptConfigTab({ isAdmin }) {
  const [config,    setConfig]    = useState(DEFAULT_CONFIG)
  const [original,  setOriginal]  = useState(DEFAULT_CONFIG)
  const [storeInfo, setStoreInfo] = useState({})
  const [loading,   setLoading]   = useState(true)
  const [saving,    setSaving]    = useState(false)
  const [toast,     setToast]     = useState(null)
  const [activeTab, setActiveTab] = useState('receipt')
  const logoInputRef = useRef(null)

  useEffect(() => {
    setLoading(true)
    settingsApi.store.get()
      .then(data => {
        setStoreInfo({
          name: data.name, phone: data.phone, email: data.email,
          address: data.address, currency: data.currency, logoUrl: data.logoUrl,
          exchangeRates:  data.settings?.exchangeRates  || {},
          paymentQrImage: data.settings?.payment?.qrImageBase64 || '',
        })
        const saved  = data.settings?.receipt || {}
        const merged = { ...DEFAULT_CONFIG, ...saved }
        setConfig(merged)
        setOriginal(merged)
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const handleChange = (key, value) => setConfig(prev => ({ ...prev, [key]: value }))

  function handleLogoFile(file) {
    if (!file || !file.type.startsWith('image/')) return
    if (file.size > 2 * 1024 * 1024) { showToast('error', 'Logo image must be < 2 MB'); return }
    const reader = new FileReader()
    reader.onload = e => handleChange('logoUrl', e.target.result)
    reader.readAsDataURL(file)
  }

  async function handleSave() {
    setSaving(true)
    try {
      const storeData = await settingsApi.store.get()
      const existing  = storeData.settings || {}
      await settingsApi.store.update({ settings: { ...existing, receipt: config } })
      setOriginal(config)
      showToast('success', 'Receipt layout saved!')
    } catch (err) {
      showToast('error', err.message || 'Failed to save')
    }
    setSaving(false)
  }

  function showToast(type, msg) {
    setToast({ type, msg })
    setTimeout(() => setToast(null), 3000)
  }

  const isDirty = JSON.stringify(config) !== JSON.stringify(original)

  if (loading) return (
    <div className="flex items-center justify-center py-16">
      <div className="w-8 h-8 border-2 border-teal-500 border-t-transparent rounded-full animate-spin" />
    </div>
  )

  return (
    <div className="relative">
      {/* Toast */}
      {toast && (
        <div className={clsx(
          'fixed top-5 right-5 z-50 px-4 py-2.5 rounded-xl shadow-lg text-sm font-medium text-white',
          toast.type === 'success' ? 'bg-teal-600' : 'bg-red-500',
        )}>
          {toast.msg}
        </div>
      )}

      {/* ── Page header ──────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between mb-5 flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-teal-600 rounded-xl flex items-center justify-center shadow">
            <Printer size={16} className="text-white" />
          </div>
          <div>
            <h3 className="text-base font-bold text-gray-900 dark:text-gray-100">Print Templates</h3>
            <p className="text-xs text-gray-400 dark:text-gray-500">Left = template structure · Right = live preview with sample data</p>
          </div>
        </div>
        {isAdmin && activeTab === 'receipt' && (
          <div className="flex items-center gap-2">
            {isDirty && (
              <button onClick={() => setConfig(original)}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
                <RefreshCw size={13} /> Reset
              </button>
            )}
            <Button size="sm" icon={Save} onClick={handleSave} loading={saving} disabled={!isDirty && !saving}>
              Save Template
            </Button>
          </div>
        )}
      </div>

      {/* ── Template type tabs ─────────────────────────────────────────── */}
      <div className="flex items-center gap-0.5 border-b border-gray-200 dark:border-gray-700 mb-5 overflow-x-auto">
        {TEMPLATE_TABS.map(tab => (
          <button key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={clsx('flex items-center gap-1.5 px-3 py-2.5 text-xs font-medium border-b-2 -mb-px transition-colors whitespace-nowrap',
              activeTab === tab.id
                ? 'border-teal-500 text-teal-600 dark:text-teal-400'
                : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200',
            )}>
            <tab.icon size={12} />
            {tab.label}
          </button>
        ))}
      </div>

      {/* ── Two-panel viewer — all tabs ──────────────────────────────────── */}
      <div className="grid grid-cols-2 rounded-2xl overflow-hidden border border-gray-200 dark:border-gray-700 mb-6 shadow-sm">
        {/* Left: Template */}
        <div className="bg-gray-50 dark:bg-gray-900/60 border-r border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-gray-700 bg-white/70 dark:bg-gray-800/70">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-orange-400" />
              <span className="text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wider">Template</span>
            </div>
            <span className="text-[10px] text-gray-400 dark:text-gray-500 font-mono bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800 px-2 py-0.5 rounded">
              {'{'} variables {'}'}
            </span>
          </div>
          <div className="flex justify-center py-6 px-4 overflow-auto" style={{ minHeight: 400 }}>
            {activeTab === 'receipt'         && <TemplatePanel config={config} />}
            {activeTab === 'kitchen'         && <KitchenTemplatePanel config={config} />}
            {activeTab === 'draft'           && <DraftTemplatePanel config={config} />}
            {activeTab === 'return'          && <ReturnTemplatePanel />}
            {activeTab === 'purchase'        && <PurchaseTemplatePanel />}
            {activeTab === 'purchase-return' && <PurchaseReturnTemplatePanel />}
            {activeTab === 'cashflow'        && <CashFlowTemplatePanel />}
          </div>
        </div>

        {/* Right: Live Preview */}
        <div className="bg-gray-100 dark:bg-gray-900">
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-gray-700 bg-white/70 dark:bg-gray-800/70">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-teal-400" />
              <span className="text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wider">Live Preview</span>
            </div>
            <span className="text-[10px] text-gray-400 dark:text-gray-500">sample data</span>
          </div>
          <div className="flex justify-center py-6 px-4 overflow-auto" style={{ minHeight: 400 }}>
            {activeTab === 'receipt'         && <ReceiptPreview config={config} storeInfo={storeInfo} />}
            {activeTab === 'kitchen'         && <KitchenPreviewPanel />}
            {activeTab === 'draft'           && <DraftPreviewPanel config={config} storeInfo={storeInfo} />}
            {activeTab === 'return'          && <ReturnPreviewPanel />}
            {activeTab === 'purchase'        && <PurchasePreviewPanel />}
            {activeTab === 'purchase-return' && <PurchaseReturnPreviewPanel />}
            {activeTab === 'cashflow'        && <CashFlowPreviewPanel />}
          </div>
        </div>
      </div>

      {/* ── Config accordion (receipt tab only) ──────────────────────────── */}
      {activeTab === 'receipt' && <>
      <div className="mb-2 flex items-center gap-2">
        <div className="h-px flex-1 bg-gray-200 dark:bg-gray-700" />
        <span className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider px-2">Template Settings</span>
        <div className="h-px flex-1 bg-gray-200 dark:bg-gray-700" />
      </div>

      <div className="mt-4">

        {/* Branding */}
        <ConfigSection icon={Store} title="Branding" defaultOpen={true}>

          {/* Logo */}
          <ToggleRow label="Show Logo" desc="Display restaurant logo at the top" cfgKey="showLogo" config={config} onChange={handleChange}>
            {config.logoUrl ? (
              <div className="flex items-center gap-3 flex-wrap">
                <img src={config.logoUrl} alt="logo" className="h-10 max-w-24 object-contain bg-white rounded border border-gray-200 px-1 shadow-sm" />
                <button onClick={() => { handleChange('logoUrl', ''); if (logoInputRef.current) logoInputRef.current.value = '' }}
                  className="flex items-center gap-1 text-xs text-red-500 hover:text-red-700">
                  <X size={12} /> Remove
                </button>
                <button onClick={() => logoInputRef.current?.click()}
                  className="flex items-center gap-1 text-xs text-teal-600 hover:text-teal-700">
                  <Upload size={12} /> Replace
                </button>
              </div>
            ) : (
              <div onClick={() => logoInputRef.current?.click()}
                className="flex items-center gap-2 px-3 py-2 rounded-lg border-2 border-dashed border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700/30 cursor-pointer hover:border-teal-400 transition-colors">
                <Upload size={14} className="text-gray-400" />
                <span className="text-xs text-gray-500">Click to upload logo (PNG, JPG · max 2 MB)</span>
              </div>
            )}
            <input ref={logoInputRef} type="file" accept="image/*" className="sr-only"
              onChange={e => { handleLogoFile(e.target.files[0]); e.target.value = '' }} />
            <div className="mt-2">
              <span className="text-xs text-gray-400">Or paste an image URL:</span>
              <TextInput value={config.logoUrl} onChange={v => handleChange('logoUrl', v)} placeholder="https://..." className="mt-1" />
            </div>
          </ToggleRow>

          <ToggleRow label="Restaurant Name" cfgKey="showRestaurantName" config={config} onChange={handleChange}>
            <div className="flex flex-wrap items-center gap-4">
              <div>
                <p className="text-xs text-gray-500 mb-1">Size</p>
                <ChipGroup value={config.restaurantNameSize} onChange={v => handleChange('restaurantNameSize', v)}
                  options={[{ value: 'normal', label: 'Normal' }, { value: 'large', label: 'Large' }, { value: 'xlarge', label: 'X-Large' }]} />
              </div>
              <div>
                <p className="text-xs text-gray-500 mb-1">Style</p>
                <button onClick={() => handleChange('restaurantNameBold', !config.restaurantNameBold)}
                  className={clsx('px-3 py-1.5 rounded-lg text-sm font-bold border transition-colors',
                    config.restaurantNameBold ? 'bg-teal-600 text-white border-teal-600' : 'bg-white dark:bg-gray-700 border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-300')}>
                  B Bold
                </button>
              </div>
            </div>
          </ToggleRow>

          <ToggleRow label="Address"          cfgKey="showAddress" config={config} onChange={handleChange} />
          <ToggleRow label="Phone Number"     cfgKey="showPhone"   config={config} onChange={handleChange} />
          <ToggleRow label="Email Address"    cfgKey="showEmail"   config={config} onChange={handleChange} />
          <ToggleRow label="Website / Social" cfgKey="showWebsite" config={config} onChange={handleChange}>
            <TextInput value={config.websiteText} onChange={v => handleChange('websiteText', v)} placeholder="www.myrestaurant.com or @handle" />
          </ToggleRow>

          <div className="py-2.5 last:border-0">
            <div className="flex items-center justify-between gap-3 mb-1">
              <label className="text-xs font-medium text-gray-600 dark:text-gray-400">Header Text</label>
              <div className="flex items-center gap-2">
                <span className="text-xs text-gray-400">Align</span>
                <AlignBtns value={config.headerAlign} onChange={v => handleChange('headerAlign', v)} />
              </div>
            </div>
            <TextInput value={config.headerText} onChange={v => handleChange('headerText', v)} placeholder="Tagline, promotion, slogan…" />
          </div>
        </ConfigSection>

        {/* Order Information */}
        <ConfigSection icon={FileText} title="Order Information">
          <ToggleRow label="Order Number"  cfgKey="showOrderId"     config={config} onChange={handleChange} />
          <ToggleRow label="Table Number"  cfgKey="showTableNumber" config={config} onChange={handleChange} />
          <ToggleRow label="Waiter Name"   cfgKey="showWaiter"      config={config} onChange={handleChange} />
          <ToggleRow label="Order Type"    desc="Show Dine In / Takeaway / etc." cfgKey="showOrderType" config={config} onChange={handleChange} />
          <ToggleRow label="Date & Time"   cfgKey="showDate"        config={config} onChange={handleChange} />
        </ConfigSection>

        {/* Items */}
        <ConfigSection icon={LayoutList} title="Items">
          <ToggleRow label="Show Unit Price" desc="Display price-per-unit below each item (e.g. @ 40,000 LAK each)" cfgKey="showUnitPrice" config={config} onChange={handleChange} />
        </ConfigSection>

        {/* Totals & Payment */}
        <ConfigSection icon={LayoutList} title="Totals & Payment">
          <ToggleRow label="Subtotal line"    cfgKey="showSubtotal"       config={config} onChange={handleChange} />
          <ToggleRow label="Discount line"    cfgKey="showDiscount"       config={config} onChange={handleChange} />
          <ToggleRow label="Payment details"  cfgKey="showPaymentDetails" config={config} onChange={handleChange} />
          <ToggleRow label="Signature line"   desc="Add a blank signature field at the bottom" cfgKey="showSignatureLine" config={config} onChange={handleChange}>
            <TextInput value={config.signatureLabel} onChange={v => handleChange('signatureLabel', v)} placeholder="Signature: ____________________" />
          </ToggleRow>
          <ToggleRow label="Alt currency totals (USD / THB)" desc="Show total in $ USD and ฿ Thai Baht — set exchange rates in Settings → Store → Currency Converter (Admin only)" cfgKey="showAltCurrencies" config={config} onChange={handleChange} />
          <ToggleRow label="QR Payment code" desc="Show a payment QR code at the very bottom of the receipt (upload your QR image in Settings → Payments)" cfgKey="showQrPayment" config={config} onChange={handleChange}>
            <TextInput value={config.qrPaymentLabel} onChange={v => handleChange('qrPaymentLabel', v)} placeholder="Scan to Pay" />
          </ToggleRow>
        </ConfigSection>

        {/* Custom Labels */}
        <ConfigSection icon={Tag} title="Custom Labels">
          <p className="text-xs text-gray-400 dark:text-gray-500 pt-2.5 pb-1">
            Rename any field on the receipt — useful for other languages or branding.
          </p>
          {[
            { key: 'labelReceipt', placeholder: 'RECEIPT'  },
            { key: 'labelOrder',   placeholder: 'Order'    },
            { key: 'labelTable',   placeholder: 'Table'    },
            { key: 'labelWaiter',  placeholder: 'Waiter'   },
            { key: 'labelOrderType', placeholder: 'Type'   },
            { key: 'labelSubtotal',  placeholder: 'Subtotal' },
            { key: 'labelTotal',     placeholder: 'TOTAL'  },
            { key: 'labelDiscount',  placeholder: 'Discount' },
            { key: 'labelPayment',   placeholder: 'Payment' },
          ].map(({ key, placeholder }) => (
            <div key={key} className="py-2 border-b border-gray-100 dark:border-gray-700/60 last:border-0 flex items-center gap-3">
              <span className="text-xs text-gray-500 dark:text-gray-400 w-24 flex-shrink-0">{placeholder}</span>
              <TextInput value={config[key]} onChange={v => handleChange(key, v)} placeholder={placeholder} />
            </div>
          ))}
        </ConfigSection>

        {/* Footer */}
        <ConfigSection icon={Type} title="Footer Text">
          <div className="py-2.5">
            <div className="flex items-center justify-between gap-3 mb-1">
              <label className="text-xs font-medium text-gray-600 dark:text-gray-400">Thank-you / footer message</label>
              <div className="flex items-center gap-2">
                <span className="text-xs text-gray-400">Align</span>
                <AlignBtns value={config.footerAlign} onChange={v => handleChange('footerAlign', v)} />
              </div>
            </div>
            <TextInput value={config.footerText} onChange={v => handleChange('footerText', v)} placeholder="Thank you for dining with us!" />
          </div>
        </ConfigSection>

        {/* Dividers */}
        <ConfigSection icon={Printer} title="Dividers">
          <ToggleRow label="Show section dividers" desc="Lines separating header, items, totals and footer" cfgKey="showDividers" config={config} onChange={handleChange}>
            <ChipGroup value={config.dividerStyle} onChange={v => handleChange('dividerStyle', v)}
              options={[
                { value: 'dashed', label: '- - - Dashed' },
                { value: 'solid',  label: '─── Solid' },
                { value: 'double', label: '═══ Double' },
              ]} />
          </ToggleRow>
        </ConfigSection>

        {/* Font & Layout */}
        <ConfigSection icon={Type} title="Font & Layout">
          <div className="py-2.5 border-b border-gray-100 dark:border-gray-700/60">
            <p className="text-sm font-medium text-gray-800 dark:text-gray-200 mb-2">Paper Width</p>
            <ChipGroup value={config.paperWidth} onChange={v => handleChange('paperWidth', v)}
              options={[{ value: '58mm', label: '58 mm' }, { value: '80mm', label: '80 mm' }]} />
          </div>
          <div className="py-2.5 border-b border-gray-100 dark:border-gray-700/60">
            <p className="text-sm font-medium text-gray-800 dark:text-gray-200 mb-2">Font Family</p>
            <div className="space-y-1.5">
              {FONT_OPTIONS.map(f => (
                <button key={f.value} onClick={() => handleChange('fontFamily', f.value)}
                  className={clsx('w-full px-3 py-2 rounded-lg text-sm border text-left transition-colors',
                    config.fontFamily === f.value ? 'bg-teal-600 text-white border-teal-600' : 'bg-white dark:bg-gray-700 border-gray-200 dark:border-gray-600 text-gray-700 dark:text-gray-200 hover:border-teal-400',
                  )}
                  style={{ fontFamily: f.css }}>
                  {f.label} — <span className="opacity-70">The quick brown fox</span>
                </button>
              ))}
            </div>
          </div>
          <div className="py-2.5">
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm font-medium text-gray-800 dark:text-gray-200">Font Size</p>
              <span className="text-sm font-bold text-teal-600 dark:text-teal-400 w-10 text-right">{config.fontSize}px</span>
            </div>
            <input type="range" min="8" max="18" step="1" value={config.fontSize}
              onChange={e => handleChange('fontSize', parseInt(e.target.value))}
              className="w-full accent-teal-600" />
            <div className="flex justify-between text-xs text-gray-400 mt-1">
              <span>8px</span><span>12px</span><span>18px</span>
            </div>
          </div>
        </ConfigSection>

      </div>
      </>}
    </div>
  )
}
