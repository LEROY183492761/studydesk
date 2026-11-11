// @vitest-environment jsdom
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it } from 'vitest';
import { CalendarPage } from '@/features/calendar/CalendarPage';
import { TimelinePage } from '@/features/timeline/TimelinePage';
import { useAppStore } from '@/state/appStore';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

async function settle(ms = 60) {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

describe('M1 页面冒烟', () => {
  afterEach(() => {
    document.body.innerHTML = '';
    window.localStorage.clear();
  });

  it('日历页渲染课程与教学周', async () => {
    const container = document.createElement('div');
    document.body.appendChild(container);

    await act(async () => {
      await useAppStore.getState().init();
    });

    const root = createRoot(container);
    await act(async () => {
      root.render(
        <MemoryRouter initialEntries={['/calendar']}>
          <CalendarPage />
        </MemoryRouter>,
      );
      await settle();
    });

    expect(container.textContent).toContain('教学周');
    expect(container.textContent).toContain('今天');
    expect(container.textContent).toContain('待排期');

    await act(async () => {
      root.unmount();
    });
  });

  it('时间轴页渲染计划层与实际层', async () => {
    const container = document.createElement('div');
    document.body.appendChild(container);

    await act(async () => {
      await useAppStore.getState().init();
    });

    const root = createRoot(container);
    await act(async () => {
      root.render(
        <MemoryRouter initialEntries={['/timeline']}>
          <TimelinePage />
        </MemoryRouter>,
      );
      await settle();
    });

    expect(container.textContent).toContain('计划层');
    expect(container.textContent).toContain('实际层');

    await act(async () => {
      root.unmount();
    });
  });
});