import { ChevronDown } from 'lucide-react'
import clsx from 'clsx'

export default function Select({
  label,
  options = [],
  value,
  onChange,
  placeholder = 'Select...',
  required = false,
  disabled = false,
  error,
  className = '',
}) {
  return (
    <div className={clsx('flex flex-col gap-1', className)}>
      {label && (
        <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
          {label}
          {required && <span className="text-red-500 ml-0.5">*</span>}
        </label>
      )}
      <div className="relative">
        <select
          value={value}
          onChange={onChange}
          disabled={disabled}
          required={required}
          className={clsx(
            'w-full rounded-lg border bg-white dark:bg-gray-700 text-sm text-gray-900 dark:text-gray-100',
            'py-2.5 pl-3 pr-8 appearance-none transition-all duration-150',
            'focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent',
            'disabled:bg-gray-50 dark:disabled:bg-gray-800 disabled:text-gray-400 disabled:cursor-not-allowed',
            error ? 'border-red-300' : 'border-gray-200 dark:border-gray-600',
          )}
        >
          <option value="">{placeholder}</option>
          {options.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
        <ChevronDown
          size={14}
          className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-500 pointer-events-none"
        />
      </div>
      {error && <p className="text-xs text-red-500">{error}</p>}
    </div>
  )
}
