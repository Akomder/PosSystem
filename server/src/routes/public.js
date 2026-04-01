const router  = require('express').Router()
const { body } = require('express-validator')
const { getPublicTable, getPublicMenu, createPublicOrder } = require('../controllers/publicController')

// No authentication on any of these routes

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

module.exports = router
