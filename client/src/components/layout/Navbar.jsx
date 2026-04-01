import { useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { Menu, Bell, LogOut, ChevronDown, Sun, Moon } from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import { useApp } from '../../context/AppContext'
import { useSettings } from '../../context/SettingsContext'
import { getInitials } from '../../utils/formatters'
import Badge from '../ui/Badge'

const PAGE_TITLE_KEYS = {
  '/dashboard': 'page.dashboard',
  '/orders':    'page.orders',
  '/tables':    'page.tables',
  '/menu':      'page.menu',
  '/sell':      'page.sell',
  '/customers': 'page.customers',
  '/suppliers': 'page.suppliers',
  '/cashflow':  'page.cashflow',
  '/invoices':  'page.invoices',
  '/returns':   'page.returns',
  '/reports':   'page.reports',
}

export default function Navbar() {
  const { user, logout } = useAuth()
  const { toggleSidebar } = useApp()
  const { dark, toggleDark, lang, setLang, t } = useSettings()
  const location = useLocation()
  const navigate = useNavigate()
  const [dropdownOpen, setDropdownOpen] = useState(false)

  const title = t(PAGE_TITLE_KEYS[location.pathname] || 'page.brand')
  const roleVariant = user?.role?.toLowerCase() || 'default'

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  return (
    <header className="h-16 bg-white dark:bg-gray-800 border-b border-gray-100 dark:border-gray-700 flex items-center justify-between px-6 flex-shrink-0">
      {/* Left */}
      <div className="flex items-center gap-4">
        <button
          onClick={toggleSidebar}
          className="p-2 text-gray-400 dark:text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
        >
          <Menu size={18} />
        </button>
        <h1 className="text-base font-semibold text-gray-900 dark:text-gray-100">{title}</h1>
      </div>

      {/* Right */}
      <div className="flex items-center gap-1">
        {/* Language toggle */}
        <button
          onClick={() => setLang(lang === 'en' ? 'lo' : 'en')}
          title={t('settings.language')}
          className="px-2.5 py-1.5 text-xs font-semibold text-gray-500 dark:text-gray-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
        >
          {lang === 'en' ? 'ລາວ' : 'EN'}
        </button>

        {/* Dark mode toggle */}
        <button
          onClick={toggleDark}
          title={t('settings.darkMode')}
          className="p-2 text-gray-400 dark:text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
        >
          {dark ? <Sun size={17} /> : <Moon size={17} />}
        </button>

        {/* Notification bell */}
        <button className="relative p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors">
          <Bell size={18} />
          <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full" />
        </button>

        {/* User dropdown */}
        <div className="relative">
          <button
            onClick={() => setDropdownOpen((v) => !v)}
            className="flex items-center gap-2 px-3 py-2 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
          >
            <div className="w-7 h-7 bg-indigo-100 dark:bg-indigo-900 rounded-full flex items-center justify-center">
              <span className="text-xs font-bold text-indigo-700 dark:text-indigo-300">
                {getInitials(user?.name || '')}
              </span>
            </div>
            <div className="hidden sm:block text-left">
              <p className="text-sm font-medium text-gray-900 dark:text-gray-100 leading-none">{user?.name}</p>
              <p className="text-xs text-gray-400 mt-0.5">{user?.role}</p>
            </div>
            <ChevronDown size={14} className="text-gray-400" />
          </button>

          {dropdownOpen && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setDropdownOpen(false)} />
              <div className="absolute right-0 mt-2 w-52 bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-xl shadow-lg z-20 overflow-hidden">
                <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-700">
                  <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">{user?.name}</p>
                  <p className="text-xs text-gray-400 mt-0.5">{user?.email}</p>
                  <Badge variant={roleVariant} className="mt-1.5">{user?.role}</Badge>
                </div>
                <button
                  onClick={() => { setDropdownOpen(false); handleLogout() }}
                  className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                >
                  <LogOut size={14} />
                  {t('common.signOut')}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </header>
  )
}
