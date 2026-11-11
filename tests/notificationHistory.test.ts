// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import {
  appendReminderHistory,
  clearReminderHistory,
  readReminderHistory,
} from '@/domain/rules/notificationHistory';

describe('提醒历史', () => {
  afterEach(() => {
    window.localStorage.clear();
  });

  it('按时间倒序追加并限制最多 20 条', () => {
    appendReminderHistory({
      id: '1',
      title: '课前提醒',
      body: '10 分钟后开始',
      at: '2026-11-11T00:00:00.000Z',
    });
    appendReminderHistory({
      id: '2',
      title: '习惯提醒',
      body: '该打卡了',
      at: '2026-11-11T00:01:00.000Z',
    });

    expect(readReminderHistory().map((item) => item.title)).toEqual(['习惯提醒', '课前提醒']);

    for (let index = 0; index < 25; index += 1) {
      appendReminderHistory({
        id: `x${index}`,
        title: `X${index}`,
        body: '',
        at: '2026-11-11T00:02:00.000Z',
      });
    }
    expect(readReminderHistory()).toHaveLength(20);
  });

  it('可清空历史', () => {
    appendReminderHistory({
      id: '1',
      title: 'A',
      body: '',
      at: '2026-11-11T00:00:00.000Z',
    });
    clearReminderHistory();
    expect(readReminderHistory()).toHaveLength(0);
  });
});