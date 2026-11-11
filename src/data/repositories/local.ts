import { DEFAULT_SETTINGS } from '@/domain/models';
import type {
  AppSettings,
  Category,
  CaptureRecord,
  Countdown,
  FocusSession,
  Goal,
  Habit,
  HabitLog,
  LedgerBudget,
  LedgerCategory,
  LedgerEntry,
  Note,
  Review,
  ReviewCard,
  ReviewLog,
  ScheduleEvent,
  Task,
  Timetable,
} from '@/domain/models';
import type { EntityStore, KeyValuePort, PlatformPort } from '@/platform/types';
import {
  SEED_CAPTURES,
  SEED_EVENTS,
  SEED_FOCUS_SESSIONS,
  SEED_HABITS,
  SEED_HABIT_LOGS,
  SEED_LEDGER_CATEGORIES,
  SEED_LEDGER_ENTRIES,
  SEED_NOTES,
  SEED_REVIEW_CARDS,
  SEED_TASKS,
  SEED_TIMETABLE,
} from '../seed';
import type { CrudRepository, RepositoryBundle } from './types';

export const STORAGE_PREFIX = 'studydesk.v1.';

export const STORAGE_KEYS = {
  tasks: `${STORAGE_PREFIX}tasks`,
  notes: `${STORAGE_PREFIX}notes`,
  focus: `${STORAGE_PREFIX}focus`,
  events: `${STORAGE_PREFIX}events`,
  settings: `${STORAGE_PREFIX}settings`,
  timetable: `${STORAGE_PREFIX}timetable`,
  reviewCards: `${STORAGE_PREFIX}review-cards`,
  reviewLogs: `${STORAGE_PREFIX}review-logs`,
  ledgerEntries: `${STORAGE_PREFIX}ledger-entries`,
  ledgerCategories: `${STORAGE_PREFIX}ledger-categories`,
  ledgerBudgets: `${STORAGE_PREFIX}ledger-budgets`,
  captures: `${STORAGE_PREFIX}captures`,
} as const;

export const SEEDED_FLAG_KEY = `${STORAGE_PREFIX}seeded`;

export const SEEDED_HABITS_FLAG_KEY = `${STORAGE_PREFIX}seeded.habits`;

export const SEEDED_CATEGORIES_FLAG_KEY = `${STORAGE_PREFIX}seeded.categories`;

function createEntityRepository<T>(store: EntityStore): CrudRepository<T> {
  return {
    async list() {
      return (await store.list()) as T[];
    },
    async save(item) {
      await store.save(item);
    },
    async remove(id) {
      await store.remove(id);
    },
    async clear() {
      await store.clear();
    },
  };
}

function createCollection<T extends { id: string }>(
  storage: KeyValuePort,
  key: string,
  seed: T[],
): CrudRepository<T> {
  return {
    async list() {
      return storage.get<T[]>(key, seed);
    },
    async save(item) {
      const items = await storage.get<T[]>(key, seed);
      const index = items.findIndex((current) => current.id === item.id);
      const next =
        index >= 0
          ? items.map((current) => (current.id === item.id ? item : current))
          : [...items, item];
      await storage.set(key, next);
    },
    async remove(id) {
      const items = await storage.get<T[]>(key, seed);
      await storage.set(
        key,
        items.filter((current) => current.id !== id),
      );
    },
    async clear() {
      await storage.set(key, []);
    },
  };
}

export function createRepositoryBundle(platform: PlatformPort): RepositoryBundle {
  const storage = platform.storage;
  const reviewCards = createCollection<ReviewCard>(
    storage,
    STORAGE_KEYS.reviewCards,
    SEED_REVIEW_CARDS,
  );
  const reviewLogs: ReviewLog[] = [];
  const ledgerCategories = createCollection<LedgerCategory>(
    storage,
    STORAGE_KEYS.ledgerCategories,
    SEED_LEDGER_CATEGORIES,
  );
  const ledgerEntries = createCollection<LedgerEntry>(
    storage,
    STORAGE_KEYS.ledgerEntries,
    SEED_LEDGER_ENTRIES,
  );
  const captures = createCollection<CaptureRecord>(
    storage,
    STORAGE_KEYS.captures,
    SEED_CAPTURES,
  );

  return {
    tasks: createEntityRepository<Task>(platform.database.tasks),
    notes: createEntityRepository<Note>(platform.database.notes),
    focus: createEntityRepository<FocusSession>(platform.database.focusSessions),
    events: createEntityRepository<ScheduleEvent>(platform.database.events),
    habits: createEntityRepository<Habit>(platform.database.habits),
    habitLogs: createEntityRepository<HabitLog>(platform.database.habitLogs),
    reviews: createEntityRepository<Review>(platform.database.reviews),
    categories: createEntityRepository<Category>(platform.database.categories),
    goals: createEntityRepository<Goal>(platform.database.goals),
    countdowns: createEntityRepository<Countdown>(platform.database.countdowns),
    deadlines: {
      async savePair(event, task) {
        if (platform.database.saveDeadlinePair) {
          await platform.database.saveDeadlinePair(event, task);
          return;
        }
        await platform.database.tasks.save(task);
        await platform.database.events.save(event);
      },
    },
    settings: {
      async load() {
        const stored = await storage.get<Partial<AppSettings>>(STORAGE_KEYS.settings, {});
        return {
          ...DEFAULT_SETTINGS,
          ...stored,
          flags: { ...DEFAULT_SETTINGS.flags, ...(stored.flags ?? {}) },
        };
      },
      async save(settings) {
        await storage.set(STORAGE_KEYS.settings, settings);
      },
    },
    timetable: {
      async load() {
        return storage.get<typeof SEED_TIMETABLE | null>(STORAGE_KEYS.timetable, SEED_TIMETABLE);
      },
      async save(timetable) {
        await storage.set(STORAGE_KEYS.timetable, timetable);
      },
    },
    reviewCards: {
      ...reviewCards,
      async listDue(date) {
        const items = await reviewCards.list();
        return items.filter((card) => card.dueAt <= date);
      },
    },
    reviewLogs: {
      async listByCard(cardId) {
        return reviewLogs.filter((log) => log.cardId === cardId);
      },
      async append(log) {
        reviewLogs.push(log);
      },
    },
    ledger: {
      async listEntries() {
        return ledgerEntries.list();
      },
      async saveEntry(entry) {
        await ledgerEntries.save(entry);
      },
      async removeEntry(id) {
        await ledgerEntries.remove(id);
      },
      async listCategories() {
        return ledgerCategories.list();
      },
      async saveCategory(category) {
        await ledgerCategories.save(category);
      },
      async getBudget(month) {
        const budgets = await storage.get<LedgerBudget[]>(STORAGE_KEYS.ledgerBudgets, []);
        return budgets.find((budget) => budget.month === month) ?? null;
      },
      async saveBudget(budget) {
        const budgets = await storage.get<LedgerBudget[]>(STORAGE_KEYS.ledgerBudgets, []);
        const next = budgets.some((item) => item.month === budget.month)
          ? budgets.map((item) => (item.month === budget.month ? budget : item))
          : [...budgets, budget];
        await storage.set(STORAGE_KEYS.ledgerBudgets, next);
      },
    },
    captures: {
      ...captures,
      async append(record) {
        await captures.save(record);
      },
      async markApplied(id, appliedTo) {
        const items = await captures.list();
        const found = items.find((item) => item.id === id);
        if (found) {
          await captures.save({ ...found, appliedTo });
        }
      },
    },
  };
}

export async function seedRepositories(repositories: RepositoryBundle): Promise<void> {
  await Promise.all([
    ...SEED_TASKS.map((task) => repositories.tasks.save(task)),
    ...SEED_EVENTS.map((event) => repositories.events.save(event)),
    ...SEED_FOCUS_SESSIONS.map((session) => repositories.focus.save(session)),
    ...SEED_NOTES.map((note) => repositories.notes.save(note)),
    ...SEED_HABITS.map((habit) => repositories.habits.save(habit)),
    ...SEED_HABIT_LOGS.map((log) => repositories.habitLogs.save(log)),
  ]);
}

export async function seedHabitRepositories(repositories: RepositoryBundle): Promise<void> {
  await Promise.all([
    ...SEED_HABITS.map((habit) => repositories.habits.save(habit)),
    ...SEED_HABIT_LOGS.map((log) => repositories.habitLogs.save(log)),
  ]);
}

const CATEGORY_COLORS = [
  'var(--color-course-1)',
  'var(--color-course-2)',
  'var(--color-course-3)',
  'var(--color-course-4)',
  'var(--color-course-5)',
  'var(--color-course-6)',
];

export async function seedCategories(
  repositories: RepositoryBundle,
  timetable: Timetable | null,
): Promise<void> {
  const stamp = new Date().toISOString();
  const defaults: Category[] = [
    {
      id: 'cat_study',
      name: '学习',
      color: 'var(--color-course-1)',
      kind: 'study',
      archived: false,
      createdAt: stamp,
    },
    {
      id: 'cat_life',
      name: '生活',
      color: 'var(--color-course-2)',
      kind: 'life',
      archived: false,
      createdAt: stamp,
    },
    {
      id: 'cat_other',
      name: '其他',
      color: 'var(--color-course-3)',
      kind: 'other',
      archived: false,
      createdAt: stamp,
    },
  ];

  const courseCategories: Category[] = (timetable?.courses ?? []).map((course, index) => ({
    id: `cat_course_${course.id}`,
    name: course.name,
    color: course.color ?? CATEGORY_COLORS[index % CATEGORY_COLORS.length],
    kind: 'course',
    archived: false,
    createdAt: stamp,
  }));

  await Promise.all(
    [...defaults, ...courseCategories].map((category) =>
      repositories.categories.save(category),
    ),
  );
}

export async function clearRepositoryStorage(storage: KeyValuePort): Promise<void> {
  await Promise.all(Object.values(STORAGE_KEYS).map((key) => storage.remove(key)));
}