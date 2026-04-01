import { NavLink, useNavigate } from 'react-router-dom'
import {
  LayoutDashboard,
  ClipboardList,
  Grid3X3,
  UtensilsCrossed,
  ChevronLeft,
  ChevronRight,
  LogOut,
  Users,
  Truck,
  BookOpen,
  BarChart2,
  ShoppingCart,
  FileText,
  RotateCcw,
} from 'lucide-react'
import clsx from 'clsx'
import { useAuth } from '../../context/AuthContext'
import { useApp } from '../../context/AppContext'
import { useSettings } from '../../context/SettingsContext'
import { getInitials } from '../../utils/formatters'
import Badge from '../ui/Badge'

export default function Sidebar() {
  const { user, logout } = useAuth()
  const { sidebarOpen, toggleSidebar } = useApp()
  const { t } = useSettings()
  const navigate = useNavigate()

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  const roleVariant = user?.role?.toLowerCase() || 'default'

  const navItems = [
    { to: '/dashboard', icon: LayoutDashboard, labelKey: 'nav.dashboard' },
    { to: '/sell',      icon: ShoppingCart,    labelKey: 'nav.sell'      },
    { to: '/orders',    icon: ClipboardList,   labelKey: 'nav.orders'    },
    { to: '/tables',    icon: Grid3X3,         labelKey: 'nav.tables'    },
    { to: '/menu',      icon: UtensilsCrossed, labelKey: 'nav.menu'      },
    { to: '/customers', icon: Users,           labelKey: 'nav.customers' },
    { to: '/suppliers', icon: Truck,           labelKey: 'nav.suppliers' },
    { to: '/cashflow',  icon: BookOpen,        labelKey: 'nav.cashflow'  },
    { to: '/invoices',  icon: FileText,        labelKey: 'nav.invoices'  },
    { to: '/returns',   icon: RotateCcw,       labelKey: 'nav.returns'   },
    { to: '/reports',   icon: BarChart2,       labelKey: 'nav.reports'   },
  ]

  return (
    <aside
      className={clsx(
        'flex flex-col h-screen bg-white dark:bg-gray-800 border-r border-gray-100 dark:border-gray-700 shadow-sm',
        'transition-all duration-300 flex-shrink-0 relative',
        sidebarOpen ? 'w-64' : 'w-16',
      )}
    >
      {/* Toggle button */}
      <button
        onClick={toggleSidebar}
        className="absolute -right-3 top-6 z-10 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-full p-1 shadow-sm hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
      >
        {sidebarOpen
          ? <ChevronLeft size={12} className="text-gray-500 dark:text-gray-400" />
          : <ChevronRight size={12} className="text-gray-500 dark:text-gray-400" />
        }
      </button>

      {/* Logo */}
      <div className={clsx(
        'flex items-center gap-3 px-4 py-5 border-b border-gray-100 dark:border-gray-700',
        !sidebarOpen && 'justify-center px-0',
      )}>
        <div className="w-8 h-8 bg-indigo-600 rounded-xl flex items-center justify-center flex-shrink-0">
          <UtensilsCrossed size={16} className="text-white" />
        </div>
        {sidebarOpen && (
          <div className="overflow-hidden">
            <p className="text-sm font-bold text-gray-900 dark:text-gray-100 truncate">Bella Vista</p>
            <p className="text-xs text-gray-400 truncate">POS System</p>
          </div>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4 space-y-1 overflow-hidden">
        {navItems.map(({ to, icon: Icon, labelKey }) => (
          <NavLink
            key={to}
            to={to}
            title={!sidebarOpen ? t(labelKey) : undefined}
            className={({ isActive }) =>
              clsx(
                'flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium',
                'transition-colors duration-150',
                isActive
                  ? 'bg-indigo-50 dark:bg-indigo-900/40 text-indigo-600 dark:text-indigo-400'
                  : 'text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700 hover:text-gray-900 dark:hover:text-gray-100',
                !sidebarOpen && 'justify-center px-0',
              )
            }
          >
            {({ isActive }) => (
              <>
                <Icon
                  size={18}
                  className={clsx(
                    'flex-shrink-0',
                    isActive ? 'text-indigo-600 dark:text-indigo-400' : 'text-gray-400 dark:text-gray-500',
                  )}
                />
                {sidebarOpen && <span className="truncate">{t(labelKey)}</span>}
              </>
            )}
          </NavLink>
        ))}
      </nav>

      {/* User footer */}
      <div className={clsx(
        'border-t border-gray-100 dark:border-gray-700 p-3',
        !sidebarOpen && 'flex flex-col items-center gap-2',
      )}>
        {sidebarOpen ? (
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-indigo-100 dark:bg-indigo-900 rounded-full flex items-center justify-center flex-shrink-0">
              <span className="text-xs font-bold text-indigo-700 dark:text-indigo-300">
                {getInitials(user?.name || '')}
              </span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">{user?.name}</p>
              <Badge variant={roleVariant} className="mt-0.5">{user?.role}</Badge>
            </div>
            <button
              onClick={handleLogout}
              title={t('common.signOut')}
              className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors flex-shrink-0"
            >
              <LogOut size={15} />
            </button>
          </div>
        ) : (
          <>
            <div
              title={user?.name}
              className="w-8 h-8 bg-indigo-100 dark:bg-indigo-900 rounded-full flex items-center justify-center"
            >
              <span className="text-xs font-bold text-indigo-700 dark:text-indigo-300">
                {getInitials(user?.name || '')}
              </span>
            </div>
            <button
              onClick={handleLogout}
              title={t('common.signOut')}
              className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
            >
              <LogOut size={15} />
            </button>
          </>
        )}
      </div>
    </aside>
  )
}
