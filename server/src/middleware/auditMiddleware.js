'use strict'

const { log } = require('../controllers/auditController')

const METHOD_ACTION = {
  POST:   'CREATE',
  PUT:    'UPDATE',
  PATCH:  'UPDATE',
  DELETE: 'DELETE',
}

function entityTypeFromPath(path) {
  if (/\/orders/.test(path))            return 'order'
  if (/\/menu/.test(path))              return 'menu_item'
  if (/\/tables/.test(path))            return 'table'
  if (/\/customers/.test(path))         return 'customer'
  if (/\/staff/.test(path))             return 'staff'
  if (/\/suppliers/.test(path))         return 'supplier'
  if (/\/cashflow/.test(path))          return 'cash_flow'
  if (/\/returns/.test(path))           return 'return'
  if (/\/shifts/.test(path))            return 'shift'
  if (/\/stock-takes/.test(path))       return 'stock_take'
  if (/\/price-books/.test(path))       return 'price_book'
  if (/\/purchase-orders/.test(path))   return 'purchase_order'
  if (/\/purchase-returns/.test(path))  return 'purchase_return'
  if (/\/damage-records/.test(path))    return 'damage_record'
  if (/\/promotions/.test(path))        return 'promotion'
  if (/\/zones/.test(path))             return 'zone'
  if (/\/sales-channels/.test(path))    return 'sales_channel'
  if (/\/modifiers/.test(path))         return 'modifier'
  if (/\/settings/.test(path))          return 'settings'
  if (/\/auth/.test(path))              return 'auth'
  return 'unknown'
}

module.exports = function auditMiddleware(req, res, next) {
  const action = METHOD_ACTION[req.method]
  if (!action) return next()

  const origJson = res.json.bind(res)

  res.json = function (data) {
    if (res.statusCode < 400) {
      const entityType = entityTypeFromPath(req.path)
      const entityId   = data?.id ?? req.params?.id ?? null
      log({
        restaurantId: req.restaurantId || null,
        userId:       req.user?.id     || null,
        userName:     req.user?.name   || req.user?.email || null,
        action:       `${action}_${entityType.toUpperCase()}`,
        entityType,
        entityId,
        newData:      action !== 'DELETE' ? data : null,
        ipAddress:    req.ip || null,
      })
    }
    return origJson(data)
  }

  next()
}
