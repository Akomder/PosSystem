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
  login:   (email, password)  => post('/auth/login', { email, password }),
  me:      ()                 => get('/auth/me'),
  refresh: (refreshToken)     => post('/auth/refresh', { refreshToken }),
}

// ─── Orders ───────────────────────────────────────────────────────────────────
export const ordersApi = {
  getAll:       (params = {}) => get('/orders?' + new URLSearchParams(params)),
  getOne:       (id)          => get(`/orders/${id}`),
  create:       (body)        => post('/orders', body),
  updateStatus: (id, status)  => patch(`/orders/${id}/status`, { status }),
  update:       (id, body)    => put(`/orders/${id}`, body),
}

// ─── Tables ───────────────────────────────────────────────────────────────────
export const tablesApi = {
  getAll:       (params = {}) => get('/tables?' + new URLSearchParams(params)),
  getOne:       (id)          => get(`/tables/${id}`),
  updateStatus: (id, status)  => patch(`/tables/${id}/status`, { status }),
  assignWaiter: (id, staffId) => patch(`/tables/${id}/assign`, { staffId }),
  update:       (id, body)    => put(`/tables/${id}`, body),
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
}

// ─── Email / SMTP ─────────────────────────────────────────────────────────────
// forgotPassword + resetPassword + validateToken are PUBLIC (no auth needed)
export const emailApi = {
  forgotPassword: (email)           => publicRequest('POST', '/email/forgot-password', { email }),
  resetPassword:  (token, password) => publicRequest('POST', '/email/reset-password',  { token, password }),
  validateToken:  (token)           => publicRequest('GET',  `/email/validate-token?token=${encodeURIComponent(token)}`),
  // SuperAdmin-only
  getConfig:      ()    => get('/email/config'),
  testEmail:      (to)  => post('/email/test', { to }),
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
  getTable:    (id)   => publicRequest('GET',  `/public/tables/${id}`),
  getMenu:     ()     => publicRequest('GET',  '/public/menu'),
  createOrder: (body) => publicRequest('POST', '/public/orders', body),
}
