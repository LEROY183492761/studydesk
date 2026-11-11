export interface DomainEventMap {
  'task.created': { taskId: string; source: string };
  'task.completed': { taskId: string; completedAt: string };
  'task.removed': { taskId: string };
  'task.scheduled': { taskId: string; start: string; end: string };
  'task.unscheduled': { taskId: string };
  'event.created': { eventId: string };
  'event.removed': { eventId: string };
  'focus.completed': { sessionId: string; taskId?: string; minutes: number };
  'note.captured': { noteId: string };
  'note.converted': { noteId: string; taskId: string };
  'capture.applied': { recordId: string; kind: string; appliedTo: string };
  'ledger.entry.saved': { entryId: string; amountCents: number };
  'review.card.graded': { cardId: string; rating: string };
  'habit.checked': { habitId: string; date: string };
  'review.saved': { reviewId: string };
  'settings.changed': { key: string };
}

type EventName = keyof DomainEventMap;
type Handler<K extends EventName> = (payload: DomainEventMap[K]) => void;

const handlers = new Map<EventName, Set<(payload: never) => void>>();

export function on<K extends EventName>(name: K, handler: Handler<K>): () => void {
  const set = handlers.get(name) ?? new Set();
  set.add(handler as (payload: never) => void);
  handlers.set(name, set);
  return () => {
    set.delete(handler as (payload: never) => void);
  };
}

export function emit<K extends EventName>(name: K, payload: DomainEventMap[K]): void {
  const set = handlers.get(name);
  if (!set) return;
  for (const handler of set) {
    (handler as Handler<K>)(payload);
  }
}

export function clearAllHandlers(): void {
  handlers.clear();
}