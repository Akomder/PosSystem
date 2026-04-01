require('dotenv').config()
const express    = require('express')
const cors       = require('cors')
const helmet     = require('helmet')
const morgan     = require('morgan')
const { errorHandler } = require('./middleware/errorHandler')
const restaurantScope  = require('./middleware/restaurantScope')

const app = express()

// ─── security & logging ───────────────────────────────────────────────────────
app.use(helmet())
app.use(cors({
  origin: process.env.CLIENT_URL || 'http://localhost:5173',
  credentials: true,
}))
app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'))

// ─── body parsing ─────────────────────────────────────────────────────────────
app.use(express.json())
app.use(express.urlencoded({ extended: false }))

// ─── routes ───────────────────────────────────────────────────────────────────
// Public routes — no auth, must come before protected routes
app.use('/api/public',      require('./routes/public'))

// Auth (no restaurant scope needed)
app.use('/api/auth',        require('./routes/auth'))

// Email — password reset (public) + test/config (superadmin)
app.use('/api/email',       require('./routes/email'))

// Super Admin routes (cross-restaurant, own auth check inside)
app.use('/api/superadmin',  require('./routes/superadmin'))

// Restaurant-scoped routes — restaurantScope middleware sets req.restaurantId
app.use('/api/tables',    restaurantScope, require('./routes/tables'))
app.use('/api/menu',      restaurantScope, require('./routes/menu'))
app.use('/api/staff',     restaurantScope, require('./routes/staff'))
app.use('/api/orders',    restaurantScope, require('./routes/orders'))
app.use('/api/stats',     restaurantScope, require('./routes/stats'))
app.use('/api/customers', restaurantScope, require('./routes/customers'))
app.use('/api/suppliers', restaurantScope, require('./routes/suppliers'))
app.use('/api/cashflow',  restaurantScope, require('./routes/cashflow'))
app.use('/api/returns',   restaurantScope, require('./routes/returns'))

// ─── health check ─────────────────────────────────────────────────────────────
app.get('/health', (_req, res) => res.json({ status: 'ok', time: new Date() }))

// ─── 404 ──────────────────────────────────────────────────────────────────────
app.use((_req, res) => res.status(404).json({ error: 'Not found' }))

// ─── global error handler ─────────────────────────────────────────────────────
app.use(errorHandler)

module.exports = app
