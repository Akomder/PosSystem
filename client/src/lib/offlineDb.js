/**
 * offlineDb.js
 *
 * IndexedDB wrapper (using `idb`) for offline POS operations.
 *
 * Stores:
 *   offlineOrders  — orders queued while the device was offline
 *   menuCache      — last successful menu fetch
 *   tableCache     — last successful tables fetch
 */
import { openDB } from 'idb'

const DB_NAME    = 'pos-offline'
const DB_VERSION = 1

const STORE = {
  ORDERS: 'offlineOrders',
  MENU:   'menuCache',
  TABLES: 'tableCache',
}

let _db = null

async function getDb() {
  if (_db) return _db
  _db = await openDB(DB_NAME, DB_VERSION, {
    upgrade(db) {
      if (!db.objectStoreNames.contains(STORE.ORDERS)) {
        const s = db.createObjectStore(STORE.ORDERS, { keyPath: 'localId', autoIncrement: true })
        s.createIndex('by-synced', 'synced')
      }
      if (!db.objectStoreNames.contains(STORE.MENU)) {
        db.createObjectStore(STORE.MENU, { keyPath: 'key' })
      }
      if (!db.objectStoreNames.contains(STORE.TABLES)) {
        db.createObjectStore(STORE.TABLES, { keyPath: 'key' })
      }
    },
  })
  return _db
}

// ── Offline Order Queue ───────────────────────────────────────────────────────

/**
 * Save an order payload to the offline queue.
 * Returns the auto-generated localId so the caller can reference it.
 */
export async function queueOrder(payload) {
  const db = await getDb()
  return db.add(STORE.ORDERS, {
    payload,
    synced:    false,
    createdAt: new Date().toISOString(),
  })
}

/** Return all orders that have not yet been synced. */
export async function getPendingOrders() {
  const db  = await getDb()
  const all = await db.getAll(STORE.ORDERS)
  return all.filter(o => !o.synced)
}

/** How many orders are waiting to be synced. */
export async function getPendingCount() {
  const pending = await getPendingOrders()
  return pending.length
}

/** Mark a queued order as successfully synced (keeps the record for audit). */
export async function markSynced(localId) {
  const db     = await getDb()
  const record = await db.get(STORE.ORDERS, localId)
  if (record) await db.put(STORE.ORDERS, { ...record, synced: true })
}

/** Permanently remove a queued order record. */
export async function deleteOfflineOrder(localId) {
  const db = await getDb()
  await db.delete(STORE.ORDERS, localId)
}

// ── Menu Cache ────────────────────────────────────────────────────────────────

export async function cacheMenu(items) {
  const db = await getDb()
  await db.put(STORE.MENU, { key: 'menu', items, cachedAt: new Date().toISOString() })
}

export async function getCachedMenu() {
  const db     = await getDb()
  const record = await db.get(STORE.MENU, 'menu')
  return record?.items ?? null
}

// ── Table Cache ───────────────────────────────────────────────────────────────

export async function cacheTables(tables) {
  const db = await getDb()
  await db.put(STORE.TABLES, { key: 'tables', tables, cachedAt: new Date().toISOString() })
}

export async function getCachedTables() {
  const db     = await getDb()
  const record = await db.get(STORE.TABLES, 'tables')
  return record?.tables ?? null
}
