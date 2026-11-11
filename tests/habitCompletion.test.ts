import { describe, expect, it } from 'vitest';
import { buildHabitCompletion } from '@/domain/rules/habitCompletion';
import type { Habit } from '@/domain/models';

const now = new Date(2026, 8, 7, 21, 0);
const ids = { logId: 'l1', taskId: 't1', focusId: 'f1' };

function habit(overrides: Partial<Habit> = {}): Habit {
  return {
    id: 'h1',
    name: '阅读 30 分钟',
    color: '#000',
    frequency: { type: 'daily' },
    archived: false,
    createdAt: now.toISOString(),
    ...overrides,
  };
}

describe('习惯打卡产出', () => {
  it('轻量模式只生成打卡记录', () => {
    const result = buildHabitCompletion({ habit: habit(), now, ...ids });
    expect(result.log.generatedTaskId).toBeUndefined();
    expect(result.log.generatedFocusId).toBeUndefined();
    expect(result.task).toBeUndefined();
    expect(result.focus).toBeUndefined();
  });

  it('任务化模式生成已完成任务与专注记录', () => {
    const result = buildHabitCompletion({
      habit: habit({ mode: 'task', timerMinutes: 20 }),
      now,
      ...ids,
    });

    expect(result.task?.status).toBe('done');
    expect(result.task?.source).toBe('habit');
    expect(result.task?.completedAt).toBe(now.toISOString());
    expect(result.log.generatedTaskId).toBe('t1');

    expect(result.focus?.actualSeconds).toBe(20 * 60);
    expect(result.focus?.note).toContain('习惯：阅读 30 分钟');
    expect(result.log.generatedFocusId).toBe('f1');
  });

  it('仅开启写时间轴时只生成专注记录', () => {
    const result = buildHabitCompletion({
      habit: habit({ logToTimeline: true, timerMinutes: 10 }),
      now,
      ...ids,
    });

    expect(result.task).toBeUndefined();
    expect(result.focus?.actualSeconds).toBe(600);
    expect(result.log.generatedTaskId).toBeUndefined();
    expect(result.log.generatedFocusId).toBe('f1');
  });

  it('时间块回填到打卡前 N 分钟', () => {
    const result = buildHabitCompletion({
      habit: habit({ logToTimeline: true, timerMinutes: 15 }),
      now,
      ...ids,
    });
    expect(result.focus?.startedAt).toBe(new Date(2026, 8, 7, 20, 45).toISOString());
  });

  it('未配置时长时默认 15 分钟', () => {
    const result = buildHabitCompletion({
      habit: habit({ logToTimeline: true }),
      now,
      ...ids,
    });
    expect(result.focus?.plannedSeconds).toBe(15 * 60);
  });

  it('传入真实计时秒数时按实际时长记录并带分类', () => {
    const result = buildHabitCompletion({
      habit: habit({ mode: 'task', categoryId: 'cat_study' }),
      now,
      ...ids,
      elapsedSeconds: 37 * 60,
    });

    expect(result.focus?.actualSeconds).toBe(37 * 60);
    expect(result.focus?.startedAt).toBe(new Date(2026, 8, 7, 20, 23).toISOString());
    expect(result.task?.categoryId).toBe('cat_study');
    expect(result.task?.estimateMinutes).toBe(37);
  });

  it('小时单位保留小数，并记录本次时间段', () => {
    const result = buildHabitCompletion({
      habit: habit({ mode: 'task', unit: '小时', logToTimeline: true }),
      now,
      ...ids,
      value: 0.02,
      unit: '小时',
      minutes: 1,
      elapsedSeconds: 60,
    });

    expect(result.log.value).toBe(0.02);
    expect(result.log.unit).toBe('小时');
    expect(result.log.minutes).toBe(1);
    expect(result.log.startedAt).toBe(new Date(2026, 8, 7, 20, 59).toISOString());
    expect(result.log.recordedAt).toBe(now.toISOString());
    expect(result.focus?.actualSeconds).toBe(60);
  });
});