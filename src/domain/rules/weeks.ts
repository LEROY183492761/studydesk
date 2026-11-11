import { differenceInCalendarDays, parse, parseISO, startOfDay } from 'date-fns';
import type { CourseSession, PeriodTime, TimetableMeta, WeekParity } from '../models';
import { DEFAULT_PERIOD_TIMES } from '../models';

export function teachingWeekOf(date: Date, termStartDate: string): number {
  const start = startOfDay(parseISO(termStartDate));
  const diff = differenceInCalendarDays(startOfDay(date), start);
  if (diff < 0) return 0;
  return Math.floor(diff / 7) + 1;
}

export function matchesParity(week: number, parity: WeekParity): boolean {
  if (parity === 'all') return true;
  return parity === 'odd' ? week % 2 === 1 : week % 2 === 0;
}

export function isSessionActiveInWeek(session: CourseSession, week: number): boolean {
  if (session.hidden) return false;
  if (!session.weeks.includes(week)) return false;
  return matchesParity(week, session.parity);
}

export function getPeriodTime(
  period: number,
  times: PeriodTime[] = DEFAULT_PERIOD_TIMES,
): PeriodTime | undefined {
  return times.find((item) => item.period === period);
}

export function sessionTimeRange(
  session: CourseSession,
  date: Date,
  times: PeriodTime[] = DEFAULT_PERIOD_TIMES,
): { start: Date; end: Date } | undefined {
  const first = getPeriodTime(session.startPeriod, times);
  const last = getPeriodTime(session.endPeriod, times);
  if (!first || !last) return undefined;

  const base = startOfDay(date);
  const [startHour, startMinute] = first.start.split(':').map(Number);
  const [endHour, endMinute] = last.end.split(':').map(Number);

  return {
    start: parse(
      `${String(startHour).padStart(2, '0')}:${String(startMinute).padStart(2, '0')}`,
      'HH:mm',
      base,
    ),
    end: parse(
      `${String(endHour).padStart(2, '0')}:${String(endMinute).padStart(2, '0')}`,
      'HH:mm',
      base,
    ),
  };
}

export function termProgress(meta: TimetableMeta, currentWeek: number): number {
  if (meta.totalWeeks <= 0) return 0;
  return Math.min(1, Math.max(0, currentWeek / meta.totalWeeks));
}