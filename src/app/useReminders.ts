import { useEffect, useRef } from 'react';
import { buildCalendarItems, dayRange } from '@/domain/selectors/calendar';
import { dueCountdownReminders, dueReminders } from '@/domain/rules/reminders';
import { appendReminderHistory } from '@/domain/rules/notificationHistory';
import { getPlatform } from '@/platform';
import { toLocalISODate } from '@/lib/dates';
import { useAppStore } from '@/state/appStore';

const TICK_MS = 30_000;

/**
 * 全局提醒调度：课前 10 分钟与习惯到点提醒。
 * 番茄结束通知由专注页在计时结束时直接发送。
 */
export function useReminders() {
  const ready = useAppStore((state) => state.ready);
  const notifications = useAppStore((state) => state.settings.notifications);
  const reminderLeadMinutes = useAppStore((state) => state.settings.reminderLeadMinutes);
  const habitGraceMinutes = useAppStore((state) => state.settings.habitGraceMinutes);
  const timetable = useAppStore((state) => state.timetable);
  const events = useAppStore((state) => state.events);
  const tasks = useAppStore((state) => state.tasks);
  const habits = useAppStore((state) => state.habits);
  const habitLogs = useAppStore((state) => state.habitLogs);
  const countdowns = useAppStore((state) => state.countdowns);

  const sentRef = useRef<Set<string>>(new Set());
  const dayRef = useRef('');

  useEffect(() => {
    if (!ready || !notifications) return;
    let cancelled = false;

    const tick = async () => {
      const now = new Date();
      const today = toLocalISODate(now);
      if (dayRef.current !== today) {
        sentRef.current.clear();
        dayRef.current = today;
      }

      const platform = await getPlatform();
      if (cancelled) return;

      const items = buildCalendarItems({ timetable, events, tasks, range: dayRange(now) });
      const messages = [
        ...dueReminders({
          now,
          items,
          habits,
          habitLogs,
          sent: sentRef.current,
          leadMinutes: reminderLeadMinutes,
          habitGraceMinutes,
        }),
        ...dueCountdownReminders(countdowns, now, sentRef.current),
      ];

      for (const message of messages) {
        sentRef.current.add(message.key);
        await platform.notification.notify(message.title, message.body);
        appendReminderHistory({
          id: `${message.key}:${Date.now()}`,
          title: message.title,
          body: message.body,
          at: new Date().toISOString(),
        });
      }
    };

    void tick();
    const handle = window.setInterval(() => void tick(), TICK_MS);
    return () => {
      cancelled = true;
      window.clearInterval(handle);
    };
  }, [ready, notifications, reminderLeadMinutes, habitGraceMinutes, timetable, events, tasks, habits, habitLogs, countdowns]);
}