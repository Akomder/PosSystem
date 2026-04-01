import { useState, useEffect } from 'react'
import { useLocation } from 'react-router-dom'
import {
  PlusCircle, Search, Printer, X,
  Clock, ChevronRight, Minus, Plus,
} from 'lucide-react'
import clsx from 'clsx'
import { useApp } from '../context/AppContext'
import { useAuth } from '../context/AuthContext'
import { useSettings } from '../context/SettingsContext'
import { ordersApi } from '../services/api'
import Badge from '../components/ui/Badge'
import Button from '../components/ui/Button'
import Modal from '../components/ui/Modal'
import Input from '../components/ui/Input'
import Select from '../components/ui/Select'
import EmptyState from '../components/ui/EmptyState'
import {
  formatCurrency, formatTime, formatRelativeTime, getElapsedMinutes,
} from '../utils/formatters'
import {
  getStatusVariant, getNextStatus, getNextStatusLabel,
  sortOrders, calculateSubtotal, calculateTax, calculateTotal,
} from '../utils/orderHelpers'

// Schema status values: 'Pending' | 'In Progress' | 'Served' | 'Closed'
const STATUS_TABS = ['All', 'Pending', 'In Progress', 'Served', 'Closed']

const BTN_VARIANTS = {
  'In Progress': 'primary',
  'Served':      'success',
  'Closed':      'warning',
}

export default function Orders() {
  const { orders, tables, menuItems, addOrder, updateOrderStatus } = useApp()
  const { user } = useAuth()
  const { t } = useSettings()
  const location = useLocation()

  const [search,       setSearch]       = useState('')
  const [tab,          setTab]          = useState('All')
  const [selectedId,   setSelectedId]   = useState(null)
  const [newOrderOpen, setNewOrderOpen] = useState(false)
  const [creating,     setCreating]     = useState(false)
  const [createError,  setCreateError]  = useState(null)

  // New order state
  const [noTable,    setNoTable]    = useState('')
  const [noWaiter,   setNoWaiter]   = useState(user?.name || '')
  const [noSearch,   setNoSearch]   = useState('')
  const [noItems,    setNoItems]    = useState([])
  const [noNotes,    setNoNotes]    = useState('')

  // Pre-select order from Dashboard navigation
  useEffect(() => {
    if (location.state?.selectedOrderId) {
      setSelectedId(location.state.selectedOrderId)
    }
  }, [location.state])

  // Filtered list
  const filtered = sortOrders(orders).filter((o) => {
    const matchTab = tab === 'All' || o.status === tab
    const matchSearch =
      o.id.toLowerCase().includes(search.toLowerCase()) ||
      String(o.tableNumber).includes(search)
    return matchTab && matchSearch
  })

  const tabCount = (t) =>
    t === 'All' ? orders.length : orders.filter((o) => o.status === t).length

  const selectedOrder = orders.find((o) => o.id === selectedId)

  // Elapsed time color
  const elapsedColor = (createdAt) => {
    const m = getElapsedMinutes(createdAt)
    if (m > 60) return 'text-red-600'
    if (m > 30) return 'text-amber-600'
    return 'text-gray-400 dark:text-gray-500'
  }

  // ── New Order helpers ──────────────────────────────────────
  const availableTables = tables.filter((t) => t.status === 'Available')

  const filteredMenuItems = menuItems.filter(
    (m) =>
      m.available &&
      m.name.toLowerCase().includes(noSearch.toLowerCase()),
  )

  const addItemToOrder = (item) => {
    setNoItems((prev) => {
      const existing = prev.find((i) => i.id === item.id)
      if (existing) {
        return prev.map((i) =>
          i.id === item.id ? { ...i, quantity: i.quantity + 1 } : i,
        )
      }
      return [...prev, { id: item.id, name: item.name, unitPrice: item.price, quantity: 1 }]
    })
  }

  const changeQty = (id, delta) => {
    setNoItems((prev) =>
      prev
        .map((i) => i.id === id ? { ...i, quantity: i.quantity + delta } : i)
        .filter((i) => i.quantity > 0),
    )
  }

  const handleCreateOrder = async () => {
    if (!noTable || noItems.length === 0) return
    setCreating(true)
    setCreateError(null)
    try {
      // Convert formatted table id "T-01" → raw integer
      const rawTableId = parseInt(noTable.replace('T-', ''))
      const body = {
        tableId: rawTableId,
        waiter:  noWaiter || user?.name || 'Unassigned',
        notes:   noNotes || undefined,
        items:   noItems.map(i => ({
          menuItemId: parseInt(i.id.replace('MI-', '')),
          quantity:   i.quantity,
          notes:      i.notes || undefined,
        })),
      }
      const newOrder = await ordersApi.create(body)
      addOrder(newOrder)
      setSelectedId(newOrder.id)
      setNewOrderOpen(false)
      setNoTable(''); setNoWaiter(user?.name || ''); setNoSearch(''); setNoItems([]); setNoNotes('')
    } catch (err) {
      setCreateError(err.message || 'Failed to create order')
    } finally {
      setCreating(false)
    }
  }

  return (
    <div className="flex h-full gap-4" style={{ height: 'calc(100vh - 7rem)' }}>

      {/* ── Left Panel ─────────────────────────────────────── */}
      <div className="w-80 flex-shrink-0 flex flex-col bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 shadow-sm overflow-hidden">
        {/* Header */}
        <div className="px-4 pt-4 pb-3 border-b border-gray-100 dark:border-gray-700">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100">{t('orders.title')}</h2>
            <Button size="sm" icon={PlusCircle} onClick={() => setNewOrderOpen(true)}>
              {t('orders.newOrder')}
            </Button>
          </div>
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-500" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t('orders.search')}
              className="w-full pl-8 pr-3 py-2 text-sm border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder:text-gray-400 dark:placeholder:text-gray-500 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-0.5 px-3 py-2 border-b border-gray-100 dark:border-gray-700 overflow-x-auto">
          {STATUS_TABS.map((tabItem) => (
            <button
              key={tabItem}
              onClick={() => setTab(tabItem)}
              className={clsx(
                'px-2.5 py-1 rounded-lg text-xs font-medium whitespace-nowrap transition-colors',
                tab === tabItem
                  ? 'bg-indigo-50 dark:bg-indigo-900/40 text-indigo-600 dark:text-indigo-400'
                  : 'text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700',
              )}
            >
              {tabItem}{' '}
              <span className={clsx(
                'ml-1 text-xs px-1.5 py-0.5 rounded-full',
                tab === tabItem
                  ? 'bg-indigo-100 dark:bg-indigo-900 text-indigo-700 dark:text-indigo-300'
                  : 'bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400',
              )}>
                {tabCount(tabItem)}
              </span>
            </button>
          ))}
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto divide-y divide-gray-50 dark:divide-gray-700">
          {filtered.length === 0 ? (
            <EmptyState icon={Search} title={t('orders.selectOrder')} />
          ) : (
            filtered.map((order) => (
              <button
                key={order.id}
                onClick={() => setSelectedId(order.id)}
                className={clsx(
                  'w-full text-left px-4 py-3 transition-colors',
                  selectedId === order.id
                    ? 'bg-indigo-50 dark:bg-indigo-900/30 ring-1 ring-inset ring-indigo-200 dark:ring-indigo-700'
                    : 'hover:bg-gray-50 dark:hover:bg-gray-700/50',
                )}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-gray-900 dark:text-gray-100">{order.id}</span>
                      <Badge variant={getStatusVariant(order.status)}>{order.status}</Badge>
                    </div>
                    <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">
                      {t('common.table')} {order.tableNumber} · {order.waiter}
                    </p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                      {formatCurrency(order.total)}
                    </p>
                    <p className={clsx('text-xs flex items-center gap-0.5 justify-end', elapsedColor(order.createdAt))}>
                      <Clock size={10} />
                      {formatRelativeTime(order.createdAt)}
                    </p>
                  </div>
                </div>
              </button>
            ))
          )}
        </div>
      </div>

      {/* ── Right Panel ────────────────────────────────────── */}
      <div className="flex-1 flex flex-col bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 shadow-sm overflow-hidden">
        {!selectedOrder ? (
          <EmptyState
            icon={ChevronRight}
            title={t('orders.selectOrder')}
            description={t('orders.clickToView')}
          />
        ) : (
          <>
            {/* Order Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 dark:border-gray-700">
              <div className="flex items-center gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-base font-bold text-gray-900 dark:text-gray-100">{selectedOrder.id}</h2>
                    <Badge variant={getStatusVariant(selectedOrder.status)}>
                      {selectedOrder.status}
                    </Badge>
                  </div>
                  <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">
                    {t('common.table')} {selectedOrder.tableNumber} · {t('common.waiter')}: {selectedOrder.waiter} · {formatTime(selectedOrder.createdAt)}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setSelectedId(null)}
                className="p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
              >
                <X size={15} />
              </button>
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
              {/* Items table */}
              <div>
                <h3 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">
                  {t('orders.items')}
                </h3>
                <div className="border border-gray-100 dark:border-gray-700 rounded-xl overflow-hidden">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50 dark:bg-gray-700/50">
                      <tr>
                        {[t('orders.col.item'), t('orders.col.qty'), t('orders.col.unitPrice'), t('orders.col.total')].map((h) => (
                          <th key={h} className="px-4 py-2.5 text-left text-xs font-medium text-gray-400 dark:text-gray-500">
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50 dark:divide-gray-700">
                      {selectedOrder.items.map((item) => (
                        <tr key={item.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                          <td className="px-4 py-3 font-medium text-gray-900 dark:text-gray-100">{item.name}</td>
                          <td className="px-4 py-3 text-gray-500 dark:text-gray-400">×{item.quantity}</td>
                          <td className="px-4 py-3 text-gray-500 dark:text-gray-400">{formatCurrency(item.unitPrice)}</td>
                          <td className="px-4 py-3 font-medium text-gray-900 dark:text-gray-100">
                            {formatCurrency(item.quantity * item.unitPrice)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Notes */}
              {selectedOrder.notes && (
                <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-100 dark:border-amber-800 rounded-xl px-4 py-3">
                  <p className="text-xs font-semibold text-amber-700 dark:text-amber-400 mb-1">{t('common.notes')}</p>
                  <p className="text-sm text-amber-800 dark:text-amber-300">{selectedOrder.notes}</p>
                </div>
              )}

              {/* Price breakdown */}
              <div className="bg-gray-50 dark:bg-gray-700/50 rounded-xl px-4 py-4 space-y-2">
                <div className="flex justify-between text-sm text-gray-500 dark:text-gray-400">
                  <span>{t('common.subtotal')}</span>
                  <span>{formatCurrency(selectedOrder.subtotal)}</span>
                </div>
                <div className="flex justify-between text-sm text-gray-500 dark:text-gray-400">
                  <span>{t('orders.tax')}</span>
                  <span>{formatCurrency(selectedOrder.tax)}</span>
                </div>
                <div className="border-t border-gray-200 dark:border-gray-600 pt-2 flex justify-between text-base font-bold text-gray-900 dark:text-gray-100">
                  <span>{t('common.total')}</span>
                  <span className="text-indigo-600 dark:text-indigo-400">{formatCurrency(selectedOrder.total)}</span>
                </div>
              </div>
            </div>

            {/* Action Bar */}
            <div className="px-6 py-4 border-t border-gray-100 dark:border-gray-700 flex items-center gap-2 flex-wrap">
              {selectedOrder.status !== 'Closed' && (
                <>
                  {getNextStatus(selectedOrder.status) && (
                    <Button
                      variant={BTN_VARIANTS[getNextStatus(selectedOrder.status)] || 'primary'}
                      onClick={() =>
                        updateOrderStatus(selectedOrder.id, getNextStatus(selectedOrder.status))
                      }
                    >
                      {getNextStatusLabel(selectedOrder.status)}
                    </Button>
                  )}
                  <Button variant="secondary" icon={Printer}>
                    {t('orders.printReceipt')}
                  </Button>
                  <Button
                    variant="danger"
                    onClick={() => {
                      updateOrderStatus(selectedOrder.id, 'Closed')
                      setSelectedId(null)
                    }}
                  >
                    {t('orders.cancelOrder')}
                  </Button>
                </>
              )}
              {selectedOrder.status === 'Closed' && (
                <span className="text-sm text-gray-400 dark:text-gray-500 italic">{t('orders.closedMsg')}</span>
              )}
            </div>
          </>
        )}
      </div>

      {/* ── New Order Modal ─────────────────────────────────── */}
      <Modal
        isOpen={newOrderOpen}
        onClose={() => { setNewOrderOpen(false); setCreateError(null) }}
        title={t('orders.newOrder')}
        size="lg"
        footer={
          <>
            <Button variant="secondary" onClick={() => setNewOrderOpen(false)}>{t('common.cancel')}</Button>
            <Button onClick={handleCreateOrder} disabled={!noTable || noItems.length === 0 || creating}>
              {creating ? t('orders.creating') : t('orders.create')}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          {createError && (
            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg px-4 py-2.5 text-sm text-red-700 dark:text-red-400">
              {createError}
            </div>
          )}
          <div className="grid grid-cols-2 gap-4">
            <Select
              label={t('common.table')}
              required
              value={noTable}
              onChange={(e) => setNoTable(e.target.value)}
              options={availableTables.map((tbl) => ({
                value: tbl.id,
                label: `${t('common.table')} ${tbl.tableNumber} (${tbl.capacity} ${t('common.seats')})`,
              }))}
              placeholder={t('orders.selectTable')}
            />
            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300">{t('common.waiter')}</label>
              <input
                value={noWaiter}
                onChange={(e) => setNoWaiter(e.target.value)}
                placeholder={t('orders.waiterPlaceholder')}
                className="w-full rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-sm text-gray-900 dark:text-gray-100 placeholder:text-gray-400 dark:placeholder:text-gray-500 px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
          </div>

          {/* Item Search */}
          <div>
            <label className="text-sm font-medium text-gray-700 dark:text-gray-300 block mb-1">
              {t('orders.addItems')} <span className="text-red-500">*</span>
            </label>
            <Input
              icon={Search}
              value={noSearch}
              onChange={(e) => setNoSearch(e.target.value)}
              placeholder={t('orders.searchMenu')}
            />
            {noSearch && (
              <div className="mt-1 border border-gray-100 dark:border-gray-700 rounded-xl overflow-hidden max-h-44 overflow-y-auto">
                {filteredMenuItems.slice(0, 8).map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => addItemToOrder(item)}
                    className="w-full flex items-center justify-between px-4 py-2.5 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors text-sm"
                  >
                    <span className="font-medium text-gray-800 dark:text-gray-200">{item.name}</span>
                    <span className="text-indigo-600 dark:text-indigo-400 font-semibold">{formatCurrency(item.price)}</span>
                  </button>
                ))}
                {filteredMenuItems.length === 0 && (
                  <p className="px-4 py-3 text-sm text-gray-400 dark:text-gray-500">{t('orders.noItems')}</p>
                )}
              </div>
            )}
          </div>

          {/* Selected items */}
          {noItems.length > 0 && (
            <div className="border border-gray-100 dark:border-gray-700 rounded-xl overflow-hidden">
              {noItems.map((item) => (
                <div key={item.id} className="flex items-center justify-between px-4 py-2.5 border-b border-gray-50 dark:border-gray-700 last:border-0">
                  <span className="text-sm font-medium text-gray-800 dark:text-gray-200 flex-1">{item.name}</span>
                  <div className="flex items-center gap-2">
                    <button onClick={() => changeQty(item.id, -1)} className="p-1 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700">
                      <Minus size={13} className="text-gray-500 dark:text-gray-400" />
                    </button>
                    <span className="text-sm font-semibold w-5 text-center text-gray-900 dark:text-gray-100">{item.quantity}</span>
                    <button onClick={() => changeQty(item.id, +1)} className="p-1 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700">
                      <Plus size={13} className="text-indigo-600 dark:text-indigo-400" />
                    </button>
                    <span className="text-sm font-medium text-gray-700 dark:text-gray-300 w-16 text-right">
                      {formatCurrency(item.quantity * item.unitPrice)}
                    </span>
                  </div>
                </div>
              ))}
              <div className="px-4 py-2.5 bg-gray-50 dark:bg-gray-700/50 flex justify-between text-sm font-semibold text-gray-900 dark:text-gray-100">
                <span>{t('common.total')}</span>
                <span className="text-indigo-600 dark:text-indigo-400">
                  {formatCurrency(calculateTotal(calculateSubtotal(noItems), calculateTax(calculateSubtotal(noItems))))}
                </span>
              </div>
            </div>
          )}

          {/* Notes */}
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-gray-700 dark:text-gray-300">{t('common.notes')}</label>
            <textarea
              value={noNotes}
              onChange={(e) => setNoNotes(e.target.value)}
              placeholder={t('orders.notesPlaceholder')}
              rows={2}
              className="w-full rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-sm text-gray-900 dark:text-gray-100 placeholder:text-gray-400 dark:placeholder:text-gray-500 px-3 py-2.5 resize-none focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
        </div>
      </Modal>
    </div>
  )
}
