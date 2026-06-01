import { renderToStaticMarkup } from 'react-dom/server'
import { createElement } from 'react'
import { QRCodeSVG } from 'qrcode.react'
import JSZip from 'jszip'

const SIZE = 400

function svgToPng(svgString) {
  return new Promise((resolve, reject) => {
    // Use data: URL instead of blob: URL to satisfy CSP img-src 'self' data:
    const bytes = new TextEncoder().encode(svgString)
    let binary = ''
    bytes.forEach(b => { binary += String.fromCharCode(b) })
    const dataUrl = `data:image/svg+xml;base64,${btoa(binary)}`
    const img = new Image()
    img.onload = () => {
      const canvas = document.createElement('canvas')
      canvas.width = SIZE
      canvas.height = SIZE
      const ctx = canvas.getContext('2d')
      ctx.fillStyle = '#ffffff'
      ctx.fillRect(0, 0, SIZE, SIZE)
      ctx.drawImage(img, 0, 0, SIZE, SIZE)
      resolve(canvas.toDataURL('image/png').split(',')[1])
    }
    img.onerror = reject
    img.src = dataUrl
  })
}

export async function batchDownloadQRCodes(tables, origin) {
  if (!tables.length) return

  const zip = new JSZip()
  const folder = zip.folder('QR-Codes')

  for (const table of tables) {
    const url = `${origin}/order/${table.id}`
    const svgString = renderToStaticMarkup(
      createElement(QRCodeSVG, { value: url, size: SIZE, level: 'M', includeMargin: true })
    )
    const pngBase64 = await svgToPng(svgString)
    folder.file(`Table-${table.tableNumber}.png`, pngBase64, { base64: true })
  }

  const blob = await zip.generateAsync({ type: 'blob' })
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = 'QR-Code-Tables.zip'
  a.click()
  URL.revokeObjectURL(a.href)
}
