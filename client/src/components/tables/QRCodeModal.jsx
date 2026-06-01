import { QRCodeCanvas } from 'qrcode.react'
import { Download } from 'lucide-react'
import Modal from '../ui/Modal'
import Button from '../ui/Button'

export default function QRCodeModal({ isOpen, onClose, table }) {
  if (!table) return null

  const orderUrl = `${window.location.origin}/order/${table.id}`

  const handleDownload = () => {
    const canvas = document.getElementById('table-qr-canvas')
    if (!canvas) return
    const jpgDataUrl = canvas.toDataURL('image/jpeg', 0.95)
    const a = document.createElement('a')
    a.download = `QR-Table-${table.tableNumber}.jpg`
    a.href = jpgDataUrl
    a.click()
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`QR Code — Table ${table.tableNumber}`}
      size="sm"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>Close</Button>
          <Button variant="primary" icon={Download} onClick={handleDownload}>Download JPG</Button>
        </>
      }
    >
      <div className="flex flex-col items-center gap-4 py-2">
        <div className="p-4 bg-white border border-gray-100 rounded-xl shadow-inner">
          <QRCodeCanvas
            id="table-qr-canvas"
            value={orderUrl}
            size={220}
            level="M"
            includeMargin
          />
        </div>
        <p className="text-sm text-gray-600 text-center">
          Scan to order from <span className="font-semibold">Table {table.tableNumber}</span>
        </p>
        <p className="text-xs text-gray-400 text-center break-all">{orderUrl}</p>
      </div>
    </Modal>
  )
}
