// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import { format } from 'date-fns';
import { useAppStore } from '@/state/appStore';

describe('习惯打卡任务化', () => {
  afterEach(() => {
    window.localStorage.clear();
  });

  it('任务化打卡生成任务与时间块，取消后级联删除', async () => {
    await useAppStore.getState().init();
    const date = format(new Date(), 'yyyy-MM-dd');

    await useAppStore.getState().addHabit({
      name: '测试习惯',
      color: '#000',
      frequency: { type: 'daily' },
      mode: 'task',
      timerMinutes: 10,
      logToTimeline: true,
    });

    const habit = useAppStore.getState().habits.find((item) => item.name === '测试习惯');
    expect(habit).toBeTruthy();

    const beforeTasks = useAppStore.getState().tasks.length;
    const beforeFocus = useAppStore.getState().focusSessions.length;

    await useAppStore.getState().toggleHabit(habit!.id, date);

    const tasks = useAppStore.getState().tasks;
    const focus = useAppStore.getState().focusSessions;

    expect(tasks).toHaveLength(beforeTasks + 1);
    expect(tasks.some((task) => task.source === 'habit' && task.status === 'done')).toBe(true);
    expect(focus).toHaveLength(beforeFocus + 1);
    expect(focus.some((session) => session.note?.startsWith('习惯：测试习惯'))).toBe(true);

    await useAppStore.getState().toggleHabit(habit!.id, date);

    expect(useAppStore.getState().tasks).toHaveLength(beforeTasks);
    expect(useAppStore.getState().focusSessions).toHaveLength(beforeFocus);
  });

  it('轻量打卡不生成任务与时间块', async () => {
    await useAppStore.getState().init();
    const date = format(new Date(), 'yyyy-MM-dd');

    await useAppStore.getState().addHabit({
      name: '轻量习惯',
      color: '#000',
      frequency: { type: 'daily' },
      mode: 'light',
    });

    const habit = useAppStore.getState().habits.find((item) => item.name === '轻量习惯');
    const beforeTasks = useAppStore.getState().tasks.length;
    const beforeFocus = useAppStore.getState().focusSessions.length;

    await useAppStore.getState().toggleHabit(habit!.id, date);

    expect(useAppStore.getState().tasks).toHaveLength(beforeTasks);
    expect(useAppStore.getState().focusSessions).toHaveLength(beforeFocus);
  });

  it('可编辑习惯的名称、频率、模式、分类与提醒时间', async () => {
    await useAppStore.getState().init();

    await useAppStore.getState().addHabit({
      name: '旧习惯',
      color: '#000',
      frequency: { type: 'daily' },
      mode: 'light',
    });

    const habit = useAppStore.getState().habits.find((item) => item.name === '旧习惯');
    expect(habit).toBeTruthy();

    await useAppStore.getState().updateHabit(habit!.id, {
      name: '新习惯',
      frequency: { type: 'weekly', timesPerWeek: 4 },
      mode: 'task',
      timerMinutes: 30,
      categoryId: 'cat_test',
      remindAt: '07:30',
      logToTimeline: true,
    });

    const updated = useAppStore.getState().habits.find((item) => item.id === habit!.id);
    expect(updated).toMatchObject({
      name: '新习惯',
      frequency: { type: 'weekly', timesPerWeek: 4 },
      mode: 'task',
      timerMinutes: 30,
      categoryId: 'cat_test',
      remindAt: '07:30',
      logToTimeline: true,
    });
  });
});
describe('习惯多次打卡与目标绑定', () => {
  afterEach(() => {
    window.localStorage.clear();
  });

  it('同一天可多次打卡并单条删除', async () => {
    await useAppStore.getState().init();
    const date = format(new Date(), 'yyyy-MM-dd');

    await useAppStore.getState().addHabit({
      name: '俯卧撑',
      color: '#000',
      frequency: { type: 'daily' },
      unit: '个',
      dailyTarget: 100,
    });

    const habit = useAppStore.getState().habits.find((item) => item.name === '俯卧撑');
    expect(habit).toBeTruthy();

    await useAppStore.getState().addHabitLog(habit!.id, date, 20, '个');
    await useAppStore.getState().addHabitLog(habit!.id, date, 30, '个');

    const logs = useAppStore.getState().habitLogs.filter((log) => log.habitId === habit!.id);
    expect(logs).toHaveLength(2);
    expect(logs.reduce((sum, log) => sum + log.value, 0)).toBe(50);

    await useAppStore.getState().removeHabitLog(logs[0].id);
    expect(
      useAppStore.getState().habitLogs.filter((log) => log.habitId === habit!.id),
    ).toHaveLength(1);
  });

  it('创建绑定习惯的目标时自动开启自动进度', async () => {
    await useAppStore.getState().init();

    const goal = await useAppStore.getState().addGoal({
      title: '跑步 100 次',
      habitId: 'h1',
      targetAmount: 100,
    });

    expect(goal?.habitId).toBe('h1');
    expect(goal?.targetAmount).toBe(100);
    expect(goal?.autoProgress).toBe(true);
  });

  it('小时单位计时打卡保留小数，不会放大为 1 小时', async () => {
    await useAppStore.getState().init();
    const date = format(new Date(), 'yyyy-MM-dd');

    await useAppStore.getState().addHabit({
      name: '睡觉',
      color: '#000',
      frequency: { type: 'daily' },
      mode: 'task',
      unit: '小时',
      dailyTarget: 8,
    });

    const habit = useAppStore.getState().habits.find((item) => item.name === '睡觉');
    expect(habit).toBeTruthy();

    await useAppStore.getState().addHabitLog(habit!.id, date, 0.02, '小时', 1, 60);

    const log = useAppStore.getState().habitLogs.find((item) => item.habitId === habit!.id);
    expect(log?.value).toBe(0.02);
    expect(log?.unit).toBe('小时');
    expect(log?.minutes).toBe(1);
    expect(log?.startedAt).toBeTruthy();
  });
});