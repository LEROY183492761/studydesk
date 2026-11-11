import { useMemo, useState } from 'react';
import type { FormEvent } from 'react';
import clsx from 'clsx';
import { Link } from 'react-router-dom';
import { CALENDAR_SOURCE_LABEL } from '@/domain/models';
import { buildTodayOverview } from '@/domain/selectors/today';
import { countdownDays, countdownLabel, sortCountdowns } from '@/domain/rules/goals';
import { buildCourseItems } from '@/domain/selectors/timetable';
import { formatDateLabel, formatTimeLabel, todayISODate, WEEKDAY_LABELS } from '@/lib/dates';
import { useAppStore } from '@/state/appStore';

export function TodayPage() {
  const [now] = useState(() => new Date());
  const [draft, setDraft] = useState('');
  const tasks = useAppStore((state) => state.tasks);
  const notes = useAppStore((state) => state.notes);
  const countdowns = useAppStore((state) => state.countdowns);
  const focusSessions = useAppStore((state) => state.focusSessions);
  const timetable = useAppStore((state) => state.timetable);
  const toggleTask = useAppStore((state) => state.toggleTask);
  const addNote = useAppStore((state) => state.addNote);

  const date = todayISODate(now);

  const items = useMemo(
    () => (timetable ? buildCourseItems(timetable, now) : []),
    [timetable, now],
  );

  const overview = useMemo(
    () =>
      buildTodayOverview({
        now,
        date,
        termStartDate: timetable?.meta.termStartDate ?? date,
        items,
        tasks,
        habitLogs: [],
        focusSessions,
        habitTotal: 0,
      }),
    [now, date, timetable, items, tasks, focusSessions],
  );

  const upcomingCountdowns = useMemo(
    () =>
      sortCountdowns(countdowns, now)
        .filter((item) => countdownDays(item, now) >= 0)
        .slice(0, 3),
    [countdowns, now],
  );

  async function handleNoteSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await addNote(draft);
    setDraft('');
  }

  return (
    <div className="page today-page">
      <header className="page-header">
        <div>
          <p className="muted">
            {formatDateLabel(now, 'yyyy 年 M 月 d 日')} · {WEEKDAY_LABELS[now.getDay()]}
          </p>
          <h1>今天</h1>
        </div>
        <div className="header-badge">
          教学周 {overview.teachingWeek > 0 ? overview.teachingWeek : '—'}
        </div>
      </header>

      <div className="today-grid">
        <section className="surface-card panel">
          <div className="panel-head">
            <h2 className="section-title">今日课程</h2>
            <span className="muted">{overview.items.length} 项</span>
          </div>
          {overview.items.length === 0 ? (
            <p className="empty-hint">今天没有课程，适合安排一段深度专注。</p>
          ) : (
            <ul className="course-list">
              {overview.items.map((item) => (
                <li key={item.id} className="course-row">
                  <span className="course-time">
                    {formatTimeLabel(item.start)} – {formatTimeLabel(item.end)}
                  </span>
                  <span className="course-dot" style={{ background: item.color }} />
                  <div className="course-main">
                    <strong>{item.title}</strong>
                    <span className="muted">
                      {CALENDAR_SOURCE_LABEL[item.source]}
                      {item.location ? ` · ${item.location}` : ''}
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="surface-card panel">
          <div className="panel-head">
            <h2 className="section-title">待办</h2>
            <Link className="text-link" to="/tasks">
              全部
            </Link>
          </div>
          {overview.openTasks.length === 0 ? (
            <p className="empty-hint">待办已清空，保持这个节奏。</p>
          ) : (
            <ul className="task-list">
              {overview.openTasks.slice(0, 5).map((task) => (
                <li key={task.id} className="task-row">
                  <button
                    type="button"
                    className="task-check"
                    aria-label={`完成 ${task.title}`}
                    onClick={() => void toggleTask(task.id)}
                  />
                  <div className="task-main">
                    <span>{task.title}</span>
                    <span className="muted task-meta">
                      {task.dueAt ? formatTimeLabel(task.dueAt) : '无截止时间'}
                      {task.priority === 'urgent' ? ' · 紧急' : ''}
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          )}
          {overview.doneTasks.length > 0 ? (
            <p className="panel-foot muted">今天已完成 {overview.doneTasks.length} 项</p>
          ) : null}
        </section>

        <section className="surface-card panel focus-card">
          <div className="panel-head">
            <h2 className="section-title">专注</h2>
            <Link className="text-link" to="/focus">
              进入
            </Link>
          </div>
          <p className="metric-value">{overview.focusMinutes}</p>
          <p className="muted">今日专注分钟</p>
          <div className="focus-heat">
            {[0, 1, 2, 3, 4, 5, 6].map((index) => (
              <span
                key={index}
                className={clsx('heat-cell', index < Math.min(7, Math.round(overview.focusMinutes / 30)) && 'is-on')}
              />
            ))}
          </div>
        </section>

        <section className="surface-card panel note-panel">
          <div className="panel-head">
            <h2 className="section-title">随想</h2>
            <Link className="text-link" to="/notes">
              全部
            </Link>
          </div>
          <form className="note-form" onSubmit={handleNoteSubmit}>
            <textarea
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              placeholder="记一句闪念，Enter 保存，Shift + Enter 换行"
              rows={3}
              onKeyDown={(event) => {
                if (event.key === 'Enter' && !event.shiftKey) {
                  event.preventDefault();
                  event.currentTarget.form?.requestSubmit();
                }
              }}
            />
            <button type="submit" className="primary-button">
              保存
            </button>
          </form>
          {notes.slice(0, 2).map((note) => (
            <p key={note.id} className="note-preview">
              {note.content}
            </p>
          ))}
        </section>

        <section className="surface-card panel countdown-panel">
          <div className="panel-head">
            <h2 className="section-title">倒数日</h2>
            <Link className="text-link" to="/goals">
              全部
            </Link>
          </div>
          {upcomingCountdowns.length === 0 ? (
            <p className="empty-hint">还没有倒数日。</p>
          ) : (
            <ul className="countdown-mini-list">
              {upcomingCountdowns.map((item) => {
                const days = countdownDays(item, now);
                return (
                  <li key={item.id}>
                    <span className="countdown-mini-days">
                      {days === 0 ? '今天' : Math.abs(days)}
                      {days === 0 ? null : <small>天</small>}
                    </span>
                    <div className="countdown-mini-main">
                      <strong>{item.title}</strong>
                      <span className="muted">
                        {countdownLabel(days)}
                        {item.remindAt ? ` · 提醒 ${item.remindAt}` : ''}
                      </span>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}