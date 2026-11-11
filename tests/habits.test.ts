import { describe, expect, it } from 'vitest';
import { addDays, format, startOfWeek } from 'date-fns';
import {
  convertAmount,
  habitDayAmount,
  habitProgress,
  habitStreak,
  habitTargetMet,
  habitWeekCount,
  habitWeekProgress,
  isTimeUnit,
} from '@/domain/rules/habits';
import { goalHabitProgress } from '@/domain/rules/goals';
import type { Goal, Habit, HabitLog } from '@/domain/models';

const today = new Date(2026, 8, 9);
const day = (offset: number) => format(addDays(today, offset), 'yyyy-MM-dd');

function log(habitId: string, offset: number): HabitLog {
  return { id: `${habitId}_${offset}`, habitId, date: day(offset), value: 1 };
}

const dailyHabit: Habit = {
  id: 'h1',
  name: '阅读',
  color: '#000',
  frequency: { type: 'daily' },
  archived: false,
  createdAt: new Date(2026, 7, 1).toISOString(),
};

const weeklyHabit: Habit = {
  id: 'h2',
  name: '运动',
  color: '#000',
  frequency: { type: 'weekly', timesPerWeek: 3 },
  archived: false,
  createdAt: new Date(2026, 7, 1).toISOString(),
};

describe('习惯连续天数', () => {
  it('今天已打卡时从今天连续向前计数', () => {
    const logs = [0, -1, -2].map((offset) => log('h1', offset));
    expect(habitStreak(logs, 'h1', today)).toBe(3);
  });

  it('今天未打卡时保留昨天之前的连续记录', () => {
    const logs = [-1, -2, -3].map((offset) => log('h1', offset));
    expect(habitStreak(logs, 'h1', today)).toBe(3);
  });

  it('断档后只统计最近连续段', () => {
    const logs = [0, -1, -3, -4].map((offset) => log('h1', offset));
    expect(habitStreak(logs, 'h1', today)).toBe(2);
  });

  it('没有记录时为零', () => {
    expect(habitStreak([], 'h1', today)).toBe(0);
  });
});

describe('习惯周目标', () => {
  const weekStart = startOfWeek(today, { weekStartsOn: 1 });

  it('每日习惯按 7 天计算进度', () => {
    const logs = [0, -1, -2].map((offset) => log('h1', offset));
    expect(habitWeekCount(logs, 'h1', weekStart)).toBeGreaterThanOrEqual(2);
    expect(habitWeekProgress(dailyHabit, logs, weekStart)).toBeLessThan(1);
    expect(habitTargetMet(dailyHabit, logs, weekStart)).toBe(false);
  });

  it('每周 N 次习惯达到目标', () => {
    const logs = [0, -1, -2].map((offset) => log('h2', offset));
    expect(habitWeekCount(logs, 'h2', weekStart)).toBe(3);
    expect(habitTargetMet(weeklyHabit, logs, weekStart)).toBe(true);
    expect(habitWeekProgress(weeklyHabit, logs, weekStart)).toBe(1);
  });
});
describe('多次打卡、单位与环比', () => {
  it('同一天多次打卡累计，跨单位记录不计入并标记', () => {
    const logs: HabitLog[] = [
      { id: 'a', habitId: 'h1', date: day(0), value: 20, unit: '个' },
      { id: 'b', habitId: 'h1', date: day(0), value: 30, unit: '个' },
      { id: 'c', habitId: 'h1', date: day(0), value: 1, unit: '次' },
    ];

    const result = habitDayAmount(logs, 'h1', day(0), '个');
    expect(result.done).toBe(50);
    expect(result.skipped).toBe(1);
  });

  it('同组单位可换算，跨组返回 null', () => {
    expect(convertAmount(1, '小时', '分钟')).toBe(60);
    expect(convertAmount(90, '分钟', '小时')).toBe(1.5);
    expect(convertAmount(1, '个', '页')).toBeNull();
    expect(isTimeUnit('小时')).toBe(true);
    expect(isTimeUnit('个')).toBe(false);
  });

  it('环比分子为已打卡量，分母为每日目标量', () => {
    const habit: Habit = { ...dailyHabit, unit: '个', dailyTarget: 100 };
    const logs: HabitLog[] = [
      { id: 'a', habitId: 'h1', date: day(0), value: 20, unit: '个' },
      { id: 'b', habitId: 'h1', date: day(0), value: 30, unit: '个' },
    ];

    const progress = habitProgress(habit, logs, day(0));
    expect(progress).toMatchObject({ done: 50, target: 100, unit: '个', skipped: 0 });
    expect(progress.ratio).toBe(0.5);
  });
});

describe('目标绑定习惯', () => {
  it('按周期累计计算目标进度', () => {
    const habit: Habit = { ...dailyHabit, unit: '次' };
    const goal: Goal = {
      id: 'g1',
      title: '跑步 100 次',
      progress: 0,
      status: 'active',
      createdAt: new Date(2026, 8, 1).toISOString(),
      updatedAt: new Date(2026, 8, 1).toISOString(),
      habitId: 'h1',
      targetAmount: 100,
      autoProgress: true,
    };
    const logs: HabitLog[] = [
      { id: 'a', habitId: 'h1', date: day(-8), value: 20 },
      { id: 'b', habitId: 'h1', date: day(0), value: 30 },
    ];

    const progress = goalHabitProgress(goal, [habit], logs, day(-8), day(0));
    expect(progress).toMatchObject({ done: 50, target: 100, unit: '次' });
    expect(progress?.ratio).toBe(0.5);
  });
});