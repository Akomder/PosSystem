const router     = require('express').Router()
const authenticate = require('../middleware/auth')
const {
  forgotPassword,
  resetPassword,
  getEmailConfig,
  testEmail,
  validateResetToken,
} = require('../controllers/emailController')

// ── Public (no auth) ──────────────────────────────────────────────────────────
router.post('/forgot-password',    forgotPassword)
router.post('/reset-password',     resetPassword)
router.get ('/validate-token',     validateResetToken)

// ── SuperAdmin only ───────────────────────────────────────────────────────────
function requireSuperAdmin(req, res, next) {
  if (req.user?.role !== 'SuperAdmin') {
    return res.status(403).json({ error: 'SuperAdmin access required' })
  }
  next()
}

router.get ('/config', authenticate, requireSuperAdmin, getEmailConfig)
router.post('/test',   authenticate, requireSuperAdmin, testEmail)

module.exports = router
