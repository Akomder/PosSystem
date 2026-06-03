const router = require('express').Router()
const { body } = require('express-validator')
const {
  getAll, getOne, create, update,
  getTransactions, chargeOrder, recordPayment,
} = require('../controllers/houseAccountsController')
const authenticate = require('../middleware/auth')
const requireRole  = require('../middleware/authorize')

router.use(authenticate)

router.get('/',    requireRole('Admin', 'Cashier'), getAll)
router.get('/:id', requireRole('Admin', 'Cashier'), getOne)

router.post(
  '/',
  requireRole('Admin'),
  [
    body('customerId').isInt({ min: 1 }).withMessage('Valid customer required'),
    body('creditLimit').optional().isFloat({ min: 0 }),
  ],
  create
)

router.put(
  '/:id',
  requireRole('Admin'),
  [
    body('creditLimit').optional().isFloat({ min: 0 }),
    body('status').optional().isIn(['active', 'suspended', 'closed']),
  ],
  update
)

router.get('/:id/transactions', requireRole('Admin', 'Cashier'), getTransactions)

router.post(
  '/:id/charge',
  requireRole('Admin', 'Cashier'),
  [
    body('amount').isFloat({ gt: 0 }).withMessage('Amount must be positive'),
  ],
  chargeOrder
)

router.post(
  '/:id/payment',
  requireRole('Admin', 'Cashier'),
  [
    body('amount').isFloat({ gt: 0 }).withMessage('Amount must be positive'),
  ],
  recordPayment
)

module.exports = router
