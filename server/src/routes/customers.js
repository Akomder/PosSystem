const router = require('express').Router()
const { body } = require('express-validator')
const authenticate = require('../middleware/auth')
const { getAll, getOne, create, update, remove } = require('../controllers/customersController')

router.use(authenticate)

router.get('/', getAll)
router.get('/:id', getOne)

router.post(
  '/',
  [body('name').notEmpty().withMessage('Name required')],
  create
)

router.put(
  '/:id',
  [body('name').notEmpty().withMessage('Name required')],
  update
)

router.delete('/:id', remove)

module.exports = router
