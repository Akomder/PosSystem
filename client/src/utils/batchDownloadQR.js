import QRCode from 'qrcode'
import JSZip from 'jszip'

export async function batchDownloadQRCodes(tables, origin) {
  if (!tables || tables.length === 0) return

  const zip = new JSZip()

  await Promise.all(
    tables.map(async (table) => {
      const url = `${origin}/order/${table.id}`
      const canvas = document.createElement('canvas')
      await QRCode.toCanvas(canvas, url, { width: 512, margin: 2, errorCorrectionLevel: 'M' })

      const jpgDataUrl = canvas.toDataURL('image/jpeg', 0.95)
      const base64 = jpgDataUrl.split(',')[1]
      zip.file(`QR-Table-${table.tableNumber}.jpg`, base64, { base64: true })
    })
  )

  const blob = await zip.generateAsync({ type: 'blob' })
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = 'table-qr-codes.zip'
  a.click()
  URL.revokeObjectURL(a.href)
}
