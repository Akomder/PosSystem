import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './context/AuthContext'
import { AppProvider } from './context/AppContext'
import { SettingsProvider } from './context/SettingsContext'
import Layout from './components/layout/Layout'
import Login from './pages/Login'
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

// SuperAdmin pages
import SuperAdminLayout from './pages/superadmin/SuperAdminLayout'
import SuperAdminDashboard from './pages/superadmin/SuperAdminDashboard'
import Restaurants from './pages/superadmin/Restaurants'
import RestaurantDetail from './pages/superadmin/RestaurantDetail'
import EmailSettings from './pages/superadmin/EmailSettings'

// ─── Route Guards ──────────────────────────────────────────────────────────────
function ProtectedRoute({ children }) {
  const { user } = useAuth()
  if (!user) return <Navigate to="/login" replace />
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

      {/* Sell screen — full screen, no layout */}
      <Route path="/sell" element={<ProtectedRoute><Sell /></ProtectedRoute>} />

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
            <AppRoutes />
          </AppProvider>
        </AuthProvider>
      </SettingsProvider>
    </BrowserRouter>
  )
}
