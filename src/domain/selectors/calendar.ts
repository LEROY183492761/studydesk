import {
  addDays,
  eachDayOfInterval,
  format,
  isAfter,
  isBefore,
  isSameDay,
  parseISO,
  startOfDay,
  startOfMonth,
  startOfWeek,
} from 'date-fns';
import type { CalendarItem, ScheduleEvent, Task, Timetable } from '../models';
import { expandRecurrence } from '../rules/recurrence';
import { buildCourseItems } from './timetable';

export interface CalendarRange {
  start: Date;
  end: Date;
}

export const DAY_START_HOUR = 7;
export const DAY_END_HOUR = 23;

export function dayRange(date: Date): CalendarRange {
  return { start: date, end: date };
}

export function weekRange(date: Date, weekStartsOn: 0 | 1): CalendarRange {
  const start = startOfWeek(date, { weekStartsOn });
  return { start, end: addDays(start, 6) };
}

/** 月视图固定 6 行 × 7 列，覆盖前后月余日 */
export function monthRange(date: Date, weekStartsOn: 0 | 1): CalendarRange {
  const start = startOfWeek(startOfMonth(date), { weekStartsOn });
  return { start, end: addDays(start, 41) };
}

export function weekDays(date: Date, weekStartsOn: 0 | 1): Date[] {
  const range = weekRange(date, weekStartsOn);
  return eachDayOfInterval({ start: range.start, end: range.end });
}

export function monthGridDays(date: Date, weekStartsOn: 0 | 1): Date[] {
  const range = monthRange(date, weekStartsOn);
  return eachDayOfInterval({ start: range.start, end: range.end });
}

export function expandCourseItems(
  timetable: Timetable,
  range: CalendarRange,
): CalendarItem[] {
  return eachDayOfInterval({ start: range.start, end: range.end }).flatMap((day) =>
    buildCourseItems(timetable, day),
  );
}

export function taskToCalendarItem(task: Task): CalendarItem | null {
  if (!task.scheduledStart || !task.scheduledEnd) return null;
  if (task.status === 'done' || task.status === 'archived') return null;

  return {
    id: `task_${task.id}`,
    source: 'task',
    title: task.title,
    start: task.scheduledStart,
    end: task.scheduledEnd,
    allDay: false,
    readonly: false,
    color: 'var(--color-course-4)',
    sourceId: task.id,
  };
}

export function eventToCalendarItem(event: ScheduleEvent): CalendarItem {
  return {
    id: `event_${event.id}`,
    source: 'event',
    title: event.title,
    start: event.start,
    end: event.end,
    allDay: event.allDay,
    readonly: false,
    color: event.kind === 'deadline' ? 'var(--color-danger)' : 'var(--color-course-5)',
    location: event.location,
    sourceId: event.id,
    kind: event.kind ?? 'event',
  };
}

const MAX_SEGMENTS = 62;

/** 跨天事件拆成每日一段，保证次日也能在时间轴出现 */
function splitAcrossDays(
  base: CalendarItem,
  start: Date,
  end: Date,
  range: CalendarRange,
): CalendarItem[] {
  const rangeStart = startOfDay(range.start);
  const rangeEnd = startOfDay(range.end);
  const firstDay = startOfDay(start);
  const lastDay = startOfDay(end);
  const multiDay = lastDay.getTime() !== firstDay.getTime();
  const segments: CalendarItem[] = [];

  let cursor = firstDay;
  let guard = 0;
  while (!isAfter(cursor, lastDay) && guard < MAX_SEGMENTS) {
    guard += 1;
    const dayEnd = addDays(cursor, 1);

    if (!isBefore(cursor, rangeStart) && !isAfter(cursor, rangeEnd)) {
      const segmentStart = isBefore(start, cursor) ? cursor : start;
      const segmentEnd = isAfter(end, dayEnd) ? dayEnd : end;

      if (isAfter(segmentEnd, segmentStart)) {
        segments.push({
          ...base,
          id: `${base.id}_d${format(cursor, 'yyyyMMdd')}`,
          title: multiDay && isAfter(cursor, firstDay) ? `${base.title}（续）` : base.title,
          start: segmentStart.toISOString(),
          end: segmentEnd.toISOString(),
        });
      }
    }

    cursor = addDays(cursor, 1);
  }

  return segments;
}

export interface CalendarItemsInput {
  timetable: Timetable | null;
  events: ScheduleEvent[];
  tasks: Task[];
  range: CalendarRange;
}

export function buildCalendarItems(input: CalendarItemsInput): CalendarItem[] {
  const { timetable, events, tasks, range } = input;

  const courseItems = timetable ? expandCourseItems(timetable, range) : [];
  const taskById = new Map(tasks.map((task) => [task.id, task]));

  const completeItem = (event: ScheduleEvent, item: CalendarItem): CalendarItem => {
    if (event.kind === 'deadline' && event.linkedTaskId) {
      const linked = taskById.get(event.linkedTaskId);
      return { ...item, completed: linked?.status === 'done' };
    }
    return item;
  };

  const eventItems = events.flatMap((event) => {
    const base = eventToCalendarItem(event);

    if (!event.repeat) {
      const start = parseISO(event.start);
      const end = parseISO(event.end);
      return splitAcrossDays(base, start, end, range).map((item) => completeItem(event, item));
    }

    const templateStart = parseISO(event.start);
    const templateEnd = parseISO(event.end);
    const occurrences = expandRecurrence(event.repeat, templateStart, range.start, range.end);

    return occurrences
      .filter((date) => !event.exdates?.includes(format(date, 'yyyy-MM-dd')))
      .flatMap((date) => {
        const key = format(date, 'yyyy-MM-dd');
        const override = event.overrides?.[key];

        const start = override
          ? parseISO(override.start)
          : (() => {
              const value = new Date(date);
              value.setHours(templateStart.getHours(), templateStart.getMinutes(), 0, 0);
              return value;
            })();
        const end = override
          ? parseISO(override.end)
          : (() => {
              const value = new Date(date);
              value.setHours(templateEnd.getHours(), templateEnd.getMinutes(), 0, 0);
              return value;
            })();

        return splitAcrossDays(
          { ...base, id: `${base.id}_${format(date, 'yyyyMMdd')}` },
          start,
          end,
          range,
        ).map((item) => completeItem(event, item));
      });
  });
  const taskItems = tasks
    .map(taskToCalendarItem)
    .filter((item): item is CalendarItem => item !== null);

  return [...courseItems, ...eventItems, ...taskItems].sort((a, b) =>
    a.start.localeCompare(b.start),
  );
}

export function itemsOnDay(items: CalendarItem[], day: Date): CalendarItem[] {
  return items
    .filter((item) => isSameDay(parseISO(item.start), day))
    .sort((a, b) => a.start.localeCompare(b.start));
}

export function minuteOffset(date: Date, dayStartHour: number): number {
  return (date.getHours() - dayStartHour) * 60 + date.getMinutes();
}

export function itemGeometry(
  item: { start: string; end: string },
  dayStartHour: number,
  dayEndHour: number,
): { top: number; height: number } {
  const totalMinutes = Math.max(1, (dayEndHour - dayStartHour) * 60);
  const start = parseISO(item.start);
  const end = parseISO(item.end);
  const startMinutes = Math.min(
    totalMinutes,
    Math.max(0, minuteOffset(start, dayStartHour)),
  );
  const endMinutes = Math.min(
    totalMinutes,
    Math.max(startMinutes + 20, minuteOffset(end, dayStartHour)),
  );

  return {
    top: (startMinutes / totalMinutes) * 100,
    height: ((endMinutes - startMinutes) / totalMinutes) * 100,
  };
}