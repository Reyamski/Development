import { AreaChart, Area, ResponsiveContainer, Tooltip } from 'recharts';

interface MetricChartProps {
  data: { timestamp: string; value: number }[];
  color?: string;
  height?: number;
}

export function MetricChart({ data, color = '#10b981', height = 60 }: MetricChartProps) {
  if (data.length === 0) {
    return <div className="h-[60px] flex items-center justify-center text-xs text-gray-600">No data</div>;
  }

  return (
    <ResponsiveContainer width="100%" height={height}>
      <AreaChart data={data} margin={{ top: 2, right: 2, bottom: 2, left: 2 }}>
        <defs>
          <linearGradient id={`gradient-${color.replace('#', '')}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor={color} stopOpacity={0.3} />
            <stop offset="95%" stopColor={color} stopOpacity={0} />
          </linearGradient>
        </defs>
        <Tooltip
          contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: '8px', fontSize: '12px' }}
          labelStyle={{ color: '#9ca3af' }}
          formatter={(value: number) => [value.toFixed(2), 'Value']}
          labelFormatter={(label: string) => new Date(label).toLocaleTimeString()}
        />
        <Area
          type="monotone"
          dataKey="value"
          stroke={color}
          fill={`url(#gradient-${color.replace('#', '')})`}
          strokeWidth={1.5}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}
