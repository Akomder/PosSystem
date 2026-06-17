const router  = require('express').Router()
const { body } = require('express-validator')
const { getPublicRestaurant, getPublicTable, getPublicMenu, createPublicOrder, cancelPublicOrder, getPublicOrder, addItemsToPublicOrder, requestCheckout, createReturnRequest, callStaff, getPublicPromotions, submitRating } = require('../controllers/publicController')

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

// Add more items to an existing open order (running tab)
router.patch(
  '/orders/:id/add-items',
  [body('tableId').notEmpty(), body('items').isArray({ min: 1 })],
  addItemsToPublicOrder
)

// Customer requests the bill — alerts cashier immediately
router.post('/orders/:id/request-checkout', requestCheckout)

// Customer submits a return request for specific items (e.g. return 2 of 5 beers)
router.post(
  '/orders/:id/return-request',
  [
    body('tableId').notEmpty().withMessage('tableId is required'),
    body('reason').optional(),
    body('items').isArray({ min: 1 }).withMessage('At least one item required'),
    body('items.*.orderItemId').isInt({ min: 1 }).withMessage('Each item needs orderItemId'),
    body('items.*.quantity').isInt({ min: 1 }).withMessage('Each item needs quantity >= 1'),
  ],
  createReturnRequest
)

// Cancel a Pending order — customer self-service, no auth token required.
// Security: orderId (URL) + tableId (body) together prove ownership.
router.patch(
  '/orders/:id/cancel',
  [body('tableId').notEmpty().withMessage('tableId is required')],
  cancelPublicOrder
)

// Customer taps "Call Staff" for general assistance — alerts POS immediately
router.post('/tables/:tableId/call-staff', callStaff)

// Active promotions/discounts visible to customers
router.get('/promotions', getPublicPromotions)

// Customer submits a service rating after their meal
router.post(
  '/orders/:id/rating',
  [
    body('tableId').notEmpty().withMessage('tableId required'),
    body('rating').isInt({ min: 1, max: 5 }).withMessage('rating must be 1-5'),
    body('comment').optional(),
  ],
  submitRating
)

module.exports = router
