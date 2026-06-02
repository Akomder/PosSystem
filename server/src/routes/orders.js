const router  = require('express').Router()
const { body } = require('express-validator')
const {
  getAllOrders, getOrder, createOrder, updateStatus, updateOrder, markItemDone,
} = require('../controllers/ordersController')
const authenticate = require('../middleware/auth')
const requireRole  = require('../middleware/authorize')

router.use(authenticate)

router.get('/',    getAllOrders)
router.get('/:id', getOrder)

router.post(
  '/',
  requireRole('Admin','Waiter'),
  [
    body('tableId').optional({ nullable: true }).isInt({ min: 1 }).withMessage('tableId must be a positive integer'),
    body('items').isArray({ min: 1 }).withMessage('At least one item required'),
    body('items.*.menuItemId').isInt({ min: 1 }).withMessage('Each item needs a valid menuItemId'),
    body('items.*.quantity').isInt({ min: 1 }).withMessage('Each item needs quantity >= 1'),
  ],
  createOrder
)

router.patch(
  '/:id/status',
  requireRole('Admin','Waiter','Cashier','Chef'),
  [body('status').notEmpty().withMessage('status is required')],
  updateStatus
)

router.put(
  '/:id',
  requireRole('Admin','Waiter'),
  [
    body('items').isArray({ min: 1 }).withMessage('At least one item required'),
    body('items.*.menuItemId').isInt({ min: 1 }),
    body('items.*.quantity').isInt({ min: 1 }),
  ],
  updateOrder
)

// Mark a single item as done (kitchen bump)
router.patch('/:orderId/items/:itemId/done', requireRole('Admin','Waiter','Cashier','Chef'), markItemDone)

module.exports = router
