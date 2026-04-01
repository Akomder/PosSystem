import { useState, useEffect } from 'react'
import { useParams } from 'react-router-dom'
import { ShoppingCart, Plus, Minus, X, ChefHat } from 'lucide-react'
import { publicApi } from '../services/api'

// ── Cart total helpers ────────────────────────────────────────────────────────
function cartTotal(cart) {
  const subtotal = cart.reduce((s, i) => s + i.price * i.quantity, 0)
  const tax      = Math.round(subtotal * 0.08 * 100) / 100
  const total    = Math.round((subtotal + tax) * 100) / 100
  return { subtotal, tax, total }
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function CustomerOrder() {
  const { tableId } = useParams()   // e.g. "T-01"

  const [table,        setTable]        = useState(null)
  const [menu,         setMenu]         = useState([])
  const [cart,         setCart]         = useState([])
  const [loading,      setLoading]      = useState(true)
  const [error,        setError]        = useState(null)
  const [cartOpen,     setCartOpen]     = useState(false)
  const [submitting,   setSubmitting]   = useState(false)
  const [confirmation, setConfirmation] = useState(null)  // { orderId }

  // ── Load table info + menu on mount ──────────────────────────────────────
  useEffect(() => {
    async function load() {
      try {
        const [tableData, menuData] = await Promise.all([
          publicApi.getTable(tableId),
          publicApi.getMenu(),
        ])
        setTable(tableData)
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
  const addItem = (item) => {
    setCart(prev => {
      const existing = prev.find(c => c.id === item.id)
      if (existing) return prev.map(c => c.id === item.id ? { ...c, quantity: c.quantity + 1 } : c)
      return [...prev, { id: item.id, name: item.name, price: item.price, quantity: 1 }]
    })
  }

  const removeItem = (itemId) => {
    setCart(prev => {
      const existing = prev.find(c => c.id === itemId)
      if (!existing) return prev
      if (existing.quantity === 1) return prev.filter(c => c.id !== itemId)
      return prev.map(c => c.id === itemId ? { ...c, quantity: c.quantity - 1 } : c)
    })
  }

  const clearItem = (itemId) => setCart(prev => prev.filter(c => c.id !== itemId))

  const getQty = (itemId) => cart.find(c => c.id === itemId)?.quantity || 0

  // ── Submit order ──────────────────────────────────────────────────────────
  const handleSubmit = async () => {
    if (!cart.length) return
    setSubmitting(true)
    try {
      const result = await publicApi.createOrder({
        tableId,
        items: cart.map(c => ({ menuItemId: c.id, quantity: c.quantity })),
      })
      setConfirmation({ orderId: result.id })
      setCart([])
      setCartOpen(false)
    } catch (err) {
      alert(err.message || 'Could not place order. Please ask a staff member.')
    } finally {
      setSubmitting(false)
    }
  }

  // ── Group menu by category ────────────────────────────────────────────────
  const grouped = menu.reduce((acc, item) => {
    if (!acc[item.category]) acc[item.category] = []
    acc[item.category].push(item)
    return acc
  }, {})

  const { subtotal, tax, total } = cartTotal(cart)
  const cartCount = cart.reduce((s, i) => s + i.quantity, 0)

  // ── Loading state ─────────────────────────────────────────────────────────
  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <p className="text-gray-400 text-sm">Loading menu…</p>
    </div>
  )

  // ── Error state ───────────────────────────────────────────────────────────
  if (error) return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-6">
      <div className="text-center">
        <p className="text-red-500 font-medium mb-1">Something went wrong</p>
        <p className="text-gray-400 text-sm">{error}</p>
      </div>
    </div>
  )

  // ── Confirmation screen ───────────────────────────────────────────────────
  if (confirmation) return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-6">
      <div className="text-center max-w-xs">
        <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <ChefHat size={28} className="text-green-600" />
        </div>
        <h1 className="text-xl font-bold text-gray-900 mb-1">Order Placed!</h1>
        <p className="text-sm text-gray-500 mb-3">
          Your order{' '}
          <span className="font-semibold text-indigo-600">{confirmation.orderId}</span>{' '}
          is being prepared.
        </p>
        <p className="text-xs text-gray-400">A staff member will be with you shortly.</p>
      </div>
    </div>
  )

  // ── Main menu page ────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="sticky top-0 z-20 bg-white border-b border-gray-100 px-4 py-3 flex items-center justify-between shadow-sm">
        <div>
          <p className="text-xs text-gray-400 leading-none">Table</p>
          <h1 className="text-lg font-bold text-gray-900 leading-tight">{table?.number}</h1>
        </div>
        <button
          onClick={() => setCartOpen(true)}
          className="relative p-2 text-indigo-600 hover:bg-indigo-50 rounded-xl transition-colors"
        >
          <ShoppingCart size={22} />
          {cartCount > 0 && (
            <span className="absolute -top-1 -right-1 w-5 h-5 bg-indigo-600 text-white text-xs font-bold rounded-full flex items-center justify-center">
              {cartCount}
            </span>
          )}
        </button>
      </header>

      {/* Menu */}
      <main className="px-4 py-4 pb-32 max-w-xl mx-auto">
        {Object.entries(grouped).map(([category, items]) => (
          <section key={category} className="mb-6">
            <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">
              {category}
            </h2>
            <div className="space-y-3">
              {items.map(item => {
                const qty = getQty(item.id)
                return (
                  <div
                    key={item.id}
                    className="bg-white rounded-xl p-4 border border-gray-100 flex items-start justify-between gap-3"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-gray-900 text-sm">{item.name}</p>
                      {item.description && (
                        <p className="text-xs text-gray-400 mt-0.5 line-clamp-2">{item.description}</p>
                      )}
                      <p className="text-sm font-semibold text-indigo-600 mt-1.5">
                        ${item.price.toFixed(2)}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0 pt-0.5">
                      {qty > 0 && (
                        <>
                          <button
                            onClick={() => removeItem(item.id)}
                            className="w-7 h-7 rounded-full bg-indigo-50 text-indigo-600 flex items-center justify-center hover:bg-indigo-100 transition-colors"
                          >
                            <Minus size={12} />
                          </button>
                          <span className="w-4 text-center text-sm font-semibold text-gray-900">{qty}</span>
                        </>
                      )}
                      <button
                        onClick={() => addItem(item)}
                        className="w-7 h-7 rounded-full bg-indigo-600 text-white flex items-center justify-center hover:bg-indigo-700 transition-colors"
                      >
                        <Plus size={12} />
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          </section>
        ))}
      </main>

      {/* Sticky bottom bar when cart has items */}
      {cartCount > 0 && (
        <div className="fixed bottom-0 left-0 right-0 z-10 p-4 max-w-xl mx-auto">
          <button
            onClick={() => setCartOpen(true)}
            className="w-full bg-indigo-600 text-white font-semibold py-3.5 rounded-xl flex items-center justify-between px-5 shadow-lg"
          >
            <span className="bg-indigo-500 text-white text-xs font-bold px-2 py-0.5 rounded-full">
              {cartCount}
            </span>
            <span>View Order</span>
            <span>${total.toFixed(2)}</span>
          </button>
        </div>
      )}

      {/* Cart slide-over */}
      {cartOpen && (
        <>
          <div
            className="fixed inset-0 bg-black/30 z-30"
            onClick={() => setCartOpen(false)}
          />
          <div className="fixed bottom-0 left-0 right-0 z-40 bg-white rounded-t-2xl shadow-xl max-w-xl mx-auto max-h-[80vh] flex flex-col">
            {/* Cart header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
              <h2 className="font-bold text-gray-900">Your Order</h2>
              <button
                onClick={() => setCartOpen(false)}
                className="p-1 text-gray-400 hover:text-gray-600"
              >
                <X size={18} />
              </button>
            </div>

            {/* Cart items */}
            <div className="flex-1 overflow-y-auto px-5 py-3 space-y-3">
              {cart.map(item => (
                <div key={item.id} className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2 flex-1 min-w-0">
                    <button
                      onClick={() => clearItem(item.id)}
                      className="text-gray-300 hover:text-red-400 flex-shrink-0"
                    >
                      <X size={14} />
                    </button>
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">{item.name}</p>
                      <p className="text-xs text-gray-400">${item.price.toFixed(2)} each</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <button
                      onClick={() => removeItem(item.id)}
                      className="w-6 h-6 rounded-full bg-gray-100 flex items-center justify-center hover:bg-gray-200"
                    >
                      <Minus size={10} />
                    </button>
                    <span className="w-5 text-center text-sm font-semibold">{item.quantity}</span>
                    <button
                      onClick={() => addItem(item)}
                      className="w-6 h-6 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center hover:bg-indigo-200"
                    >
                      <Plus size={10} />
                    </button>
                  </div>
                  <span className="text-sm font-semibold text-gray-900 w-14 text-right flex-shrink-0">
                    ${(item.price * item.quantity).toFixed(2)}
                  </span>
                </div>
              ))}
            </div>

            {/* Totals */}
            <div className="px-5 py-3 border-t border-gray-100 space-y-1.5">
              <div className="flex justify-between text-sm text-gray-500">
                <span>Subtotal</span>
                <span>${subtotal.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-sm text-gray-500">
                <span>Tax (8%)</span>
                <span>${tax.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-base font-bold text-gray-900 pt-1">
                <span>Total</span>
                <span>${total.toFixed(2)}</span>
              </div>
            </div>

            {/* Place order button */}
            <div className="px-5 pb-8 pt-2">
              <button
                onClick={handleSubmit}
                disabled={submitting || !cart.length}
                className="w-full bg-indigo-600 text-white font-semibold py-3.5 rounded-xl hover:bg-indigo-700 disabled:opacity-50 transition-colors"
              >
                {submitting ? 'Placing Order…' : `Place Order · $${total.toFixed(2)}`}
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
