const router  = require('express').Router()
const { body } = require('express-validator')
const {
  getAllStaff, getStaffMember, createStaff, updateStaff, deleteStaff,
} = require('../controllers/staffController')
const authenticate = require('../middleware/auth')
const requireRole  = require('../middleware/authorize')

router.use(authenticate)

router.get('/',    requireRole('Admin'), getAllStaff)
router.get('/:id', requireRole('Admin'), getStaffMember)

router.post(
  '/',
  requireRole('Admin'),
  [
    body('name').notEmpty().withMessage('Name required'),
    body('role').isIn(['Admin','Waiter','Cashier','Chef']).withMessage('Invalid role'),
    body('email').isEmail().withMessage('Valid email required'),
  ],
  createStaff
)

router.put(
  '/:id',
  requireRole('Admin'),
  [
    body('name').optional().notEmpty().withMessage('Name cannot be empty'),
    body('role').optional().isIn(['Admin','Waiter','Cashier','Chef']).withMessage('Invalid role'),
    body('status').optional().isIn(['active','inactive','on-leave']),
    body('tablesAssigned').optional().isArray(),
  ],
  updateStaff
)

router.delete('/:id', requireRole('Admin'), deleteStaff)

module.exports = router
