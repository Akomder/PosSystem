const router = require('express').Router()
const { body } = require('express-validator')
const { getAll, getOne, create, update, apply, remove } = require('../controllers/promotionsController')
const authenticate = require('../middleware/auth')
const requireRole  = require('../middleware/authorize')

router.use(authenticate)

router.get('/',    getAll)
router.get('/:id', getOne)
router.post('/',   requireRole('Admin'),
  [body('name').notEmpty(), body('value').isFloat({ min: 0 })], create)
router.put('/:id', requireRole('Admin'), update)
router.post('/:id/apply', [body('orderTotal').isFloat({ min: 0 })], apply)
router.delete('/:id', requireRole('Admin'), remove)

module.exports = router
