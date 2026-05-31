import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Mail, ArrowLeft, CheckCircle, AlertCircle } from 'lucide-react'
import { emailApi } from '../services/api'

export default function ForgotPassword() {
  const [email,   setEmail]   = useState('')
  const [loading, setLoading] = useState(false)
  const [sent,    setSent]    = useState(false)
  const [error,   setError]   = useState('')

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!email.trim()) { setError('Please enter your email address'); return }
    setLoading(true)
    setError('')
    try {
      const res = await emailApi.forgotPassword(email.trim())
      setSent(true)
    } catch (err) {
      setError(err.message || 'Something went wrong. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-900 to-teal-950 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Card */}
        <div className="bg-white dark:bg-gray-800 rounded-3xl shadow-2xl shadow-black/30 overflow-hidden">

          {/* Header */}
          <div className="bg-gradient-to-r from-teal-600 to-violet-600 px-8 py-8 text-center">
            <div className="w-16 h-16 bg-white/20 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <Mail size={28} className="text-white" />
            </div>
            <h1 className="text-xl font-bold text-white">Forgot Password?</h1>
            <p className="text-sm text-teal-200 mt-1">
              We'll send you a reset link instantly
            </p>
          </div>

          <div className="px-8 py-8">
            {sent ? (
              /* ── Success state ──────────────────────────────────────── */
              <div className="space-y-5 text-center">
                <div className="w-16 h-16 bg-green-100 dark:bg-green-900/30 rounded-2xl flex items-center justify-center mx-auto">
                  <CheckCircle size={32} className="text-green-600 dark:text-green-400" />
                </div>
                <div>
                  <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100 mb-2">Check your inbox</h2>
                  <p className="text-sm text-gray-500 dark:text-gray-400 leading-relaxed">
                    If <strong className="text-gray-700 dark:text-gray-200">{email}</strong> is registered,
                    you'll receive a password reset link within a few minutes.
                    The link expires in <strong>30 minutes</strong>.
                  </p>
                </div>


                <Link
                  to="/login"
                  className="inline-flex items-center gap-2 text-sm text-teal-600 dark:text-teal-400 hover:text-teal-800 dark:hover:text-teal-300 font-medium transition-colors"
                >
                  <ArrowLeft size={14} /> Back to Sign In
                </Link>
              </div>
            ) : (
              /* ── Form ────────────────────────────────────────────────── */
              <form onSubmit={handleSubmit} className="space-y-5">
                <p className="text-sm text-gray-500 dark:text-gray-400 leading-relaxed">
                  Enter the email address linked to your account and we'll send you a secure link to reset your password.
                </p>

                {error && (
                  <div className="flex items-start gap-2.5 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700/50 text-red-700 dark:text-red-400 rounded-xl px-4 py-3">
                    <AlertCircle size={15} className="flex-shrink-0 mt-0.5" />
                    <span className="text-sm">{error}</span>
                  </div>
                )}

                <div>
                  <label className="block text-xs font-semibold text-gray-600 dark:text-gray-300 mb-2 uppercase tracking-wider">
                    Email Address
                  </label>
                  <div className="relative">
                    <Mail size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
                    <input
                      type="email"
                      value={email}
                      onChange={e => setEmail(e.target.value)}
                      placeholder="you@example.com"
                      autoFocus
                      className="w-full pl-10 pr-4 py-3 rounded-xl border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700/50 text-gray-900 dark:text-gray-100 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent transition placeholder-gray-400"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-3 bg-gradient-to-r from-teal-600 to-violet-600 hover:from-teal-500 hover:to-violet-500 disabled:opacity-60 text-white font-semibold rounded-xl transition-all shadow-lg shadow-teal-500/30 text-sm"
                >
                  {loading ? (
                    <span className="flex items-center justify-center gap-2">
                      <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      Sending…
                    </span>
                  ) : 'Send Reset Link'}
                </button>

                <div className="text-center">
                  <Link
                    to="/login"
                    className="inline-flex items-center gap-1.5 text-sm text-gray-500 dark:text-gray-400 hover:text-teal-600 dark:hover:text-teal-400 transition-colors"
                  >
                    <ArrowLeft size={13} /> Back to Sign In
                  </Link>
                </div>
              </form>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
