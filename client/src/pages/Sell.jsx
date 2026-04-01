import { useState, useEffect, useCallback, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Search, Plus, Minus, X, ShoppingCart, Grid3X3, UtensilsCrossed,
  Printer, CreditCard, Pause, ArrowLeft, User, ChevronRight,
} from 'lucide-react'
import clsx from 'clsx'
import { useApp } from '../context/AppContext'
import { useAuth } from '../context/AuthContext'
import { useSettings } from '../context/SettingsContext'
import { ordersApi, customersApi } from '../services/api'
import { formatCurrency } from '../utils/formatters'
import Badge from '../components/ui/Badge'

const TAX_RATE = 0.1

// ─── Pay Modal ────────────────────────────────────────────────────────────────
function PayModal({ isOpen, subtotal, tax, customer, onClose, onConfirm, saving }) {
  const [method,    setMethod]    = useState('cash')   // 'cash' | 'transfer' | 'card'
  const [currency,  setCurrency]  = useState('LAK')
  const [discount,  setDiscount]  = useState('')
  const [voucher,   setVoucher]   = useState('')
  const [tendered,  setTendered]  = useState('')
  const [usePoints, setUsePoints] = useState(false)

  if (!isOpen) return null

  const discountAmt  = parseFloat(discount) || 0
  const pointsDisc   = usePoints && customer ? Math.min(customer.points, subtotal * 0.1) : 0
  const total        = Math.max(0, subtotal + tax - discountAmt - pointsDisc)
  const tenderedNum  = parseFloat(tendered) || 0
  const change       = tenderedNum - total
  const isCash       = method === 'cash'

  const quickAmounts = isCash
    ? [
        Math.ceil(total / 1000) * 1000,
        Math.ceil(total / 5000) * 5000,
        Math.ceil(total / 10000) * 10000,
        Math.ceil(total / 50000) * 50000,
      ].filter((v, i, arr) => arr.indexOf(v) === i && v >= total).slice(0, 4)
    : []

  const handleConfirm = () => {
    if (isCash && tenderedNum < total) return
    onConfirm({
      paymentMethod: method,
      currency,
      discount:      discountAmt,
      voucherCode:   voucher,
      cashTendered:  isCash ? tenderedNum : total,
      changeAmount:  isCash ? Math.max(0, change) : 0,
      pointsUsed:    pointsDisc,
    })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-md mx-4 overflow-hidden">
        {/* Header */}
        <div className="bg-indigo-600 px-6 py-4 text-white flex items-center justify-between">
          <div>
            <p className="text-xs opacity-70">Amount Due</p>
            <p className="text-3xl font-bold">{formatCurrency(total)}</p>
            {(discountAmt > 0 || pointsDisc > 0) && (
              <p className="text-xs opacity-70 mt-0.5">
                Subtotal {formatCurrency(subtotal + tax)}
                {discountAmt > 0 && ` · Disc -${formatCurrency(discountAmt)}`}
                {pointsDisc > 0 && ` · Points -${formatCurrency(pointsDisc)}`}
              </p>
            )}
          </div>
          {/* Currency selector */}
          <div className="flex gap-1 bg-indigo-700/50 rounded-xl p-1">
            {['LAK', 'THB'].map(c => (
              <button
                key={c}
                onClick={() => setCurrency(c)}
                className={clsx(
                  'px-2.5 py-1 rounded-lg text-xs font-bold transition-colors',
                  currency === c ? 'bg-white text-indigo-700' : 'text-white/70 hover:text-white'
                )}
              >
                {c}
              </button>
            ))}
          </div>
        </div>

        <div className="p-5 space-y-4">
          {/* Payment method */}
          <div className="flex gap-2">
            {[
              { key: 'cash',     label: '💵 Cash'     },
              { key: 'transfer', label: '🏦 Transfer'  },
              { key: 'card',     label: '💳 Card'      },
            ].map(m => (
              <button
                key={m.key}
                onClick={() => setMethod(m.key)}
                className={clsx(
                  'flex-1 py-2.5 rounded-xl text-sm font-medium transition-colors',
                  method === m.key
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                )}
              >
                {m.label}
              </button>
            ))}
          </div>

          {/* Discount + Voucher row */}
          <div className="flex gap-3">
            <div className="flex-1">
              <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Discount</label>
              <input
                type="number"
                min="0"
                step="1000"
                placeholder="0"
                value={discount}
                onChange={e => setDiscount(e.target.value)}
                className="w-full px-3 py-2 text-sm bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 text-gray-900 dark:text-gray-100"
              />
            </div>
            <div className="flex-1">
              <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Voucher Code</label>
              <input
                placeholder="—"
                value={voucher}
                onChange={e => setVoucher(e.target.value)}
                className="w-full px-3 py-2 text-sm bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 text-gray-900 dark:text-gray-100"
              />
            </div>
          </div>

          {/* Loyalty points */}
          {customer && customer.points > 0 && (
            <label className="flex items-center gap-3 px-4 py-3 bg-amber-50 dark:bg-amber-900/20 rounded-xl cursor-pointer">
              <input
                type="checkbox"
                checked={usePoints}
                onChange={e => setUsePoints(e.target.checked)}
                className="rounded"
              />
              <span className="text-sm text-amber-800 dark:text-amber-300">
                Use loyalty points ({customer.points} pts = -{formatCurrency(pointsDisc)})
              </span>
            </label>
          )}

          {/* Cash tendered (only for cash method) */}
          {isCash && (
            <>
              <div>
                <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Cash Tendered</label>
                <input
                  autoFocus
                  type="number"
                  step="1000"
                  min="0"
                  placeholder="0"
                  value={tendered}
                  onChange={e => setTendered(e.target.value)}
                  className="w-full text-xl font-bold text-gray-900 dark:text-gray-100 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              {quickAmounts.length > 0 && (
                <div className="flex gap-1.5 flex-wrap">
                  {quickAmounts.map(amt => (
                    <button
                      key={amt}
                      onClick={() => setTendered(String(amt))}
                      className="flex-1 min-w-[70px] py-2 text-xs font-semibold bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-xl hover:bg-indigo-50 dark:hover:bg-indigo-900/30 hover:text-indigo-600 transition-colors"
                    >
                      {formatCurrency(amt)}
                    </button>
                  ))}
                </div>
              )}
              {tenderedNum > 0 && (
                <div className={clsx(
                  'flex justify-between px-4 py-2.5 rounded-xl text-sm font-semibold',
                  change >= 0 ? 'bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400' : 'bg-red-50 dark:bg-red-900/20 text-red-600'
                )}>
                  <span>Change</span>
                  <span>{change >= 0 ? formatCurrency(change) : 'Insufficient'}</span>
                </div>
              )}
            </>
          )}

          {/* Actions */}
          <div className="flex gap-2 pt-1">
            <button
              onClick={onClose}
              className="flex-1 py-3 rounded-xl border border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-300 text-sm font-medium hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleConfirm}
              disabled={saving || (isCash && tenderedNum < total)}
              className="flex-[2] py-3 rounded-xl bg-indigo-600 text-white text-sm font-semibold hover:bg-indigo-700 disabled:opacity-50 transition-colors"
            >
              {saving ? 'Processing…' : 'Confirm Payment'}
            </button>
          </div>
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

  const searchRef = useRef(null)

  function newTab(rawTableId = null, tableNumber = null) {
    return {
      id:           Date.now(),
      tableId:      rawTableId,   // raw integer
      tableNumber,
      items:        [],
      waiter:       '',
      customer:     null,
      held:         false,
    }
  }

  const activeOrder = orderTabs[activeTab]
  const setActiveOrder = (updater) => {
    setOrderTabs(prev => prev.map((tab, i) => i === activeTab ? (typeof updater === 'function' ? updater(tab) : updater) : tab))
  }

  // ── Keyboard shortcuts ─────────────────────────────────────────────────────
  useEffect(() => {
    const handler = (e) => {
      if (e.key === 'F3') { e.preventDefault(); setLeftTab('menu'); searchRef.current?.focus() }
      if (e.key === 'F9') { e.preventDefault(); if (activeOrder?.items.length) setPayOpen(true) }
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
    // Extract raw integer from formatted ID like "MI-001"
    const rawMenuId = parseInt(String(menuItem.id).replace('MI-', ''), 10)
    setActiveOrder(order => {
      const existing = order.items.find(i => i.menuItemId === rawMenuId)
      if (existing) {
        return { ...order, items: order.items.map(i => i.menuItemId === rawMenuId ? { ...i, qty: i.qty + 1 } : i) }
      }
      return {
        ...order,
        items: [...order.items, {
          menuItemId: rawMenuId,
          name:       menuItem.name,
          unitPrice:  menuItem.price,
          qty:        1,
        }]
      }
    })
  }

  const changeQty = (menuItemId, delta) => {
    setActiveOrder(order => ({
      ...order,
      items: order.items
        .map(i => i.menuItemId === menuItemId ? { ...i, qty: i.qty + delta } : i)
        .filter(i => i.qty > 0),
    }))
  }

  const removeItem = (menuItemId) => {
    setActiveOrder(order => ({ ...order, items: order.items.filter(i => i.menuItemId !== menuItemId) }))
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
  const subtotal = activeOrder?.items.reduce((s, i) => s + i.qty * i.unitPrice, 0) || 0
  const tax      = subtotal * TAX_RATE
  const total    = subtotal + tax

  const handlePay = async (paymentInfo) => {
    if (!activeOrder.items.length) return
    setSaving(true)
    try {
      const body = {
        tableId:       activeOrder.tableId,
        tableNumber:   activeOrder.tableNumber,
        waiter:        activeOrder.waiter || user?.name || 'Cashier',
        customerId:    activeOrder.customer?.rawId || null,
        items:         activeOrder.items.map(i => ({
          menuItemId: i.menuItemId,
          name:       i.name,
          quantity:   i.qty,
          unitPrice:  i.unitPrice,
        })),
        notes:          '',
        paymentMethod:  paymentInfo.paymentMethod,
        currency:       paymentInfo.currency,
        discount:       paymentInfo.discount,
        voucherCode:    paymentInfo.voucherCode,
        cashTendered:   paymentInfo.cashTendered,
        changeAmount:   paymentInfo.changeAmount,
      }
      const order = await ordersApi.create(body)
      const rawOrderId = parseInt(order.id.replace('ORD-', ''), 10)
      await ordersApi.updateStatus(rawOrderId, 'Closed')
      setPayOpen(false)
      closeTab(activeTab)
    } catch (e) {
      alert(e.message)
    } finally {
      setSaving(false)
    }
  }

  // ── Filtered data ──────────────────────────────────────────────────────────
  const filteredTables = tables.filter(tbl => {
    if (tableFilter === 'free')     return tbl.status === 'Available'
    if (tableFilter === 'reserved') return tbl.status === 'Reserved'
    return true
  })

  const categories = ['All', ...new Set(menuItems.map(m => m.category).filter(Boolean))]
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
        <div className="w-8 h-8 bg-indigo-600 rounded-xl flex items-center justify-center">
          <ShoppingCart size={15} className="text-white" />
        </div>
        <span className="font-bold text-gray-900 dark:text-gray-100 text-sm">POS Sell</span>

        {/* Left tab switcher */}
        <div className="flex gap-1 ml-4 bg-gray-100 dark:bg-gray-700 rounded-xl p-1">
          <button
            onClick={() => setLeftTab('tables')}
            className={clsx(
              'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors',
              leftTab === 'tables'
                ? 'bg-white dark:bg-gray-600 text-gray-900 dark:text-gray-100 shadow-sm'
                : 'text-gray-500 dark:text-gray-400'
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
              className="w-full pl-8 pr-3 py-1.5 text-sm bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-gray-100 border border-gray-200 dark:border-gray-600 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
        )}

        <div className="ml-auto flex items-center gap-2 text-xs text-gray-400 dark:text-gray-500">
          <span className="font-medium text-gray-600 dark:text-gray-300">{user?.name}</span>
          <span>·</span>
          <span>{new Date().toLocaleDateString()}</span>
        </div>
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
                        ? 'bg-indigo-600 text-white'
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
                    const isSelected = activeOrder?.tableId === tbl.id
                    return (
                      <button
                        key={tbl.id}
                        onClick={() => selectTable(tbl)}
                        className={clsx(
                          'aspect-square flex flex-col items-center justify-center rounded-xl border-2 transition-all text-sm font-semibold',
                          isSelected
                            ? 'border-indigo-600 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300'
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
              <div className="flex gap-1.5 px-4 py-2.5 bg-white dark:bg-gray-800 border-b border-gray-100 dark:border-gray-700 overflow-x-auto flex-shrink-0">
                {categories.map(cat => (
                  <button
                    key={cat}
                    onClick={() => setMenuCategory(cat)}
                    className={clsx(
                      'px-3 py-1 rounded-full text-xs font-medium whitespace-nowrap transition-colors',
                      menuCategory === cat
                        ? 'bg-indigo-600 text-white'
                        : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600'
                    )}
                  >
                    {cat}
                  </button>
                ))}
              </div>

              {/* Menu grid */}
              <div className="flex-1 overflow-y-auto p-4">
                <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                  {filteredMenu.map(item => {
                    const cartItem = activeOrder?.items.find(i => i.menuItemId === item.id)
                    return (
                      <button
                        key={item.id}
                        onClick={() => addItem(item)}
                        className={clsx(
                          'flex flex-col items-start p-3 rounded-xl border-2 text-left transition-all hover:shadow-md',
                          cartItem
                            ? 'border-indigo-400 bg-indigo-50 dark:bg-indigo-900/20'
                            : 'border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 hover:border-indigo-300'
                        )}
                      >
                        <div className="w-full aspect-square bg-gray-100 dark:bg-gray-700 rounded-lg mb-2 flex items-center justify-center">
                          {item.imageUrl
                            ? <img src={item.imageUrl} alt={item.name} className="w-full h-full object-cover rounded-lg" />
                            : <UtensilsCrossed size={20} className="text-gray-400" />
                          }
                        </div>
                        <p className="text-xs font-semibold text-gray-900 dark:text-gray-100 line-clamp-2 leading-tight">{item.name}</p>
                        <p className="text-xs text-indigo-600 dark:text-indigo-400 font-bold mt-1">{formatCurrency(item.price)}</p>
                        {cartItem && (
                          <span className="mt-1 bg-indigo-600 text-white text-xs px-1.5 py-0.5 rounded-full">×{cartItem.qty}</span>
                        )}
                      </button>
                    )
                  })}
                  {filteredMenu.length === 0 && (
                    <div className="col-span-4 text-center py-16 text-gray-400 text-sm">
                      No items found
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
                      ? 'bg-indigo-600 text-white'
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
              className="flex-shrink-0 w-7 h-7 rounded-xl bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 hover:text-indigo-600 flex items-center justify-center transition-colors"
            >
              <Plus size={14} />
            </button>
          </div>

          {/* Table + Waiter info */}
          <div className="flex items-center gap-3 px-4 py-2.5 border-b border-gray-50 dark:border-gray-700 flex-shrink-0">
            <div className="flex-1">
              <p className="text-xs text-gray-400 dark:text-gray-500">{t('common.table')}</p>
              <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                {activeOrder?.tableNumber ? `Table ${activeOrder.tableNumber}` : '— No table —'}
              </p>
            </div>
            <div className="flex-1">
              <p className="text-xs text-gray-400 dark:text-gray-500">{t('sell.waiter')}</p>
              <input
                placeholder={user?.name || 'Cashier'}
                value={activeOrder?.waiter || ''}
                onChange={e => setActiveOrder(o => ({ ...o, waiter: e.target.value }))}
                className="text-sm font-medium text-gray-900 dark:text-gray-100 bg-transparent border-b border-gray-200 dark:border-gray-600 focus:outline-none focus:border-indigo-500 w-full"
              />
            </div>
          </div>

          {/* Customer search */}
          <div className="relative px-4 py-2 border-b border-gray-50 dark:border-gray-700 flex-shrink-0">
            {activeOrder?.customer ? (
              <div className="flex items-center justify-between bg-indigo-50 dark:bg-indigo-900/20 rounded-xl px-3 py-2">
                <div className="flex items-center gap-2">
                  <User size={14} className="text-indigo-500" />
                  <span className="text-sm font-medium text-indigo-800 dark:text-indigo-300">{activeOrder.customer.name}</span>
                  <span className="text-xs text-indigo-500">★ {activeOrder.customer.points}</span>
                </div>
                <button onClick={() => setActiveOrder(o => ({ ...o, customer: null }))} className="text-indigo-400 hover:text-indigo-600">
                  <X size={13} />
                </button>
              </div>
            ) : (
              <>
                <div className="relative">
                  <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input
                    placeholder={t('sell.searchCustomer')}
                    value={custSearch}
                    onChange={e => { setCustSearch(e.target.value); setCustDropdown(true) }}
                    onFocus={() => custResults.length && setCustDropdown(true)}
                    className="w-full pl-8 pr-3 py-1.5 text-sm bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 text-gray-900 dark:text-gray-100"
                  />
                </div>
                {custDropdown && custResults.length > 0 && (
                  <div className="absolute left-4 right-4 top-full z-20 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-xl shadow-lg overflow-hidden">
                    {custResults.map(c => (
                      <button
                        key={c.rawId}
                        onClick={() => {
                          setActiveOrder(o => ({ ...o, customer: c }))
                          setCustSearch('')
                          setCustDropdown(false)
                        }}
                        className="w-full flex items-center justify-between px-4 py-2.5 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 text-left"
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
                {activeOrder.items.map(item => (
                  <div key={item.menuItemId} className="flex items-center gap-3 px-4 py-3">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">{item.name}</p>
                      <p className="text-xs text-gray-400">{formatCurrency(item.unitPrice)} each</p>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => changeQty(item.menuItemId, -1)}
                        className="w-6 h-6 rounded-lg bg-gray-100 dark:bg-gray-700 flex items-center justify-center text-gray-600 dark:text-gray-400 hover:bg-red-100 dark:hover:bg-red-900/20 hover:text-red-500 transition-colors"
                      >
                        <Minus size={11} />
                      </button>
                      <span className="w-6 text-center text-sm font-bold text-gray-900 dark:text-gray-100">{item.qty}</span>
                      <button
                        onClick={() => changeQty(item.menuItemId, 1)}
                        className="w-6 h-6 rounded-lg bg-gray-100 dark:bg-gray-700 flex items-center justify-center text-gray-600 dark:text-gray-400 hover:bg-indigo-100 dark:hover:bg-indigo-900/20 hover:text-indigo-500 transition-colors"
                      >
                        <Plus size={11} />
                      </button>
                    </div>
                    <span className="text-sm font-semibold text-gray-900 dark:text-gray-100 w-16 text-right">
                      {formatCurrency(item.qty * item.unitPrice)}
                    </span>
                    <button
                      onClick={() => removeItem(item.menuItemId)}
                      className="p-1 text-gray-300 hover:text-red-500 transition-colors"
                    >
                      <X size={13} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Totals */}
          <div className="flex-shrink-0 border-t border-gray-100 dark:border-gray-700 px-4 py-3 space-y-1.5">
            <div className="flex justify-between text-sm text-gray-500 dark:text-gray-400">
              <span>{t('common.subtotal')}</span>
              <span>{formatCurrency(subtotal)}</span>
            </div>
            <div className="flex justify-between text-sm text-gray-500 dark:text-gray-400">
              <span>Tax (10%)</span>
              <span>{formatCurrency(tax)}</span>
            </div>
            <div className="flex justify-between font-bold text-gray-900 dark:text-gray-100 text-base pt-1 border-t border-gray-100 dark:border-gray-700">
              <span>{t('sell.total')}</span>
              <span className="text-indigo-600 dark:text-indigo-400">{formatCurrency(total)}</span>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex-shrink-0 flex gap-2 px-4 pb-4">
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
              className="flex-[2] flex items-center justify-center gap-2 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-sm disabled:opacity-40 transition-colors"
            >
              <CreditCard size={15} />
              {t('sell.pay')}
            </button>
          </div>
        </div>
      </div>

      {/* Pay Modal */}
      <PayModal
        isOpen={payOpen}
        subtotal={subtotal}
        tax={tax}
        customer={activeOrder?.customer}
        onClose={() => setPayOpen(false)}
        onConfirm={handlePay}
        saving={saving}
      />
    </div>
  )
}
