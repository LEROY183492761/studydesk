import type { ScheduleEvent, Task } from '../models';

export interface DeadlineInput {
  title: string;
  dueAt: Date;
  location?: string;
  category?: string;
  note?: string;
  priority?: Task['priority'];
}

export interface DeadlineIds {
  eventId: string;
  taskId: string;
}

export interface DeadlinePair {
  event: ScheduleEvent;
  task: Task;
}

/** DDL 同时生成日程项与待办，并建立双向关联 */
export function buildDeadlinePair(
  input: DeadlineInput,
  ids: DeadlineIds,
  now: Date = new Date(),
): DeadlinePair {
  const title = input.title.trim();
  const due = input.dueAt.toISOString();
  const stamp = now.toISOString();

  return {
    event: {
      id: ids.eventId,
      title,
      start: due,
      end: due,
      allDay: false,
      category: input.category ?? 'deadline',
      location: input.location,
      note: input.note,
      source: 'manual',
      kind: 'deadline',
      linkedTaskId: ids.taskId,
    },
    task: {
      id: ids.taskId,
      title,
      note: input.note,
      status: 'inbox',
      priority: input.priority ?? 'high',
      dueAt: due,
      source: 'deadline',
      createdAt: stamp,
      updatedAt: stamp,
      linkedEventId: ids.eventId,
    },
  };
}

export function isDeadlineEvent(event: ScheduleEvent): boolean {
  return event.kind === 'deadline';
}