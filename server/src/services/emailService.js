/**
 * emailService.js
 * Nodemailer-based email service with:
 *  - Auto Ethereal test account when SMTP_HOST is not configured (dev)
 *  - Real SMTP / Gmail in production
 *  - Beautiful HTML templates for every email type
 */

const nodemailer = require('nodemailer')

// ─── Transporter singleton ────────────────────────────────────────────────────
let _transporter = null
let _previewBase = null   // Ethereal URL prefix for dev preview

async function getTransporter() {
  if (_transporter) return _transporter

  if (process.env.SMTP_HOST) {
    // ── Real SMTP ──────────────────────────────────────────────────────────
    _transporter = nodemailer.createTransport({
      host:   process.env.SMTP_HOST,
      port:   parseInt(process.env.SMTP_PORT  || '587', 10),
      secure: process.env.SMTP_SECURE === 'true',
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    })
    console.log(`📧 SMTP connected → ${process.env.SMTP_HOST}:${process.env.SMTP_PORT}`)
  } else {
    // ── Ethereal (dev fake inbox) ──────────────────────────────────────────
    const testAccount = await nodemailer.createTestAccount()
    _transporter = nodemailer.createTransport({
      host:   'smtp.ethereal.email',
      port:   587,
      secure: false,
      auth: {
        user: testAccount.user,
        pass: testAccount.pass,
      },
    })
    _previewBase = 'https://ethereal.email'
    console.log(`📧 Ethereal test inbox: ${testAccount.user} / ${testAccount.pass}`)
    console.log(`   Preview sent emails at: ${_previewBase}`)
  }

  return _transporter
}

// ─── From header ─────────────────────────────────────────────────────────────
function fromAddress() {
  const name    = process.env.EMAIL_FROM_NAME    || 'POS System'
  const address = process.env.EMAIL_FROM_ADDRESS || 'noreply@pos.system'
  return `"${name}" <${address}>`
}

// ─── Core send function ───────────────────────────────────────────────────────
async function sendMail({ to, subject, html, text }) {
  const transport = await getTransporter()
  const info = await transport.sendMail({
    from:    fromAddress(),
    to,
    subject,
    text:    text || subject,
    html,
  })

  // In dev, log the preview URL
  const previewUrl = nodemailer.getTestMessageUrl(info)
  if (previewUrl) {
    console.log(`📬 Email preview: ${previewUrl}`)
    info.previewUrl = previewUrl
  }
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
      infoRow('SMTP Host', process.env.SMTP_HOST || 'Ethereal (dev)'),
      infoRow('From',     process.env.EMAIL_FROM_ADDRESS || 'noreply@pos.system'),
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
  sendTestEmail,
}
