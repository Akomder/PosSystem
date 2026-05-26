import { useState } from 'react'
import {
  X, User, Mail, Shield, KeyRound, Save, LogOut,
  Eye, EyeOff, CheckCircle, AlertCircle, ChevronDown,
} from 'lucide-react'
import clsx from 'clsx'
import { authApi } from '../../services/api'
import { useAuth } from '../../context/AuthContext'
import { getInitials } from '../../utils/formatters'
import Badge from '../ui/Badge'

const ROLE_GRADIENT = {
  Admin:   'from-teal-500 to-cyan-500',
  Waiter:  'from-blue-500 to-indigo-500',
  Cashier: 'from-amber-500 to-orange-500',
  default: 'from-slate-500 to-gray-600',
}

const ROLE_BG = {
  Admin:   'bg-teal-600',
  Waiter:  'bg-blue-600',
  Cashier: 'bg-amber-500',
  default: 'bg-slate-600',
}

function ToggleSection({ label, open, onToggle, children }) {
  return (
    <div className="border border-gray-100 dark:border-gray-700 rounded-xl overflow-hidden">
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between px-4 py-3 bg-gray-50 dark:bg-gray-700/50 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors text-sm font-semibold text-gray-700 dark:text-gray-200"
      >
        {label}
        <ChevronDown size={15} className={clsx('text-gray-400 transition-transform duration-200', open && 'rotate-180')} />
      </button>
      {open && <div className="px-4 py-4 space-y-3">{children}</div>}
    </div>
  )
}

function PasswordInput({ label, value, onChange, show, onToggleShow }) {
  return (
    <div>
      <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">{label}</label>
      <div className="relative">
        <input
          type={show ? 'text' : 'password'}
          value={value}
          onChange={onChange}
          className="w-full text-sm bg-gray-50 dark:bg-gray-700/50 border border-gray-200 dark:border-gray-600 rounded-lg px-3 py-2.5 pr-10 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent"
        />
        <button
          type="button"
          onClick={onToggleShow}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
        >
          {show ? <EyeOff size={14} /> : <Eye size={14} />}
        </button>
      </div>
    </div>
  )
}

export default function ProfileModal({ isOpen, onClose }) {
  const { user, logout, updateUser } = useAuth()

  // Edit profile state
  const [editSection, setEditSection] = useState(false)
  const [pwSection,   setPwSection]   = useState(false)
  const [editName,    setEditName]    = useState(user?.name || '')
  const [showCur,     setShowCur]     = useState(false)
  const [showNew,     setShowNew]     = useState(false)
  const [showConf,    setShowConf]    = useState(false)
  const [pwForm,      setPwForm]      = useState({ current: '', next: '', confirm: '' })
  const [saving,      setSaving]      = useState(false)
  const [pwSaving,    setPwSaving]    = useState(false)
  const [toast,       setToast]       = useState(null)   // { type: 'success'|'error', msg }

  if (!isOpen) return null

  const gradient  = ROLE_GRADIENT[user?.role] || ROLE_GRADIENT.default
  const roleBg    = ROLE_BG[user?.role] || ROLE_BG.default
  const roleLabel = user?.role || 'User'

  function showToast(type, msg) {
    setToast({ type, msg })
    setTimeout(() => setToast(null), 3000)
  }

  async function handleSaveName() {
    if (!editName.trim()) return
    setSaving(true)
    try {
      await authApi.updateProfile(editName.trim())
      updateUser({ name: editName.trim() })
      setEditSection(false)
      showToast('success', 'Profile updated successfully')
    } catch (e) {
      showToast('error', e.message || 'Failed to update profile')
    }
    setSaving(false)
  }

  async function handleChangePassword() {
    const { current, next, confirm } = pwForm
    if (!current || !next || !confirm) return showToast('error', 'All fields are required')
    if (next !== confirm)              return showToast('error', 'New passwords do not match')
    if (next.length < 6)              return showToast('error', 'Password must be at least 6 characters')
    setPwSaving(true)
    try {
      await authApi.changePassword(current, next)
      setPwForm({ current: '', next: '', confirm: '' })
      setPwSection(false)
      showToast('success', 'Password changed successfully')
    } catch (e) {
      showToast('error', e.message || 'Failed to change password')
    }
    setPwSaving(false)
  }

  function handleLogout() {
    onClose()
    logout()
  }

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50"
        onClick={onClose}
      />

      {/* Panel */}
      <div className="fixed bottom-4 left-4 z-50 w-80 rounded-2xl overflow-hidden shadow-2xl
                      border border-white/10 dark:border-gray-700
                      animate-[scale-in_0.18s_ease-out]">

        {/* Hero header */}
        <div className={clsx('relative bg-gradient-to-br', gradient, 'px-6 pt-6 pb-8')}>
          {/* Decorative blobs */}
          <div className="absolute top-0 right-0 w-24 h-24 bg-white/10 rounded-full -translate-y-8 translate-x-8" />
          <div className="absolute bottom-0 left-0 w-16 h-16 bg-white/10 rounded-full translate-y-6 -translate-x-4" />

          {/* Close button */}
          <button
            onClick={onClose}
            className="absolute top-3 right-3 p-1.5 bg-white/20 hover:bg-white/30 rounded-lg text-white transition-colors"
          >
            <X size={14} />
          </button>

          {/* Avatar */}
          <div className="relative mb-3">
            <div className={clsx(
              'w-16 h-16 rounded-2xl flex items-center justify-center shadow-lg',
              'ring-4 ring-white/30',
              roleBg,
            )}>
              <span className="text-xl font-bold text-white">{getInitials(user?.name || '')}</span>
            </div>
            {/* Online dot */}
            <span className="absolute -bottom-1 -right-1 w-4 h-4 bg-green-400 border-2 border-white rounded-full" />
          </div>

          <h3 className="text-white font-bold text-lg leading-tight">{user?.name}</h3>
          <p className="text-white/70 text-xs mt-0.5">{user?.email}</p>
          <div className="mt-2">
            <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-white/20 rounded-full text-white text-xs font-medium">
              <Shield size={10} />
              {roleLabel}
            </span>
          </div>
        </div>

        {/* Body */}
        <div className="bg-white dark:bg-gray-800 px-4 py-4 space-y-3">

          {/* Toast notification */}
          {toast && (
            <div className={clsx(
              'flex items-center gap-2 px-3 py-2.5 rounded-lg text-xs font-medium',
              toast.type === 'success'
                ? 'bg-green-50 dark:bg-green-900/30 text-green-700 dark:text-green-400 border border-green-200 dark:border-green-800'
                : 'bg-red-50 dark:bg-red-900/30 text-red-700 dark:text-red-400 border border-red-200 dark:border-red-800',
            )}>
              {toast.type === 'success'
                ? <CheckCircle size={13} />
                : <AlertCircle size={13} />
              }
              {toast.msg}
            </div>
          )}

          {/* Edit Profile section */}
          <ToggleSection
            label={<span className="flex items-center gap-2"><User size={13} className="text-teal-500" /> Edit Profile</span>}
            open={editSection}
            onToggle={() => { setEditSection(p => !p); if (!editSection) setEditName(user?.name || '') }}
          >
            <div>
              <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Full Name</label>
              <input
                type="text"
                value={editName}
                onChange={e => setEditName(e.target.value)}
                className="w-full text-sm bg-gray-50 dark:bg-gray-700/50 border border-gray-200 dark:border-gray-600 rounded-lg px-3 py-2.5 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Email</label>
              <div className="flex items-center gap-2 px-3 py-2.5 bg-gray-100 dark:bg-gray-700 rounded-lg">
                <Mail size={13} className="text-gray-400 flex-shrink-0" />
                <span className="text-sm text-gray-500 dark:text-gray-400">{user?.email}</span>
              </div>
            </div>
            <button
              onClick={handleSaveName}
              disabled={saving || !editName.trim() || editName.trim() === user?.name}
              className="flex items-center justify-center gap-2 w-full py-2.5 bg-teal-600 hover:bg-teal-700 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-medium rounded-lg transition-colors"
            >
              {saving
                ? <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                : <><Save size={13} /> Save Changes</>
              }
            </button>
          </ToggleSection>

          {/* Change Password section */}
          <ToggleSection
            label={<span className="flex items-center gap-2"><KeyRound size={13} className="text-teal-500" /> Change Password</span>}
            open={pwSection}
            onToggle={() => { setPwSection(p => !p); if (!pwSection) setPwForm({ current: '', next: '', confirm: '' }) }}
          >
            <PasswordInput
              label="Current Password"
              value={pwForm.current}
              onChange={e => setPwForm(f => ({ ...f, current: e.target.value }))}
              show={showCur}
              onToggleShow={() => setShowCur(p => !p)}
            />
            <PasswordInput
              label="New Password"
              value={pwForm.next}
              onChange={e => setPwForm(f => ({ ...f, next: e.target.value }))}
              show={showNew}
              onToggleShow={() => setShowNew(p => !p)}
            />
            <PasswordInput
              label="Confirm New Password"
              value={pwForm.confirm}
              onChange={e => setPwForm(f => ({ ...f, confirm: e.target.value }))}
              show={showConf}
              onToggleShow={() => setShowConf(p => !p)}
            />
            <button
              onClick={handleChangePassword}
              disabled={pwSaving}
              className="flex items-center justify-center gap-2 w-full py-2.5 bg-teal-600 hover:bg-teal-700 disabled:opacity-50 text-white text-sm font-medium rounded-lg transition-colors"
            >
              {pwSaving
                ? <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                : <><KeyRound size={13} /> Update Password</>
              }
            </button>
          </ToggleSection>

          {/* Logout */}
          <button
            onClick={handleLogout}
            className="flex items-center justify-center gap-2 w-full py-2.5 mt-1
                       bg-red-50 dark:bg-red-900/20 hover:bg-red-100 dark:hover:bg-red-900/40
                       text-red-600 dark:text-red-400 text-sm font-medium rounded-xl
                       border border-red-200 dark:border-red-800/50 transition-colors"
          >
            <LogOut size={14} />
            Sign Out
          </button>
        </div>
      </div>
    </>
  )
}
