import { describe, expect, it } from 'vitest';
import { addDays } from 'date-fns';
import {
  buildCalendarItems,
  monthGridDays,
  weekDays,
  weekRange,
} from '@/domain/selectors/calendar';
import { buildTimeline } from '@/domain/selectors/timeline';
import { applySchedule, clearSchedule, scheduleConflicts } from '@/domain/rules/schedule';
import type {
  CalendarItem,
  FocusSession,
  ScheduleEvent,
  Task,
  Timetable,
} from '@/domain/models';

const termStart = new Date(2026, 8, 7);
const termStartDate = '2026-09-07';

const timetable: Timetable = {
  meta: { semester: '2026-2027-1', termStartDate, totalWeeks: 16 },
  courses: [{ id: 'c1', name: '高等数学', color: 'var(--color-course-1)' }],
  sessions: [
    {
      id: 's1',
      courseId: 'c1',
      weekday: 1,
      startPeriod: 1,
      endPeriod: 2,
      weeks: [1],
      parity: 'all',
      location: '教三-101',
    },
  ],
};

const event: ScheduleEvent = {
  id: 'e1',
  title: '小组会议',
  start: new Date(2026, 8, 7, 10).toISOString(),
  end: new Date(2026, 8, 7, 11).toISOString(),
  allDay: false,
  category: 'meeting',
  source: 'manual',
};

function makeTask(overrides: Partial<Task> = {}): Task {
  return {
    id: 't1',
    title: '复习高数',
    status: 'inbox',
    priority: 'normal',
    source: 'manual',
    createdAt: new Date(2026, 8, 6).toISOString(),
    updatedAt: new Date(2026, 8, 6).toISOString(),
    ...overrides,
  };
}

describe('日历范围与网格', () => {
  it('月视图固定 42 天并覆盖前后月', () => {
    const days = monthGridDays(new Date(2026, 8, 15), 1);
    expect(days).toHaveLength(42);
    expect(days[0].getDay()).toBe(1);
    expect(days[41].getDate()).toBe(11);
  });

  it('周视图返回 7 天且从周一开始', () => {
    const days = weekDays(termStart, 1);
    expect(days).toHaveLength(7);
    expect(days[0].getDay()).toBe(1);
    expect(days[6].getDay()).toBe(0);
  });
});

describe('日历条目合并', () => {
  it('课程、日程与排期待办按开始时间合并', () => {
    const scheduled = makeTask({
      scheduledStart: new Date(2026, 8, 7, 14).toISOString(),
      scheduledEnd: new Date(2026, 8, 7, 15).toISOString(),
      status: 'planned',
    });

    const items = buildCalendarItems({
      timetable,
      events: [event],
      tasks: [scheduled, makeTask({ id: 't2' })],
      range: weekRange(termStart, 1),
    });

    expect(items).toHaveLength(3);
    expect(items.map((item) => item.source)).toEqual(['course', 'event', 'task']);
    expect(items[0].title).toBe('高等数学');
  });

  it('未排期任务不进入日历', () => {
    const items = buildCalendarItems({
      timetable: null,
      events: [],
      tasks: [makeTask()],
      range: weekRange(termStart, 1),
    });
    expect(items).toHaveLength(0);
  });
});

describe('排期规则', () => {
  it('排期后状态为 planned 并按分钟生成结束时间', () => {
    const scheduled = applySchedule(makeTask(), new Date(2026, 8, 7, 14), 90);
    expect(scheduled.status).toBe('planned');
    expect(new Date(scheduled.scheduledEnd).getTime() - new Date(scheduled.scheduledStart).getTime()).toBe(
      90 * 60_000,
    );
  });

  it('取消排期回到 inbox', () => {
    const scheduled = applySchedule(makeTask(), new Date(2026, 8, 7, 14), 60);
    expect(clearSchedule(scheduled).status).toBe('inbox');
    expect(clearSchedule(scheduled).scheduledStart).toBeUndefined();
  });

  it('与课程时间重叠时能识别冲突', () => {
    const items: CalendarItem[] = [
      {
        id: 'course_1',
        source: 'course',
        title: '高等数学',
        start: new Date(2026, 8, 7, 8).toISOString(),
        end: new Date(2026, 8, 7, 9, 40).toISOString(),
        allDay: false,
        readonly: true,
      },
    ];
    const scheduled = applySchedule(makeTask(), new Date(2026, 8, 7, 8, 30), 60);
    expect(scheduleConflicts(scheduled, items)).toHaveLength(1);
  });
});

describe('时间轴双轨', () => {
  it('计划层与专注实际层同时输出并排序', () => {
    const items: CalendarItem[] = [
      {
        id: 'course_1',
        source: 'course',
        title: '高等数学',
        start: new Date(2026, 8, 7, 8).toISOString(),
        end: new Date(2026, 8, 7, 9, 40).toISOString(),
        allDay: false,
        readonly: true,
      },
    ];
    const focusSessions: FocusSession[] = [
      {
        id: 'f1',
        startedAt: new Date(2026, 8, 7, 9).toISOString(),
        plannedSeconds: 1500,
        actualSeconds: 1500,
        mode: 'focus',
        completed: true,
        note: '高数复习',
      },
    ];

    const timeline = buildTimeline({ date: termStart, items, focusSessions });
    expect(timeline).toHaveLength(2);
    expect(timeline[0]).toMatchObject({ title: '高等数学', layer: 'planned' });
    expect(timeline[1]).toMatchObject({ title: '高数复习', layer: 'actual' });
  });

  it('只统计当天记录', () => {
    const focusSessions: FocusSession[] = [
      {
        id: 'f1',
        startedAt: new Date(2026, 8, 7, 9).toISOString(),
        plannedSeconds: 1500,
        actualSeconds: 1500,
        mode: 'focus',
        completed: true,
      },
      {
        id: 'f2',
        startedAt: new Date(2026, 8, 8, 9).toISOString(),
        plannedSeconds: 1500,
        actualSeconds: 1500,
        mode: 'focus',
        completed: true,
      },
    ];

    const timeline = buildTimeline({ date: addDays(termStart, 0), items: [], focusSessions });
    expect(timeline).toHaveLength(1);
    expect(timeline[0].id).toBe('actual_f1');
  });
});
describe('跨天与单次覆盖', () => {
  it('跨天事件拆成每日一段', () => {
    const overnight: ScheduleEvent = {
      id: 'e2',
      title: '通宵自习',
      start: new Date(2026, 8, 7, 22).toISOString(),
      end: new Date(2026, 8, 8, 2).toISOString(),
      allDay: false,
      category: 'study',
      source: 'manual',
    };

    const items = buildCalendarItems({
      timetable: null,
      events: [overnight],
      tasks: [],
      range: weekRange(termStart, 1),
    });

    expect(items).toHaveLength(2);
    expect(items[0].start).toBe(overnight.start);
    expect(new Date(items[0].end).getHours()).toBe(0);
    expect(new Date(items[1].start).getHours()).toBe(0);
    expect(items[1].title).toContain('（续）');
  });

  it('循环日程的 overrides 覆盖单次时间', () => {
    const recurring: ScheduleEvent = {
      id: 'e3',
      title: '每周复盘',
      start: new Date(2026, 8, 7, 20).toISOString(),
      end: new Date(2026, 8, 7, 21).toISOString(),
      allDay: false,
      category: 'study',
      source: 'manual',
      repeat: { frequency: 'weekly', interval: 1, byWeekday: [1] },
      overrides: {
        '2026-09-07': {
          start: new Date(2026, 8, 7, 21).toISOString(),
          end: new Date(2026, 8, 7, 22).toISOString(),
        },
      },
    };

    const items = buildCalendarItems({
      timetable: null,
      events: [recurring],
      tasks: [],
      range: weekRange(termStart, 1),
    });

    expect(items).toHaveLength(1);
    expect(new Date(items[0].start).getHours()).toBe(21);
    expect(new Date(items[0].end).getHours()).toBe(22);
  });
});