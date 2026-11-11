// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import { useAppStore } from '@/state/appStore';

describe('普通日程编辑', () => {
  afterEach(() => {
    window.localStorage.clear();
  });

  it('可修改标题、开始/结束时间与地点', async () => {
    await useAppStore.getState().init();

    await useAppStore.getState().addEvent({
      title: '自习',
      start: new Date(2026, 8, 7, 9, 0),
      minutes: 60,
      location: '图书馆',
    });

    const event = useAppStore.getState().events.find((item) => item.title === '自习');
    expect(event).toBeTruthy();

    await useAppStore.getState().updateEvent(event!.id, {
      title: '深度学习',
      start: new Date(2026, 8, 7, 14, 0),
      end: new Date(2026, 8, 7, 16, 0),
      location: '教三',
    });

    const updated = useAppStore.getState().events.find((item) => item.id === event!.id);
    expect(updated).toMatchObject({ title: '深度学习', location: '教三' });
    expect(new Date(updated!.start).getHours()).toBe(14);
    expect(new Date(updated!.end).getHours()).toBe(16);
  });
});
describe('DDL 双写', () => {
  afterEach(() => {
    window.localStorage.clear();
  });

  it('创建 DDL 时同时写入事件与待办', async () => {
    await useAppStore.getState().init();

    const event = await useAppStore.getState().addDeadline({
      title: '数据结构作业',
      dueAt: new Date(2026, 8, 10, 23, 0),
    });

    expect(event).toBeTruthy();
    expect(useAppStore.getState().events.some((item) => item.id === event!.id)).toBe(true);
    expect(
      useAppStore.getState().tasks.some((task) => task.linkedEventId === event!.id),
    ).toBe(true);
  });
});