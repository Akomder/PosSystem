const { validationResult } = require('express-validator')

/**
 * Express-validator helper — call this at the START of each controller
 * to short-circuit with 422 if validation failed.
 */
function checkValidation(req, res) {
  const errors = validationResult(req)
  if (!errors.isEmpty()) {
    res.status(422).json({ errors: errors.array() })
    return false
  }
  return true
}

/**
 * Central 4-argument Express error handler.
 * Must be registered LAST in app.js via app.use(errorHandler).
 */
function errorHandler(err, req, res, next) {
  // PostgreSQL unique-constraint violation
  if (err.code === '23505') {
    return res.status(409).json({ error: 'Duplicate entry', detail: err.detail })
  }
  // PostgreSQL foreign-key violation
  if (err.code === '23503') {
    return res.status(400).json({ error: 'Referenced record not found', detail: err.detail })
  }
  // PostgreSQL check-constraint violation
  if (err.code === '23514') {
    return res.status(400).json({ error: 'Value violates a check constraint', detail: err.detail })
  }
  // JWT errors
  if (err.name === 'JsonWebTokenError' || err.name === 'TokenExpiredError') {
    return res.status(401).json({ error: 'Invalid or expired token' })
  }

  // Generic
  console.error('[ErrorHandler]', err)
  const status  = err.status || err.statusCode || 500
  const message = process.env.NODE_ENV === 'production'
    ? 'Internal server error'
    : err.message
  res.status(status).json({ error: message })
}

module.exports = { errorHandler, checkValidation }
