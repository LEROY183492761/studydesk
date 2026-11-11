import { toISODateTime } from '@/lib/dates';
import type { CalendarItem, Timetable } from '../models';
import { isSessionActiveInWeek, sessionTimeRange, teachingWeekOf } from '../rules/weeks';

export function buildCourseItems(timetable: Timetable, date: Date): CalendarItem[] {
  const week = teachingWeekOf(date, timetable.meta.termStartDate);
  if (week <= 0) return [];

  const jsWeekday = date.getDay() === 0 ? 7 : date.getDay();

  return timetable.sessions
    .filter((session) => session.weekday === jsWeekday && isSessionActiveInWeek(session, week))
    .flatMap((session) => {
      const course = timetable.courses.find((item) => item.id === session.courseId);
      const range = sessionTimeRange(session, date);
      if (!course || !range) return [];

      return [
        {
          id: `course_${session.id}_w${week}`,
          source: 'course' as const,
          title: course.name,
          start: toISODateTime(range.start),
          end: toISODateTime(range.end),
          allDay: false,
          readonly: true,
          color: course.color,
          location: session.location,
          sourceId: course.id,
        },
      ];
    })
    .sort((a, b) => a.start.localeCompare(b.start));
}