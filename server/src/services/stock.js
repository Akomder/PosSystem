// Shared inventory deduction used by order creation and employee consumption.
// Keeps the two stock fields in sync (per product decision):
//   - stock_quantity : NUMERIC, the source of truth deducted on every sale
//   - stock          : legacy INTEGER read by stock-takes
// Both are decremented together so stock-takes stay accurate.

/**
 * Deduct stock for a list of items within an existing transaction.
 * @param {import('pg').PoolClient} client  an active client inside a BEGIN/COMMIT
 * @param {number} rid                       restaurant id
 * @param {Array<{menuItemId:number, quantity:number}>} items
 * @returns {Promise<Array>} low-stock items (at/below threshold, for alerting)
 */
async function deductStock(client, rid, items) {
  const lowStockItems = []
  for (const item of items) {
    const qty = item.quantity
    const deductRes = await client.query(
      `UPDATE menu_items
         SET stock_quantity = stock_quantity - $1,
             stock          = GREATEST(0, COALESCE(stock, 0) - $1)
       WHERE id = $2 AND restaurant_id = $3
         AND stock_quantity IS NOT NULL
       RETURNING id, name, stock_quantity, low_stock_threshold`,
      [qty, item.menuItemId, rid]
    )
    if (!deductRes.rows.length) continue
    const m = deductRes.rows[0]
    // Auto-mark unavailable when stock hits zero or below
    if (parseFloat(m.stock_quantity) <= 0) {
      await client.query(
        `UPDATE menu_items SET available = FALSE, stock_quantity = 0 WHERE id = $1`,
        [m.id]
      )
    }
    if (parseFloat(m.stock_quantity) <= parseFloat(m.low_stock_threshold)) {
      lowStockItems.push({
        id:                m.id,
        name:              m.name,
        stockQuantity:     parseFloat(m.stock_quantity),
        lowStockThreshold: parseFloat(m.low_stock_threshold),
      })
    }
  }
  return lowStockItems
}

module.exports = { deductStock }
