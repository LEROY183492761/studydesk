import { describe, expect, it } from 'vitest';
import type { Assignment } from '@/domain/models';
import {
  assignmentStatusLabel,
  countAssignments,
  filterAssignments,
  formatFileSize,
  isOverdue,
  remainingLabel,
  sortAssignments,
} from '@/domain/rules/assignments';

function make(partial: Partial<Assignment> = {}): Assignment {
  return {
    id: 'a1',
    courseId: 'c1',
    courseName: '线性代数',
    title: '第三次作业',
    status: 'pending',
    dueConfirmed: false,
    ...partial,
  };
}

describe('作业看板规则', () => {
  it('按状态与关联统计', () => {
    const counts = countAssignments([
      make({ id: 'a', status: 'pending', statusCode: 99 }),
      make({ id: 'b', status: 'submitted', linkedTaskId: 't1' }),
      make({ id: 'c', status: 'graded', linkedDeadlineId: 'e1' }),
      make({ id: 'd', status: 'unknown' }),
    ]);
    expect(counts).toEqual({
      total: 4,
      unsubmitted: 2,
      submitted: 1,
      graded: 1,
      converted: 2,
    });
  });

  it('筛选未提交包含状态未知的作业', () => {
    const items = [
      make({ id: 'a', status: 'pending' }),
      make({ id: 'b', status: 'unknown' }),
      make({ id: 'c', status: 'submitted' }),
    ];
    expect(filterAssignments(items, 'unsubmitted').map((item) => item.id)).toEqual(['a', 'b']);
    expect(filterAssignments(items, 'submitted').map((item) => item.id)).toEqual(['c']);
    expect(filterAssignments(items, 'converted')).toEqual([]);
  });

  it('按截止时间升序且未确认的排最后', () => {
    const sorted = sortAssignments([
      make({ id: 'none' }),
      make({ id: 'late', dueAt: '2026-12-09T23:59:00+08:00' }),
      make({ id: 'early', dueAt: '2026-12-01T23:59:00+08:00' }),
    ]);
    expect(sorted.map((item) => item.id)).toEqual(['early', 'late', 'none']);
  });

  it('截止描述区分今天、明天、剩余与逾期', () => {
    const now = new Date('2026-11-11T10:00:00+08:00');
    expect(remainingLabel(undefined, now)).toBe('未确认截止');
    expect(remainingLabel('2026-11-11T23:59:00+08:00', now)).toBe('今天截止');
    expect(remainingLabel('2026-11-12T23:59:00+08:00', now)).toBe('明天截止');
    expect(remainingLabel('2026-11-15T23:59:00+08:00', now)).toBe('剩余 4 天');
    expect(remainingLabel('2026-11-09T23:59:00+08:00', now)).toBe('已逾期 2 天');
  });

  it('截止时间早于现在视为逾期', () => {
    const now = new Date('2026-11-11T10:00:00+08:00');
    expect(isOverdue(make({ dueAt: '2026-11-10T23:59:00+08:00' }), now)).toBe(true);
    expect(isOverdue(make({ dueAt: '2026-11-12T23:59:00+08:00' }), now)).toBe(false);
    expect(isOverdue(make(), now)).toBe(false);
  });

  it('状态文案优先使用接口返回文本', () => {
    expect(assignmentStatusLabel(make({ status: 'pending', statusText: '未提交' }))).toBe('未提交');
    expect(assignmentStatusLabel(make({ status: 'graded' }))).toBe('已批改');
    expect(assignmentStatusLabel(make({ status: 'unknown' }))).toBe('未知状态');
  });

  it('格式化附件大小', () => {
    expect(formatFileSize(undefined)).toBe('');
    expect(formatFileSize(512)).toBe('512 B');
    expect(formatFileSize(2048)).toBe('2.0 KB');
    expect(formatFileSize(3 * 1024 * 1024)).toBe('3.0 MB');
  });
});