interface MetricCardProps {
  label: string;
  value: number;
  unit?: string;
  max?: number;
  min?: number;
  trend: 'up' | 'down' | 'stable';
  invertTrend?: boolean;
}

export function MetricCard({ label, value, unit = '', max, min, trend, invertTrend }: MetricCardProps) {
  const trendColor = trend === 'stable' ? 'text-gray-500'
    : (trend === 'up') !== (invertTrend ?? false) ? 'text-red-400' : 'text-emerald-400';
  const trendIcon = trend === 'up' ? '\u2191' : trend === 'down' ? '\u2193' : '\u2192';

  return (
    <div className="bg-gray-800/50 rounded-lg p-3 border border-gray-700/50">
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs text-gray-500">{label}</span>
        <span className={`text-xs ${trendColor}`}>{trendIcon}</span>
      </div>
      <div className="text-lg font-semibold text-white">
        {typeof value === 'number' ? (value < 10 ? value.toFixed(2) : Math.round(value).toLocaleString()) : value}
        <span className="text-xs text-gray-500 font-normal">{unit}</span>
      </div>
      <div className="text-xs text-gray-600 mt-0.5">
        {max !== undefined && <span>max {typeof max === 'number' ? (max < 10 ? max.toFixed(2) : Math.round(max).toLocaleString()) : max}{unit}</span>}
        {min !== undefined && <span className="ml-2">min {typeof min === 'number' ? (min < 10 ? min.toFixed(2) : Math.round(min).toLocaleString()) : min}{unit}</span>}
      </div>
    </div>
  );
}
