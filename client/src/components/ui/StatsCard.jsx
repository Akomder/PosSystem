import { TrendingUp, TrendingDown } from 'lucide-react'
import clsx from 'clsx'

const colorMap = {
  indigo:  { bg: 'bg-indigo-50  dark:bg-indigo-900/30',  icon: 'text-indigo-600 dark:text-indigo-400' },
  green:   { bg: 'bg-green-50   dark:bg-green-900/30',   icon: 'text-green-600  dark:text-green-400'  },
  amber:   { bg: 'bg-amber-50   dark:bg-amber-900/30',   icon: 'text-amber-600  dark:text-amber-400'  },
  blue:    { bg: 'bg-blue-50    dark:bg-blue-900/30',    icon: 'text-blue-600   dark:text-blue-400'   },
  red:     { bg: 'bg-red-50     dark:bg-red-900/30',     icon: 'text-red-600    dark:text-red-400'    },
  purple:  { bg: 'bg-purple-50  dark:bg-purple-900/30',  icon: 'text-purple-600 dark:text-purple-400' },
}

export default function StatsCard({
  title,
  value,
  change,
  changeType = 'up',
  icon: Icon,
  color = 'indigo',
  subtitle,
}) {
  const c = colorMap[color] || colorMap.indigo

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 shadow-sm p-5">
      <div className="flex items-start justify-between">
        <div className="flex-1 min-w-0">
          <p className="text-sm text-gray-500 dark:text-gray-400 font-medium truncate">{title}</p>
          <p className="mt-1 text-2xl font-bold text-gray-900 dark:text-gray-100 tracking-tight">{value}</p>
          {subtitle && (
            <p className="mt-0.5 text-xs text-gray-400 dark:text-gray-500 truncate">{subtitle}</p>
          )}
        </div>
        {Icon && (
          <div className={clsx('p-2.5 rounded-xl flex-shrink-0', c.bg)}>
            <Icon size={20} className={c.icon} />
          </div>
        )}
      </div>
      {change !== undefined && (
        <div className="mt-3 flex items-center gap-1">
          {changeType === 'up' ? (
            <TrendingUp size={13} className="text-green-500" />
          ) : (
            <TrendingDown size={13} className="text-red-500" />
          )}
          <span
            className={clsx(
              'text-xs font-medium',
              changeType === 'up' ? 'text-green-600' : 'text-red-600',
            )}
          >
            {change}
          </span>
        </div>
      )}
    </div>
  )
}
