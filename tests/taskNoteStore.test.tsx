// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import { useAppStore } from '@/state/appStore';

describe('任务编辑与随想标签', () => {
  afterEach(() => {
    window.localStorage.clear();
  });

  it('可编辑任务标题、截止、优先级、预估与备注', async () => {
    await useAppStore.getState().init();

    const task = await useAppStore.getState().addTask({ title: '旧任务' });
    expect(task).toBeTruthy();

    await useAppStore.getState().updateTask(task!.id, {
      title: '新任务',
      dueAt: '2026-12-01T10:00:00.000Z',
      priority: 'high',
      estimateMinutes: 90,
      note: '备注',
    });

    const updated = useAppStore.getState().tasks.find((item) => item.id === task!.id);
    expect(updated).toMatchObject({
      title: '新任务',
      priority: 'high',
      estimateMinutes: 90,
      note: '备注',
      dueAt: '2026-12-01T10:00:00.000Z',
    });
  });

  it('随想可更新标签', async () => {
    await useAppStore.getState().init();

    const note = await useAppStore.getState().addNote('测试随想');
    expect(note).toBeTruthy();

    await useAppStore.getState().updateNote(note!.id, { tags: ['学习', '期末'] });
    expect(useAppStore.getState().notes.find((item) => item.id === note!.id)?.tags).toEqual([
      '学习',
      '期末',
    ]);
  });
});