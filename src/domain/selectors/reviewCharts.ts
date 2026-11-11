import { format, parseISO } from 'date-fns';
import { toLocalISODate } from '@/lib/dates';
import type { CalendarItem, Category, FocusSession, Task } from '../models';

export interface FocusSlice {
  key: string;
  label: string;
  minutes: number;
  percent: number;
  color: string;
}

export interface FocusBreakdown {
  slices: FocusSlice[];
  totalMinutes: number;
  dailyAverage: number;
}

export interface FocusBreakdownInput {
  focusSessions: FocusSession[];
  tasks: Task[];
  categories?: Category[];
  rangeStart: Date;
  rangeEnd: Date;
  dayCount: number;
}

const PALETTE = [
  'var(--color-course-1)',
  'var(--color-course-2)',
  'var(--color-course-3)',
  'var(--color-course-4)',
  'var(--color-course-5)',
  'var(--color-course-6)',
];

function stableColor(label: string): string {
  let hash = 0;
  for (let index = 0; index < label.length; index += 1) {
    hash = (hash * 31 + label.charCodeAt(index)) >>> 0;
  }
  return PALETTE[hash % PALETTE.length];
}

export function computeFocusBreakdown(input: FocusBreakdownInput): FocusBreakdown {
  const { focusSessions, tasks, rangeStart, rangeEnd, dayCount, categories = [] } = input;
  const taskById = new Map(tasks.map((task) => [task.id, task]));
  const categoryById = new Map(categories.map((category) => [category.id, category]));
  const totals = new Map<string, { label: string; seconds: number; color: string }>();

  for (const session of focusSessions) {
    if (session.mode !== 'focus') continue;
    const started = parseISO(session.startedAt);
    if (started < rangeStart || started > rangeEnd) continue;

    const task = session.taskId ? taskById.get(session.taskId) : undefined;
    const category = task?.categoryId ? categoryById.get(task.categoryId) : undefined;
    const key = task?.categoryId ?? task?.title ?? '未归类';
    const label = category?.name ?? task?.title ?? '未归类';
    const current =
      totals.get(key) ?? {
        label,
        seconds: 0,
        color: category?.color ?? stableColor(label),
      };
    current.seconds += session.actualSeconds;
    totals.set(key, current);
  }

  const totalSeconds = [...totals.values()].reduce((sum, item) => sum + item.seconds, 0);
  const slices = [...totals.entries()]
    .map(([key, value]) => ({
      key,
      label: value.label,
      minutes: Math.round(value.seconds / 60),
      percent: totalSeconds === 0 ? 0 : value.seconds / totalSeconds,
      color: value.color,
    }))
    .sort((a, b) => b.minutes - a.minutes);

  return {
    slices,
    totalMinutes: Math.round(totalSeconds / 60),
    dailyAverage: dayCount > 0 ? Math.round(totalSeconds / 60 / dayCount) : 0,
  };
}

export type HeatmapMode = 'focus' | 'all';

export interface HeatmapCell {
  date: string;
  focusMinutes: number;
  courseMinutes: number;
  value: number;
}

export interface HeatmapInput {
  days: Date[];
  focusSessions: FocusSession[];
  items: CalendarItem[];
  mode: HeatmapMode;
}

export function computeDailyHeatmap(input: HeatmapInput): HeatmapCell[] {
  const { days, focusSessions, items, mode } = input;

  return days.map((day) => {
    const date = format(day, 'yyyy-MM-dd');

    const focusMinutes = Math.round(
      focusSessions
        .filter((session) => session.mode === 'focus' && toLocalISODate(session.startedAt) === date)
        .reduce((sum, session) => sum + session.actualSeconds, 0) / 60,
    );

    const courseMinutes = Math.round(
      items
        .filter((item) => item.source === 'course' && toLocalISODate(item.start) === date)
        .reduce(
          (sum, item) =>
            sum +
            Math.max(0, (parseISO(item.end).getTime() - parseISO(item.start).getTime()) / 60_000),
          0,
        ),
    );

    return {
      date,
      focusMinutes,
      courseMinutes,
      value: mode === 'focus' ? focusMinutes : focusMinutes + courseMinutes,
    };
  });
}

export interface HeatmapSummary {
  totalMinutes: number;
  activeDays: number;
  averageMinutes: number;
  maxMinutes: number;
}

export function heatmapSummary(cells: HeatmapCell[]): HeatmapSummary {
  const totalMinutes = cells.reduce((sum, cell) => sum + cell.value, 0);
  const activeDays = cells.filter((cell) => cell.value > 0).length;
  const maxMinutes = cells.reduce((max, cell) => Math.max(max, cell.value), 0);

  return {
    totalMinutes,
    activeDays,
    averageMinutes: activeDays === 0 ? 0 : Math.round(totalMinutes / activeDays),
    maxMinutes,
  };
}

export function heatmapLevel(value: number): 0 | 1 | 2 | 3 | 4 {
  if (value <= 0) return 0;
  if (value < 30) return 1;
  if (value < 60) return 2;
  if (value < 120) return 3;
  return 4;
}