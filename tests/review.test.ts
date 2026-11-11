import { describe, expect, it } from 'vitest';
import { addDays, startOfWeek } from 'date-fns';
import { computeWeeklyMetrics } from '@/domain/selectors/review';
import { computeDailyMetrics } from '@/domain/selectors/reviewMetrics';
import type { CalendarItem, FocusSession, Habit, HabitLog, Task } from '@/domain/models';

const weekStart = startOfWeek(new Date(2026, 8, 7), { weekStartsOn: 1 });
const weekEnd = addDays(weekStart, 6);

function task(id: string, createdAt: Date, completedAt?: Date): Task {
  return {
    id,
    title: id,
    status: completedAt ? 'done' : 'inbox',
    priority: 'normal',
    source: 'manual',
    createdAt: createdAt.toISOString(),
    updatedAt: createdAt.toISOString(),
    completedAt: completedAt?.toISOString(),
  };
}

describe('周复盘聚合', () => {
  it('汇总专注、任务、课程与习惯达成率', () => {
    const tasks = [
      task('t1', weekStart, addDays(weekStart, 1)),
      task('t2', weekStart),
      task('t3', addDays(weekStart, 2), addDays(weekStart, 2)),
    ];
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
    const focusSessions: FocusSession[] = [
      {
        id: 'f1',
        startedAt: new Date(2026, 8, 7, 10).toISOString(),
        plannedSeconds: 1500,
        actualSeconds: 1500,
        mode: 'focus',
        completed: true,
      },
      {
        id: 'f2',
        startedAt: new Date(2026, 8, 8, 10).toISOString(),
        plannedSeconds: 3000,
        actualSeconds: 3000,
        mode: 'focus',
        completed: true,
      },
    ];
    const habits: Habit[] = [
      {
        id: 'h1',
        name: '阅读',
        color: '#000',
        frequency: { type: 'daily' },
        archived: false,
        createdAt: weekStart.toISOString(),
      },
    ];
    const habitLogs: HabitLog[] = [
      { id: 'hl1', habitId: 'h1', date: '2026-09-07', value: 1 },
    ];

    const metrics = computeWeeklyMetrics({
      weekStart,
      weekEnd,
      tasks,
      items,
      focusSessions,
      habits,
      habitLogs,
    });

    expect(metrics.days).toHaveLength(7);
    expect(metrics.focusMinutes).toBe(75);
    expect(metrics.focusSessions).toBe(2);
    expect(metrics.tasksCompleted).toBe(2);
    expect(metrics.tasksCreated).toBe(3);
    expect(metrics.completionRate).toBeCloseTo(2 / 3, 5);
    expect(metrics.courseMinutes).toBe(100);
    expect(metrics.bestFocusDate).toBe('2026-09-08');
    expect(metrics.habitCompletionRate).toBeCloseTo(1 / 7, 5);
  });
});
describe('日复盘秒级与放弃统计', () => {
  it('汇总专注秒数并统计放弃次数', () => {
    const metrics = computeDailyMetrics({
      date: '2026-09-07',
      tasks: [],
      items: [],
      focusSessions: [
        {
          id: 'f1',
          startedAt: new Date(2026, 8, 7, 10).toISOString(),
          plannedSeconds: 1500,
          actualSeconds: 1500,
          mode: 'focus',
          completed: true,
        },
        {
          id: 'f2',
          startedAt: new Date(2026, 8, 7, 11).toISOString(),
          plannedSeconds: 1500,
          actualSeconds: 1500,
          mode: 'focus',
          completed: false,
          abandoned: true,
        },
      ],
      habits: [],
      habitLogs: [],
    });

    expect(metrics.focusSeconds).toBe(3000);
    expect(metrics.focusMinutes).toBe(50);
    expect(metrics.abandonedSessions).toBe(1);
    expect(metrics.focusSessions).toBe(2);
  });
});