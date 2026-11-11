import type { EntityId, ISODate, ISODateTime } from './core';

export type HabitFrequency =
  | { type: 'daily' }
  | { type: 'weekly'; timesPerWeek: number };

export interface Habit {
  id: EntityId;
  name: string;
  color: string;
  frequency: HabitFrequency;
  remindAt?: string;
  archived: boolean;
  createdAt: ISODateTime;
  /** 轻量模式只打卡；任务化模式生成已完成任务 */
  mode?: 'light' | 'task';
  /** 任务化打卡的默认时长（分钟） */
  timerMinutes?: number;
  /** 打卡是否写时间轴实际层 */
  logToTimeline?: boolean;
  /** 归属分类，用于饼图与筛选 */
  categoryId?: EntityId;
  /** 打卡单位，默认「次」 */
  unit?: string;
  /** 每日目标量，也是环比分母 */
  dailyTarget?: number;
  /** 每单位折算分钟，用于写时间轴 */
  unitMinutes?: number;
  /** 绑定的目标 */
  goalId?: EntityId;
}

export interface HabitLog {
  id: EntityId;
  habitId: EntityId;
  date: ISODate;
  value: number;
  note?: string;
  /** 本次打卡单位快照，历史记录按原单位保留 */
  unit?: string;
  /** 本次计时开始时刻（任务型计时记录） */
  startedAt?: ISODateTime;
  /** 本次打卡时刻 */
  recordedAt?: ISODateTime;
  /** 本次折算分钟，写时间轴时使用 */
  minutes?: number;
  /** 任务化打卡生成的待办 */
  generatedTaskId?: EntityId;
  /** 打卡写入时间轴的专注记录 */
  generatedFocusId?: EntityId;
}

export type FocusMode = 'focus' | 'break';

export interface FocusSession {
  id: EntityId;
  taskId?: EntityId;
  startedAt: ISODateTime;
  plannedSeconds: number;
  actualSeconds: number;
  mode: FocusMode;
  completed: boolean;
  note?: string;
  /** 第几轮番茄，从 1 开始 */
  cycleIndex?: number;
  /** 中途放弃或跳过 */
  abandoned?: boolean;
}

export interface Note {
  id: EntityId;
  content: string;
  tags: string[];
  mood?: string;
  createdAt: ISODateTime;
  updatedAt: ISODateTime;
  convertedTaskId?: EntityId;
}

export interface ReviewMetrics {
  focusMinutes: number;
  /** 专注总秒数，用于秒级展示 */
  focusSeconds?: number;
  /** 放弃的专注次数 */
  abandonedSessions?: number;
  focusSessions: number;
  tasksCompleted: number;
  tasksCreated: number;
  completionRate: number;
  courseMinutes: number;
  habitCompletionRate: number;
}

export type ReviewType = 'daily' | 'weekly' | 'monthly';

export interface Review {
  id: EntityId;
  type: ReviewType;
  periodStart: ISODate;
  periodEnd: ISODate;
  metrics: ReviewMetrics;
  answers: Record<string, string>;
  createdAt: ISODateTime;
}