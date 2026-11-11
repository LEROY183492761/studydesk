// @vitest-environment jsdom
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, describe, expect, it } from 'vitest';
import { App } from '@/app/App';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

describe('应用冒烟', () => {
  afterEach(() => {
    document.body.innerHTML = '';
    window.localStorage.clear();
  });

  it('初始化后渲染今日页与主导航', async () => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);

    await act(async () => {
      root.render(<App />);
      await new Promise((resolve) => setTimeout(resolve, 80));
    });

    const text = container.textContent ?? '';
    expect(text).toContain('今天');
    expect(text).toContain('待办');
    expect(text).toContain('专注');

    await act(async () => {
      root.unmount();
    });
  });
});