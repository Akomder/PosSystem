// ─── Axios-free fetch wrapper ──────────────────────────────────────────────────
const BASE = '/api'

function getToken() {
  try {
    const u = JSON.parse(localStorage.getItem('pos_user') || 'null')
    return u?.token || null
  } catch { return null }
}

async function request(method, path, body) {
  const token = getToken()
  const headers = { 'Content-Type': 'application/json' }
  if (token) headers['Authorization'] = `Bearer ${token}`

  const res = await fetch(`${BASE}${path}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  })

  if (res.status === 204) return null

  const data = await res.json()
  if (!res.ok) {
    // 401 = token invalid or expired — clear stale session and redirect to login
    if (res.status === 401 && !path.includes('/auth/')) {
      localStorage.removeItem('pos_user')
      if (!window.location.pathname.includes('/login')) {
        window.location.href = '/login'
      }
    }
    const err = new Error(data.error || data.message || 'Request failed')
    err.status = res.status
    err.data   = data
    throw err
  }
  return data
}

const get    = (path)        => request('GET',    path)
const post   = (path, body)  => request('POST',   path, body)
const put    = (path, body)  => request('PUT',    path, body)
const patch  = (path, body)  => request('PATCH',  path, body)
const del    = (path)        => request('DELETE', path)

// ─── Auth ─────────────────────────────────────────────────────────────────────
export const authApi = {
  login:          (email, password, restaurantSlug) => post('/auth/login', { email, password, ...(restaurantSlug && { restaurantSlug }) }),
  me:             ()                             => get('/auth/me'),
  refresh:        (refreshToken)                 => post('/auth/refresh',          { refreshToken }),
  updateProfile:  (name)                         => put('/auth/profile',           { name }),
  changePassword: (currentPassword, newPassword) => post('/auth/change-password',  { currentPassword, newPassword }),
}

// ─── Orders ───────────────────────────────────────────────────────────────────
export const ordersApi = {
  getAll:       (params = {}) => get('/orders?' + new URLSearchParams(params)),
  getOne:       (id)          => get(`/orders/${id}`),
  create:       (body)        => post('/orders', body),
  updateStatus: (id, status)  => patch(`/orders/${id}/status`, { status }),
  cancel:       (id, reason)  => patch(`/orders/${id}/status`, { status: 'Cancelled', cancelReason: reason }),
  update:       (id, body)    => put(`/orders/${id}`, body),
  markItemDone: (orderId, itemId) => patch(`/orders/${orderId}/items/${itemId}/done`),
}

// ─── Tables ───────────────────────────────────────────────────────────────────
export const tablesApi = {
  getAll:       (params = {}) => get('/tables?' + new URLSearchParams(params)),
  getOne:       (id)          => get(`/tables/${id}`),
  create:       (body)        => post('/tables', body),
  updateStatus: (id, status)  => patch(`/tables/${id}/status`, { status }),
  assignWaiter: (id, staffId) => patch(`/tables/${id}/assign`, { staffId }),
  update:       (id, body)    => put(`/tables/${id}`, body),
  delete:       (id)          => del(`/tables/${id}`),
}

// ─── Menu ─────────────────────────────────────────────────────────────────────
export const menuApi = {
  getAll:        (params = {}) => get('/menu?' + new URLSearchParams(params)),
  getCategories: ()            => get('/menu/categories'),
  getOne:        (id)          => get(`/menu/${id}`),
  create:        (body)        => post('/menu', body),
  update:        (id, body)    => put(`/menu/${id}`, body),
  toggleAvail:   (id)          => patch(`/menu/${id}/availability`),
  delete:        (id)          => del(`/menu/${id}`),
}

// ─── Staff ────────────────────────────────────────────────────────────────────
export const staffApi = {
  getAll:  (params = {}) => get('/staff?' + new URLSearchParams(params)),
  getOne:  (id)          => get(`/staff/${id}`),
  create:  (body)        => post('/staff', body),
  update:  (id, body)    => put(`/staff/${id}`, body),
  delete:  (id)          => del(`/staff/${id}`),
}

// ─── Stats ────────────────────────────────────────────────────────────────────
export const statsApi = {
  dashboard: ()              => get('/stats/dashboard'),
  revenue:   (period='week') => get(`/stats/revenue?period=${period}`),
}

// ─── Customers ───────────────────────────────────────────────────────────────
export const customersApi = {
  getAll:  (params = {}) => get('/customers?' + new URLSearchParams(params)),
  getOne:  (id)          => get(`/customers/${id}`),
  create:  (body)        => post('/customers', body),
  update:  (id, body)    => put(`/customers/${id}`, body),
  delete:  (id)          => del(`/customers/${id}`),
}

// ─── Suppliers ────────────────────────────────────────────────────────────────
export const suppliersApi = {
  getAll:  (params = {}) => get('/suppliers?' + new URLSearchParams(params)),
  getOne:  (id)          => get(`/suppliers/${id}`),
  create:  (body)        => post('/suppliers', body),
  update:  (id, body)    => put(`/suppliers/${id}`, body),
  delete:  (id)          => del(`/suppliers/${id}`),
}

// ─── Cash Flow ────────────────────────────────────────────────────────────────
export const cashflowApi = {
  getAll:       (params = {}) => get('/cashflow?' + new URLSearchParams(params)),
  create:       (body)        => post('/cashflow', body),
  updateStatus: (id, status)  => patch(`/cashflow/${id}/status`, { status }),
  delete:       (id)          => del(`/cashflow/${id}`),
}

// ─── Returns ─────────────────────────────────────────────────────────────────
export const returnsApi = {
  getAll:       (params = {}) => get('/returns?' + new URLSearchParams(params)),
  getOne:       (id)          => get(`/returns/${id}`),
  create:       (body)        => post('/returns', body),
  updateStatus: (id, status)  => patch(`/returns/${id}/status`, { status }),
  delete:       (id)          => del(`/returns/${id}`),
}

// ─── Reports ─────────────────────────────────────────────────────────────────
export const reportsApi = {
  sales:    (params = {}) => get('/stats/reports/sales?'    + new URLSearchParams(params)),
  products: (params = {}) => get('/stats/reports/products?' + new URLSearchParams(params)),
  customers:(params = {}) => get('/stats/reports/customers?'+ new URLSearchParams(params)),
  staff:    (params = {}) => get('/stats/reports/staff?'    + new URLSearchParams(params)),
  finance:  (params = {}) => get('/stats/reports/finance?'  + new URLSearchParams(params)),
  eod:      (params = {}) => get('/stats/reports/eod?'      + new URLSearchParams(params)),
  channel:  (params = {}) => get('/stats/reports/channel?'  + new URLSearchParams(params)),
}

// ─── Zones ────────────────────────────────────────────────────────────────────
export const zonesApi = {
  getAll:  ()          => get('/zones'),
  create:  (body)      => post('/zones', body),
  update:  (id, body)  => put(`/zones/${id}`, body),
  delete:  (id)        => del(`/zones/${id}`),
}

// ─── Sales Channels ───────────────────────────────────────────────────────────
export const salesChannelsApi = {
  getAll:  ()          => get('/sales-channels'),
  create:  (body)      => post('/sales-channels', body),
  update:  (id, body)  => put(`/sales-channels/${id}`, body),
  delete:  (id)        => del(`/sales-channels/${id}`),
}

// ─── Shifts ───────────────────────────────────────────────────────────────────
export const shiftsApi = {
  getAll:   (params={}) => get('/shifts?' + new URLSearchParams(params)),
  getCurrent: ()        => get('/shifts/current'),
  open:     (body)      => post('/shifts/open', body),
  close:    (id, body)  => patch(`/shifts/${id}/close`, body),
}

// ─── Stock Takes ──────────────────────────────────────────────────────────────
export const stockTakesApi = {
  getAll:     ()              => get('/stock-takes'),
  getOne:     (id)            => get(`/stock-takes/${id}`),
  create:     (body)          => post('/stock-takes', body),
  updateItem: (id, itemId, b) => patch(`/stock-takes/${id}/items/${itemId}`, b),
  complete:   (id)            => patch(`/stock-takes/${id}/complete`),
  delete:     (id)            => del(`/stock-takes/${id}`),
}

// ─── Price Books ──────────────────────────────────────────────────────────────
export const priceBooksApi = {
  getAll:     ()              => get('/price-books'),
  getOne:     (id)            => get(`/price-books/${id}`),
  create:     (body)          => post('/price-books', body),
  update:     (id, body)      => put(`/price-books/${id}`, body),
  addItem:    (id, body)      => post(`/price-books/${id}/items`, body),
  removeItem: (id, itemId)    => del(`/price-books/${id}/items/${itemId}`),
  delete:     (id)            => del(`/price-books/${id}`),
}

// ─── Purchase Orders ──────────────────────────────────────────────────────────
export const purchaseOrdersApi = {
  getAll:       (params={})   => get('/purchase-orders?' + new URLSearchParams(params)),
  getOne:       (id)          => get(`/purchase-orders/${id}`),
  create:       (body)        => post('/purchase-orders', body),
  updateStatus: (id, status)  => patch(`/purchase-orders/${id}/status`, { status }),
  delete:       (id)          => del(`/purchase-orders/${id}`),
}

// ─── Purchase Returns ─────────────────────────────────────────────────────────
export const purchaseReturnsApi = {
  getAll:       (params={})   => get('/purchase-returns?' + new URLSearchParams(params)),
  getOne:       (id)          => get(`/purchase-returns/${id}`),
  create:       (body)        => post('/purchase-returns', body),
  updateStatus: (id, status)  => patch(`/purchase-returns/${id}/status`, { status }),
  delete:       (id)          => del(`/purchase-returns/${id}`),
}

// ─── Damage Records ───────────────────────────────────────────────────────────
export const damageRecordsApi = {
  getAll:  (params={}) => get('/damage-records?' + new URLSearchParams(params)),
  getOne:  (id)        => get(`/damage-records/${id}`),
  create:  (body)      => post('/damage-records', body),
  delete:  (id)        => del(`/damage-records/${id}`),
}

// ─── Settings ─────────────────────────────────────────────────────────────────
export const settingsApi = {
  cancelReasons:      { getAll: () => get('/settings/cancel-reasons'),     create: b => post('/settings/cancel-reasons', b),     update: (id,b) => put(`/settings/cancel-reasons/${id}`, b),     delete: id => del(`/settings/cancel-reasons/${id}`) },
  noteTemplates:      { getAll: () => get('/settings/note-templates'),     create: b => post('/settings/note-templates', b),     update: (id,b) => put(`/settings/note-templates/${id}`, b),     delete: id => del(`/settings/note-templates/${id}`) },
  processingSectors:  { getAll: () => get('/settings/processing-sectors'), create: b => post('/settings/processing-sectors', b), update: (id,b) => put(`/settings/processing-sectors/${id}`, b), delete: id => del(`/settings/processing-sectors/${id}`) },
  printTemplates:     { getAll: () => get('/settings/print-templates'),    create: b => post('/settings/print-templates', b),    update: (id,b) => put(`/settings/print-templates/${id}`, b),    delete: id => del(`/settings/print-templates/${id}`) },
  store:              { get: () => get('/settings/store'), update: b => put('/settings/store', b) },
}

// ─── Promotions ───────────────────────────────────────────────────────────────
export const promotionsApi = {
  getAll:  (params={}) => get('/promotions?' + new URLSearchParams(params)),
  getOne:  (id)        => get(`/promotions/${id}`),
  create:  (body)      => post('/promotions', body),
  update:  (id, body)  => put(`/promotions/${id}`, body),
  apply:   (id, body)  => post(`/promotions/${id}/apply`, body),
  delete:  (id)        => del(`/promotions/${id}`),
}

// ─── Print / Receipts ─────────────────────────────────────────────────────────
export const printApi = {
  getReceiptUrl:            (orderId)   => `${BASE}/print/${orderId}/receipt`,
  getKitchenTicketUrl:      (orderId)   => `${BASE}/print/${orderId}/kitchen-ticket`,
  getDraftUrl:              (orderId)   => `${BASE}/print/${orderId}/draft`,
  getReturnUrl:             (returnId)  => `${BASE}/print/return/${returnId}`,
  getPurchaseUrl:           (poId)      => `${BASE}/print/purchase/${poId}`,
  getPurchaseReturnUrl:     (prId)      => `${BASE}/print/purchase-return/${prId}`,
  getCashFlowUrl:           (entryId)   => `${BASE}/print/cashflow/${entryId}`,
}

// ─── Modifiers ────────────────────────────────────────────────────────────────
export const modifiersApi = {
  getGroups:       ()              => get('/modifiers/groups'),
  getGroup:        (id)            => get(`/modifiers/groups/${id}`),
  createGroup:     (body)          => post('/modifiers/groups', body),
  updateGroup:     (id, body)      => put(`/modifiers/groups/${id}`, body),
  deleteGroup:     (id)            => del(`/modifiers/groups/${id}`),
  addOption:       (groupId, body) => post(`/modifiers/groups/${groupId}/options`, body),
  updateOption:    (id, body)      => put(`/modifiers/options/${id}`, body),
  deleteOption:    (id)            => del(`/modifiers/options/${id}`),
  setItemGroups:   (menuItemId, groupIds) => put(`/modifiers/menu-items/${menuItemId}/groups`, { groupIds }),
}

// ─── Audit Logs ───────────────────────────────────────────────────────────────
export const auditLogsApi = {
  getAll: (params={}) => get('/audit-logs?' + new URLSearchParams(params)),
}

// ─── Notifications ────────────────────────────────────────────────────────────
export const notificationsApi = {
  getAll:      ()        => get('/notifications'),
  create:      (body)    => post('/notifications', body),
  markRead:    (id)      => patch(`/notifications/${id}/read`),
  markAllRead: ()        => patch('/notifications/mark-all-read'),
  clearAll:    ()        => del('/notifications'),
}

// ─── Super Admin ──────────────────────────────────────────────────────────────
export const superadminApi = {
  overview:             ()           => get('/superadmin/overview'),
  getRestaurants:       (params={})  => get('/superadmin/restaurants?' + new URLSearchParams(params)),
  getRestaurant:        (id)         => get(`/superadmin/restaurants/${id}`),
  createRestaurant:     (body)       => post('/superadmin/restaurants', body),
  updateRestaurant:     (id, body)   => put(`/superadmin/restaurants/${id}`, body),
  toggleStatus:         (id, status) => patch(`/superadmin/restaurants/${id}/status`, { status }),
  deleteRestaurant:     (id)         => del(`/superadmin/restaurants/${id}`),
  createStaff:          (id, body)   => post(`/superadmin/restaurants/${id}/staff`, body),
  resetStaffPassword:   (restaurantId, userId, newPassword) =>
                          patch(`/superadmin/restaurants/${restaurantId}/staff/${userId}/password`, { newPassword }),
  // Admin management
  getAdmins:     ()     => get('/superadmin/admins'),
  createAdmin:   (body) => post('/superadmin/admins', body),
  deleteAdmin:   (id)   => del(`/superadmin/admins/${id}`),
  // Audit log
  getAuditLog:   (params={}) => get('/superadmin/audit-log?' + new URLSearchParams(params)),
  // Broadcast
  broadcast:     (body) => post('/superadmin/broadcast', body),
}

// ─── Email / SMTP ─────────────────────────────────────────────────────────────
// forgotPassword + resetPassword + validateToken are PUBLIC (no auth needed)
export const emailApi = {
  forgotPassword: (email)           => publicRequest('POST', '/email/forgot-password', { email }),
  resetPassword:  (token, password) => publicRequest('POST', '/email/reset-password',  { token, password }),
  validateToken:  (token)           => publicRequest('GET',  `/email/validate-token?token=${encodeURIComponent(token)}`),
  // SuperAdmin-only
  getConfig:      ()     => get('/email/config'),
  updateConfig:   (body) => put('/email/config', body),
  testEmail:      (to)   => post('/email/test', { to }),
}

// ─── Public (no auth) ────────────────────────────────────────────────────────
async function publicRequest(method, path, body) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  })
  if (res.status === 204) return null
  const data = await res.json()
  if (!res.ok) {
    const err = new Error(data.error || data.message || 'Request failed')
    err.status = res.status
    err.data   = data
    throw err
  }
  return data
}

export const publicApi = {
  // Tenant login — resolve slug to restaurant branding
  getRestaurant: (slug)   => publicRequest('GET',  `/public/restaurant/${encodeURIComponent(slug)}`),
  getTable:    (id)       => publicRequest('GET',  `/public/tables/${id}`),
  // tableId scopes the menu to the correct restaurant in multi-tenant setups
  getMenu:     (tableId)  => publicRequest('GET',  `/public/menu${tableId ? `?tableId=${encodeURIComponent(tableId)}` : ''}`),
  createOrder: (body)     => publicRequest('POST', '/public/orders', body),
  // Cancel a Pending order — only works before the kitchen starts preparing
  cancelOrder: (orderId, tableId) => publicRequest('PATCH', `/public/orders/${encodeURIComponent(orderId)}/cancel`, { tableId }),
}
