import { format } from 'date-fns';
import type { CalendarItem, Countdown, Habit, HabitLog } from '../models';
import { toLocalISODate } from '@/lib/dates';
import { countdownDays } from './goals';
import { isHabitDone } from './habits';

export const DEFAULT_REMINDER_LEAD_MINUTES = 10;
export const DEFAULT_HABIT_GRACE_MINUTES = 5;

export interface ReminderMessage {
  key: string;
  kind: 'course' | 'habit' | 'countdown';
  title: string;
  body: string;
}

export interface ReminderInput {
  now: Date;
  /** 当天已展开的日历项（含循环日程 occurrence） */
  items: CalendarItem[];
  habits: Habit[];
  habitLogs: HabitLog[];
  /** 已经推送过的提醒 key，用于去重 */
  sent: ReadonlySet<string>;
  leadMinutes?: number;
  habitGraceMinutes?: number;
}

/**
 * 计算此刻应当推送的提醒：
 * - 课程/日程：开始前 leadMinutes 分钟内，且尚未开始；
 * - 习惯：到达 remindAt 后 habitGraceMinutes 分钟内，且今天还没打卡。
 */
export function dueReminders(input: ReminderInput): ReminderMessage[] {
  const { now, items, habits, habitLogs, sent } = input;
  const leadMinutes = input.leadMinutes ?? DEFAULT_REMINDER_LEAD_MINUTES;
  const graceMinutes = input.habitGraceMinutes ?? DEFAULT_HABIT_GRACE_MINUTES;
  const nowMs = now.getTime();
  const today = format(now, 'yyyy-MM-dd');
  const messages: ReminderMessage[] = [];

  for (const item of items) {
    if (item.allDay) continue;
    if (item.source !== 'course' && item.source !== 'event') continue;

    const startMs = new Date(item.start).getTime();
    const diffMs = startMs - nowMs;
    if (diffMs <= 0 || diffMs > leadMinutes * 60_000) continue;

    const date = toLocalISODate(item.start);
    const key = `item:${item.id}:${date}`;
    if (sent.has(key)) continue;

    const minutes = Math.max(1, Math.round(diffMs / 60_000));
    messages.push({
      key,
      kind: 'course',
      title: minutes <= 1 ? `${item.title} 即将开始` : `还有 ${minutes} 分钟：${item.title}`,
      body: `${format(new Date(item.start), 'HH:mm')} 开始${item.location ? ` · ${item.location}` : ''}`,
    });
  }

  for (const habit of habits) {
    if (habit.archived || !habit.remindAt || isHabitDone(habitLogs, habit.id, today)) continue;

    const [hour, minute] = habit.remindAt.split(':').map(Number);
    if (!Number.isFinite(hour) || !Number.isFinite(minute)) continue;

    const target = new Date(now);
    target.setHours(hour, minute, 0, 0);
    const diffMs = nowMs - target.getTime();
    if (diffMs < 0 || diffMs > graceMinutes * 60_000) continue;

    const key = `habit:${habit.id}:${today}`;
    if (sent.has(key)) continue;

    messages.push({
      key,
      kind: 'habit',
      title: `该打卡了：${habit.name}`,
      body: `今天还没有完成「${habit.name}」`,
    });
  }

  return messages;
}
/** 倒数日当天到达自定义提醒时刻后的 60 分钟内提醒一次 */
export function dueCountdownReminders(
  countdowns: Countdown[],
  now: Date,
  sent: ReadonlySet<string>,
): ReminderMessage[] {
  const messages: ReminderMessage[] = [];
  const today = format(now, 'yyyy-MM-dd');
  const nowMinutes = now.getHours() * 60 + now.getMinutes();

  for (const item of countdowns) {
    if (countdownDays(item, now) !== 0) continue;

    const [hour, minute] = (item.remindAt ?? '09:00').split(':').map(Number);
    if (!Number.isFinite(hour) || !Number.isFinite(minute)) continue;

    const diff = nowMinutes - (hour * 60 + minute);
    if (diff < 0 || diff > 60) continue;

    const key = `countdown:${item.id}:${today}`;
    if (sent.has(key)) continue;

    messages.push({
      key,
      kind: 'countdown',
      title: `今天是「${item.title}」`,
      body: item.note?.trim() || '倒数日已到，记得安排今天的时间。',
    });
  }

  return messages;
}