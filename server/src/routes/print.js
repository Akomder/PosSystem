const router = require('express').Router()
const {
  getReceipt, getKitchenTicket,
  getDraftOrder, getReturnInvoice, getPurchaseReceipt, getPurchaseReturnReceipt, getCashFlowPrint,
} = require('../controllers/printController')

router.get('/:id/receipt',         getReceipt)
router.get('/:id/kitchen-ticket',  getKitchenTicket)
router.get('/:id/draft',           getDraftOrder)
router.get('/return/:id',          getReturnInvoice)
router.get('/purchase/:id',        getPurchaseReceipt)
router.get('/purchase-return/:id', getPurchaseReturnReceipt)
router.get('/cashflow/:id',        getCashFlowPrint)

module.exports = router
