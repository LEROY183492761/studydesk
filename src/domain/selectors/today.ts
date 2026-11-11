import { isAfter, parseISO } from 'date-fns';
import type {
  CalendarItem,
  FocusSession,
  HabitLog,
  ISODate,
  Task,
} from '../models';
import { toLocalISODate } from '@/lib/dates';
import { teachingWeekOf } from '../rules/weeks';

export interface TodayOverview {
  date: ISODate;
  teachingWeek: number;
  items: CalendarItem[];
  nextCourse?: CalendarItem;
  openTasks: Task[];
  doneTasks: Task[];
  habitDone: number;
  habitTotal: number;
  focusMinutes: number;
}

export interface TodayInput {
  now: Date;
  date: ISODate;
  termStartDate: string;
  items: CalendarItem[];
  tasks: Task[];
  habitLogs: HabitLog[];
  focusSessions: FocusSession[];
  habitTotal: number;
}

export function buildTodayOverview(input: TodayInput): TodayOverview {
  const { now, date, items, tasks, habitLogs, focusSessions } = input;

  const dayItems = items
    .filter((item) => toLocalISODate(item.start) === date)
    .sort((a, b) => a.start.localeCompare(b.start));

  const nextCourse = dayItems.find(
    (item) => item.source === 'course' && isAfter(parseISO(item.end), now),
  );

  const openTasks = tasks
    .filter((task) => task.status !== 'done' && task.status !== 'archived')
    .sort((a, b) => (a.dueAt ?? '9999').localeCompare(b.dueAt ?? '9999'));

  const doneTasks = tasks.filter(
    (task) =>
      task.status === 'done' && Boolean(task.completedAt) && toLocalISODate(task.completedAt as string) === date,
  );

  const focusSeconds = focusSessions
    .filter((session) => session.mode === 'focus' && toLocalISODate(session.startedAt) === date)
    .reduce((sum, session) => sum + session.actualSeconds, 0);

  return {
    date,
    teachingWeek: teachingWeekOf(parseISO(date), input.termStartDate),
    items: dayItems,
    nextCourse,
    openTasks,
    doneTasks,
    habitDone: habitLogs.filter((log) => log.date === date && log.value > 0).length,
    habitTotal: input.habitTotal,
    focusMinutes: Math.round(focusSeconds / 60),
  };
}