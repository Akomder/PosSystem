const router  = require('express').Router()
const { body } = require('express-validator')
const {
  getAllTables, getTable, updateStatus, assignWaiter, updateTable,
  createTable, deleteTable,
} = require('../controllers/tablesController')
const authenticate  = require('../middleware/auth')
const requireRole   = require('../middleware/authorize')

router.use(authenticate)

router.get('/',    getAllTables)
router.get('/:id', getTable)

router.post(
  '/',
  requireRole('Admin'),
  [
    body('number').isInt({ min: 1 }).withMessage('Table number required'),
    body('capacity').optional().isInt({ min: 1 }),
    body('section').optional().isString(),
  ],
  createTable
)

router.delete('/:id', requireRole('Admin'), deleteTable)

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
