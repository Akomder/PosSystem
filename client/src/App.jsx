import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './context/AuthContext'
import { AppProvider } from './context/AppContext'
import { SettingsProvider } from './context/SettingsContext'
import { NotificationsProvider } from './context/NotificationsContext'
import Layout from './components/layout/Layout'
import Login from './pages/Login'
import TenantLogin from './pages/TenantLogin'
import ForgotPassword from './pages/ForgotPassword'
import ResetPassword from './pages/ResetPassword'
import Dashboard from './pages/Dashboard'
import Orders from './pages/Orders'
import Tables from './pages/Tables'
import Menu from './pages/Menu'
import Customers from './pages/Customers'
import Suppliers from './pages/Suppliers'
import CashFlow from './pages/CashFlow'
import Reports from './pages/Reports'
import Sell from './pages/Sell'
import Invoices from './pages/Invoices'
import Returns from './pages/Returns'
import CustomerOrder from './pages/CustomerOrder'
import Staff from './pages/Staff'
import StockTakes from './pages/StockTakes'
import PriceBooks from './pages/PriceBooks'
import PurchaseOrders from './pages/PurchaseOrders'
import PurchaseReturns from './pages/PurchaseReturns'
import DamageRecords from './pages/DamageRecords'
import Shifts from './pages/Shifts'
import Promotions from './pages/Promotions'
import Settings from './pages/Settings'
import AuditLog from './pages/AuditLog'
import Kitchen from './pages/Kitchen'
import OfflineBanner from './components/OfflineBanner'
import StockLowToast from './components/StockLowToast'

// SuperAdmin pages
import SuperAdminLayout from './pages/superadmin/SuperAdminLayout'
import SuperAdminDashboard from './pages/superadmin/SuperAdminDashboard'
import Restaurants from './pages/superadmin/Restaurants'
import RestaurantDetail from './pages/superadmin/RestaurantDetail'
import EmailSettings from './pages/superadmin/EmailSettings'
import Admins from './pages/superadmin/Admins'
import SuperAdminAuditLog from './pages/superadmin/AuditLog'

// ─── Route Guards ──────────────────────────────────────────────────────────────
function ProtectedRoute({ children }) {
  const { user } = useAuth()
  if (!user) {
    const slug = localStorage.getItem('pos_restaurant_slug')
    if (slug) return <Navigate to={`/${slug}`} replace />
    return <Navigate to="/login" replace />
  }
  // SuperAdmin should always go to /superadmin
  if (user.isSuperAdmin) return <Navigate to="/superadmin" replace />
  return children
}

function SuperAdminRoute({ children }) {
  const { user } = useAuth()
  if (!user) return <Navigate to="/login" replace />
  if (!user.isSuperAdmin) return <Navigate to="/dashboard" replace />
  return children
}

function RootRedirect() {
  const { user } = useAuth()
  // Not logged in → SuperAdmin login page (restaurant staff use /{slug})
  if (!user) return <Navigate to="/login" replace />
  return <Navigate to={user.isSuperAdmin ? '/superadmin' : '/dashboard'} replace />
}

function AppRoutes() {
  return (
    <Routes>
      {/* Public route — customer QR ordering */}
      <Route path="/order/:tableId" element={<CustomerOrder />} />

      {/* Root redirect */}
      <Route path="/" element={<RootRedirect />} />

      {/* SuperAdmin-only login (/login) */}
      <Route path="/login"           element={<Login />} />
      <Route path="/forgot-password" element={<ForgotPassword />} />
      <Route path="/reset-password"  element={<ResetPassword />} />

      {/* ── SuperAdmin routes ───────────────────────────────────────────── */}
      <Route
        path="/superadmin"
        element={<SuperAdminRoute><SuperAdminLayout /></SuperAdminRoute>}
      >
        <Route index element={<SuperAdminDashboard />} />
        <Route path="restaurants" element={<Restaurants />} />
        <Route path="restaurants/:id" element={<RestaurantDetail />} />
        <Route path="admins" element={<Admins />} />
        <Route path="audit-log" element={<SuperAdminAuditLog />} />
        <Route path="email" element={<EmailSettings />} />
      </Route>

      {/* ── Restaurant (regular) routes ─────────────────────────────────── */}
      <Route
        path="/dashboard"
        element={<ProtectedRoute><Layout /></ProtectedRoute>}
      >
        <Route index element={<Dashboard />} />
      </Route>
      <Route path="/orders"    element={<ProtectedRoute><Layout /></ProtectedRoute>}>
        <Route index element={<Orders />} />
      </Route>
      <Route path="/tables"    element={<ProtectedRoute><Layout /></ProtectedRoute>}>
        <Route index element={<Tables />} />
      </Route>
      <Route path="/menu"      element={<ProtectedRoute><Layout /></ProtectedRoute>}>
        <Route index element={<Menu />} />
      </Route>
      <Route path="/customers" element={<ProtectedRoute><Layout /></ProtectedRoute>}>
        <Route index element={<Customers />} />
      </Route>
      <Route path="/suppliers" element={<ProtectedRoute><Layout /></ProtectedRoute>}>
        <Route index element={<Suppliers />} />
      </Route>
      <Route path="/cashflow"  element={<ProtectedRoute><Layout /></ProtectedRoute>}>
        <Route index element={<CashFlow />} />
      </Route>
      <Route path="/reports"   element={<ProtectedRoute><Layout /></ProtectedRoute>}>
        <Route index element={<Reports />} />
      </Route>
      <Route path="/invoices"  element={<ProtectedRoute><Layout /></ProtectedRoute>}>
        <Route index element={<Invoices />} />
      </Route>
      <Route path="/returns"   element={<ProtectedRoute><Layout /></ProtectedRoute>}>
        <Route index element={<Returns />} />
      </Route>
      <Route path="/staff"     element={<ProtectedRoute><Layout /></ProtectedRoute>}>
        <Route index element={<Staff />} />
      </Route>
      <Route path="/stock-takes"      element={<ProtectedRoute><Layout /></ProtectedRoute>}>
        <Route index element={<StockTakes />} />
      </Route>
      <Route path="/price-books"      element={<ProtectedRoute><Layout /></ProtectedRoute>}>
        <Route index element={<PriceBooks />} />
      </Route>
      <Route path="/purchase-orders"  element={<ProtectedRoute><Layout /></ProtectedRoute>}>
        <Route index element={<PurchaseOrders />} />
      </Route>
      <Route path="/purchase-returns" element={<ProtectedRoute><Layout /></ProtectedRoute>}>
        <Route index element={<PurchaseReturns />} />
      </Route>
      <Route path="/damage-records"   element={<ProtectedRoute><Layout /></ProtectedRoute>}>
        <Route index element={<DamageRecords />} />
      </Route>
      <Route path="/shifts"           element={<ProtectedRoute><Layout /></ProtectedRoute>}>
        <Route index element={<Shifts />} />
      </Route>
      <Route path="/promotions"       element={<ProtectedRoute><Layout /></ProtectedRoute>}>
        <Route index element={<Promotions />} />
      </Route>
      <Route path="/settings"         element={<ProtectedRoute><Layout /></ProtectedRoute>}>
        <Route index element={<Settings />} />
      </Route>
      <Route path="/audit-log"        element={<ProtectedRoute><Layout /></ProtectedRoute>}>
        <Route index element={<AuditLog />} />
      </Route>

      {/* Sell screen — full screen, no layout */}
      <Route path="/sell"    element={<ProtectedRoute><Sell /></ProtectedRoute>} />

      {/* Kitchen display — full screen, no layout */}
      <Route path="/kitchen" element={<ProtectedRoute><Kitchen /></ProtectedRoute>} />

      {/* Tenant login — /{restaurant_slug} (e.g. /bella-vista)
          Must come after all named routes so static paths (/login, /dashboard …)
          are matched first. React Router v6 always prefers static over dynamic. */}
      <Route path="/:slug" element={<TenantLogin />} />

      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <SettingsProvider>
        <AuthProvider>
          <AppProvider>
            <NotificationsProvider>
              <OfflineBanner />
              <StockLowToast />
              <AppRoutes />
            </NotificationsProvider>
          </AppProvider>
        </AuthProvider>
      </SettingsProvider>
    </BrowserRouter>
  )
}
