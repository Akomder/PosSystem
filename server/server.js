require('dotenv').config()
const http           = require('http')
const fs             = require('fs')
const path           = require('path')
const app            = require('./src/app')
const { initSocket } = require('./src/config/socket')
const { pool, testConnection } = require('./src/config/db')

const PORT      = process.env.PORT || 3001
const POSDB_SQL = path.join(__dirname, 'database', 'posdb.sql')

/** Apply posdb.sql on every startup — all statements use IF NOT EXISTS so it is idempotent. */
async function applySchema() {
  const sql = fs.readFileSync(POSDB_SQL, 'utf8')
  await pool.query(sql)
  console.log('✅ Schema applied (posdb.sql)')
}

async function start() {
  // 1. Verify database connection
  await testConnection()

  // 2. Apply / migrate schema (safe to run on every boot)
  await applySchema()

  // 3. Create HTTP server and attach Socket.IO
  const httpServer = http.createServer(app)
  initSocket(httpServer)

  // 4. Listen
  httpServer.listen(PORT, () => {
    console.log(`\n🚀  POS API running on http://localhost:${PORT}`)
    console.log(`   Health:  http://localhost:${PORT}/health`)
    console.log(`   Socket:  ws://localhost:${PORT}  (room: "pos")\n`)
  })
}

start().catch(err => {
  console.error('Failed to start server:', err.message)
  process.exit(1)
})
