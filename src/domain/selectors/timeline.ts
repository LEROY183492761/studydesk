import { addSeconds, isSameDay, parseISO } from 'date-fns';
import type { CalendarItem, CalendarSource, FocusSession } from '../models';

export type TimelineLayer = 'planned' | 'actual';
export type TimelineKind = CalendarSource | 'focus';

export interface TimelineItem {
  id: string;
  title: string;
  start: string;
  end: string;
  layer: TimelineLayer;
  kind: TimelineKind;
  color?: string;
  note?: string;
}

export interface TimelineInput {
  date: Date;
  items: CalendarItem[];
  focusSessions: FocusSession[];
}

export function buildTimeline(input: TimelineInput): TimelineItem[] {
  const { date, items, focusSessions } = input;

  const planned: TimelineItem[] = items
    .filter((item) => isSameDay(parseISO(item.start), date))
    .map((item) => ({
      id: `planned_${item.id}`,
      title: item.title,
      start: item.start,
      end: item.end,
      layer: 'planned',
      kind: item.source,
      color: item.color,
      note: item.location,
    }));

  const actual: TimelineItem[] = focusSessions
    .filter((session) => isSameDay(parseISO(session.startedAt), date))
    .map((session) => {
      const start = parseISO(session.startedAt);
      return {
        id: `actual_${session.id}`,
        title: session.note ?? (session.mode === 'focus' ? '专注' : '休息'),
        start: session.startedAt,
        end: addSeconds(start, session.actualSeconds).toISOString(),
        layer: 'actual' as const,
        kind: 'focus' as const,
        color: session.mode === 'focus' ? 'var(--color-primary)' : 'var(--color-success)',
      };
    });

  return [...planned, ...actual].sort((a, b) => a.start.localeCompare(b.start));
}

export function plannedMinutes(items: TimelineItem[]): number {
  return items
    .filter((item) => item.layer === 'planned')
    .reduce(
      (sum, item) =>
        sum +
        Math.max(0, (parseISO(item.end).getTime() - parseISO(item.start).getTime()) / 60_000),
      0,
    );
}

export function actualMinutes(items: TimelineItem[]): number {
  return items
    .filter((item) => item.layer === 'actual')
    .reduce(
      (sum, item) =>
        sum +
        Math.max(0, (parseISO(item.end).getTime() - parseISO(item.start).getTime()) / 60_000),
      0,
    );
}