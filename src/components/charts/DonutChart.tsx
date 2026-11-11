import type { FocusSlice } from '@/domain/selectors/reviewCharts';

export interface DonutChartProps {
  slices: FocusSlice[];
  size?: number;
  thickness?: number;
}

export function DonutChart({ slices, size = 160, thickness = 22 }: DonutChartProps) {
  const center = size / 2;
  const radius = (size - thickness) / 2;
  const circumference = 2 * Math.PI * radius;
  let offset = 0;

  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      role="img"
      aria-label="专注时长分布"
    >
      <circle
        cx={center}
        cy={center}
        r={radius}
        fill="none"
        stroke="var(--color-surface-muted)"
        strokeWidth={thickness}
      />
      {slices.map((slice) => {
        const dash = Math.max(0, slice.percent) * circumference;
        const element = (
          <circle
            key={slice.key}
            cx={center}
            cy={center}
            r={radius}
            fill="none"
            stroke={slice.color}
            strokeWidth={thickness}
            strokeDasharray={`${dash} ${circumference - dash}`}
            strokeDashoffset={-offset}
            transform={`rotate(-90 ${center} ${center})`}
          />
        );
        offset += dash;
        return element;
      })}
    </svg>
  );
}