import { describe, expect, it } from 'vitest';
import { format } from 'date-fns';
import {
  clampProgress,
  countdownDays,
  countdownLabel,
  countdownTarget,
  goalStats,
  goalTaskProgress,
  sortCountdowns,
} from '@/domain/rules/goals';
import type { Countdown, Goal, Task } from '@/domain/models';

const now = new Date(2026, 8, 7, 12, 0);
const stamp = new Date(2026, 8, 7).toISOString();

function countdown(overrides: Partial<Countdown> = {}): Countdown {
  return {
    id: 'd1',
    title: '考试',
    date: '2026-09-10',
    createdAt: stamp,
    ...overrides,
  };
}

function goal(overrides: Partial<Goal> = {}): Goal {
  return {
    id: 'g1',
    title: '目标',
    progress: 40,
    status: 'active',
    createdAt: stamp,
    updatedAt: stamp,
    ...overrides,
  };
}

describe('倒数日规则', () => {
  it('今天为 0，未来为正，过去为负', () => {
    expect(countdownDays(countdown({ date: '2026-09-07' }), now)).toBe(0);
    expect(countdownDays(countdown({ date: '2026-09-10' }), now)).toBe(3);
    expect(countdownDays(countdown({ date: '2026-09-05' }), now)).toBe(-2);
  });

  it('每年重复时已过日期换算到下一次周年', () => {
    expect(countdownDays(countdown({ date: '2020-09-10', yearly: true }), now)).toBe(3);
  });

  it('文案覆盖今天、未来与过去', () => {
    expect(countdownLabel(0)).toBe('就是今天');
    expect(countdownLabel(5)).toBe('还有 5 天');
    expect(countdownLabel(-3)).toBe('已过去 3 天');
  });

  it('按离今天由近到远排序', () => {
    const sorted = sortCountdowns(
      [
        countdown({ id: 'far', title: '远期', date: '2026-12-01' }),
        countdown({ id: 'near', title: '近期', date: '2026-09-08' }),
        countdown({ id: 'past', title: '已过', date: '2026-09-05' }),
      ],
      now,
    );
    expect(sorted.map((item) => item.id)).toEqual(['near', 'past', 'far']);
  });
});

describe('目标规则', () => {
  it('进度限制在 0–100', () => {
    expect(clampProgress(-5)).toBe(0);
    expect(clampProgress(140)).toBe(100);
    expect(clampProgress(50.4)).toBe(50);
  });

  it('统计进行中、已完成与平均进度', () => {
    const stats = goalStats([
      goal({ progress: 40 }),
      goal({ id: 'g2', progress: 60 }),
      goal({ id: 'g3', status: 'done', progress: 100 }),
    ]);
    expect(stats).toEqual({ active: 2, done: 1, averageProgress: 50 });
  });

  it('关联任务进度为已完成数 / 总数', () => {
    const tasks: Task[] = [
      {
        id: 't1',
        title: 'A',
        status: 'done',
        priority: 'normal',
        source: 'manual',
        createdAt: stamp,
        updatedAt: stamp,
      },
      {
        id: 't2',
        title: 'B',
        status: 'inbox',
        priority: 'normal',
        source: 'manual',
        createdAt: stamp,
        updatedAt: stamp,
      },
    ];

    expect(goalTaskProgress(goal({ taskIds: ['t1', 't2'] }), tasks)).toEqual({
      done: 1,
      total: 2,
      ratio: 0.5,
    });
    expect(goalTaskProgress(goal(), tasks)).toBeNull();
  });
});
describe('闰日倒数日', () => {
  it('每年重复的 2 月 29 日在非闰年落到 2 月 28 日', () => {
    const leap = countdown({ date: '2020-02-29', yearly: true });
    expect(format(countdownTarget(leap, new Date(2026, 8, 7)), 'yyyy-MM-dd')).toBe('2027-02-28');
    expect(format(countdownTarget(leap, new Date(2028, 0, 1)), 'yyyy-MM-dd')).toBe('2028-02-29');
  });
});