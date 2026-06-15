const router = require('express').Router()
const { body } = require('express-validator')
const { getAll, create } = require('../controllers/consumptionController')
const authenticate = require('../middleware/auth')
const requireRole  = require('../middleware/authorize')

router.use(authenticate)

router.get('/', getAll)
router.post(
  '/',
  requireRole('Admin', 'Cashier'),
  [
    body('staffId').notEmpty().withMessage('staffId required'),
    body('items').isArray({ min: 1 }).withMessage('items required'),
  ],
  create
)

module.exports = router
