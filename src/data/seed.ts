import { addDays, format, startOfDay, startOfWeek, subWeeks } from 'date-fns';
import type {
  CaptureRecord,
  Course,
  CourseSession,
  FocusSession,
  Habit,
  HabitLog,
  LedgerCategory,
  LedgerEntry,
  Note,
  ReviewCard,
  ScheduleEvent,
  Task,
  Timetable,
} from '@/domain/models';

const today = startOfDay(new Date());

function isoAt(dayOffset: number, hour: number, minute = 0): string {
  const date = addDays(today, dayOffset);
  date.setHours(hour, minute, 0, 0);
  return date.toISOString();
}

const ALL_WEEKS = Array.from({ length: 16 }, (_, index) => index + 1);
const TERM_START = format(subWeeks(startOfWeek(today, { weekStartsOn: 1 }), 9), 'yyyy-MM-dd');

export const SEED_TERM_START_DATE = TERM_START;

const courses: Course[] = [
  { id: 'c_math', name: '高等数学', teacher: '李老师', credits: 5, color: 'var(--color-course-1)' },
  { id: 'c_ds', name: '数据结构', teacher: '王老师', credits: 4, color: 'var(--color-course-2)' },
  { id: 'c_english', name: '大学英语', teacher: 'Smith', credits: 2, color: 'var(--color-course-3)' },
  { id: 'c_co', name: '计算机组成原理', teacher: '赵老师', credits: 4, color: 'var(--color-course-4)' },
  { id: 'c_os', name: '操作系统', teacher: '陈老师', credits: 3, color: 'var(--color-course-5)' },
];

const sessions: CourseSession[] = [
  { id: 's_math', courseId: 'c_math', weekday: 1, startPeriod: 1, endPeriod: 2, weeks: ALL_WEEKS, parity: 'all', location: '教三-101' },
  { id: 's_ds', courseId: 'c_ds', weekday: 1, startPeriod: 3, endPeriod: 4, weeks: ALL_WEEKS, parity: 'all', location: '教三-205' },
  { id: 's_english', courseId: 'c_english', weekday: 2, startPeriod: 5, endPeriod: 6, weeks: ALL_WEEKS, parity: 'all', location: '外语楼-302' },
  { id: 's_co', courseId: 'c_co', weekday: 3, startPeriod: 3, endPeriod: 4, weeks: ALL_WEEKS, parity: 'all', location: '教二-401' },
  { id: 's_os', courseId: 'c_os', weekday: 5, startPeriod: 1, endPeriod: 2, weeks: ALL_WEEKS, parity: 'all', location: '教二-108' },
];

export const SEED_TIMETABLE: Timetable = {
  meta: { semester: '2026-2027-1', termStartDate: TERM_START, totalWeeks: 16 },
  courses,
  sessions,
};

export const SEED_TASKS: Task[] = [
  {
    id: 't_seed_1',
    title: '完成数据结构图论作业',
    note: '第 6 章，含 3 道上机题',
    status: 'inbox',
    priority: 'high',
    estimateMinutes: 90,
    dueAt: isoAt(0, 23),
    source: 'assignment',
    createdAt: isoAt(-1, 20),
    updatedAt: isoAt(-1, 20),
  },
  {
    id: 't_seed_2',
    title: '复习高数第三章：中值定理',
    status: 'planned',
    priority: 'normal',
    estimateMinutes: 60,
    dueAt: isoAt(1, 21),
    source: 'manual',
    createdAt: isoAt(-2, 19),
    updatedAt: isoAt(-2, 19),
  },
  {
    id: 't_seed_3',
    title: '提交操作系统实验报告',
    status: 'inbox',
    priority: 'urgent',
    estimateMinutes: 45,
    dueAt: isoAt(2, 18),
    source: 'assignment',
    createdAt: isoAt(-3, 10),
    updatedAt: isoAt(-3, 10),
  },
  {
    id: 't_seed_4',
    title: '预约周五图书馆研讨间',
    status: 'inbox',
    priority: 'low',
    source: 'manual',
    createdAt: isoAt(0, 8),
    updatedAt: isoAt(0, 8),
  },
];

export const SEED_NOTES: Note[] = [
  {
    id: 'n_seed_1',
    content: '实验报告的图表要重画，顺便问助教第 3 题的判定条件。',
    tags: ['实验', '待确认'],
    mood: 'calm',
    createdAt: isoAt(-1, 22, 10),
    updatedAt: isoAt(-1, 22, 10),
  },
];

export const SEED_FOCUS_SESSIONS: FocusSession[] = [
  {
    id: 'f_seed_1',
    startedAt: isoAt(-1, 19, 30),
    plannedSeconds: 25 * 60,
    actualSeconds: 25 * 60,
    mode: 'focus',
    completed: true,
    note: '高数第三章',
  },
  {
    id: 'f_seed_2',
    startedAt: isoAt(0, 9, 10),
    plannedSeconds: 50 * 60,
    actualSeconds: 47 * 60,
    mode: 'focus',
    completed: true,
    note: '数据结构作业',
  },
];

export const SEED_LEDGER_CATEGORIES: LedgerCategory[] = [
  { id: 'lc_food', name: '餐饮', kind: 'expense', color: 'var(--color-course-3)', archived: false },
  { id: 'lc_traffic', name: '交通', kind: 'expense', color: 'var(--color-course-5)', archived: false },
  { id: 'lc_study', name: '学习', kind: 'expense', color: 'var(--color-course-1)', archived: false },
  { id: 'lc_life', name: '生活', kind: 'expense', color: 'var(--color-course-2)', archived: false },
  { id: 'lc_income', name: '生活费', kind: 'income', color: 'var(--color-success)', archived: false },
];

export const SEED_LEDGER_ENTRIES: LedgerEntry[] = [
  {
    id: 'le_seed_1',
    kind: 'expense',
    amountCents: 1200,
    categoryId: 'lc_food',
    occurredAt: isoAt(0, 12, 10),
    note: '食堂午饭',
    source: 'manual',
    createdAt: isoAt(0, 12, 10),
  },
  {
    id: 'le_seed_2',
    kind: 'expense',
    amountCents: 450,
    categoryId: 'lc_traffic',
    occurredAt: isoAt(-1, 18, 30),
    note: '地铁',
    source: 'manual',
    createdAt: isoAt(-1, 18, 30),
  },
];

export const SEED_EVENTS: ScheduleEvent[] = [
  {
    id: 'e_seed_1',
    title: '小组会议：课程设计分工',
    start: isoAt(0, 10),
    end: isoAt(0, 11),
    allDay: false,
    category: 'meeting',
    location: '图书馆研讨间 3',
    source: 'manual',
  },
  {
    id: 'e_seed_2',
    title: '取快递',
    start: isoAt(1, 16),
    end: isoAt(1, 16, 30),
    allDay: false,
    category: 'life',
    location: '菜鸟驿站',
    source: 'manual',
  },
  {
    id: 'e_seed_3',
    title: '社团例会',
    start: isoAt(3, 19),
    end: isoAt(3, 20),
    allDay: false,
    category: 'club',
    source: 'manual',
  },
];

export const SEED_REVIEW_CARDS: ReviewCard[] = [];
export const SEED_CAPTURES: CaptureRecord[] = [];
export const SEED_HABITS: Habit[] = [
  {
    id: 'h_read',
    name: '阅读 30 分钟',
    color: 'var(--color-course-1)',
    frequency: { type: 'daily' },
    archived: false,
    createdAt: isoAt(-30, 8),
  },
  {
    id: 'h_run',
    name: '运动',
    color: 'var(--color-course-2)',
    frequency: { type: 'weekly', timesPerWeek: 3 },
    archived: false,
    createdAt: isoAt(-30, 8),
  },
  {
    id: 'h_sleep',
    name: '23:30 前睡觉',
    color: 'var(--color-course-5)',
    frequency: { type: 'daily' },
    archived: false,
    createdAt: isoAt(-30, 8),
  },
];

export const SEED_HABIT_LOGS: HabitLog[] = [
  ...[0, 1, 2, 3, 4].map((offset) => ({
    id: `hl_read_${offset}`,
    habitId: 'h_read',
    date: format(addDays(today, -offset), 'yyyy-MM-dd'),
    value: 1,
  })),
  ...[1, 3].map((offset) => ({
    id: `hl_run_${offset}`,
    habitId: 'h_run',
    date: format(addDays(today, -offset), 'yyyy-MM-dd'),
    value: 1,
  })),
  ...[0, 2, 4].map((offset) => ({
    id: `hl_sleep_${offset}`,
    habitId: 'h_sleep',
    date: format(addDays(today, -offset), 'yyyy-MM-dd'),
    value: 1,
  })),
];