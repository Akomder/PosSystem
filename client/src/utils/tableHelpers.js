// Schema status values: 'Available' | 'Occupied' | 'Reserved'
export function getTableStatusVariant(status) {
  const map = {
    'Available': 'available',
    'Occupied':  'occupied',
    'Reserved':  'reserved',
  }
  return map[status] || 'available'
}

export function getTableBorderColor(status) {
  const map = {
    'Available': '#22c55e',
    'Occupied':  '#ef4444',
    'Reserved':  '#f59e0b',
  }
  return map[status] || '#6b7280'
}

export function getTableBgColor(status) {
  const map = {
    'Available': '#f0fdf4',
    'Occupied':  '#fef2f2',
    'Reserved':  '#fffbeb',
  }
  return map[status] || '#f9fafb'
}

export function getOccupancyStats(tables) {
  const available = tables.filter((t) => t.status === 'Available').length
  const occupied  = tables.filter((t) => t.status === 'Occupied').length
  const reserved  = tables.filter((t) => t.status === 'Reserved').length
  return { available, occupied, reserved, total: tables.length }
}

export function getPlaceholderColor(id) {
  const colors = [
    '#EEF2FF', '#FFF7ED', '#F0FDF4', '#FFF1F2',
    '#F0F9FF', '#FDF4FF', '#FFFBEB', '#F7FEE7',
  ]
  const num = parseInt(id.replace(/\D/g, ''), 10) || 0
  return colors[num % colors.length]
}

export function getPlaceholderTextColor(id) {
  const colors = [
    '#4F46E5', '#EA580C', '#16A34A', '#E11D48',
    '#0284C7', '#A21CAF', '#D97706', '#65A30D',
  ]
  const num = parseInt(id.replace(/\D/g, ''), 10) || 0
  return colors[num % colors.length]
}
