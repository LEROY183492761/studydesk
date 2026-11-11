import { differenceInCalendarDays, parseISO } from 'date-fns';
import type { Assignment } from '../models';

export type AssignmentFilter =
  | 'all'
  | 'unsubmitted'
  | 'submitted'
  | 'graded'
  | 'converted';

export const ASSIGNMENT_FILTERS: Array<{ id: AssignmentFilter; label: string }> = [
  { id: 'all', label: '全部' },
  { id: 'unsubmitted', label: '未提交' },
  { id: 'submitted', label: '已提交' },
  { id: 'graded', label: '已批改' },
  { id: 'converted', label: '已转待办' },
];

export interface AssignmentCounts {
  total: number;
  unsubmitted: number;
  submitted: number;
  graded: number;
  converted: number;
}

export function isUnsubmitted(item: Assignment): boolean {
  return item.status === 'pending' || item.status === 'unknown';
}

export function assignmentStatusLabel(item: Assignment): string {
  if (item.statusText) return item.statusText;
  switch (item.status) {
    case 'submitted':
      return '已提交';
    case 'graded':
      return '已批改';
    case 'pending':
      return '未提交';
    default:
      return '未知状态';
  }
}

export function countAssignments(items: Assignment[]): AssignmentCounts {
  return items.reduce<AssignmentCounts>(
    (accumulator, item) => {
      accumulator.total += 1;
      if (isUnsubmitted(item)) accumulator.unsubmitted += 1;
      if (item.status === 'submitted') accumulator.submitted += 1;
      if (item.status === 'graded') accumulator.graded += 1;
      if (item.linkedTaskId || item.linkedDeadlineId) accumulator.converted += 1;
      return accumulator;
    },
    { total: 0, unsubmitted: 0, submitted: 0, graded: 0, converted: 0 },
  );
}

export function filterAssignments(
  items: Assignment[],
  filter: AssignmentFilter,
): Assignment[] {
  switch (filter) {
    case 'unsubmitted':
      return items.filter(isUnsubmitted);
    case 'submitted':
      return items.filter((item) => item.status === 'submitted');
    case 'graded':
      return items.filter((item) => item.status === 'graded');
    case 'converted':
      return items.filter((item) => Boolean(item.linkedTaskId || item.linkedDeadlineId));
    default:
      return items;
  }
}

/** 按截止时间升序，未确认截止的排在最后 */
export function sortAssignments(items: Assignment[]): Assignment[] {
  return [...items].sort((left, right) => {
    if (!left.dueAt && !right.dueAt) return left.title.localeCompare(right.title);
    if (!left.dueAt) return 1;
    if (!right.dueAt) return -1;
    return left.dueAt.localeCompare(right.dueAt);
  });
}

export function isOverdue(item: Assignment, now: Date = new Date()): boolean {
  if (!item.dueAt) return false;
  return parseISO(item.dueAt).getTime() < now.getTime();
}

/** 截止时间剩余描述：今天截止 / 剩余 N 天 / 已逾期 N 天 */
export function remainingLabel(dueAt: string | undefined, now: Date = new Date()): string {
  if (!dueAt) return '未确认截止';
  const due = parseISO(dueAt);
  const days = differenceInCalendarDays(due, now);
  if (days > 1) return `剩余 ${days} 天`;
  if (days === 1) return '明天截止';
  if (days === 0) return '今天截止';
  return `已逾期 ${Math.abs(days)} 天`;
}

export function formatFileSize(size: number | undefined): string {
  if (!size || size <= 0) return '';
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}