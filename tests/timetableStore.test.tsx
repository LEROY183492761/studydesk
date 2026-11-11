// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import { BUPT_SAMPLE_TASKS, BUPT_SAMPLE_TIMETABLE } from '@/features/timetable/sample';
import { useAppStore } from '@/state/appStore';

describe('课表保存', () => {
  afterEach(() => {
    window.localStorage.clear();
  });

  it('可创建并保存课表、课程与课程安排', async () => {
    await useAppStore.getState().init();

    await useAppStore.getState().saveTimetable({
      meta: { semester: '2026 秋', termStartDate: '2026-09-07', totalWeeks: 20 },
      courses: [{ id: 'c1', name: '高等数学', teacher: '张老师', color: '#123456' }],
      sessions: [
        {
          id: 's1',
          courseId: 'c1',
          weekday: 1,
          startPeriod: 1,
          endPeriod: 2,
          weeks: [1, 2, 3],
          parity: 'all',
          location: 'N112',
        },
      ],
    });

    const timetable = useAppStore.getState().timetable;
    expect(timetable?.meta.semester).toBe('2026 秋');
    expect(timetable?.courses).toHaveLength(1);
    expect(timetable?.sessions).toHaveLength(1);
    expect(timetable?.sessions[0].location).toBe('N112');
  });

  it('BUPT 示例数据完整且节次合法', () => {
    expect(BUPT_SAMPLE_TIMETABLE.courses.length).toBeGreaterThan(0);
    expect(BUPT_SAMPLE_TIMETABLE.sessions.length).toBeGreaterThan(0);

    for (const session of BUPT_SAMPLE_TIMETABLE.sessions) {
      expect(session.startPeriod).toBeGreaterThanOrEqual(1);
      expect(session.endPeriod).toBeLessThanOrEqual(14);
      expect(session.startPeriod).toBeLessThanOrEqual(session.endPeriod);
    }

    expect(BUPT_SAMPLE_TASKS.length).toBeGreaterThan(0);
  });
});