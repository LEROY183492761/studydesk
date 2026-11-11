import { addMinutes } from 'date-fns';
import type { CalendarItem, Task } from '../models';
import { isOverlapping } from './conflicts';

export function applySchedule(
  task: Task,
  start: Date,
  minutes: number,
): Task & { scheduledStart: string; scheduledEnd: string } {
  const duration = Math.max(5, Math.round(minutes));
  return {
    ...task,
    status: task.status === 'done' ? 'done' : 'planned',
    scheduledStart: start.toISOString(),
    scheduledEnd: addMinutes(start, duration).toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

export function clearSchedule(task: Task): Task {
  return {
    ...task,
    status: task.status === 'done' ? 'done' : 'inbox',
    scheduledStart: undefined,
    scheduledEnd: undefined,
    updatedAt: new Date().toISOString(),
  };
}

export function scheduleConflicts(task: Task, items: CalendarItem[]): CalendarItem[] {
  if (!task.scheduledStart || !task.scheduledEnd) return [];

  return items.filter(
    (item) =>
      item.sourceId !== task.id &&
      isOverlapping(
        { start: task.scheduledStart as string, end: task.scheduledEnd as string },
        { start: item.start, end: item.end },
      ),
  );
}

export function minutesBetween(start: string, end: string): number {
  return Math.max(0, Math.round((new Date(end).getTime() - new Date(start).getTime()) / 60_000));
}