const router = require('express').Router()
const { body } = require('express-validator')
const { getAll, getOne, create, updateStatus, remove } = require('../controllers/purchaseOrdersController')
const authenticate = require('../middleware/auth')
const requireRole  = require('../middleware/authorize')

router.use(authenticate)

router.get('/',    getAll)
router.get('/:id', getOne)
router.post('/',   requireRole('Admin'),
  [body('items').isArray({ min: 0 })], create)
router.patch('/:id/status', requireRole('Admin'),
  [body('status').isIn(['draft','ordered','received','cancelled'])], updateStatus)
router.delete('/:id', requireRole('Admin'), remove)

module.exports = router
