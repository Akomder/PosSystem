const router  = require('express').Router()
const { body } = require('express-validator')
const {
  getAllItems, getCategories, getItem,
  createItem, updateItem, toggleAvailability, deleteItem,
  createCategory, updateCategory, deleteCategory, reorderCategories,
} = require('../controllers/menuController')
const authenticate = require('../middleware/auth')
const requireRole  = require('../middleware/authorize')

router.use(authenticate)

router.get('/',            getAllItems)
router.get('/categories',  getCategories)

// Category management (Admin only)
router.post('/categories',          requireRole('Admin'), createCategory)
router.put('/categories/:id',       requireRole('Admin'), updateCategory)
router.delete('/categories/:id',    requireRole('Admin'), deleteCategory)
router.patch('/categories/reorder', requireRole('Admin'), reorderCategories)

router.get('/:id',         getItem)

router.post(
  '/',
  requireRole('Admin'),
  [
    body('name').notEmpty().withMessage('Name is required'),
    body('category').notEmpty().withMessage('Category is required'),
    body('price').isFloat({ min: 0 }).withMessage('Price must be a positive number'),
  ],
  createItem
)

router.put(
  '/:id',
  requireRole('Admin'),
  [
    body('price').optional().isFloat({ min: 0 }),
    body('stock').optional().isInt({ min: 0 }),
  ],
  updateItem
)

router.patch('/:id/availability', requireRole('Admin','Cashier'), toggleAvailability)

router.delete('/:id', requireRole('Admin'), deleteItem)

module.exports = router
