import type { EntityId, ISODate, ISODateTime } from './core';

/** v1.1 间隔重复卡片（SM-2 简化版，字段预留，M0 不启用） */
export type ReviewRating = 'again' | 'hard' | 'good' | 'easy';
export type ReviewCardSource = 'note' | 'course' | 'manual';

export interface ReviewCard {
  id: EntityId;
  sourceType: ReviewCardSource;
  sourceId?: EntityId;
  front: string;
  back: string;
  tags: string[];
  easeFactor: number;
  intervalDays: number;
  dueAt: ISODate;
  lapses: number;
  createdAt: ISODateTime;
  updatedAt: ISODateTime;
}

export interface ReviewLog {
  id: EntityId;
  cardId: EntityId;
  rating: ReviewRating;
  reviewedAt: ISODateTime;
  elapsedMs: number;
}

/** v1.1 轻量记账（金额一律以“分”为单位存储，避免浮点误差） */
export type LedgerKind = 'expense' | 'income';
export type LedgerSource = 'manual' | 'capture';

export interface LedgerCategory {
  id: EntityId;
  name: string;
  kind: LedgerKind;
  color: string;
  archived: boolean;
}

export interface LedgerEntry {
  id: EntityId;
  kind: LedgerKind;
  amountCents: number;
  categoryId: EntityId;
  occurredAt: ISODateTime;
  note?: string;
  source: LedgerSource;
  createdAt: ISODateTime;
}

export interface LedgerBudget {
  month: string;
  amountCents: number;
}

/** v1.1 全局快捷录入：解析结果统一为 CaptureDraft，由调度器分发到目标模块 */
export type CaptureKind = 'task' | 'note' | 'event' | 'ledger';

export interface CaptureDraft {
  kind: CaptureKind;
  title: string;
  note?: string;
  dueAt?: ISODateTime;
  startAt?: ISODateTime;
  endAt?: ISODateTime;
  amountCents?: number;
  occurredAt?: ISODateTime;
}

export interface CaptureRecord {
  id: EntityId;
  rawText: string;
  draft: CaptureDraft;
  createdAt: ISODateTime;
  appliedTo?: EntityId;
}

/** v1.1 悬浮窗状态（窗口本身由平台端口创建，业务只关心状态） */
export interface FloatingWindowState {
  visible: boolean;
  alwaysOnTop: boolean;
  mode: 'focus' | 'nextClass';
  opacity: number;
}