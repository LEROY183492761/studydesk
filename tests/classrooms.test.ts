import { describe, expect, it } from 'vitest';
import { freePeriodsForDate, matchClassroomSlots } from '@/domain/selectors/classrooms';
import { BUPT_SAMPLE_TIMETABLE } from '@/features/timetable/sample';
import type { ClassroomSlot } from '@/domain/models';

const monday = new Date(2026, 10, 9, 12, 0);

function slot(overrides: Partial<ClassroomSlot> = {}): ClassroomSlot {
  return {
    id: 'room-1',
    building: '教三',
    room: '201',
    campus: '本部',
    date: '2026-11-09',
    startPeriod: 1,
    endPeriod: 5,
    ...overrides,
  };
}

describe('空教室与空闲节次', () => {
  it('按当天课程计算空闲节次', () => {
    const free = freePeriodsForDate(BUPT_SAMPLE_TIMETABLE, monday);
    expect(free).toContain(1);
    expect(free).toContain(5);
    expect(free).not.toContain(2);
    expect(free).not.toContain(3);
    expect(free).not.toContain(4);
    expect(free).not.toContain(6);
    expect(free).not.toContain(7);
    expect(free).not.toContain(8);
  });

  it('只返回与空闲节次有交集的教室，并按覆盖数排序', () => {
    const free = freePeriodsForDate(BUPT_SAMPLE_TIMETABLE, monday);
    const matches = matchClassroomSlots(
      [
        slot({ id: 'a', room: '201', startPeriod: 1, endPeriod: 5 }),
        slot({ id: 'b', room: '202', startPeriod: 6, endPeriod: 8 }),
        slot({ id: 'c', room: '305', startPeriod: 9, endPeriod: 14 }),
      ],
      monday,
      free,
    );

    expect(matches.map((match) => match.slot.id)).toEqual(['c', 'a']);
    expect(matches[0].matchedPeriods).toEqual([9, 10, 11, 12, 13, 14]);
    expect(matches[1].matchedPeriods).toEqual([1, 5]);
  });
});