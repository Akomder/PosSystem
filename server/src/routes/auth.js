const router = require('express').Router()
const { body } = require('express-validator')
const { login, getMe, refresh } = require('../controllers/authController')
const authenticate = require('../middleware/auth')

router.post(
  '/login',
  [
    body('email').isEmail().withMessage('Valid email required'),
    body('password').notEmpty().withMessage('Password required'),
  ],
  login
)

router.get('/me', authenticate, getMe)

router.post(
  '/refresh',
  [body('refreshToken').notEmpty().withMessage('refreshToken required')],
  refresh
)

module.exports = router
