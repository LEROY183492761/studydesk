import { describe, expect, it } from 'vitest';
import { addDays } from 'date-fns';
import { expandRecurrence } from '@/domain/rules/recurrence';
import { isSessionActiveInWeek, teachingWeekOf } from '@/domain/rules/weeks';
import { computeDailyMetrics } from '@/domain/selectors/reviewMetrics';
import { buildTodayOverview } from '@/domain/selectors/today';
import { ruleBasedParser } from '@/features/lab/quick-capture/parser';
import type { CalendarItem, FocusSession, Habit, HabitLog, Task } from '@/domain/models';

const termStart = new Date(2026, 8, 7);

describe('教学周换算', () => {
  it('开学当天为第 1 周，跨 7 天为第 2 周，开学前为 0', () => {
    expect(teachingWeekOf(termStart, '2026-09-07')).toBe(1);
    expect(teachingWeekOf(addDays(termStart, 7), '2026-09-07')).toBe(2);
    expect(teachingWeekOf(addDays(termStart, -1), '2026-09-07')).toBe(0);
  });

  it('单双周与周次列表同时生效', () => {
    const session = {
      id: 's1',
      courseId: 'c1',
      weekday: 1 as const,
      startPeriod: 1,
      endPeriod: 2,
      weeks: [1, 2, 3],
      parity: 'odd' as const,
    };
    expect(isSessionActiveInWeek(session, 1)).toBe(true);
    expect(isSessionActiveInWeek(session, 2)).toBe(false);
    expect(isSessionActiveInWeek(session, 5)).toBe(false);
  });
});

describe('重复规则', () => {
  it('按间隔展开日期且包含范围边界', () => {
    const dates = expandRecurrence(
      { frequency: 'daily', interval: 2 },
      termStart,
      termStart,
      addDays(termStart, 6),
    );
    expect(dates.map((date) => date.getDate())).toEqual([7, 9, 11, 13]);
  });
});

describe('今日聚合', () => {
  it('统计待办、专注与下一节课', () => {
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
    const tasks: Task[] = [
      {
        id: 't1',
        title: '作业',
        status: 'inbox',
        priority: 'high',
        source: 'manual',
        createdAt: new Date(2026, 8, 7, 7).toISOString(),
        updatedAt: new Date(2026, 8, 7, 7).toISOString(),
      },
    ];

    const overview = buildTodayOverview({
      now: new Date(2026, 8, 7, 8, 30),
      date: '2026-09-07',
      termStartDate: '2026-09-07',
      items,
      tasks,
      habitLogs: [],
      focusSessions: [],
      habitTotal: 0,
    });

    expect(overview.teachingWeek).toBe(1);
    expect(overview.nextCourse?.title).toBe('高等数学');
    expect(overview.openTasks).toHaveLength(1);
  });
});

describe('日复盘指标', () => {
  it('完成率、课程时长与习惯达成率可对账', () => {
    const date = '2026-09-07';
    const tasks: Task[] = [
      {
        id: 't1',
        title: '完成',
        status: 'done',
        priority: 'normal',
        source: 'manual',
        createdAt: new Date(2026, 8, 7, 8).toISOString(),
        updatedAt: new Date(2026, 8, 7, 9).toISOString(),
        completedAt: new Date(2026, 8, 7, 9).toISOString(),
      },
      {
        id: 't2',
        title: '未完成',
        status: 'inbox',
        priority: 'normal',
        source: 'manual',
        createdAt: new Date(2026, 8, 7, 8).toISOString(),
        updatedAt: new Date(2026, 8, 7, 8).toISOString(),
      },
    ];
    const items: CalendarItem[] = [
      {
        id: 'c1',
        source: 'course',
        title: '课程',
        start: new Date(2026, 8, 7, 8).toISOString(),
        end: new Date(2026, 8, 7, 9, 40).toISOString(),
        allDay: false,
        readonly: true,
      },
    ];
    const focusSessions: FocusSession[] = [
      {
        id: 'f1',
        startedAt: new Date(2026, 8, 7, 10).toISOString(),
        plannedSeconds: 1500,
        actualSeconds: 1500,
        mode: 'focus',
        completed: true,
      },
    ];
    const habits: Habit[] = [
      {
        id: 'h1',
        name: '早起',
        color: '#fff',
        frequency: { type: 'daily' },
        archived: false,
        createdAt: new Date(2026, 8, 7).toISOString(),
      },
    ];
    const habitLogs: HabitLog[] = [{ id: 'hl1', habitId: 'h1', date, value: 1 }];

    const metrics = computeDailyMetrics({
      date,
      tasks,
      items,
      focusSessions,
      habits,
      habitLogs,
    });

    expect(metrics.tasksCreated).toBe(2);
    expect(metrics.tasksCompleted).toBe(1);
    expect(metrics.completionRate).toBe(0.5);
    expect(metrics.courseMinutes).toBe(100);
    expect(metrics.focusMinutes).toBe(25);
    expect(metrics.habitCompletionRate).toBe(1);
  });
});

describe('快捷录入规则解析', () => {
  it('识别记账金额并转换为分', () => {
    const draft = ruleBasedParser.parse('午饭花了 12.5 元', { now: termStart });
    expect(draft?.kind).toBe('ledger');
    expect(draft?.amountCents).toBe(1250);
  });

  it('识别明天的截止时间', () => {
    const draft = ruleBasedParser.parse('明天交高数作业', { now: termStart });
    expect(draft?.kind).toBe('task');
    expect(draft?.dueAt).toBeTruthy();
  });
});