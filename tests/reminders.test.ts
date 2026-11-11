import { describe, expect, it } from 'vitest';
import { dueCountdownReminders, dueReminders } from '@/domain/rules/reminders';
import type { CalendarItem, Countdown, Habit, HabitLog } from '@/domain/models';

const now = new Date(2026, 8, 7, 9, 50);
const at = (hour: number, minute = 0) => new Date(2026, 8, 7, hour, minute).toISOString();

const course: CalendarItem = {
  id: 'c1',
  source: 'course',
  title: '高等数学',
  start: at(10),
  end: at(11, 40),
  allDay: false,
  readonly: true,
  location: 'N112',
};

function habit(overrides: Partial<Habit> = {}): Habit {
  return {
    id: 'h1',
    name: '背单词',
    color: '#000',
    frequency: { type: 'daily' },
    archived: false,
    createdAt: now.toISOString(),
    remindAt: '07:00',
    ...overrides,
  };
}

describe('提醒调度', () => {
  it('课前 10 分钟内推送一次课程提醒', () => {
    const messages = dueReminders({
      now,
      items: [course],
      habits: [],
      habitLogs: [],
      sent: new Set(),
    });

    expect(messages).toHaveLength(1);
    expect(messages[0]).toMatchObject({ kind: 'course', key: 'item:c1:2026-09-07' });
    expect(messages[0].title).toContain('高等数学');
    expect(messages[0].body).toContain('N112');
  });

  it('已推送或已开始的课程不再提醒', () => {
    const sentOnce = dueReminders({
      now,
      items: [course],
      habits: [],
      habitLogs: [],
      sent: new Set(['item:c1:2026-09-07']),
    });
    expect(sentOnce).toHaveLength(0);

    const started = dueReminders({
      now: new Date(2026, 8, 7, 10, 5),
      items: [course],
      habits: [],
      habitLogs: [],
      sent: new Set(),
    });
    expect(started).toHaveLength(0);
  });

  it('习惯到点且未打卡时推送，已打卡或超出宽限不推送', () => {
    const log: HabitLog = {
      id: 'l1',
      habitId: 'h1',
      date: '2026-09-07',
      value: 1,
    };

    const due = dueReminders({
      now: new Date(2026, 8, 7, 7, 2),
      items: [],
      habits: [habit()],
      habitLogs: [],
      sent: new Set(),
    });
    expect(due).toHaveLength(1);
    expect(due[0]).toMatchObject({ kind: 'habit', key: 'habit:h1:2026-09-07' });

    const done = dueReminders({
      now: new Date(2026, 8, 7, 7, 2),
      items: [],
      habits: [habit()],
      habitLogs: [log],
      sent: new Set(),
    });
    expect(done).toHaveLength(0);

    const expired = dueReminders({
      now: new Date(2026, 8, 7, 7, 10),
      items: [],
      habits: [habit()],
      habitLogs: [],
      sent: new Set(),
    });
    expect(expired).toHaveLength(0);
  });

  it('全天项与未到提醒时刻的习惯被忽略', () => {
    const messages = dueReminders({
      now: new Date(2026, 8, 7, 6, 50),
      items: [{ ...course, allDay: true }],
      habits: [habit()],
      habitLogs: [],
      sent: new Set(),
    });
    expect(messages).toHaveLength(0);
  });

  it('支持自定义课前提前量与习惯宽限', () => {
    const early = dueReminders({
      now: new Date(2026, 8, 7, 9, 45),
      items: [course],
      habits: [],
      habitLogs: [],
      sent: new Set(),
      leadMinutes: 20,
    });
    expect(early).toHaveLength(1);

    const flexibleHabit = dueReminders({
      now: new Date(2026, 8, 7, 7, 12),
      items: [],
      habits: [habit()],
      habitLogs: [],
      sent: new Set(),
      habitGraceMinutes: 15,
    });
    expect(flexibleHabit).toHaveLength(1);
  });

  it('倒数日当天 09:00 后提醒一次，已发送后不重复', () => {
    const countdown: Countdown = {
      id: 'd1',
      title: '期末考试',
      date: '2026-09-07',
      createdAt: new Date(2026, 8, 1).toISOString(),
    };
    const now = new Date(2026, 8, 7, 9, 30);

    const messages = dueCountdownReminders([countdown], now, new Set());
    expect(messages).toHaveLength(1);
    expect(messages[0]).toMatchObject({
      kind: 'countdown',
      key: 'countdown:d1:2026-09-07',
    });

    const again = dueCountdownReminders([countdown], now, new Set([messages[0].key]));
    expect(again).toHaveLength(0);

    const custom = [{ ...countdown, remindAt: '20:00' }];
    expect(dueCountdownReminders(custom, new Date(2026, 8, 7, 20, 30), new Set())).toHaveLength(1);
    expect(dueCountdownReminders(custom, new Date(2026, 8, 7, 9, 30), new Set())).toHaveLength(0);
  });
});