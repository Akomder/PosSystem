const router = require('express').Router()
const { body } = require('express-validator')
const { cancelReasons, noteTemplates, processingSectors, printTemplates, getStore, updateStore } = require('../controllers/settingsController')
const authenticate = require('../middleware/auth')
const requireRole  = require('../middleware/authorize')

router.use(authenticate)

// ─── Cancel reasons ───────────────────────────────────────────────────────────
router.get('/cancel-reasons',        cancelReasons.getAll)
router.post('/cancel-reasons',       requireRole('Admin'), [body('name').notEmpty()], cancelReasons.create)
router.put('/cancel-reasons/:id',    requireRole('Admin'), cancelReasons.update)
router.delete('/cancel-reasons/:id', requireRole('Admin'), cancelReasons.remove)

// ─── Note templates ───────────────────────────────────────────────────────────
router.get('/note-templates',        noteTemplates.getAll)
router.post('/note-templates',       requireRole('Admin'), [body('name').notEmpty()], noteTemplates.create)
router.put('/note-templates/:id',    requireRole('Admin'), noteTemplates.update)
router.delete('/note-templates/:id', requireRole('Admin'), noteTemplates.remove)

// ─── Processing sectors ───────────────────────────────────────────────────────
router.get('/processing-sectors',        processingSectors.getAll)
router.post('/processing-sectors',       requireRole('Admin'), [body('name').notEmpty()], processingSectors.create)
router.put('/processing-sectors/:id',    requireRole('Admin'), processingSectors.update)
router.delete('/processing-sectors/:id', requireRole('Admin'), processingSectors.remove)

// ─── Print templates ──────────────────────────────────────────────────────────
router.get('/print-templates',        printTemplates.getAll)
router.post('/print-templates',       requireRole('Admin'), [body('name').notEmpty(), body('type').isIn(['receipt','kitchen','label'])], printTemplates.create)
router.put('/print-templates/:id',    requireRole('Admin'), printTemplates.update)
router.delete('/print-templates/:id', requireRole('Admin'), printTemplates.remove)

// ─── Store settings (restaurant info + POS toggles) ───────────────────────────
router.get('/store',  getStore)
router.put('/store',  requireRole('Admin'), updateStore)

module.exports = router
