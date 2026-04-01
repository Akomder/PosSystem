/**
 * Sets req.restaurantId based on the authenticated user's restaurant.
 * - SuperAdmin: no scoping (null) unless X-Restaurant-ID header is present
 * - All others: scoped to their JWT restaurant_id
 */
function restaurantScope(req, res, next) {
  if (req.user?.role === 'SuperAdmin') {
    const override = req.headers['x-restaurant-id']
    req.restaurantId = override ? parseInt(override, 10) : null
  } else {
    req.restaurantId = req.user?.restaurantId ?? null
  }
  next()
}

module.exports = restaurantScope
