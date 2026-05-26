const router = require('express').Router()
const { body } = require('express-validator')
const { getAll, getOne, create, updateItem, complete, remove } = require('../controllers/stockTakesController')
const authenticate = require('../middleware/auth')
const requireRole  = require('../middleware/authorize')

router.use(authenticate)

router.get('/',    getAll)
router.get('/:id', getOne)
router.post('/',   requireRole('Admin'), [body('name').notEmpty()], create)
router.patch('/:id/items/:itemId', requireRole('Admin','Cashier'),
  [body('actualQty').isInt({ min: 0 })], updateItem)
router.patch('/:id/complete', requireRole('Admin'), complete)
router.delete('/:id', requireRole('Admin'), remove)

module.exports = router
