const router = require('express').Router()
const authenticate = require('../middleware/auth')
const {
  getOverview, getRestaurants, getRestaurant,
  createRestaurant, updateRestaurant, toggleStatus, deleteRestaurant,
  createRestaurantStaff,
  getAdmins, createAdmin, deleteAdmin,
  resetStaffPassword,
  getAuditLog,
  broadcast,
} = require('../controllers/superadminController')

// All superadmin routes require authentication + SuperAdmin role
function requireSuperAdmin(req, res, next) {
  if (req.user?.role !== 'SuperAdmin') {
    return res.status(403).json({ error: 'SuperAdmin access required' })
  }
  next()
}

router.use(authenticate, requireSuperAdmin)

router.get('/overview',                          getOverview)
router.get('/restaurants',                       getRestaurants)
router.post('/restaurants',                      createRestaurant)
router.get('/restaurants/:id',                   getRestaurant)
router.put('/restaurants/:id',                   updateRestaurant)
router.patch('/restaurants/:id/status',          toggleStatus)
router.delete('/restaurants/:id',                deleteRestaurant)
router.post('/restaurants/:id/staff',            createRestaurantStaff)
router.patch('/restaurants/:restaurantId/staff/:userId/password', resetStaffPassword)

// SuperAdmin user management
router.get('/admins',                            getAdmins)
router.post('/admins',                           createAdmin)
router.delete('/admins/:id',                     deleteAdmin)

// Audit log
router.get('/audit-log',                         getAuditLog)

// Broadcast
router.post('/broadcast',                        broadcast)

module.exports = router
