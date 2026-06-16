import { useState, useEffect } from 'react'
import { useNavigate, useParams, Link } from 'react-router-dom'
import {
  UtensilsCrossed,
  ShieldCheck,
  ClipboardList,
  CreditCard,
  ChefHat,
  Eye,
  EyeOff,
  AlertCircle,
  Loader2,
} from 'lucide-react'
import clsx from 'clsx'
import { useAuth } from '../context/AuthContext'
import { landingPath } from '../utils/roleAccess'
import { publicApi } from '../services/api'
import Button from '../components/ui/Button'
import Input from '../components/ui/Input'

// Roles available to restaurant staff (SuperAdmin uses /login)
const STAFF_ROLES = [
  { id: 'Admin',   icon: ShieldCheck,   email: '' },
  { id: 'Waiter',  icon: ClipboardList, email: '' },
  { id: 'Cashier', icon: CreditCard,    email: '' },
  { id: 'Chef',    icon: ChefHat,       email: '' },
]

export default function TenantLogin() {
  const { slug }     = useParams()
  const { login }    = useAuth()
  const navigate     = useNavigate()

  const [restaurant, setRestaurant] = useState(null)   // { id, name, slug, logo }
  const [notFound,   setNotFound]   = useState(false)
  const [loading404, setLoading404] = useState(true)

  const [selectedRole, setSelectedRole] = useState('Admin')
  const [email,        setEmail]        = useState('')
  const [password,     setPassword]     = useState('')
  const [showPass,     setShowPass]     = useState(false)
  const [submitting,   setSubmitting]   = useState(false)
  const [error,        setError]        = useState('')

  // ── Resolve slug → restaurant info ──────────────────────────────────────────
  useEffect(() => {
    if (!slug) return
    setLoading404(true)
    setNotFound(false)
    publicApi.getRestaurant(slug)
      .then(r => setRestaurant(r))
      .catch(() => setNotFound(true))
      .finally(() => setLoading404(false))
  }, [slug])

  // ── Submit ───────────────────────────────────────────────────────────────────
  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    if (!email || !password) {
      setError('Username/email and password are required')
      return
    }
    setSubmitting(true)
    try {
      const userData = await login(email, password, slug)
      if (userData.isSuperAdmin) {
        setError('SuperAdmin accounts must use the main login page.')
        return
      }
      navigate(landingPath(userData))
    } catch (err) {
      setError(err.message || 'Invalid email or password')
    } finally {
      setSubmitting(false)
    }
  }

  // ── Loading / Not-Found states ───────────────────────────────────────────────
  if (loading404) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-teal-50 via-white to-slate-50 dark:from-gray-900 dark:via-gray-900 dark:to-gray-800">
        <Loader2 className="animate-spin text-teal-500" size={32} />
      </div>
    )
  }

  if (notFound) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-teal-50 via-white to-slate-50 dark:from-gray-900 dark:via-gray-900 dark:to-gray-800 p-4">
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl border border-gray-100 dark:border-gray-700 p-10 text-center max-w-sm w-full">
          <div className="w-14 h-14 bg-red-100 dark:bg-red-900/30 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <AlertCircle className="text-red-500" size={28} />
          </div>
          <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100 mb-2">Restaurant not found</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
            The URL <code className="bg-gray-100 dark:bg-gray-700 px-1 rounded text-xs">/{slug}</code> does not match any registered restaurant.
          </p>
          <Link
            to="/login"
            className="text-sm text-teal-600 dark:text-teal-400 hover:underline"
          >
            Go to admin login
          </Link>
        </div>
      </div>
    )
  }

  // ── Login form ───────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-gradient-to-br from-teal-50 via-white to-slate-50 dark:from-gray-900 dark:via-gray-900 dark:to-gray-800 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl border border-gray-100 dark:border-gray-700 p-8">

          {/* Branding */}
          <div className="flex flex-col items-center mb-8">
            {restaurant?.logo ? (
              <img
                src={restaurant.logo}
                alt={restaurant.name}
                className="h-14 w-14 object-contain rounded-2xl shadow mb-3"
              />
            ) : (
              <div className="w-14 h-14 bg-teal-600 rounded-2xl flex items-center justify-center shadow-lg shadow-teal-200 dark:shadow-teal-900/50 mb-3">
                <UtensilsCrossed size={26} className="text-white" />
              </div>
            )}
            <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100 text-center">
              {restaurant?.name}
            </h1>
            <p className="text-sm text-gray-400 dark:text-gray-500 mt-1">Staff login</p>
          </div>

          {/* Role selector */}
          <div className="mb-6">
            <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-3">
              Sign in as
            </p>
            <div className="grid grid-cols-3 gap-2">
              {STAFF_ROLES.map((role) => {
                const Icon   = role.icon
                const active = selectedRole === role.id
                return (
                  <button
                    key={role.id}
                    type="button"
                    onClick={() => { setSelectedRole(role.id); setError('') }}
                    className={clsx(
                      'flex flex-col items-center gap-1.5 p-3 rounded-xl border-2 transition-all duration-150',
                      'text-center text-xs font-medium',
                      active
                        ? 'border-teal-500 bg-teal-50 dark:bg-teal-900/40 text-teal-700 dark:text-teal-300'
                        : 'border-gray-100 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 text-gray-500 dark:text-gray-400 hover:border-gray-200 dark:hover:border-gray-500',
                    )}
                  >
                    <Icon size={20} className={active ? 'text-teal-600 dark:text-teal-400' : 'text-gray-400 dark:text-gray-500'} />
                    <span>{role.id}</span>
                  </button>
                )
              })}
            </div>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            <Input
              label="Email or Username"
              type="text"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="your@email.com or John Smith"
              required
            />

            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                Password <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <input
                  type={showPass ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  className="w-full rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-sm text-gray-900 dark:text-gray-100 py-2.5 pl-3 pr-10 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent placeholder:text-gray-400 dark:placeholder:text-gray-500"
                />
                <button
                  type="button"
                  onClick={() => setShowPass(v => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                >
                  {showPass ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
            </div>

            <div className="text-right -mt-1">
              <Link
                to="/forgot-password"
                className="text-xs text-teal-500 dark:text-teal-400 hover:text-teal-700 dark:hover:text-teal-300 transition-colors"
              >
                Forgot password?
              </Link>
            </div>

            {error && (
              <div className="flex items-center gap-2 px-3 py-2.5 bg-red-50 dark:bg-red-900/20 border border-red-100 dark:border-red-800 rounded-lg">
                <AlertCircle size={14} className="text-red-500 flex-shrink-0" />
                <p className="text-xs text-red-600 dark:text-red-400">{error}</p>
              </div>
            )}

            <Button type="submit" fullWidth loading={submitting} size="lg">
              {submitting ? 'Signing in…' : 'Sign in'}
            </Button>
          </form>
        </div>

        <p className="text-center text-xs text-gray-400 dark:text-gray-600 mt-4">
          POS System v1.0
        </p>
      </div>
    </div>
  )
}
