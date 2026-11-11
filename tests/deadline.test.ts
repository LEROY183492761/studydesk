import { describe, expect, it } from 'vitest';
import { buildDeadlinePair, isDeadlineEvent } from '@/domain/rules/deadline';

const now = new Date(2026, 8, 7, 12);
const dueAt = new Date(2026, 8, 10, 23, 59);

describe('DDL 双向关联', () => {
  it('同时生成日程与待办并互相引用', () => {
    const { event, task } = buildDeadlinePair(
      { title: '提交实验报告', dueAt, location: '教三-101', note: '含实验数据' },
      { eventId: 'e1', taskId: 't1' },
      now,
    );

    expect(event.kind).toBe('deadline');
    expect(event.linkedTaskId).toBe('t1');
    expect(event.start).toBe(dueAt.toISOString());
    expect(task.source).toBe('deadline');
    expect(task.linkedEventId).toBe('e1');
    expect(task.dueAt).toBe(dueAt.toISOString());
    expect(task.priority).toBe('high');
  });

  it('标题去除首尾空白', () => {
    const { event, task } = buildDeadlinePair(
      { title: '  高数作业  ', dueAt },
      { eventId: 'e1', taskId: 't1' },
      now,
    );
    expect(event.title).toBe('高数作业');
    expect(task.title).toBe('高数作业');
  });

  it('识别 DDL 类型', () => {
    expect(
      isDeadlineEvent({
        id: 'e1',
        title: '作业',
        start: dueAt.toISOString(),
        end: dueAt.toISOString(),
        allDay: false,
        category: 'deadline',
        source: 'manual',
        kind: 'deadline',
      }),
    ).toBe(true);
  });
});