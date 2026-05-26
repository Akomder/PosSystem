import { Loader2 } from 'lucide-react'
import clsx from 'clsx'

const variants = {
  primary:   'bg-teal-600 text-white hover:bg-[#f3761d] active:bg-[#c2530d] shadow-sm',
  secondary: 'bg-white border border-gray-200 text-gray-700 hover:bg-gray-50 active:bg-gray-100',
  danger:    'bg-red-50 text-red-600 border border-red-100 hover:bg-red-100 active:bg-red-200',
  ghost:     'text-gray-600 hover:bg-gray-100 active:bg-gray-200',
  success:   'bg-green-600 text-white hover:bg-green-700 active:bg-green-800 shadow-sm',
  warning:   'bg-amber-500 text-white hover:bg-amber-600 active:bg-amber-700 shadow-sm',
}

const sizes = {
  sm: 'px-3 py-1.5 text-xs gap-1.5',
  md: 'px-4 py-2 text-sm gap-2',
  lg: 'px-5 py-2.5 text-base gap-2',
}

export default function Button({
  children,
  variant = 'primary',
  size = 'md',
  onClick,
  disabled = false,
  loading = false,
  icon: Icon,
  fullWidth = false,
  className = '',
  type = 'button',
}) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled || loading}
      className={clsx(
        'inline-flex items-center justify-center font-medium rounded-lg transition-all duration-150',
        'focus:outline-none focus:ring-2 focus:ring-teal-500 focus:ring-offset-1',
        'disabled:opacity-50 disabled:cursor-not-allowed',
        variants[variant],
        sizes[size],
        fullWidth && 'w-full',
        className,
      )}
    >
      {loading ? (
        <Loader2 size={14} className="animate-spin" />
      ) : (
        Icon && <Icon size={size === 'sm' ? 14 : size === 'lg' ? 18 : 15} />
      )}
      {children}
    </button>
  )
}
