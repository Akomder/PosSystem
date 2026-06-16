import { Outlet, NavLink, useNavigate } from 'react-router-dom'
import { LayoutDashboard, Store, LogOut, Shield, ChevronRight, Mail, Users, ScrollText } from 'lucide-react'
import clsx from 'clsx'
import { useAuth } from '../../context/AuthContext'
import { useSettings } from '../../context/SettingsContext'

const NAV = [
  { to: '/superadmin',              icon: LayoutDashboard, label: 'Overview',       end: true  },
  { to: '/superadmin/restaurants',  icon: Store,           label: 'Restaurants',    end: false },
  { to: '/superadmin/admins',       icon: Users,           label: 'Admins',         end: false },
  { to: '/superadmin/audit-log',    icon: ScrollText,      label: 'Audit Log',      end: false },
  { to: '/superadmin/email',        icon: Mail,            label: 'Email Settings', end: false },
]

export default function SuperAdminLayout() {
  const { user, logout } = useAuth()
  const { dark, toggleDark } = useSettings()
  const navigate = useNavigate()

  const handleLogout = () => { logout(); navigate('/superadmin/login') }

  return (
    <div className="flex h-screen bg-gray-950 dark:bg-gray-950 text-white overflow-hidden">
      {/* Sidebar */}
      <aside className="w-60 flex-shrink-0 flex flex-col bg-gray-900 border-r border-gray-800">
        {/* Logo */}
        <div className="flex items-center gap-3 px-5 py-5 border-b border-gray-800">
          <div className="w-9 h-9 bg-violet-600 rounded-xl flex items-center justify-center flex-shrink-0 shadow-lg shadow-violet-900/40">
            <Shield size={18} className="text-white" />
          </div>
          <div>
            <p className="text-sm font-bold text-white leading-tight">Super Admin</p>
            <p className="text-xs text-gray-500">Multi-Restaurant</p>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 py-4 space-y-1">
          {NAV.map(({ to, icon: Icon, label, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) =>
                clsx(
                  'flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors',
                  isActive
                    ? 'bg-violet-600/20 text-violet-400 border border-violet-600/30'
                    : 'text-gray-400 hover:bg-gray-800 hover:text-gray-100'
                )
              }
            >
              {({ isActive }) => (
                <>
                  <Icon size={17} className={isActive ? 'text-violet-400' : 'text-gray-500'} />
                  <span>{label}</span>
                  {isActive && <ChevronRight size={14} className="ml-auto text-violet-400/60" />}
                </>
              )}
            </NavLink>
          ))}
        </nav>

        {/* User + controls */}
        <div className="border-t border-gray-800 p-3 space-y-2">
          {/* Dark mode toggle */}
          <button
            onClick={toggleDark}
            className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-xs text-gray-500 hover:bg-gray-800 hover:text-gray-300 transition-colors"
          >
            <span>{dark ? '☀️' : '🌙'}</span>
            <span>{dark ? 'Light mode' : 'Dark mode'}</span>
          </button>

          {/* User */}
          <div className="flex items-center gap-3 px-2 py-1">
            <div className="w-8 h-8 rounded-full bg-violet-700 flex items-center justify-center flex-shrink-0">
              <span className="text-xs font-bold text-white">
                {(user?.name || 'SA').slice(0,2).toUpperCase()}
              </span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium text-gray-200 truncate">{user?.name || user?.email}</p>
              <span className="inline-flex items-center gap-1 text-[10px] bg-violet-900/60 text-violet-300 px-1.5 py-0.5 rounded-full font-medium">
                <Shield size={9} /> SuperAdmin
              </span>
            </div>
            <button
              onClick={handleLogout}
              className="p-1.5 text-gray-500 hover:text-red-400 hover:bg-red-900/20 rounded-lg transition-colors"
              title="Sign out"
            >
              <LogOut size={14} />
            </button>
          </div>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-y-auto bg-gray-950">
        <div className="p-6 min-h-full">
          <Outlet />
        </div>
      </main>
    </div>
  )
}
