import { addDays, format, startOfDay } from 'date-fns';
import type { Habit, HabitLog } from '../models';

export function habitLogValue(logs: HabitLog[], habitId: string, date: string): number {
  return logs
    .filter((log) => log.habitId === habitId && log.date === date)
    .reduce((sum, log) => sum + log.value, 0);
}

export function isHabitDone(logs: HabitLog[], habitId: string, date: string): boolean {
  return habitLogValue(logs, habitId, date) > 0;
}

/**
 * 连续打卡天数。
 * 今天未打卡时从昨天开始计算，保留“昨天之前”的连续记录，不因今天还没打卡而归零。
 */
export function habitStreak(logs: HabitLog[], habitId: string, today: Date): number {
  let cursor = startOfDay(today);

  if (!isHabitDone(logs, habitId, format(cursor, 'yyyy-MM-dd'))) {
    cursor = addDays(cursor, -1);
  }

  let streak = 0;
  while (isHabitDone(logs, habitId, format(cursor, 'yyyy-MM-dd'))) {
    streak += 1;
    cursor = addDays(cursor, -1);
    if (streak > 3650) break;
  }
  return streak;
}

export function habitWeekCount(logs: HabitLog[], habitId: string, weekStart: Date): number {
  let count = 0;
  for (let index = 0; index < 7; index += 1) {
    if (isHabitDone(logs, habitId, format(addDays(weekStart, index), 'yyyy-MM-dd'))) {
      count += 1;
    }
  }
  return count;
}

export function habitWeekTarget(habit: Habit): number {
  return habit.frequency.type === 'daily' ? 7 : Math.max(1, habit.frequency.timesPerWeek);
}

export function habitWeekProgress(habit: Habit, logs: HabitLog[], weekStart: Date): number {
  const target = habitWeekTarget(habit);
  const count = habitWeekCount(logs, habit.id, weekStart);
  return Math.min(1, count / target);
}

export function habitTargetMet(habit: Habit, logs: HabitLog[], weekStart: Date): boolean {
  return habitWeekCount(logs, habit.id, weekStart) >= habitWeekTarget(habit);
}

export function habitDoneToday(habits: Habit[], logs: HabitLog[], today: Date): number {
  const date = format(today, 'yyyy-MM-dd');
  return habits.filter((habit) => !habit.archived && isHabitDone(logs, habit.id, date)).length;
}
/* ---------------- v0.6：次数、单位与累计 ---------------- */

export const DEFAULT_HABIT_UNIT = '次';

export const HABIT_UNIT_OPTIONS = ['次', '个', '页', '公里', '米', '分钟', '小时'] as const;

interface UnitDefinition {
  group: string;
  factor: number;
}

const UNIT_DEFINITIONS: Record<string, UnitDefinition> = {
  秒: { group: 'time', factor: 1 },
  s: { group: 'time', factor: 1 },
  分钟: { group: 'time', factor: 60 },
  min: { group: 'time', factor: 60 },
  小时: { group: 'time', factor: 3600 },
  h: { group: 'time', factor: 3600 },
  米: { group: 'distance', factor: 1 },
  m: { group: 'distance', factor: 1 },
  公里: { group: 'distance', factor: 1000 },
  km: { group: 'distance', factor: 1000 },
};

export function normalizeUnit(unit?: string): string {
  const value = unit?.trim();
  return value ? value : DEFAULT_HABIT_UNIT;
}

export function unitGroup(unit: string): string {
  return UNIT_DEFINITIONS[normalizeUnit(unit)]?.group ?? `custom:${normalizeUnit(unit)}`;
}

/** 同组单位换算；无法换算时返回 null，调用方应保留原记录而不是强行相加 */
export function convertAmount(value: number, from: string, to: string): number | null {
  const source = normalizeUnit(from);
  const target = normalizeUnit(to);
  if (source === target) return value;

  const sourceDefinition = UNIT_DEFINITIONS[source];
  const targetDefinition = UNIT_DEFINITIONS[target];
  if (!sourceDefinition || !targetDefinition) return null;
  if (sourceDefinition.group !== targetDefinition.group) return null;

  return (value * sourceDefinition.factor) / targetDefinition.factor;
}

export function isTimeUnit(unit: string): boolean {
  return unitGroup(unit) === 'time';
}

export function habitUnit(habit: Habit): string {
  return normalizeUnit(habit.unit);
}

export function habitDailyTarget(habit: Habit): number {
  const target = habit.dailyTarget ?? 1;
  return Number.isFinite(target) && target > 0 ? target : 1;
}

export interface HabitDayAmount {
  done: number;
  skipped: number;
}

/** 当日累计量；跨单位且无法换算的记录计入 skipped，不参与相加 */
export function habitDayAmount(
  logs: HabitLog[],
  habitId: string,
  date: string,
  unit: string,
): HabitDayAmount {
  let done = 0;
  let skipped = 0;

  for (const log of logs) {
    if (log.habitId !== habitId || log.date !== date) continue;
    const converted = convertAmount(log.value, log.unit ?? DEFAULT_HABIT_UNIT, unit);
    if (converted === null) {
      skipped += 1;
      continue;
    }
    done += converted;
  }

  return { done, skipped };
}

export function habitPeriodAmount(
  logs: HabitLog[],
  habitId: string,
  startDate: string,
  endDate: string,
  unit: string,
): number {
  let total = 0;
  for (const log of logs) {
    if (log.habitId !== habitId) continue;
    if (log.date < startDate || log.date > endDate) continue;
    const converted = convertAmount(log.value, log.unit ?? DEFAULT_HABIT_UNIT, unit);
    if (converted !== null) total += converted;
  }
  return total;
}

export function habitWeekAmount(
  habit: Habit,
  logs: HabitLog[],
  weekStart: Date,
): number {
  return habitPeriodAmount(
    logs,
    habit.id,
    format(weekStart, 'yyyy-MM-dd'),
    format(addDays(weekStart, 6), 'yyyy-MM-dd'),
    habitUnit(habit),
  );
}

export interface HabitProgress {
  /** 分子：已打卡任务量 / 实际完成量 */
  done: number;
  /** 分母：今日任务量 / 目标量 */
  target: number;
  ratio: number;
  unit: string;
  /** 因单位不可换算而未计入的记录条数 */
  skipped: number;
}

/** 环比：分子=已打卡量，分母=目标量（目标型）或今日任务量（任务型） */
export function habitProgress(habit: Habit, logs: HabitLog[], date: string): HabitProgress {
  const unit = habitUnit(habit);
  const target = habitDailyTarget(habit);
  const { done, skipped } = habitDayAmount(logs, habit.id, date, unit);

  return {
    done,
    target,
    ratio: target > 0 ? Math.min(1, done / target) : 0,
    unit,
    skipped,
  };
}