export interface TrendPoint {
  label: string;
  value: number;
}

export interface TrendChartProps {
  points: TrendPoint[];
  color?: string;
  unit?: string;
}

export function TrendChart({
  points,
  color = 'var(--color-primary)',
  unit = '分钟',
}: TrendChartProps) {
  const max = Math.max(1, ...points.map((point) => point.value));
  const coords = points
    .map((point, index) => {
      const x = points.length <= 1 ? 0 : (index / (points.length - 1)) * 100;
      const y = 36 - (point.value / max) * 32;
      return `${x},${y}`;
    })
    .join(' ');

  return (
    <div className="trend-chart">
      <svg viewBox="0 0 100 36" preserveAspectRatio="none" role="img" aria-label="专注趋势">
        <polyline
          points={coords}
          fill="none"
          stroke={color}
          strokeWidth="1.5"
          strokeLinejoin="round"
        />
        {points.map((point, index) => {
          const x = points.length <= 1 ? 0 : (index / (points.length - 1)) * 100;
          const y = 36 - (point.value / max) * 32;
          return <circle key={point.label} cx={x} cy={y} r="1.2" fill={color} />;
        })}
      </svg>
      <div className="trend-labels">
        {points.map((point) => (
          <span key={point.label}>{point.label}</span>
        ))}
      </div>
      <span className="muted trend-max">
        峰值 {max} {unit}
      </span>
    </div>
  );
}