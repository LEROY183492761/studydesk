// @vitest-environment jsdom
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, describe, expect, it } from 'vitest';
import { FocusPage } from '@/features/focus/FocusPage';
import { useAppStore } from '@/state/appStore';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

async function settle(ms = 80) {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

describe('专注页冒烟', () => {
  afterEach(() => {
    document.body.innerHTML = '';
    window.localStorage.clear();
  });

  it('开始计时后进入暂停状态', async () => {
    await act(async () => {
      await useAppStore.getState().init();
    });

    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);

    await act(async () => {
      root.render(<FocusPage />);
      await settle();
    });

    expect(container.textContent).toContain('25:00');

    const startButton = [...container.querySelectorAll('button')].find((button) =>
      button.textContent?.includes('开始'),
    );
    expect(startButton).toBeTruthy();

    await act(async () => {
      startButton?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      await new Promise((resolve) => setTimeout(resolve, 1200));
    });

    const pauseButton = [...container.querySelectorAll('button')].find((button) =>
      button.textContent?.includes('暂停'),
    );
    expect(pauseButton).toBeTruthy();

    await act(async () => {
      root.unmount();
    });
  });
});