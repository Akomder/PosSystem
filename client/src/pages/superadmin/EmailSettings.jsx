import { useState, useEffect } from 'react'
import {
  Mail, Send, Settings, CheckCircle, AlertCircle,
  ExternalLink, Info, Zap, Server,
} from 'lucide-react'
import clsx from 'clsx'
import { emailApi } from '../../services/api'

const inputCls = 'w-full bg-gray-800 border border-gray-700 text-gray-100 text-sm rounded-xl px-3 py-2.5 focus:outline-none focus:border-violet-500 placeholder-gray-600 transition-colors'

function Field({ label, hint, children }) {
  return (
    <div>
      <label className="block text-xs font-medium text-gray-400 mb-1.5">{label}</label>
      {children}
      {hint && <p className="text-xs text-gray-600 mt-1">{hint}</p>}
    </div>
  )
}

function StatusBadge({ configured }) {
  return (
    <span className={clsx(
      'inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full',
      configured
        ? 'bg-emerald-900/40 text-emerald-400 border border-emerald-700/40'
        : 'bg-amber-900/40 text-amber-400 border border-amber-700/40',
    )}>
      <span className={clsx('w-1.5 h-1.5 rounded-full', configured ? 'bg-emerald-400' : 'bg-amber-400')} />
      {configured ? 'SMTP Connected' : 'Dev Mode (Ethereal)'}
    </span>
  )
}

// ─── How-to guide cards ───────────────────────────────────────────────────────
const PROVIDERS = [
  {
    name:  'Gmail',
    icon:  '📧',
    color: 'border-red-700/30 bg-red-900/10',
    steps: [
      'Enable 2-factor authentication on your Google account',
      'Go to Google Account → Security → App passwords',
      'Create an app password for "Mail"',
      'Use smtp.gmail.com / port 587 / your Gmail address / the app password',
    ],
  },
  {
    name:  'Outlook / Office 365',
    icon:  '📨',
    color: 'border-blue-700/30 bg-blue-900/10',
    steps: [
      'Use smtp.office365.com / port 587',
      'Enter your full Outlook email and password',
      'Make sure SMTP AUTH is enabled in your account settings',
    ],
  },
  {
    name:  'Custom SMTP',
    icon:  '🖥️',
    color: 'border-violet-700/30 bg-violet-900/10',
    steps: [
      'Get SMTP host, port, username, and password from your email provider',
      'Port 587 with STARTTLS (SMTP_SECURE=false) is standard',
      'Port 465 with SSL requires SMTP_SECURE=true',
    ],
  },
]

// ─── Main Component ───────────────────────────────────────────────────────────
export default function EmailSettings() {
  const [config,  setConfig]  = useState(null)
  const [loading, setLoading] = useState(true)

  // Test email state
  const [testTo,      setTestTo]      = useState('')
  const [testing,     setTesting]     = useState(false)
  const [testResult,  setTestResult]  = useState(null)  // { success, message, previewUrl }

  useEffect(() => {
    emailApi.getConfig()
      .then(setConfig)
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [])

  const handleTest = async (e) => {
    e.preventDefault()
    if (!testTo.trim()) return
    setTesting(true)
    setTestResult(null)
    try {
      const res = await emailApi.testEmail(testTo.trim())
      setTestResult({ success: true, message: res.message, previewUrl: res.previewUrl })
    } catch (err) {
      setTestResult({ success: false, message: err.message || 'Failed to send test email' })
    } finally {
      setTesting(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="flex items-center gap-3 text-gray-500">
          <div className="w-5 h-5 border-2 border-violet-500 border-t-transparent rounded-full animate-spin" />
          <span className="text-sm">Loading email config…</span>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6 max-w-3xl">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-bold text-white">Email Settings</h1>
          <p className="text-sm text-gray-500 mt-0.5">Configure SMTP for password resets and staff notifications</p>
        </div>
        {config && <StatusBadge configured={config.configured} />}
      </div>

      {/* Current Config Card */}
      {config && (
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5 space-y-4">
          <div className="flex items-center gap-2 mb-2">
            <Server size={15} className="text-violet-400" />
            <h2 className="text-sm font-semibold text-gray-200">Current Configuration</h2>
          </div>

          <div className="grid grid-cols-2 gap-3 text-sm">
            {[
              { label: 'Mode',       value: config.configured ? 'Real SMTP' : 'Ethereal (dev)' },
              { label: 'SMTP Host',  value: config.host },
              { label: 'Port',       value: config.port },
              { label: 'Secure',     value: config.secure === 'true' ? 'SSL (465)' : 'STARTTLS (587)' },
              { label: 'From Name',  value: config.fromName },
              { label: 'From Email', value: config.fromEmail },
            ].map(({ label, value }) => (
              <div key={label} className="bg-gray-800/60 rounded-xl px-3 py-2.5">
                <p className="text-xs text-gray-500 mb-0.5">{label}</p>
                <p className="text-sm text-gray-200 font-medium truncate">{value}</p>
              </div>
            ))}
          </div>

          {!config.configured && (
            <div className="flex items-start gap-2.5 bg-amber-900/20 border border-amber-700/30 rounded-xl px-4 py-3">
              <Info size={15} className="text-amber-400 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-xs font-semibold text-amber-400 mb-0.5">Development Mode Active</p>
                <p className="text-xs text-amber-600 leading-relaxed">
                  No real emails are sent. All emails go to Ethereal's fake inbox.
                  A preview link appears after each send so you can inspect the email.
                  Set <code className="bg-amber-900/40 px-1 rounded">SMTP_HOST</code> in the server's <code className="bg-amber-900/40 px-1 rounded">.env</code> file to enable real sending.
                </p>
              </div>
            </div>
          )}
        </div>
      )}

      {/* How to configure .env */}
      <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5 space-y-4">
        <div className="flex items-center gap-2">
          <Settings size={15} className="text-violet-400" />
          <h2 className="text-sm font-semibold text-gray-200">How to Configure SMTP</h2>
        </div>
        <p className="text-xs text-gray-500 leading-relaxed">
          Edit <code className="bg-gray-800 text-violet-300 px-1.5 py-0.5 rounded font-mono text-xs">server/.env</code> and add these variables, then restart the server:
        </p>
        <div className="bg-gray-950 rounded-xl p-4 font-mono text-xs text-gray-300 leading-relaxed overflow-x-auto">
          <span className="text-gray-600"># SMTP Configuration</span>{'\n'}
          <span className="text-emerald-400">SMTP_HOST</span>=smtp.gmail.com{'\n'}
          <span className="text-emerald-400">SMTP_PORT</span>=587{'\n'}
          <span className="text-emerald-400">SMTP_SECURE</span>=false{'\n'}
          <span className="text-emerald-400">SMTP_USER</span>=you@gmail.com{'\n'}
          <span className="text-emerald-400">SMTP_PASS</span>=your-app-password{'\n'}
          <span className="text-emerald-400">EMAIL_FROM_NAME</span>=My Restaurant POS{'\n'}
          <span className="text-emerald-400">EMAIL_FROM_ADDRESS</span>=noreply@myrestaurant.com{'\n'}
          <span className="text-emerald-400">APP_URL</span>=https://myrestaurant.com
        </div>
      </div>

      {/* Provider guides */}
      <div className="space-y-3">
        <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider">Provider Guides</h2>
        <div className="grid gap-3">
          {PROVIDERS.map(p => (
            <div key={p.name} className={clsx('border rounded-2xl p-4', p.color)}>
              <div className="flex items-center gap-2 mb-3">
                <span className="text-lg">{p.icon}</span>
                <h3 className="text-sm font-semibold text-gray-200">{p.name}</h3>
              </div>
              <ol className="space-y-1.5">
                {p.steps.map((step, i) => (
                  <li key={i} className="flex items-start gap-2 text-xs text-gray-400">
                    <span className="flex-shrink-0 w-5 h-5 rounded-full bg-gray-800/80 text-gray-500 flex items-center justify-center text-[10px] font-bold mt-0.5">{i+1}</span>
                    {step}
                  </li>
                ))}
              </ol>
            </div>
          ))}
        </div>
      </div>

      {/* Send Test Email */}
      <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5 space-y-4">
        <div className="flex items-center gap-2">
          <Zap size={15} className="text-violet-400" />
          <h2 className="text-sm font-semibold text-gray-200">Send Test Email</h2>
        </div>
        <p className="text-xs text-gray-500">
          Verify your configuration by sending a test email right now.
        </p>

        <form onSubmit={handleTest} className="flex gap-3">
          <div className="flex-1">
            <Field label="Recipient Email">
              <input
                type="email"
                className={inputCls}
                placeholder="test@example.com"
                value={testTo}
                onChange={e => setTestTo(e.target.value)}
              />
            </Field>
          </div>
          <div className="flex items-end">
            <button
              type="submit"
              disabled={testing || !testTo.trim()}
              className="flex items-center gap-2 px-5 py-2.5 bg-violet-600 hover:bg-violet-500 disabled:opacity-50 text-white text-sm font-medium rounded-xl transition-colors"
            >
              {testing ? (
                <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <Send size={14} />
              )}
              {testing ? 'Sending…' : 'Send Test'}
            </button>
          </div>
        </form>

        {/* Test result */}
        {testResult && (
          <div className={clsx(
            'flex items-start gap-3 rounded-xl px-4 py-3 border',
            testResult.success
              ? 'bg-emerald-900/20 border-emerald-700/40 text-emerald-300'
              : 'bg-red-900/20 border-red-700/40 text-red-300',
          )}>
            {testResult.success
              ? <CheckCircle size={15} className="flex-shrink-0 mt-0.5" />
              : <AlertCircle size={15} className="flex-shrink-0 mt-0.5" />
            }
            <div className="text-xs leading-relaxed">
              <p className="font-medium">{testResult.message}</p>
              {testResult.previewUrl && (
                <a
                  href={testResult.previewUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 mt-2 text-amber-400 hover:text-amber-300 underline underline-offset-2"
                >
                  <ExternalLink size={11} />
                  View email preview (Ethereal)
                </a>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Email triggers reference */}
      <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5">
        <div className="flex items-center gap-2 mb-4">
          <Mail size={15} className="text-violet-400" />
          <h2 className="text-sm font-semibold text-gray-200">Automated Email Triggers</h2>
        </div>
        <div className="space-y-2">
          {[
            { trigger: 'Staff account created',         template: 'Welcome email with login credentials',         icon: '👤' },
            { trigger: 'New restaurant onboarded',      template: 'Restaurant welcome email with setup details',   icon: '🏪' },
            { trigger: 'Forgot password request',       template: 'Password reset link (expires in 30 min)',       icon: '🔑' },
            { trigger: 'Manual test',                   template: 'SMTP configuration test email',                 icon: '🧪' },
          ].map(({ trigger, template, icon }) => (
            <div key={trigger} className="flex items-center gap-3 py-2.5 border-b border-gray-800/60 last:border-0">
              <span className="text-base w-6 text-center">{icon}</span>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-gray-300">{trigger}</p>
                <p className="text-xs text-gray-600 truncate">{template}</p>
              </div>
              <span className="text-xs bg-emerald-900/30 text-emerald-400 px-2 py-0.5 rounded-full border border-emerald-700/30 flex-shrink-0">Active</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
