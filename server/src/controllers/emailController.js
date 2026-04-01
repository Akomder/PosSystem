/**
 * emailController.js
 * Handles:
 *  - POST /api/email/forgot-password   → send reset link
 *  - POST /api/email/reset-password    → validate token + change password
 *  - POST /api/email/test              → SuperAdmin: send test email
 *  - GET  /api/email/config            → SuperAdmin: get current SMTP config status
 */

const crypto  = require('crypto')
const bcrypt   = require('bcryptjs')
const { query } = require('../config/db')
const emailService = require('../services/emailService')

const RESET_EXPIRES_MIN = 30   // minutes

// ─── POST /api/email/forgot-password ─────────────────────────────────────────
async function forgotPassword(req, res, next) {
  const { email } = req.body
  if (!email) return res.status(400).json({ error: 'Email is required' })

  try {
    // Look up user — always return 200 to prevent email enumeration
    const { rows } = await query(
      'SELECT id, email FROM users WHERE email = $1',
      [email.toLowerCase().trim()]
    )

    if (rows.length) {
      const user  = rows[0]
      const token = crypto.randomBytes(48).toString('hex')
      const expiresAt = new Date(Date.now() + RESET_EXPIRES_MIN * 60 * 1000)

      // Invalidate any existing tokens for this user
      await query(
        'UPDATE password_reset_tokens SET used = true WHERE user_id = $1 AND used = false',
        [user.id]
      )

      // Insert new token
      await query(
        `INSERT INTO password_reset_tokens (user_id, token, expires_at)
         VALUES ($1, $2, $3)`,
        [user.id, token, expiresAt]
      )

      const resetUrl = `${process.env.APP_URL || 'http://localhost:5173'}/reset-password?token=${token}`

      // Get name from staff profile if exists
      const staffRes = await query(
        'SELECT name FROM staff WHERE user_id = $1 LIMIT 1',
        [user.id]
      )
      const name = staffRes.rows[0]?.name || user.email

      const info = await emailService.sendPasswordReset({
        to:             user.email,
        name,
        resetUrl,
        expiresMinutes: RESET_EXPIRES_MIN,
      })

      // In dev, return preview URL so devs can see the email
      const response = { message: 'If that email exists, a reset link has been sent.' }
      if (info.previewUrl) response.previewUrl = info.previewUrl
      return res.json(response)
    }

    // User not found — return same generic response
    res.json({ message: 'If that email exists, a reset link has been sent.' })
  } catch (err) {
    next(err)
  }
}

// ─── POST /api/email/reset-password ──────────────────────────────────────────
async function resetPassword(req, res, next) {
  const { token, password } = req.body
  if (!token || !password) {
    return res.status(400).json({ error: 'token and password are required' })
  }
  if (password.length < 6) {
    return res.status(400).json({ error: 'Password must be at least 6 characters' })
  }

  try {
    // Validate token
    const { rows } = await query(
      `SELECT prt.id, prt.user_id, prt.expires_at, prt.used
       FROM password_reset_tokens prt
       WHERE prt.token = $1`,
      [token]
    )

    if (!rows.length) {
      return res.status(400).json({ error: 'Invalid or expired reset link.' })
    }

    const row = rows[0]

    if (row.used) {
      return res.status(400).json({ error: 'This reset link has already been used.' })
    }

    if (new Date(row.expires_at) < new Date()) {
      return res.status(400).json({ error: 'This reset link has expired. Please request a new one.' })
    }

    // Update password
    const hash = await bcrypt.hash(password, 10)
    await query(
      'UPDATE users SET password_hash = $1, updated_at = NOW() WHERE id = $2',
      [hash, row.user_id]
    )

    // Mark token as used
    await query(
      'UPDATE password_reset_tokens SET used = true WHERE id = $1',
      [row.id]
    )

    res.json({ message: 'Password updated successfully. You can now sign in.' })
  } catch (err) {
    next(err)
  }
}

// ─── GET /api/email/config ────────────────────────────────────────────────────
async function getEmailConfig(req, res) {
  const configured = !!process.env.SMTP_HOST
  res.json({
    configured,
    mode:      configured ? 'smtp' : 'ethereal',
    host:      process.env.SMTP_HOST     || '(Ethereal — dev only)',
    port:      process.env.SMTP_PORT     || '587',
    secure:    process.env.SMTP_SECURE   || 'false',
    user:      process.env.SMTP_USER     || '',
    fromName:  process.env.EMAIL_FROM_NAME    || 'POS System',
    fromEmail: process.env.EMAIL_FROM_ADDRESS || 'noreply@pos.system',
    appUrl:    process.env.APP_URL       || 'http://localhost:5173',
  })
}

// ─── POST /api/email/test ─────────────────────────────────────────────────────
async function testEmail(req, res, next) {
  const { to } = req.body
  if (!to) return res.status(400).json({ error: '"to" email address is required' })

  try {
    const info = await emailService.sendTestEmail({ to })
    res.json({
      success:    true,
      message:    `Test email sent to ${to}`,
      messageId:  info.messageId,
      previewUrl: info.previewUrl || null,
    })
  } catch (err) {
    next(err)
  }
}

// ─── GET /api/email/validate-token ───────────────────────────────────────────
async function validateResetToken(req, res, next) {
  const { token } = req.query
  if (!token) return res.status(400).json({ error: 'token is required' })

  try {
    const { rows } = await query(
      `SELECT id, expires_at, used FROM password_reset_tokens WHERE token = $1`,
      [token]
    )
    if (!rows.length || rows[0].used || new Date(rows[0].expires_at) < new Date()) {
      return res.json({ valid: false })
    }
    res.json({ valid: true })
  } catch (err) {
    next(err)
  }
}

module.exports = {
  forgotPassword,
  resetPassword,
  getEmailConfig,
  testEmail,
  validateResetToken,
}
