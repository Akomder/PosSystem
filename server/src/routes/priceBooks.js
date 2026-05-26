const router = require('express').Router()
const { body } = require('express-validator')
const { getAll, getOne, create, update, addItem, removeItem, remove } = require('../controllers/priceBooksController')
const authenticate = require('../middleware/auth')
const requireRole  = require('../middleware/authorize')

router.use(authenticate)

router.get('/',    getAll)
router.get('/:id', getOne)
router.post('/',   requireRole('Admin'), [body('name').notEmpty()], create)
router.put('/:id', requireRole('Admin'), update)
router.post('/:id/items', requireRole('Admin'),
  [body('menuItemId').isInt(), body('customPrice').isFloat({ min: 0 })], addItem)
router.delete('/:id/items/:itemId', requireRole('Admin'), removeItem)
router.delete('/:id', requireRole('Admin'), remove)

module.exports = router
