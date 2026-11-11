import { addMinutes, format, parseISO } from 'date-fns';
import { create } from 'zustand';
import {
  clearRepositoryStorage,
  createRepositoryBundle,
  seedCategories,
  seedHabitRepositories,
  seedRepositories,
  SEEDED_CATEGORIES_FLAG_KEY,
  SEEDED_FLAG_KEY,
  SEEDED_HABITS_FLAG_KEY,
} from '@/data';
import type { RepositoryBundle } from '@/data';
import { DEFAULT_SETTINGS } from '@/domain/models';
import type {
  AppSettings,
  Category,
  Countdown,
  EventRecurrence,
  FeatureFlags,
  FocusMode,
  FocusSession,
  Goal,
  Habit,
  HabitFrequency,
  HabitLog,
  Note,
  Review,
  ScheduleEvent,
  Task,
  TaskPriority,
  Timetable,
  TimerMode,
} from '@/domain/models';
import { buildDeadlinePair } from '@/domain/rules/deadline';
import { buildHabitCompletion } from '@/domain/rules/habitCompletion';
import { normalizePlan } from '@/domain/rules/pomodoro';
import { applySchedule, clearSchedule } from '@/domain/rules/schedule';
import { emit } from '@/lib/events';
import { createId } from '@/lib/ids';
import { getPlatform } from '@/platform';

export interface AddTaskInput {
  title: string;
  note?: string;
  priority?: TaskPriority;
  dueAt?: string;
  estimateMinutes?: number;
  source?: Task['source'];
  timerMode?: TimerMode;
  focusMinutes?: number;
  breakMinutes?: number;
  cyclesPlanned?: number;
  importance?: 'high' | 'low';
  categoryId?: string;
}

export interface AddEventInput {
  title: string;
  start: Date;
  minutes: number;
  location?: string;
  category?: string;
  note?: string;
  kind?: 'event' | 'deadline';
  linkedTaskId?: string;
  repeat?: EventRecurrence | null;
  courseLike?: boolean;
}

export interface AddDeadlineInput {
  title: string;
  dueAt: Date;
  location?: string;
  category?: string;
  note?: string;
}

export interface AddHabitInput {
  name: string;
  color: string;
  frequency: HabitFrequency;
  remindAt?: string;
  mode?: 'light' | 'task';
  timerMinutes?: number;
  logToTimeline?: boolean;
  categoryId?: string;
  unit?: string;
  dailyTarget?: number;
  unitMinutes?: number;
  goalId?: string;
}

export interface AddGoalInput {
  title: string;
  note?: string;
  targetDate?: string;
  categoryId?: string;
  habitId?: string;
  targetAmount?: number;
  taskIds?: string[];
  autoProgress?: boolean;
}

export interface AddCountdownInput {
  title: string;
  date: string;
  yearly?: boolean;
  note?: string;
  color?: string;
  /** 当天提醒时刻 HH:mm，默认 09:00 */
  remindAt?: string;
}

export interface LogFocusInput {
  plannedSeconds: number;
  actualSeconds: number;
  mode: FocusMode;
  taskId?: string;
  note?: string;
  startedAt?: string;
  cycleIndex?: number;
  abandoned?: boolean;
}

interface AppState {
  ready: boolean;
  error: string | null;
  tasks: Task[];
  notes: Note[];
  focusSessions: FocusSession[];
  events: ScheduleEvent[];
  habits: Habit[];
  habitLogs: HabitLog[];
  reviews: Review[];
  categories: Category[];
  goals: Goal[];
  countdowns: Countdown[];
  timetable: Timetable | null;
  settings: AppSettings;
  init: () => Promise<void>;
  addTask: (input: AddTaskInput) => Promise<Task | null>;
  updateTask: (
    id: string,
    patch: Partial<
      Pick<Task, 'title' | 'note' | 'priority' | 'dueAt' | 'estimateMinutes' | 'categoryId'>
    >,
  ) => Promise<void>;
  toggleTask: (id: string) => Promise<void>;
  removeTask: (id: string) => Promise<void>;
  updateTaskProgress: (id: string, cyclesCompleted: number) => Promise<void>;
  setTaskImportance: (id: string, importance: 'high' | 'low') => Promise<void>;
  setTaskCategory: (id: string, categoryId?: string) => Promise<void>;
  scheduleTask: (id: string, start: Date, minutes: number) => Promise<void>;
  unscheduleTask: (id: string) => Promise<void>;
  addNote: (content: string) => Promise<Note | null>;
  updateNote: (id: string, patch: { content?: string; tags?: string[] }) => Promise<void>;
  removeNote: (id: string) => Promise<void>;
  convertNoteToTask: (id: string) => Promise<void>;
  addEvent: (input: AddEventInput) => Promise<ScheduleEvent | null>;
  addDeadline: (input: AddDeadlineInput) => Promise<ScheduleEvent | null>;
  removeEvent: (id: string) => Promise<void>;
  updateEvent: (
    id: string,
    patch: {
      title?: string;
      start?: Date;
      end?: Date;
      location?: string;
      repeat?: EventRecurrence | null;
    },
  ) => Promise<void>;
  overrideEventOccurrence: (id: string, date: string, start: Date, end: Date) => Promise<void>;
  setCalendarDropConfig: (patch: { hour?: number; minutes?: number }) => Promise<void>;
  saveTimetable: (timetable: Timetable) => Promise<void>;
  skipEventOccurrence: (id: string, date: string) => Promise<void>;
  addHabit: (input: AddHabitInput) => Promise<void>;
  updateHabit: (
    id: string,
    patch: Partial<
      Pick<
        Habit,
        'name' | 'color' | 'frequency' | 'remindAt' | 'mode' | 'timerMinutes' | 'logToTimeline' | 'categoryId' | 'unit' | 'dailyTarget' | 'unitMinutes' | 'goalId'
      >
    >,
  ) => Promise<void>;
  removeHabit: (id: string) => Promise<void>;
  toggleHabit: (habitId: string, date: string) => Promise<void>;
  completeHabit: (habitId: string, date: string, elapsedSeconds: number) => Promise<void>;
  addHabitLog: (
    habitId: string,
    date: string,
    value: number,
    unit?: string,
    minutes?: number,
    elapsedSeconds?: number,
  ) => Promise<void>;
  removeHabitLog: (logId: string) => Promise<void>;
  addReview: (input: Omit<Review, 'id' | 'createdAt'>) => Promise<Review | null>;
  removeReview: (id: string) => Promise<void>;
  addCategory: (input: { name: string; color: string; kind?: string }) => Promise<void>;
  updateCategory: (id: string, patch: { name?: string; color?: string }) => Promise<boolean>;
  removeCategory: (id: string) => Promise<void>;
  addGoal: (input: AddGoalInput) => Promise<Goal | null>;
  updateGoal: (
    id: string,
    patch: Partial<
      Pick<Goal, 'title' | 'note' | 'targetDate' | 'progress' | 'status' | 'categoryId'>
    >,
  ) => Promise<void>;
  removeGoal: (id: string) => Promise<void>;
  addCountdown: (input: AddCountdownInput) => Promise<Countdown | null>;
  removeCountdown: (id: string) => Promise<void>;
  logFocus: (input: LogFocusInput) => Promise<void>;
  setTheme: (theme: AppSettings['theme']) => Promise<void>;
  setFlag: (key: keyof FeatureFlags, value: boolean) => Promise<void>;
  setNotifications: (value: boolean) => Promise<void>;
  setReminderConfig: (patch: { leadMinutes?: number; habitGraceMinutes?: number }) => Promise<void>;
  resetDemoData: () => Promise<void>;
}

let repositories: RepositoryBundle | null = null;

function requireRepositories(): RepositoryBundle {
  if (!repositories) throw new Error('数据层尚未初始化');
  return repositories;
}

function applyTheme(theme: AppSettings['theme']): void {
  if (typeof document !== 'undefined') {
    document.documentElement.dataset.theme = theme;
  }
}

async function loadAll(repos: RepositoryBundle) {
  const [
    tasks,
    notes,
    focusSessions,
    events,
    habits,
    habitLogs,
    reviews,
    categories,
    goals,
    countdowns,
    settings,
    timetable,
  ] = await Promise.all([
    repos.tasks.list(),
    repos.notes.list(),
    repos.focus.list(),
    repos.events.list(),
    repos.habits.list(),
    repos.habitLogs.list(),
    repos.reviews.list(),
    repos.categories.list(),
    repos.goals.list(),
    repos.countdowns.list(),
    repos.settings.load(),
    repos.timetable.load(),
  ]);
  return {
    tasks,
    notes,
    focusSessions,
    events,
    habits,
    habitLogs,
    reviews,
    categories,
    goals,
    countdowns,
    settings,
    timetable,
  };
}

export const useAppStore = create<AppState>()((set, get) => ({
  ready: false,
  error: null,
  tasks: [],
  notes: [],
  focusSessions: [],
  events: [],
  habits: [],
  habitLogs: [],
  reviews: [],
  categories: [],
  goals: [],
  countdowns: [],
  timetable: null,
  settings: DEFAULT_SETTINGS,

  async init() {
    if (get().ready) return;
    try {
      const platform = await getPlatform();
      repositories = createRepositoryBundle(platform);
      let snapshot = await loadAll(repositories);

      const seeded = await platform.storage.get<boolean>(SEEDED_FLAG_KEY, false);
      if (!seeded) {
        const empty =
          snapshot.tasks.length === 0 &&
          snapshot.events.length === 0 &&
          snapshot.focusSessions.length === 0 &&
          snapshot.notes.length === 0 &&
          snapshot.habits.length === 0;
        if (empty) {
          await seedRepositories(repositories);
          snapshot = await loadAll(repositories);
        }
        await platform.storage.set(SEEDED_FLAG_KEY, true);
      }

      const seededHabits = await platform.storage.get<boolean>(SEEDED_HABITS_FLAG_KEY, false);
      if (!seededHabits) {
        if (snapshot.habits.length === 0) {
          await seedHabitRepositories(repositories);
          snapshot = await loadAll(repositories);
        }
        await platform.storage.set(SEEDED_HABITS_FLAG_KEY, true);
      }

      const seededCategories = await platform.storage.get<boolean>(
        SEEDED_CATEGORIES_FLAG_KEY,
        false,
      );
      if (!seededCategories) {
        if (snapshot.categories.length === 0) {
          await seedCategories(repositories, snapshot.timetable);
          snapshot = await loadAll(repositories);
        }
        await platform.storage.set(SEEDED_CATEGORIES_FLAG_KEY, true);
      }

      applyTheme(snapshot.settings.theme);
      set({ ready: true, ...snapshot, error: null });
    } catch (error) {
      set({ ready: true, error: error instanceof Error ? error.message : '初始化失败' });
    }
  },

  async addTask(input) {
    const repos = requireRepositories();
    const now = new Date().toISOString();
    const plan = normalizePlan(
      {
        timerMode: input.timerMode,
        focusMinutes: input.focusMinutes,
        breakMinutes: input.breakMinutes,
        cyclesPlanned: input.cyclesPlanned,
      },
      {
        focusMinutes: get().settings.focusMinutes,
        breakMinutes: get().settings.breakMinutes,
      },
    );
    const task: Task = {
      id: createId('task'),
      title: input.title.trim(),
      note: input.note,
      status: 'inbox',
      priority: input.priority ?? 'normal',
      estimateMinutes: input.estimateMinutes,
      dueAt: input.dueAt,
      source: input.source ?? 'manual',
      createdAt: now,
      updatedAt: now,
      timerMode: plan.timerMode,
      focusMinutes: plan.focusMinutes,
      breakMinutes: plan.breakMinutes,
      cyclesPlanned: plan.cyclesPlanned,
      cyclesCompleted: 0,
      importance: input.importance,
      categoryId: input.categoryId,
    };
    if (!task.title) return null;
    await repos.tasks.save(task);
    set({ tasks: [...get().tasks, task] });
    emit('task.created', { taskId: task.id, source: task.source });
    return task;
  },

  async updateTask(id, patch) {
    const repos = requireRepositories();
    const current = get().tasks.find((task) => task.id === id);
    if (!current) return;

    const next: Task = {
      ...current,
      ...patch,
      updatedAt: new Date().toISOString(),
    };
    if (patch.title !== undefined) {
      next.title = patch.title.trim();
      if (!next.title) return;
    }

    await repos.tasks.save(next);
    set({ tasks: get().tasks.map((task) => (task.id === id ? next : task)) });
  },

  async toggleTask(id) {
    const repos = requireRepositories();
    const current = get().tasks.find((task) => task.id === id);
    if (!current) return;

    const done = current.status !== 'done';
    const now = new Date().toISOString();
    const next: Task = {
      ...current,
      status: done ? 'done' : current.scheduledStart ? 'planned' : 'inbox',
      completedAt: done ? now : undefined,
      updatedAt: now,
    };
    await repos.tasks.save(next);
    set({ tasks: get().tasks.map((task) => (task.id === id ? next : task)) });
    if (done) emit('task.completed', { taskId: id, completedAt: now });
  },

  async removeTask(id) {
    const repos = requireRepositories();
    await repos.tasks.remove(id);
    set({ tasks: get().tasks.filter((task) => task.id !== id) });
    emit('task.removed', { taskId: id });
  },

  async updateTaskProgress(id, cyclesCompleted) {
    const repos = requireRepositories();
    const current = get().tasks.find((task) => task.id === id);
    if (!current) return;

    const next: Task = {
      ...current,
      cyclesCompleted,
      updatedAt: new Date().toISOString(),
    };
    await repos.tasks.save(next);
    set({ tasks: get().tasks.map((task) => (task.id === id ? next : task)) });
  },

  async setTaskImportance(id, importance) {
    const repos = requireRepositories();
    const current = get().tasks.find((task) => task.id === id);
    if (!current) return;

    const next: Task = {
      ...current,
      importance,
      updatedAt: new Date().toISOString(),
    };
    await repos.tasks.save(next);
    set({ tasks: get().tasks.map((task) => (task.id === id ? next : task)) });
  },

  async setTaskCategory(id, categoryId) {
    const repos = requireRepositories();
    const current = get().tasks.find((task) => task.id === id);
    if (!current) return;

    const next: Task = {
      ...current,
      categoryId,
      updatedAt: new Date().toISOString(),
    };
    await repos.tasks.save(next);
    set({ tasks: get().tasks.map((task) => (task.id === id ? next : task)) });
  },

  async scheduleTask(id, start, minutes) {
    const repos = requireRepositories();
    const current = get().tasks.find((task) => task.id === id);
    if (!current) return;

    const next = applySchedule(current, start, minutes);
    await repos.tasks.save(next);
    set({ tasks: get().tasks.map((task) => (task.id === id ? next : task)) });
    emit('task.scheduled', {
      taskId: id,
      start: next.scheduledStart,
      end: next.scheduledEnd,
    });
  },

  async unscheduleTask(id) {
    const repos = requireRepositories();
    const current = get().tasks.find((task) => task.id === id);
    if (!current) return;

    const next = clearSchedule(current);
    await repos.tasks.save(next);
    set({ tasks: get().tasks.map((task) => (task.id === id ? next : task)) });
    emit('task.unscheduled', { taskId: id });
  },

  async addNote(content) {
    const repos = requireRepositories();
    const trimmed = content.trim();
    if (!trimmed) return null;

    const now = new Date().toISOString();
    const note: Note = {
      id: createId('note'),
      content: trimmed,
      tags: [],
      createdAt: now,
      updatedAt: now,
    };
    await repos.notes.save(note);
    set({ notes: [note, ...get().notes] });
    emit('note.captured', { noteId: note.id });
    return note;
  },

  async updateNote(id, patch) {
    const repos = requireRepositories();
    const current = get().notes.find((note) => note.id === id);
    if (!current) return;

    const next: Note = {
      ...current,
      content: patch.content === undefined ? current.content : patch.content.trim(),
      tags: patch.tags ?? current.tags,
      updatedAt: new Date().toISOString(),
    };
    if (!next.content) return;

    await repos.notes.save(next);
    set({ notes: get().notes.map((note) => (note.id === id ? next : note)) });
  },

  async removeNote(id) {
    const repos = requireRepositories();
    await repos.notes.remove(id);
    set({ notes: get().notes.filter((note) => note.id !== id) });
  },

  async convertNoteToTask(id) {
    const repos = requireRepositories();
    const note = get().notes.find((item) => item.id === id);
    if (!note || note.convertedTaskId) return;

    const now = new Date().toISOString();
    const task: Task = {
      id: createId('task'),
      title: note.content.slice(0, 40),
      note: note.content,
      status: 'inbox',
      priority: 'normal',
      source: 'note',
      createdAt: now,
      updatedAt: now,
    };
    const nextNote: Note = { ...note, convertedTaskId: task.id, updatedAt: now };

    await repos.tasks.save(task);
    await repos.notes.save(nextNote);
    set({
      tasks: [...get().tasks, task],
      notes: get().notes.map((item) => (item.id === id ? nextNote : item)),
    });
    emit('note.converted', { noteId: id, taskId: task.id });
  },

  async addEvent(input) {
    const repos = requireRepositories();
    const title = input.title.trim();
    if (!title) return null;

    const end = addMinutes(input.start, Math.max(5, Math.round(input.minutes)));
    const event: ScheduleEvent = {
      id: createId('event'),
      title,
      start: input.start.toISOString(),
      end: end.toISOString(),
      allDay: false,
      category: input.category ?? 'personal',
      location: input.location,
      note: input.note,
      source: 'manual',
      kind: input.kind,
      linkedTaskId: input.linkedTaskId,
      repeat: input.repeat ?? null,
      courseLike: input.courseLike,
    };
    await repos.events.save(event);
    set({ events: [...get().events, event] });
    emit('event.created', { eventId: event.id });
    return event;
  },

  async addDeadline(input) {
    const repos = requireRepositories();
    if (!input.title.trim()) return null;

    const pair = buildDeadlinePair(
      {
        title: input.title,
        dueAt: input.dueAt,
        location: input.location,
        category: input.category,
        note: input.note,
      },
      { eventId: createId('event'), taskId: createId('task') },
    );

    await repos.deadlines.savePair(pair.event, pair.task);
    set({
      tasks: [...get().tasks, pair.task],
      events: [...get().events, pair.event],
    });
    emit('task.created', { taskId: pair.task.id, source: pair.task.source });
    emit('event.created', { eventId: pair.event.id });
    return pair.event;
  },

  async removeEvent(id) {
    const repos = requireRepositories();
    await repos.events.remove(id);
    set({ events: get().events.filter((event) => event.id !== id) });
    emit('event.removed', { eventId: id });
  },

  async updateEvent(id, patch) {
    const repos = requireRepositories();
    const current = get().events.find((event) => event.id === id);
    if (!current) return;

    const next: ScheduleEvent = {
      ...current,
      title: patch.title?.trim() || current.title,
      start: patch.start ? patch.start.toISOString() : current.start,
      end: patch.end ? patch.end.toISOString() : current.end,
      location:
        patch.location !== undefined ? patch.location.trim() || undefined : current.location,
      repeat: patch.repeat === undefined ? current.repeat : patch.repeat,
    };
    const linkedTask = current.linkedTaskId
      ? get().tasks.find((item) => item.id === current.linkedTaskId)
      : undefined;

    if (linkedTask) {
      const nextTask: Task = {
        ...linkedTask,
        title: next.title,
        dueAt: next.start,
        updatedAt: new Date().toISOString(),
      };
      await repos.deadlines.savePair(next, nextTask);
      set({
        events: get().events.map((event) => (event.id === id ? next : event)),
        tasks: get().tasks.map((item) => (item.id === nextTask.id ? nextTask : item)),
      });
      return;
    }

    await repos.events.save(next);
    set({ events: get().events.map((event) => (event.id === id ? next : event)) });
  },

  async skipEventOccurrence(id, date) {
    const repos = requireRepositories();
    const current = get().events.find((event) => event.id === id);
    if (!current) return;

    const exdates = current.exdates ?? [];
    if (exdates.includes(date)) return;

    const next: ScheduleEvent = { ...current, exdates: [...exdates, date] };
    await repos.events.save(next);
    set({ events: get().events.map((event) => (event.id === id ? next : event)) });
  },

  async overrideEventOccurrence(id, date, start, end) {
    const repos = requireRepositories();
    const current = get().events.find((event) => event.id === id);
    if (!current) return;

    const overrides = {
      ...(current.overrides ?? {}),
      [date]: { start: start.toISOString(), end: end.toISOString() },
    };
    const next: ScheduleEvent = { ...current, overrides };
    await repos.events.save(next);
    set({ events: get().events.map((event) => (event.id === id ? next : event)) });
  },

  async setCalendarDropConfig(patch) {
    const repos = requireRepositories();
    const current = get().settings;
    const next: AppSettings = {
      ...current,
      monthDropHour: Math.min(23, Math.max(0, Math.round(patch.hour ?? current.monthDropHour))),
      monthDropMinutes: Math.min(
        720,
        Math.max(15, Math.round(patch.minutes ?? current.monthDropMinutes)),
      ),
    };
    await repos.settings.save(next);
    set({ settings: next });
    emit('settings.changed', { key: 'calendarDrop' });
  },

  async saveTimetable(timetable) {
    const repos = requireRepositories();
    await repos.timetable.save(timetable);
    set({ timetable });
    emit('settings.changed', { key: 'timetable' });
  },

  async addHabit(input) {
    const repos = requireRepositories();
    const name = input.name.trim();
    if (!name) return;

    const habit: Habit = {
      id: createId('habit'),
      name,
      color: input.color,
      frequency: input.frequency,
      remindAt: input.remindAt,
      archived: false,
      createdAt: new Date().toISOString(),
      mode: input.mode ?? 'light',
      timerMinutes: input.timerMinutes,
      logToTimeline: input.logToTimeline ?? false,
      categoryId: input.categoryId,
      unit: input.unit,
      dailyTarget: input.dailyTarget,
      unitMinutes: input.unitMinutes,
      goalId: input.goalId,
    };
    await repos.habits.save(habit);
    set({ habits: [...get().habits, habit] });
  },

  async updateHabit(id, patch) {
    const repos = requireRepositories();
    const current = get().habits.find((habit) => habit.id === id);
    if (!current) return;

    const next: Habit = { ...current, ...patch };
    if (patch.name !== undefined) next.name = patch.name.trim();
    if (!next.name) return;

    await repos.habits.save(next);
    set({ habits: get().habits.map((habit) => (habit.id === id ? next : habit)) });
  },

  async removeHabit(id) {
    const repos = requireRepositories();
    const logs = get().habitLogs.filter((log) => log.habitId === id);
    await Promise.all(logs.map((log) => repos.habitLogs.remove(log.id)));
    await repos.habits.remove(id);
    set({
      habits: get().habits.filter((habit) => habit.id !== id),
      habitLogs: get().habitLogs.filter((log) => log.habitId !== id),
    });
  },

  async toggleHabit(habitId, date) {
    const repos = requireRepositories();
    const habit = get().habits.find((item) => item.id === habitId);
    if (!habit) return;

    const dayLogs = get().habitLogs.filter(
      (log) => log.habitId === habitId && log.date === date,
    );
    const existing = dayLogs[dayLogs.length - 1];

    if (existing) {
      await repos.habitLogs.remove(existing.id);
      if (existing.generatedTaskId) {
        await repos.tasks.remove(existing.generatedTaskId);
      }
      if (existing.generatedFocusId) {
        await repos.focus.remove(existing.generatedFocusId);
      }

      set({
        habitLogs: get().habitLogs.filter((log) => log.id !== existing.id),
        tasks: existing.generatedTaskId
          ? get().tasks.filter((task) => task.id !== existing.generatedTaskId)
          : get().tasks,
        focusSessions: existing.generatedFocusId
          ? get().focusSessions.filter((session) => session.id !== existing.generatedFocusId)
          : get().focusSessions,
      });
      return;
    }

    const today = format(new Date(), 'yyyy-MM-dd');
    const target = parseISO(date);
    if (date !== today) {
      target.setHours(21, 0, 0, 0);
    }

    const completion = buildHabitCompletion({
      habit,
      logId: createId('habitLog'),
      taskId: createId('task'),
      focusId: createId('focus'),
      now: date === today ? new Date() : target,
    });

    await repos.habitLogs.save(completion.log);
    if (completion.task) {
      await repos.tasks.save(completion.task);
    }
    if (completion.focus) {
      await repos.focus.save(completion.focus);
    }

    set({
      habitLogs: [...get().habitLogs, completion.log],
      tasks: completion.task ? [...get().tasks, completion.task] : get().tasks,
      focusSessions: completion.focus
        ? [...get().focusSessions, completion.focus]
        : get().focusSessions,
    });
    emit('habit.checked', { habitId, date });
  },

  async completeHabit(habitId, date, elapsedSeconds) {
    const habit = get().habits.find((item) => item.id === habitId);
    if (!habit) return;

    const minutes = Math.max(1, Math.round(elapsedSeconds / 60));
    const unit = habit.unit === '小时' || habit.unit === 'h' ? habit.unit : '分钟';
    const value =
      unit === '小时' || unit === 'h'
        ? Math.max(0.01, Math.round((minutes / 60) * 100) / 100)
        : minutes;

    await get().addHabitLog(habitId, date, value, unit, minutes, elapsedSeconds);
  },

  async addHabitLog(habitId, date, value, unit, minutes, elapsedSeconds) {
    const repos = requireRepositories();
    const habit = get().habits.find((item) => item.id === habitId);
    if (!habit) return;

    const numeric = Number(value);
    const safeValue = Number.isFinite(numeric)
      ? Math.min(999999, Math.max(0.01, Math.round(numeric * 100) / 100))
      : 1;
    const today = format(new Date(), 'yyyy-MM-dd');
    const target = parseISO(date);
    if (date !== today) {
      target.setHours(21, 0, 0, 0);
    }

    const completion = buildHabitCompletion({
      habit,
      logId: createId('habitLog'),
      taskId: createId('task'),
      focusId: createId('focus'),
      now: date === today ? new Date() : target,
      value: safeValue,
      unit: unit || habit.unit,
      minutes,
      elapsedSeconds,
    });

    await repos.habitLogs.save(completion.log);
    if (completion.task) {
      await repos.tasks.save(completion.task);
    }
    if (completion.focus) {
      await repos.focus.save(completion.focus);
    }

    set({
      habitLogs: [...get().habitLogs, completion.log],
      tasks: completion.task ? [...get().tasks, completion.task] : get().tasks,
      focusSessions: completion.focus
        ? [...get().focusSessions, completion.focus]
        : get().focusSessions,
    });
    emit('habit.checked', { habitId, date });
  },

  async removeHabitLog(logId) {
    const repos = requireRepositories();
    const log = get().habitLogs.find((item) => item.id === logId);
    if (!log) return;

    await repos.habitLogs.remove(log.id);
    if (log.generatedTaskId) {
      await repos.tasks.remove(log.generatedTaskId);
    }
    if (log.generatedFocusId) {
      await repos.focus.remove(log.generatedFocusId);
    }

    set({
      habitLogs: get().habitLogs.filter((item) => item.id !== log.id),
      tasks: log.generatedTaskId
        ? get().tasks.filter((task) => task.id !== log.generatedTaskId)
        : get().tasks,
      focusSessions: log.generatedFocusId
        ? get().focusSessions.filter((session) => session.id !== log.generatedFocusId)
        : get().focusSessions,
    });
  },

  async addReview(input) {
    const repos = requireRepositories();
    const review: Review = {
      ...input,
      id: createId('review'),
      createdAt: new Date().toISOString(),
    };
    await repos.reviews.save(review);
    set({ reviews: [review, ...get().reviews] });
    emit('review.saved', { reviewId: review.id });
    return review;
  },

  async removeReview(id) {
    const repos = requireRepositories();
    await repos.reviews.remove(id);
    set({ reviews: get().reviews.filter((review) => review.id !== id) });
  },

  async addCategory(input) {
    const repos = requireRepositories();
    const name = input.name.trim();
    if (!name) return;
    if (get().categories.some((category) => category.name === name)) return;

    const category: Category = {
      id: createId('category'),
      name,
      color: input.color,
      kind: input.kind ?? 'custom',
      archived: false,
      createdAt: new Date().toISOString(),
    };
    await repos.categories.save(category);
    set({ categories: [...get().categories, category] });
  },

  async updateCategory(id, patch) {
    const repos = requireRepositories();
    const current = get().categories.find((category) => category.id === id);
    if (!current) return false;

    const name = patch.name === undefined ? current.name : patch.name.trim();
    if (!name) return false;
    const duplicated = get().categories.some(
      (category) => category.id !== id && category.name === name,
    );
    if (duplicated) return false;

    const next: Category = { ...current, name, color: patch.color ?? current.color };
    await repos.categories.save(next);
    set({
      categories: get().categories.map((category) => (category.id === id ? next : category)),
    });
    return true;
  },

  async removeCategory(id) {
    const repos = requireRepositories();
    const now = new Date().toISOString();
    const affectedTasks = get().tasks.filter((task) => task.categoryId === id);
    const affectedHabits = get().habits.filter((habit) => habit.categoryId === id);

    await Promise.all([
      ...affectedTasks.map((task) =>
        repos.tasks.save({ ...task, categoryId: undefined, updatedAt: now }),
      ),
      ...affectedHabits.map((habit) => repos.habits.save({ ...habit, categoryId: undefined })),
    ]);
    await repos.categories.remove(id);

    set({
      categories: get().categories.filter((category) => category.id !== id),
      tasks: get().tasks.map((task) =>
        task.categoryId === id ? { ...task, categoryId: undefined } : task,
      ),
      habits: get().habits.map((habit) =>
        habit.categoryId === id ? { ...habit, categoryId: undefined } : habit,
      ),
    });
  },

  async addGoal(input) {
    const repos = requireRepositories();
    const title = input.title.trim();
    if (!title) return null;

    const now = new Date().toISOString();
    const goal: Goal = {
      id: createId('goal'),
      title,
      note: input.note?.trim() || undefined,
      targetDate: input.targetDate,
      progress: 0,
      status: 'active',
      categoryId: input.categoryId,
      habitId: input.habitId,
      taskIds: input.taskIds,
      targetAmount: input.targetAmount,
      autoProgress:
        input.autoProgress ?? Boolean(input.habitId || (input.taskIds && input.taskIds.length > 0)),
      createdAt: now,
      updatedAt: now,
    };
    await repos.goals.save(goal);
    set({ goals: [goal, ...get().goals] });
    return goal;
  },

  async updateGoal(id, patch) {
    const repos = requireRepositories();
    const current = get().goals.find((goal) => goal.id === id);
    if (!current) return;

    const now = new Date().toISOString();
    const next: Goal = { ...current, ...patch, updatedAt: now };
    if (patch.title !== undefined) {
      next.title = patch.title.trim();
      if (!next.title) return;
    }
    if (patch.progress !== undefined) {
      next.progress = Math.min(100, Math.max(0, Math.round(patch.progress)));
    }
    if (patch.status === 'done') {
      next.progress = 100;
      next.completedAt = now;
    } else if (patch.status === 'active') {
      next.completedAt = undefined;
    }

    await repos.goals.save(next);
    set({ goals: get().goals.map((goal) => (goal.id === id ? next : goal)) });
  },

  async removeGoal(id) {
    const repos = requireRepositories();
    await repos.goals.remove(id);
    set({ goals: get().goals.filter((goal) => goal.id !== id) });
  },

  async addCountdown(input) {
    const repos = requireRepositories();
    const title = input.title.trim();
    if (!title || !input.date) return null;

    const countdown: Countdown = {
      id: createId('countdown'),
      title,
      date: input.date,
      yearly: input.yearly ?? false,
      remindAt: input.remindAt || '09:00',
      note: input.note?.trim() || undefined,
      color: input.color,
      createdAt: new Date().toISOString(),
    };
    await repos.countdowns.save(countdown);
    set({ countdowns: [countdown, ...get().countdowns] });
    return countdown;
  },

  async removeCountdown(id) {
    const repos = requireRepositories();
    await repos.countdowns.remove(id);
    set({ countdowns: get().countdowns.filter((countdown) => countdown.id !== id) });
  },

  async logFocus(input) {
    const repos = requireRepositories();
    const session: FocusSession = {
      id: createId('focus'),
      taskId: input.taskId,
      startedAt: input.startedAt ?? new Date().toISOString(),
      plannedSeconds: input.plannedSeconds,
      actualSeconds: input.actualSeconds,
      mode: input.mode,
      completed: input.actualSeconds >= input.plannedSeconds,
      note: input.note,
      cycleIndex: input.cycleIndex,
      abandoned: input.abandoned,
    };
    await repos.focus.save(session);
    set({ focusSessions: [...get().focusSessions, session] });
    emit('focus.completed', {
      sessionId: session.id,
      taskId: session.taskId,
      minutes: Math.round(session.actualSeconds / 60),
    });
  },

  async setTheme(theme) {
    const repos = requireRepositories();
    const next: AppSettings = { ...get().settings, theme };
    applyTheme(theme);
    await repos.settings.save(next);
    set({ settings: next });
    emit('settings.changed', { key: 'theme' });
  },

  async setFlag(key, value) {
    const repos = requireRepositories();
    const current = get().settings;
    const next: AppSettings = { ...current, flags: { ...current.flags, [key]: value } };
    await repos.settings.save(next);
    set({ settings: next });
    emit('settings.changed', { key: `flags.${key}` });
  },

  async setNotifications(value) {
    const repos = requireRepositories();
    const next: AppSettings = { ...get().settings, notifications: value };
    await repos.settings.save(next);
    set({ settings: next });
    emit('settings.changed', { key: 'notifications' });
  },

  async setReminderConfig(patch) {
    const repos = requireRepositories();
    const current = get().settings;
    const next: AppSettings = {
      ...current,
      reminderLeadMinutes: Math.max(
        1,
        Math.round(patch.leadMinutes ?? current.reminderLeadMinutes),
      ),
      habitGraceMinutes: Math.max(
        1,
        Math.round(patch.habitGraceMinutes ?? current.habitGraceMinutes),
      ),
    };
    await repos.settings.save(next);
    set({ settings: next });
    emit('settings.changed', { key: 'reminders' });
  },

  async resetDemoData() {
    const platform = await getPlatform();
    repositories = createRepositoryBundle(platform);

    await Promise.all([
      repositories.tasks.clear(),
      repositories.events.clear(),
      repositories.focus.clear(),
      repositories.notes.clear(),
      repositories.habits.clear(),
      repositories.habitLogs.clear(),
      repositories.reviews.clear(),
      repositories.categories.clear(),
      repositories.goals.clear(),
      repositories.countdowns.clear(),
    ]);
    await clearRepositoryStorage(platform.storage);
    await seedRepositories(repositories);
    const timetable = await repositories.timetable.load();
    await seedCategories(repositories, timetable);
    await platform.storage.set(SEEDED_FLAG_KEY, true);
    await platform.storage.set(SEEDED_HABITS_FLAG_KEY, true);
    await platform.storage.set(SEEDED_CATEGORIES_FLAG_KEY, true);

    const snapshot = await loadAll(repositories);
    applyTheme(snapshot.settings.theme);
    set({ ...snapshot, error: null });
  },
}));