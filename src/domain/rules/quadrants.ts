import { parseISO } from 'date-fns';
import type { Task } from '../models';

export type Quadrant = 'q1' | 'q2' | 'q3' | 'q4';

export const QUADRANT_META: Record<Quadrant, { title: string; hint: string }> = {
  q1: { title: '重要且紧急', hint: '马上处理' },
  q2: { title: '重要不紧急', hint: '优先投入' },
  q3: { title: '紧急不重要', hint: '尽量委托' },
  q4: { title: '不重要不紧急', hint: '减少投入' },
};

const URGENT_WINDOW_MS = 48 * 60 * 60 * 1000;

export function isUrgent(dueAt: string | undefined, now: Date = new Date()): boolean {
  if (!dueAt) return false;
  return parseISO(dueAt).getTime() - now.getTime() <= URGENT_WINDOW_MS;
}

export function importanceOf(task: Task): 'high' | 'low' {
  if (task.importance) return task.importance;
  return task.priority === 'urgent' || task.priority === 'high' ? 'high' : 'low';
}

export function quadrantOf(task: Task, now: Date = new Date()): Quadrant {
  const important = importanceOf(task) === 'high';
  const urgent = isUrgent(task.dueAt, now);

  if (important && urgent) return 'q1';
  if (important) return 'q2';
  if (urgent) return 'q3';
  return 'q4';
}

export function groupByQuadrant(tasks: Task[], now: Date = new Date()): Record<Quadrant, Task[]> {
  const groups: Record<Quadrant, Task[]> = { q1: [], q2: [], q3: [], q4: [] };

  for (const task of tasks) {
    if (task.status === 'done' || task.status === 'archived') continue;
    groups[quadrantOf(task, now)].push(task);
  }

  for (const key of Object.keys(groups) as Quadrant[]) {
    groups[key].sort((a, b) => {
      if (a.dueAt && b.dueAt) return a.dueAt.localeCompare(b.dueAt);
      if (a.dueAt) return -1;
      if (b.dueAt) return 1;
      return a.createdAt.localeCompare(b.createdAt);
    });
  }

  return groups;
}

export function quadrantImportance(quadrant: Quadrant): 'high' | 'low' {
  return quadrant === 'q1' || quadrant === 'q2' ? 'high' : 'low';
}