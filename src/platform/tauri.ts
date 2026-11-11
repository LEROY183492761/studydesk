import { invoke } from '@tauri-apps/api/core';
import type { DatabasePort, FocusResult, FocusSnapshot, FocusStartInput, PlatformPort } from './types';

/**
 * Tauri 桌面实现。
 * 系统级能力通过 Rust command 暴露，前端不直接持有任何凭据或网络会话。
 */
export function createTauriPlatform(): PlatformPort {
  const database: DatabasePort = {
    tasks: {
      async list() {
        return invoke<unknown[]>('task_list');
      },
      async save(item) {
        await invoke('task_save', { task: item });
      },
      async remove(id) {
        await invoke('task_remove', { id });
      },
      async clear() {
        await invoke('task_clear');
      },
    },
    events: {
      async list() {
        return invoke<unknown[]>('event_list');
      },
      async save(item) {
        await invoke('event_save', { event: item });
      },
      async remove(id) {
        await invoke('event_remove', { id });
      },
      async clear() {
        await invoke('event_clear');
      },
    },
    focusSessions: {
      async list() {
        return invoke<unknown[]>('focus_session_list');
      },
      async save(item) {
        await invoke('focus_session_save', { session: item });
      },
      async remove(id) {
        await invoke('focus_session_remove', { id });
      },
      async clear() {
        await invoke('focus_session_clear');
      },
    },
    notes: {
      async list() {
        return invoke<unknown[]>('note_list');
      },
      async save(item) {
        await invoke('note_save', { note: item });
      },
      async remove(id) {
        await invoke('note_remove', { id });
      },
      async clear() {
        await invoke('note_clear');
      },
    },
    habits: {
      async list() {
        return invoke<unknown[]>('habit_list');
      },
      async save(item) {
        await invoke('habit_save', { habit: item });
      },
      async remove(id) {
        await invoke('habit_remove', { id });
      },
      async clear() {
        await invoke('habit_clear');
      },
    },
    habitLogs: {
      async list() {
        return invoke<unknown[]>('habit_log_list');
      },
      async save(item) {
        await invoke('habit_log_save', { log: item });
      },
      async remove(id) {
        await invoke('habit_log_remove', { id });
      },
      async clear() {
        await invoke('habit_log_clear');
      },
    },
    reviews: {
      async list() {
        return invoke<unknown[]>('review_list');
      },
      async save(item) {
        await invoke('review_save', { review: item });
      },
      async remove(id) {
        await invoke('review_remove', { id });
      },
      async clear() {
        await invoke('review_clear');
      },
    },
    categories: {
      async list() {
        return invoke<unknown[]>('category_list');
      },
      async save(item) {
        await invoke('category_save', { category: item });
      },
      async remove(id) {
        await invoke('category_remove', { id });
      },
      async clear() {
        await invoke('category_clear');
      },
    },
    goals: {
      async list() {
        return invoke<unknown[]>('goal_list');
      },
      async save(item) {
        await invoke('goal_save', { goal: item });
      },
      async remove(id) {
        await invoke('goal_remove', { id });
      },
      async clear() {
        await invoke('goal_clear');
      },
    },
    countdowns: {
      async list() {
        return invoke<unknown[]>('countdown_list');
      },
      async save(item) {
        await invoke('countdown_save', { countdown: item });
      },
      async remove(id) {
        await invoke('countdown_remove', { id });
      },
      async clear() {
        await invoke('countdown_clear');
      },
    },
    async saveDeadlinePair(event, task) {
      await invoke('deadline_save', { event, task });
    },
  };

  return {
    kind: 'tauri',
    database,
    storage: {
      async get<T>(key: string, fallback: T) {
        const value = await invoke<T | null>('kv_get', { key });
        return value ?? fallback;
      },
      async set<T>(key: string, value: T) {
        await invoke('kv_set', { key, value });
      },
      async remove(key: string) {
        await invoke('kv_remove', { key });
      },
    },
    clipboard: {
      async readText() {
        return invoke<string>('clipboard_read');
      },
      async writeText(text: string) {
        await invoke('clipboard_write', { text });
      },
    },
    notification: {
      isSupported() {
        return true;
      },
      async notify(title: string, body: string) {
        await invoke('notify', { title, body });
      },
    },
    timer: {
      startTicker(intervalMs, onTick) {
        const handle = window.setInterval(onTick, intervalMs);
        return () => window.clearInterval(handle);
      },
    },
    windowControl: {
      async setAlwaysOnTop(value: boolean) {
        await invoke('floating_set_always_on_top', { value });
      },
      async setVisible(value: boolean) {
        await invoke('floating_set_visible', { value });
      },
    },
    shortcuts: {
      async register(accelerator: string, _handler: () => void) {
        await invoke('shortcut_register', { accelerator });
        return () => void invoke('shortcut_unregister', { accelerator });
      },
    },
    secrets: {
      async set(account: string, secret: string) {
        await invoke('secret_set', { account, secret });
      },
      async get(account: string) {
        return invoke<string | null>('secret_get', { account });
      },
      async delete(account: string) {
        await invoke('secret_delete', { account });
      },
    },
    focus: {
      async start(input: FocusStartInput) {
        return invoke<FocusSnapshot>('focus_start', {
          mode: input.mode,
          plannedSeconds: input.plannedSeconds,
          taskId: input.taskId ?? null,
        });
      },
      async pause() {
        return invoke<FocusSnapshot>('focus_pause');
      },
      async resume() {
        return invoke<FocusSnapshot>('focus_resume');
      },
      async status() {
        return invoke<FocusSnapshot>('focus_status');
      },
      async stop() {
        return invoke<FocusResult>('focus_stop');
      },
    },
    bupt: {
      async fetchAcademic(account: string, password: string) {
        return invoke<unknown>('bupt_fetch_academic', { account, password });
      },
    },
  };
}