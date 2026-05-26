import { useEffect } from 'react'
import { AlertTriangle, X } from 'lucide-react'
import { useApp } from '../context/AppContext'

export default function StockLowToast() {
  const { stockAlerts, dismissStockAlert } = useApp()

  // Auto-dismiss each alert after 8 seconds
  useEffect(() => {
    if (!stockAlerts.length) return
    const latest = stockAlerts[stockAlerts.length - 1]
    const id = setTimeout(() => dismissStockAlert(latest._key), 8000)
    return () => clearTimeout(id)
  }, [stockAlerts, dismissStockAlert])

  if (!stockAlerts.length) return null

  return (
    <div className="fixed bottom-4 right-4 z-[9999] flex flex-col gap-2 pointer-events-none">
      {stockAlerts.map(alert => (
        <div
          key={alert._key}
          className="pointer-events-auto flex items-start gap-3 bg-amber-50 dark:bg-amber-900/30 border border-amber-300 dark:border-amber-600/50 text-amber-900 dark:text-amber-200 rounded-xl px-4 py-3 shadow-lg max-w-xs"
        >
          <AlertTriangle size={16} className="flex-shrink-0 mt-0.5 text-amber-500" />
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold">Low Stock Alert</p>
            <p className="text-xs text-amber-700 dark:text-amber-300 mt-0.5">
              <span className="font-medium">{alert.name}</span> — {alert.stockQuantity} units remaining
            </p>
          </div>
          <button
            onClick={() => dismissStockAlert(alert._key)}
            className="flex-shrink-0 text-amber-400 hover:text-amber-600 transition-colors"
          >
            <X size={13} />
          </button>
        </div>
      ))}
    </div>
  )
}
