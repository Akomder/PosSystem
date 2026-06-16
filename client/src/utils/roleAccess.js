// Role-based POS lock — front-line staff see only the POS-focused view.
//
// Locked roles land on /sell and may only reach the POS seller screen, Orders
// (to settle previously-sent bills) and Shifts (open/close the cash drawer).
// Any other route redirects them back to /sell. Admin/SuperAdmin are unaffected.
//
// POS_ALLOWED_PREFIXES is the single source of truth — widen it here to grant
// locked roles access to more pages.

export const POS_LOCKED_ROLES   = ['Cashier', 'Waiter']
export const POS_ALLOWED_PREFIXES = ['/sell', '/orders', '/shifts']

export function isPosLocked(user) {
  return POS_LOCKED_ROLES.includes(user?.role)
}

export function landingPath(user) {
  return isPosLocked(user) ? '/sell' : '/dashboard'
}

export function isPathAllowed(user, pathname) {
  if (!isPosLocked(user)) return true
  return POS_ALLOWED_PREFIXES.some(p => pathname === p || pathname.startsWith(p + '/'))
}
