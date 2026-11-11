import { Fragment, useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { addDays, format, startOfWeek } from 'date-fns';
import clsx from 'clsx';
import type { Course, CourseSession, WeekParity } from '@/domain/models';
import { DEFAULT_PERIOD_TIMES } from '@/domain/models';
import { isSessionActiveInWeek, teachingWeekOf } from '@/domain/rules/weeks';
import { createId } from '@/lib/ids';
import { useAppStore } from '@/state/appStore';
import { BUPT_SAMPLE_TASKS, BUPT_SAMPLE_TIMETABLE } from './sample';

const WEEKDAYS = ['周一', '周二', '周三', '周四', '周五', '周六', '周日'];
const COURSE_COLORS = [
  'var(--color-course-1)',
  'var(--color-course-2)',
  'var(--color-course-3)',
  'var(--color-course-4)',
  'var(--color-course-5)',
  'var(--color-course-6)',
];

export function TimetablePage() {
  const timetable = useAppStore((state) => state.timetable);
  const saveTimetable = useAppStore((state) => state.saveTimetable);
  const addTask = useAppStore((state) => state.addTask);

  const [semester, setSemester] = useState(`${new Date().getFullYear()} 秋`);
  const [termStart, setTermStart] = useState(() =>
    format(startOfWeek(new Date(), { weekStartsOn: 1 }), 'yyyy-MM-dd'),
  );
  const [totalWeeks, setTotalWeeks] = useState(20);

  const [viewWeek, setViewWeek] = useState(1);
  const [notice, setNotice] = useState<string | null>(null);
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const handle = window.setInterval(() => setNow(new Date()), 30_000);
    return () => window.clearInterval(handle);
  }, []);

  const [courseName, setCourseName] = useState('');
  const [courseTeacher, setCourseTeacher] = useState('');
  const [courseColor, setCourseColor] = useState(COURSE_COLORS[0]);

  const [sessionCourseId, setSessionCourseId] = useState('');
  const [sessionWeekday, setSessionWeekday] = useState<CourseSession['weekday']>(1);
  const [startPeriod, setStartPeriod] = useState(1);
  const [endPeriod, setEndPeriod] = useState(2);
  const [parity, setParity] = useState<WeekParity>('all');
  const [weeksFrom, setWeeksFrom] = useState(1);
  const [weeksTo, setWeeksTo] = useState(16);
  const [sessionLocation, setSessionLocation] = useState('');

  async function handleCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await saveTimetable({
      meta: { semester: semester.trim() || '未命名学期', termStartDate: termStart, totalWeeks },
      courses: [],
      sessions: [],
    });
    setNotice('课表已创建，可以添加课程与安排了');
  }

  async function handleAddCourse(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!timetable) return;
    const name = courseName.trim();
    if (!name) return;

    const course: Course = {
      id: createId('course'),
      name,
      teacher: courseTeacher.trim() || undefined,
      color: courseColor,
    };
    await saveTimetable({ ...timetable, courses: [...timetable.courses, course] });
    setCourseName('');
    setCourseTeacher('');
    setSessionCourseId(course.id);
    setNotice(`已添加课程「${name}」`);
  }

  async function handleAddSession(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!timetable || !sessionCourseId) return;

    const from = Math.min(weeksFrom, weeksTo);
    const to = Math.max(weeksFrom, weeksTo);
    const weeks = Array.from({ length: Math.max(0, to - from + 1) }, (_, index) => from + index);
    const session: CourseSession = {
      id: createId('session'),
      courseId: sessionCourseId,
      weekday: sessionWeekday,
      startPeriod,
      endPeriod: Math.max(startPeriod, endPeriod),
      weeks,
      parity,
      location: sessionLocation.trim() || undefined,
    };
    await saveTimetable({ ...timetable, sessions: [...timetable.sessions, session] });
    setSessionLocation('');
    setNotice('已添加课程安排');
  }

  async function handleRemoveSession(id: string) {
    if (!timetable) return;
    await saveTimetable({
      ...timetable,
      sessions: timetable.sessions.filter((session) => session.id !== id),
    });
    setNotice('已删除课程安排');
  }

  async function handleImportSample() {
    if (!window.confirm('将用 BUPT 示例课表覆盖当前课表，并追加一组示例待办，继续？')) return;

    await saveTimetable(BUPT_SAMPLE_TIMETABLE);
    for (const item of BUPT_SAMPLE_TASKS) {
      await addTask({
        title: item.title,
        importance: item.importance,
        priority: item.priority,
        dueAt:
          item.dueInDays === null
            ? undefined
            : addDays(new Date(), item.dueInDays).toISOString(),
      });
    }
    setNotice('已导入 BUPT 示例课表与四象限待办');
  }

  if (!timetable) {
    return (
      <div className="page timetable-page">
        <header className="page-header">
          <div>
            <p className="muted">先创建学期，再手动维护课程</p>
            <h1>课表</h1>
          </div>
        </header>

        {notice ? (
          <div className="notice-bar" role="status">
            <span>{notice}</span>
            <button type="button" className="ghost-button" onClick={() => setNotice(null)}>
              关闭
            </button>
          </div>
        ) : null}

        <form className="surface-card timetable-setup" onSubmit={handleCreate}>
          <input
            value={semester}
            onChange={(event) => setSemester(event.target.value)}
            placeholder="学期，例如 2026 秋"
            aria-label="学期"
            required
          />
          <input
            type="date"
            value={termStart}
            onChange={(event) => setTermStart(event.target.value)}
            aria-label="开学日期"
          />
          <label className="habit-duration">
            <input
              type="number"
              min={1}
              max={30}
              value={totalWeeks}
              onChange={(event) => setTotalWeeks(Number(event.target.value))}
              aria-label="总周数"
            />
            <span>周</span>
          </label>
          <button type="submit" className="primary-button">
            创建课表
          </button>
        </form>
      </div>
    );
  }

  const currentWeek = Math.max(1, teachingWeekOf(now, timetable.meta.termStartDate));
  const activeSessions = timetable.sessions.filter((session) =>
    isSessionActiveInWeek(session, viewWeek),
  );
  const showNowLine = viewWeek === currentWeek;
  const jsWeekday = now.getDay() === 0 ? 7 : now.getDay();
  const nowTop = (() => {
    const minutes = now.getHours() * 60 + now.getMinutes();
    for (let index = 0; index < DEFAULT_PERIOD_TIMES.length; index += 1) {
      const [startHour, startMinute] = DEFAULT_PERIOD_TIMES[index].start.split(':').map(Number);
      const [endHour, endMinute] = DEFAULT_PERIOD_TIMES[index].end.split(':').map(Number);
      const start = startHour * 60 + startMinute;
      const end = endHour * 60 + endMinute;
      if (minutes >= start && minutes <= end) {
        return (index + (minutes - start) / (end - start)) * 52;
      }
      if (minutes < start) {
        return index * 52;
      }
    }
    return null;
  })();

  function courseOf(session: CourseSession): Course | undefined {
    return timetable?.courses.find((course) => course.id === session.courseId);
  }

  return (
    <div className="page timetable-page">
      <header className="page-header">
        <div>
          <p className="muted">
            {timetable.meta.semester} · 开学 {timetable.meta.termStartDate} · 共{' '}
            {timetable.meta.totalWeeks} 周
          </p>
          <h1>课表</h1>
        </div>
        <div className="timetable-toolbar">
          <button
            type="button"
            className="ghost-button"
            onClick={() => setViewWeek(Math.max(1, viewWeek - 1))}
          >
            上一周
          </button>
          <span className="header-badge">
            第 {viewWeek} 周 / 共 {timetable.meta.totalWeeks} 周
          </span>
          <button
            type="button"
            className="ghost-button"
            onClick={() => setViewWeek(Math.min(timetable.meta.totalWeeks, viewWeek + 1))}
          >
            下一周
          </button>
          <button type="button" className="ghost-button" onClick={() => setViewWeek(currentWeek)}>
            本周（第 {currentWeek} 周）
          </button>
          <button type="button" className="ghost-button" onClick={() => void handleImportSample()}>
            导入 BUPT 示例
          </button>
        </div>
      </header>

      {notice ? (
        <div className="notice-bar" role="status">
          <span>{notice}</span>
          <button type="button" className="ghost-button" onClick={() => setNotice(null)}>
            关闭
          </button>
        </div>
      ) : null}

      <section className="surface-card panel">
        <div className="timetable-grid" role="grid" aria-label="周课表">
          <div className="timetable-corner" />
          {WEEKDAYS.map((label, index) => (
            <div
              key={label}
              className={clsx(
                'timetable-weekday',
                showNowLine && index + 1 === jsWeekday && 'is-today',
              )}
            >
              {label}
            </div>
          ))}

          {DEFAULT_PERIOD_TIMES.map((time) => (
            <Fragment key={time.period}>
              <div className="timetable-period">
                <strong>第{time.period}节</strong>
                <span>
                  {time.start}-{time.end}
                </span>
              </div>
              {WEEKDAYS.map((_, dayIndex) => (
                <div
                  key={`${dayIndex + 1}-${time.period}`}
                  className={clsx(
                    'timetable-cell',
                    showNowLine && dayIndex + 1 === jsWeekday && 'is-today',
                  )}
                  style={{ gridColumn: dayIndex + 2, gridRow: time.period + 1 }}
                />
              ))}
            </Fragment>
          ))}

          {activeSessions.map((session) => {
            const course = courseOf(session);
            if (!course) return null;
            return (
              <div
                key={session.id}
                className={clsx('timetable-block')}
                style={{
                  gridColumn: session.weekday + 1,
                  gridRow: `${session.startPeriod + 1} / ${session.endPeriod + 2}`,
                  background: course.color ?? 'var(--color-primary)',
                }}
                title={`${course.name}${session.location ? ` · ${session.location}` : ''}`}
              >
                <strong>{course.name}</strong>
                {session.location ? <span>{session.location}</span> : null}
              </div>
            );
          })}

          {showNowLine && nowTop !== null ? (
            <div
              className="timetable-now"
              style={{ top: `${52 + nowTop}px` }}
              aria-hidden="true"
            >
              <span>{format(now, 'HH:mm')}</span>
            </div>
          ) : null}
        </div>

        <div className="timetable-legend">
          {timetable.courses.map((course) => (
            <span key={course.id} className="timetable-legend-item">
              <span className="habit-dot" style={{ background: course.color }} />
              {course.name}
              {course.teacher ? ` · ${course.teacher}` : ''}
            </span>
          ))}
        </div>
      </section>

      <div className="timetable-forms">
        <form className="surface-card timetable-form" onSubmit={handleAddCourse}>
          <div className="panel-head">
            <h2 className="section-title">添加课程</h2>
          </div>
          <input
            value={courseName}
            onChange={(event) => setCourseName(event.target.value)}
            placeholder="课程名称"
            aria-label="课程名称"
            required
          />
          <input
            value={courseTeacher}
            onChange={(event) => setCourseTeacher(event.target.value)}
            placeholder="教师（可选）"
            aria-label="教师"
          />
          <div className="color-picker" role="group" aria-label="课程颜色">
            {COURSE_COLORS.map((value) => (
              <button
                key={value}
                type="button"
                className={clsx('color-dot', courseColor === value && 'is-active')}
                style={{ background: value }}
                aria-label={`课程颜色 ${value}`}
                onClick={() => setCourseColor(value)}
              />
            ))}
          </div>
          <button type="submit" className="primary-button">
            添加课程
          </button>
        </form>

        <form className="surface-card timetable-form" onSubmit={handleAddSession}>
          <div className="panel-head">
            <h2 className="section-title">添加安排</h2>
          </div>
          <select
            value={sessionCourseId}
            onChange={(event) => setSessionCourseId(event.target.value)}
            aria-label="课程"
            required
          >
            <option value="">选择课程</option>
            {timetable.courses.map((course) => (
              <option key={course.id} value={course.id}>
                {course.name}
              </option>
            ))}
          </select>
          <select
            value={sessionWeekday}
            onChange={(event) =>
              setSessionWeekday(Number(event.target.value) as CourseSession['weekday'])
            }
            aria-label="星期"
          >
            {WEEKDAYS.map((label, index) => (
              <option key={label} value={index + 1}>
                {label}
              </option>
            ))}
          </select>
          <label className="habit-duration">
            <select
              value={startPeriod}
              onChange={(event) => setStartPeriod(Number(event.target.value))}
              aria-label="开始节次"
            >
              {DEFAULT_PERIOD_TIMES.map((time) => (
                <option key={time.period} value={time.period}>
                  {time.period}
                </option>
              ))}
            </select>
            <span>到</span>
            <select
              value={endPeriod}
              onChange={(event) => setEndPeriod(Number(event.target.value))}
              aria-label="结束节次"
            >
              {DEFAULT_PERIOD_TIMES.map((time) => (
                <option key={time.period} value={time.period}>
                  {time.period}
                </option>
              ))}
            </select>
          </label>
          <select
            value={parity}
            onChange={(event) => setParity(event.target.value as WeekParity)}
            aria-label="单双周"
          >
            <option value="all">每周</option>
            <option value="odd">单周</option>
            <option value="even">双周</option>
          </select>
          <label className="habit-duration">
            <input
              type="number"
              min={1}
              max={timetable.meta.totalWeeks}
              value={weeksFrom}
              onChange={(event) => setWeeksFrom(Number(event.target.value))}
              aria-label="起始周"
            />
            <span>至</span>
            <input
              type="number"
              min={1}
              max={timetable.meta.totalWeeks}
              value={weeksTo}
              onChange={(event) => setWeeksTo(Number(event.target.value))}
              aria-label="结束周"
            />
            <span>周</span>
          </label>
          <input
            value={sessionLocation}
            onChange={(event) => setSessionLocation(event.target.value)}
            placeholder="地点（可选）"
            aria-label="地点"
          />
          <button type="submit" className="primary-button">
            添加安排
          </button>
        </form>
      </div>

      <section className="surface-card panel">
        <div className="panel-head">
          <h2 className="section-title">本周课程安排</h2>
          <span className="muted">{activeSessions.length} 项</span>
        </div>
        {activeSessions.length === 0 ? (
          <p className="empty-hint">这一周还没有课程，先添加课程与安排。</p>
        ) : (
          <ul className="timetable-session-list">
            {activeSessions.map((session) => {
              const course = courseOf(session);
              return (
                <li key={session.id}>
                  <span>
                    {WEEKDAYS[session.weekday - 1]} · 第 {session.startPeriod}–{session.endPeriod} 节
                    {' · '}
                    {course?.name ?? '未知课程'}
                    {session.location ? ` · ${session.location}` : ''}
                    {session.parity === 'all' ? '' : session.parity === 'odd' ? ' · 单周' : ' · 双周'}
                  </span>
                  <button
                    type="button"
                    className="ghost-button"
                    onClick={() => void handleRemoveSession(session.id)}
                  >
                    删除
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}