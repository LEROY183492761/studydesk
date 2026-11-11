export type EntityId = string;
export type ISODate = string;
export type ISODateTime = string;

/** 统一日历视图模型：所有页面只消费该结构，合并逻辑集中在一处 */
export type CalendarSource = 'course' | 'assignment' | 'exam' | 'task' | 'event';

export interface CalendarItem {
  id: EntityId;
  source: CalendarSource;
  title: string;
  start: ISODateTime;
  end: ISODateTime;
  allDay: boolean;
  readonly: boolean;
  color?: string;
  location?: string;
  sourceId?: EntityId;
  /** 日程或 DDL */
  kind?: 'event' | 'deadline';
  /** DDL 对应待办已完成 */
  completed?: boolean;
}

export type TaskStatus = 'inbox' | 'planned' | 'doing' | 'done' | 'archived';
export type TaskPriority = 'low' | 'normal' | 'high' | 'urgent';
export type TaskSource =
  | 'manual'
  | 'assignment'
  | 'note'
  | 'capture'
  | 'reviewCard'
  | 'deadline'
  | 'habit';

/** 任务级计时模式：倒计时（番茄）、正计时、不计时 */
export type TimerMode = 'countdown' | 'stopwatch' | 'none';

export interface Task {
  id: EntityId;
  title: string;
  note?: string;
  status: TaskStatus;
  priority: TaskPriority;
  estimateMinutes?: number;
  dueAt?: ISODateTime;
  scheduledStart?: ISODateTime;
  scheduledEnd?: ISODateTime;
  listId?: string;
  parentId?: EntityId;
  source: TaskSource;
  createdAt: ISODateTime;
  updatedAt: ISODateTime;
  completedAt?: ISODateTime;

  /** 计时配置；未设置时继承全局番茄设置 */
  timerMode?: TimerMode;
  focusMinutes?: number;
  breakMinutes?: number;
  cyclesPlanned?: number;
  cyclesCompleted?: number;

  /** 四象限与分类 */
  importance?: 'high' | 'low';
  categoryId?: EntityId;

  /** 与日程项的双向关联（DDL 等） */
  linkedEventId?: EntityId;
}

export interface Category {
  id: EntityId;
  name: string;
  color: string;
  kind?: string;
  archived: boolean;
  createdAt: ISODateTime;
}

export type RecurrenceFrequency = 'daily' | 'weekly' | 'monthly';

export interface EventRecurrence {
  frequency: RecurrenceFrequency;
  interval: number;
  /** 0=周日 … 6=周六；weekly 多选，monthly 配合 bySetPos */
  byWeekday?: number[];
  /** 每月 N 日 */
  byMonthDay?: number;
  /** 每月第 N 个周X，负数表示倒数 */
  bySetPos?: number;
  count?: number;
  until?: ISODate;
}

export interface ScheduleEvent {
  id: EntityId;
  title: string;
  start: ISODateTime;
  end: ISODateTime;
  allDay: boolean;
  category: string;
  location?: string;
  note?: string;
  source: 'manual' | 'custom-feed' | 'holiday';
  /** 日程或 DDL */
  kind?: 'event' | 'deadline';
  /** DDL 关联的待办 */
  linkedTaskId?: EntityId;
  /** 循环规则；DDL 不支持重复 */
  repeat?: EventRecurrence | null;
  /** 跳过的 occurrence 日期（yyyy-MM-dd） */
  exdates?: ISODate[];
  /** 单次覆盖：key 为 occurrence 日期（yyyy-MM-dd） */
  overrides?: Record<ISODate, { start: ISODateTime; end: ISODateTime }>;
  /** 标记为课程：可在课表视图展示（M3 接入） */
  courseLike?: boolean;
}

export type ThemeId = 'light' | 'dark' | 'sepia';

export interface FeatureFlags {
  reviewCards: boolean;
  quickCapture: boolean;
  floatingWindow: boolean;
  ledger: boolean;
}

export interface AppSettings {
  theme: ThemeId;
  focusMinutes: number;
  breakMinutes: number;
  weekStartsOn: 0 | 1;
  flags: FeatureFlags;
  /** 系统通知总开关：番茄结束、课前提醒、习惯提醒 */
  notifications: boolean;
  /** 课前提醒提前量（分钟） */
  reminderLeadMinutes: number;
  /** 习惯提醒到点后的宽限（分钟） */
  habitGraceMinutes: number;
  /** 月视图拖入待办的默认开始小时 */
  monthDropHour: number;
  /** 月视图拖入待办的默认时长（分钟） */
  monthDropMinutes: number;
}

export const DEFAULT_SETTINGS: AppSettings = {
  theme: 'light',
  focusMinutes: 25,
  breakMinutes: 5,
  weekStartsOn: 1,
  flags: {
    reviewCards: false,
    quickCapture: false,
    floatingWindow: false,
    ledger: false,
  },
  notifications: true,
  reminderLeadMinutes: 10,
  habitGraceMinutes: 5,
  monthDropHour: 9,
  monthDropMinutes: 60,
};

export const CALENDAR_SOURCE_LABEL: Record<CalendarSource, string> = {
  course: '课程',
  assignment: '作业',
  exam: '考试',
  task: '待办',
  event: '日程',
};