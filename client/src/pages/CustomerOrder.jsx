import { useState, useEffect } from 'react'
import { useParams } from 'react-router-dom'
import { ShoppingCart, Plus, Minus, X, ChefHat, UtensilsCrossed, XCircle, QrCode, Banknote } from 'lucide-react'
import { publicApi } from '../services/api'

// ── Translations ──────────────────────────────────────────────────────────────
const TR = {
  en: {
    loading:               'Loading menu…',
    err_title:             'Something went wrong',
    table:                 n  => `Table ${n}`,
    cat_all:               'All',
    cat_map:               { Starters: 'Starters', Mains: 'Mains', Drinks: 'Drinks', Desserts: 'Desserts' },
    view_order:            'View Order',
    your_order:            'Your Order',
    special_req:           'Special requests / allergies (optional)',
    special_req_ph:        'e.g. No onions, extra spicy…',
    subtotal:              'Subtotal',
    total:                 'Total',
    pay_how:               'How would you like to pay?',
    cash:                  'Cash',
    qr_payment:            'QR Payment',
    place_order:           (total, cur) => `Place Order · ${total.toLocaleString()} ${cur}`,
    placing:               'Placing Order…',
    order_placed:          'Order Placed!',
    preparing:             'is being prepared.',
    scan_to_pay:           '📱 Scan to Pay',
    scan_instruction:      'Open your banking app and scan this QR code to pay',
    amount:                'Amount',
    qr_selected:           '📱 QR Payment Selected',
    cashier_notified:      'Our cashier has been notified. They will bring a QR code for you to scan and pay.',
    cash_payment:          '💵 Cash Payment',
    cash_instruction:      'Please have your cash ready. Our staff will collect payment when your order is served.',
    order_more:            'Order more items',
    cancel_link:           'Cancel this order',
    cancelled_title:       'Order Cancelled',
    cancelled_msg:         id => `Order ${id} has been cancelled.`,
    no_charges:            'No charges will be made.',
    order_again:           'Order something else',
    cancel_q:              'Cancel your order?',
    cancel_desc:           "This only works while the kitchen hasn't started yet.",
    keep_it:               'Keep it',
    yes_cancel:            'Yes, cancel',
    cancelling:            'Cancelling…',
    no_items:              'No items in this category',
    min_each:              '~{n} min',
  },
  lo: {
    loading:               'ກຳລັງໂຫຼດເມນູ…',
    err_title:             'ມີຂໍ້ຜິດພາດ',
    table:                 n  => `ໂຕ໊ະ ${n}`,
    cat_all:               'ທັງໝົດ',
    cat_map:               { Starters: 'ອາຫານເຂົ້າ', Mains: 'ອາຫານຫຼັກ', Drinks: 'ເຄື່ອງດື່ມ', Desserts: 'ຂອງຫວານ' },
    view_order:            'ເບິ່ງລາຍການ',
    your_order:            'ລາຍການສັ່ງ',
    special_req:           'ຄຳຮ້ອງພິເສດ / ສ່ວນປະສົມ (ທາງເລືອກ)',
    special_req_ph:        'ເຊັ່ນ: ບໍ່ໃສ່ຜັກບົ່ວ, ເຜັດຫຼາຍ…',
    subtotal:              'ລວມ',
    total:                 'ລວມທັງໝົດ',
    pay_how:               'ທ່ານຕ້ອງການຊຳລະດ້ວຍວິທີໃດ?',
    cash:                  'ເງິນສົດ',
    qr_payment:            'ຊຳລະ QR',
    place_order:           (total, cur) => `ສັ່ງອາຫານ · ${total.toLocaleString()} ${cur}`,
    placing:               'ກຳລັງສັ່ງ…',
    order_placed:          'ສັ່ງອາຫານສຳເລັດ!',
    preparing:             'ກຳລັງກຽມ.',
    scan_to_pay:           '📱 ສະແກນເພື່ອຊຳລະ',
    scan_instruction:      'ເປີດແອບທະນາຄານ ແລ້ວສະແກນ QR ເພື່ອຊຳລະ',
    amount:                'ຈຳນວນ',
    qr_selected:           '📱 ເລືອກຊຳລະ QR',
    cashier_notified:      'ພະນັກງານໄດ້ຮັບການແຈ້ງເຕືອນແລ້ວ. ພວກເຂົາຈະນຳ QR ມາໃຫ້ທ່ານສະແກນ.',
    cash_payment:          '💵 ຊຳລະເງິນສົດ',
    cash_instruction:      'ກະລຸນາກຽມເງິນສົດ. ພະນັກງານຈະມາຮັບເງິນເມື່ອອາຫານຖືກເສີດ.',
    order_more:            'ສັ່ງເພີ່ມ',
    cancel_link:           'ຍົກເລີກການສັ່ງ',
    cancelled_title:       'ຍົກເລີກການສັ່ງແລ້ວ',
    cancelled_msg:         id => `ການສັ່ງ ${id} ຖືກຍົກເລີກແລ້ວ.`,
    no_charges:            'ບໍ່ມີການຄິດຄ່າໃຊ້ຈ່າຍ',
    order_again:           'ສັ່ງລາຍການໃໝ່',
    cancel_q:              'ຍົກເລີກການສັ່ງ?',
    cancel_desc:           'ສາມາດຍົກເລີກໄດ້ກ່ອນທີ່ຄົວຈະເລີ່ມກຽມ.',
    keep_it:               'ຮັກສາໄວ້',
    yes_cancel:            'ຍົກເລີກ',
    cancelling:            'ກຳລັງຍົກເລີກ…',
    no_items:              'ບໍ່ມີລາຍການໃນໝວດນີ້',
    min_each:              '~{n} ນາທີ',
  },
}

// ── Cart total (no tax) ───────────────────────────────────────────────────────
function cartTotal(cart) {
  const total = cart.reduce((s, i) => s + i.price * i.quantity, 0)
  return { total }
}

// ── Category badge colours ────────────────────────────────────────────────────
const CAT_COLOUR = {
  Starters: 'bg-amber-100  text-amber-700',
  Mains:    'bg-teal-100   text-teal-700',
  Drinks:   'bg-blue-100   text-blue-700',
  Desserts: 'bg-pink-100   text-pink-700',
}
const CAT_ORDER = ['Starters', 'Mains', 'Drinks', 'Desserts']

// ── Main page ─────────────────────────────────────────────────────────────────
export default function CustomerOrder() {
  const { tableId } = useParams()

  const [table,          setTable]          = useState(null)
  const [menu,           setMenu]           = useState([])
  const [cart,           setCart]           = useState([])
  const [notes,          setNotes]          = useState('')
  const [payMethod,      setPayMethod]      = useState('cash')
  const [activeCategory, setActiveCategory] = useState('All')
  const [loading,        setLoading]        = useState(true)
  const [error,          setError]          = useState(null)
  const [cartOpen,       setCartOpen]       = useState(false)
  const [submitting,     setSubmitting]     = useState(false)
  const [confirmation,   setConfirmation]   = useState(null)
  const [cancelled,      setCancelled]      = useState(null)
  const [cancelConfirm,  setCancelConfirm]  = useState(false)
  const [cancelling,     setCancelling]     = useState(false)
  // Language: persist preference in localStorage
  const [lang, setLang] = useState(() => {
    try { return localStorage.getItem('qr_lang') || 'en' } catch { return 'en' }
  })

  // Shorthand translator
  const t = (key, ...args) => {
    const v = TR[lang]?.[key] ?? TR.en[key]
    return typeof v === 'function' ? v(...args) : (v ?? key)
  }
  // Category label (falls back to original string for unknown categories)
  const catLabel = (cat) => {
    if (cat === 'All') return t('cat_all')
    return (TR[lang]?.cat_map?.[cat]) ?? cat
  }

  function toggleLang() {
    const next = lang === 'en' ? 'lo' : 'en'
    setLang(next)
    try { localStorage.setItem('qr_lang', next) } catch {}
  }

  // ── Load table + menu ─────────────────────────────────────────────────────
  useEffect(() => {
    async function load() {
      try {
        const tableData = await publicApi.getTable(tableId)
        setTable(tableData)
        const menuData  = await publicApi.getMenu(tableId)
        setMenu(menuData)
      } catch (err) {
        setError(err.message || 'Failed to load menu')
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [tableId])

  // ── Cart operations ───────────────────────────────────────────────────────
  const addItem    = (item) => setCart(prev => {
    const ex = prev.find(c => c.id === item.id)
    if (ex) return prev.map(c => c.id === item.id ? { ...c, quantity: c.quantity + 1 } : c)
    return [...prev, { id: item.id, name: item.name, price: item.price, quantity: 1 }]
  })
  const removeItem = (itemId) => setCart(prev => {
    const ex = prev.find(c => c.id === itemId)
    if (!ex) return prev
    if (ex.quantity === 1) return prev.filter(c => c.id !== itemId)
    return prev.map(c => c.id === itemId ? { ...c, quantity: c.quantity - 1 } : c)
  })
  const clearItem  = (itemId) => setCart(prev => prev.filter(c => c.id !== itemId))
  const getQty     = (itemId) => cart.find(c => c.id === itemId)?.quantity || 0

  // ── Submit order ──────────────────────────────────────────────────────────
  const handleSubmit = async () => {
    if (!cart.length) return
    setSubmitting(true)
    try {
      const result = await publicApi.createOrder({
        tableId,
        notes:         notes.trim(),
        items:         cart.map(c => ({ menuItemId: c.id, quantity: c.quantity })),
        paymentMethod: payMethod,
      })
      setConfirmation({ orderId: result.id, payMethod, total, currency: table?.currency || 'LAK' })
      setCart([])
      setNotes('')
      setCartOpen(false)
    } catch (err) {
      alert(err.message || 'Could not place order. Please ask a staff member.')
    } finally {
      setSubmitting(false)
    }
  }

  // ── Cancel order ──────────────────────────────────────────────────────────
  const handleCancelOrder = async () => {
    setCancelling(true)
    try {
      await publicApi.cancelOrder(confirmation.orderId, tableId)
      const orderId = confirmation.orderId
      setConfirmation(null)
      setCancelConfirm(false)
      setCancelled({ orderId })
    } catch (err) {
      setCancelConfirm(false)
      alert(err.message || 'Could not cancel. Please ask a staff member.')
    } finally {
      setCancelling(false)
    }
  }

  // ── Group menu by category ────────────────────────────────────────────────
  const grouped = menu.reduce((acc, item) => {
    if (!acc[item.category]) acc[item.category] = []
    acc[item.category].push(item)
    return acc
  }, {})

  const categories = ['All', ...CAT_ORDER.filter(c => grouped[c])]
  const visibleItems = activeCategory === 'All' ? menu : (grouped[activeCategory] || [])
  const { total } = cartTotal(cart)
  const cartCount = cart.reduce((s, i) => s + i.quantity, 0)

  // ── Language toggle button (shared across all screens) ────────────────────
  const LangBtn = () => (
    <button
      onClick={toggleLang}
      className="flex-shrink-0 px-2.5 py-1 rounded-full text-xs font-bold border border-gray-200 bg-white text-gray-600 hover:bg-gray-50 transition-colors shadow-sm"
      title="Switch language / ປ່ຽນພາສາ"
    >
      {lang === 'en' ? 'ລາວ' : 'EN'}
    </button>
  )

  // ── Loading ───────────────────────────────────────────────────────────────
  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="text-center">
        <div className="w-10 h-10 border-2 border-teal-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
        <p className="text-gray-400 text-sm">{t('loading')}</p>
      </div>
    </div>
  )

  // ── Error ─────────────────────────────────────────────────────────────────
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

  // ── Cancelled screen ──────────────────────────────────────────────────────
  if (cancelled) return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-6">
      <div className="text-center max-w-xs">
        <div className="flex justify-end mb-2 max-w-xs mx-auto"><LangBtn /></div>
        <div className="w-20 h-20 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-5 shadow-inner">
          <XCircle size={34} className="text-red-400" />
        </div>
        <h1 className="text-2xl font-bold text-gray-900 mb-2">{t('cancelled_title')}</h1>
        <p className="text-sm text-gray-500 mb-1">
          {t('cancelled_msg', <span className="font-semibold text-gray-700">{cancelled.orderId}</span>)}
        </p>
        <p className="text-xs text-gray-400 mb-6">{t('no_charges')}</p>
        <button
          onClick={() => setCancelled(null)}
          className="px-6 py-2.5 bg-teal-600 text-white text-sm font-semibold rounded-xl hover:bg-teal-700 transition-colors shadow-sm"
        >
          {t('order_again')}
        </button>
      </div>
    </div>
  )

  // ── Confirmation screen ───────────────────────────────────────────────────
  if (confirmation) {
    const isQr = confirmation.payMethod === 'qr'
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-6">
        <div className="text-center max-w-xs w-full">
          <div className="flex justify-end mb-3"><LangBtn /></div>

          {/* Icon */}
          <div className={`w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-5 shadow-inner ${isQr ? 'bg-violet-50' : 'bg-teal-50'}`}>
            {isQr
              ? <QrCode size={34} className="text-violet-600" />
              : <ChefHat size={34} className="text-teal-600" />
            }
          </div>

          <h1 className="text-2xl font-bold text-gray-900 mb-2">{t('order_placed')}</h1>
          <p className="text-sm text-gray-500 mb-1">
            <span className={`font-semibold ${isQr ? 'text-violet-600' : 'text-teal-600'}`}>
              {confirmation.orderId}
            </span>{' '}
            {t('preparing')}
          </p>

          {/* Payment instruction card */}
          <div className={`mt-4 mb-6 rounded-2xl border overflow-hidden ${isQr ? 'bg-violet-50 border-violet-100' : 'bg-teal-50 border-teal-100'}`}>
            {isQr ? (
              <>
                {table?.qrImageBase64 ? (
                  /* Restaurant has uploaded a QR image — show it directly */
                  <div className="flex flex-col items-center px-4 pt-5 pb-4 gap-3">
                    <p className="text-sm font-semibold text-violet-700">{t('scan_to_pay')}</p>
                    <div className="bg-white rounded-xl p-3 shadow-sm border border-violet-100">
                      <img
                        src={table.qrImageBase64}
                        alt="QR Payment"
                        className="w-52 h-52 object-contain"
                      />
                    </div>
                    <p className="text-xs text-violet-600 text-center leading-relaxed">
                      {t('scan_instruction')}
                    </p>
                    <p className="text-sm font-bold text-violet-700">
                      {confirmation.total?.toLocaleString()} {confirmation.currency}
                    </p>
                  </div>
                ) : (
                  /* Fallback: no QR image uploaded yet */
                  <div className="px-4 py-4">
                    <p className="text-sm font-semibold mb-1 text-violet-700">{t('qr_selected')}</p>
                    <p className="text-xs text-violet-600 leading-relaxed">{t('cashier_notified')}</p>
                    <p className="text-xs text-violet-500 mt-2 font-semibold">
                      {t('amount')}: {confirmation.total?.toLocaleString()} {confirmation.currency}
                    </p>
                  </div>
                )}
              </>
            ) : (
              <div className="px-4 py-4">
                <p className="text-sm font-semibold mb-1 text-teal-700">{t('cash_payment')}</p>
                <p className="text-xs text-teal-600 leading-relaxed">{t('cash_instruction')}</p>
              </div>
            )}
          </div>

          <button
            onClick={() => { setConfirmation(null); setCancelConfirm(false) }}
            className={`text-sm underline underline-offset-2 ${isQr ? 'text-violet-600 hover:text-violet-700' : 'text-teal-600 hover:text-teal-700'}`}
          >
            {t('order_more')}
          </button>

          {/* Cancel order */}
          {!cancelConfirm ? (
            <div className="mt-5">
              <button
                onClick={() => setCancelConfirm(true)}
                className="text-xs text-gray-400 hover:text-red-500 transition-colors underline underline-offset-2"
              >
                {t('cancel_link')}
              </button>
            </div>
          ) : (
            <div className="mt-5 bg-red-50 border border-red-100 rounded-2xl p-4 text-left">
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
      </div>
    )
  }

  // ── Main menu page ────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-gray-50">

      {/* ── Header ────────────────────────────────────────────────────── */}
      <header className="sticky top-0 z-20 bg-white border-b border-gray-100 shadow-sm">
        <div className="px-4 py-3 flex items-center justify-between max-w-xl mx-auto">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 bg-teal-600 rounded-lg flex items-center justify-center flex-shrink-0">
              <UtensilsCrossed size={14} className="text-white" />
            </div>
            <div>
              <p className="text-xs text-gray-400 leading-none truncate max-w-[140px]">
                {table?.restaurantName}
              </p>
              <h1 className="text-sm font-bold text-gray-900 leading-tight">
                {t('table', table?.number)}
              </h1>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {/* Language toggle */}
            <LangBtn />
            {/* Cart button */}
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

        {/* ── Category tab bar ────────────────────────────────────────── */}
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

      {/* ── Menu items ───────────────────────────────────────────────── */}
      <main className="px-4 py-4 pb-32 max-w-xl mx-auto">
        {activeCategory === 'All' ? (
          CAT_ORDER.filter(c => grouped[c]).map(category => (
            <section key={category} className="mb-6">
              <div className="flex items-center gap-2 mb-3">
                <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold ${CAT_COLOUR[category] || 'bg-gray-100 text-gray-600'}`}>
                  {catLabel(category)}
                </span>
              </div>
              <MenuItemList items={grouped[category]} getQty={getQty} addItem={addItem} removeItem={removeItem} lang={lang} />
            </section>
          ))
        ) : (
          <MenuItemList items={visibleItems} getQty={getQty} addItem={addItem} removeItem={removeItem} lang={lang} />
        )}

        {visibleItems.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16 text-gray-400">
            <UtensilsCrossed size={32} className="mb-2 opacity-30" />
            <p className="text-sm">{t('no_items')}</p>
          </div>
        )}
      </main>

      {/* ── Sticky bottom bar ───────────────────────────────────────── */}
      {cartCount > 0 && !cartOpen && (
        <div className="fixed bottom-0 left-0 right-0 z-10 p-4 max-w-xl mx-auto">
          <button
            onClick={() => setCartOpen(true)}
            className="w-full bg-teal-600 text-white font-semibold py-3.5 rounded-xl flex items-center justify-between px-5 shadow-lg"
          >
            <span className="bg-teal-500 text-white text-xs font-bold px-2 py-0.5 rounded-full">
              {cartCount}
            </span>
            <span>{t('view_order')}</span>
            <span>{total.toLocaleString()} {table?.currency || 'LAK'}</span>
          </button>
        </div>
      )}

      {/* ── Cart slide-over ──────────────────────────────────────────── */}
      {cartOpen && (
        <>
          <div
            className="fixed inset-0 bg-black/30 z-30"
            onClick={() => setCartOpen(false)}
          />
          <div className="fixed bottom-0 left-0 right-0 z-40 bg-white rounded-t-2xl shadow-xl max-w-xl mx-auto max-h-[90vh] flex flex-col">

            {/* Cart header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 flex-shrink-0">
              <h2 className="font-bold text-gray-900">{t('your_order')}</h2>
              <button
                onClick={() => setCartOpen(false)}
                className="p-1 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100"
              >
                <X size={18} />
              </button>
            </div>

            {/* Cart items */}
            <div className="flex-1 overflow-y-auto px-5 py-3 space-y-3 min-h-0">
              {cart.map(item => (
                <div key={item.id} className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2 flex-1 min-w-0">
                    <button
                      onClick={() => clearItem(item.id)}
                      className="text-gray-300 hover:text-red-400 flex-shrink-0 transition-colors"
                    >
                      <X size={14} />
                    </button>
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">{item.name}</p>
                      <p className="text-xs text-gray-400">{item.price.toLocaleString()} each</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <button
                      onClick={() => removeItem(item.id)}
                      className="w-6 h-6 rounded-full bg-gray-100 flex items-center justify-center hover:bg-gray-200 transition-colors"
                    >
                      <Minus size={10} />
                    </button>
                    <span className="w-5 text-center text-sm font-semibold">{item.quantity}</span>
                    <button
                      onClick={() => addItem(item)}
                      className="w-6 h-6 rounded-full bg-teal-100 text-teal-600 flex items-center justify-center hover:bg-teal-200 transition-colors"
                    >
                      <Plus size={10} />
                    </button>
                  </div>
                  <span className="text-sm font-semibold text-gray-900 w-20 text-right flex-shrink-0">
                    {(item.price * item.quantity).toLocaleString()}
                  </span>
                </div>
              ))}

              {/* Notes */}
              <div className="pt-2">
                <label className="text-xs font-medium text-gray-500 mb-1 block">
                  {t('special_req')}
                </label>
                <textarea
                  value={notes}
                  onChange={e => setNotes(e.target.value)}
                  placeholder={t('special_req_ph')}
                  rows={2}
                  className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2 resize-none focus:outline-none focus:ring-2 focus:ring-teal-500 placeholder:text-gray-300"
                />
              </div>
            </div>

            {/* Total (no tax) */}
            <div className="px-5 py-3 border-t border-gray-100 flex-shrink-0">
              <div className="flex justify-between text-base font-bold text-gray-900">
                <span>{t('total')}</span>
                <span>{total.toLocaleString()} {table?.currency || 'LAK'}</span>
              </div>
            </div>

            {/* Payment method selection */}
            <div className="px-5 pt-3 pb-2 flex-shrink-0 border-t border-gray-100">
              <p className="text-xs font-semibold text-gray-500 mb-2">{t('pay_how')}</p>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setPayMethod('cash')}
                  className={`flex items-center justify-center gap-2 py-2.5 rounded-xl border-2 text-sm font-semibold transition-all ${
                    payMethod === 'cash'
                      ? 'border-teal-500 bg-teal-50 text-teal-700'
                      : 'border-gray-200 bg-white text-gray-500 hover:border-gray-300'
                  }`}
                >
                  <Banknote size={16} />
                  {t('cash')}
                </button>
                <button
                  type="button"
                  onClick={() => setPayMethod('qr')}
                  className={`flex items-center justify-center gap-2 py-2.5 rounded-xl border-2 text-sm font-semibold transition-all ${
                    payMethod === 'qr'
                      ? 'border-violet-500 bg-violet-50 text-violet-700'
                      : 'border-gray-200 bg-white text-gray-500 hover:border-gray-300'
                  }`}
                >
                  <QrCode size={16} />
                  {t('qr_payment')}
                </button>
              </div>

              {/* QR image — shown immediately when customer picks QR payment */}
              {payMethod === 'qr' && table?.qrImageBase64 && (
                <div className="mt-3 flex flex-col items-center gap-2 bg-violet-50 border border-violet-100 rounded-2xl px-4 py-4">
                  <p className="text-xs font-semibold text-violet-700">{t('scan_to_pay')}</p>
                  <div className="bg-white rounded-xl p-2 shadow-sm border border-violet-100">
                    <img
                      src={table.qrImageBase64}
                      alt="QR Payment"
                      className="w-44 h-44 object-contain"
                    />
                  </div>
                  <p className="text-xs text-violet-600 text-center leading-relaxed">
                    {t('scan_instruction')}
                  </p>
                  <p className="text-sm font-bold text-violet-700">
                    {total.toLocaleString()} {table?.currency || 'LAK'}
                  </p>
                </div>
              )}
            </div>

            {/* Place order button */}
            <div className="px-5 pb-8 pt-2 flex-shrink-0">
              <button
                onClick={handleSubmit}
                disabled={submitting || !cart.length}
                className={`w-full text-white font-semibold py-3.5 rounded-xl disabled:opacity-50 transition-colors ${
                  payMethod === 'qr'
                    ? 'bg-violet-600 hover:bg-violet-700'
                    : 'bg-teal-600 hover:bg-teal-700'
                }`}
              >
                {submitting ? t('placing') : t('place_order', total, table?.currency || 'LAK')}
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  )
}

// ── Reusable menu item list ──────────────────────────────────────────────────
function MenuItemList({ items, getQty, addItem, removeItem }) {
  return (
    <div className="space-y-3">
      {items.map(item => {
        const qty = getQty(item.id)
        return (
          <div
            key={item.id}
            className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden flex"
          >
            {/* Image */}
            {item.imageUrl && (
              <div className="w-24 flex-shrink-0 bg-gray-100">
                <img
                  src={item.imageUrl}
                  alt={item.name}
                  className="w-full h-full object-cover"
                  style={{ minHeight: '80px' }}
                />
              </div>
            )}

            {/* Details */}
            <div className="flex flex-1 items-start justify-between gap-3 p-3 min-w-0">
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-gray-900 text-sm">{item.name}</p>
                {item.description && (
                  <p className="text-xs text-gray-400 mt-0.5 line-clamp-2">{item.description}</p>
                )}
                {item.prepTime > 0 && (
                  <p className="text-[11px] text-gray-300 mt-0.5">~{item.prepTime} min</p>
                )}
                <p className="text-sm font-bold text-teal-600 mt-1.5">
                  {item.price.toLocaleString()}
                </p>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0 pt-0.5">
                {qty > 0 && (
                  <>
                    <button
                      onClick={() => removeItem(item.id)}
                      className="w-7 h-7 rounded-full bg-teal-50 text-teal-600 flex items-center justify-center hover:bg-teal-100 transition-colors"
                    >
                      <Minus size={12} />
                    </button>
                    <span className="w-4 text-center text-sm font-bold text-gray-900">{qty}</span>
                  </>
                )}
                <button
                  onClick={() => addItem(item)}
                  className="w-7 h-7 rounded-full bg-teal-600 text-white flex items-center justify-center hover:bg-teal-700 transition-colors shadow-sm"
                >
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
