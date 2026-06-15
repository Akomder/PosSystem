const router = require('express').Router()
const { body } = require('express-validator')
const { getAll, getCurrent, openShift, closeShift, getSummary } = require('../controllers/shiftsController')
const authenticate = require('../middleware/auth')
const requireRole  = require('../middleware/authorize')

router.use(authenticate)

router.get('/',         getAll)
router.get('/current',  getCurrent)
router.get('/:id/summary', getSummary)
router.post('/open',    requireRole('Admin','Cashier'),
  [body('openingCash').optional().isFloat({ min: 0 })],
  openShift
)
router.patch('/:id/close', requireRole('Admin','Cashier'), closeShift)

module.exports = router
