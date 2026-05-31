import { useState, useEffect } from 'react'
import {
  Mail, Send, Settings, CheckCircle, AlertCircle,
  ExternalLink, Info, Zap, Server, Save, Eye, EyeOff,
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

function StatusBadge({ configured, source }) {
  const label = configured
    ? source === 'db' ? 'SMTP (DB Config)' : 'SMTP (Env Config)'
    : 'Email Not Configured'
  return (
    <span className={clsx(
      'inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full',
      configured
        ? 'bg-emerald-900/40 text-emerald-400 border border-emerald-700/40'
        : 'bg-amber-900/40 text-amber-400 border border-amber-700/40',
    )}>
      <span className={clsx('w-1.5 h-1.5 rounded-full', configured ? 'bg-emerald-400' : 'bg-amber-400')} />
      {label}
    </span>
  )
}

const PROVIDERS = [
  {
    name: 'Gmail', icon: '📧', color: 'border-red-700/30 bg-red-900/10',
    prefill: { host: 'smtp.gmail.com', port: 587, secure: false },
    steps: [
      'Enable 2-factor authentication on your Google account',
      'Go to Google Account → Security → App passwords',
      'Create an app password for "Mail"',
      'Use smtp.gmail.com / port 587 / your Gmail address / the app password',
    ],
  },
  {
    name: 'Outlook / Office 365', icon: '📨', color: 'border-blue-700/30 bg-blue-900/10',
    prefill: { host: 'smtp.office365.com', port: 587, secure: false },
    steps: [
      'Use smtp.office365.com / port 587',
      'Enter your full Outlook email and password',
      'Make sure SMTP AUTH is enabled in your account settings',
    ],
  },
  {
    name: 'Custom SMTP', icon: '🖥️', color: 'border-violet-700/30 bg-violet-900/10',
    prefill: null,
    steps: [
      'Get SMTP host, port, username, and password from your email provider',
      'Port 587 with STARTTLS (Secure=false) is standard',
      'Port 465 with SSL requires Secure=true',
    ],
  },
]

export default function EmailSettings() {
  const [config,  setConfig]  = useState(null)
  const [loading, setLoading] = useState(true)

  // Edit form
  const [form,    setForm]    = useState({ host:'', port:587, secure:false, user:'', pass:'', fromName:'POS System', fromEmail:'noreply@pos.system' })
  const [saving,  setSaving]  = useState(false)
  const [saveResult, setSaveResult] = useState(null)
  const [showPass,   setShowPass]   = useState(false)

  // Test email
  const [testTo,     setTestTo]     = useState('')
  const [testing,    setTesting]    = useState(false)
  const [testResult, setTestResult] = useState(null)

  const loadConfig = () => {
    setLoading(true)
    emailApi.getConfig()
      .then(cfg => {
        setConfig(cfg)
        setForm({
          host:      cfg.host      || '',
          port:      cfg.port      || 587,
          secure:    cfg.secure    || false,
          user:      cfg.user      || '',
          pass:      '',            // never pre-fill password
          fromName:  cfg.fromName  || 'POS System',
          fromEmail: cfg.fromEmail || 'noreply@pos.system',
        })
      })
      .catch(console.error)
      .finally(() => setLoading(false))
  }

  useEffect(loadConfig, [])

  const handleSave = async (e) => {
    e.preventDefault()
    if (!form.host.trim()) return
    setSaving(true)
    setSaveResult(null)
    try {
      await emailApi.updateConfig(form)
      setSaveResult({ success: true, message: 'Configuration saved and transporter reloaded.' })
      loadConfig()
    } catch (err) {
      setSaveResult({ success: false, message: err.message || 'Failed to save configuration' })
    } finally {
      setSaving(false)
    }
  }

  const handleTest = async (e) => {
    e.preventDefault()
    if (!testTo.trim()) return
    setTesting(true)
    setTestResult(null)
    try {
      const res = await emailApi.testEmail(testTo.trim())
      setTestResult({ success: true, message: res.message })
    } catch (err) {
      setTestResult({ success: false, message: err.message || 'Failed to send test email' })
    } finally {
      setTesting(false)
    }
  }

  const prefill = (p) => {
    if (!p) return
    setForm(f => ({ ...f, host: p.host, port: p.port, secure: p.secure }))
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
        {config && <StatusBadge configured={config.configured} source={config.source} />}
      </div>

      {/* ── SMTP Config Form ────────────────────────────────────────────────── */}
      <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5 space-y-5">
        <div className="flex items-center gap-2">
          <Server size={15} className="text-violet-400" />
          <h2 className="text-sm font-semibold text-gray-200">SMTP Configuration</h2>
        </div>

        {/* Quick-fill provider pills */}
        <div className="flex gap-2 flex-wrap">
          <span className="text-xs text-gray-600 self-center">Quick fill:</span>
          {PROVIDERS.filter(p => p.prefill).map(p => (
            <button
              key={p.name}
              type="button"
              onClick={() => prefill(p.prefill)}
              className="text-xs px-2.5 py-1 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-400 hover:text-gray-200 border border-gray-700 transition-colors"
            >
              {p.icon} {p.name}
            </button>
          ))}
        </div>

        <form onSubmit={handleSave} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <Field label="SMTP Host" hint="e.g. smtp.gmail.com">
              <input className={inputCls} placeholder="smtp.example.com" value={form.host}
                onChange={e => setForm(f => ({ ...f, host: e.target.value }))} />
            </Field>
            <Field label="Port" hint="587 = STARTTLS, 465 = SSL">
              <input className={inputCls} type="number" placeholder="587" value={form.port}
                onChange={e => setForm(f => ({ ...f, port: parseInt(e.target.value) || 587 }))} />
            </Field>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setForm(f => ({ ...f, secure: !f.secure }))}
              className={clsx(
                'relative w-11 h-6 rounded-full transition-colors flex-shrink-0',
                form.secure ? 'bg-violet-600' : 'bg-gray-700'
              )}
            >
              <span className={clsx(
                'absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-transform',
                form.secure ? 'translate-x-6' : 'translate-x-1'
              )} />
            </button>
            <span className="text-sm text-gray-400">
              SSL/TLS (Secure) — {form.secure ? 'enabled (use port 465)' : 'disabled (use port 587 with STARTTLS)'}
            </span>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Field label="SMTP Username / Email">
              <input className={inputCls} type="email" placeholder="you@example.com" value={form.user}
                onChange={e => setForm(f => ({ ...f, user: e.target.value }))} />
            </Field>
            <Field label="SMTP Password" hint={config?.configured ? 'Leave blank to keep existing password' : ''}>
              <div className="relative">
                <input className={inputCls} type={showPass ? 'text' : 'password'}
                  placeholder={config?.configured ? '(unchanged)' : 'password'}
                  value={form.pass}
                  onChange={e => setForm(f => ({ ...f, pass: e.target.value }))} />
                <button type="button" onClick={() => setShowPass(s => !s)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300">
                  {showPass ? <EyeOff size={14} /> : <Eye size={14} />}
                </button>
              </div>
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Field label="From Name">
              <input className={inputCls} placeholder="POS System" value={form.fromName}
                onChange={e => setForm(f => ({ ...f, fromName: e.target.value }))} />
            </Field>
            <Field label="From Email Address">
              <input className={inputCls} type="email" placeholder="noreply@pos.system" value={form.fromEmail}
                onChange={e => setForm(f => ({ ...f, fromEmail: e.target.value }))} />
            </Field>
          </div>

          <div className="flex items-center justify-between pt-1">
            <button
              type="submit"
              disabled={saving || !form.host.trim()}
              className="flex items-center gap-2 px-5 py-2.5 bg-violet-600 hover:bg-violet-500 disabled:opacity-50 text-white text-sm font-medium rounded-xl transition-colors"
            >
              {saving
                ? <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                : <Save size={14} />}
              {saving ? 'Saving…' : 'Save & Reload'}
            </button>
            {saveResult && (
              <span className={clsx('flex items-center gap-1.5 text-xs', saveResult.success ? 'text-emerald-400' : 'text-red-400')}>
                {saveResult.success ? <CheckCircle size={13} /> : <AlertCircle size={13} />}
                {saveResult.message}
              </span>
            )}
          </div>
        </form>
      </div>

      {/* Current config display */}
      {config?.configured && (
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5 space-y-3">
          <div className="flex items-center gap-2">
            <Settings size={15} className="text-violet-400" />
            <h2 className="text-sm font-semibold text-gray-200">Active Configuration</h2>
          </div>
          <div className="grid grid-cols-3 gap-2 text-sm">
            {[
              { label: 'Host',       value: config.host },
              { label: 'Port',       value: config.port },
              { label: 'Secure',     value: config.secure ? 'SSL' : 'STARTTLS' },
              { label: 'Username',   value: config.user  || '—' },
              { label: 'From Name',  value: config.fromName },
              { label: 'From Email', value: config.fromEmail },
            ].map(({ label, value }) => (
              <div key={label} className="bg-gray-800/60 rounded-xl px-3 py-2">
                <p className="text-xs text-gray-500 mb-0.5">{label}</p>
                <p className="text-xs text-gray-200 font-medium truncate">{value}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {!config?.configured && (
        <div className="flex items-start gap-2.5 bg-amber-900/20 border border-amber-700/30 rounded-xl px-4 py-3">
          <Info size={15} className="text-amber-400 flex-shrink-0 mt-0.5" />
          <p className="text-xs text-amber-600 leading-relaxed">
            No SMTP is configured. Emails go to Ethereal's fake inbox. Fill in the form above to enable real sending.
          </p>
        </div>
      )}

      {/* Provider guides */}
      <div className="space-y-3">
        <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider">Provider Setup Guides</h2>
        <div className="grid gap-3">
          {PROVIDERS.map(p => (
            <div key={p.name} className={clsx('border rounded-2xl p-4', p.color)}>
              <div className="flex items-center gap-2 mb-3">
                <span className="text-lg">{p.icon}</span>
                <h3 className="text-sm font-semibold text-gray-200">{p.name}</h3>
                {p.prefill && (
                  <button onClick={() => prefill(p.prefill)}
                    className="ml-auto text-xs px-2 py-0.5 rounded bg-gray-800/80 text-violet-400 hover:bg-gray-700 transition-colors">
                    Use these settings
                  </button>
                )}
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
        <p className="text-xs text-gray-500">Verify your configuration by sending a test email right now.</p>
        <form onSubmit={handleTest} className="flex gap-3">
          <div className="flex-1">
            <Field label="Recipient Email">
              <input type="email" className={inputCls} placeholder="test@example.com"
                value={testTo} onChange={e => setTestTo(e.target.value)} />
            </Field>
          </div>
          <div className="flex items-end">
            <button type="submit" disabled={testing || !testTo.trim()}
              className="flex items-center gap-2 px-5 py-2.5 bg-violet-600 hover:bg-violet-500 disabled:opacity-50 text-white text-sm font-medium rounded-xl transition-colors">
              {testing ? <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <Send size={14} />}
              {testing ? 'Sending…' : 'Send Test'}
            </button>
          </div>
        </form>
        {testResult && (
          <div className={clsx('flex items-start gap-3 rounded-xl px-4 py-3 border',
            testResult.success ? 'bg-emerald-900/20 border-emerald-700/40 text-emerald-300' : 'bg-red-900/20 border-red-700/40 text-red-300')}>
            {testResult.success ? <CheckCircle size={15} className="flex-shrink-0 mt-0.5" /> : <AlertCircle size={15} className="flex-shrink-0 mt-0.5" />}
            <div className="text-xs leading-relaxed">
              <p className="font-medium">{testResult.message}</p>
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
            { trigger: 'Staff account created',    template: 'Welcome email with login credentials',       icon: '👤' },
            { trigger: 'New restaurant onboarded', template: 'Restaurant welcome email with setup details', icon: '🏪' },
            { trigger: 'Forgot password request',  template: 'Password reset link (expires in 30 min)',     icon: '🔑' },
            { trigger: 'Manual test',              template: 'SMTP configuration test email',               icon: '🧪' },
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
