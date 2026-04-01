const router = require('express').Router()
const { body } = require('express-validator')
const authenticate = require('../middleware/auth')
const { getAll, create, updateStatus, remove } = require('../controllers/cashflowController')

router.use(authenticate)

router.get('/', getAll)

router.post(
  '/',
  [
    body('type').isIn(['income', 'expense']).withMessage('type must be income or expense'),
    body('amount').isNumeric().withMessage('amount must be numeric'),
  ],
  create
)

router.patch('/:id/status', updateStatus)

router.delete('/:id', remove)

module.exports = router
