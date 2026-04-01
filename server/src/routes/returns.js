const router     = require('express').Router()
const authenticate = require('../middleware/auth')
const { getAll, getOne, create, updateStatus, remove } = require('../controllers/returnsController')

router.use(authenticate)
router.get('/',              getAll)
router.get('/:id',           getOne)
router.post('/',             create)
router.patch('/:id/status',  updateStatus)
router.delete('/:id',        remove)

module.exports = router
