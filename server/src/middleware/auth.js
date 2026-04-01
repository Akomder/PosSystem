const jwt = require('jsonwebtoken')

/**
 * Verify JWT Bearer token attached by the client.
 * Populates req.user = { id, staffId, name, email, role, restaurantId, isSuperAdmin }
 */
function verifyToken(req, res, next) {
  const authHeader = req.headers['authorization'] || req.headers['Authorization']

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'No token provided' })
  }

  const token = authHeader.split(' ')[1]

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET)
    req.user = {
      ...decoded,
      restaurantId:  decoded.restaurantId  ?? null,
      isSuperAdmin:  decoded.role === 'SuperAdmin',
    }
    next()
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Token expired' })
    }
    return res.status(401).json({ error: 'Invalid token' })
  }
}

module.exports = verifyToken
