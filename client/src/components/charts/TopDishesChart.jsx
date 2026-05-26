import {
  BarChart, Bar,
  XAxis, YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from 'recharts'

const COLORS = ['#14b8a6', '#0d9488', '#f3761d', '#0ea5e9', '#8b5cf6']

function CustomTooltip({ active, payload }) {
  if (!active || !payload?.length) return null
  const d = payload[0].payload
  return (
    <div className="bg-white border border-gray-100 rounded-xl shadow-lg px-3 py-2.5">
      <p className="text-xs font-semibold text-gray-700 mb-1">{d.name}</p>
      <p className="text-xs text-gray-500">
        <span className="font-medium text-gray-900">{d.count}</span> orders
      </p>
      <p className="text-xs text-gray-500">
        <span className="font-medium text-gray-900">${d.revenue}</span> revenue
      </p>
    </div>
  )
}

export default function TopDishesChart({ data }) {
  return (
    <div style={{ width: '100%', height: 240 }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={data}
          layout="vertical"
          margin={{ top: 0, right: 10, left: 0, bottom: 0 }}
        >
          <XAxis
            type="number"
            axisLine={false}
            tickLine={false}
            tick={{ fontSize: 11, fill: '#9CA3AF' }}
          />
          <YAxis
            type="category"
            dataKey="name"
            width={110}
            axisLine={false}
            tickLine={false}
            tick={{ fontSize: 11, fill: '#374151' }}
          />
          <Tooltip content={<CustomTooltip />} cursor={{ fill: '#F9FAFB' }} />
          <Bar dataKey="count" radius={[0, 5, 5, 0]} maxBarSize={20}>
            {data.map((_, idx) => (
              <Cell key={idx} fill={COLORS[idx % COLORS.length]} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
