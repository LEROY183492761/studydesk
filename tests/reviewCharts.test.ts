import { describe, expect, it } from 'vitest';
import { computeDailyHeatmap, computeFocusBreakdown, heatmapLevel, heatmapSummary } from '@/domain/selectors/reviewCharts';
import type { CalendarItem, FocusSession, Task } from '@/domain/models';

const day = new Date(2026, 8, 7);
const at = (hour: number) => new Date(2026, 8, 7, hour).toISOString();

const tasks: Task[] = [
  {
    id: 't1',
    title: '高数复习',
    categoryId: '数学',
    status: 'inbox',
    priority: 'normal',
    source: 'manual',
    createdAt: at(8),
    updatedAt: at(8),
  },
  {
    id: 't2',
    title: '背单词',
    status: 'inbox',
    priority: 'normal',
    source: 'manual',
    createdAt: at(8),
    updatedAt: at(8),
  },
];

const sessions: FocusSession[] = [
  {
    id: 'f1',
    taskId: 't1',
    startedAt: at(9),
    plannedSeconds: 3000,
    actualSeconds: 3000,
    mode: 'focus',
    completed: true,
  },
  {
    id: 'f2',
    taskId: 't2',
    startedAt: at(10),
    plannedSeconds: 1500,
    actualSeconds: 1500,
    mode: 'focus',
    completed: true,
  },
  {
    id: 'f3',
    startedAt: at(11),
    plannedSeconds: 600,
    actualSeconds: 600,
    mode: 'focus',
    completed: true,
  },
  {
    id: 'b1',
    startedAt: at(12),
    plannedSeconds: 300,
    actualSeconds: 300,
    mode: 'break',
    completed: true,
  },
];

describe('专注饼图', () => {
  it('按分类优先、任务标题兜底、未关联归未归类', () => {
    const breakdown = computeFocusBreakdown({
      focusSessions: sessions,
      tasks,
      categories: [
        {
          id: '数学',
          name: '数学',
          color: '#112233',
          kind: 'study',
          archived: false,
          createdAt: at(8),
        },
      ],
      rangeStart: new Date(2026, 8, 7),
      rangeEnd: new Date(2026, 8, 7, 23, 59),
      dayCount: 1,
    });

    expect(breakdown.totalMinutes).toBe(85);
    expect(breakdown.slices[0]).toMatchObject({ label: '数学', minutes: 50 });
    expect(breakdown.slices.some((slice) => slice.label === '背单词')).toBe(true);
    expect(breakdown.slices.some((slice) => slice.label === '未归类')).toBe(true);
    expect(breakdown.slices[0].percent).toBeCloseTo(50 / 85, 5);
  });

  it('区间内无记录时返回空', () => {
    const breakdown = computeFocusBreakdown({
      focusSessions: [],
      tasks,
      rangeStart: day,
      rangeEnd: day,
      dayCount: 1,
    });
    expect(breakdown.slices).toHaveLength(0);
    expect(breakdown.totalMinutes).toBe(0);
    expect(breakdown.dailyAverage).toBe(0);
  });
});

describe('专注饼图配色', () => {
  const categories = [
    {
      id: '数学',
      name: '高等数学',
      color: '#112233',
      kind: 'study',
      archived: false,
      createdAt: at(8),
    },
  ];

  it('传入分类时使用分类名与分类颜色', () => {
    const breakdown = computeFocusBreakdown({
      focusSessions: sessions,
      tasks,
      categories,
      rangeStart: new Date(2026, 8, 7),
      rangeEnd: new Date(2026, 8, 7, 23, 59),
      dayCount: 1,
    });

    const math = breakdown.slices.find((slice) => slice.key === '数学');
    expect(math).toMatchObject({ label: '高等数学', color: '#112233', minutes: 50 });
  });

  it('无分类时同一标签在不同区间颜色稳定', () => {
    const full = computeFocusBreakdown({
      focusSessions: sessions,
      tasks,
      rangeStart: new Date(2026, 8, 7),
      rangeEnd: new Date(2026, 8, 7, 23, 59),
      dayCount: 1,
    });
    const partial = computeFocusBreakdown({
      focusSessions: sessions.filter((session) => session.id === 'f3'),
      tasks,
      rangeStart: new Date(2026, 8, 7),
      rangeEnd: new Date(2026, 8, 7, 23, 59),
      dayCount: 1,
    });

    const fullUncategorized = full.slices.find((slice) => slice.label === '未归类');
    const partialUncategorized = partial.slices.find((slice) => slice.label === '未归类');
    expect(fullUncategorized?.color).toBe(partialUncategorized?.color);
    expect(fullUncategorized?.color).not.toBe('#112233');
  });
});

describe('学习热力图', () => {
  const items: CalendarItem[] = [
    {
      id: 'c1',
      source: 'course',
      title: '高等数学',
      start: new Date(2026, 8, 7, 8).toISOString(),
      end: new Date(2026, 8, 7, 9, 40).toISOString(),
      allDay: false,
      readonly: true,
    },
  ];

  it('专注口径只计算专注分钟', () => {
    const cells = computeDailyHeatmap({
      days: [new Date(2026, 8, 7)],
      focusSessions: sessions,
      items,
      mode: 'focus',
    });
    expect(cells[0].value).toBe(85);
    expect(cells[0].courseMinutes).toBe(100);
  });

  it('全部口径叠加课程分钟', () => {
    const cells = computeDailyHeatmap({
      days: [new Date(2026, 8, 7)],
      focusSessions: sessions,
      items,
      mode: 'all',
    });
    expect(cells[0].value).toBe(185);
  });

  it('摘要与分档', () => {
    const cells = computeDailyHeatmap({
      days: [new Date(2026, 8, 7), new Date(2026, 8, 8)],
      focusSessions: sessions,
      items,
      mode: 'focus',
    });
    const summary = heatmapSummary(cells);
    expect(summary.totalMinutes).toBe(85);
    expect(summary.activeDays).toBe(1);
    expect(summary.averageMinutes).toBe(85);
    expect(heatmapLevel(0)).toBe(0);
    expect(heatmapLevel(25)).toBe(1);
    expect(heatmapLevel(45)).toBe(2);
    expect(heatmapLevel(90)).toBe(3);
    expect(heatmapLevel(150)).toBe(4);
  });
});