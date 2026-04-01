import clsx from 'clsx'

export default function Card({
  children,
  className = '',
  onClick,
  hoverable = false,
  padding = true,
}) {
  return (
    <div
      onClick={onClick}
      className={clsx(
        'bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 shadow-sm',
        padding && 'p-5',
        hoverable && 'hover:shadow-md transition-shadow duration-200 cursor-pointer',
        onClick && 'cursor-pointer',
        className,
      )}
    >
      {children}
    </div>
  )
}
