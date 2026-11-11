export interface KeyValuePort {
  get<T>(key: string, fallback: T): Promise<T>;
  set<T>(key: string, value: T): Promise<void>;
  remove(key: string): Promise<void>;
}

export interface ClipboardPort {
  readText(): Promise<string>;
  writeText(text: string): Promise<void>;
}

export interface NotificationPort {
  isSupported(): boolean;
  notify(title: string, body: string): Promise<void>;
}

export interface TimerPort {
  startTicker(intervalMs: number, onTick: () => void): () => void;
}

export interface WindowPort {
  setAlwaysOnTop(value: boolean): Promise<void>;
  setVisible(value: boolean): Promise<void>;
}

export interface ShortcutPort {
  register(accelerator: string, handler: () => void): Promise<() => void>;
}

export interface SecretPort {
  set(account: string, secret: string): Promise<void>;
  get(account: string): Promise<string | null>;
  delete(account: string): Promise<void>;
}

export interface EntityStore {
  list(): Promise<unknown[]>;
  save(item: unknown): Promise<void>;
  remove(id: string): Promise<void>;
  clear(): Promise<void>;
}

/**
 * 关系表端口。
 * 桌面端走 SQLite 的 tasks/events/focus_sessions/notes/habits/habit_logs/reviews 表；
 * Web 端用 localStorage 上的等价集合实现。
 */
export interface DatabasePort {
  tasks: EntityStore;
  events: EntityStore;
  focusSessions: EntityStore;
  notes: EntityStore;
  habits: EntityStore;
  habitLogs: EntityStore;
  reviews: EntityStore;
  categories: EntityStore;
  goals: EntityStore;
  countdowns: EntityStore;
  /** 原子写入 DDL 事件与待办；Web 端退化为顺序写入 */
  saveDeadlinePair?: (event: unknown, task: unknown) => Promise<void>;
}

export interface FocusSnapshot {
  mode: 'focus' | 'break' | '';
  running: boolean;
  planned_seconds: number;
  elapsed_seconds: number;
  remaining_seconds: number;
  task_id: string | null;
  started_at_ms: number | null;
}

export interface FocusResult {
  mode: 'focus' | 'break' | '';
  planned_seconds: number;
  actual_seconds: number;
  task_id: string | null;
  started_at_ms: number | null;
  completed: boolean;
}

export interface FocusStartInput {
  mode: 'focus' | 'break';
  plannedSeconds: number;
  taskId?: string;
}

/**
 * 番茄时钟端口。
 * 桌面端由 Rust 以 Instant 计时（休眠后不漂移），Web 端提供等价实现。
 */
export interface FocusTimerPort {
  start(input: FocusStartInput): Promise<FocusSnapshot>;
  pause(): Promise<FocusSnapshot>;
  resume(): Promise<FocusSnapshot>;
  status(): Promise<FocusSnapshot>;
  stop(): Promise<FocusResult>;
}

export interface BuptAcademicPort {
  /** 仅桌面端可用；密码只用于本次请求，不落盘 */
  fetchAcademic(account: string, password: string): Promise<unknown>;
}

/**
 * 平台能力端口（Ports & Adapters）。
 * 业务代码只依赖该接口；Web 与 Tauri 各自提供实现，新增平台无需改动业务模块。
 */
export interface PlatformPort {
  readonly kind: 'web' | 'tauri';
  storage: KeyValuePort;
  database: DatabasePort;
  clipboard: ClipboardPort;
  notification: NotificationPort;
  timer: TimerPort;
  windowControl: WindowPort;
  shortcuts: ShortcutPort;
  secrets: SecretPort;
  focus: FocusTimerPort;
  bupt: BuptAcademicPort;
}