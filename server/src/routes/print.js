const router = require('express').Router()
const { getReceipt, getKitchenTicket } = require('../controllers/printController')

router.get('/:id/receipt',        getReceipt)
router.get('/:id/kitchen-ticket', getKitchenTicket)

module.exports = router
