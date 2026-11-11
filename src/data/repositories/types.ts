import type {
  AppSettings,
  Category,
  CaptureRecord,
  Countdown,
  FocusSession,
  Goal,
  Habit,
  HabitLog,
  Note,
  Review,
  ScheduleEvent,
  Task,
  Timetable,
  LedgerBudget,
  LedgerCategory,
  LedgerEntry,
  ReviewCard,
  ReviewLog,
  ISODate,
} from '@/domain/models';

export interface CrudRepository<T> {
  list(): Promise<T[]>;
  save(item: T): Promise<void>;
  remove(id: string): Promise<void>;
  clear(): Promise<void>;
}

export type TaskRepository = CrudRepository<Task>;

export type NoteRepository = CrudRepository<Note>;

export type FocusRepository = CrudRepository<FocusSession>;

export type ScheduleEventRepository = CrudRepository<ScheduleEvent>;

export type HabitRepository = CrudRepository<Habit>;

export type HabitLogRepository = CrudRepository<HabitLog>;

export type ReviewRepository = CrudRepository<Review>;

export type CategoryRepository = CrudRepository<Category>;

export type GoalRepository = CrudRepository<Goal>;

export type CountdownRepository = CrudRepository<Countdown>;

/** DDL 事件与待办的原子写入 */
export interface DeadlinePairRepository {
  savePair(event: ScheduleEvent, task: Task): Promise<void>;
}

export interface SettingsRepository {
  load(): Promise<AppSettings>;
  save(settings: AppSettings): Promise<void>;
}

export interface TimetableRepository {
  load(): Promise<Timetable | null>;
  save(timetable: Timetable): Promise<void>;
}

/** v1.1：间隔重复卡片仓库 */
export interface ReviewCardRepository extends CrudRepository<ReviewCard> {
  listDue(date: ISODate): Promise<ReviewCard[]>;
}

export interface ReviewLogRepository {
  listByCard(cardId: string): Promise<ReviewLog[]>;
  append(log: ReviewLog): Promise<void>;
}

/** v1.1：轻量记账仓库 */
export interface LedgerRepository {
  listEntries(): Promise<LedgerEntry[]>;
  saveEntry(entry: LedgerEntry): Promise<void>;
  removeEntry(id: string): Promise<void>;
  listCategories(): Promise<LedgerCategory[]>;
  saveCategory(category: LedgerCategory): Promise<void>;
  getBudget(month: string): Promise<LedgerBudget | null>;
  saveBudget(budget: LedgerBudget): Promise<void>;
}

/** v1.1：快捷录入记录仓库 */
export interface CaptureRepository {
  list(): Promise<CaptureRecord[]>;
  append(record: CaptureRecord): Promise<void>;
  markApplied(id: string, appliedTo: string): Promise<void>;
}

export interface RepositoryBundle {
  tasks: TaskRepository;
  notes: NoteRepository;
  focus: FocusRepository;
  events: ScheduleEventRepository;
  habits: HabitRepository;
  habitLogs: HabitLogRepository;
  reviews: ReviewRepository;
  categories: CategoryRepository;
  goals: GoalRepository;
  countdowns: CountdownRepository;
  deadlines: DeadlinePairRepository;
  settings: SettingsRepository;
  timetable: TimetableRepository;
  reviewCards: ReviewCardRepository;
  reviewLogs: ReviewLogRepository;
  ledger: LedgerRepository;
  captures: CaptureRepository;
}