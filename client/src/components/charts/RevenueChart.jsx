import {
  BarChart, Bar,
  LineChart, Line,
  XAxis, YAxis,
  CartesianGrid, Tooltip,
  ResponsiveContainer,
} from 'recharts'

function CustomTooltip({ active, payload, label, metric }) {
  if (!active || !payload?.length) return null
  const val = payload[0]?.value ?? 0
  return (
    <div className="bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-xl shadow-lg px-3 py-2.5">
      <p className="text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">{label}</p>
      <p className="text-xs text-gray-500 dark:text-gray-400">
        <span className="font-medium text-gray-900 dark:text-gray-100">
          {metric === 'orders' ? val : `${Number(val).toLocaleString()}`}
        </span>{' '}
        {metric === 'orders' ? 'orders' : 'revenue'}
      </p>
    </div>
  )
}

export default function RevenueChart({ data, type = 'bar', metric = 'revenue' }) {
  const dataKey = metric
  const isOrders = metric === 'orders'
  const color = isOrders ? '#6366F1' : '#4F46E5'

  const commonProps = {
    data,
    margin: { top: 5, right: 5, left: 0, bottom: 5 },
  }

  const xAxis = (
    <XAxis
      dataKey="day"
      axisLine={false}
      tickLine={false}
      tick={{ fontSize: 11, fill: '#9CA3AF' }}
    />
  )

  const yAxis = (
    <YAxis
      width={isOrders ? 30 : 52}
      axisLine={false}
      tickLine={false}
      tick={{ fontSize: 11, fill: '#9CA3AF' }}
      tickFormatter={isOrders ? undefined : (v) => v >= 1000 ? `${(v/1000).toFixed(0)}k` : v}
    />
  )

  const grid = <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" vertical={false} />
  const tooltip = <Tooltip content={<CustomTooltip metric={metric} />} cursor={{ fill: '#F3F4F6' }} />

  return (
    <div style={{ width: '100%', height: 240 }}>
      <ResponsiveContainer width="100%" height="100%">
        {type === 'line' ? (
          <LineChart {...commonProps}>
            {grid}
            {xAxis}
            {yAxis}
            {tooltip}
            <Line
              type="monotone"
              dataKey={dataKey}
              stroke={color}
              strokeWidth={2.5}
              dot={{ fill: '#fff', stroke: color, strokeWidth: 2, r: 4 }}
              activeDot={{ r: 5, fill: color }}
            />
          </LineChart>
        ) : (
          <BarChart {...commonProps}>
            {grid}
            {xAxis}
            {yAxis}
            {tooltip}
            <Bar
              dataKey={dataKey}
              fill={color}
              radius={[5, 5, 0, 0]}
              maxBarSize={42}
            />
          </BarChart>
        )}
      </ResponsiveContainer>
    </div>
  )
}
