const router  = require('express').Router()
const { body } = require('express-validator')
const {
  getAllTables, getTable, updateStatus, assignWaiter, updateTable,
} = require('../controllers/tablesController')
const authenticate  = require('../middleware/auth')
const requireRole   = require('../middleware/authorize')

router.use(authenticate)

router.get('/',    getAllTables)
router.get('/:id', getTable)

router.patch(
  '/:id/status',
  requireRole('Admin','Waiter','Cashier'),
  [body('status').isIn(['Available','Occupied','Reserved'])
    .withMessage('Invalid status')],
  updateStatus
)

router.patch(
  '/:id/assign',
  requireRole('Admin'),
  [body('waiter').optional({ nullable: true }).isString()],
  assignWaiter
)

router.put(
  '/:id',
  requireRole('Admin'),
  [
    body('capacity').optional().isInt({ min: 1 }),
    body('section').optional().isString(),
    body('notes').optional().isString(),
  ],
  updateTable
)

module.exports = router
