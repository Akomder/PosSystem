require('dotenv').config()
const http           = require('http')
const app            = require('./src/app')
const { initSocket } = require('./src/config/socket')
const { testConnection } = require('./src/config/db')

const PORT = process.env.PORT || 4000

async function start() {
  // 1. Verify database connection
  await testConnection()

  // 2. Create HTTP server and attach Socket.IO
  const httpServer = http.createServer(app)
  initSocket(httpServer)

  // 3. Listen
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
