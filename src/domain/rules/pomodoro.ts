import type { TimerMode } from '../models';

export interface PomodoroPlan {
  timerMode: TimerMode;
  focusMinutes: number;
  breakMinutes: number;
  cyclesPlanned: number;
}

export interface PlanFallback {
  focusMinutes: number;
  breakMinutes: number;
}

/** 任务未填写时继承全局设置，并保证边界有效 */
export function normalizePlan(
  input: Partial<PomodoroPlan>,
  fallback: PlanFallback,
): PomodoroPlan {
  return {
    timerMode: input.timerMode ?? 'none',
    focusMinutes: Math.max(1, input.focusMinutes ?? fallback.focusMinutes),
    breakMinutes: Math.max(1, input.breakMinutes ?? fallback.breakMinutes),
    cyclesPlanned: Math.max(1, input.cyclesPlanned ?? 1),
  };
}

export function phaseAfterFocus(completedCycles: number, plan: PomodoroPlan): 'break' | 'done' {
  return completedCycles < plan.cyclesPlanned ? 'break' : 'done';
}

/** 倒计时模式的预计总时长（含轮间休息）；其他模式返回 0 */
export function totalPlannedMinutes(plan: PomodoroPlan): number {
  if (plan.timerMode !== 'countdown') return 0;
  const focus = plan.focusMinutes * plan.cyclesPlanned;
  const breaks = plan.breakMinutes * Math.max(0, plan.cyclesPlanned - 1);
  return focus + breaks;
}

export function cycleLabel(completed: number, total: number): string {
  return `第 ${Math.min(completed + 1, total)}/${total} 轮`;
}