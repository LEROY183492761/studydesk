// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import { useAppStore } from '@/state/appStore';

describe('目标与倒数日 store', () => {
  afterEach(() => {
    window.localStorage.clear();
  });

  it('目标可新增、更新进度、标记完成与删除', async () => {
    await useAppStore.getState().init();

    const goal = await useAppStore.getState().addGoal({
      title: '期末绩点 3.7',
      targetDate: '2027-01-15',
    });
    expect(goal).toBeTruthy();
    expect(useAppStore.getState().goals.some((item) => item.id === goal!.id)).toBe(true);

    await useAppStore.getState().updateGoal(goal!.id, { progress: 150 });
    expect(useAppStore.getState().goals.find((item) => item.id === goal!.id)?.progress).toBe(100);

    await useAppStore.getState().updateGoal(goal!.id, { progress: 50, status: 'done' });
    const done = useAppStore.getState().goals.find((item) => item.id === goal!.id);
    expect(done).toMatchObject({ status: 'done', progress: 100 });
    expect(done?.completedAt).toBeTruthy();

    await useAppStore.getState().removeGoal(goal!.id);
    expect(useAppStore.getState().goals.some((item) => item.id === goal!.id)).toBe(false);
  });

  it('倒数日可新增与删除', async () => {
    await useAppStore.getState().init();

    const item = await useAppStore.getState().addCountdown({
      title: '期末考试',
      date: '2027-01-10',
      yearly: false,
    });
    expect(item).toBeTruthy();
    expect(useAppStore.getState().countdowns.some((entry) => entry.id === item!.id)).toBe(true);

    await useAppStore.getState().removeCountdown(item!.id);
    expect(useAppStore.getState().countdowns.some((entry) => entry.id === item!.id)).toBe(false);
  });
});