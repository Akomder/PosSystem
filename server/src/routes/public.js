const router  = require('express').Router()
const { body } = require('express-validator')
const { getPublicRestaurant, getPublicTable, getPublicMenu, createPublicOrder, cancelPublicOrder, getPublicOrder } = require('../controllers/publicController')

// No authentication on any of these routes

// Tenant login — resolve slug → restaurant name + branding
router.get('/restaurant/:slug', getPublicRestaurant)

router.get('/tables/:id', getPublicTable)

router.get('/menu', getPublicMenu)

router.post(
  '/orders',
  [
    body('tableId').notEmpty().withMessage('tableId is required'),
    body('items').isArray({ min: 1 }).withMessage('At least one item required'),
    body('items.*.menuItemId').isInt({ min: 1 }).withMessage('Each item needs a valid menuItemId'),
    body('items.*.quantity').isInt({ min: 1 }).withMessage('Each item needs quantity >= 1'),
  ],
  createPublicOrder
)

// Fetch an order (customer-facing, no auth — orderId + tableId proves ownership)
router.get('/orders/:id', getPublicOrder)

// Cancel a Pending order — customer self-service, no auth token required.
// Security: orderId (URL) + tableId (body) together prove ownership.
router.patch(
  '/orders/:id/cancel',
  [body('tableId').notEmpty().withMessage('tableId is required')],
  cancelPublicOrder
)

module.exports = router
