import { eachDayOfInterval, format } from 'date-fns';
import type {
  CalendarItem,
  FocusSession,
  Habit,
  HabitLog,
  ReviewMetrics,
  Task,
} from '../models';
import { computeDailyMetrics } from './reviewMetrics';

export interface DailySlice {
  date: string;
  metrics: ReviewMetrics;
}

export interface WeeklyMetrics {
  days: DailySlice[];
  focusMinutes: number;
  focusSeconds: number;
  abandonedSessions: number;
  focusSessions: number;
  tasksCompleted: number;
  tasksCreated: number;
  completionRate: number;
  courseMinutes: number;
  habitCompletionRate: number;
  bestFocusDate?: string;
}

export interface WeeklyInput {
  weekStart: Date;
  weekEnd: Date;
  tasks: Task[];
  items: CalendarItem[];
  focusSessions: FocusSession[];
  habits: Habit[];
  habitLogs: HabitLog[];
}

export function computeWeeklyMetrics(input: WeeklyInput): WeeklyMetrics {
  const { weekStart, weekEnd, tasks, items, focusSessions, habits, habitLogs } = input;

  const days = eachDayOfInterval({ start: weekStart, end: weekEnd }).map((day) => {
    const date = format(day, 'yyyy-MM-dd');
    return {
      date,
      metrics: computeDailyMetrics({
        date,
        tasks,
        items,
        focusSessions,
        habits,
        habitLogs,
      }),
    };
  });

  const focusMinutes = days.reduce((sum, day) => sum + day.metrics.focusMinutes, 0);
  const focusSeconds = days.reduce((sum, day) => sum + (day.metrics.focusSeconds ?? 0), 0);
  const abandonedSessions = days.reduce(
    (sum, day) => sum + (day.metrics.abandonedSessions ?? 0),
    0,
  );
  const focusSessionsCount = days.reduce((sum, day) => sum + day.metrics.focusSessions, 0);
  const tasksCompleted = days.reduce((sum, day) => sum + day.metrics.tasksCompleted, 0);
  const tasksCreated = days.reduce((sum, day) => sum + day.metrics.tasksCreated, 0);
  const courseMinutes = days.reduce((sum, day) => sum + day.metrics.courseMinutes, 0);
  const habitRateSum = days.reduce((sum, day) => sum + day.metrics.habitCompletionRate, 0);

  const best = days.reduce<DailySlice | undefined>((current, day) => {
    if (!current) return day;
    return day.metrics.focusMinutes > current.metrics.focusMinutes ? day : current;
  }, undefined);

  return {
    days,
    focusMinutes,
    focusSeconds,
    abandonedSessions,
    focusSessions: focusSessionsCount,
    tasksCompleted,
    tasksCreated,
    completionRate: tasksCreated === 0 ? 0 : Math.min(1, tasksCompleted / tasksCreated),
    courseMinutes,
    habitCompletionRate: days.length === 0 ? 0 : habitRateSum / days.length,
    bestFocusDate: best && best.metrics.focusMinutes > 0 ? best.date : undefined,
  };
}