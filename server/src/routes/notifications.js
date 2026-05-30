'use strict'

const { Router } = require('express')
const ctrl       = require('../controllers/notificationsController')

const router = Router()

router.get   ('/',                 ctrl.getAll)
router.post  ('/',                 ctrl.create)
router.patch ('/mark-all-read',    ctrl.markAllRead)
router.patch ('/:id/read',         ctrl.markRead)
router.delete('/',                 ctrl.clearAll)

module.exports = router
