import { useState, useRef, useEffect } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import {
  Menu, Bell, LogOut, ChevronDown, Sun, Moon,
  ShoppingCart, Package, CheckCircle2, ClipboardList,
  BellOff, Trash2, CheckCheck,
} from 'lucide-react'
import { useAuth }          from '../../context/AuthContext'
import { useApp }           from '../../context/AppContext'
import { useSettings }      from '../../context/SettingsContext'
import { useNotifications } from '../../context/NotificationsContext'
import { getInitials }      from '../../utils/formatters'
import Badge                from '../ui/Badge'
import StoreToggle          from './StoreToggle'

// ─── Page title map ───────────────────────────────────────────────────────────
const PAGE_TITLE_KEYS = {
  '/dashboard':       'page.dashboard',
  '/orders':          'page.orders',
  '/tables':          'page.tables',
  '/menu':            'page.menu',
  '/sell':            'page.sell',
  '/customers':       'page.customers',
  '/suppliers':       'page.suppliers',
  '/cashflow':        'page.cashflow',
  '/invoices':        'page.invoices',
  '/returns':         'page.returns',
  '/reports':         'page.reports',
}

// ─── Relative timestamp ───────────────────────────────────────────────────────
function relTime(iso) {
  const s = Math.max(0, Math.floor((Date.now() - new Date(iso)) / 1000))
  if (s < 60)    return 'just now'
  if (s < 3600)  return `${Math.floor(s / 60)}m ago`
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`
  return `${Math.floor(s / 86400)}d ago`
}

// ─── Notification type config ─────────────────────────────────────────────────
const TYPE_CONFIG = {
  order_new: {
    Icon:      ShoppingCart,
    iconBg:    'bg-teal-100 dark:bg-teal-900/40',
    iconColor: 'text-teal-600 dark:text-teal-400',
    dot:       'bg-teal-500',
  },
  order_status: {
    Icon:      CheckCircle2,
    iconBg:    'bg-blue-100 dark:bg-blue-900/40',
    iconColor: 'text-blue-600 dark:text-blue-400',
    dot:       'bg-blue-500',
  },
  stock_low: {
    Icon:      Package,
    iconBg:    'bg-amber-100 dark:bg-amber-900/40',
    iconColor: 'text-amber-600 dark:text-amber-400',
    dot:       'bg-amber-500',
  },
  default: {
    Icon:      ClipboardList,
    iconBg:    'bg-gray-100 dark:bg-gray-700',
    iconColor: 'text-gray-500 dark:text-gray-400',
    dot:       'bg-gray-400',
  },
}

// ─── Single notification row ──────────────────────────────────────────────────
function NotifRow({ notif, onRead }) {
  const navigate = useNavigate()
  const cfg = TYPE_CONFIG[notif.type] || TYPE_CONFIG.default
  const { Icon, iconBg, iconColor, dot } = cfg

  function handleClick() {
    onRead(notif.id)
    if (notif.link) navigate(notif.link)
  }

  return (
    <button
      onClick={handleClick}
      className={`
        w-full text-left flex items-start gap-3 px-4 py-3
        hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors
        ${!notif.read ? 'bg-teal-50/50 dark:bg-teal-900/10' : ''}
      `}
    >
      {/* Icon */}
      <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5 ${iconBg}`}>
        <Icon size={14} className={iconColor} />
      </div>

      {/* Text */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2">
          <p className={`text-xs font-semibold truncate ${!notif.read ? 'text-gray-900 dark:text-gray-100' : 'text-gray-600 dark:text-gray-400'}`}>
            {notif.title}
          </p>
          <span className="text-[10px] text-gray-400 flex-shrink-0">{relTime(notif.createdAt)}</span>
        </div>
        <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 line-clamp-2 leading-relaxed">
          {notif.body}
        </p>
      </div>

      {/* Unread dot */}
      {!notif.read && (
        <div className={`w-2 h-2 rounded-full flex-shrink-0 mt-1.5 ${dot}`} />
      )}
    </button>
  )
}

// ─── Navbar ───────────────────────────────────────────────────────────────────
export default function Navbar() {
  const { user, logout }                              = useAuth()
  const { toggleSidebar }                             = useApp()
  const { dark, toggleDark, lang, setLang, t }        = useSettings()
  const { notifications, unreadCount, markRead, markAllRead, clearAll } = useNotifications()
  const location  = useLocation()
  const navigate  = useNavigate()
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const [notifOpen,    setNotifOpen]    = useState(false)
  const notifRef = useRef(null)

  const title       = t(PAGE_TITLE_KEYS[location.pathname] || 'page.brand')
  const roleVariant = user?.role?.toLowerCase() || 'default'

  // Close notification panel when clicking outside
  useEffect(() => {
    function onClickOutside(e) {
      if (notifRef.current && !notifRef.current.contains(e.target)) {
        setNotifOpen(false)
      }
    }
    if (notifOpen) document.addEventListener('mousedown', onClickOutside)
    return () => document.removeEventListener('mousedown', onClickOutside)
  }, [notifOpen])

  const handleLogout = () => {
    const slug = localStorage.getItem('pos_restaurant_slug')
    logout()
    navigate(slug ? `/${slug}` : '/login')
  }

  return (
    <header className="h-16 bg-white dark:bg-gray-800 border-b border-gray-100 dark:border-gray-700 flex items-center justify-between px-6 flex-shrink-0">

      {/* ── Left ──────────────────────────────────────────────────────────── */}
      <div className="flex items-center gap-4">
        <button
          onClick={toggleSidebar}
          className="p-2 text-gray-400 dark:text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
        >
          <Menu size={18} />
        </button>
        <h1 className="text-base font-semibold text-gray-900 dark:text-gray-100">{title}</h1>
      </div>

      {/* ── Right ─────────────────────────────────────────────────────────── */}
      <div className="flex items-center gap-1">

        {/* Open/Close Store (business day) */}
        <StoreToggle />

        {/* Language toggle */}
        <button
          onClick={() => setLang(lang === 'en' ? 'lo' : 'en')}
          title={t('settings.language')}
          className="px-2.5 py-1.5 text-xs font-semibold text-gray-500 dark:text-gray-400 hover:text-teal-600 dark:hover:text-teal-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
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

        {/* ── Notification bell ──────────────────────────────────────────── */}
        <div className="relative" ref={notifRef}>
          <button
            onClick={() => { setNotifOpen(v => !v); setDropdownOpen(false) }}
            className={`relative p-2 rounded-lg transition-colors ${
              notifOpen
                ? 'bg-teal-50 dark:bg-teal-900/30 text-teal-600 dark:text-teal-400'
                : 'text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700'
            }`}
          >
            <Bell size={18} />
            {unreadCount > 0 && (
              <span className="absolute -top-0.5 -right-0.5 min-w-[17px] h-[17px] bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center px-0.5 leading-none">
                {unreadCount > 99 ? '99+' : unreadCount}
              </span>
            )}
          </button>

          {/* ── Notification panel ──────────────────────────────────────── */}
          {notifOpen && (
            <div className="absolute right-0 mt-2 w-80 bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-2xl shadow-xl z-50 overflow-hidden">

              {/* Panel header */}
              <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 dark:border-gray-700">
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-bold text-gray-900 dark:text-gray-100">Notifications</h3>
                  {unreadCount > 0 && (
                    <span className="px-1.5 py-0.5 bg-teal-100 dark:bg-teal-900/40 text-teal-700 dark:text-teal-400 text-[10px] font-bold rounded-full">
                      {unreadCount} new
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-1">
                  {unreadCount > 0 && (
                    <button
                      onClick={markAllRead}
                      title="Mark all as read"
                      className="p-1.5 text-gray-400 hover:text-teal-600 dark:hover:text-teal-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                    >
                      <CheckCheck size={14} />
                    </button>
                  )}
                  {notifications.length > 0 && (
                    <button
                      onClick={clearAll}
                      title="Clear all"
                      className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                    >
                      <Trash2 size={14} />
                    </button>
                  )}
                </div>
              </div>

              {/* Notification list */}
              <div className="max-h-[360px] overflow-y-auto divide-y divide-gray-50 dark:divide-gray-700/60">
                {notifications.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-10 text-gray-400 dark:text-gray-600">
                    <BellOff size={28} className="mb-2 opacity-40" />
                    <p className="text-xs font-medium">No notifications yet</p>
                    <p className="text-[11px] mt-0.5 opacity-70">New orders and alerts will appear here</p>
                  </div>
                ) : (
                  notifications.map(n => (
                    <NotifRow
                      key={n.id}
                      notif={n}
                      onRead={(id) => { markRead(id); setNotifOpen(false) }}
                    />
                  ))
                )}
              </div>

              {/* Panel footer */}
              {notifications.length > 0 && (
                <div className="px-4 py-2.5 border-t border-gray-100 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-800/50">
                  <p className="text-[11px] text-gray-400 text-center">
                    {notifications.length} notification{notifications.length !== 1 ? 's' : ''} · stored locally
                  </p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* ── User dropdown ──────────────────────────────────────────────── */}
        <div className="relative">
          <button
            onClick={() => { setDropdownOpen(v => !v); setNotifOpen(false) }}
            className="flex items-center gap-2 px-3 py-2 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
          >
            <div className="w-7 h-7 bg-teal-100 dark:bg-teal-900 rounded-full flex items-center justify-center">
              <span className="text-xs font-bold text-teal-700 dark:text-teal-300">
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
