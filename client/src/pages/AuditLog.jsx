import { useState, useEffect } from 'react'
import { Shield, RefreshCw } from 'lucide-react'
import clsx from 'clsx'
import { auditLogsApi } from '../services/api'
import EmptyState from '../components/ui/EmptyState'
import DateRangeFilter from '../components/ui/DateRangeFilter'
import Button from '../components/ui/Button'
import { formatDate, formatTime } from '../utils/formatters'
import { useSettings } from '../context/SettingsContext'

const ACTION_COLORS = {
  create:  'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400',
  update:  'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-400',
  delete:  'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400',
  login:   'bg-teal-100 text-teal-700 dark:bg-teal-900/40 dark:text-teal-400',
  logout:  'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-400',
}

export default function AuditLog() {
  const { t } = useSettings()
  const [logs, setLogs]           = useState([])
  const [loading, setLoading]     = useState(true)
  const [entityFilter, setEntity] = useState('')
  const [dateRange, setDateRange] = useState(null)

  useEffect(() => { load() }, [entityFilter])

  async function load() {
    setLoading(true)
    try {
      const params = { limit: 200 }
      if (entityFilter) params.entityType = entityFilter
      setLogs(await auditLogsApi.getAll(params))
    } catch (_) {}
    setLoading(false)
  }

  const display = dateRange
    ? logs.filter(l => { const d = l.createdAt?.slice(0, 10); return d >= dateRange.from && d <= dateRange.to })
    : logs

  const ENTITY_TYPES = [...new Set(logs.map(l => l.entityType).filter(Boolean))]

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100">{t('audit.title')}</h2>
          <p className="text-sm text-gray-400 dark:text-gray-500 mt-0.5">{t('audit.subtitle')}</p>
        </div>
        <div className="flex items-center gap-2">
          <DateRangeFilter value={dateRange} onChange={setDateRange} />
          <Button size="sm" icon={RefreshCw} variant="secondary" onClick={load}>{t('audit.refresh')}</Button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-2 flex-wrap">
        <button onClick={() => setEntity('')}
          className={clsx('px-3 py-1.5 rounded-lg text-sm font-medium transition-colors',
            entityFilter === ''
              ? 'bg-teal-600 text-white'
              : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-400 border border-gray-200 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700'
          )}
        >{t('audit.all')}</button>
        {ENTITY_TYPES.map(type => (
          <button key={type} onClick={() => setEntity(type)}
            className={clsx('px-3 py-1.5 rounded-lg text-sm font-medium capitalize transition-colors',
              entityFilter === type
                ? 'bg-teal-600 text-white'
                : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-400 border border-gray-200 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700'
            )}
          >{type}</button>
        ))}
      </div>

      {loading ? (
        <div className="flex justify-center py-16"><div className="w-5 h-5 border-2 border-teal-500 border-t-transparent rounded-full animate-spin" /></div>
      ) : display.length === 0 ? (
        <EmptyState icon={Shield} title={t('audit.noLogs')} description={t('audit.noLogsDesc')} />
      ) : (
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 dark:border-gray-700 text-xs text-gray-500 dark:text-gray-400 uppercase">
                <th className="px-5 py-3 text-left">{t('audit.col.time')}</th>
                <th className="px-5 py-3 text-left">{t('audit.col.user')}</th>
                <th className="px-5 py-3 text-left">{t('audit.col.action')}</th>
                <th className="px-5 py-3 text-left">{t('audit.col.entity')}</th>
                <th className="px-5 py-3 text-left">{t('audit.col.id')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50 dark:divide-gray-700">
              {display.map(log => (
                <tr key={log.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                  <td className="px-5 py-3 text-gray-400 dark:text-gray-500 text-xs whitespace-nowrap">
                    {formatDate(log.createdAt)} {formatTime(log.createdAt)}
                  </td>
                  <td className="px-5 py-3">
                    <span className="font-medium text-gray-900 dark:text-gray-100">{log.userName || 'System'}</span>
                  </td>
                  <td className="px-5 py-3">
                    <span className={clsx('px-2 py-0.5 rounded-full text-xs font-medium capitalize',
                      ACTION_COLORS[log.action] || 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-400'
                    )}>
                      {log.action}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-gray-600 dark:text-gray-400 capitalize">{log.entityType}</td>
                  <td className="px-5 py-3 text-gray-400 dark:text-gray-500 font-mono text-xs">{log.entityId}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
