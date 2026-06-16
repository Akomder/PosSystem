const router = require('express').Router()
const { body } = require('express-validator')
const { getAll, getUpcoming, create, update, seat, cancel } = require('../controllers/reservationsController')
const authenticate = require('../middleware/auth')
const requireRole  = require('../middleware/authorize')

router.use(authenticate)

router.get('/',          getAll)
router.get('/upcoming',  getUpcoming)

router.post(
  '/',
  requireRole('Admin','Cashier','Waiter'),
  [
    body('guestName').notEmpty().withMessage('guestName required'),
    body('reservedAt').notEmpty().withMessage('reservedAt required'),
    body('partySize').optional().isInt({ min: 1 }),
  ],
  create
)

router.patch('/:id',        requireRole('Admin','Cashier','Waiter'), update)
router.patch('/:id/seat',   requireRole('Admin','Cashier','Waiter'),
  [body('tableId').notEmpty()], seat)
router.patch('/:id/cancel', requireRole('Admin','Cashier','Waiter'), cancel)

module.exports = router
