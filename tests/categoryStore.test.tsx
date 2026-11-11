// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import { useAppStore } from '@/state/appStore';

describe('分类管理与任务分类', () => {
  afterEach(() => {
    window.localStorage.clear();
  });

  it('新增分类去重、改名去重、任务可改分类', async () => {
    await useAppStore.getState().init();
    const before = useAppStore.getState().categories.length;

    await useAppStore.getState().addCategory({ name: '物理', color: '#123456' });
    expect(useAppStore.getState().categories).toHaveLength(before + 1);

    await useAppStore.getState().addCategory({ name: '物理', color: '#000' });
    expect(useAppStore.getState().categories.filter((item) => item.name === '物理')).toHaveLength(1);

    const physics = useAppStore.getState().categories.find((item) => item.name === '物理');
    expect(physics).toBeTruthy();

    const renamed = await useAppStore.getState().updateCategory(physics!.id, {
      name: '大学物理',
    });
    expect(renamed).toBe(true);
    expect(useAppStore.getState().categories.find((item) => item.id === physics!.id)?.name).toBe(
      '大学物理',
    );

    const duplicated = await useAppStore.getState().updateCategory(physics!.id, { name: '学习' });
    expect(duplicated).toBe(false);

    await useAppStore.getState().addTask({ title: '测分类任务' });
    const task = useAppStore.getState().tasks.find((item) => item.title === '测分类任务');
    expect(task).toBeTruthy();

    await useAppStore.getState().setTaskCategory(task!.id, physics!.id);
    expect(useAppStore.getState().tasks.find((item) => item.id === task!.id)?.categoryId).toBe(
      physics!.id,
    );

    await useAppStore.getState().setTaskCategory(task!.id, undefined);
    expect(
      useAppStore.getState().tasks.find((item) => item.id === task!.id)?.categoryId,
    ).toBeUndefined();
  });
});