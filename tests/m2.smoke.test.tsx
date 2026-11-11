// @vitest-environment jsdom
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it } from 'vitest';
import { HabitsPage } from '@/features/habits/HabitsPage';
import { NotesPage } from '@/features/notes/NotesPage';
import { ReviewPage } from '@/features/review/ReviewPage';
import { useAppStore } from '@/state/appStore';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

async function settle(ms = 80) {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

async function renderPage(element: React.ReactNode, container: HTMLElement) {
  const root = createRoot(container);
  await act(async () => {
    root.render(<MemoryRouter initialEntries={['/']}>{element}</MemoryRouter>);
    await settle();
  });
  return root;
}

describe('M2 页面冒烟', () => {
  afterEach(() => {
    document.body.innerHTML = '';
    window.localStorage.clear();
  });

  it('习惯页渲染种子习惯与今日打卡', async () => {
    await act(async () => {
      await useAppStore.getState().init();
    });

    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = await renderPage(<HabitsPage />, container);

    expect(container.textContent).toContain('习惯');
    expect(container.textContent).toContain('阅读 30 分钟');
    expect(container.textContent).toContain('打卡');

    await act(async () => {
      root.unmount();
    });
  });

  it('随想页渲染种子随想', async () => {
    await act(async () => {
      await useAppStore.getState().init();
    });

    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = await renderPage(<NotesPage />, container);

    expect(container.textContent).toContain('随想');
    expect(container.textContent).toContain('实验报告');

    await act(async () => {
      root.unmount();
    });
  });

  it('复盘页渲染指标与保存入口', async () => {
    await act(async () => {
      await useAppStore.getState().init();
    });

    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = await renderPage(<ReviewPage />, container);

    expect(container.textContent).toContain('复盘');
    expect(container.textContent).toContain('自动指标');
    expect(container.textContent).toContain('专注分布');
    expect(container.textContent).toContain('学习热力图');
    expect(container.textContent).toContain('保存复盘');

    await act(async () => {
      root.unmount();
    });
  });
});