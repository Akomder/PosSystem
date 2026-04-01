/**
 * Role-based access control middleware factory.
 *
 * Usage:
 *   router.post('/', verifyToken, requireRole('Admin'), handler)
 *   router.put('/:id', verifyToken, requireRole('Admin','Cashier'), handler)
 */
function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Unauthenticated' })
    }
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        error:   'Forbidden',
        message: `This action requires role: ${roles.join(' or ')}`,
      })
    }
    next()
  }
}

module.exports = requireRole
