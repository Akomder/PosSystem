import { renderToStaticMarkup } from 'react-dom/server'
import { createElement } from 'react'
import { QRCodeSVG } from 'qrcode.react'
import JSZip from 'jszip'

const SIZE = 400

function svgToPng(svgString) {
  return new Promise((resolve, reject) => {
    const blob = new Blob([svgString], { type: 'image/svg+xml' })
    const url = URL.createObjectURL(blob)
    const img = new Image()
    img.onload = () => {
      const canvas = document.createElement('canvas')
      canvas.width = SIZE
      canvas.height = SIZE
      const ctx = canvas.getContext('2d')
      ctx.fillStyle = '#ffffff'
      ctx.fillRect(0, 0, SIZE, SIZE)
      ctx.drawImage(img, 0, 0, SIZE, SIZE)
      URL.revokeObjectURL(url)
      resolve(canvas.toDataURL('image/png').split(',')[1])
    }
    img.onerror = (e) => { URL.revokeObjectURL(url); reject(e) }
    img.src = url
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
