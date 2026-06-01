import QRCode from 'qrcode'
import JSZip from 'jszip'

async function generateQRCard(table, restaurantName, origin) {
  const url = `${origin}/order/${table.id}`

  const qrCanvas = document.createElement('canvas')
  await QRCode.toCanvas(qrCanvas, url, {
    width: 400,
    margin: 1,
    errorCorrectionLevel: 'M',
    color: { dark: '#0f172a', light: '#ffffff' },
  })

  const W = 520
  const H = 800
  const card = document.createElement('canvas')
  card.width = W
  card.height = H
  const ctx = card.getContext('2d')

  // White background
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, W, H)

  // Top teal gradient bar
  const grad = ctx.createLinearGradient(0, 0, W, 0)
  grad.addColorStop(0, '#0d9488')
  grad.addColorStop(1, '#14b8a6')
  ctx.fillStyle = grad
  ctx.fillRect(0, 0, W, 10)

  // ── "SCAN TO ORDER" heading ──────────────────────────────
  const headY = 80
  ctx.textBaseline = 'middle'
  ctx.font = 'bold 44px "Segoe UI", system-ui, sans-serif'

  const scanText = 'SCAN '
  const toOrderText = 'TO ORDER'
  const scanW = ctx.measureText(scanText).width
  const toOrderW = ctx.measureText(toOrderText).width
  const totalW = scanW + toOrderW
  const startX = (W - totalW) / 2

  ctx.textAlign = 'left'
  ctx.fillStyle = '#0f172a'
  ctx.fillText(scanText, startX, headY)

  ctx.fillStyle = '#0d9488'
  ctx.fillText(toOrderText, startX + scanW, headY)

  // Teal underline under "TO ORDER"
  ctx.strokeStyle = '#14b8a6'
  ctx.lineWidth = 4
  ctx.lineCap = 'round'
  ctx.beginPath()
  ctx.moveTo(startX + scanW, headY + 26)
  ctx.lineTo(startX + totalW, headY + 26)
  ctx.stroke()

  // ── Restaurant name ──────────────────────────────────────
  ctx.textAlign = 'center'
  ctx.fillStyle = '#64748b'
  ctx.font = '500 20px "Segoe UI", system-ui, sans-serif'
  ctx.fillText(restaurantName || 'Restaurant', W / 2, headY + 58)

  // ── Hairline divider ─────────────────────────────────────
  const div1Y = headY + 90
  ctx.strokeStyle = '#e2e8f0'
  ctx.lineWidth = 1
  ctx.beginPath()
  ctx.moveTo(40, div1Y)
  ctx.lineTo(W - 40, div1Y)
  ctx.stroke()

  // ── QR code card ─────────────────────────────────────────
  const qrSize = 340
  const qrX = (W - qrSize) / 2
  const qrY = div1Y + 30
  const pad = 22
  const r = 18

  // Drop shadow
  ctx.shadowColor = 'rgba(15,23,42,0.10)'
  ctx.shadowBlur = 24
  ctx.shadowOffsetY = 6
  ctx.fillStyle = '#ffffff'
  roundRect(ctx, qrX - pad, qrY - pad, qrSize + pad * 2, qrSize + pad * 2, r)
  ctx.fill()
  ctx.shadowColor = 'transparent'
  ctx.shadowBlur = 0
  ctx.shadowOffsetY = 0

  // Border
  ctx.strokeStyle = '#e2e8f0'
  ctx.lineWidth = 1
  roundRect(ctx, qrX - pad, qrY - pad, qrSize + pad * 2, qrSize + pad * 2, r)
  ctx.stroke()

  // QR image
  ctx.drawImage(qrCanvas, qrX, qrY, qrSize, qrSize)

  // ── Table number ─────────────────────────────────────────
  const tableY = qrY + qrSize + 68
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.font = 'bold 38px "Segoe UI", system-ui, sans-serif'
  ctx.fillStyle = '#0d9488'
  ctx.fillText(`Table ${table.tableNumber}`, W / 2, tableY)

  // ── Bottom divider ────────────────────────────────────────
  const div2Y = tableY + 46
  ctx.strokeStyle = '#f1f5f9'
  ctx.lineWidth = 1
  ctx.beginPath()
  ctx.moveTo(80, div2Y)
  ctx.lineTo(W - 80, div2Y)
  ctx.stroke()

  // ── "Powered by ERROR POS" ────────────────────────────────
  ctx.fillStyle = '#94a3b8'
  ctx.font = '13px "Segoe UI", system-ui, sans-serif'
  ctx.fillText('Powered by', W / 2, div2Y + 28)

  ctx.fillStyle = '#0d9488'
  ctx.font = 'bold 17px "Segoe UI", system-ui, sans-serif'
  ctx.letterSpacing = '1px'
  ctx.fillText('ERROR POS', W / 2, div2Y + 52)

  // Bottom accent bar
  ctx.fillStyle = grad
  ctx.fillRect(0, H - 6, W, 6)

  return card
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.lineTo(x + w - r, y)
  ctx.quadraticCurveTo(x + w, y, x + w, y + r)
  ctx.lineTo(x + w, y + h - r)
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h)
  ctx.lineTo(x + r, y + h)
  ctx.quadraticCurveTo(x, y + h, x, y + h - r)
  ctx.lineTo(x, y + r)
  ctx.quadraticCurveTo(x, y, x + r, y)
  ctx.closePath()
}

export async function generateSingleQRCard(table, restaurantName, origin) {
  return generateQRCard(table, restaurantName, origin)
}

export async function batchDownloadQRCodes(tables, origin, restaurantName) {
  if (!tables || tables.length === 0) return

  const zip = new JSZip()

  await Promise.all(
    tables.map(async (table) => {
      const card = await generateQRCard(table, restaurantName, origin)
      const jpgDataUrl = card.toDataURL('image/jpeg', 0.95)
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
