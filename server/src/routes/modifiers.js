const router = require('express').Router()
const requireRole = require('../middleware/authorize')
const {
  getGroups, getGroup,
  createGroup, updateGroup, deleteGroup,
  addOption, updateOption, deleteOption,
  setItemGroups,
} = require('../controllers/modifiersController')

const ADMIN = requireRole('Admin')

// Groups
router.get('/groups',          getGroups)
router.get('/groups/:id',      getGroup)
router.post('/groups',         ADMIN, createGroup)
router.put('/groups/:id',      ADMIN, updateGroup)
router.delete('/groups/:id',   ADMIN, deleteGroup)

// Options inside a group
router.post('/groups/:id/options',  ADMIN, addOption)
router.put('/options/:id',          ADMIN, updateOption)
router.delete('/options/:id',       ADMIN, deleteOption)

// Assign groups to a menu item
router.put('/menu-items/:menuItemId/groups', ADMIN, setItemGroups)

module.exports = router
