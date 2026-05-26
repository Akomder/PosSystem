require('dotenv').config()
const { Pool } = require('pg')

// ─── Connection config ────────────────────────────────────────────────────────
// Railway PostgreSQL addon auto-injects DATABASE_URL as a connection string.
// Individual DB_* vars are still supported for local dev / manual config.
const poolConfig = process.env.DATABASE_URL
  ? {
      connectionString: process.env.DATABASE_URL,
      // Railway / Supabase / Neon all require SSL; rejectUnauthorized: false
      // accepts self-signed certs used by managed Postgres services.
      ssl: { rejectUnauthorized: false },
      max:                     10,
      idleTimeoutMillis:       30000,
      connectionTimeoutMillis: 5000,
    }
  : {
      host:     process.env.DB_HOST     || 'localhost',
      port:     parseInt(process.env.DB_PORT) || 5432,
      user:     process.env.DB_USER     || 'posuser',
      password: process.env.DB_PASSWORD || 'pospassword',
      database: process.env.DB_NAME     || 'posdb',
      // Set DB_SSL=true in production when connecting to cloud-hosted PostgreSQL
      ssl:      process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false,
      max:                     10,
      idleTimeoutMillis:       30000,
      connectionTimeoutMillis: 5000,
    }

const pool = new Pool(poolConfig)

pool.on('error', (err) => {
  console.error('Unexpected pg pool error:', err.message)
})

/**
 * Execute a parameterised query.
 * @param {string} text  SQL text with $1, $2 … placeholders
 * @param {any[]}  params
 */
async function query(text, params) {
  const start = Date.now()
  const result = await pool.query(text, params)
  if (process.env.NODE_ENV === 'development') {
    const ms = Date.now() - start
    if (ms > 500) console.warn(`[DB SLOW] ${ms}ms — ${text.slice(0, 80)}`)
  }
  return result
}

async function testConnection() {
  try {
    const res = await pool.query('SELECT NOW() AS now')
    console.log(`✅ PostgreSQL connected — ${res.rows[0].now}`)
  } catch (err) {
    console.error('❌ PostgreSQL connection failed:', err.message)
    process.exit(1)
  }
}

module.exports = { pool, query, testConnection }
