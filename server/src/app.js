require('dotenv').config()
const express    = require('express')
const cors       = require('cors')
const helmet     = require('helmet')
const morgan     = require('morgan')
const rateLimit  = require('express-rate-limit')
const { errorHandler } = require('./middleware/errorHandler')
const authenticate     = require('./middleware/auth')          // verifyToken
const restaurantScope  = require('./middleware/restaurantScope')
const auditMiddleware  = require('./middleware/auditMiddleware')

// ─── Startup guards ───────────────────────────────────────────────────────────
if (process.env.NODE_ENV === 'production') {
  if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) {
    throw new Error('FATAL: JWT_SECRET must be set and at least 32 characters in production')
  }
  if (!process.env.CLIENT_ORIGIN) {
    // Warn only — on first Railway deploy the URL isn't known yet.
    // Set CLIENT_ORIGIN to your Railway URL after the first deploy, then redeploy.
    console.warn('[WARN] CLIENT_ORIGIN not set — CORS and Socket.IO may reject browser requests. Set it to your Railway URL.')
  }
}

const app = express()

// ─── Security & logging ───────────────────────────────────────────────────────
app.use(helmet())
app.use(cors({
  // .env uses CLIENT_ORIGIN; fall back to dev default
  origin: process.env.CLIENT_ORIGIN || process.env.CLIENT_URL || 'http://localhost:5173',
  credentials: true,
}))
app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'))

// ─── Rate limiting ─────────────────────────────────────────────────────────────
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max:      10,              // 10 attempts per IP per window
  standardHeaders: true,
  legacyHeaders:   false,
  message: { error: 'Too many attempts. Please try again in 15 minutes.' },
})
const emailLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max:      5,               // 5 forgot-password requests per IP per hour
  standardHeaders: true,
  legacyHeaders:   false,
  message: { error: 'Too many password reset requests. Please try again in 1 hour.' },
})

// ─── Body parsing ─────────────────────────────────────────────────────────────
app.use(express.json())
app.use(express.urlencoded({ extended: false }))

// ─── Cache-Control: prevent browsers/proxies from caching API responses ───────
// All /api/* responses contain sensitive POS data (orders, auth tokens, staff).
// Setting no-store ensures nothing is written to cache — satisfies security scanners.
app.use('/api', (_req, res, next) => {
  res.set('Cache-Control', 'no-store, max-age=0')
  next()
})

// ─── Public routes (no auth required) ────────────────────────────────────────
app.use('/api/public',              require('./routes/public'))
app.use('/api/auth',   authLimiter, require('./routes/auth'))
app.use('/api/email',  emailLimiter, require('./routes/email'))

// ─── Super Admin routes (auth handled inside the router) ──────────────────────
app.use('/api/superadmin', require('./routes/superadmin'))

// ─── Protected + restaurant-scoped routes ────────────────────────────────────
//
//  IMPORTANT: authenticate MUST run before restaurantScope so that
//  req.user is populated when restaurantScope reads req.user.restaurantId.
//  Without this, restaurantScope sets req.restaurantId = null for every
//  request and all scoped DB queries return zero results.
//
const scoped = [authenticate, restaurantScope, auditMiddleware]

app.use('/api/tables',           ...scoped, require('./routes/tables'))
app.use('/api/menu',             ...scoped, require('./routes/menu'))
app.use('/api/staff',            ...scoped, require('./routes/staff'))
app.use('/api/orders',           ...scoped, require('./routes/orders'))
app.use('/api/stats',            ...scoped, require('./routes/stats'))
app.use('/api/customers',        ...scoped, require('./routes/customers'))
app.use('/api/suppliers',        ...scoped, require('./routes/suppliers'))
app.use('/api/cashflow',         ...scoped, require('./routes/cashflow'))
app.use('/api/returns',          ...scoped, require('./routes/returns'))

// ─── Keivi feature routes ─────────────────────────────────────────────────────
app.use('/api/zones',            ...scoped, require('./routes/zones'))
app.use('/api/sales-channels',   ...scoped, require('./routes/salesChannels'))
app.use('/api/shifts',           ...scoped, require('./routes/shifts'))
app.use('/api/stock-takes',      ...scoped, require('./routes/stockTakes'))
app.use('/api/price-books',      ...scoped, require('./routes/priceBooks'))
app.use('/api/purchase-orders',  ...scoped, require('./routes/purchaseOrders'))
app.use('/api/purchase-returns', ...scoped, require('./routes/purchaseReturns'))
app.use('/api/damage-records',   ...scoped, require('./routes/damageRecords'))
app.use('/api/settings',         ...scoped, require('./routes/settings'))
app.use('/api/promotions',       ...scoped, require('./routes/promotions'))
app.use('/api/audit-logs',       ...scoped, require('./routes/auditLogs'))
app.use('/api/modifiers',        ...scoped, require('./routes/modifiers'))
app.use('/api/print',            ...scoped, require('./routes/print'))
app.use('/api/notifications',    ...scoped, require('./routes/notifications'))
app.use('/api/debts',            ...scoped, require('./routes/debts'))
app.use('/api/deals',            ...scoped, require('./routes/deals'))
app.use('/api/consumptions',     ...scoped, require('./routes/consumptions'))
app.use('/api/reservations',     ...scoped, require('./routes/reservations'))

// ─── Health check ─────────────────────────────────────────────────────────────
app.get('/health', (_req, res) => res.json({ status: 'ok', time: new Date() }))

// ─── Serve React frontend in production ───────────────────────────────────────
// The client is built into client/dist by Railway's buildCommand before start.
// Relative /api paths work perfectly — same origin, no CORS needed.
if (process.env.NODE_ENV === 'production') {
  const path     = require('path')
  const distPath = path.join(__dirname, '../../client/dist')
  app.use(express.static(distPath))
  // SPA fallback — React Router handles all non-API client routes
  // Express 5 requires named wildcards: '/{*path}' instead of bare '*'
  // index.html must not be cached — it contains the JS bundle URLs which change on each deploy
  app.get('/{*path}', (_req, res) => {
    res.set('Cache-Control', 'no-store, max-age=0')
    res.sendFile(path.join(distPath, 'index.html'))
  })
} else {
  // ─── 404 (dev only — production falls through to SPA) ─────────────────────
  app.use((_req, res) => res.status(404).json({ error: 'Not found' }))
}

// ─── Global error handler ─────────────────────────────────────────────────────
app.use(errorHandler)

module.exports = app
