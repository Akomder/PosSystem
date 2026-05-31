/**
 * emailService.js
 * Nodemailer-based email service with:
 *  - DB-persisted SMTP config (system_settings table), falls back to .env
 *  - Auto Ethereal test account when SMTP_HOST is not configured (dev)
 *  - Real SMTP / Gmail in production
 *  - Beautiful HTML templates for every email type
 */

const nodemailer = require('nodemailer')

// ─── Transporter singleton ────────────────────────────────────────────────────
let _transporter = null
let _dbConfig    = null   // Cached config from system_settings

/** Load SMTP config from DB (system_settings), returns null if not configured there */
async function loadDbConfig() {
  try {
    const { query } = require('../config/db')
    const { rows } = await query(
      `SELECT key, value FROM system_settings WHERE key LIKE 'smtp.%' OR key LIKE 'email.%'`
    )
    if (!rows.length) return null
    const cfg = {}
    rows.forEach(r => { cfg[r.key] = r.value })
    // Only consider DB config valid if smtp.host is set there
    if (!cfg['smtp.host']) return null
    return cfg
  } catch {
    return null
  }
}

/** Return merged config: DB values take priority over .env */
async function getConfig() {
  const db = await loadDbConfig()
  if (db) return {
    host:      db['smtp.host'],
    port:      parseInt(db['smtp.port']   || '587', 10),
    secure:    db['smtp.secure'] === 'true',
    user:      db['smtp.user']   || '',
    pass:      db['smtp.pass']   || '',
    fromName:  db['email.fromName']  || process.env.EMAIL_FROM_NAME    || 'POS System',
    fromEmail: db['email.fromEmail'] || process.env.EMAIL_FROM_ADDRESS || 'noreply@pos.system',
    source:    'db',
  }
  if (process.env.SMTP_HOST) return {
    host:      process.env.SMTP_HOST,
    port:      parseInt(process.env.SMTP_PORT || '587', 10),
    secure:    process.env.SMTP_SECURE === 'true',
    user:      process.env.SMTP_USER || '',
    pass:      process.env.SMTP_PASS || '',
    fromName:  process.env.EMAIL_FROM_NAME    || 'POS System',
    fromEmail: process.env.EMAIL_FROM_ADDRESS || 'noreply@pos.system',
    source:    'env',
  }
  return null
}

async function getTransporter() {
  if (_transporter) return _transporter

  const cfg = await getConfig()

  if (!cfg) {
    throw new Error('SMTP is not configured. Go to SuperAdmin → Email Settings to set up your SMTP provider.')
  }
  _transporter = nodemailer.createTransport({
    host:   cfg.host,
    port:   cfg.port,
    secure: cfg.secure,
    auth: { user: cfg.user, pass: cfg.pass },
  })

  return _transporter
}

/** Call after updating system_settings to rebuild the transporter */
async function reloadConfig() {
  _transporter = null
  _dbConfig    = null
  // Don't eagerly reconnect — next send will reconnect with new config
}

// ─── From header ─────────────────────────────────────────────────────────────
async function fromAddress() {
  const cfg = await getConfig()
  const name    = cfg?.fromName  || process.env.EMAIL_FROM_NAME    || 'POS System'
  const address = cfg?.fromEmail || process.env.EMAIL_FROM_ADDRESS || 'noreply@pos.system'
  return `"${name}" <${address}>`
}

// ─── Core send function ───────────────────────────────────────────────────────
async function sendMail({ to, subject, html, text }) {
  const transport = await getTransporter()
  const info = await transport.sendMail({
    from:    await fromAddress(),
    to,
    subject,
    text:    text || subject,
    html,
  })

  return info
}

// ─────────────────────────────────────────────────────────────────────────────
// HTML Template System
// ─────────────────────────────────────────────────────────────────────────────

/** Wraps content in a branded email shell */
function baseTemplate({ title, preheader, body, ctaLabel, ctaUrl, footer }) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${title}</title>
</head>
<body style="margin:0;padding:0;background:#f4f4f7;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <!-- preheader (hidden preview text) -->
  <div style="display:none;max-height:0;overflow:hidden;mso-hide:all;">${preheader || title}</div>

  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f7;">
    <tr><td align="center" style="padding:40px 16px;">

      <!-- Card -->
      <table width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:16px;box-shadow:0 4px 24px rgba(0,0,0,0.08);overflow:hidden;">

        <!-- Header bar -->
        <tr>
          <td style="background:linear-gradient(135deg,#6d28d9 0%,#4f46e5 100%);padding:32px 40px;">
            <table width="100%" cellpadding="0" cellspacing="0">
              <tr>
                <td>
                  <div style="display:inline-flex;align-items:center;gap:10px;">
                    <span style="display:inline-block;width:36px;height:36px;background:rgba(255,255,255,0.2);border-radius:10px;text-align:center;line-height:36px;font-size:18px;">🍽️</span>
                    <span style="font-size:18px;font-weight:700;color:#ffffff;letter-spacing:-0.3px;">POS System</span>
                  </div>
                </td>
              </tr>
            </table>
          </td>
        </tr>

        <!-- Body -->
        <tr>
          <td style="padding:40px;">
            <h1 style="margin:0 0 8px;font-size:22px;font-weight:700;color:#111827;letter-spacing:-0.5px;">${title}</h1>
            ${body}

            ${ctaLabel && ctaUrl ? `
            <!-- CTA Button -->
            <table cellpadding="0" cellspacing="0" style="margin:32px 0;">
              <tr>
                <td style="border-radius:12px;background:linear-gradient(135deg,#6d28d9,#4f46e5);">
                  <a href="${ctaUrl}" style="display:inline-block;padding:14px 32px;color:#ffffff;text-decoration:none;font-size:15px;font-weight:600;border-radius:12px;">${ctaLabel}</a>
                </td>
              </tr>
            </table>
            <p style="margin:0;font-size:12px;color:#9ca3af;">
              Or copy this link into your browser:<br/>
              <span style="color:#6d28d9;word-break:break-all;">${ctaUrl}</span>
            </p>` : ''}
          </td>
        </tr>

        <!-- Footer -->
        <tr>
          <td style="background:#f9fafb;border-top:1px solid #f3f4f6;padding:24px 40px;">
            <p style="margin:0;font-size:12px;color:#9ca3af;line-height:1.6;">
              ${footer || 'This email was sent by POS System. If you did not request this, you can safely ignore it.'}
            </p>
          </td>
        </tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`
}

/** Reusable info-row block */
function infoRow(label, value) {
  return `<tr>
    <td style="padding:8px 16px;font-size:13px;color:#6b7280;font-weight:500;white-space:nowrap;vertical-align:top;">${label}</td>
    <td style="padding:8px 16px;font-size:13px;color:#111827;word-break:break-word;">${value}</td>
  </tr>`
}

/** Wraps rows in a info table */
function infoTable(rows) {
  return `<table cellpadding="0" cellspacing="0" width="100%"
    style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:12px;overflow:hidden;margin:20px 0;">
    ${rows}
  </table>`
}

// ─────────────────────────────────────────────────────────────────────────────
// Named send functions
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Send password-reset email
 * @param {{ to: string, name: string, resetUrl: string, expiresMinutes: number }} opts
 */
async function sendPasswordReset({ to, name, resetUrl, expiresMinutes = 30 }) {
  const body = `
    <p style="margin:0 0 16px;font-size:15px;color:#374151;line-height:1.6;">
      Hi <strong>${name}</strong>,<br/>
      We received a request to reset your password. Click the button below — the link is valid for <strong>${expiresMinutes} minutes</strong>.
    </p>
    <p style="margin:16px 0 0;font-size:13px;color:#6b7280;">
      If you did not request a password reset, you can ignore this email. Your password will not change.
    </p>`

  return sendMail({
    to,
    subject: 'Reset your POS System password',
    html: baseTemplate({
      title:      'Password Reset Request',
      preheader:  'Click to reset your POS System password',
      body,
      ctaLabel:   'Reset My Password',
      ctaUrl:     resetUrl,
      footer:     `This link expires in ${expiresMinutes} minutes. If you did not request this, please contact your administrator.`,
    }),
  })
}

/**
 * Send staff welcome email with credentials
 * @param {{ to: string, name: string, role: string, password: string, restaurantName: string, loginUrl: string }} opts
 */
async function sendStaffWelcome({ to, name, role, password, restaurantName, loginUrl }) {
  const body = `
    <p style="margin:0 0 20px;font-size:15px;color:#374151;line-height:1.6;">
      Welcome to the team! Your account for <strong>${restaurantName}</strong> has been created. Here are your login credentials:
    </p>
    ${infoTable([
      infoRow('Name',       name),
      infoRow('Email',      to),
      infoRow('Password',   `<code style="background:#f3f4f6;padding:2px 6px;border-radius:4px;font-family:monospace;">${password}</code>`),
      infoRow('Role',       role),
      infoRow('Restaurant', restaurantName),
    ])}
    <p style="margin:16px 0 0;font-size:13px;color:#ef4444;">
      ⚠️ Please change your password after your first login for security.
    </p>`

  return sendMail({
    to,
    subject: `Welcome to ${restaurantName} — Your account is ready`,
    html: baseTemplate({
      title:      `Welcome, ${name}! 👋`,
      preheader:  `Your POS account for ${restaurantName} is ready`,
      body,
      ctaLabel:   'Sign In Now',
      ctaUrl:     loginUrl,
      footer:     `You are receiving this because an admin created an account for you at ${restaurantName}.`,
    }),
  })
}

/**
 * Send restaurant-created confirmation email to restaurant admin
 * @param {{ to: string, adminName: string, restaurantName: string, plan: string, password: string, loginUrl: string }} opts
 */
async function sendRestaurantWelcome({ to, adminName, restaurantName, plan, password, loginUrl }) {
  const body = `
    <p style="margin:0 0 20px;font-size:15px;color:#374151;line-height:1.6;">
      Congratulations! Your restaurant has been set up on POS System. Here are your details:
    </p>
    ${infoTable([
      infoRow('Restaurant', restaurantName),
      infoRow('Plan',       `<span style="text-transform:capitalize">${plan}</span>`),
      infoRow('Admin Email', to),
      infoRow('Password',   `<code style="background:#f3f4f6;padding:2px 6px;border-radius:4px;font-family:monospace;">${password}</code>`),
    ])}
    <p style="margin:16px 0 0;font-size:13px;color:#6b7280;line-height:1.6;">
      You now have full access to manage your menu, staff, tables, orders, and reports. Log in to get started.
    </p>`

  return sendMail({
    to,
    subject: `${restaurantName} is live on POS System 🎉`,
    html: baseTemplate({
      title:      `${restaurantName} is ready! 🎉`,
      preheader:  `Your restaurant is live — sign in to get started`,
      body,
      ctaLabel:   'Open POS Dashboard',
      ctaUrl:     loginUrl,
      footer:     `This email was sent because a Super Admin created your restaurant account on POS System.`,
    }),
  })
}

/**
 * Send EOD shift summary email to restaurant admin(s)
 * @param {{ to: string|string[], restaurantName: string, shift: object }} opts
 */
async function sendShiftSummary({ to, restaurantName, shift }) {
  const fmt = (n) => new Intl.NumberFormat('lo-LA', { style: 'currency', currency: 'LAK', maximumFractionDigits: 0 }).format(n)
  const fmtDate = (d) => d ? new Date(d).toLocaleString('en', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—'

  const variance    = parseFloat(shift.cashVariance || 0)
  const varianceAbs = Math.abs(variance)
  const varianceOk  = varianceAbs <= 1000
  const varColour   = varianceOk ? '#22c55e' : '#ef4444'
  const varLabel    = variance >= 0 ? `+${fmt(varianceAbs)} surplus` : `-${fmt(varianceAbs)} shortage`
  const varIcon     = varianceOk ? '✅' : '⚠️'

  const body = `
    <p style="margin:0 0 20px;font-size:15px;color:#374151;line-height:1.6;">
      The shift at <strong>${restaurantName}</strong> has been closed. Here is the summary:
    </p>
    ${infoTable([
      infoRow('Opened',          fmtDate(shift.openedAt)),
      infoRow('Closed',          fmtDate(shift.closedAt)),
      infoRow('Opened By',       shift.openedBy  || '—'),
      infoRow('Closed By',       shift.closedBy  || '—'),
      infoRow('Total Orders',    shift.totalOrders),
      infoRow('Total Revenue',   fmt(shift.totalSales)),
      infoRow('Opening Cash',    fmt(shift.openingCash)),
      infoRow('Expected Closing', fmt(shift.expectedCash)),
      infoRow('Actual Closing',  fmt(shift.closingCash)),
      infoRow('Cash Variance',   `<span style="color:${varColour};font-weight:600;">${varIcon} ${varLabel}</span>`),
    ])}
    ${shift.notes ? `<p style="margin:16px 0 0;font-size:13px;color:#6b7280;"><strong>Notes:</strong> ${shift.notes}</p>` : ''}
    <p style="margin:16px 0 0;font-size:13px;color:#6b7280;">
      Log in to the POS dashboard to view the full report.
    </p>`

  return sendMail({
    to,
    subject: `Shift Closed — ${restaurantName} · ${fmt(shift.totalSales)} revenue`,
    html: baseTemplate({
      title:     `Shift Summary — ${restaurantName}`,
      preheader: `${shift.totalOrders} orders · ${fmt(shift.totalSales)} revenue · Cash variance: ${varLabel}`,
      body,
      footer:    `This summary was automatically sent when a shift was closed at ${restaurantName}.`,
    }),
  })
}

/**
 * Send a plain test email (for verifying SMTP config)
 * @param {{ to: string }} opts
 */
async function sendTestEmail({ to }) {
  const now = new Date().toLocaleString('en', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
  const body = `
    <p style="margin:0 0 16px;font-size:15px;color:#374151;line-height:1.6;">
      This is a test email sent from your POS System SMTP configuration.
    </p>
    ${infoTable([
      infoRow('Sent at',  now),
      infoRow('SMTP Host', process.env.SMTP_HOST || cfg?.host || 'Configured via Admin'),
      infoRow('To',       to),
    ])}
    <p style="margin:16px 0 0;font-size:13px;color:#22c55e;font-weight:600;">
      ✅ Your email configuration is working correctly!
    </p>`

  return sendMail({
    to,
    subject: '✅ POS System — SMTP Test Email',
    html: baseTemplate({
      title:     'SMTP Test Successful',
      preheader: 'Your POS System email configuration is working',
      body,
      footer:    'This test email was triggered from the Super Admin email settings panel.',
    }),
  })
}

module.exports = {
  sendMail,
  sendPasswordReset,
  sendStaffWelcome,
  sendRestaurantWelcome,
  sendShiftSummary,
  sendTestEmail,
  reloadConfig,
  getConfig,
}
