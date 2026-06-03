const router = require('express').Router()
const { body } = require('express-validator')
const {
  getAll, getOne, create, update,
  getTransactions, chargeOrder, manualCharge, recordPayment,
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
    // Either customerId (registered customer) OR debtorName (walk-in / owner's friend)
    body('customerId').optional().isInt({ min: 1 }).withMessage('Invalid customer ID'),
    body('debtorName').optional().notEmpty().withMessage('Debtor name cannot be empty'),
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
    body('debtorName').optional().notEmpty(),
  ],
  update
)

router.get('/:id/transactions', requireRole('Admin', 'Cashier'), getTransactions)

// Charge an order to this account (order_id + amount)
router.post(
  '/:id/charge',
  requireRole('Admin', 'Cashier'),
  [ body('amount').isFloat({ gt: 0 }).withMessage('Amount must be positive') ],
  chargeOrder
)

// Manual debt entry — no order needed (cash taken, goods on credit, etc.)
router.post(
  '/:id/manual-charge',
  requireRole('Admin', 'Cashier'),
  [
    body('amount').isFloat({ gt: 0 }).withMessage('Amount must be positive'),
    body('description').notEmpty().withMessage('Description is required for manual entries'),
  ],
  manualCharge
)

router.post(
  '/:id/payment',
  requireRole('Admin', 'Cashier'),
  [ body('amount').isFloat({ gt: 0 }).withMessage('Amount must be positive') ],
  recordPayment
)

module.exports = router
