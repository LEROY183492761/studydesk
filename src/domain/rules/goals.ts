import { differenceInCalendarDays, isLeapYear, parseISO, startOfDay } from 'date-fns';
import type { Countdown, Goal, Habit, HabitLog, Task } from '../models';
import { habitPeriodAmount, habitUnit } from './habits';

export function clampProgress(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.min(100, Math.max(0, Math.round(value)));
}

/** 每年重复的目标日；2 月 29 日在非闰年落到 2 月 28 日 */
function yearlyTarget(parsed: Date, year: number): Date {
  const month = parsed.getMonth();
  const day = parsed.getDate();
  if (month === 1 && day === 29 && !isLeapYear(new Date(year, 0, 1))) {
    return new Date(year, 1, 28);
  }
  return new Date(year, month, day);
}

/** 倒数日的目标日；每年重复时换算到下一次周年 */
export function countdownTarget(item: Countdown, now = new Date()): Date {
  const parsed = parseISO(item.date);
  if (!item.yearly) return parsed;

  let target = yearlyTarget(parsed, now.getFullYear());
  if (target.getTime() < startOfDay(now).getTime()) {
    target = yearlyTarget(parsed, now.getFullYear() + 1);
  }
  return target;
}

export function countdownDays(item: Countdown, now = new Date()): number {
  return differenceInCalendarDays(countdownTarget(item, now), now);
}

export function countdownLabel(days: number): string {
  if (days === 0) return '就是今天';
  if (days > 0) return `还有 ${days} 天`;
  return `已过去 ${Math.abs(days)} 天`;
}

/** 按离今天由近到远排序，过去的日期同样按距离排序 */
export function sortCountdowns(items: Countdown[], now = new Date()): Countdown[] {
  return [...items].sort((a, b) => {
    const left = Math.abs(countdownDays(a, now));
    const right = Math.abs(countdownDays(b, now));
    if (left !== right) return left - right;
    return a.title.localeCompare(b.title);
  });
}

export function goalStats(items: Goal[]): {
  active: number;
  done: number;
  averageProgress: number;
} {
  const activeItems = items.filter((goal) => goal.status === 'active');
  const doneItems = items.filter((goal) => goal.status === 'done');
  const averageProgress =
    activeItems.length === 0
      ? 0
      : Math.round(
          activeItems.reduce((sum, goal) => sum + clampProgress(goal.progress), 0) /
            activeItems.length,
        );

  return { active: activeItems.length, done: doneItems.length, averageProgress };
}
export interface GoalHabitProgress {
  done: number;
  target: number;
  ratio: number;
  unit: string;
}

/** 绑定习惯的目标进度：分子=周期累计量，分母=目标总量 */
export function goalHabitProgress(
  goal: Goal,
  habits: Habit[],
  logs: HabitLog[],
  startDate: string,
  endDate: string,
): GoalHabitProgress | null {
  if (!goal.habitId || !goal.targetAmount || goal.targetAmount <= 0) return null;

  const habit = habits.find((item) => item.id === goal.habitId);
  if (!habit) return null;

  const unit = habitUnit(habit);
  const done = habitPeriodAmount(logs, habit.id, startDate, endDate, unit);
  const target = Math.max(1, goal.targetAmount);

  return { done, target, ratio: Math.min(1, done / target), unit };
}
export interface GoalTaskProgress {
  done: number;
  total: number;
  ratio: number;
}

/** 关联任务的自动进度：已完成任务数 / 关联任务总数 */
export function goalTaskProgress(goal: Goal, tasks: Task[]): GoalTaskProgress | null {
  if (!goal.taskIds || goal.taskIds.length === 0) return null;

  const linked = tasks.filter((task) => goal.taskIds?.includes(task.id));
  if (linked.length === 0) return null;

  const done = linked.filter((task) => task.status === 'done').length;
  const total = linked.length;

  return { done, total, ratio: total > 0 ? done / total : 0 };
}