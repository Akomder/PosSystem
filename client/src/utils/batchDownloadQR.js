import { renderToStaticMarkup } from 'react-dom/server'
import { createElement } from 'react'
import { QRCodeSVG } from 'qrcode.react'
import JSZip from 'jszip'

/**
 * Generates QR SVG strings for all tables and downloads them as a ZIP.
 * @param {Array} tables - array of table objects with { id, tableNumber }
 * @param {string} origin - window.location.origin
 */
export async function batchDownloadQRCodes(tables, origin) {
  if (!tables.length) return

  const zip = new JSZip()
  const folder = zip.folder('QR-Codes')

  for (const table of tables) {
    const url = `${origin}/order/${table.id}`
    const svgElement = createElement(QRCodeSVG, {
      value: url,
      size: 300,
      level: 'M',
      includeMargin: true,
    })
    const svgString = '<?xml version="1.0" encoding="UTF-8"?>\n' + renderToStaticMarkup(svgElement)
    folder.file(`Table-${table.tableNumber}.svg`, svgString)
  }

  const blob = await zip.generateAsync({ type: 'blob' })
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = 'QR-Code-Tables.zip'
  a.click()
  URL.revokeObjectURL(a.href)
}
