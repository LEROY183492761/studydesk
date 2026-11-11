import { format, subSeconds } from 'date-fns';
import type { FocusSession, Habit, HabitLog, Task } from '../models';

export interface HabitCompletionInput {
  habit: Habit;
  logId: string;
  taskId: string;
  focusId: string;
  now: Date;
  /** 真实计时秒数；未传时按习惯配置时长回填 */
  elapsedSeconds?: number;
  /** 本次完成量，默认 1 */
  value?: number;
  /** 本次打卡单位，默认取习惯单位 */
  unit?: string;
  /** 本次折算分钟；传入时优先于 elapsedSeconds */
  minutes?: number;
}

export interface HabitCompletion {
  log: HabitLog;
  task?: Task;
  focus?: FocusSession;
}

/**
 * 习惯打卡的三种产出：
 * - 轻量模式：只写 habit_log；
 * - 任务化模式：额外生成已完成任务（带分类）；
 * - 开启「写入时间轴」或任务化：生成专注记录，优先使用真实计时秒数。
 */
export function buildHabitCompletion(input: HabitCompletionInput): HabitCompletion {
  const { habit, logId, taskId, focusId, now, elapsedSeconds } = input;
  const date = format(now, 'yyyy-MM-dd');
  const unit = input.unit ?? habit.unit ?? '次';
  const rawValue = Number(input.value ?? 1);
  const value = Number.isFinite(rawValue)
    ? Math.min(999999, Math.max(0.01, Math.round(rawValue * 100) / 100))
    : 1;
  const configuredSeconds = Math.max(1, habit.timerMinutes ?? 15) * 60;
  const actualSeconds = Math.max(
    1,
    Math.round(elapsedSeconds ?? (input.minutes ?? configuredSeconds / 60) * 60),
  );
  const minutes = Math.max(1, Math.round(input.minutes ?? actualSeconds / 60));
  const writeTimeline = habit.mode === 'task' || habit.logToTimeline === true;

  const focus: FocusSession | undefined = writeTimeline
    ? {
        id: focusId,
        startedAt: subSeconds(now, actualSeconds).toISOString(),
        plannedSeconds: configuredSeconds,
        actualSeconds,
        mode: 'focus',
        completed: true,
        note: `习惯：${habit.name}（${value}${unit}）`,
        cycleIndex: 1,
      }
    : undefined;

  const task: Task | undefined =
    habit.mode === 'task'
      ? {
          id: taskId,
          title: `${habit.name} · ${value}${unit}`,
          status: 'done',
          priority: 'normal',
          estimateMinutes: minutes,
          source: 'habit',
          timerMode: 'stopwatch',
          cyclesPlanned: 1,
          cyclesCompleted: 1,
          categoryId: habit.categoryId,
          note: `本次 ${value}${unit} · 实际 ${minutes} 分钟`,
          createdAt: now.toISOString(),
          updatedAt: now.toISOString(),
          completedAt: now.toISOString(),
        }
      : undefined;

  return {
    log: {
      id: logId,
      habitId: habit.id,
      date,
      value,
      unit,
      recordedAt: now.toISOString(),
      startedAt: subSeconds(now, actualSeconds).toISOString(),
      minutes,
      note: `本次 ${value}${unit}`,
      generatedTaskId: task?.id,
      generatedFocusId: focus?.id,
    },
    task,
    focus,
  };
}