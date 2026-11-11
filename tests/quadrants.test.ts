import { describe, expect, it } from 'vitest';
import {
  groupByQuadrant,
  importanceOf,
  isUrgent,
  quadrantImportance,
  quadrantOf,
} from '@/domain/rules/quadrants';
import type { Task } from '@/domain/models';

const now = new Date(2026, 8, 7, 12);
const hoursFromNow = (hours: number) => new Date(now.getTime() + hours * 3600_000).toISOString();

function task(overrides: Partial<Task> = {}): Task {
  return {
    id: 't1',
    title: '任务',
    status: 'inbox',
    priority: 'normal',
    source: 'manual',
    createdAt: now.toISOString(),
    updatedAt: now.toISOString(),
    ...overrides,
  };
}

describe('四象限', () => {
  it('48 小时内或逾期视为紧急', () => {
    expect(isUrgent(undefined, now)).toBe(false);
    expect(isUrgent(hoursFromNow(24), now)).toBe(true);
    expect(isUrgent(hoursFromNow(72), now)).toBe(false);
    expect(isUrgent(new Date(now.getTime() - 3600_000).toISOString(), now)).toBe(true);
  });

  it('重要性优先取显式设置，否则由优先级推导', () => {
    expect(importanceOf(task({ importance: 'high', priority: 'low' }))).toBe('high');
    expect(importanceOf(task({ priority: 'urgent' }))).toBe('high');
    expect(importanceOf(task({ priority: 'high' }))).toBe('high');
    expect(importanceOf(task({ priority: 'normal' }))).toBe('low');
  });

  it('重要与紧急组合映射到四个象限', () => {
    expect(quadrantOf(task({ importance: 'high', dueAt: hoursFromNow(12) }), now)).toBe('q1');
    expect(quadrantOf(task({ importance: 'high', dueAt: hoursFromNow(72) }), now)).toBe('q2');
    expect(quadrantOf(task({ importance: 'low', dueAt: hoursFromNow(12) }), now)).toBe('q3');
    expect(quadrantOf(task({ importance: 'low' }), now)).toBe('q4');
  });

  it('分组排除已完成与归档任务', () => {
    const groups = groupByQuadrant(
      [
        task({ id: 'a', importance: 'high', dueAt: hoursFromNow(12) }),
        task({ id: 'b', status: 'done' }),
        task({ id: 'c', status: 'archived' }),
      ],
      now,
    );
    expect(groups.q1).toHaveLength(1);
    expect(groups.q2).toHaveLength(0);
    expect(groups.q4).toHaveLength(0);
  });

  it('象限对应的重要性', () => {
    expect(quadrantImportance('q1')).toBe('high');
    expect(quadrantImportance('q2')).toBe('high');
    expect(quadrantImportance('q3')).toBe('low');
    expect(quadrantImportance('q4')).toBe('low');
  });
});