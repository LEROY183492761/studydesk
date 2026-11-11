import type { EntityId, ISODate, ISODateTime } from './core';

export type GoalStatus = 'active' | 'done' | 'archived';

export interface Goal {
  id: EntityId;
  title: string;
  note?: string;
  /** 目标达成日期（可选） */
  targetDate?: ISODate;
  /** 0–100 */
  progress: number;
  status: GoalStatus;
  categoryId?: EntityId;
  /** 绑定的习惯 */
  habitId?: EntityId;
  /** 关联的任务 */
  taskIds?: EntityId[];
  /** 目标总量（周期内累计） */
  targetAmount?: number;
  /** 为 true 时进度由绑定习惯自动累计 */
  autoProgress?: boolean;
  createdAt: ISODateTime;
  updatedAt: ISODateTime;
  completedAt?: ISODateTime;
}

export interface Countdown {
  id: EntityId;
  title: string;
  /** 目标日期 yyyy-MM-dd */
  date: ISODate;
  /** 每年重复（生日、纪念日） */
  yearly?: boolean;
  /** 当天提醒时刻 HH:mm，默认 09:00 */
  remindAt?: string;
  note?: string;
  color?: string;
  createdAt: ISODateTime;
}