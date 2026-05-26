const router = require('express').Router()
const { getAll } = require('../controllers/auditController')
const authenticate = require('../middleware/auth')
const requireRole  = require('../middleware/authorize')

router.use(authenticate)
router.get('/', requireRole('Admin'), getAll)

module.exports = router
