import { useState, useEffect, useCallback, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Search, Plus, Minus, X, ShoppingCart, Grid3X3, UtensilsCrossed,
  Printer, CreditCard, Pause, ArrowLeft, User, ChevronRight,
  Tag, Clock, Wifi, ChefHat,
} from 'lucide-react'
import clsx from 'clsx'
import { useApp } from '../context/AppContext'
import { useAuth } from '../context/AuthContext'
import { useSettings } from '../context/SettingsContext'
import { ordersApi, customersApi, shiftsApi, salesChannelsApi, promotionsApi, menuApi, houseAccountsApi } from '../services/api'
import { formatCurrency } from '../utils/formatters'
import Badge from '../components/ui/Badge'
import ModifierModal from '../components/ModifierModal'
import ReceiptModal  from '../components/ReceiptModal'
import { queueOrder } from '../lib/offlineDb'


// ─── Pay Modal ────────────────────────────────────────────────────────────────
const METHODS = [
  { key: 'cash',     label: '💵 Cash'     },
  { key: 'transfer', label: '🏦 Transfer'  },
  { key: 'card',     label: '💳 Card'      },
  { key: 'account',  label: '📒 Account'   },
]

function SplitRow({ row, total, remaining, onChange, onRemove, canRemove }) {
  const { t }     = useSettings()
  const isCash    = row.method === 'cash'
  const tendered  = parseFloat(row.tendered) || 0
  const amount    = parseFloat(row.amount)   || 0
  const change    = tendered - amount

  return (
    <div className="p-3 bg-gray-50 dark:bg-gray-700/50 rounded-xl space-y-2">
      {/* Method + amount row */}
      <div className="flex gap-2 items-end">
        <div className="flex-1">
          <label className="text-[10px] font-medium text-gray-400 mb-1 block">{t('sell.method')}</label>
          <div className="flex gap-1">
            {METHODS.map(m => (
              <button key={m.key} onClick={() => onChange({ method: m.key })}
                className={clsx('flex-1 py-1.5 rounded-lg text-xs font-medium transition-colors',
                  row.method === m.key ? 'bg-teal-600 text-white' : 'bg-white dark:bg-gray-600 text-gray-500 dark:text-gray-400 border border-gray-200 dark:border-gray-500'
                )}>
                {m.label}
              </button>
            ))}
          </div>
        </div>
        <div className="w-28">
          <label className="text-[10px] font-medium text-gray-400 mb-1 block">{t('sell.amount')}</label>
          <input type="number" step="1000" min="0" placeholder={formatCurrency(remaining)}
            value={row.amount}
            onChange={e => onChange({ amount: e.target.value })}
            className="w-full px-2.5 py-1.5 text-sm font-semibold bg-white dark:bg-gray-600 border border-gray-200 dark:border-gray-500 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 text-gray-900 dark:text-gray-100"
          />
        </div>
        {canRemove && (
          <button onClick={onRemove} className="p-1.5 text-gray-300 hover:text-red-500 transition-colors mb-0.5">
            <X size={14} />
          </button>
        )}
      </div>
      {/* Cash tendered */}
      {isCash && amount > 0 && (
        <div className="flex gap-2 items-center">
          <div className="flex-1">
            <label className="text-[10px] font-medium text-gray-400 mb-1 block">{t('sell.cashTendered')}</label>
            <input type="number" step="1000" min="0" placeholder={String(amount)}
              value={row.tendered}
              onChange={e => onChange({ tendered: e.target.value })}
              className="w-full px-2.5 py-1.5 text-sm bg-white dark:bg-gray-600 border border-gray-200 dark:border-gray-500 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 text-gray-900 dark:text-gray-100"
            />
          </div>
          {tendered > 0 && (
            <div className={clsx('text-xs font-semibold px-2 py-1 rounded-lg mt-4',
              change >= 0 ? 'bg-green-100 dark:bg-green-900/20 text-green-700 dark:text-green-400'
                          : 'bg-red-100 dark:bg-red-900/20 text-red-600')}>
              {change >= 0 ? `${t('sell.change')}: ${formatCurrency(change)}` : t('sell.short')}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function PayModal({ isOpen, subtotal, customer, onClose, onConfirm, saving }) {
  const { t }        = useSettings()
  const [splitMode,  setSplitMode]  = useState(false)
  const [currency,   setCurrency]   = useState('LAK')
  const [discount,   setDiscount]   = useState('')
  const [voucher,    setVoucher]    = useState('')
  const [usePoints,  setUsePoints]  = useState(false)

  // Single-payment mode fields
  const [method,    setMethod]    = useState('cash')
  const [tendered,  setTendered]  = useState('')

  // House account fields
  const [houseAccounts, setHouseAccounts] = useState([])
  const [selectedAccount, setSelectedAccount] = useState('')
  useEffect(() => {
    if (!isOpen || method !== 'account') return
    houseAccountsApi.getAll({ status: 'active' })
      .then(d => setHouseAccounts((d.accounts || []).filter(a => a.balance >= 0)))
      .catch(() => {})
  }, [isOpen, method])

  // Split-payment rows
  const [rows, setRows] = useState([{ method: 'cash', amount: '', tendered: '' }])

  if (!isOpen) return null

  const discountAmt = parseFloat(discount) || 0
  const pointsDisc  = usePoints && customer ? Math.min(customer.points, subtotal * 0.1) : 0
  const total       = Math.max(0, subtotal - discountAmt - pointsDisc)

  // Single mode
  const tenderedNum = parseFloat(tendered) || 0
  const change      = tenderedNum - total
  const isCash      = method === 'cash'
  const quickAmounts = isCash
    ? [
        Math.ceil(total / 1000) * 1000,
        Math.ceil(total / 5000) * 5000,
        Math.ceil(total / 10000) * 10000,
        Math.ceil(total / 50000) * 50000,
      ].filter((v, i, arr) => arr.indexOf(v) === i && v >= total).slice(0, 4)
    : []

  // Split mode
  const splitTotal   = rows.reduce((s, r) => s + (parseFloat(r.amount) || 0), 0)
  const remaining    = Math.max(0, total - splitTotal)
  const splitValid   = Math.round(splitTotal * 100) >= Math.round(total * 100) &&
    rows.every(r => {
      if (r.method !== 'cash') return true
      const t = parseFloat(r.tendered) || 0
      const a = parseFloat(r.amount)   || 0
      return t === 0 || t >= a  // tendered blank is ok (means exact)
    })

  const updateRow = (i, patch) => setRows(prev => prev.map((r, idx) => idx === i ? { ...r, ...patch } : r))

  const buildPayments = () => rows.filter(r => parseFloat(r.amount) > 0).map(r => ({
    method:       r.method,
    amount:       parseFloat(r.amount),
    currency,
    cashTendered: r.method === 'cash' ? (parseFloat(r.tendered) || parseFloat(r.amount)) : 0,
    changeGiven:  r.method === 'cash' ? Math.max(0, (parseFloat(r.tendered) || 0) - parseFloat(r.amount)) : 0,
  }))

  const isAccount = method === 'account'

  const handleConfirm = () => {
    if (splitMode) {
      if (!splitValid) return
      onConfirm({
        payments:   buildPayments(),
        currency,
        discount:   discountAmt,
        voucherCode: voucher,
        pointsUsed: pointsDisc,
        paymentMethod:  rows[0]?.method || 'cash',
        cashTendered:   parseFloat(rows[0]?.tendered) || parseFloat(rows[0]?.amount) || 0,
        changeAmount:   Math.max(0, (parseFloat(rows[0]?.tendered) || 0) - (parseFloat(rows[0]?.amount) || 0)),
      })
    } else if (isAccount) {
      if (!selectedAccount) return
      onConfirm({
        payments: [{ method: 'House Account', amount: total, currency, cashTendered: 0, changeGiven: 0 }],
        paymentMethod: 'House Account',
        currency,
        discount:      discountAmt,
        voucherCode:   voucher,
        cashTendered:  0,
        changeAmount:  0,
        pointsUsed:    pointsDisc,
        houseAccountId: parseInt(selectedAccount),
      })
    } else {
      if (isCash && tenderedNum < total) return
      onConfirm({
        payments: [{
          method:       method,
          amount:       total,
          currency,
          cashTendered: isCash ? tenderedNum : total,
          changeGiven:  isCash ? Math.max(0, change) : 0,
        }],
        paymentMethod: method,
        currency,
        discount:      discountAmt,
        voucherCode:   voucher,
        cashTendered:  isCash ? tenderedNum : total,
        changeAmount:  isCash ? Math.max(0, change) : 0,
        pointsUsed:    pointsDisc,
      })
    }
  }

  const singleReady = splitMode ? splitValid
    : isAccount ? !!selectedAccount
    : (!isCash || tenderedNum >= total)

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-md mx-4 overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="bg-teal-600 px-6 py-4 text-white flex items-center justify-between flex-shrink-0">
          <div>
            <p className="text-xs opacity-70">{t('sell.amountDue')}</p>
            <p className="text-3xl font-bold">{formatCurrency(total)}</p>
            {(discountAmt > 0 || pointsDisc > 0) && (
              <p className="text-xs opacity-70 mt-0.5">
                Subtotal {formatCurrency(subtotal)}
                {discountAmt > 0 && ` · Disc -${formatCurrency(discountAmt)}`}
                {pointsDisc > 0 && ` · Points -${formatCurrency(pointsDisc)}`}
              </p>
            )}
          </div>
          <div className="flex flex-col items-end gap-2">
            {/* Currency selector */}
            <div className="flex gap-1 bg-teal-700/50 rounded-xl p-1">
              {['LAK', 'THB'].map(c => (
                <button key={c} onClick={() => setCurrency(c)}
                  className={clsx('px-2.5 py-1 rounded-lg text-xs font-bold transition-colors',
                    currency === c ? 'bg-white text-teal-700' : 'text-white/70 hover:text-white')}>
                  {c}
                </button>
              ))}
            </div>
            {/* Split toggle */}
            <button onClick={() => { setSplitMode(s => !s); setRows([{ method: 'cash', amount: '', tendered: '' }]) }}
              className={clsx('px-2.5 py-1 rounded-lg text-xs font-bold transition-colors',
                splitMode ? 'bg-white text-teal-700' : 'bg-teal-700/50 text-white/80 hover:bg-teal-700')}>
              {splitMode ? '✓ Split' : 'Split'}
            </button>
          </div>
        </div>

        <div className="overflow-y-auto flex-1 p-5 space-y-4">
          {/* Discount + Voucher row */}
          <div className="flex gap-3">
            <div className="flex-1">
              <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">{t('sell.discount')}</label>
              <input type="number" min="0" step="1000" placeholder="0" value={discount}
                onChange={e => setDiscount(e.target.value)}
                className="w-full px-3 py-2 text-sm bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-500 text-gray-900 dark:text-gray-100"
              />
            </div>
            <div className="flex-1">
              <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">{t('sell.voucherCode')}</label>
              <input placeholder="—" value={voucher} onChange={e => setVoucher(e.target.value)}
                className="w-full px-3 py-2 text-sm bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-500 text-gray-900 dark:text-gray-100"
              />
            </div>
          </div>

          {/* Loyalty points */}
          {customer && customer.points > 0 && (
            <label className="flex items-center gap-3 px-4 py-3 bg-amber-50 dark:bg-amber-900/20 rounded-xl cursor-pointer">
              <input type="checkbox" checked={usePoints} onChange={e => setUsePoints(e.target.checked)} className="rounded" />
              <span className="text-sm text-amber-800 dark:text-amber-300">
                {t('sell.usePoints')} ({customer.points} pts = -{formatCurrency(pointsDisc)})
              </span>
            </label>
          )}

          {/* ── Single payment mode ── */}
          {!splitMode && (
            <>
              <div className="flex gap-2 flex-wrap">
                {METHODS.map(m => (
                  <button key={m.key} onClick={() => setMethod(m.key)}
                    className={clsx('flex-1 py-2.5 rounded-xl text-sm font-medium transition-colors min-w-[70px]',
                      method === m.key ? 'bg-teal-600 text-white shadow-sm'
                        : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600')}>
                    {m.label}
                  </button>
                ))}
              </div>
              {/* House Account selector */}
              {isAccount && (
                <div>
                  <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">{t('sell.selectAccount')}</label>
                  {houseAccounts.length === 0 ? (
                    <p className="text-sm text-gray-500 py-2 text-center">{t('sell.noActiveAccounts')}</p>
                  ) : (
                    <select
                      value={selectedAccount}
                      onChange={e => setSelectedAccount(e.target.value)}
                      required
                      className="w-full px-3 py-2.5 text-sm bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-500 text-gray-900 dark:text-gray-100"
                    >
                      <option value="">{t('sell.selectAccount')}…</option>
                      {houseAccounts.map(a => (
                        <option key={a.id} value={a.id}>
                          {a.displayName}{a.creditLimit > 0 ? ` — Balance: ${a.balance.toLocaleString()}` : ''}
                        </option>
                      ))}
                    </select>
                  )}
                </div>
              )}
              {isCash && (
                <>
                  <div>
                    <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">{t('sell.cashTendered')}</label>
                    <input autoFocus type="number" step="1000" min="0" placeholder="0" value={tendered}
                      onChange={e => setTendered(e.target.value)}
                      className="w-full text-xl font-bold text-gray-900 dark:text-gray-100 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-teal-500"
                    />
                  </div>
                  {quickAmounts.length > 0 && (
                    <div className="flex gap-1.5 flex-wrap">
                      {quickAmounts.map(amt => (
                        <button key={amt} onClick={() => setTendered(String(amt))}
                          className="flex-1 min-w-[70px] py-2 text-xs font-semibold bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-xl hover:bg-teal-50 dark:hover:bg-teal-900/30 hover:text-teal-600 transition-colors">
                          {formatCurrency(amt)}
                        </button>
                      ))}
                    </div>
                  )}
                  {tenderedNum > 0 && (
                    <div className={clsx('flex justify-between px-4 py-2.5 rounded-xl text-sm font-semibold',
                      change >= 0 ? 'bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400'
                                  : 'bg-red-50 dark:bg-red-900/20 text-red-600')}>
                      <span>{t('sell.change')}</span>
                      <span>{change >= 0 ? formatCurrency(change) : t('sell.insufficient')}</span>
                    </div>
                  )}
                </>
              )}
            </>
          )}

          {/* ── Split payment mode ── */}
          {splitMode && (
            <div className="space-y-2">
              {/* Remaining balance indicator */}
              <div className={clsx('flex justify-between px-3 py-2 rounded-xl text-sm font-semibold',
                remaining === 0 ? 'bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400'
                                : 'bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400')}>
                <span>{remaining === 0 ? t('sell.fullyCovered') : t('sell.remaining')}</span>
                <span>{remaining === 0 ? '' : formatCurrency(remaining)}</span>
              </div>

              {rows.map((row, i) => (
                <SplitRow
                  key={i}
                  row={row}
                  total={total}
                  remaining={remaining + (parseFloat(row.amount) || 0)}
                  onChange={patch => updateRow(i, patch)}
                  onRemove={() => setRows(prev => prev.filter((_, idx) => idx !== i))}
                  canRemove={rows.length > 1}
                />
              ))}

              {rows.length < 4 && (
                <button
                  onClick={() => setRows(prev => [...prev, { method: 'cash', amount: String(remaining || ''), tendered: '' }])}
                  className="w-full py-2 text-xs font-semibold text-teal-600 dark:text-teal-400 border border-dashed border-teal-300 dark:border-teal-700 rounded-xl hover:bg-teal-50 dark:hover:bg-teal-900/20 transition-colors"
                >
                  {t('sell.addPayment')}
                </button>
              )}
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex gap-2 px-5 pb-5 pt-3 border-t border-gray-100 dark:border-gray-700 flex-shrink-0">
          <button onClick={onClose}
            className="flex-1 py-3 rounded-xl border border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-300 text-sm font-medium hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
            {t('common.cancel')}
          </button>
          <button onClick={handleConfirm} disabled={saving || !singleReady}
            className="flex-[2] py-3 rounded-xl bg-teal-600 text-white text-sm font-semibold hover:bg-teal-700 disabled:opacity-50 transition-colors">
            {saving ? t('sell.processing') : t('sell.confirmPayment')}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Main Sell Screen ─────────────────────────────────────────────────────────
export default function Sell() {
  const { tables, menuItems } = useApp()
  const { user } = useAuth()
  const { t } = useSettings()
  const navigate = useNavigate()

  // Left panel state
  const [leftTab,       setLeftTab]       = useState('tables')  // 'tables' | 'menu'
  const [tableFilter,   setTableFilter]   = useState('all')     // 'all' | 'free' | 'reserved'
  const [menuSearch,    setMenuSearch]    = useState('')
  const [menuCategory,  setMenuCategory]  = useState('All')
  const [menuCategories, setMenuCategories] = useState([])

  useEffect(() => {
    menuApi.getCategories().then(data => setMenuCategories(data)).catch(() => {})
  }, [])

  // Right panel — orders (tabs support multiple open orders)
  const [orderTabs, setOrderTabs]     = useState([newTab()])  // array of order objects
  const [activeTab, setActiveTab]     = useState(0)

  // Customer search
  const [custSearch,    setCustSearch]    = useState('')
  const [custResults,   setCustResults]   = useState([])
  const [custDropdown,  setCustDropdown]  = useState(false)

  // Pay modal
  const [payOpen,  setPayOpen]  = useState(false)
  const [saving,   setSaving]   = useState(false)

  // Modifier modal
  const [modifierItem, setModifierItem] = useState(null)  // menu item awaiting modifier selection

  // Receipt modal — shown after successful payment
  const [receiptOrderId, setReceiptOrderId] = useState(null)

  // Offline toast — shown when an order is saved to the local queue
  const [offlineToast, setOfflineToast] = useState(false)
  const [sentToast,    setSentToast]    = useState(false)
  const [sending,      setSending]      = useState(false)

  // Shift + channels + promotions
  const [currentShift,    setCurrentShift]    = useState(null)
  const [channels,        setChannels]        = useState([])
  const [promotions,      setPromotions]      = useState([])
  const [selectedChannel, setSelectedChannel] = useState('')
  const [promoCode,       setPromoCode]       = useState('')
  const [promoResult,     setPromoResult]     = useState(null)  // { discount, type, name }
  const [promoLoading,    setPromoLoading]    = useState(false)

  const searchRef   = useRef(null)
  const custRef     = useRef(null)

  function newTab(rawTableId = null, tableNumber = null) {
    return {
      id:          Date.now(),
      orderType:   'Dine In',     // 'Dine In' | 'Takeaway' | 'Delivery'
      tableId:     rawTableId,    // raw integer — null for non-dine-in
      tableNumber,
      items:       [],
      waiter:      '',
      customer:    null,
      held:        false,
    }
  }

  const activeOrder = orderTabs[activeTab]
  const setActiveOrder = (updater) => {
    setOrderTabs(prev => prev.map((tab, i) => i === activeTab ? (typeof updater === 'function' ? updater(tab) : updater) : tab))
  }

  // ── Load shift + channels + promotions on mount ───────────────────────────
  useEffect(() => {
    shiftsApi.getCurrent().then(setCurrentShift).catch(() => {})
    salesChannelsApi.getAll().then(d => setChannels(d.filter(c => c.active))).catch(() => {})
    promotionsApi.getAll().then(d => setPromotions(d.filter(p => p.active))).catch(() => {})
  }, [])

  // ── Keyboard shortcuts ─────────────────────────────────────────────────────
  useEffect(() => {
    const handler = (e) => {
      if (e.key === 'F1')  { e.preventDefault(); addNewTab() }
      if (e.key === 'F2')  { e.preventDefault(); setLeftTab('tables') }
      if (e.key === 'F3')  { e.preventDefault(); setLeftTab('menu'); searchRef.current?.focus() }
      if (e.key === 'F4')  { e.preventDefault(); custRef.current?.focus() }
      if (e.key === 'F7')  { e.preventDefault(); if (activeOrder?.items.length) setPayOpen(true) }
      if (e.key === 'F9')  { e.preventDefault(); if (activeOrder?.items.length) setPayOpen(true) }
      if (e.key === 'F10') { e.preventDefault(); handleHold() }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [activeOrder])

  // ── Customer search ────────────────────────────────────────────────────────
  useEffect(() => {
    if (!custSearch.trim()) { setCustResults([]); return }
    const t = setTimeout(async () => {
      try {
        const data = await customersApi.getAll({ search: custSearch })
        setCustResults(data.slice(0, 5))
        setCustDropdown(true)
      } catch {}
    }, 300)
    return () => clearTimeout(t)
  }, [custSearch])

  // ── Cart helpers ───────────────────────────────────────────────────────────
  const addItem = (menuItem) => {
    const hasModifiers = (menuItem.modifierGroups || []).length > 0
    if (hasModifiers) {
      // Open modifier modal — item will be added after selections confirmed
      setModifierItem(menuItem)
      return
    }
    addItemDirect(menuItem, [], '')
  }

  const addItemDirect = (menuItem, modifiers, notes) => {
    // Extract raw integer from formatted ID like "MI-001"
    const rawMenuId = parseInt(String(menuItem.id).replace('MI-', ''), 10)
    const modAdj = modifiers.reduce((s, m) => s + (m.priceAdjustment || 0), 0)
    const unitPrice = menuItem.price + modAdj

    setActiveOrder(order => {
      // Only merge if no modifiers and no notes (simple reorder)
      if (!modifiers.length && !notes) {
        const existing = order.items.find(i => i.menuItemId === rawMenuId && !i.modifiers?.length && !i.notes)
        if (existing) {
          return { ...order, items: order.items.map(i => i === existing ? { ...i, qty: i.qty + 1 } : i) }
        }
      }
      return {
        ...order,
        items: [...order.items, {
          cartKey:    `${rawMenuId}-${Date.now()}`,
          menuItemId: rawMenuId,
          name:       menuItem.name,
          unitPrice,
          qty:        1,
          modifiers,
          notes,
        }]
      }
    })
  }

  const changeQty = (cartKey, delta) => {
    setActiveOrder(order => ({
      ...order,
      items: order.items
        .map(i => (i.cartKey || i.menuItemId) === cartKey ? { ...i, qty: i.qty + delta } : i)
        .filter(i => i.qty > 0),
    }))
  }

  const removeItem = (cartKey) => {
    setActiveOrder(order => ({ ...order, items: order.items.filter(i => (i.cartKey || i.menuItemId) !== cartKey) }))
  }

  // ── Table click ────────────────────────────────────────────────────────────
  const selectTable = (table) => {
    // Extract raw integer from formatted ID like "T-01"
    const rawId = parseInt(String(table.id).replace('T-', ''), 10)
    // If active tab is empty, assign to it; else create new tab
    if (activeOrder.items.length === 0 && !activeOrder.tableId) {
      setActiveOrder(o => ({ ...o, tableId: rawId, tableNumber: table.tableNumber }))
    } else {
      const tab = newTab(rawId, table.tableNumber)
      setOrderTabs(prev => [...prev, tab])
      setActiveTab(orderTabs.length)
    }
    setLeftTab('menu')
  }

  // ── Hold ───────────────────────────────────────────────────────────────────
  const handleHold = () => {
    setActiveOrder(o => ({ ...o, held: true }))
    // Add a fresh tab
    setOrderTabs(prev => [...prev, newTab()])
    setActiveTab(orderTabs.length)
  }

  // ── New order tab ──────────────────────────────────────────────────────────
  const addNewTab = () => {
    setOrderTabs(prev => [...prev, newTab()])
    setActiveTab(orderTabs.length)
  }

  const closeTab = (i) => {
    if (orderTabs.length === 1) { setOrderTabs([newTab()]); setActiveTab(0); return }
    const next = orderTabs.filter((_, idx) => idx !== i)
    setOrderTabs(next)
    setActiveTab(Math.min(activeTab, next.length - 1))
  }

  // ── Pay ────────────────────────────────────────────────────────────────────
  const subtotal       = activeOrder?.items.reduce((s, i) => s + i.qty * (i.unitPrice || 0), 0) || 0
  const promoDiscount  = promoResult && !promoResult.error ? (promoResult.discount || 0) : 0
  const total          = Math.max(0, subtotal - promoDiscount)

  const handlePay = async (paymentInfo) => {
    if (!activeOrder.items.length) return
    setSaving(true)
    try {
      const isDineIn = (activeOrder.orderType || 'Dine In') === 'Dine In'
      const body = {
        orderType:      activeOrder.orderType || 'Dine In',
        tableId:        isDineIn ? activeOrder.tableId : undefined,
        tableNumber:    isDineIn ? activeOrder.tableNumber : undefined,
        waiter:         activeOrder.waiter || user?.name || 'Cashier',
        customerId:     activeOrder.customer?.id || null,
        salesChannelId: selectedChannel ? parseInt(selectedChannel) : undefined,
        items:          activeOrder.items.map(i => ({
          menuItemId: i.menuItemId,
          name:       i.name,
          quantity:   i.qty,
          unitPrice:  i.unitPrice,
          modifiers:  i.modifiers || [],
          notes:      i.notes     || '',
        })),
        notes:          '',
        payments:       paymentInfo.payments,
        paymentMethod:  paymentInfo.paymentMethod,
        currency:       paymentInfo.currency,
        discount:       (paymentInfo.discount || 0) + promoDiscount,
        voucherCode:    paymentInfo.voucherCode || promoCode || undefined,
        cashTendered:   paymentInfo.cashTendered,
        changeAmount:   paymentInfo.changeAmount,
      }

      try {
        // ── Online path ────────────────────────────────────────────────────
        const order = await ordersApi.create(body)

        if (paymentInfo.houseAccountId) {
          // Charge to house account — server closes order + increments balance
          await houseAccountsApi.charge(paymentInfo.houseAccountId, {
            orderId:     order.rawId || order.id,
            amount:      total,
            description: `Order ${order.id}`,
          })
        } else {
          await ordersApi.updateStatus(order.rawId, 'Closed')
        }

        setPayOpen(false)
        closeTab(activeTab)
        setReceiptOrderId(rawOrderId)
      } catch (err) {
        // ── Offline / network-failure path ─────────────────────────────────
        // Detect network errors: no HTTP status means fetch itself threw
        // (e.g. "Failed to fetch" when offline), vs server errors that have
        // err.status set by api.js.
        const isNetworkError = !err.status || !navigator.onLine
        if (isNetworkError) {
          await queueOrder(body)
          setPayOpen(false)
          closeTab(activeTab)
          setOfflineToast(true)
          setTimeout(() => setOfflineToast(false), 5000)
        } else {
          // Server returned an error (4xx/5xx) — surface it to the cashier
          throw err
        }
      }
    } catch (e) {
      alert(e.message)
    } finally {
      setSaving(false)
    }
  }

  // ── Send to Kitchen (creates Pending order — payment processed later) ─────────
  const handleSendToKitchen = async () => {
    if (!activeOrder?.items.length) return
    setSending(true)
    try {
      const isDineIn = (activeOrder.orderType || 'Dine In') === 'Dine In'
      const body = {
        orderType:   activeOrder.orderType || 'Dine In',
        tableId:     isDineIn ? activeOrder.tableId : undefined,
        tableNumber: isDineIn ? activeOrder.tableNumber : undefined,
        waiter:      activeOrder.waiter || user?.name || 'Staff',
        customerId:  activeOrder.customer?.id || null,
        items: activeOrder.items.map(i => ({
          menuItemId: i.menuItemId,
          name:       i.name,
          quantity:   i.qty,
          unitPrice:  i.unitPrice,
          modifiers:  i.modifiers || [],
          notes:      i.notes     || '',
        })),
        notes: '',
        // No payments — order stays Pending; cashier pays later via Orders page
      }
      await ordersApi.create(body)
      closeTab(activeTab)
      setSentToast(true)
      setTimeout(() => setSentToast(false), 3000)
    } catch (e) {
      alert(e.message)
    } finally {
      setSending(false)
    }
  }

  // ── Apply promotion ────────────────────────────────────────────────────────
  const applyPromo = async () => {
    if (!promoCode.trim()) return
    setPromoLoading(true)
    try {
      // Find promotion by name (case-insensitive) from loaded promotions list
      const promo = promotions.find(p =>
        p.name.toLowerCase() === promoCode.trim().toLowerCase() && p.active
      )
      if (!promo) throw new Error('Promotion not found or inactive')
      // Apply by ID using the backend endpoint
      const result = await promotionsApi.apply(promo.id, { orderTotal: subtotal })
      setPromoResult({ discount: result.discount, name: result.promotion?.name || promo.name })
    } catch (e) {
      setPromoResult({ error: e.message || 'Invalid promo code' })
    }
    setPromoLoading(false)
  }

  // ── Filtered data ──────────────────────────────────────────────────────────
  const filteredTables = tables.filter(tbl => {
    if (tableFilter === 'free')     return tbl.status === 'Available'
    if (tableFilter === 'reserved') return tbl.status === 'Reserved'
    return true
  })

  const categories = [
    { id: 'all', name: 'All', color: null },
    ...menuCategories,
  ]
  const filteredMenu = menuItems.filter(m => {
    if (!m.available) return false
    if (menuSearch && !m.name.toLowerCase().includes(menuSearch.toLowerCase())) return false
    if (menuCategory !== 'All' && m.category !== menuCategory) return false
    return true
  })

  return (
    <div className="h-screen flex flex-col bg-gray-50 dark:bg-gray-900 overflow-hidden">
      {/* Top Bar */}
      <div className="flex items-center gap-3 px-4 h-12 bg-white dark:bg-gray-800 border-b border-gray-100 dark:border-gray-700 flex-shrink-0">
        <button
          onClick={() => navigate('/dashboard')}
          className="p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
        >
          <ArrowLeft size={16} />
        </button>
        <div className="w-8 h-8 bg-teal-600 rounded-xl flex items-center justify-center">
          <ShoppingCart size={15} className="text-white" />
        </div>
        <span className="font-bold text-gray-900 dark:text-gray-100 text-sm">POS Sell</span>

        {/* Left tab switcher */}
        <div className="flex gap-1 ml-4 bg-gray-100 dark:bg-gray-700 rounded-xl p-1">
          <button
            onClick={() => setLeftTab('tables')}
            disabled={(activeOrder?.orderType || 'Dine In') !== 'Dine In'}
            className={clsx(
              'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors',
              leftTab === 'tables'
                ? 'bg-white dark:bg-gray-600 text-gray-900 dark:text-gray-100 shadow-sm'
                : 'text-gray-500 dark:text-gray-400',
              (activeOrder?.orderType || 'Dine In') !== 'Dine In' && 'opacity-40 cursor-not-allowed',
            )}
          >
            <Grid3X3 size={13} />
            {t('sell.tables')}
          </button>
          <button
            onClick={() => setLeftTab('menu')}
            className={clsx(
              'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors',
              leftTab === 'menu'
                ? 'bg-white dark:bg-gray-600 text-gray-900 dark:text-gray-100 shadow-sm'
                : 'text-gray-500 dark:text-gray-400'
            )}
          >
            <UtensilsCrossed size={13} />
            {t('sell.menu')}
          </button>
        </div>

        {/* Menu search (shown in menu tab) */}
        {leftTab === 'menu' && (
          <div className="relative flex-1 max-w-xs">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              ref={searchRef}
              placeholder={t('sell.searchItems')}
              value={menuSearch}
              onChange={e => setMenuSearch(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 text-sm bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-gray-100 border border-gray-200 dark:border-gray-600 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-500"
            />
          </div>
        )}

        <div className="ml-auto flex items-center gap-3 text-xs text-gray-400 dark:text-gray-500">
          {currentShift ? (
            <span className="flex items-center gap-1 text-green-600 dark:text-green-400 font-medium">
              <span className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse" />
              {t('sell.shiftOpen')}
            </span>
          ) : (
            <span className="flex items-center gap-1 text-amber-500 font-medium">
              <Clock size={11} />
              {t('sell.noShift')}
            </span>
          )}
          <span>·</span>
          <span className="font-medium text-gray-600 dark:text-gray-300">{user?.name}</span>
          <span>·</span>
          <span>{new Date().toLocaleDateString()}</span>
        </div>
      </div>

      {/* Keyboard hints bar */}
      <div className="flex items-center gap-3 px-4 py-1 bg-gray-50 dark:bg-gray-900 border-b border-gray-100 dark:border-gray-700 flex-shrink-0 overflow-x-auto">
        {[
          ['F1', 'New Tab'],
          ['F2', 'Tables'],
          ['F3', 'Search'],
          ['F4', 'Customer'],
          ['F7', 'Pay'],
          ['F10', 'Hold'],
        ].map(([key, label]) => (
          <span key={key} className="flex items-center gap-1 text-xs text-gray-400 dark:text-gray-500 whitespace-nowrap">
            <kbd className="px-1.5 py-0.5 bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded text-xs font-mono">{key}</kbd>
            <span>{label}</span>
          </span>
        ))}
      </div>

      {/* Body */}
      <div className="flex-1 flex overflow-hidden">

        {/* ── Left Panel ─────────────────────────────────────────────────────── */}
        <div className="flex flex-col w-[58%] border-r border-gray-200 dark:border-gray-700 overflow-hidden">

          {/* Tables Tab */}
          {leftTab === 'tables' && (
            <>
              {/* Table filters */}
              <div className="flex gap-2 px-4 py-2.5 bg-white dark:bg-gray-800 border-b border-gray-100 dark:border-gray-700 flex-shrink-0">
                {[
                  { value: 'all',      label: t('sell.allTables') },
                  { value: 'free',     label: t('sell.free')      },
                  { value: 'reserved', label: t('sell.reserved')  },
                ].map(f => (
                  <button
                    key={f.value}
                    onClick={() => setTableFilter(f.value)}
                    className={clsx(
                      'px-3 py-1 rounded-full text-xs font-medium transition-colors',
                      tableFilter === f.value
                        ? 'bg-teal-600 text-white'
                        : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400'
                    )}
                  >
                    {f.label}
                  </button>
                ))}
              </div>

              {/* Table grid */}
              <div className="flex-1 overflow-y-auto p-4">
                <div className="grid grid-cols-4 sm:grid-cols-5 lg:grid-cols-6 gap-2">
                  {filteredTables.map(tbl => {
                    const isSelected = activeOrder?.tableId === parseInt(String(tbl.id).replace('T-', ''), 10)
                    return (
                      <button
                        key={tbl.id}
                        onClick={() => selectTable(tbl)}
                        className={clsx(
                          'aspect-square flex flex-col items-center justify-center rounded-xl border-2 transition-all text-sm font-semibold',
                          isSelected
                            ? 'border-teal-600 bg-teal-50 dark:bg-teal-900/30 text-teal-700 dark:text-teal-300'
                            : tbl.status === 'Available'
                              ? 'border-green-300 dark:border-green-700 bg-green-50 dark:bg-green-900/20 text-green-800 dark:text-green-300 hover:border-green-500'
                              : tbl.status === 'Reserved'
                                ? 'border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-900/20 text-amber-800 dark:text-amber-300'
                                : 'border-red-300 dark:border-red-700 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300'
                        )}
                      >
                        <span className="text-base font-bold">{tbl.tableNumber}</span>
                        <span className="text-xs font-normal opacity-70">{tbl.capacity}p</span>
                        <div className={clsx(
                          'mt-1 w-1.5 h-1.5 rounded-full',
                          tbl.status === 'Available' ? 'bg-green-500' : tbl.status === 'Reserved' ? 'bg-amber-500' : 'bg-red-500'
                        )} />
                      </button>
                    )
                  })}
                </div>
              </div>
            </>
          )}

          {/* Menu Tab */}
          {leftTab === 'menu' && (
            <>
              {/* Category pills */}
              <div className="flex gap-1.5 px-4 py-2.5 bg-white dark:bg-gray-800 border-b border-gray-100 dark:border-gray-700 overflow-x-auto flex-shrink-0 scrollbar-none">
                {categories.map(cat => {
                  const isActive = menuCategory === cat.name
                  return (
                    <button
                      key={cat.id}
                      onClick={() => setMenuCategory(cat.name)}
                      className={clsx(
                        'flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium whitespace-nowrap transition-colors flex-shrink-0',
                        isActive
                          ? 'text-white'
                          : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600'
                      )}
                      style={isActive ? { background: cat.color || '#14b8a6' } : {}}
                    >
                      {cat.color && !isActive && (
                        <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: cat.color }} />
                      )}
                      {cat.name}
                    </button>
                  )
                })}
              </div>

              {/* Menu grid */}
              <div className="flex-1 overflow-y-auto p-4">
                <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                  {filteredMenu.map(item => {
                    const rawId = parseInt(String(item.id).replace('MI-', ''), 10) || item.id
                    const cartItem = activeOrder?.items.find(i => i.menuItemId === rawId)
                    return (
                      <button
                        key={item.id}
                        onClick={() => addItem(item)}
                        className={clsx(
                          'flex flex-col items-start p-3 rounded-xl border-2 text-left transition-all hover:shadow-md',
                          cartItem
                            ? 'border-teal-400 bg-teal-50 dark:bg-teal-900/20'
                            : 'border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 hover:border-teal-300'
                        )}
                      >
                        <div className="w-full aspect-square bg-gray-100 dark:bg-gray-700 rounded-lg mb-2 flex items-center justify-center">
                          {item.imageUrl
                            ? <img src={item.imageUrl} alt={item.name} className="w-full h-full object-cover rounded-lg" />
                            : <UtensilsCrossed size={20} className="text-gray-400" />
                          }
                        </div>
                        <p className="text-xs font-semibold text-gray-900 dark:text-gray-100 line-clamp-2 leading-tight">{item.name}</p>
                        <p className="text-xs text-teal-600 dark:text-teal-400 font-bold mt-1">{formatCurrency(item.price)}</p>
                        {cartItem && (
                          <span className="mt-1 bg-teal-600 text-white text-xs px-1.5 py-0.5 rounded-full">×{cartItem.qty}</span>
                        )}
                      </button>
                    )
                  })}
                  {filteredMenu.length === 0 && (
                    <div className="col-span-4 text-center py-16 text-gray-400 text-sm">
                      {t('sell.noItemsFound')}
                    </div>
                  )}
                </div>
              </div>
            </>
          )}
        </div>

        {/* ── Right Panel ────────────────────────────────────────────────────── */}
        <div className="flex flex-col w-[42%] bg-white dark:bg-gray-800 overflow-hidden">

          {/* Order Tabs */}
          <div className="flex items-center gap-1 px-3 py-2 border-b border-gray-100 dark:border-gray-700 overflow-x-auto flex-shrink-0">
            {orderTabs.map((tab, i) => (
              <div key={tab.id} className="flex items-center">
                <button
                  onClick={() => setActiveTab(i)}
                  className={clsx(
                    'flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium transition-colors whitespace-nowrap',
                    activeTab === i
                      ? 'bg-teal-600 text-white'
                      : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400'
                  )}
                >
                  {tab.tableNumber ? `T-${tab.tableNumber}` : `Order ${i + 1}`}
                  {tab.held && <span className="text-amber-300 text-xs">⏸</span>}
                  <span className="text-xs opacity-70">({tab.items.length})</span>
                </button>
                {orderTabs.length > 1 && (
                  <button
                    onClick={(e) => { e.stopPropagation(); closeTab(i) }}
                    className="ml-0.5 p-0.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 rounded"
                  >
                    <X size={11} />
                  </button>
                )}
              </div>
            ))}
            <button
              onClick={addNewTab}
              className="flex-shrink-0 w-7 h-7 rounded-xl bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400 hover:bg-teal-50 dark:hover:bg-teal-900/30 hover:text-teal-600 flex items-center justify-center transition-colors"
            >
              <Plus size={14} />
            </button>
          </div>

          {/* ── Order Type toggle ──────────────────────────────────────────── */}
          <div className="flex items-center gap-1.5 px-4 py-2 border-b border-gray-50 dark:border-gray-700 flex-shrink-0 bg-gray-50 dark:bg-gray-900/30">
            {[
              { key: 'Dine In',  label: t('sell.dineIn'),  active: 'bg-teal-600'   },
              { key: 'Takeaway', label: t('sell.takeaway'), active: 'bg-orange-500' },
              { key: 'Delivery', label: t('sell.delivery'), active: 'bg-blue-600'   },
            ].map(({ key, label, active }) => (
              <button
                key={key}
                onClick={() => {
                  setActiveOrder(o => ({
                    ...o,
                    orderType:   key,
                    tableId:     key === 'Dine In' ? o.tableId : null,
                    tableNumber: key === 'Dine In' ? o.tableNumber : null,
                  }))
                  if (key !== 'Dine In') setLeftTab('menu')
                }}
                className={clsx(
                  'flex-1 py-1.5 text-xs font-semibold rounded-lg transition-colors',
                  (activeOrder?.orderType || 'Dine In') === key
                    ? `${active} text-white shadow-sm`
                    : 'bg-white dark:bg-gray-700 text-gray-500 dark:text-gray-400 border border-gray-200 dark:border-gray-600'
                )}
              >
                {label}
              </button>
            ))}
          </div>

          {/* Table + Waiter info */}
          <div className="flex items-center gap-3 px-4 py-2.5 border-b border-gray-50 dark:border-gray-700 flex-shrink-0">
            <div className="flex-1">
              <p className="text-xs text-gray-400 dark:text-gray-500">
                {(activeOrder?.orderType || 'Dine In') === 'Dine In' ? t('common.table') : t('sell.orderType')}
              </p>
              <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                {(activeOrder?.orderType || 'Dine In') === 'Dine In'
                  ? (activeOrder?.tableNumber ? `Table ${activeOrder.tableNumber}` : t('sell.noTable'))
                  : (activeOrder?.orderType)
                }
              </p>
            </div>
            <div className="flex-1">
              <p className="text-xs text-gray-400 dark:text-gray-500">{t('sell.waiter')}</p>
              <input
                placeholder={user?.name || 'Cashier'}
                value={activeOrder?.waiter || ''}
                onChange={e => setActiveOrder(o => ({ ...o, waiter: e.target.value }))}
                className="text-sm font-medium text-gray-900 dark:text-gray-100 bg-transparent border-b border-gray-200 dark:border-gray-600 focus:outline-none focus:border-teal-500 w-full"
              />
            </div>
          </div>

          {/* Customer search */}
          <div className="relative px-4 py-2 border-b border-gray-50 dark:border-gray-700 flex-shrink-0">
            {activeOrder?.customer ? (
              <div className="flex items-center justify-between bg-teal-50 dark:bg-teal-900/20 rounded-xl px-3 py-2">
                <div className="flex items-center gap-2">
                  <User size={14} className="text-teal-500" />
                  <span className="text-sm font-medium text-teal-800 dark:text-teal-300">{activeOrder.customer.name}</span>
                  <span className="text-xs text-teal-500">★ {activeOrder.customer.points}</span>
                </div>
                <button onClick={() => setActiveOrder(o => ({ ...o, customer: null }))} className="text-teal-400 hover:text-teal-600">
                  <X size={13} />
                </button>
              </div>
            ) : (
              <>
                <div className="relative">
                  <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input
                    ref={custRef}
                    placeholder={t('sell.searchCustomer')}
                    value={custSearch}
                    onChange={e => { setCustSearch(e.target.value); setCustDropdown(true) }}
                    onFocus={() => custResults.length && setCustDropdown(true)}
                    className="w-full pl-8 pr-3 py-1.5 text-sm bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-500 text-gray-900 dark:text-gray-100"
                  />
                </div>
                {custDropdown && custResults.length > 0 && (
                  <div className="absolute left-4 right-4 top-full z-20 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-xl shadow-lg overflow-hidden">
                    {custResults.map(c => (
                      <button
                        key={c.id}
                        onClick={() => {
                          setActiveOrder(o => ({ ...o, customer: c }))
                          setCustSearch('')
                          setCustDropdown(false)
                        }}
                        className="w-full flex items-center justify-between px-4 py-2.5 hover:bg-teal-50 dark:hover:bg-teal-900/20 text-left"
                      >
                        <div>
                          <p className="text-sm font-medium text-gray-900 dark:text-gray-100">{c.name}</p>
                          <p className="text-xs text-gray-400">{c.phone}</p>
                        </div>
                        <span className="text-xs text-amber-600 dark:text-amber-400">★ {c.points}</span>
                      </button>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>

          {/* Sales channel + Promo */}
          <div className="flex items-center gap-2 px-4 py-2 border-b border-gray-50 dark:border-gray-700 flex-shrink-0">
            {channels.length > 0 && (
              <select
                value={selectedChannel}
                onChange={e => setSelectedChannel(e.target.value)}
                className="flex-1 text-xs border border-gray-200 dark:border-gray-600 rounded-lg px-2 py-1.5 bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 focus:outline-none focus:ring-1 focus:ring-teal-500"
              >
                <option value="">{t('sell.channel')}</option>
                {channels.map(c => <option key={c.id} value={String(c.id)}>{c.name}</option>)}
              </select>
            )}
            <div className="flex-1 flex items-center gap-1">
              <div className="relative flex-1">
                <Tag size={11} className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  placeholder={t('sell.promoCode')}
                  value={promoCode}
                  onChange={e => { setPromoCode(e.target.value); if (promoResult) setPromoResult(null) }}
                  onKeyDown={e => e.key === 'Enter' && applyPromo()}
                  className="w-full pl-6 pr-2 py-1.5 text-xs border border-gray-200 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 focus:outline-none focus:ring-1 focus:ring-teal-500"
                />
              </div>
              <button
                onClick={applyPromo}
                disabled={promoLoading}
                className="px-2 py-1.5 text-xs bg-teal-600 text-white rounded-lg hover:bg-teal-700 disabled:opacity-50 transition-colors whitespace-nowrap"
              >
                {promoLoading ? '…' : t('sell.apply')}
              </button>
            </div>
          </div>
          {promoResult && (
            <div className={clsx('px-4 py-1.5 text-xs flex items-center justify-between flex-shrink-0',
              promoResult.error ? 'bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400' : 'bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400'
            )}>
              <span>{promoResult.error || `${promoResult.name} ${t('sell.promoApplied')}`}</span>
              {!promoResult.error && <span className="font-semibold">-{formatCurrency(promoResult.discount)}</span>}
            </div>
          )}

          {/* Cart Items */}
          <div className="flex-1 overflow-y-auto">
            {!activeOrder?.items.length ? (
              <div className="flex flex-col items-center justify-center h-full text-center px-8">
                <ShoppingCart size={40} className="text-gray-200 dark:text-gray-600 mb-3" />
                <p className="text-sm font-medium text-gray-400 dark:text-gray-500">{t('sell.emptyOrder')}</p>
                <p className="text-xs text-gray-300 dark:text-gray-600 mt-1">{t('sell.emptyOrderDesc')}</p>
              </div>
            ) : (
              <div className="divide-y divide-gray-50 dark:divide-gray-700">
                {activeOrder.items.map(item => {
                  const key = item.cartKey || item.menuItemId
                  return (
                    <div key={key} className="px-4 py-2.5">
                      <div className="flex items-center gap-3">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">{item.name}</p>
                          <p className="text-xs text-gray-400">{formatCurrency(item.unitPrice)} {t('sell.each')}</p>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <button
                            onClick={() => changeQty(key, -1)}
                            className="w-6 h-6 rounded-lg bg-gray-100 dark:bg-gray-700 flex items-center justify-center text-gray-600 dark:text-gray-400 hover:bg-red-100 dark:hover:bg-red-900/20 hover:text-red-500 transition-colors"
                          >
                            <Minus size={11} />
                          </button>
                          <span className="w-6 text-center text-sm font-bold text-gray-900 dark:text-gray-100">{item.qty}</span>
                          <button
                            onClick={() => changeQty(key, 1)}
                            className="w-6 h-6 rounded-lg bg-gray-100 dark:bg-gray-700 flex items-center justify-center text-gray-600 dark:text-gray-400 hover:bg-teal-100 dark:hover:bg-teal-900/20 hover:text-teal-500 transition-colors"
                          >
                            <Plus size={11} />
                          </button>
                        </div>
                        <span className="text-sm font-semibold text-gray-900 dark:text-gray-100 w-16 text-right">
                          {formatCurrency(item.qty * item.unitPrice)}
                        </span>
                        <button
                          onClick={() => removeItem(key)}
                          className="p-1 text-gray-300 hover:text-red-500 transition-colors"
                        >
                          <X size={13} />
                        </button>
                      </div>
                      {/* Modifier tags */}
                      {item.modifiers?.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-1 ml-0">
                          {item.modifiers.map((mod, mi) => (
                            <span key={mi} className="px-1.5 py-0.5 bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 text-[10px] rounded font-medium">
                              {mod.name}{mod.priceAdjustment !== 0 ? ` (${mod.priceAdjustment > 0 ? '+' : ''}${formatCurrency(mod.priceAdjustment)})` : ''}
                            </span>
                          ))}
                        </div>
                      )}
                      {/* Per-item notes */}
                      {item.notes && (
                        <p className="text-[11px] text-amber-600 dark:text-amber-400 italic mt-0.5 ml-0">✎ {item.notes}</p>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          {/* Totals */}
          <div className="flex-shrink-0 border-t border-gray-100 dark:border-gray-700 px-4 py-3 space-y-1.5">
            <div className="flex justify-between text-sm text-gray-500 dark:text-gray-400">
              <span>{t('common.subtotal')}</span>
              <span>{formatCurrency(subtotal)}</span>
            </div>
            {promoDiscount > 0 && (
              <div className="flex justify-between text-sm text-green-600 dark:text-green-400">
                <span>{t('sell.promoDiscount')}</span>
                <span>-{formatCurrency(promoDiscount)}</span>
              </div>
            )}
            <div className="flex justify-between font-bold text-gray-900 dark:text-gray-100 text-base pt-1 border-t border-gray-100 dark:border-gray-700">
              <span>{t('sell.total')}</span>
              <span className="text-teal-600 dark:text-teal-400">{formatCurrency(total)}</span>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex-shrink-0 flex flex-col gap-2 px-4 pb-4">
            {/* Send to Kitchen — creates Pending order, alerts Chef, locks table */}
            <button
              onClick={handleSendToKitchen}
              disabled={!activeOrder?.items.length || sending}
              className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-orange-500 hover:bg-orange-600 text-white font-semibold text-sm disabled:opacity-40 transition-colors"
            >
              <ChefHat size={15} />
              {sending ? t('sell.sending') : t('sell.sendToKitchen')}
            </button>
            <div className="flex gap-2">
              <button
                onClick={handleHold}
                disabled={!activeOrder?.items.length}
                className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 font-medium text-sm hover:bg-gray-200 dark:hover:bg-gray-600 disabled:opacity-40 transition-colors"
              >
                <Pause size={15} />
                {t('sell.hold')}
              </button>
              <button
                disabled={!activeOrder?.items.length}
                className="flex items-center justify-center gap-1.5 px-3 py-3 rounded-xl bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600 disabled:opacity-40 transition-colors"
              >
                <Printer size={15} />
              </button>
              <button
                onClick={() => setPayOpen(true)}
                disabled={!activeOrder?.items.length}
                className="flex-[2] flex items-center justify-center gap-2 py-3 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-semibold text-sm disabled:opacity-40 transition-colors"
              >
                <CreditCard size={15} />
                {t('sell.pay')}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Offline saved toast */}
      {offlineToast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 px-5 py-3 bg-amber-500 text-white text-sm font-semibold rounded-2xl shadow-xl animate-bounce-once">
          <Wifi size={15} className="opacity-80" />
          {t('sell.offlineSaved')}
        </div>
      )}

      {/* Sent to kitchen toast */}
      {sentToast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 px-5 py-3 bg-orange-500 text-white text-sm font-semibold rounded-2xl shadow-xl">
          <ChefHat size={15} className="opacity-90" />
          {t('sell.sentToKitchen')}
        </div>
      )}

      {/* Pay Modal */}
      <PayModal
        isOpen={payOpen}
        subtotal={subtotal}
        customer={activeOrder?.customer}
        onClose={() => setPayOpen(false)}
        onConfirm={handlePay}
        saving={saving}
      />

      {/* Receipt Modal — auto-shown after payment */}
      {receiptOrderId && (
        <ReceiptModal
          orderId={receiptOrderId}
          type="receipt"
          onClose={() => setReceiptOrderId(null)}
        />
      )}

      {/* Modifier Modal */}
      {modifierItem && (
        <ModifierModal
          item={modifierItem}
          onClose={() => setModifierItem(null)}
          onConfirm={(selections, notes) => {
            addItemDirect(modifierItem, selections, notes)
            setModifierItem(null)
          }}
        />
      )}
    </div>
  )
}
