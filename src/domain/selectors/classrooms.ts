import { format } from 'date-fns';
import type { ClassroomSlot, Timetable } from '../models';
import { isSessionActiveInWeek, teachingWeekOf } from '../rules/weeks';

export const TOTAL_PERIODS = 14;

export function allPeriods(): number[] {
  return Array.from({ length: TOTAL_PERIODS }, (_, index) => index + 1);
}

/** 个人空闲节次：当天未被课程占用的节次 */
export function freePeriodsForDate(timetable: Timetable | null, date: Date): number[] {
  if (!timetable) return allPeriods();

  const week = teachingWeekOf(date, timetable.meta.termStartDate);
  if (week <= 0) return allPeriods();

  const jsWeekday = date.getDay() === 0 ? 7 : date.getDay();
  const occupied = new Set<number>();

  for (const session of timetable.sessions) {
    if (session.weekday !== jsWeekday) continue;
    if (!isSessionActiveInWeek(session, week)) continue;
    for (let period = session.startPeriod; period <= session.endPeriod; period += 1) {
      occupied.add(period);
    }
  }

  return allPeriods().filter((period) => !occupied.has(period));
}

export interface ClassroomMatch {
  slot: ClassroomSlot;
  matchedPeriods: number[];
}

/** 空教室与个人空闲节次的交集，按可覆盖节次数量降序 */
export function matchClassroomSlots(
  slots: ClassroomSlot[],
  date: Date,
  freePeriods: number[],
): ClassroomMatch[] {
  const dateKey = format(date, 'yyyy-MM-dd');
  const free = new Set(freePeriods);

  return slots
    .filter((slot) => slot.date === dateKey)
    .map((slot) => {
      const matchedPeriods: number[] = [];
      for (let period = slot.startPeriod; period <= slot.endPeriod; period += 1) {
        if (free.has(period)) matchedPeriods.push(period);
      }
      return { slot, matchedPeriods };
    })
    .filter((match) => match.matchedPeriods.length > 0)
    .sort(
      (a, b) =>
        b.matchedPeriods.length - a.matchedPeriods.length ||
        a.slot.building.localeCompare(b.slot.building) ||
        a.slot.room.localeCompare(b.slot.room),
    );
}