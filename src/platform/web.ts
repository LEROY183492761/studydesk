import type {
  DatabasePort,
  EntityStore,
  FocusResult,
  FocusSnapshot,
  FocusStartInput,
  PlatformPort,
} from './types';

const memory = new Map<string, string>();

interface WebFocusState {
  mode: 'focus' | 'break';
  plannedSeconds: number;
  accumulatedMs: number;
  startedAt: number;
  running: boolean;
  taskId?: string;
  startedAtMs: number;
}

let webFocus: WebFocusState | null = null;

function webSnapshot(): FocusSnapshot {
  if (!webFocus) {
    return {
      mode: '',
      running: false,
      planned_seconds: 0,
      elapsed_seconds: 0,
      remaining_seconds: 0,
      task_id: null,
      started_at_ms: null,
    };
  }

  const elapsedMs =
    webFocus.accumulatedMs + (webFocus.running ? Date.now() - webFocus.startedAt : 0);
  const elapsedSeconds = Math.floor(elapsedMs / 1000);

  return {
    mode: webFocus.mode,
    running: webFocus.running,
    planned_seconds: webFocus.plannedSeconds,
    elapsed_seconds: elapsedSeconds,
    remaining_seconds: Math.max(0, webFocus.plannedSeconds - elapsedSeconds),
    task_id: webFocus.taskId ?? null,
    started_at_ms: webFocus.startedAtMs,
  };
}

function safeStorage(): Pick<Storage, 'getItem' | 'setItem' | 'removeItem'> {
  if (typeof localStorage !== 'undefined') return localStorage;
  return {
    getItem: (key: string) => memory.get(key) ?? null,
    setItem: (key: string, value: string) => void memory.set(key, value),
    removeItem: (key: string) => void memory.delete(key),
  };
}

function createLocalStore<T extends { id: string }>(
  storage: Pick<Storage, 'getItem' | 'setItem'>,
  key: string,
): EntityStore {
  const read = (): T[] => {
    try {
      const raw = storage.getItem(key);
      return raw ? (JSON.parse(raw) as T[]) : [];
    } catch {
      return [];
    }
  };

  return {
    async list() {
      return read();
    },
    async save(item) {
      const current = read();
      const next = item as T;
      const index = current.findIndex((entry) => entry.id === next.id);
      const items =
        index >= 0
          ? current.map((entry) => (entry.id === next.id ? next : entry))
          : [...current, next];
      storage.setItem(key, JSON.stringify(items));
    },
    async remove(id) {
      storage.setItem(
        key,
        JSON.stringify(read().filter((entry) => entry.id !== id)),
      );
    },
    async clear() {
      storage.setItem(key, JSON.stringify([]));
    },
  };
}

export function createWebPlatform(): PlatformPort {
  const storage = safeStorage();

  const database: DatabasePort = {
    tasks: createLocalStore(storage, 'studydesk.v1.tasks'),
    events: createLocalStore(storage, 'studydesk.v1.events'),
    focusSessions: createLocalStore(storage, 'studydesk.v1.focus'),
    notes: createLocalStore(storage, 'studydesk.v1.notes'),
    habits: createLocalStore(storage, 'studydesk.v1.habits'),
    habitLogs: createLocalStore(storage, 'studydesk.v1.habit-logs'),
    reviews: createLocalStore(storage, 'studydesk.v1.reviews'),
    categories: createLocalStore(storage, 'studydesk.v1.categories'),
    goals: createLocalStore(storage, 'studydesk.v1.goals'),
    countdowns: createLocalStore(storage, 'studydesk.v1.countdowns'),
    async saveDeadlinePair(event, task) {
      await database.tasks.save(task);
      await database.events.save(event);
    },
  };

  return {
    kind: 'web',
    database,
    storage: {
      async get<T>(key: string, fallback: T) {
        try {
          const raw = storage.getItem(key);
          return raw === null ? fallback : (JSON.parse(raw) as T);
        } catch {
          return fallback;
        }
      },
      async set<T>(key: string, value: T) {
        storage.setItem(key, JSON.stringify(value));
      },
      async remove(key: string) {
        storage.removeItem(key);
      },
    },
    clipboard: {
      async readText() {
        if (typeof navigator === 'undefined' || !navigator.clipboard) return '';
        return navigator.clipboard.readText();
      },
      async writeText(text: string) {
        if (typeof navigator === 'undefined' || !navigator.clipboard) return;
        await navigator.clipboard.writeText(text);
      },
    },
    notification: {
      isSupported() {
        return typeof Notification !== 'undefined';
      },
      async notify(title, body) {
        if (typeof Notification === 'undefined') return;
        let permission = Notification.permission;
        if (permission === 'default') {
          permission = await Notification.requestPermission();
        }
        if (permission === 'granted') {
          new Notification(title, { body });
        }
      },
    },
    timer: {
      startTicker(intervalMs, onTick) {
        const handle = setInterval(onTick, intervalMs);
        return () => clearInterval(handle);
      },
    },
    windowControl: {
      async setAlwaysOnTop() {
        /* Web 端不支持置顶 */
      },
      async setVisible() {
        /* Web 端不支持独立窗口 */
      },
    },
    shortcuts: {
      async register() {
        /* Web 端不支持全局快捷键，由页面内 keydown 兜底 */
        return () => undefined;
      },
    },
    secrets: {
      async set() {
        throw new Error('Web 端不提供安全凭据存储，请使用桌面端');
      },
      async get() {
        return null;
      },
      async delete() {
        /* no-op */
      },
    },
    focus: {
      async start(input: FocusStartInput) {
        webFocus = {
          mode: input.mode,
          plannedSeconds: Math.max(1, input.plannedSeconds),
          accumulatedMs: 0,
          startedAt: Date.now(),
          running: true,
          taskId: input.taskId,
          startedAtMs: Date.now(),
        };
        return webSnapshot();
      },
      async pause() {
        if (webFocus && webFocus.running) {
          webFocus.accumulatedMs += Date.now() - webFocus.startedAt;
          webFocus.running = false;
        }
        return webSnapshot();
      },
      async resume() {
        if (webFocus && !webFocus.running) {
          webFocus.startedAt = Date.now();
          webFocus.running = true;
        }
        return webSnapshot();
      },
      async status() {
        return webSnapshot();
      },
      async stop(): Promise<FocusResult> {
        const snapshot = webSnapshot();
        webFocus = null;
        return {
          mode: snapshot.mode,
          planned_seconds: snapshot.planned_seconds,
          actual_seconds: snapshot.elapsed_seconds,
          task_id: snapshot.task_id,
          started_at_ms: snapshot.started_at_ms,
          completed: snapshot.elapsed_seconds >= snapshot.planned_seconds,
        };
      },
    },
    bupt: {
      async fetchAcademic() {
        throw new Error('北邮教务拉取仅桌面端可用');
      },
    },
  };
}