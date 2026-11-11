import {
  addDays,
  addMonths,
  isAfter,
  isBefore,
  parseISO,
  startOfDay,
  startOfMonth,
} from 'date-fns';
import type { EventRecurrence } from '../models';

export type RecurrenceRule = EventRecurrence;

const MAX_OCCURRENCES = 500;

function nthWeekdayOfMonth(monthDate: Date, setPos: number, weekday: number): Date | null {
  const year = monthDate.getFullYear();
  const month = monthDate.getMonth();

  if (setPos > 0) {
    const first = new Date(year, month, 1);
    const offset = (weekday - first.getDay() + 7) % 7;
    const day = 1 + offset + (setPos - 1) * 7;
    const date = new Date(year, month, day);
    return date.getMonth() === month ? date : null;
  }

  const last = new Date(year, month + 1, 0);
  const offset = (last.getDay() - weekday + 7) % 7;
  const day = last.getDate() - offset + (setPos + 1) * 7;
  const date = new Date(year, month, day);
  return date.getMonth() === month ? date : null;
}

/**
 * 展开 RRULE 子集：daily / weekly / monthly。
 * - 结果按日期升序；
 * - count 从 startsOn 起计数（包含范围外 occurrence）；
 * - until 与范围共同截断。
 */
export function expandRecurrence(
  rule: RecurrenceRule,
  startsOn: Date,
  rangeStart: Date,
  rangeEnd: Date,
): Date[] {
  const start = startOfDay(startsOn);
  const from = startOfDay(rangeStart);
  const to = startOfDay(rangeEnd);
  const until = rule.until ? startOfDay(parseISO(rule.until)) : undefined;
  const interval = Math.max(1, rule.interval);
  const limit = rule.count ?? MAX_OCCURRENCES;

  const results: Date[] = [];
  let emitted = 0;

  const collect = (date: Date): boolean => {
    if (isBefore(date, start)) return true;
    if (until && isAfter(date, until)) return false;
    if (emitted >= limit) return false;
    emitted += 1;
    if (!isBefore(date, from) && !isAfter(date, to)) {
      results.push(date);
    }
    return true;
  };

  if (rule.frequency === 'daily') {
    for (let cursor = start; emitted < limit; cursor = addDays(cursor, interval)) {
      if (until && isAfter(cursor, until)) break;
      if (isAfter(cursor, to) && !until) break;
      if (!collect(cursor)) break;
      if (isAfter(cursor, to) && until && isAfter(cursor, until)) break;
    }
  } else if (rule.frequency === 'weekly') {
    const weekdays = rule.byWeekday?.length ? [...rule.byWeekday].sort() : [start.getDay()];
    for (let week = 0; emitted < limit; week += 1) {
      const base = addDays(start, week * 7 * interval);
      if (isAfter(base, to) && (!until || isAfter(base, until))) break;
      for (const weekday of weekdays) {
        const offset = (weekday - start.getDay() + 7) % 7;
        const date = addDays(base, offset);
        if (!collect(date)) break;
      }
    }
  } else {
    for (let monthIndex = 0; emitted < limit; monthIndex += 1) {
      const monthDate = addMonths(startOfMonth(start), monthIndex * interval);
      if (isAfter(monthDate, to) && (!until || isAfter(monthDate, until))) break;

      const date = rule.byMonthDay
        ? new Date(monthDate.getFullYear(), monthDate.getMonth(), rule.byMonthDay)
        : nthWeekdayOfMonth(
            monthDate,
            rule.bySetPos ?? 1,
            rule.byWeekday?.[0] ?? start.getDay(),
          );

      if (!date || date.getMonth() !== monthDate.getMonth()) continue;
      if (!collect(date)) break;
    }
  }

  return results.sort((a, b) => a.getTime() - b.getTime());
}