export interface ReminderHistoryItem {
  id: string;
  title: string;
  body: string;
  at: string;
}

const STORAGE_KEY = 'studydesk.reminder.history';
const MAX_ITEMS = 20;

export function readReminderHistory(): ReminderHistoryItem[] {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as ReminderHistoryItem[];
    return Array.isArray(parsed) ? parsed.slice(0, MAX_ITEMS) : [];
  } catch {
    return [];
  }
}

export function appendReminderHistory(item: ReminderHistoryItem): ReminderHistoryItem[] {
  const next = [item, ...readReminderHistory()].slice(0, MAX_ITEMS);
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    /* 忽略存储失败，不影响提醒本身 */
  }
  return next;
}

export function clearReminderHistory(): void {
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* no-op */
  }
}