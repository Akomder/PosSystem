const router = require('express').Router()
const { body } = require('express-validator')
const authenticate = require('../middleware/auth')
const { getAll, getOne, create, update, remove, recordPayment } = require('../controllers/debtsController')

router.use(authenticate)

router.get('/',    getAll)
router.get('/:id', getOne)

router.post(
  '/',
  [
    body('amount').isNumeric().withMessage('amount must be numeric'),
  ],
  create
)

router.put(
  '/:id',
  [
    body('amount').optional().isNumeric().withMessage('amount must be numeric'),
  ],
  update
)

router.delete('/:id', remove)

router.post(
  '/:id/payment',
  [
    body('amount').isNumeric().withMessage('amount must be numeric'),
  ],
  recordPayment
)

module.exports = router
