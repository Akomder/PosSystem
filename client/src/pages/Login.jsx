import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import {
  Shield,
  Eye,
  EyeOff,
  AlertCircle,
} from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { useSettings } from '../context/SettingsContext'
import Button from '../components/ui/Button'
import Input from '../components/ui/Input'

// /login is SuperAdmin-only.
// Restaurant staff must use /{restaurant_slug} to log in.
export default function Login() {
  const { login }    = useAuth()
  const { t }        = useSettings()
  const navigate     = useNavigate()

  const [email,    setEmail]    = useState('')
  const [password, setPassword] = useState('')
  const [showPass, setShowPass] = useState(false)
  const [loading,  setLoading]  = useState(false)
  const [error,    setError]    = useState('')

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
      if (!userData.isSuperAdmin) {
        // Non-superadmin authenticated but used the wrong URL — reject & clear session
        setError("This login is for SuperAdmin only. Please use your restaurant's login URL.")
        localStorage.removeItem('pos_user')
        localStorage.removeItem('pos_sa_user')
        return
      }
      navigate('/superadmin')
    } catch (err) {
      setError(err.message || t('login.errorFailed'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-gray-100 dark:from-gray-900 dark:via-gray-900 dark:to-gray-800 flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        {/* Card */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl border border-gray-100 dark:border-gray-700 p-8">

          {/* Logo */}
          <div className="flex flex-col items-center mb-8">
            <div className="w-14 h-14 bg-slate-700 dark:bg-slate-600 rounded-2xl flex items-center justify-center shadow-lg mb-4">
              <Shield size={26} className="text-white" />
            </div>
            <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">ERROR POS</h1>
            <p className="text-sm text-gray-400 dark:text-gray-500 mt-1">SuperAdmin Login</p>
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
                  className="w-full rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-sm text-gray-900 dark:text-gray-100 py-2.5 pl-3 pr-10 focus:outline-none focus:ring-2 focus:ring-slate-500 focus:border-transparent placeholder:text-gray-400 dark:placeholder:text-gray-500"
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
                className="text-xs text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300 transition-colors"
              >
                Forgot password?
              </Link>
            </div>

            {/* Error */}
            {error && (
              <div className="flex items-start gap-2 px-3 py-2.5 bg-red-50 dark:bg-red-900/20 border border-red-100 dark:border-red-800 rounded-lg">
                <AlertCircle size={14} className="text-red-500 flex-shrink-0 mt-0.5" />
                <p className="text-xs text-red-600 dark:text-red-400">{error}</p>
              </div>
            )}

            <Button type="submit" fullWidth loading={loading} size="lg">
              {loading ? t('login.signingIn') : t('login.signIn')}
            </Button>
          </form>

          {/* Restaurant staff hint */}
          <p className="text-center text-xs text-gray-400 dark:text-gray-500 mt-5 leading-relaxed">
            Contact us.{' '}
            <a
              href="mailto:soukakom2018@gmail.com"
              className="text-slate-500 dark:text-slate-400 hover:underline"
            >
              soukakom2018@gmail.com
            </a>
            {' '}or{' '}
            <a
              href="https://wa.me/85620028398610"
              target="_blank"
              rel="noreferrer"
              className="text-slate-500 dark:text-slate-400 hover:underline"
            >
              +856 20 28398610
            </a>
          </p>
        </div>

        <p className="text-center text-xs text-gray-400 dark:text-gray-600 mt-4">
          {t('login.version')}
        </p>
      </div>
    </div>
  )
}
