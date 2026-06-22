const router = require('express').Router()
const { getAll, create, update, remove, getPublicDealsByRestaurant } = require('../controllers/dealsController')
const authenticate = require('../middleware/auth')
const requireRole  = require('../middleware/authorize')

router.use(authenticate)

router.get('/',       getAll)
router.get('/active', getPublicDealsByRestaurant)
router.post('/',      requireRole('Admin'), create)
router.put('/:id',    requireRole('Admin'), update)
router.delete('/:id', requireRole('Admin'), remove)

module.exports = router
