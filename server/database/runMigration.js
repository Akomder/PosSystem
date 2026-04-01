require('dotenv').config()
const fs   = require('fs')
const path = require('path')
const { pool } = require('../src/config/db')
const bcrypt   = require('bcryptjs')

async function run() {
  const sql = fs.readFileSync(
    path.join(__dirname, 'migration_multitenancy.sql'),
    'utf8'
  )

  console.log('Running multi-tenancy migration…')
  await pool.query(sql)
  console.log('✅  Schema migration complete.')

  // Create SuperAdmin user if not exists
  const existing = await pool.query(
    `SELECT id FROM users WHERE role = 'SuperAdmin' LIMIT 1`
  )
  if (!existing.rows.length) {
    const hash = await bcrypt.hash('superadmin123', 10)
    await pool.query(
      `INSERT INTO users (email, password_hash, role, restaurant_id)
       VALUES ('superadmin@pos.com', $1, 'SuperAdmin', NULL)`,
      [hash]
    )
    console.log('✅  SuperAdmin user created.')
    console.log('    Email   : superadmin@pos.com')
    console.log('    Password: superadmin123')
  } else {
    console.log('ℹ️   SuperAdmin user already exists.')
  }

  await pool.end()
  console.log('Migration finished.')
}

run().catch(err => {
  console.error('Migration failed:', err.message)
  process.exit(1)
})
