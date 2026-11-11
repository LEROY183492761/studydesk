import { describe, expect, it } from 'vitest';
import { addDays, format } from 'date-fns';
import { expandRecurrence } from '@/domain/rules/recurrence';

const start = new Date(2026, 8, 7); // 周一
const labels = (dates: Date[]) => dates.map((date) => format(date, 'yyyy-MM-dd'));

describe('循环规则展开', () => {
  it('每日按间隔展开，包含范围边界', () => {
    const dates = expandRecurrence(
      { frequency: 'daily', interval: 2 },
      start,
      start,
      addDays(start, 6),
    );
    expect(labels(dates)).toEqual(['2026-09-07', '2026-09-09', '2026-09-11', '2026-09-13']);
  });

  it('每周按星期多选展开', () => {
    const dates = expandRecurrence(
      { frequency: 'weekly', interval: 1, byWeekday: [2, 4] },
      start,
      start,
      addDays(start, 13),
    );
    expect(labels(dates)).toEqual([
      '2026-09-08',
      '2026-09-10',
      '2026-09-15',
      '2026-09-17',
    ]);
  });

  it('每周间隔 2 周只取隔周', () => {
    const dates = expandRecurrence(
      { frequency: 'weekly', interval: 2, byWeekday: [2] },
      start,
      start,
      addDays(start, 20),
    );
    expect(labels(dates)).toEqual(['2026-09-08', '2026-09-22']);
  });

  it('每月按 N 日展开', () => {
    const dates = expandRecurrence(
      { frequency: 'monthly', interval: 1, byMonthDay: 10 },
      start,
      start,
      new Date(2026, 11, 31),
    );
    expect(labels(dates)).toEqual(['2026-09-10', '2026-10-10', '2026-11-10', '2026-12-10']);
  });

  it('每月第 2 个周二', () => {
    const dates = expandRecurrence(
      { frequency: 'monthly', interval: 1, byWeekday: [2], bySetPos: 2 },
      start,
      start,
      new Date(2026, 10, 30),
    );
    expect(labels(dates)).toEqual(['2026-09-08', '2026-10-13', '2026-11-10']);
  });

  it('count 从起始日起限制总次数', () => {
    const dates = expandRecurrence(
      { frequency: 'weekly', interval: 1, byWeekday: [2], count: 2 },
      start,
      start,
      addDays(start, 30),
    );
    expect(labels(dates)).toEqual(['2026-09-08', '2026-09-15']);
  });

  it('until 截断后续 occurrence', () => {
    const dates = expandRecurrence(
      { frequency: 'weekly', interval: 1, byWeekday: [2], until: '2026-09-16' },
      start,
      start,
      addDays(start, 30),
    );
    expect(labels(dates)).toEqual(['2026-09-08', '2026-09-15']);
  });
});