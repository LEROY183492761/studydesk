import { format, parseISO, startOfWeek } from 'date-fns';

export const WEEKDAY_LABELS = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];

type ISODateLike = string | Date;

export function todayISODate(now: Date = new Date()): string {
  return format(now, 'yyyy-MM-dd');
}

/** ISO 时间字符串按本地时区取日期，避免 slice(0, 10) 得到 UTC 日期 */
export function toLocalISODate(value: string | Date): string {
  const date = typeof value === 'string' ? parseISO(value) : value;
  return format(date, 'yyyy-MM-dd');
}

export function toISODateTime(date: Date): string {
  return date.toISOString();
}

export function formatDateLabel(date: ISODateLike, pattern = 'M 月 d 日'): string {
  return format(typeof date === 'string' ? parseISO(date) : date, pattern);
}

export function formatTimeLabel(value: string): string {
  return format(parseISO(value), 'HH:mm');
}

export function weekStartOf(date: Date, weekStartsOn: 0 | 1): Date {
  return startOfWeek(date, { weekStartsOn });
}