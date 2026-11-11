import { describe, expect, it } from 'vitest';
import {
  cycleLabel,
  normalizePlan,
  phaseAfterFocus,
  totalPlannedMinutes,
} from '@/domain/rules/pomodoro';

const fallback = { focusMinutes: 25, breakMinutes: 5 };

describe('番茄计划', () => {
  it('任务未配置时继承全局设置', () => {
    const plan = normalizePlan({}, fallback);
    expect(plan).toEqual({
      timerMode: 'none',
      focusMinutes: 25,
      breakMinutes: 5,
      cyclesPlanned: 1,
    });
  });

  it('任务配置覆盖全局，并保证最小值', () => {
    const plan = normalizePlan(
      { timerMode: 'countdown', focusMinutes: 0, breakMinutes: 0, cyclesPlanned: 0 },
      fallback,
    );
    expect(plan.focusMinutes).toBe(1);
    expect(plan.breakMinutes).toBe(1);
    expect(plan.cyclesPlanned).toBe(1);
  });

  it('完成轮次后进入休息或结束', () => {
    const plan = normalizePlan(
      { timerMode: 'countdown', focusMinutes: 25, breakMinutes: 5, cyclesPlanned: 3 },
      fallback,
    );
    expect(phaseAfterFocus(1, plan)).toBe('break');
    expect(phaseAfterFocus(2, plan)).toBe('break');
    expect(phaseAfterFocus(3, plan)).toBe('done');
  });

  it('预计总时长包含轮间休息', () => {
    const plan = normalizePlan(
      { timerMode: 'countdown', focusMinutes: 25, breakMinutes: 5, cyclesPlanned: 4 },
      fallback,
    );
    expect(totalPlannedMinutes(plan)).toBe(115);
  });

  it('正计时与不计时没有预计总时长', () => {
    expect(totalPlannedMinutes(normalizePlan({ timerMode: 'stopwatch' }, fallback))).toBe(0);
    expect(totalPlannedMinutes(normalizePlan({ timerMode: 'none' }, fallback))).toBe(0);
  });

  it('轮次标签不超过总数', () => {
    expect(cycleLabel(0, 4)).toBe('第 1/4 轮');
    expect(cycleLabel(3, 4)).toBe('第 4/4 轮');
    expect(cycleLabel(4, 4)).toBe('第 4/4 轮');
  });
});