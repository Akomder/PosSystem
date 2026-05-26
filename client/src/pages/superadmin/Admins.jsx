import { useState, useEffect } from 'react'
import { Users, Plus, Trash2, Shield, X, AlertCircle, CheckCircle } from 'lucide-react'
import clsx from 'clsx'
import { superadminApi } from '../../services/api'
import { useAuth } from '../../context/AuthContext'

const inputCls = 'w-full bg-gray-800 border border-gray-700 text-gray-100 text-sm rounded-xl px-3 py-2.5 focus:outline-none focus:border-violet-500 placeholder-gray-600 transition-colors'

function Modal({ onClose, children }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="bg-gray-900 border border-gray-800 rounded-2xl w-full max-w-md shadow-2xl">
        {children}
      </div>
    </div>
  )
}

export default function Admins() {
  const { user: me } = useAuth()
  const [admins,  setAdmins]  = useState([])
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState(null)

  // Create modal
  const [showCreate, setShowCreate] = useState(false)
  const [form,       setForm]       = useState({ name: '', email: '', password: '' })
  const [creating,   setCreating]   = useState(false)
  const [createErr,  setCreateErr]  = useState(null)

  // Delete confirm
  const [deleting, setDeleting] = useState(null)  // id being deleted

  const load = async () => {
    setLoading(true)
    try {
      const data = await superadminApi.getAdmins()
      setAdmins(data)
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  const handleCreate = async (e) => {
    e.preventDefault()
    if (!form.name || !form.email || !form.password) return
    setCreating(true)
    setCreateErr(null)
    try {
      await superadminApi.createAdmin(form)
      setShowCreate(false)
      setForm({ name: '', email: '', password: '' })
      load()
    } catch (e) {
      setCreateErr(e.message || 'Failed to create admin')
    } finally {
      setCreating(false)
    }
  }

  const handleDelete = async (id) => {
    try {
      await superadminApi.deleteAdmin(id)
      setDeleting(null)
      load()
    } catch (e) {
      alert(e.message || 'Failed to delete admin')
    }
  }

  const fmt = (iso) => iso ? new Date(iso).toLocaleDateString('en', { year:'numeric', month:'short', day:'numeric' }) : '—'

  return (
    <div className="space-y-6 max-w-3xl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-white">SuperAdmin Users</h1>
          <p className="text-sm text-gray-500 mt-0.5">Manage accounts with full system access</p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="flex items-center gap-2 px-4 py-2 bg-violet-600 hover:bg-violet-500 text-white text-sm font-medium rounded-xl transition-colors"
        >
          <Plus size={15} /> Add SuperAdmin
        </button>
      </div>

      {/* Table */}
      <div className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center h-40 text-gray-500 text-sm">
            <div className="w-5 h-5 border-2 border-violet-500 border-t-transparent rounded-full animate-spin mr-3" />
            Loading…
          </div>
        ) : error ? (
          <div className="flex items-center gap-2 p-6 text-red-400 text-sm">
            <AlertCircle size={16} /> {error}
          </div>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-800">
                <th className="text-left text-xs font-medium text-gray-500 px-5 py-3">Name</th>
                <th className="text-left text-xs font-medium text-gray-500 px-5 py-3">Email</th>
                <th className="text-left text-xs font-medium text-gray-500 px-5 py-3">Created</th>
                <th className="w-16 px-5 py-3" />
              </tr>
            </thead>
            <tbody>
              {admins.map(a => (
                <tr key={a.id} className="border-b border-gray-800/50 last:border-0 hover:bg-gray-800/30 transition-colors">
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-violet-700 flex items-center justify-center flex-shrink-0">
                        <span className="text-xs font-bold text-white">{a.name.slice(0,2).toUpperCase()}</span>
                      </div>
                      <div>
                        <p className="text-sm font-medium text-gray-200">{a.name}</p>
                        {a.id === me?.id && (
                          <span className="text-[10px] bg-violet-900/50 text-violet-400 px-1.5 py-0.5 rounded-full">You</span>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="px-5 py-3 text-sm text-gray-400">{a.email}</td>
                  <td className="px-5 py-3 text-sm text-gray-500">{fmt(a.createdAt)}</td>
                  <td className="px-5 py-3">
                    {a.id !== me?.id && (
                      <button
                        onClick={() => setDeleting(a)}
                        className="p-1.5 text-gray-600 hover:text-red-400 hover:bg-red-900/20 rounded-lg transition-colors"
                        title="Delete admin"
                      >
                        <Trash2 size={14} />
                      </button>
                    )}
                  </td>
                </tr>
              ))}
              {!admins.length && (
                <tr>
                  <td colSpan={4} className="px-5 py-12 text-center text-gray-600 text-sm">
                    No SuperAdmin accounts found
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        )}
      </div>

      {/* Create Modal */}
      {showCreate && (
        <Modal onClose={() => setShowCreate(false)}>
          <div className="flex items-center justify-between px-5 py-4 border-b border-gray-800">
            <div className="flex items-center gap-2">
              <Shield size={16} className="text-violet-400" />
              <h2 className="text-sm font-semibold text-white">New SuperAdmin</h2>
            </div>
            <button onClick={() => setShowCreate(false)} className="text-gray-500 hover:text-gray-300 transition-colors">
              <X size={16} />
            </button>
          </div>
          <form onSubmit={handleCreate} className="p-5 space-y-4">
            {createErr && (
              <div className="flex items-center gap-2 text-xs text-red-400 bg-red-900/20 border border-red-700/30 rounded-xl px-3 py-2">
                <AlertCircle size={13} /> {createErr}
              </div>
            )}
            {[
              { key: 'name',     label: 'Full Name',    type: 'text',     placeholder: 'Jane Smith' },
              { key: 'email',    label: 'Email',        type: 'email',    placeholder: 'admin@pos.system' },
              { key: 'password', label: 'Password',     type: 'password', placeholder: 'min 8 characters' },
            ].map(f => (
              <div key={f.key}>
                <label className="block text-xs font-medium text-gray-400 mb-1.5">{f.label}</label>
                <input
                  className={inputCls}
                  type={f.type}
                  placeholder={f.placeholder}
                  value={form[f.key]}
                  onChange={e => setForm(p => ({ ...p, [f.key]: e.target.value }))}
                  required
                />
              </div>
            ))}
            <div className="flex gap-3 pt-1">
              <button type="button" onClick={() => setShowCreate(false)}
                className="flex-1 py-2.5 text-sm text-gray-400 hover:text-gray-200 border border-gray-700 hover:border-gray-600 rounded-xl transition-colors">
                Cancel
              </button>
              <button type="submit" disabled={creating}
                className="flex-1 flex items-center justify-center gap-2 py-2.5 text-sm font-medium bg-violet-600 hover:bg-violet-500 disabled:opacity-50 text-white rounded-xl transition-colors">
                {creating
                  ? <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  : <Plus size={14} />}
                {creating ? 'Creating…' : 'Create Admin'}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* Delete Confirm Modal */}
      {deleting && (
        <Modal onClose={() => setDeleting(null)}>
          <div className="p-5 space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-red-900/40 flex items-center justify-center flex-shrink-0">
                <Trash2 size={18} className="text-red-400" />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-white">Delete SuperAdmin?</h3>
                <p className="text-xs text-gray-500 mt-0.5">This will remove <strong className="text-gray-300">{deleting.name}</strong>'s access permanently.</p>
              </div>
            </div>
            <div className="flex gap-3">
              <button onClick={() => setDeleting(null)}
                className="flex-1 py-2.5 text-sm text-gray-400 border border-gray-700 rounded-xl hover:border-gray-600 transition-colors">
                Cancel
              </button>
              <button onClick={() => handleDelete(deleting.id)}
                className="flex-1 py-2.5 text-sm font-medium bg-red-600 hover:bg-red-500 text-white rounded-xl transition-colors">
                Delete
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  )
}
