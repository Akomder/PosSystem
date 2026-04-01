import clsx from 'clsx'

const variants = {
  pending:      'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400',
  'in-progress':'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-400',
  served:       'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400',
  closed:       'bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-400',
  available:    'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400',
  occupied:     'bg-red-100 text-red-600 dark:bg-red-900/40 dark:text-red-400',
  reserved:     'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400',
  admin:        'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-400',
  waiter:       'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-400',
  cashier:      'bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-400',
  default:      'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400',
  success:      'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400',
  danger:       'bg-red-100 text-red-600 dark:bg-red-900/40 dark:text-red-400',
  indigo:       'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-400',
  blue:         'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-400',
  warning:      'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400',
}

export default function Badge({ children, variant = 'default', className = '' }) {
  return (
    <span
      className={clsx(
        'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium',
        variants[variant] || variants.default,
        className,
      )}
    >
      {children}
    </span>
  )
}
