import { Users, QrCode } from 'lucide-react'
import clsx from 'clsx'
import Badge from '../ui/Badge'
import { getTableBorderColor, getTableBgColor, getTableStatusVariant } from '../../utils/tableHelpers'

export default function TableCard({ table, onClick, isSelected, onQRClick }) {
  return (
    <div
      onClick={() => onClick(table)}
      className={clsx(
        'relative rounded-xl border-2 p-4 cursor-pointer transition-all duration-200',
        'hover:shadow-md',
        isSelected ? 'ring-2 ring-indigo-500 ring-offset-2' : '',
      )}
      style={{
        borderColor:     getTableBorderColor(table.status),
        backgroundColor: getTableBgColor(table.status),
      }}
    >
      {/* Table number */}
      <div className="flex items-start justify-between mb-2">
        <span className="text-2xl font-black text-gray-800">{table.tableNumber}</span>
        <div className="flex items-center gap-1">
          <button
            onClick={(e) => { e.stopPropagation(); onQRClick(table) }}
            title="Show QR Code"
            className="p-1 text-gray-400 hover:text-indigo-600 hover:bg-white/60 rounded-md transition-colors"
          >
            <QrCode size={13} />
          </button>
          <Badge variant={getTableStatusVariant(table.status)}>
            {table.status.charAt(0).toUpperCase() + table.status.slice(1)}
          </Badge>
        </div>
      </div>

      {/* Capacity */}
      <div className="flex items-center gap-1 text-xs text-gray-500 mb-1">
        <Users size={11} />
        <span>{table.capacity} seats</span>
      </div>

      {/* Waiter / section */}
      {table.status === 'Occupied' && table.waiter ? (
        <p className="text-xs font-medium text-gray-700 truncate">{table.waiter}</p>
      ) : (
        <p className="text-xs text-gray-400">{table.section || 'Main Hall'}</p>
      )}

      {/* Order chip */}
      {table.currentOrderId && (
        <div className="mt-2 inline-flex items-center px-2 py-0.5 bg-white rounded-full border border-gray-200 text-xs font-medium text-gray-600">
          {table.currentOrderId}
        </div>
      )}
    </div>
  )
}
