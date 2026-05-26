const router = require('express').Router()
const { body } = require('express-validator')
const { getAll, getOne, create, update, remove } = require('../controllers/zonesController')
const authenticate = require('../middleware/auth')
const requireRole  = require('../middleware/authorize')

router.use(authenticate)

router.get('/',    getAll)
router.get('/:id', getOne)
router.post('/',   requireRole('Admin'), [body('name').notEmpty()], create)
router.put('/:id', requireRole('Admin'), update)
router.delete('/:id', requireRole('Admin'), remove)

module.exports = router
