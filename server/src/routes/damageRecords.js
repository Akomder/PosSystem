const router = require('express').Router()
const { body } = require('express-validator')
const { getAll, getOne, create, remove } = require('../controllers/damageRecordsController')
const authenticate = require('../middleware/auth')
const requireRole  = require('../middleware/authorize')

router.use(authenticate)

router.get('/',    getAll)
router.get('/:id', getOne)
router.post('/',   requireRole('Admin','Cashier'),
  [body('items').isArray({ min: 1 })], create)
router.delete('/:id', requireRole('Admin'), remove)

module.exports = router
