import { useState } from 'react'
import { NavLink } from 'react-router-dom'
import {
  LayoutDashboard, ClipboardList, Grid3X3, UtensilsCrossed,
  ChevronLeft, ChevronRight, Users, UserCheck, Truck,
  BookOpen, BarChart2, ShoppingCart, FileText, RotateCcw,
  PackageSearch, BookMarked, AlertTriangle, ShoppingBag, Package,
  PackageX, Clock, Tag, Settings2, Shield, ChevronUp, ChefHat, Landmark, Coffee,
} from 'lucide-react'
import clsx from 'clsx'
import { useAuth } from '../../context/AuthContext'
import { useApp } from '../../context/AppContext'
import { useSettings } from '../../context/SettingsContext'
import { getInitials } from '../../utils/formatters'
import { isPosLocked, POS_ALLOWED_PREFIXES } from '../../utils/roleAccess'
import ProfileModal from './ProfileModal'

const ROLE_GRADIENT = {
  Admin:   'from-teal-500 to-cyan-400',
  Waiter:  'from-blue-500 to-indigo-400',
  Cashier: 'from-amber-500 to-orange-400',
  Chef:    'from-orange-500 to-red-400',
  default: 'from-slate-500 to-gray-400',
}

export default function Sidebar() {
  const { user } = useAuth()
  const { sidebarOpen, toggleSidebar } = useApp()
  const { t } = useSettings()
  const [profileOpen, setProfileOpen] = useState(false)

  const role     = user?.role
  const gradient = ROLE_GRADIENT[role] || ROLE_GRADIENT.default

  // Each item declares which roles can see it. All = no restriction beyond authentication.
  const ALL     = ['Admin','Waiter','Cashier','Chef']
  const NO_CHEF = ['Admin','Waiter','Cashier']

  const allSections = [
    {
      label: null,
      items: [
        { to: '/dashboard', icon: LayoutDashboard, label: t('nav.dashboard'), roles: ALL },
        { to: '/sell',      icon: ShoppingCart,    label: t('nav.sell'),      roles: NO_CHEF },
        { to: '/orders',    icon: ClipboardList,   label: t('nav.orders'),    roles: ALL },
        { to: '/kitchen',   icon: ChefHat,         label: t('nav.kitchen'),   roles: ['Admin','Waiter','Chef'] },
        { to: '/tables',    icon: Grid3X3,         label: t('nav.tables'),    roles: ['Admin','Waiter'] },
        { to: '/menu',      icon: UtensilsCrossed, label: t('nav.menu'),      roles: ['Admin','Waiter','Chef'] },
        { to: '/customers', icon: Users,           label: t('nav.customers'), roles: ['Admin','Waiter','Cashier'] },
        { to: '/staff',     icon: UserCheck,       label: t('nav.staff'),     roles: ['Admin'] },
        { to: '/suppliers', icon: Truck,           label: t('nav.suppliers'), roles: ['Admin'] },
        { to: '/cashflow',       icon: BookOpen,   label: t('nav.cashflow'),       roles: ['Admin','Cashier'] },
        { to: '/debt',           icon: Landmark,   label: t('nav.debt'),            roles: ['Admin','Cashier'] },
        { to: '/invoices',  icon: FileText,        label: t('nav.invoices'),       roles: ['Admin','Cashier'] },
        { to: '/returns',   icon: RotateCcw,       label: t('nav.returns'),        roles: ['Admin','Cashier'] },
        { to: '/reports',   icon: BarChart2,       label: t('nav.reports'),        roles: ['Admin','Cashier'] },
        { to: '/shifts',    icon: Clock,           label: t('nav.shifts'),         roles: ['Admin','Cashier'] },
      ],
    },
    {
      label: t('nav.section.inventory'),
      items: [
        { to: '/stock',          icon: Package,       label: 'Stock',                roles: ['Admin'] },
        { to: '/stock-takes',    icon: PackageSearch, label: t('nav.stockTakes'),    roles: ['Admin'] },
        { to: '/staff-consumption', icon: Coffee,     label: t('nav.staffConsumption'), roles: ['Admin','Cashier'] },
        { to: '/price-books',    icon: BookMarked,    label: t('nav.priceBooks'),    roles: ['Admin'] },
        { to: '/damage-records', icon: AlertTriangle, label: t('nav.damageRecords'), roles: ['Admin'] },
      ],
    },
    {
      label: t('nav.section.purchasing'),
      items: [
        { to: '/purchase-orders',  icon: ShoppingBag, label: t('nav.purchaseOrders'),  roles: ['Admin'] },
        { to: '/purchase-returns', icon: PackageX,    label: t('nav.purchaseReturns'), roles: ['Admin'] },
      ],
    },
    {
      label: t('nav.section.settings'),
      items: [
        { to: '/promotions', icon: Tag,     label: t('nav.promotions'), roles: ['Admin'] },
        { to: '/settings',   icon: Settings2, label: t('nav.settings'), roles: ['Admin'] },
        { to: '/audit-log',  icon: Shield,  label: t('nav.auditLog'),   roles: ['Admin'] },
      ],
    },
  ]

  // Filter items by current user role; POS-locked roles only see allowed pages.
  const posLocked = isPosLocked(user)
  const navSections = allSections
    .map(section => ({
      ...section,
      items: section.items.filter(item =>
        item.roles.includes(role) &&
        (!posLocked || POS_ALLOWED_PREFIXES.includes(item.to))
      ),
    }))
    .filter(section => section.items.length > 0)

  return (
    <>
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
            ? <ChevronLeft  size={12} className="text-gray-500 dark:text-gray-400" />
            : <ChevronRight size={12} className="text-gray-500 dark:text-gray-400" />
          }
        </button>

        {/* Logo */}
        <div className={clsx(
          'flex items-center gap-3 px-4 py-5 border-b border-gray-100 dark:border-gray-700',
          !sidebarOpen && 'justify-center px-0',
        )}>
          <div className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 shadow-sm overflow-hidden">
            <img src="/favicon.svg" alt="Error POS" className="w-8 h-8 object-cover" />
          </div>
          {sidebarOpen && (
            <div className="overflow-hidden">
              <p className="text-sm font-bold text-gray-900 dark:text-gray-100 truncate">Error POS</p>
              <p className="text-xs text-gray-400 truncate">POS System</p>
            </div>
          )}
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-3 py-4 overflow-y-auto overflow-x-hidden space-y-4">
          {navSections.map((section, si) => (
            <div key={si}>
              {section.label && sidebarOpen && (
                <p className="px-3 mb-1 text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider">
                  {section.label}
                </p>
              )}
              {section.label && !sidebarOpen && (
                <div className="border-t border-gray-100 dark:border-gray-700 my-1" />
              )}
              <div className="space-y-0.5">
                {section.items.map(({ to, icon: Icon, label }) => (
                  <NavLink
                    key={to}
                    to={to}
                    title={!sidebarOpen ? label : undefined}
                    className={({ isActive }) =>
                      clsx(
                        'flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors duration-150',
                        isActive
                          ? 'bg-teal-50 dark:bg-teal-900/40 text-teal-600 dark:text-teal-400'
                          : 'text-gray-600 dark:text-gray-400 hover:bg-orange-50 dark:hover:bg-orange-900/20 hover:text-[#f3761d] dark:hover:text-orange-400',
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
                            isActive ? 'text-teal-600 dark:text-teal-400' : 'text-gray-400 dark:text-gray-500',
                          )}
                        />
                        {sidebarOpen && <span className="truncate">{label}</span>}
                      </>
                    )}
                  </NavLink>
                ))}
              </div>
            </div>
          ))}
        </nav>

        {/* ── Modern Profile Footer ─────────────────────────────────────────── */}
        <div className="border-t border-gray-100 dark:border-gray-700 p-3">
          <button
            onClick={() => setProfileOpen(true)}
            title={!sidebarOpen ? user?.name : undefined}
            className={clsx(
              'w-full flex items-center gap-3 rounded-xl transition-all duration-150 group',
              sidebarOpen
                ? 'px-3 py-2.5 hover:bg-gray-50 dark:hover:bg-gray-700/60'
                : 'justify-center p-2 hover:bg-gray-50 dark:hover:bg-gray-700/60',
            )}
          >
            {/* Avatar */}
            <div className="relative flex-shrink-0">
              <div className={clsx(
                'flex items-center justify-center rounded-xl text-white font-bold text-xs shadow-md',
                'bg-gradient-to-br', gradient,
                sidebarOpen ? 'w-9 h-9' : 'w-8 h-8',
              )}>
                {getInitials(user?.name || '')}
              </div>
              {/* Online indicator */}
              <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 bg-green-400 border-2 border-white dark:border-gray-800 rounded-full" />
            </div>

            {sidebarOpen && (
              <>
                <div className="flex-1 min-w-0 text-left">
                  <p className="text-sm font-semibold text-gray-800 dark:text-gray-100 truncate leading-tight">
                    {user?.name}
                  </p>
                  <p className="text-xs text-gray-400 dark:text-gray-500 truncate mt-0.5">
                    {user?.role}
                  </p>
                </div>
                <ChevronUp
                  size={14}
                  className="text-gray-300 dark:text-gray-600 group-hover:text-teal-500 transition-colors flex-shrink-0"
                />
              </>
            )}
          </button>
        </div>
      </aside>

      {/* Profile modal */}
      <ProfileModal
        isOpen={profileOpen}
        onClose={() => setProfileOpen(false)}
      />
    </>
  )
}
