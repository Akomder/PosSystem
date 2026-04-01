import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import {
  UtensilsCrossed,
  ShieldCheck,
  ClipboardList,
  CreditCard,
  Eye,
  EyeOff,
  AlertCircle,
  Shield,
} from 'lucide-react'
import clsx from 'clsx'
import { useAuth } from '../context/AuthContext'
import { useSettings } from '../context/SettingsContext'
import Button from '../components/ui/Button'
import Input from '../components/ui/Input'

const ROLES = [
  { id: 'SuperAdmin', icon: Shield,       email: 'superadmin@pos.com', hintKey: 'login.roles.superadmin.hint' },
  { id: 'Admin',      icon: ShieldCheck,  email: 'admin@pos.com',      hintKey: 'login.roles.admin.hint'      },
  { id: 'Waiter',     icon: ClipboardList,email: 'waiter@pos.com',     hintKey: 'login.roles.waiter.hint'     },
  { id: 'Cashier',    icon: CreditCard,   email: 'cashier@pos.com',    hintKey: 'login.roles.cashier.hint'    },
]

export default function Login() {
  const { login } = useAuth()
  const { t } = useSettings()
  const navigate = useNavigate()

  const [selectedRole, setSelectedRole] = useState('Admin')
  const [email, setEmail]               = useState('admin@pos.com')
  const [password, setPassword]         = useState('')
  const [showPass, setShowPass]         = useState(false)
  const [loading, setLoading]           = useState(false)
  const [error, setError]               = useState('')

  const handleRoleSelect = (role) => {
    setSelectedRole(role.id)
    setEmail(role.email)
    setError('')
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    if (!email || !password) {
      setError(t('login.errorRequired'))
      return
    }
    setLoading(true)
    try {
      const userData = await login(email, password)
      navigate(userData.isSuperAdmin ? '/superadmin' : '/dashboard')
    } catch (err) {
      setError(err.message || t('login.errorFailed'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-slate-50 dark:from-gray-900 dark:via-gray-900 dark:to-gray-800 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Card */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl border border-gray-100 dark:border-gray-700 p-8">
          {/* Logo */}
          <div className="flex flex-col items-center mb-8">
            <div className="w-14 h-14 bg-indigo-600 rounded-2xl flex items-center justify-center shadow-lg shadow-indigo-200 dark:shadow-indigo-900/50 mb-4">
              <UtensilsCrossed size={26} className="text-white" />
            </div>
            <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">Bella Vista POS</h1>
            <p className="text-sm text-gray-400 dark:text-gray-500 mt-1">{t('login.subtitle')}</p>
          </div>

          {/* Role selector */}
          <div className="mb-6">
            <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-3">
              {t('login.signInAs')}
            </p>
            <div className="grid grid-cols-4 gap-2">
              {ROLES.map((role) => {
                const Icon = role.icon
                const active = selectedRole === role.id
                return (
                  <button
                    key={role.id}
                    type="button"
                    onClick={() => handleRoleSelect(role)}
                    className={clsx(
                      'flex flex-col items-center gap-1.5 p-3 rounded-xl border-2 transition-all duration-150',
                      'text-center text-xs font-medium',
                      active
                        ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300'
                        : 'border-gray-100 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 text-gray-500 dark:text-gray-400 hover:border-gray-200 dark:hover:border-gray-500 hover:bg-white dark:hover:bg-gray-600',
                    )}
                  >
                    <Icon size={20} className={active ? 'text-indigo-600 dark:text-indigo-400' : 'text-gray-400 dark:text-gray-500'} />
                    <span>{role.id}</span>
                  </button>
                )
              })}
            </div>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            <Input
              label={t('login.email')}
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder={t('login.placeholder.email')}
              required
            />

            {/* Password with show/hide */}
            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                {t('login.password')} <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <input
                  type={showPass ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder={t('login.placeholder.password')}
                  required
                  className="w-full rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-sm text-gray-900 dark:text-gray-100 py-2.5 pl-3 pr-10 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent placeholder:text-gray-400 dark:placeholder:text-gray-500"
                />
                <button
                  type="button"
                  onClick={() => setShowPass((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                >
                  {showPass ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
            </div>

            {/* Forgot password */}
            <div className="text-right -mt-1">
              <Link
                to="/forgot-password"
                className="text-xs text-indigo-500 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 transition-colors"
              >
                Forgot password?
              </Link>
            </div>

            {/* Demo hint */}
            <p className="text-xs text-gray-400 dark:text-gray-500 text-center">
              {t('login.demoHint')}{' '}
              <code className="bg-gray-100 dark:bg-gray-700 px-1 rounded text-gray-600 dark:text-gray-300">superadmin123</code>{' '}
              / <code className="bg-gray-100 dark:bg-gray-700 px-1 rounded text-gray-600 dark:text-gray-300">admin123</code>{' '}
              / <code className="bg-gray-100 dark:bg-gray-700 px-1 rounded text-gray-600 dark:text-gray-300">waiter123</code>
            </p>

            {/* Error */}
            {error && (
              <div className="flex items-center gap-2 px-3 py-2.5 bg-red-50 dark:bg-red-900/20 border border-red-100 dark:border-red-800 rounded-lg">
                <AlertCircle size={14} className="text-red-500 flex-shrink-0" />
                <p className="text-xs text-red-600 dark:text-red-400">{error}</p>
              </div>
            )}

            <Button type="submit" fullWidth loading={loading} size="lg">
              {loading ? t('login.signingIn') : t('login.signIn')}
            </Button>
          </form>
        </div>

        <p className="text-center text-xs text-gray-400 dark:text-gray-600 mt-4">
          {t('login.version')}
        </p>
      </div>
    </div>
  )
}
