export function calculateSubtotal(items) {
  return items.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0)
}

export function calculateTax(subtotal, rate = 0.08) {
  return Math.round(subtotal * rate * 100) / 100
}

export function calculateTotal(subtotal, tax) {
  return Math.round((subtotal + tax) * 100) / 100
}

// Schema status values: 'Pending' | 'In Progress' | 'Served' | 'Closed' | 'Cancelled'
export function getStatusVariant(status) {
  const map = {
    'Pending':     'pending',
    'In Progress': 'in-progress',
    'Served':      'served',
    'Closed':      'closed',
    'Cancelled':   'danger',
  }
  return map[status] || 'pending'
}

export const STATUS_LABELS = {
  'Pending':     'Pending',
  'In Progress': 'In Progress',
  'Served':      'Served',
  'Closed':      'Closed',
  'Cancelled':   'Cancelled',
}

// Cancelled is terminal — not in the progression flow
const STATUS_FLOW = ['Pending', 'In Progress', 'Served', 'Closed']

export function getNextStatus(currentStatus) {
  const idx = STATUS_FLOW.indexOf(currentStatus)
  if (idx === -1 || idx === STATUS_FLOW.length - 1) return null
  return STATUS_FLOW[idx + 1]
}

export function getNextStatusLabel(currentStatus) {
  const next = getNextStatus(currentStatus)
  if (!next) return null
  const labels = {
    'In Progress': 'Start Order',
    'Served':      'Mark as Served',
    'Closed':      'Close & Charge',
  }
  return labels[next] || next
}

export function sortOrders(orders) {
  const priority = { 'Pending': 0, 'In Progress': 1, 'Served': 2, 'Closed': 3 }
  return [...orders].sort((a, b) => {
    const p = (priority[a.status] ?? 9) - (priority[b.status] ?? 9)
    if (p !== 0) return p
    return new Date(b.createdAt) - new Date(a.createdAt)
  })
}
