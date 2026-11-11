import { useEffect, useRef } from 'react';
import { heatmapLevel } from '@/domain/selectors/reviewCharts';

export interface HeatmapCellLike {
  date: string;
  value: number;
}

export interface HeatmapProps {
  cells: HeatmapCellLike[];
  color?: string;
  unit?: string;
  label?: string;
  /** 长周期时自动滚动到最新一周 */
  autoScroll?: boolean;
}

function chunkWeeks(cells: HeatmapCellLike[]): HeatmapCellLike[][] {
  const weeks: HeatmapCellLike[][] = [];
  for (let index = 0; index < cells.length; index += 7) {
    weeks.push(cells.slice(index, index + 7));
  }
  return weeks;
}

export function Heatmap({
  cells,
  color = 'var(--color-primary)',
  unit = '分钟',
  label = '学习热力图',
  autoScroll = false,
}: HeatmapProps) {
  const weeks = chunkWeeks(cells);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!autoScroll || !containerRef.current) return;
    containerRef.current.scrollLeft = containerRef.current.scrollWidth;
  }, [autoScroll, cells]);

  return (
    <div className="heatmap" role="img" aria-label={label} ref={containerRef}>
      {weeks.map((week, weekIndex) => (
        <div className="heatmap-week" key={weekIndex}>
          {week.map((cell) => {
            const level = heatmapLevel(cell.value);
            return (
              <span
                key={cell.date}
                className={`heatmap-cell level-${level}`}
                style={level > 0 ? { background: color, opacity: 0.25 + level * 0.18 } : undefined}
                title={`${cell.date} · ${cell.value} ${unit}`}
              />
            );
          })}
        </div>
      ))}
    </div>
  );
}

export function HeatmapLegend() {
  return (
    <div className="heatmap-legend" aria-hidden="true">
      <span className="heatmap-cell level-0" />
      <span className="heatmap-cell level-1" />
      <span className="heatmap-cell level-2" />
      <span className="heatmap-cell level-3" />
      <span className="heatmap-cell level-4" />
      <span className="muted">少 → 多</span>
    </div>
  );
}