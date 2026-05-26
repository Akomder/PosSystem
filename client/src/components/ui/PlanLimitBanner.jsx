import { AlertTriangle, XCircle } from 'lucide-react'
import clsx from 'clsx'

/**
 * PlanLimitBanner
 * Shows a warning when approaching or at the plan limit for a resource.
 *
 * @param {{ used: number, limit: number, resource: string, plan: string }} props
 *   resource — human name e.g. "staff members", "tables", "menu items"
 *   plan     — current plan name e.g. "basic"
 */
export default function PlanLimitBanner({ used, limit, resource, plan }) {
  if (!limit || limit === Infinity) return null

  const pct = limit > 0 ? used / limit : 0
  const atLimit   = used >= limit
  const nearLimit = pct >= 0.9 && !atLimit

  if (!atLimit && !nearLimit) return null

  return (
    <div className={clsx(
      'flex items-start gap-3 rounded-xl px-4 py-3 border text-sm mb-4',
      atLimit
        ? 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-700/40 text-red-800 dark:text-red-300'
        : 'bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-700/40 text-amber-800 dark:text-amber-300'
    )}>
      {atLimit
        ? <XCircle size={16} className="flex-shrink-0 mt-0.5 text-red-500 dark:text-red-400" />
        : <AlertTriangle size={16} className="flex-shrink-0 mt-0.5 text-amber-500 dark:text-amber-400" />}
      <div>
        <p className="font-semibold text-xs">
          {atLimit
            ? `${resource} limit reached`
            : `Approaching ${resource} limit`}
        </p>
        <p className="text-xs mt-0.5 opacity-80">
          {used} / {limit} {resource} used on the{' '}
          <span className="font-semibold capitalize">{plan}</span> plan.
          {atLimit
            ? ' Upgrade your plan to add more.'
            : ` Only ${limit - used} slot${limit - used !== 1 ? 's' : ''} remaining.`}
        </p>
      </div>
    </div>
  )
}
