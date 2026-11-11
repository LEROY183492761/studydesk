import { differenceInMinutes, parseISO } from 'date-fns';
import type {
  CalendarItem,
  FocusSession,
  Habit,
  HabitLog,
  ISODate,
  ReviewMetrics,
  Task,
} from '../models';
import { toLocalISODate } from '@/lib/dates';

export interface MetricsInput {
  date: ISODate;
  tasks: Task[];
  items: CalendarItem[];
  focusSessions: FocusSession[];
  habits: Habit[];
  habitLogs: HabitLog[];
}

export function computeDailyMetrics(input: MetricsInput): ReviewMetrics {
  const { date, tasks, items, focusSessions, habits, habitLogs } = input;

  const created = tasks.filter((task) => toLocalISODate(task.createdAt) === date);
  const completed = tasks.filter(
    (task) =>
      task.status === 'done' && Boolean(task.completedAt) && toLocalISODate(task.completedAt as string) === date,
  );

  const focusOfDay = focusSessions.filter(
    (session) => session.mode === 'focus' && toLocalISODate(session.startedAt) === date,
  );

  const courseMinutes = items
    .filter((item) => item.source === 'course' && toLocalISODate(item.start) === date)
    .reduce(
      (sum, item) => sum + Math.max(0, differenceInMinutes(parseISO(item.end), parseISO(item.start))),
      0,
    );

  const activeHabits = habits.filter((habit) => !habit.archived);
  const checked = activeHabits.filter((habit) =>
    habitLogs.some((log) => log.habitId === habit.id && log.date === date && log.value > 0),
  );

  const focusSeconds = focusOfDay.reduce((sum, session) => sum + session.actualSeconds, 0);

  return {
    focusMinutes: Math.round(focusSeconds / 60),
    focusSeconds,
    abandonedSessions: focusOfDay.filter((session) => session.abandoned).length,
    focusSessions: focusOfDay.length,
    tasksCompleted: completed.length,
    tasksCreated: created.length,
    completionRate: created.length === 0 ? 0 : Math.min(1, completed.length / created.length),
    courseMinutes,
    habitCompletionRate: activeHabits.length === 0 ? 0 : checked.length / activeHabits.length,
  };
}