import { useState, useEffect, useRef, useCallback } from 'react'
import { useParams } from 'react-router-dom'
import { ShoppingCart, Plus, Minus, X, ChefHat, UtensilsCrossed, XCircle, CheckCircle2, Clock, Loader2 } from 'lucide-react'
import { publicApi } from '../services/api'

// ── Translations ──────────────────────────────────────────────────────────────
const TR = {
  en: {
    loading:            'Loading…',
    err_title:          'Something went wrong',
    table:              n  => `Table ${n}`,
    cat_all:            'All',
    cat_map:            { Starters: 'Starters', Mains: 'Mains', Drinks: 'Drinks', Desserts: 'Desserts' },
    view_order:         'View Order',
    your_order:         'Your Order',
    special_req:        'Special requests / allergies (optional)',
    special_req_ph:     'e.g. No onions, extra spicy…',
    total:              'Total',
    place_order:        (total, cur) => `Place Order · ${total.toLocaleString()} ${cur}`,
    placing:            'Placing Order…',
    // ── Order tracking ──
    my_order:           'My Order',
    order_id:           'Order',
    status_pending:     'Pending',
    status_progress:    'In Progress',
    status_served:      'Served',
    status_closed:      'Paid & Closed',
    status_cancelled:   'Cancelled',
    status_msg_pending:   'Your order has been received. The kitchen will start soon.',
    status_msg_progress:  'The kitchen is preparing your order!',
    status_msg_served:    'Your order is ready and on its way!',
    items_ordered:      'Items Ordered',
    subtotal:           'Subtotal',
    order_complete_title: 'Thank You!',
    order_complete_msg:   'Your order has been completed. Enjoy your meal!',
    order_again:        'Order something else',
    cash_payment:       '💵 Cash Payment',
    cash_instruction:   'Please have your cash ready. Our staff will collect payment when your order is served.',
    cancel_link:        'Cancel this order',
    cancelled_title:    'Order Cancelled',
    cancelled_msg:      id => `Order ${id} has been cancelled.`,
    no_charges:         'No charges will be made.',
    cancel_q:           'Cancel your order?',
    cancel_desc:        "This only works while the kitchen hasn't started yet.",
    keep_it:            'Keep it',
    yes_cancel:         'Yes, cancel',
    cancelling:         'Cancelling…',
    no_items:           'No items in this category',
    refreshing:         'Checking order status…',
  },
  lo: {
    loading:            'ກຳລັງໂຫຼດ…',
    err_title:          'ມີຂໍ້ຜິດພາດ',
    table:              n  => `ໂຕ໊ະ ${n}`,
    cat_all:            'ທັງໝົດ',
    cat_map:            { Starters: 'ອາຫານເຂົ້າ', Mains: 'ອາຫານຫຼັກ', Drinks: 'ເຄື່ອງດື່ມ', Desserts: 'ຂອງຫວານ' },
    view_order:         'ເບິ່ງລາຍການ',
    your_order:         'ລາຍການສັ່ງ',
    special_req:        'ຄຳຮ້ອງພິເສດ / ສ່ວນປະສົມ (ທາງເລືອກ)',
    special_req_ph:     'ເຊັ່ນ: ບໍ່ໃສ່ຜັກບົ່ວ, ເຜັດຫຼາຍ…',
    total:              'ລວມທັງໝົດ',
    place_order:        (total, cur) => `ສັ່ງອາຫານ · ${total.toLocaleString()} ${cur}`,
    placing:            'ກຳລັງສັ່ງ…',
    my_order:           'ການສັ່ງຂອງຂ້ອຍ',
    order_id:           'ການສັ່ງ',
    status_pending:     'ລໍຖ້າ',
    status_progress:    'ກຳລັງກຽມ',
    status_served:      'ພ້ອມແລ້ວ',
    status_closed:      'ຊຳລະແລ້ວ',
    status_cancelled:   'ຍົກເລີກ',
    status_msg_pending:   'ໄດ້ຮັບການສັ່ງຂອງທ່ານແລ້ວ. ຄົວຈະເລີ່ມໃນໄວໆນີ້.',
    status_msg_progress:  'ຄົວກຳລັງກຽມອາຫານຂອງທ່ານ!',
    status_msg_served:    'ອາຫານຂອງທ່ານພ້ອມແລ້ວ!',
    items_ordered:      'ລາຍການທີ່ສັ່ງ',
    subtotal:           'ລວມ',
    order_complete_title: 'ຂໍຂອບໃຈ!',
    order_complete_msg:   'ການສັ່ງຂອງທ່ານສຳເລັດແລ້ວ. ຊົງລົດຊາດ!',
    order_again:        'ສັ່ງລາຍການໃໝ່',
    cash_payment:       '💵 ຊຳລະເງິນສົດ',
    cash_instruction:   'ກະລຸນາກຽມເງິນສົດ. ພະນັກງານຈະມາຮັບເງິນ.',
    cancel_link:        'ຍົກເລີກການສັ່ງ',
    cancelled_title:    'ຍົກເລີກການສັ່ງແລ້ວ',
    cancelled_msg:      id => `ການສັ່ງ ${id} ຖືກຍົກເລີກແລ້ວ.`,
    no_charges:         'ບໍ່ມີການຄິດຄ່າໃຊ້ຈ່າຍ',
    cancel_q:           'ຍົກເລີກການສັ່ງ?',
    cancel_desc:        'ສາມາດຍົກເລີກໄດ້ກ່ອນທີ່ຄົວຈະເລີ່ມກຽມ.',
    keep_it:            'ຮັກສາໄວ້',
    yes_cancel:         'ຍົກເລີກ',
    cancelling:         'ກຳລັງຍົກເລີກ…',
    no_items:           'ບໍ່ມີລາຍການໃນໝວດນີ້',
    refreshing:         'ກຳລັງກວດສອບສະຖານະ…',
  },
}

const CAT_COLOUR = {
  Starters: 'bg-amber-100 text-amber-700',
  Mains:    'bg-teal-100  text-teal-700',
  Drinks:   'bg-blue-100  text-blue-700',
  Desserts: 'bg-pink-100  text-pink-700',
}

const STATUS_STEPS = ['Pending', 'In Progress', 'Served']

function cartTotal(cart) {
  return cart.reduce((s, i) => s + i.price * i.quantity, 0)
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function CustomerOrder() {
  const { tableId } = useParams()

  // ── Core data ──────────────────────────────────────────────────────────────
  const [table,   setTable]   = useState(null)
  const [menu,    setMenu]    = useState([])
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState(null)

  // ── View: 'menu' | 'tracking' | 'complete' | 'cancelled' ───────────────────
  const [view,         setView]         = useState('menu')
  const [activeOrder,  setActiveOrder]  = useState(null)  // order object from API
  const [cancelConfirm,setCancelConfirm]= useState(false)
  const [cancelling,   setCancelling]   = useState(false)

  // ── Menu / cart ────────────────────────────────────────────────────────────
  const [cart,           setCart]           = useState([])
  const [notes,          setNotes]          = useState('')
  const [activeCategory, setActiveCategory] = useState('All')
  const [cartOpen,       setCartOpen]       = useState(false)
  const [submitting,     setSubmitting]     = useState(false)

  // ── Lang ───────────────────────────────────────────────────────────────────
  const [lang, setLang] = useState(() => {
    try { return localStorage.getItem('qr_lang') || 'en' } catch { return 'en' }
  })
  const t = (key, ...args) => {
    const v = TR[lang]?.[key] ?? TR.en[key]
    return typeof v === 'function' ? v(...args) : (v ?? key)
  }
  const catLabel = (cat) => cat === 'All' ? t('cat_all') : (TR[lang]?.cat_map?.[cat] ?? cat)
  const toggleLang = () => {
    const next = lang === 'en' ? 'lo' : 'en'
    setLang(next)
    try { localStorage.setItem('qr_lang', next) } catch {}
  }

  // ── Polling ref ────────────────────────────────────────────────────────────
  const pollRef = useRef(null)

  const stopPoll = () => { if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null } }

  // ── Fetch & display an active order ───────────────────────────────────────
  // orderId is always a raw integer (returned directly from server or order.rawId)
  const loadOrder = useCallback(async (orderId) => {
    try {
      const order = await publicApi.getOrder(orderId, tableId)
      setActiveOrder(order)
      if (order.status === 'Closed') { setView('complete'); stopPoll(); return }
      if (order.status === 'Cancelled') { setView('cancelled'); stopPoll(); return }
      setView('tracking')
    } catch {
      // Order gone (table was reset) — back to menu
      setView('menu')
      setActiveOrder(null)
      stopPoll()
    }
  }, [tableId])

  // ── Initial load ───────────────────────────────────────────────────────────
  useEffect(() => {
    async function load() {
      try {
        const [tableData, menuData] = await Promise.all([
          publicApi.getTable(tableId),
          publicApi.getMenu(tableId),
        ])
        setTable(tableData)
        setMenu(menuData)

        // If the table already has an active order, go straight to tracking
        if (tableData.currentOrderId) {
          await loadOrder(tableData.currentOrderId)
        }
      } catch (err) {
        setError(err.message || 'Failed to load')
      } finally {
        setLoading(false)
      }
    }
    load()
    return () => stopPoll()
  }, [tableId, loadOrder])

  // ── Start polling when tracking view is active ─────────────────────────────
  useEffect(() => {
    if (view !== 'tracking' || !activeOrder) return
    stopPoll()
    pollRef.current = setInterval(() => {
      loadOrder(activeOrder.rawId)
    }, 12000)
    return () => stopPoll()
  }, [view, activeOrder?.id, loadOrder])

  // ── Cart ops ───────────────────────────────────────────────────────────────
  const addItem    = (item) => setCart(prev => {
    const ex = prev.find(c => c.id === item.id)
    if (ex) return prev.map(c => c.id === item.id ? { ...c, quantity: c.quantity + 1 } : c)
    return [...prev, { id: item.id, name: item.name, price: item.price, quantity: 1 }]
  })
  const removeItem = (id) => setCart(prev => {
    const ex = prev.find(c => c.id === id)
    if (!ex) return prev
    if (ex.quantity === 1) return prev.filter(c => c.id !== id)
    return prev.map(c => c.id === id ? { ...c, quantity: c.quantity - 1 } : c)
  })
  const clearItem  = (id) => setCart(prev => prev.filter(c => c.id !== id))
  const getQty     = (id) => cart.find(c => c.id === id)?.quantity || 0

  // ── Submit order ───────────────────────────────────────────────────────────
  const handleSubmit = async () => {
    if (!cart.length) return
    setSubmitting(true)
    try {
      const result = await publicApi.createOrder({
        tableId,
        notes:         notes.trim(),
        items:         cart.map(c => ({ menuItemId: c.id, quantity: c.quantity })),
        paymentMethod: 'cash',
      })
      setCart([])
      setNotes('')
      setCartOpen(false)
      await loadOrder(result.rawId)
    } catch (err) {
      alert(err.message || 'Could not place order. Please ask a staff member.')
    } finally {
      setSubmitting(false)
    }
  }

  // ── Cancel order ───────────────────────────────────────────────────────────
  const handleCancelOrder = async () => {
    if (!activeOrder) return
    setCancelling(true)
    try {
      await publicApi.cancelOrder(activeOrder.rawId, tableId)
      stopPoll()
      setView('cancelled')
      setCancelConfirm(false)
    } catch (err) {
      setCancelConfirm(false)
      alert(err.message || 'Could not cancel. Please ask a staff member.')
    } finally {
      setCancelling(false)
    }
  }

  // ── Derived ────────────────────────────────────────────────────────────────
  const grouped = menu.reduce((acc, item) => {
    if (!acc[item.category]) acc[item.category] = []
    acc[item.category].push(item)
    return acc
  }, {})
  const catOrder    = [...new Set(menu.map(m => m.category).filter(Boolean))]
  const categories  = ['All', ...catOrder]
  const visibleItems = activeCategory === 'All' ? menu : (grouped[activeCategory] || [])
  const total       = cartTotal(cart)
  const cartCount   = cart.reduce((s, i) => s + i.quantity, 0)
  const currency    = table?.currency || 'LAK'

  // ── Shared lang button ─────────────────────────────────────────────────────
  const LangBtn = () => (
    <button
      onClick={toggleLang}
      className="flex-shrink-0 px-2.5 py-1 rounded-full text-xs font-bold border border-gray-200 bg-white text-gray-600 hover:bg-gray-50 transition-colors shadow-sm"
    >
      {lang === 'en' ? 'ລາວ' : 'EN'}
    </button>
  )

  // ── Loading ────────────────────────────────────────────────────────────────
  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="text-center">
        <div className="w-10 h-10 border-2 border-teal-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
        <p className="text-gray-400 text-sm">{t('loading')}</p>
      </div>
    </div>
  )

  // ── Error ──────────────────────────────────────────────────────────────────
  if (error) return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-6">
      <div className="text-center">
        <div className="w-14 h-14 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-3">
          <X size={24} className="text-red-400" />
        </div>
        <p className="text-red-500 font-medium mb-1">{t('err_title')}</p>
        <p className="text-gray-400 text-sm">{error}</p>
      </div>
    </div>
  )

  // ── Cancelled screen ───────────────────────────────────────────────────────
  if (view === 'cancelled') return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-6">
      <div className="text-center max-w-xs w-full">
        <div className="flex justify-end mb-2"><LangBtn /></div>
        <div className="w-20 h-20 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-5 shadow-inner">
          <XCircle size={34} className="text-red-400" />
        </div>
        <h1 className="text-2xl font-bold text-gray-900 mb-2">{t('cancelled_title')}</h1>
        <p className="text-sm text-gray-500 mb-1">
          {t('cancelled_msg', <span className="font-semibold text-gray-700">{activeOrder?.id}</span>)}
        </p>
        <p className="text-xs text-gray-400 mb-6">{t('no_charges')}</p>
        <button
          onClick={() => { setActiveOrder(null); setView('menu') }}
          className="px-6 py-2.5 bg-teal-600 text-white text-sm font-semibold rounded-xl hover:bg-teal-700 transition-colors shadow-sm"
        >
          {t('order_again')}
        </button>
      </div>
    </div>
  )

  // ── Order complete screen ──────────────────────────────────────────────────
  if (view === 'complete') return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-6">
      <div className="text-center max-w-xs w-full">
        <div className="flex justify-end mb-2"><LangBtn /></div>
        <div className="w-20 h-20 bg-teal-50 rounded-full flex items-center justify-center mx-auto mb-5 shadow-inner">
          <CheckCircle2 size={34} className="text-teal-500" />
        </div>
        <h1 className="text-2xl font-bold text-gray-900 mb-2">{t('order_complete_title')}</h1>
        <p className="text-sm text-gray-500 mb-6">{t('order_complete_msg')}</p>
        <button
          onClick={() => { setActiveOrder(null); setView('menu') }}
          className="px-6 py-2.5 bg-teal-600 text-white text-sm font-semibold rounded-xl hover:bg-teal-700 transition-colors shadow-sm"
        >
          {t('order_again')}
        </button>
      </div>
    </div>
  )

  // ── Order tracking view ────────────────────────────────────────────────────
  if (view === 'tracking' && activeOrder) {
    const stepIndex  = STATUS_STEPS.indexOf(activeOrder.status)
    const orderItems = activeOrder.items || []
    const orderTotal = parseFloat(activeOrder.total || 0)

    const statusLabel = {
      'Pending':     t('status_pending'),
      'In Progress': t('status_progress'),
      'Served':      t('status_served'),
      'Closed':      t('status_closed'),
      'Cancelled':   t('status_cancelled'),
    }[activeOrder.status] || activeOrder.status

    const statusMsg = {
      'Pending':     t('status_msg_pending'),
      'In Progress': t('status_msg_progress'),
      'Served':      t('status_msg_served'),
    }[activeOrder.status]

    return (
      <div className="min-h-screen bg-gray-50">
        {/* Header */}
        <header className="sticky top-0 z-20 bg-white border-b border-gray-100 shadow-sm">
          <div className="px-4 py-3 flex items-center justify-between max-w-xl mx-auto">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 bg-teal-600 rounded-lg flex items-center justify-center flex-shrink-0">
                <UtensilsCrossed size={14} className="text-white" />
              </div>
              <div>
                <p className="text-xs text-gray-400 leading-none truncate max-w-[140px]">{table?.restaurantName}</p>
                <h1 className="text-sm font-bold text-gray-900">{t('table', table?.number)}</h1>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <LangBtn />
              {/* Live polling indicator */}
              <span className="flex items-center gap-1 text-xs text-teal-500">
                <Loader2 size={11} className="animate-spin" />
              </span>
            </div>
          </div>
        </header>

        <main className="px-4 py-5 pb-10 max-w-xl mx-auto space-y-4">

          {/* Order ID + status badge */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm px-5 py-4">
            <div className="flex items-center justify-between mb-1">
              <p className="text-xs text-gray-400 font-medium uppercase tracking-wide">{t('order_id')}</p>
              <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${
                activeOrder.status === 'Served'      ? 'bg-green-100 text-green-700' :
                activeOrder.status === 'In Progress' ? 'bg-amber-100 text-amber-700' :
                                                       'bg-gray-100  text-gray-600'
              }`}>
                {statusLabel}
              </span>
            </div>
            <p className="text-xl font-bold text-gray-900">{activeOrder.id}</p>
            {statusMsg && (
              <p className="text-xs text-gray-500 mt-1.5 leading-relaxed">{statusMsg}</p>
            )}
          </div>

          {/* Progress stepper */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm px-5 py-4">
            <div className="flex items-center">
              {STATUS_STEPS.map((step, i) => {
                const done    = stepIndex > i
                const current = stepIndex === i
                const label   = [t('status_pending'), t('status_progress'), t('status_served')][i]
                return (
                  <div key={step} className="flex items-center flex-1 last:flex-none">
                    <div className="flex flex-col items-center">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-colors ${
                        done    ? 'bg-teal-600 text-white' :
                        current ? 'bg-teal-100 border-2 border-teal-500 text-teal-600' :
                                  'bg-gray-100 text-gray-400'
                      }`}>
                        {done ? <CheckCircle2 size={14} /> : current ? <Clock size={13} /> : i + 1}
                      </div>
                      <p className={`text-[10px] mt-1 font-medium whitespace-nowrap ${current ? 'text-teal-600' : done ? 'text-gray-500' : 'text-gray-300'}`}>
                        {label}
                      </p>
                    </div>
                    {i < STATUS_STEPS.length - 1 && (
                      <div className={`flex-1 h-0.5 mx-1 mb-4 rounded ${done ? 'bg-teal-500' : 'bg-gray-200'}`} />
                    )}
                  </div>
                )
              })}
            </div>
          </div>

          {/* Items list */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="px-5 py-3 border-b border-gray-50">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">{t('items_ordered')}</p>
            </div>
            <div className="divide-y divide-gray-50">
              {orderItems.map((item, i) => (
                <div key={item.orderItemId ?? i} className="flex items-center justify-between px-5 py-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="w-6 h-6 bg-teal-50 text-teal-600 text-xs font-bold rounded-full flex items-center justify-center flex-shrink-0">
                      {item.quantity}
                    </span>
                    <p className="text-sm font-medium text-gray-800 truncate">{item.name}</p>
                  </div>
                  <p className="text-sm font-semibold text-gray-900 flex-shrink-0 ml-3">
                    {(item.unitPrice * item.quantity).toLocaleString()}
                  </p>
                </div>
              ))}
            </div>
            {/* Total */}
            <div className="px-5 py-3 bg-gray-50 border-t border-gray-100 flex justify-between items-center">
              <p className="text-sm font-bold text-gray-700">{t('total')}</p>
              <p className="text-base font-extrabold text-teal-600">{orderTotal.toLocaleString()} {currency}</p>
            </div>
          </div>

          {/* Cash payment info */}
          <div className="bg-teal-50 border border-teal-100 rounded-2xl px-5 py-4">
            <p className="text-sm font-semibold text-teal-700 mb-1">{t('cash_payment')}</p>
            <p className="text-xs text-teal-600 leading-relaxed">{t('cash_instruction')}</p>
          </div>

          {/* Cancel (only while Pending) */}
          {activeOrder.status === 'Pending' && (
            <div className="text-center">
              {!cancelConfirm ? (
                <button
                  onClick={() => setCancelConfirm(true)}
                  className="text-xs text-gray-400 hover:text-red-500 transition-colors underline underline-offset-2"
                >
                  {t('cancel_link')}
                </button>
              ) : (
                <div className="bg-red-50 border border-red-100 rounded-2xl p-4 text-left">
                  <p className="text-sm font-semibold text-red-700 mb-1">{t('cancel_q')}</p>
                  <p className="text-xs text-red-400 mb-4">{t('cancel_desc')}</p>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setCancelConfirm(false)}
                      disabled={cancelling}
                      className="flex-1 py-2.5 text-sm font-medium text-gray-600 bg-white border border-gray-200 rounded-xl hover:bg-gray-50 disabled:opacity-50 transition-colors"
                    >
                      {t('keep_it')}
                    </button>
                    <button
                      onClick={handleCancelOrder}
                      disabled={cancelling}
                      className="flex-1 py-2.5 text-sm font-semibold text-white bg-red-500 rounded-xl hover:bg-red-600 disabled:opacity-50 transition-colors"
                    >
                      {cancelling ? t('cancelling') : t('yes_cancel')}
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </main>
      </div>
    )
  }

  // ── Menu view ──────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-gray-50">

      <header className="sticky top-0 z-20 bg-white border-b border-gray-100 shadow-sm">
        <div className="px-4 py-3 flex items-center justify-between max-w-xl mx-auto">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 bg-teal-600 rounded-lg flex items-center justify-center flex-shrink-0">
              <UtensilsCrossed size={14} className="text-white" />
            </div>
            <div>
              <p className="text-xs text-gray-400 leading-none truncate max-w-[140px]">{table?.restaurantName}</p>
              <h1 className="text-sm font-bold text-gray-900">{t('table', table?.number)}</h1>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <LangBtn />
            <button
              onClick={() => setCartOpen(true)}
              className="relative p-2 text-teal-600 hover:bg-teal-50 rounded-xl transition-colors"
            >
              <ShoppingCart size={22} />
              {cartCount > 0 && (
                <span className="absolute -top-1 -right-1 w-5 h-5 bg-teal-600 text-white text-xs font-bold rounded-full flex items-center justify-center">
                  {cartCount}
                </span>
              )}
            </button>
          </div>
        </div>

        {/* Category tabs */}
        <div className="flex gap-2 px-4 pb-3 overflow-x-auto scrollbar-hide max-w-xl mx-auto">
          {categories.map(cat => (
            <button
              key={cat}
              onClick={() => setActiveCategory(cat)}
              className={`flex-shrink-0 px-3.5 py-1.5 rounded-full text-xs font-semibold transition-colors ${
                activeCategory === cat
                  ? 'bg-teal-600 text-white shadow-sm'
                  : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
              }`}
            >
              {catLabel(cat)}
            </button>
          ))}
        </div>
      </header>

      <main className="px-4 py-4 pb-32 max-w-xl mx-auto">
        {activeCategory === 'All' ? (
          catOrder.filter(c => grouped[c]).map(cat => (
            <section key={cat} className="mb-6">
              <div className="flex items-center gap-2 mb-3">
                <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold ${CAT_COLOUR[cat] || 'bg-gray-100 text-gray-600'}`}>
                  {catLabel(cat)}
                </span>
              </div>
              <MenuItemList items={grouped[cat]} getQty={getQty} addItem={addItem} removeItem={removeItem} />
            </section>
          ))
        ) : (
          <MenuItemList items={visibleItems} getQty={getQty} addItem={addItem} removeItem={removeItem} />
        )}
        {visibleItems.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16 text-gray-400">
            <UtensilsCrossed size={32} className="mb-2 opacity-30" />
            <p className="text-sm">{t('no_items')}</p>
          </div>
        )}
      </main>

      {/* Sticky cart bar */}
      {cartCount > 0 && !cartOpen && (
        <div className="fixed bottom-0 left-0 right-0 z-10 p-4 max-w-xl mx-auto">
          <button
            onClick={() => setCartOpen(true)}
            className="w-full bg-teal-600 text-white font-semibold py-3.5 rounded-xl flex items-center justify-between px-5 shadow-lg"
          >
            <span className="bg-teal-500 text-white text-xs font-bold px-2 py-0.5 rounded-full">{cartCount}</span>
            <span>{t('view_order')}</span>
            <span>{total.toLocaleString()} {currency}</span>
          </button>
        </div>
      )}

      {/* Cart slide-over */}
      {cartOpen && (
        <>
          <div className="fixed inset-0 bg-black/30 z-30" onClick={() => setCartOpen(false)} />
          <div className="fixed bottom-0 left-0 right-0 z-40 bg-white rounded-t-2xl shadow-xl max-w-xl mx-auto max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 flex-shrink-0">
              <h2 className="font-bold text-gray-900">{t('your_order')}</h2>
              <button onClick={() => setCartOpen(false)} className="p-1 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100">
                <X size={18} />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto px-5 py-3 space-y-3 min-h-0">
              {cart.map(item => (
                <div key={item.id} className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2 flex-1 min-w-0">
                    <button onClick={() => clearItem(item.id)} className="text-gray-300 hover:text-red-400 flex-shrink-0 transition-colors">
                      <X size={14} />
                    </button>
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">{item.name}</p>
                      <p className="text-xs text-gray-400">{item.price.toLocaleString()} each</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <button onClick={() => removeItem(item.id)} className="w-6 h-6 rounded-full bg-gray-100 flex items-center justify-center hover:bg-gray-200 transition-colors">
                      <Minus size={10} />
                    </button>
                    <span className="w-5 text-center text-sm font-semibold">{item.quantity}</span>
                    <button onClick={() => addItem(item)} className="w-6 h-6 rounded-full bg-teal-100 text-teal-600 flex items-center justify-center hover:bg-teal-200 transition-colors">
                      <Plus size={10} />
                    </button>
                  </div>
                  <span className="text-sm font-semibold text-gray-900 w-20 text-right flex-shrink-0">
                    {(item.price * item.quantity).toLocaleString()}
                  </span>
                </div>
              ))}
              <div className="pt-2">
                <label className="text-xs font-medium text-gray-500 mb-1 block">{t('special_req')}</label>
                <textarea
                  value={notes}
                  onChange={e => setNotes(e.target.value)}
                  placeholder={t('special_req_ph')}
                  rows={2}
                  className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2 resize-none focus:outline-none focus:ring-2 focus:ring-teal-500 placeholder:text-gray-300"
                />
              </div>
            </div>
            <div className="px-5 py-3 border-t border-gray-100 flex-shrink-0">
              <div className="flex justify-between text-base font-bold text-gray-900">
                <span>{t('total')}</span>
                <span>{total.toLocaleString()} {currency}</span>
              </div>
            </div>
            <div className="px-5 pb-8 pt-2 flex-shrink-0 border-t border-gray-100">
              <button
                onClick={handleSubmit}
                disabled={submitting || !cart.length}
                className="w-full bg-teal-600 hover:bg-teal-700 text-white font-semibold py-3.5 rounded-xl disabled:opacity-50 transition-colors"
              >
                {submitting ? t('placing') : t('place_order', total, currency)}
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  )
}

// ── Menu item list ─────────────────────────────────────────────────────────────
function MenuItemList({ items, getQty, addItem, removeItem }) {
  return (
    <div className="space-y-3">
      {items.map(item => {
        const qty = getQty(item.id)
        return (
          <div key={item.id} className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden flex">
            {item.imageUrl && (
              <div className="w-24 flex-shrink-0 bg-gray-100">
                <img src={item.imageUrl} alt={item.name} className="w-full h-full object-cover" style={{ minHeight: '80px' }} />
              </div>
            )}
            <div className="flex flex-1 items-start justify-between gap-3 p-3 min-w-0">
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-gray-900 text-sm">{item.name}</p>
                {item.description && (
                  <p className="text-xs text-gray-400 mt-0.5 line-clamp-2">{item.description}</p>
                )}
                {item.prepTime > 0 && (
                  <p className="text-[11px] text-gray-300 mt-0.5">~{item.prepTime} min</p>
                )}
                <p className="text-sm font-bold text-teal-600 mt-1.5">{item.price.toLocaleString()}</p>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0 pt-0.5">
                {qty > 0 && (
                  <>
                    <button onClick={() => removeItem(item.id)} className="w-7 h-7 rounded-full bg-teal-50 text-teal-600 flex items-center justify-center hover:bg-teal-100 transition-colors">
                      <Minus size={12} />
                    </button>
                    <span className="w-4 text-center text-sm font-bold text-gray-900">{qty}</span>
                  </>
                )}
                <button onClick={() => addItem(item)} className="w-7 h-7 rounded-full bg-teal-600 text-white flex items-center justify-center hover:bg-teal-700 transition-colors shadow-sm">
                  <Plus size={12} />
                </button>
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}
