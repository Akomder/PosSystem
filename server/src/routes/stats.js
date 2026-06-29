const router = require('express').Router()
const {
  getDashboard, getRevenue, getTopDishes,
  getReportSales, getReportProducts, getReportCustomers, getReportStaff, getReportFinance,
  getReportEOD, getReportChannel,
  getReportStockDaily, getReportSalesDetail, getReportPromotions,
} = require('../controllers/statsController')
const authenticate = require('../middleware/auth')

router.use(authenticate)

router.get('/dashboard',   getDashboard)
router.get('/revenue',    getRevenue)
router.get('/top-dishes', getTopDishes)

router.get('/reports/sales',     getReportSales)
router.get('/reports/products',  getReportProducts)
router.get('/reports/customers', getReportCustomers)
router.get('/reports/staff',     getReportStaff)
router.get('/reports/finance',   getReportFinance)
router.get('/reports/eod',       getReportEOD)
router.get('/reports/channel',   getReportChannel)
router.get('/reports/stock-daily',  getReportStockDaily)
router.get('/reports/sales-detail', getReportSalesDetail)
router.get('/reports/promotions',   getReportPromotions)

module.exports = router
