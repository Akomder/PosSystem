import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { useParams } from 'react-router-dom'
import {
  ShoppingCart, Plus, Minus, X, UtensilsCrossed,
  XCircle, CheckCircle2, Receipt, Bell, ChevronLeft, ImageOff,
  Search, Star, Tag, PhoneCall, Home,
} from 'lucide-react'
import { io } from 'socket.io-client'
import { publicApi } from '../services/api'

// ── Translations ──────────────────────────────────────────────────────────────
const TR = {
  en: {
    loading:              'Loading…',
    err_title:            'Something went wrong',
    table:                n  => `Table ${n}`,
    view_order:           n  => n ? `View Order (${n})` : 'View Order',
    your_order:           'Your Order',
    special_req:          'Special requests / allergies (optional)',
    special_req_ph:       'e.g. No onions, extra spicy…',
    total:                'Total',
    place_order:          (total, cur) => `Place Order · ${total.toLocaleString()} ${cur}`,
    add_to_order:         (total, cur) => `Add to Order · ${total.toLocaleString()} ${cur}`,
    placing:              'Placing…',
    adding:               'Adding…',
    payment_method:       'Payment',
    pay_cash:             'Cash',
    pay_qr:               'QR Pay',
    my_order:             'My Order',
    order_id:             'Order',
    status_pending:       'Pending',
    status_progress:      'In Progress',
    status_served:        'Served',
    status_closed:        'Paid & Closed',
    status_cancelled:     'Cancelled',
    status_msg_pending:   'Your order has been received. The kitchen will start soon.',
    status_msg_progress:  'The kitchen is preparing your order!',
    status_msg_served:    'Your order is ready! A staff member will collect payment.',
    items_ordered:        'Items Ordered',
    order_more:           'Order More',
    request_checkout:     'Request Checkout',
    requesting:           'Requesting…',
    checkout_sent:        'Staff notified',
    notify_again_hint:    'Button re-enables in 3 min',
    scan_to_pay:          'Scan to Pay',
    scan_qr_desc:         'Scan the QR code above to complete your payment.',
    served_alert:         'Your food is ready!',
    served_alert_sub:     'A staff member will bring it to your table.',
    order_summary:        'Order Summary',
    order_complete_title: 'Thank You!',
    order_complete_msg:   'Your order has been completed. Enjoy your meal!',
    order_again:          'Order something else',
    cancel_link:          'Cancel this order',
    return_items:         'Return Items',
    return_title:         'Return Items',
    return_desc:          'Select how many of each item you want to return.',
    return_reason_ph:     'Reason (e.g. changed our minds)',
    return_submit:        'Submit Return Request',
    return_submitting:    'Submitting…',
    return_sent:          'Request sent!',
    return_sent_desc:     'Staff will review and adjust your order.',
    cancelled_title:      'Order Cancelled',
    cancelled_msg:        id => `Order ${id} has been cancelled.`,
    no_charges:           'No charges will be made.',
    cancel_q:             'Cancel your order?',
    cancel_desc:          "This only works while the kitchen hasn't started yet.",
    keep_it:              'Keep it',
    yes_cancel:           'Yes, cancel',
    cancelling:           'Cancelling…',
    no_items:             'No items in this category',
    item_note_ph:         'Note (e.g. no onions)',
    // Home
    home_order_now:       'Order Now',
    home_call_staff:      'Call Staff',
    home_my_order:        'My Order',
    home_rating:          'Rate',
    home_promotions:      'Promotions',
    home_guest_name:      'Your name (optional)',
    home_guest_phone:     'Phone (optional)',
    home_guest_hint:      'Help us serve you better',
    // Call staff
    call_staff_sent:      'Staff called!',
    call_staff_cooldown:  'Re-enables in 2 min',
    calling:              'Calling…',
    // Menu search
    search_ph:            'Search menu…',
    no_search_results:    'No items match your search',
    // Out of stock
    out_of_stock:         'Out of stock',
    // Rating
    rating_title:         'Rate your experience',
    rating_submit:        'Submit Rating',
    rating_thanks:        'Thank you for your feedback!',
    rating_comment_ph:    'Tell us more (optional)…',
    rating_select_star:   'Tap a star to rate',
    submitting_rating:    'Submitting…',
    // Promotions
    promo_title:          'Promotions',
    promo_empty:          'No current promotions',
    loading_promos:       'Loading…',
    back:                 '← Back',
  },
  lo: {
    loading:              'ກຳລັງໂຫຼດ…',
    err_title:            'ມີຂໍ້ຜິດພາດ',
    table:                n  => `ໂຕ໊ະ ${n}`,
    view_order:           n  => n ? `ເບິ່ງລາຍການ (${n})` : 'ເບິ່ງລາຍການ',
    your_order:           'ລາຍການຂອງທ່ານ',
    special_req:          'ຄຳຮ້ອງພິເສດ (ທາງເລືອກ)',
    special_req_ph:       'ເຊັ່ນ: ບໍ່ໃສ່ຜັກບົ່ວ…',
    total:                'ລວມ',
    place_order:          (total, cur) => `ສັ່ງ · ${total.toLocaleString()} ${cur}`,
    add_to_order:         (total, cur) => `ເພີ່ມ · ${total.toLocaleString()} ${cur}`,
    placing:              'ກຳລັງສັ່ງ…',
    adding:               'ກຳລັງເພີ່ມ…',
    payment_method:       'ວິທີຊຳລະ',
    pay_cash:             'ເງິນສົດ',
    pay_qr:               'ຈ່າຍ QR',
    my_order:             'ການສັ່ງຂອງຂ້ອຍ',
    order_id:             'ການສັ່ງ',
    status_pending:       'ລໍຖ້າ',
    status_progress:      'ກຳລັງກຽມ',
    status_served:        'ພ້ອມແລ້ວ',
    status_closed:        'ຊຳລະແລ້ວ',
    status_cancelled:     'ຍົກເລີກ',
    status_msg_pending:   'ໄດ້ຮັບການສັ່ງ. ຄົວຈະເລີ່ມໃນໄວໆນີ້.',
    status_msg_progress:  'ຄົວກຳລັງກຽມ!',
    status_msg_served:    'ອາຫານພ້ອມແລ້ວ! ພະນັກງານຈະມາຮັບເງິນ.',
    items_ordered:        'ລາຍການທີ່ສັ່ງ',
    order_more:           'ສັ່ງເພີ່ມ',
    request_checkout:     'ຂໍໃບບິນ',
    requesting:           'ກຳລັງສົ່ງ…',
    checkout_sent:        'ແຈ້ງພະນັກງານແລ້ວ',
    notify_again_hint:    'ຈະເປີດໃໝ່ໃນ 3 ນາທີ',
    scan_to_pay:          'ສະແກນເພື່ອຊຳລະ',
    scan_qr_desc:         'ສະແກນ QR ດ້ານເທິງເພື່ອຊຳລະເງິນ.',
    served_alert:         'ອາຫານພ້ອມແລ້ວ!',
    served_alert_sub:     'ພະນັກງານຈະນຳມາໃຫ້ທ່ານ.',
    order_summary:        'ສະຫຼຸບການສັ່ງ',
    order_complete_title: 'ຂໍຂອບໃຈ!',
    order_complete_msg:   'ການສັ່ງສຳເລັດ. ຊົງລົດຊາດ!',
    order_again:          'ສັ່ງໃໝ່',
    cancel_link:          'ຍົກເລີກ',
    return_items:         'ສົ່ງຄືນ',
    return_title:         'ສົ່ງຄືນລາຍການ',
    return_desc:          'ເລືອກຈຳນວນທີ່ຕ້ອງການສົ່ງຄືນ.',
    return_reason_ph:     'ເຫດຜົນ (ເຊັ່ນ: ປ່ຽນໃຈ)',
    return_submit:        'ສົ່ງຄຳຂໍ',
    return_submitting:    'ກຳລັງສົ່ງ…',
    return_sent:          'ສົ່ງແລ້ວ!',
    return_sent_desc:     'ພະນັກງານຈະກວດສອບ.',
    cancelled_title:      'ຍົກເລີກແລ້ວ',
    cancelled_msg:        id => `ການສັ່ງ ${id} ຖືກຍົກເລີກ.`,
    no_charges:           'ບໍ່ມີຄ່າໃຊ້ຈ່າຍ',
    cancel_q:             'ຍົກເລີກ?',
    cancel_desc:          'ກ່ອນຄົວເລີ່ມກຽມ.',
    keep_it:              'ຮັກສາ',
    yes_cancel:           'ຍົກເລີກ',
    cancelling:           'ກຳລັງຍົກເລີກ…',
    no_items:             'ບໍ່ມີລາຍການ',
    item_note_ph:         'ໝາຍເຫດ (ເຊັ່ນ ບໍ່ໃສ່ຜັກບົ່ວ)',
    // Home
    home_order_now:       'ສັ່ງດຽວນີ້',
    home_call_staff:      'ເອີ້ນພະນັກງານ',
    home_my_order:        'ການສັ່ງຂອງຂ້ອຍ',
    home_rating:          'ໃຫ້ຄະແນນ',
    home_promotions:      'ໂປຣໂມຊັ່ນ',
    home_guest_name:      'ຊື່ຂອງທ່ານ (ທາງເລືອກ)',
    home_guest_phone:     'ໂທລະສັບ (ທາງເລືອກ)',
    home_guest_hint:      'ຊ່ວຍໃຫ້ເຮົາໃຫ້ບໍລິການທ່ານດີຂຶ້ນ',
    // Call staff
    call_staff_sent:      'ແຈ້ງພະນັກງານແລ້ວ!',
    call_staff_cooldown:  'ຈະເປີດໃໝ່ໃນ 2 ນາທີ',
    calling:              'ກຳລັງໂທ…',
    // Menu search
    search_ph:            'ຄົ້ນຫາເມນູ…',
    no_search_results:    'ບໍ່ພົບລາຍການທີ່ກົງ',
    // Out of stock
    out_of_stock:         'ໝົດສາງ',
    // Rating
    rating_title:         'ໃຫ້ຄະແນນການບໍລິການ',
    rating_submit:        'ສົ່ງຄະແນນ',
    rating_thanks:        'ຂອບໃຈສໍາລັບຄໍາຄິດ!',
    rating_comment_ph:    'ບອກເພີ່ມ (ທາງເລືອກ)…',
    rating_select_star:   'ແຕະດາວ',
    submitting_rating:    'ກຳລັງສົ່ງ…',
    // Promotions
    promo_title:          'ໂປຣໂມຊັ່ນ',
    promo_empty:          'ບໍ່ມີໂປຣໂມຊັ່ນໃນຂະນະນີ້',
    loading_promos:       'ກຳລັງໂຫຼດ…',
    back:                 '← ກັບ',
  },
}

const CAT_COLOUR = {
  Starters: 'bg-amber-100 text-amber-700',
  Mains:    'bg-teal-100  text-teal-700',
  Drinks:   'bg-blue-100  text-blue-700',
  Desserts: 'bg-pink-100  text-pink-700',
}

const STATUS_STEPS       = ['Pending', 'In Progress', 'Served']
const CHECKOUT_COOLDOWN  = 3 * 60 * 1000
const CALLSTAFF_COOLDOWN = 2 * 60 * 1000
const SERVED_ALERT_TTL   = 6000
const API_BASE           = import.meta.env.VITE_API_URL || ''
const GUEST_KEY          = 'qr_guest_v1'

function triggerServedBeep() {
  try {
    const ctx  = new (window.AudioContext || window.webkitAudioContext)()
    const osc  = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.connect(gain)
    gain.connect(ctx.destination)
    osc.frequency.setValueAtTime(880, ctx.currentTime)
    osc.frequency.setValueAtTime(660, ctx.currentTime + 0.15)
    gain.gain.setValueAtTime(0.4, ctx.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.45)
    osc.start()
    osc.stop(ctx.currentTime + 0.45)
  } catch {}
}

// ── Menu text auto-translation ────────────────────────────────────────────────
// Cache structure: { [targetLang]: { [originalText]: translatedText } }
// Bumped to v3 — keyed by language so switching EN→LO→ZH all work independently.
const TRANS_CACHE_KEY = 'qr_menu_trans_v3'
const MENU_NATIVE_LANG = 'lo'   // language menu items are stored in

const readAllCache  = () => { try { return JSON.parse(localStorage.getItem(TRANS_CACHE_KEY) || '{}') } catch { return {} } }
const readTransCache = lang => readAllCache()[lang] || {}
const writeTransCache = (lang, entries) => {
  try {
    const all = readAllCache()
    localStorage.setItem(TRANS_CACHE_KEY, JSON.stringify({ ...all, [lang]: { ...(all[lang] || {}), ...entries } }))
  } catch {}
}

// Translate an array of texts to targetLang via Google Translate (unofficial API).
// Fires all requests in parallel; auto-detects source language (sl=auto).
async function translateBatch(texts, targetLang) {
  const result = {}
  if (!texts.length) return result

  await Promise.all(texts.map(async text => {
    try {
      const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=${encodeURIComponent(targetLang)}&dt=t&q=${encodeURIComponent(text)}`
      const res  = await fetch(url)
      const data = await res.json()
      // data[0] = array of sentence fragments [[translated, original], ...]
      const translated = data[0]?.map(s => s[0]).join('').trim()
      result[text] = translated || text
    } catch {
      result[text] = text
    }
  }))

  return result
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function CustomerOrder() {
  const { tableId } = useParams()

  // Swap favicon to restaurant icon for QR page, restore on unmount
  useEffect(() => {
    const link = document.querySelector("link[rel~='icon']")
    const prev = link?.href || ''
    if (link) link.href = '/pos-logo.png'
    return () => { if (link) link.href = prev }
  }, [])

  const [table,   setTable]   = useState(null)
  const [menu,    setMenu]    = useState([])
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState(null)

  // view: 'home' | 'menu' | 'tracking' | 'complete' | 'cancelled' | 'rating' | 'promotions'
  const [view,         setView]         = useState('home')
  const [activeOrder,  setActiveOrder]  = useState(null)
  const [orderingMore, setOrderingMore] = useState(false)

  // tracking actions
  const [cancelConfirm,  setCancelConfirm]  = useState(false)
  const [cancelling,     setCancelling]     = useState(false)
  const [checkoutSentAt, setCheckoutSentAt] = useState(null)
  const [requesting,     setRequesting]     = useState(false)
  const [servedAlerted,  setServedAlerted]  = useState(false)

  // call staff
  const [callStaffSentAt, setCallStaffSentAt] = useState(null)
  const [callingStaff,    setCallingStaff]    = useState(false)

  // return request
  const [returnOpen,   setReturnOpen]   = useState(false)
  const [returnQtys,   setReturnQtys]   = useState({})
  const [returnReason, setReturnReason] = useState('')
  const [returnState,  setReturnState]  = useState('idle')
  const [returnError,  setReturnError]  = useState('')

  // cart
  const [cart,          setCart]          = useState([])
  const [notes,         setNotes]         = useState('')
  const [paymentMethod, setPaymentMethod] = useState('cash')
  const [activeCategory,setActiveCategory]= useState('All')
  const [cartOpen,      setCartOpen]      = useState(false)
  const [submitting,    setSubmitting]    = useState(false)

  // menu search
  const [menuSearch, setMenuSearch] = useState('')

  // guest info (persisted to localStorage)
  const [guestName,  setGuestName]  = useState(() => { try { return JSON.parse(localStorage.getItem(GUEST_KEY) || '{}').name  || '' } catch { return '' } })
  const [guestPhone, setGuestPhone] = useState(() => { try { return JSON.parse(localStorage.getItem(GUEST_KEY) || '{}').phone || '' } catch { return '' } })

  const saveGuest = () => {
    try { localStorage.setItem(GUEST_KEY, JSON.stringify({ name: guestName.trim(), phone: guestPhone.trim() })) } catch {}
  }

  // rating
  const [ratingValue,   setRatingValue]   = useState(0)
  const [ratingComment, setRatingComment] = useState('')
  const [ratingState,   setRatingState]   = useState('idle') // 'idle'|'submitting'|'sent'|'error'

  // promotions
  const [promos,       setPromos]       = useState([])
  const [promosLoaded, setPromosLoaded] = useState(false)

  // deals banner
  const [deals, setDeals] = useState([])

  // lang + auto-translation
  const [lang,         setLang]         = useState(() => {
    try { return localStorage.getItem('qr_lang') || 'lo' } catch { return 'lo' }
  })
  // translations holds { originalText: translatedText } for the current lang
  const [translations, setTranslations] = useState(() => readTransCache(
    (() => { try { return localStorage.getItem('qr_lang') || 'lo' } catch { return 'lo' } })()
  ))
  const [translating,  setTranslating]  = useState(false)

  const t = (key, ...args) => {
    const v = TR[lang]?.[key] ?? TR.en[key]
    return typeof v === 'function' ? v(...args) : (v ?? key)
  }
  // tr: return translated text for current lang, or original if no translation yet
  const tr       = text => (lang === MENU_NATIVE_LANG || !text) ? text : (translations[text] || text)
  const catLabel = c    => tr(c)
  const toggleLang = () => {
    const next = lang === 'en' ? 'lo' : 'en'
    setLang(next)
    try { localStorage.setItem('qr_lang', next) } catch {}
  }

  const pollRef        = useRef(null)
  const activeOrderRef = useRef(null)
  const prevStatusRef  = useRef(null)
  const scrollLock     = useRef(false)
  const tabBarRef      = useRef(null)
  const tabBtnRefs     = useRef({})

  const stopPoll = useCallback(() => {
    if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null }
  }, [])

  useEffect(() => { activeOrderRef.current = activeOrder }, [activeOrder])

  // ── Detect "Served" status transition ─────────────────────────────────────
  useEffect(() => {
    if (!activeOrder?.status) { prevStatusRef.current = null; return }
    if (activeOrder.status === 'Served' && prevStatusRef.current && prevStatusRef.current !== 'Served') {
      setServedAlerted(true)
      triggerServedBeep()
    }
    prevStatusRef.current = activeOrder.status
  }, [activeOrder?.status])

  useEffect(() => {
    if (!servedAlerted) return
    const timer = setTimeout(() => setServedAlerted(false), SERVED_ALERT_TTL)
    return () => clearTimeout(timer)
  }, [servedAlerted])

  useEffect(() => {
    if (!checkoutSentAt) return
    const timer = setTimeout(() => setCheckoutSentAt(null), CHECKOUT_COOLDOWN)
    return () => clearTimeout(timer)
  }, [checkoutSentAt])

  useEffect(() => {
    if (!callStaffSentAt) return
    const timer = setTimeout(() => setCallStaffSentAt(null), CALLSTAFF_COOLDOWN)
    return () => clearTimeout(timer)
  }, [callStaffSentAt])

  // ── Load order by rawId ────────────────────────────────────────────────────
  const loadOrder = useCallback(async (rawId) => {
    try {
      const order = await publicApi.getOrder(rawId, tableId)
      setActiveOrder(order)
      if (order.status === 'Closed')    { setView('complete');  stopPoll(); return }
      if (order.status === 'Cancelled') { setView('cancelled'); stopPoll(); return }
      setView('tracking')
    } catch {
      setView('home'); setActiveOrder(null); stopPoll()
    }
  }, [tableId, stopPoll])

  // ── Initial load ───────────────────────────────────────────────────────────
  useEffect(() => {
    async function load() {
      try {
        const [tableData, menuData, dealsData] = await Promise.all([
          publicApi.getTable(tableId),
          publicApi.getMenu(tableId),
          publicApi.getDeals(tableId).catch(() => []),
        ])
        setTable(tableData)
        setMenu(menuData)
        setDeals(Array.isArray(dealsData) ? dealsData : [])
        if (tableData.currentOrderId) {
          await loadOrder(tableData.currentOrderId)
        } else {
          setView('home')
        }
      } catch (err) {
        setError(err.message || 'Failed to load')
      } finally {
        setLoading(false)
      }
    }
    load()
    return () => stopPoll()
  }, [tableId, loadOrder, stopPoll])

  // ── Poll every 12s as fallback ─────────────────────────────────────────────
  useEffect(() => {
    if (view !== 'tracking' || !activeOrder) return
    stopPoll()
    pollRef.current = setInterval(() => loadOrder(activeOrder.rawId), 12000)
    return () => stopPoll()
  }, [view, activeOrder?.rawId, loadOrder, stopPoll])

  // ── Real-time socket push from server ──────────────────────────────────────
  useEffect(() => {
    const sock = io(API_BASE, { transports: ['websocket', 'polling'] })
    sock.on('connect', () => sock.emit('join:table', { tableId }))
    sock.on('order:customer_update', ({ order }) => {
      const curr = activeOrderRef.current
      if (!curr || order.rawId !== curr.rawId) return
      setActiveOrder(order)
      if (order.status === 'Closed')    { setView('complete');  stopPoll() }
      if (order.status === 'Cancelled') { setView('cancelled'); stopPoll() }
    })
    return () => sock.disconnect()
  }, [tableId, stopPoll])

  // ── Auto-translate menu texts whenever lang or menu changes ─────────────────
  useEffect(() => {
    // No translation needed when viewing in the native menu language
    if (lang === MENU_NATIVE_LANG || !menu.length) {
      setTranslations({})
      return
    }

    const allTexts = [...new Set([
      ...menu.map(i => i.name),
      ...menu.map(m => m.category).filter(Boolean),
      ...menu.map(i => i.description).filter(Boolean),
    ])]

    const cached  = readTransCache(lang)
    const missing = allTexts.filter(tx => tx && !cached[tx])

    // All already cached — apply immediately with no spinner
    if (!missing.length) { setTranslations({ ...cached }); return }

    setTranslating(true)
    translateBatch(missing, lang)
      .then(result => {
        writeTransCache(lang, result)
        setTranslations({ ...cached, ...result })
      })
      .catch(() => {})
      .finally(() => setTranslating(false))
  }, [lang, menu])

  // ── Load promotions when view switches to 'promotions' ────────────────────
  useEffect(() => {
    if (view !== 'promotions' || promosLoaded) return
    publicApi.getPromotions(tableId)
      .then(data => { setPromos(data); setPromosLoaded(true) })
      .catch(() => setPromosLoaded(true))
  }, [view, tableId, promosLoaded])

  // ── Cart helpers ───────────────────────────────────────────────────────────
  const addItem     = item => setCart(prev => {
    const ex = prev.find(c => c.id === item.id)
    if (ex) return prev.map(c => c.id === item.id ? { ...c, quantity: c.quantity + 1 } : c)
    return [...prev, { id: item.id, name: item.name, price: item.price, quantity: 1, note: '' }]
  })
  const removeItem  = id => setCart(prev => {
    const ex = prev.find(c => c.id === id)
    if (!ex) return prev
    if (ex.quantity === 1) return prev.filter(c => c.id !== id)
    return prev.map(c => c.id === id ? { ...c, quantity: c.quantity - 1 } : c)
  })
  const clearItem   = id => setCart(prev => prev.filter(c => c.id !== id))
  const getQty      = id => cart.find(c => c.id === id)?.quantity || 0
  const setItemNote = (id, note) => setCart(prev => prev.map(c => c.id === id ? { ...c, note } : c))

  // ── Submit (new order OR add to existing tab) ──────────────────────────────
  const handleSubmit = async () => {
    if (!cart.length) return
    setSubmitting(true)
    try {
      const itemsPayload = cart.map(c => ({ menuItemId: c.id, quantity: c.quantity, notes: c.note || '' }))

      if (orderingMore && activeOrder) {
        const updated = await publicApi.addItems(activeOrder.rawId, tableId, itemsPayload)
        setActiveOrder(updated)
        setCart([]); setNotes(''); setCartOpen(false)
        setOrderingMore(false)
        setView('tracking')
      } else {
        const result = await publicApi.createOrder({
          tableId, notes: notes.trim(),
          items: itemsPayload,
          paymentMethod,
          guestName:  guestName.trim()  || undefined,
          guestPhone: guestPhone.trim() || undefined,
        })
        setCart([]); setNotes(''); setCartOpen(false); setPaymentMethod('cash')
        await loadOrder(result.rawId)
      }
    } catch (err) {
      alert(err.message || 'Could not place order. Please ask a staff member.')
    } finally {
      setSubmitting(false)
    }
  }

  // ── Derived ────────────────────────────────────────────────────────────────
  const grouped  = useMemo(() =>
    menu.reduce((acc, item) => { if (!acc[item.category]) acc[item.category] = []; acc[item.category].push(item); return acc }, {}),
    [menu]
  )
  const catOrder = useMemo(() => [...new Set(menu.map(m => m.category).filter(Boolean))], [menu])

  // Filtered by search query
  const filteredGrouped = useMemo(() => {
    if (!menuSearch.trim()) return grouped
    const q = menuSearch.toLowerCase()
    const result = {}
    for (const cat of Object.keys(grouped)) {
      const items = grouped[cat].filter(i => i.name.toLowerCase().includes(q) || tr(i.name).toLowerCase().includes(q))
      if (items.length) result[cat] = items
    }
    return result
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [grouped, menuSearch, translations, lang])

  const filteredCatOrder = useMemo(() =>
    catOrder.filter(c => filteredGrouped[c]),
    [catOrder, filteredGrouped]
  )

  // ── Cancel order ───────────────────────────────────────────────────────────
  const handleCancelOrder = async () => {
    if (!activeOrder) return
    setCancelling(true)
    try {
      await publicApi.cancelOrder(activeOrder.rawId, tableId)
      stopPoll(); setView('cancelled'); setCancelConfirm(false)
    } catch (err) {
      setCancelConfirm(false)
      alert(err.message || 'Could not cancel. Please ask a staff member.')
    } finally { setCancelling(false) }
  }

  // ── Submit return request ──────────────────────────────────────────────────
  const handleReturnSubmit = async () => {
    if (!activeOrder) return
    const items = Object.entries(returnQtys)
      .filter(([, qty]) => qty > 0)
      .map(([orderItemId, qty]) => {
        const oi = activeOrder.items.find(i => String(i.orderItemId) === String(orderItemId))
        return {
          orderItemId: parseInt(orderItemId),
          menuItemId:  oi?.menuItemId || null,
          name:        oi?.name || '',
          quantity:    qty,
          unitPrice:   oi?.unitPrice || 0,
        }
      })
    if (!items.length) return
    setReturnState('submitting')
    setReturnError('')
    try {
      await publicApi.requestReturn(activeOrder.rawId, { tableId, reason: returnReason.trim(), items })
      setReturnState('sent')
    } catch (err) {
      setReturnState('error')
      setReturnError(err.message || 'Could not send request. Please ask a staff member.')
    }
  }

  const openReturnPanel = () => {
    setReturnQtys({})
    setReturnReason('')
    setReturnState('idle')
    setReturnError('')
    setReturnOpen(true)
  }

  // ── Request checkout ───────────────────────────────────────────────────────
  const handleRequestCheckout = async () => {
    if (!activeOrder) return
    setRequesting(true)
    try {
      await publicApi.requestCheckout(activeOrder.rawId, tableId)
      setCheckoutSentAt(Date.now())
    } catch {
      alert('Could not send request. Please ask a staff member.')
    } finally { setRequesting(false) }
  }

  // ── Call Staff ─────────────────────────────────────────────────────────────
  const handleCallStaff = async () => {
    setCallingStaff(true)
    try {
      await publicApi.callStaff(tableId)
      setCallStaffSentAt(Date.now())
    } catch {
      alert('Could not call staff. Please ask for assistance directly.')
    } finally { setCallingStaff(false) }
  }

  // ── Submit rating ──────────────────────────────────────────────────────────
  const handleRatingSubmit = async () => {
    if (!activeOrder || !ratingValue) return
    setRatingState('submitting')
    try {
      await publicApi.submitRating(activeOrder.rawId, tableId, ratingValue, ratingComment)
      setRatingState('sent')
    } catch {
      setRatingState('error')
    }
  }

  // ── Scroll spy ────────────────────────────────────────────────────────────
  useEffect(() => {
    if (view !== 'menu' || !filteredCatOrder.length) return
    const HEADER_H = 155

    const onScroll = () => {
      if (scrollLock.current) return
      let current = filteredCatOrder[0]
      for (const cat of filteredCatOrder) {
        const el = document.getElementById(`cat-sec-${cat}`)
        if (!el) continue
        if (el.getBoundingClientRect().top <= HEADER_H + 24) current = cat
      }
      setActiveCategory(current)
    }

    window.addEventListener('scroll', onScroll, { passive: true })
    onScroll()
    return () => window.removeEventListener('scroll', onScroll)
  }, [view, filteredCatOrder])

  useEffect(() => {
    const btn = tabBtnRefs.current[activeCategory]
    if (btn) btn.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' })
  }, [activeCategory])

  const scrollToCategory = (cat) => {
    scrollLock.current = true
    setActiveCategory(cat)
    const el = document.getElementById(`cat-sec-${cat}`)
    if (el) {
      const top = el.getBoundingClientRect().top + window.scrollY - 158
      window.scrollTo({ top, behavior: 'smooth' })
    }
    setTimeout(() => { scrollLock.current = false }, 900)
  }

  // ── Derived values ─────────────────────────────────────────────────────────
  const cartTotal = cart.reduce((s, i) => s + i.price * i.quantity, 0)
  const cartCount = cart.reduce((s, i) => s + i.quantity, 0)
  const currency  = table?.currency || 'LAK'

  const LangBtn = () => (
    <button onClick={toggleLang} className="flex-shrink-0 px-2.5 py-1 rounded-full text-xs font-bold border border-gray-200 bg-white text-gray-600 hover:bg-gray-50 shadow-sm">
      {lang === 'en' ? 'ລາວ' : 'EN'}
    </button>
  )

  const CallStaffBtn = ({ variant = 'outline' }) => {
    if (callStaffSentAt) return (
      <div className="flex flex-col items-center justify-center gap-0.5 py-3 px-4 rounded-2xl text-center bg-blue-50 border border-blue-200 w-full">
        <div className="flex items-center gap-1 text-xs font-semibold text-blue-700"><PhoneCall size={13} />{t('call_staff_sent')}</div>
        <span className="text-[10px] text-blue-500">{t('call_staff_cooldown')}</span>
      </div>
    )
    return (
      <button
        onClick={handleCallStaff}
        disabled={callingStaff}
        className={`w-full flex items-center justify-center gap-2 py-3.5 font-semibold text-sm rounded-2xl disabled:opacity-60 transition-colors ${variant === 'solid' ? 'bg-blue-600 text-white hover:bg-blue-700' : 'bg-white border-2 border-blue-400 text-blue-600 hover:bg-blue-50'}`}
      >
        <PhoneCall size={15} />
        {callingStaff ? t('calling') : t('home_call_staff')}
      </button>
    )
  }

  // ── Loading / Error ────────────────────────────────────────────────────────
  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="text-center">
        <div className="w-10 h-10 border-2 border-teal-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
        <p className="text-gray-400 text-sm">{t('loading')}</p>
      </div>
    </div>
  )
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

  // ── Cancelled ──────────────────────────────────────────────────────────────
  if (view === 'cancelled') return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-6">
      <div className="text-center max-w-xs w-full">
        <div className="flex justify-end mb-2"><LangBtn /></div>
        <div className="w-20 h-20 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-5">
          <XCircle size={34} className="text-red-400" />
        </div>
        <h1 className="text-2xl font-bold text-gray-900 mb-2">{t('cancelled_title')}</h1>
        <p className="text-sm text-gray-500 mb-1">{t('cancelled_msg', <span className="font-semibold">{activeOrder?.id}</span>)}</p>
        <p className="text-xs text-gray-400 mb-6">{t('no_charges')}</p>
        <button onClick={() => { setActiveOrder(null); setView('home') }}
          className="px-6 py-2.5 bg-teal-600 text-white text-sm font-semibold rounded-xl hover:bg-teal-700 shadow-sm">
          {t('order_again')}
        </button>
      </div>
    </div>
  )

  // ── Complete ───────────────────────────────────────────────────────────────
  if (view === 'complete') {
    const orderItems = activeOrder?.items || []
    const orderTotal = parseFloat(activeOrder?.total || 0)
    return (
      <div className="min-h-screen bg-gray-50 p-4">
        <div className="max-w-xs mx-auto">
          <div className="flex justify-end mb-2"><LangBtn /></div>

          <div className="text-center mb-5">
            <div className="w-20 h-20 bg-teal-50 rounded-full flex items-center justify-center mx-auto mb-4">
              <CheckCircle2 size={34} className="text-teal-500" />
            </div>
            <h1 className="text-2xl font-bold text-gray-900">{t('order_complete_title')}</h1>
            <p className="text-sm text-gray-500 mt-1">{t('order_complete_msg')}</p>
          </div>

          {orderItems.length > 0 && (
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden mb-4">
              <div className="px-5 py-3 border-b border-gray-50">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">{t('order_summary')}</p>
              </div>
              <div className="divide-y divide-gray-50">
                {orderItems.map((item, i) => (
                  <div key={item.orderItemId ?? i} className="flex items-center justify-between px-5 py-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <span className="w-6 h-6 bg-teal-50 text-teal-600 text-xs font-bold rounded-full flex items-center justify-center flex-shrink-0">{item.quantity}</span>
                      <p className="text-sm font-medium text-gray-800 truncate">{item.name}</p>
                    </div>
                    <p className="text-sm font-semibold text-gray-900 ml-3 flex-shrink-0">{(item.unitPrice * item.quantity).toLocaleString()}</p>
                  </div>
                ))}
              </div>
              <div className="px-5 py-3 bg-gray-50 border-t border-gray-100 flex justify-between items-center">
                <p className="text-sm font-bold text-gray-700">{t('total')}</p>
                <p className="text-base font-extrabold text-teal-600">{orderTotal.toLocaleString()} {currency}</p>
              </div>
            </div>
          )}

          <button onClick={() => { setActiveOrder(null); setView('home') }}
            className="w-full px-6 py-2.5 bg-teal-600 text-white text-sm font-semibold rounded-xl hover:bg-teal-700 shadow-sm">
            {t('order_again')}
          </button>
        </div>
      </div>
    )
  }

  // ── Rating view ────────────────────────────────────────────────────────────
  if (view === 'rating') {
    return (
      <div className="min-h-screen bg-gray-50">
        <header className="sticky top-0 z-20 bg-white border-b border-gray-100 shadow-sm">
          <div className="px-4 py-3 flex items-center justify-between max-w-xl mx-auto">
            <button onClick={() => setView('home')} className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-teal-600">
              <ChevronLeft size={18} />{t('back')}
            </button>
            <LangBtn />
          </div>
        </header>
        <main className="px-4 py-8 max-w-sm mx-auto">
          {ratingState === 'sent' ? (
            <div className="text-center py-12">
              <div className="w-16 h-16 bg-teal-50 rounded-full flex items-center justify-center mx-auto mb-4">
                <CheckCircle2 size={30} className="text-teal-500" />
              </div>
              <h2 className="text-xl font-bold text-gray-900 mb-2">{t('rating_thanks')}</h2>
              <button onClick={() => setView('home')} className="mt-4 px-6 py-2.5 bg-teal-600 text-white text-sm font-semibold rounded-xl hover:bg-teal-700">OK</button>
            </div>
          ) : (
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
              <h2 className="text-lg font-bold text-gray-900 text-center mb-6">{t('rating_title')}</h2>
              <div className="flex justify-center gap-3 mb-6">
                {[1,2,3,4,5].map(s => (
                  <button key={s} onClick={() => setRatingValue(s)}>
                    <Star size={36} className={s <= ratingValue ? 'text-amber-400 fill-amber-400' : 'text-gray-200'} />
                  </button>
                ))}
              </div>
              {ratingValue === 0 && (
                <p className="text-center text-xs text-gray-400 mb-4">{t('rating_select_star')}</p>
              )}
              <textarea
                value={ratingComment}
                onChange={e => setRatingComment(e.target.value)}
                placeholder={t('rating_comment_ph')}
                rows={3}
                className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2 resize-none focus:outline-none focus:ring-2 focus:ring-teal-500 placeholder:text-gray-300 mb-4"
              />
              {ratingState === 'error' && (
                <p className="text-xs text-red-500 mb-3 text-center">Could not submit. Please try again.</p>
              )}
              <button
                onClick={handleRatingSubmit}
                disabled={!ratingValue || ratingState === 'submitting'}
                className="w-full py-3 bg-teal-600 text-white text-sm font-semibold rounded-xl hover:bg-teal-700 disabled:opacity-50 transition-colors"
              >
                {ratingState === 'submitting' ? t('submitting_rating') : t('rating_submit')}
              </button>
            </div>
          )}
        </main>
      </div>
    )
  }

  // ── Promotions view ────────────────────────────────────────────────────────
  if (view === 'promotions') {
    return (
      <div className="min-h-screen bg-gray-50">
        <header className="sticky top-0 z-20 bg-white border-b border-gray-100 shadow-sm">
          <div className="px-4 py-3 flex items-center justify-between max-w-xl mx-auto">
            <button onClick={() => setView('home')} className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-teal-600">
              <ChevronLeft size={18} />{t('back')}
            </button>
            <span className="text-sm font-bold text-gray-900">{t('promo_title')}</span>
            <LangBtn />
          </div>
        </header>
        <main className="px-4 py-5 max-w-xl mx-auto space-y-3">
          {!promosLoaded ? (
            <div className="text-center py-12 text-gray-400 text-sm">{t('loading_promos')}</div>
          ) : promos.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-gray-400">
              <Tag size={32} className="mb-3 opacity-30" />
              <p className="text-sm">{t('promo_empty')}</p>
            </div>
          ) : promos.map(p => (
            <div key={p.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-gray-900 text-sm">{p.name}</p>
                  {p.description && <p className="text-xs text-gray-500 mt-0.5">{p.description}</p>}
                </div>
                <div className="flex-shrink-0">
                  <span className="inline-block px-2.5 py-1 bg-teal-50 text-teal-700 text-xs font-bold rounded-full">
                    {p.discount_type === 'percent' ? `${p.discount_value}% OFF` : `${parseFloat(p.discount_value).toLocaleString()} OFF`}
                  </span>
                </div>
              </div>
              {p.code && (
                <div className="mt-3 flex items-center gap-2">
                  <span className="text-xs text-gray-500">Code:</span>
                  <span className="px-2.5 py-1 bg-gray-100 text-gray-700 text-xs font-mono font-bold rounded-lg tracking-wider">{p.code}</span>
                </div>
              )}
            </div>
          ))}
        </main>
      </div>
    )
  }

  // ── Home view ──────────────────────────────────────────────────────────────
  if (view === 'home') {
    return (
      <div className="min-h-screen bg-gray-50">
        {/* Teal header */}
        <header className="bg-teal-600 text-white px-4 pt-8 pb-6">
          <div className="max-w-xl mx-auto">
            <div className="flex items-center justify-between mb-1">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center">
                  <UtensilsCrossed size={20} className="text-white" />
                </div>
                <div>
                  <p className="text-xs text-teal-100 truncate max-w-[180px]">{table?.restaurantName}</p>
                  <h1 className="text-lg font-bold">{t('table', table?.number)}</h1>
                </div>
              </div>
              <LangBtn />
            </div>
          </div>
        </header>

        <main className="px-4 py-5 pb-12 max-w-xl mx-auto space-y-4">
          {/* Guest info card */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
            <p className="text-xs text-gray-400 mb-3">{t('home_guest_hint')}</p>
            <div className="space-y-2">
              <input
                type="text"
                value={guestName}
                onChange={e => setGuestName(e.target.value)}
                onBlur={saveGuest}
                placeholder={t('home_guest_name')}
                className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-teal-500 placeholder:text-gray-300"
              />
              <input
                type="tel"
                value={guestPhone}
                onChange={e => setGuestPhone(e.target.value)}
                onBlur={saveGuest}
                placeholder={t('home_guest_phone')}
                className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-teal-500 placeholder:text-gray-300"
              />
            </div>
          </div>

          {/* Action grid */}
          {/* ORDER NOW — full width */}
          <button
            onClick={() => { setOrderingMore(false); setView('menu') }}
            className="w-full flex items-center justify-center gap-2.5 py-4 bg-teal-600 text-white font-bold text-base rounded-2xl hover:bg-teal-700 shadow-md shadow-teal-200 transition-colors"
          >
            <ShoppingCart size={20} />
            {t('home_order_now')}
          </button>

          {/* CALL STAFF */}
          <CallStaffBtn variant="outline" />

          {/* My Order + Rating side by side */}
          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={() => activeOrder ? setView('tracking') : null}
              disabled={!activeOrder}
              className={`flex flex-col items-center justify-center gap-1.5 py-4 rounded-2xl border-2 font-semibold text-sm transition-colors ${activeOrder ? 'border-teal-500 bg-teal-50 text-teal-700 hover:bg-teal-100' : 'border-gray-100 bg-gray-50 text-gray-300'}`}
            >
              <Receipt size={20} />
              {t('home_my_order')}
              {activeOrder && <span className="text-[10px] font-bold bg-teal-600 text-white px-2 py-0.5 rounded-full">{activeOrder.id}</span>}
            </button>

            <button
              onClick={() => activeOrder ? (setRatingValue(0), setRatingComment(''), setRatingState('idle'), setView('rating')) : null}
              disabled={!activeOrder}
              className={`flex flex-col items-center justify-center gap-1.5 py-4 rounded-2xl border-2 font-semibold text-sm transition-colors ${activeOrder ? 'border-amber-400 bg-amber-50 text-amber-700 hover:bg-amber-100' : 'border-gray-100 bg-gray-50 text-gray-300'}`}
            >
              <Star size={20} />
              {t('home_rating')}
            </button>
          </div>

          {/* PROMOTIONS */}
          <button
            onClick={() => setView('promotions')}
            className="w-full flex items-center justify-center gap-2 py-3.5 bg-white border-2 border-gray-200 text-gray-600 font-semibold text-sm rounded-2xl hover:border-gray-300 hover:bg-gray-50 transition-colors"
          >
            <Tag size={16} />
            {t('home_promotions')}
          </button>
        </main>
      </div>
    )
  }

  // ── Order tracking ─────────────────────────────────────────────────────────
  if (view === 'tracking' && activeOrder) {
    const stepIndex   = STATUS_STEPS.indexOf(activeOrder.status)
    const orderItems  = activeOrder.items || []
    const orderTotal  = parseFloat(activeOrder.total || 0)
    const statusLabel = {
      Pending:       t('status_pending'),
      'In Progress': t('status_progress'),
      Served:        t('status_served'),
      Closed:        t('status_closed'),
      Cancelled:     t('status_cancelled'),
    }[activeOrder.status] || activeOrder.status
    const statusMsg = {
      Pending:       t('status_msg_pending'),
      'In Progress': t('status_msg_progress'),
      Served:        t('status_msg_served'),
    }[activeOrder.status]

    return (
      <div className="min-h-screen bg-gray-50">

        {/* "Food ready" alert overlay */}
        {servedAlerted && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-6" onClick={() => setServedAlerted(false)}>
            <div className="bg-white rounded-2xl shadow-2xl p-6 max-w-xs w-full text-center" onClick={e => e.stopPropagation()}>
              <div className="w-16 h-16 bg-green-50 rounded-full flex items-center justify-center mx-auto mb-3">
                <CheckCircle2 size={32} className="text-green-500" />
              </div>
              <h2 className="text-xl font-bold text-gray-900 mb-1">{t('served_alert')}</h2>
              <p className="text-sm text-gray-500 mb-4">{t('served_alert_sub')}</p>
              <button onClick={() => setServedAlerted(false)} className="px-8 py-2.5 bg-green-500 text-white text-sm font-semibold rounded-xl hover:bg-green-600">OK</button>
            </div>
          </div>
        )}

        {/* Header */}
        <header className="sticky top-0 z-20 bg-white border-b border-gray-100 shadow-sm">
          <div className="px-4 py-3 flex items-center justify-between max-w-xl mx-auto">
            <div className="flex items-center gap-2.5">
              <button onClick={() => setView('home')} className="p-1.5 text-gray-400 hover:text-teal-600">
                <Home size={18} />
              </button>
              <div className="w-8 h-8 bg-teal-600 rounded-lg flex items-center justify-center">
                <UtensilsCrossed size={14} className="text-white" />
              </div>
              <div>
                <p className="text-xs text-gray-400 truncate max-w-[140px]">{table?.restaurantName}</p>
                <h1 className="text-sm font-bold text-gray-900">{t('table', table?.number)}</h1>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <LangBtn />
              <span className="w-2 h-2 rounded-full bg-teal-400 animate-pulse" title="Live" />
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
                'bg-gray-100 text-gray-600'
              }`}>{statusLabel}</span>
            </div>
            <p className="text-xl font-bold text-gray-900">{activeOrder.id}</p>
            {statusMsg && <p className="text-xs text-gray-500 mt-1.5 leading-relaxed">{statusMsg}</p>}
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
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${
                        done    ? 'bg-teal-600 text-white' :
                        current ? 'bg-teal-100 border-2 border-teal-500 text-teal-600' :
                        'bg-gray-100 text-gray-400'
                      }`}>
                        {done ? <CheckCircle2 size={14} /> : i + 1}
                      </div>
                      <p className={`text-[10px] mt-1 font-medium whitespace-nowrap ${
                        current ? 'text-teal-600' : done ? 'text-gray-500' : 'text-gray-300'
                      }`}>{label}</p>
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
                    <span className="w-6 h-6 bg-teal-50 text-teal-600 text-xs font-bold rounded-full flex items-center justify-center flex-shrink-0">{item.quantity}</span>
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-gray-800 truncate">{item.name}</p>
                      {item.notes && <p className="text-xs text-gray-400 truncate">{item.notes}</p>}
                    </div>
                  </div>
                  <p className="text-sm font-semibold text-gray-900 flex-shrink-0 ml-3">{(item.unitPrice * item.quantity).toLocaleString()}</p>
                </div>
              ))}
            </div>
            <div className="px-5 py-3 bg-gray-50 border-t border-gray-100 flex justify-between items-center">
              <p className="text-sm font-bold text-gray-700">{t('total')}</p>
              <p className="text-base font-extrabold text-teal-600">{orderTotal.toLocaleString()} {currency}</p>
            </div>
          </div>

          {/* QR payment image */}
          {activeOrder.paymentMethod === 'qr' && table?.qrImageBase64 && (
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm px-5 py-4 flex flex-col items-center gap-3">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">{t('scan_to_pay')}</p>
              <img src={table.qrImageBase64} alt="Payment QR" className="w-44 h-44 object-contain rounded-xl border border-gray-100" />
              <p className="text-xs text-gray-400 text-center">{t('scan_qr_desc')}</p>
            </div>
          )}

          {/* Action buttons */}
          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={() => { setOrderingMore(true); setView('menu'); setCart([]); setActiveCategory('All') }}
              className="flex items-center justify-center gap-2 py-3.5 bg-white border-2 border-teal-500 text-teal-600 font-semibold text-sm rounded-2xl hover:bg-teal-50 transition-colors"
            >
              <Plus size={16} />
              {t('order_more')}
            </button>

            {checkoutSentAt ? (
              <div className="flex flex-col items-center justify-center gap-0.5 py-3 bg-green-50 border border-green-200 text-green-700 rounded-2xl text-center px-3">
                <div className="flex items-center gap-1 text-xs font-semibold"><CheckCircle2 size={13} />{t('checkout_sent')}</div>
                <span className="text-[10px] text-green-500">{t('notify_again_hint')}</span>
              </div>
            ) : (
              <button
                onClick={handleRequestCheckout}
                disabled={requesting}
                className="flex items-center justify-center gap-2 py-3.5 bg-teal-600 text-white font-semibold text-sm rounded-2xl hover:bg-teal-700 disabled:opacity-60 transition-colors"
              >
                <Bell size={15} />
                {requesting ? t('requesting') : t('request_checkout')}
              </button>
            )}
          </div>

          {/* Call Staff */}
          <CallStaffBtn variant="outline" />

          {/* Return Items */}
          {['In Progress', 'Served'].includes(activeOrder.status) && !returnOpen && (
            <button onClick={openReturnPanel} className="w-full flex items-center justify-center gap-2 py-3 bg-white border border-gray-200 text-gray-600 font-medium text-sm rounded-2xl hover:bg-gray-50 transition-colors">
              <Minus size={14} />
              {t('return_items')}
            </button>
          )}

          {/* Return request panel */}
          {returnOpen && (
            <div className="bg-white rounded-2xl border border-amber-200 shadow-sm overflow-hidden">
              <div className="px-5 py-3 border-b border-amber-100 flex items-center justify-between bg-amber-50">
                <p className="text-sm font-semibold text-amber-800">{t('return_title')}</p>
                <button onClick={() => setReturnOpen(false)} className="text-gray-400 hover:text-gray-600"><X size={15} /></button>
              </div>

              {returnState === 'sent' ? (
                <div className="px-5 py-8 text-center">
                  <div className="w-12 h-12 bg-green-50 rounded-full flex items-center justify-center mx-auto mb-3">
                    <CheckCircle2 size={22} className="text-green-500" />
                  </div>
                  <p className="text-sm font-semibold text-gray-800">{t('return_sent')}</p>
                  <p className="text-xs text-gray-400 mt-1">{t('return_sent_desc')}</p>
                  <button onClick={() => setReturnOpen(false)} className="mt-4 px-5 py-2 bg-gray-100 text-gray-600 text-xs font-medium rounded-xl hover:bg-gray-200">OK</button>
                </div>
              ) : (
                <div className="px-5 py-4 space-y-3">
                  <p className="text-xs text-gray-500">{t('return_desc')}</p>
                  {(activeOrder.items || []).map(item => {
                    const cur = returnQtys[item.orderItemId] || 0
                    return (
                      <div key={item.orderItemId} className="flex items-center justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium text-gray-800 truncate">{item.name}</p>
                          <p className="text-xs text-gray-400">×{item.quantity} ordered</p>
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0">
                          <button onClick={() => setReturnQtys(p => ({ ...p, [item.orderItemId]: Math.max(0, (p[item.orderItemId] || 0) - 1) }))} disabled={cur === 0} className="w-7 h-7 rounded-full border border-gray-200 flex items-center justify-center text-gray-500 hover:bg-gray-100 disabled:opacity-30"><Minus size={12} /></button>
                          <span className={`w-6 text-center text-sm font-bold ${cur > 0 ? 'text-amber-600' : 'text-gray-300'}`}>{cur}</span>
                          <button onClick={() => setReturnQtys(p => ({ ...p, [item.orderItemId]: Math.min(item.quantity, (p[item.orderItemId] || 0) + 1) }))} disabled={cur >= item.quantity} className="w-7 h-7 rounded-full border border-gray-200 flex items-center justify-center text-gray-500 hover:bg-gray-100 disabled:opacity-30"><Plus size={12} /></button>
                        </div>
                      </div>
                    )
                  })}
                  <textarea value={returnReason} onChange={e => setReturnReason(e.target.value)} placeholder={t('return_reason_ph')} rows={2} className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2 resize-none focus:outline-none focus:ring-2 focus:ring-amber-400 text-gray-700 placeholder:text-gray-300" />
                  {returnError && <p className="text-xs text-red-500">{returnError}</p>}
                  <button onClick={handleReturnSubmit} disabled={returnState === 'submitting' || Object.values(returnQtys).every(q => q === 0)} className="w-full py-3 bg-amber-500 text-white text-sm font-semibold rounded-xl hover:bg-amber-600 disabled:opacity-50 transition-colors">
                    {returnState === 'submitting' ? t('return_submitting') : t('return_submit')}
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Cancel (Pending only) */}
          {activeOrder.status === 'Pending' && (
            <div className="text-center">
              {!cancelConfirm ? (
                <button onClick={() => setCancelConfirm(true)} className="text-xs text-gray-400 hover:text-red-500 underline underline-offset-2">{t('cancel_link')}</button>
              ) : (
                <div className="bg-red-50 border border-red-100 rounded-2xl p-4 text-left">
                  <p className="text-sm font-semibold text-red-700 mb-1">{t('cancel_q')}</p>
                  <p className="text-xs text-red-400 mb-4">{t('cancel_desc')}</p>
                  <div className="flex gap-2">
                    <button onClick={() => setCancelConfirm(false)} disabled={cancelling} className="flex-1 py-2.5 text-sm font-medium text-gray-600 bg-white border border-gray-200 rounded-xl disabled:opacity-50">{t('keep_it')}</button>
                    <button onClick={handleCancelOrder} disabled={cancelling} className="flex-1 py-2.5 text-sm font-semibold text-white bg-red-500 rounded-xl hover:bg-red-600 disabled:opacity-50">{cancelling ? t('cancelling') : t('yes_cancel')}</button>
                  </div>
                </div>
              )}
            </div>
          )}
        </main>
      </div>
    )
  }

  // ── Menu view (new order OR ordering more) ─────────────────────────────────
  return (
    <div className="min-h-screen bg-gray-50">
      <header className="sticky top-0 z-20 bg-white border-b border-gray-100 shadow-sm">
        <div className="px-4 py-3 flex items-center justify-between max-w-xl mx-auto">
          <div className="flex items-center gap-2.5">
            {orderingMore ? (
              <button onClick={() => { setOrderingMore(false); setView('tracking'); setCart([]) }} className="p-1.5 text-gray-500 hover:text-teal-600">
                <ChevronLeft size={20} />
              </button>
            ) : (
              <button onClick={() => setView('home')} className="p-1.5 text-gray-400 hover:text-teal-600">
                <Home size={18} />
              </button>
            )}
            <div className="w-8 h-8 bg-teal-600 rounded-lg flex items-center justify-center flex-shrink-0">
              <UtensilsCrossed size={14} className="text-white" />
            </div>
            <div>
              <p className="text-xs text-gray-400 truncate max-w-[140px]">{table?.restaurantName}</p>
              <h1 className="text-sm font-bold text-gray-900">{t('table', table?.number)}</h1>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <LangBtn />
            <button onClick={() => setCartOpen(true)} className="relative p-2 text-teal-600 hover:bg-teal-50 rounded-xl">
              <ShoppingCart size={22} />
              {cartCount > 0 && (
                <span className="absolute -top-1 -right-1 w-5 h-5 bg-teal-600 text-white text-xs font-bold rounded-full flex items-center justify-center">{cartCount}</span>
              )}
            </button>
          </div>
        </div>

        {/* Search input */}
        <div className="px-4 pb-2 max-w-xl mx-auto">
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              value={menuSearch}
              onChange={e => setMenuSearch(e.target.value)}
              placeholder={t('search_ph')}
              className="w-full text-sm pl-8 pr-8 py-2 bg-gray-100 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-500 placeholder:text-gray-400"
            />
            {menuSearch && (
              <button onClick={() => setMenuSearch('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                <X size={13} />
              </button>
            )}
          </div>
        </div>

        {/* Category tabs — hidden while searching */}
        {!menuSearch && (
          <div ref={tabBarRef} className="flex gap-2 px-4 pb-3 overflow-x-auto scrollbar-hide max-w-xl mx-auto items-center">
            {catOrder.map(cat => (
              <button
                key={cat}
                ref={el => { tabBtnRefs.current[cat] = el }}
                onClick={() => scrollToCategory(cat)}
                className={`flex-shrink-0 px-3.5 py-1.5 rounded-full text-xs font-semibold transition-colors ${
                  activeCategory === cat ? 'bg-teal-600 text-white shadow-sm' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                }`}
              >
                {catLabel(cat)}
              </button>
            ))}
            {translating && (
              <div className="flex-shrink-0 w-4 h-4 border-2 border-teal-400 border-t-transparent rounded-full animate-spin ml-1" title="Translating…" />
            )}
          </div>
        )}
      </header>

      <main className="px-4 py-4 pb-32 max-w-xl mx-auto">
        {/* Deals banner */}
        {deals.length > 0 && (
          <div className="flex gap-3 overflow-x-auto scrollbar-hide mb-4 -mx-1 px-1 pb-1">
            {deals.map(deal => {
              const linkedItem = deal.menuItemId ? menu.find(m => m.id === deal.menuItemId) : null
              const qty        = linkedItem ? getQty(linkedItem.id) : 0
              const outOfStock = linkedItem ? (linkedItem.isAvailable === false || (linkedItem.stockQuantity !== null && linkedItem.stockQuantity <= 0)) : false
              return (
                <div key={deal.id} className="flex-shrink-0 w-52 rounded-2xl overflow-hidden border border-rose-100 bg-gradient-to-br from-rose-50 to-orange-50 shadow-sm flex flex-col">
                  {deal.imageUrl && (
                    <img src={deal.imageUrl} alt={deal.title} className="w-full h-28 object-cover" />
                  )}
                  <div className="p-3 flex flex-col flex-1">
                    <p className="text-sm font-bold text-rose-700 line-clamp-1">{deal.title}</p>
                    {deal.description && <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">{deal.description}</p>}
                    <div className="flex items-center justify-between mt-auto pt-2">
                      {linkedItem
                        ? <p className="text-sm font-bold text-rose-600">{linkedItem.price.toLocaleString()} {currency}</p>
                        : deal.price != null
                          ? <p className="text-sm font-bold text-rose-600">{deal.price.toLocaleString()} {currency}</p>
                          : <span />
                      }
                      {linkedItem && !outOfStock ? (
                        <div className="flex items-center gap-1.5">
                          {qty > 0 && (
                            <>
                              <button onClick={() => removeItem(linkedItem.id)} className="w-7 h-7 rounded-full bg-white border border-rose-200 text-rose-600 flex items-center justify-center hover:bg-rose-50">
                                <Minus size={12} />
                              </button>
                              <span className="w-4 text-center text-sm font-bold text-gray-900">{qty}</span>
                            </>
                          )}
                          <button onClick={() => addItem(linkedItem)} className="w-7 h-7 rounded-full bg-rose-500 text-white flex items-center justify-center hover:bg-rose-600 shadow-sm">
                            <Plus size={12} />
                          </button>
                        </div>
                      ) : linkedItem && outOfStock ? (
                        <span className="text-[10px] text-gray-400 font-medium">Out of stock</span>
                      ) : null}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {orderingMore && activeOrder && (
          <div className="mb-4 flex items-center gap-2 px-4 py-2.5 bg-teal-50 border border-teal-200 rounded-xl text-sm text-teal-700">
            <Plus size={14} className="flex-shrink-0" />
            <span>Adding to order <strong>{activeOrder.id}</strong></span>
          </div>
        )}

        {menuSearch && filteredCatOrder.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16 text-gray-400">
            <Search size={28} className="mb-2 opacity-30" />
            <p className="text-sm">{t('no_search_results')}</p>
          </div>
        )}

        {filteredCatOrder.filter(c => filteredGrouped[c]).map(cat => (
          <section key={cat} id={`cat-sec-${cat}`} className="mb-8">
            <div className="flex items-center gap-2 mb-3">
              <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold ${CAT_COLOUR[cat] || 'bg-gray-100 text-gray-600'}`}>
                {tr(cat)}
              </span>
            </div>
            <MenuItemList
              items={filteredGrouped[cat]}
              getQty={getQty}
              addItem={addItem}
              removeItem={removeItem}
              trFn={tr}
              outOfStockLabel={t('out_of_stock')}
            />
          </section>
        ))}

        {!menuSearch && catOrder.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16 text-gray-400">
            <UtensilsCrossed size={32} className="mb-2 opacity-30" />
            <p className="text-sm">{t('no_items')}</p>
          </div>
        )}
      </main>

      {/* Sticky cart bar */}
      {cartCount > 0 && !cartOpen && (
        <div className="fixed bottom-0 left-0 right-0 z-10 p-4 max-w-xl mx-auto">
          <button onClick={() => setCartOpen(true)} className="w-full bg-teal-600 text-white font-semibold py-3.5 rounded-xl flex items-center justify-between px-5 shadow-lg">
            <span className="bg-teal-500 text-white text-xs font-bold px-2 py-0.5 rounded-full">{cartCount}</span>
            <span>{t('view_order', cartCount)}</span>
            <span>{cartTotal.toLocaleString()} {currency}</span>
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
              <button onClick={() => setCartOpen(false)} className="p-1 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100"><X size={18} /></button>
            </div>

            <div className="flex-1 overflow-y-auto px-5 py-3 space-y-4 min-h-0">
              {cart.map(item => (
                <div key={item.id}>
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                      <button onClick={() => clearItem(item.id)} className="text-gray-300 hover:text-red-400 flex-shrink-0"><X size={14} /></button>
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-gray-900 truncate">{tr(item.name)}</p>
                        <p className="text-xs text-gray-400">{item.price.toLocaleString()} each</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <button onClick={() => removeItem(item.id)} className="w-6 h-6 rounded-full bg-gray-100 flex items-center justify-center hover:bg-gray-200"><Minus size={10} /></button>
                      <span className="w-5 text-center text-sm font-semibold">{item.quantity}</span>
                      <button onClick={() => addItem(item)} className="w-6 h-6 rounded-full bg-teal-100 text-teal-600 flex items-center justify-center hover:bg-teal-200"><Plus size={10} /></button>
                    </div>
                    <span className="text-sm font-semibold text-gray-900 w-20 text-right flex-shrink-0">{(item.price * item.quantity).toLocaleString()}</span>
                  </div>
                  <div className="ml-6 mt-1.5">
                    <input type="text" maxLength={80} value={item.note || ''} onChange={e => setItemNote(item.id, e.target.value)} placeholder={t('item_note_ph')} className="w-full text-xs text-gray-600 placeholder:text-gray-300 bg-gray-50 border border-gray-200 rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-teal-400" />
                  </div>
                </div>
              ))}

              {!orderingMore && (
                <div className="pt-1">
                  <label className="text-xs font-medium text-gray-500 mb-1 block">{t('special_req')}</label>
                  <textarea value={notes} onChange={e => setNotes(e.target.value)} placeholder={t('special_req_ph')} rows={2} className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2 resize-none focus:outline-none focus:ring-2 focus:ring-teal-500 placeholder:text-gray-300" />
                </div>
              )}
            </div>

            <div className="px-5 py-3 border-t border-gray-100 flex-shrink-0">
              <div className="flex justify-between text-base font-bold text-gray-900">
                <span>{t('total')}</span>
                <span>{cartTotal.toLocaleString()} {currency}</span>
              </div>
            </div>

            {!orderingMore && (
              <div className="px-5 pb-2 flex-shrink-0">
                <p className="text-xs font-medium text-gray-500 mb-2">{t('payment_method')}</p>
                <div className="flex gap-2">
                  <button onClick={() => setPaymentMethod('cash')} className={`flex-1 py-2 text-xs font-semibold rounded-xl border-2 transition-colors ${paymentMethod === 'cash' ? 'border-teal-500 bg-teal-50 text-teal-700' : 'border-gray-200 text-gray-500 hover:border-gray-300'}`}>{t('pay_cash')}</button>
                  {table?.qrImageBase64 && (
                    <button onClick={() => setPaymentMethod('qr')} className={`flex-1 py-2 text-xs font-semibold rounded-xl border-2 transition-colors ${paymentMethod === 'qr' ? 'border-teal-500 bg-teal-50 text-teal-700' : 'border-gray-200 text-gray-500 hover:border-gray-300'}`}>{t('pay_qr')}</button>
                  )}
                </div>
              </div>
            )}

            <div className="px-5 pb-8 pt-2 flex-shrink-0 border-t border-gray-100">
              <button onClick={handleSubmit} disabled={submitting || !cart.length} className="w-full bg-teal-600 hover:bg-teal-700 text-white font-semibold py-3.5 rounded-xl disabled:opacity-50">
                {submitting
                  ? (orderingMore ? t('adding') : t('placing'))
                  : (orderingMore ? t('add_to_order', cartTotal, currency) : t('place_order', cartTotal, currency))}
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  )
}

// ── Menu item list ─────────────────────────────────────────────────────────────
function MenuItemList({ items, getQty, addItem, removeItem, trFn, outOfStockLabel = 'Out of stock' }) {
  const tr = trFn || (x => x)
  return (
    <div className="space-y-3">
      {items.map(item => {
        const qty        = getQty(item.id)
        const outOfStock = item.isAvailable === false || (item.stockQuantity !== null && item.stockQuantity !== undefined && item.stockQuantity <= 0)

        return (
          <div key={item.id} className={`bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden flex ${outOfStock ? 'opacity-60' : ''}`}>
            {/* Image column */}
            <div className="w-24 flex-shrink-0 self-stretch bg-gray-100 overflow-hidden relative" style={{ minHeight: '88px' }}>
              {item.imageUrl ? (
                <img src={item.imageUrl} alt={item.name} className="w-full h-full object-cover"
                  onError={e => { e.currentTarget.style.display = 'none'; e.currentTarget.nextSibling.style.display = 'flex' }}
                />
              ) : null}
              <div className="w-full h-full flex-col items-center justify-center gap-1 text-center px-2" style={{ display: item.imageUrl ? 'none' : 'flex' }}>
                <ImageOff size={18} className="text-gray-300" />
                <p className="text-[9px] text-gray-300 leading-tight">No image</p>
              </div>
              {/* Promotion badge */}
              {item.isPromotion && !outOfStock && (
                <span className="absolute top-1.5 left-1.5 bg-rose-500 text-white text-[9px] font-bold px-1.5 py-0.5 rounded-full leading-none shadow-sm z-10">
                  {item.promotionLabel || 'PROMO'}
                </span>
              )}
              {/* Out of stock overlay */}
              {outOfStock && (
                <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                  <span className="bg-red-500 text-white text-[9px] font-bold px-1.5 py-0.5 rounded text-center leading-tight">{outOfStockLabel}</span>
                </div>
              )}
            </div>

            <div className="flex flex-1 items-start justify-between gap-3 p-3 min-w-0">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1 flex-wrap">
                  <p className="font-semibold text-gray-900 text-sm">{tr(item.name)}</p>
                </div>
                {item.description && <p className="text-xs text-gray-400 mt-0.5 line-clamp-2">{tr(item.description)}</p>}
                <p className="text-sm font-bold text-teal-600 mt-1.5">{item.price.toLocaleString()}</p>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0 pt-0.5">
                {qty > 0 && !outOfStock && (
                  <>
                    <button onClick={() => removeItem(item.id)} className="w-7 h-7 rounded-full bg-teal-50 text-teal-600 flex items-center justify-center hover:bg-teal-100"><Minus size={12} /></button>
                    <span className="w-4 text-center text-sm font-bold text-gray-900">{qty}</span>
                  </>
                )}
                <button
                  onClick={() => !outOfStock && addItem(item)}
                  disabled={outOfStock}
                  className={`w-7 h-7 rounded-full flex items-center justify-center shadow-sm ${outOfStock ? 'bg-gray-200 text-gray-400 cursor-not-allowed' : 'bg-teal-600 text-white hover:bg-teal-700'}`}
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
