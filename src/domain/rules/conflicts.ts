import { parseISO } from 'date-fns';
import { toLocalISODate } from '@/lib/dates';
import type { CalendarItem } from '../models';

export interface TimeRange {
  start: string;
  end: string;
}

function toMillis(value: string): number {
  return parseISO(value).getTime();
}

export function isOverlapping(a: TimeRange, b: TimeRange): boolean {
  return toMillis(a.start) < toMillis(b.end) && toMillis(b.start) < toMillis(a.end);
}

export function findConflicts(
  target: CalendarItem,
  candidates: CalendarItem[],
  excludeSource: CalendarItem['source'] = 'task',
): CalendarItem[] {
  return candidates.filter(
    (item) => item.id !== target.id && item.source !== excludeSource && isOverlapping(target, item),
  );
}

export function groupByDay(items: CalendarItem[]): Map<string, CalendarItem[]> {
  const result = new Map<string, CalendarItem[]>();
  for (const item of items) {
    const key = toLocalISODate(item.start);
    const bucket = result.get(key);
    if (bucket) bucket.push(item);
    else result.set(key, [item]);
  }
  return result;
}