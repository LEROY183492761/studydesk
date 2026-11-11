import { useMemo, useState } from 'react';
import type { FormEvent } from 'react';
import { addDays, addMonths, format, parseISO } from 'date-fns';
import clsx from 'clsx';
import { Link } from 'react-router-dom';
import { CALENDAR_SOURCE_LABEL } from '@/domain/models';
import type { CalendarItem, EventRecurrence, ScheduleEvent } from '@/domain/models';
import {
  buildCalendarItems,
  dayRange,
  itemsOnDay,
  monthGridDays,
  monthRange,
  weekDays,
  weekRange,
} from '@/domain/selectors/calendar';
import { formatDateLabel, formatTimeLabel, WEEKDAY_LABELS } from '@/lib/dates';
import { teachingWeekOf } from '@/domain/rules/weeks';
import { useAppStore } from '@/state/appStore';
import { MonthGrid } from './MonthGrid';
import { TimeGrid } from './TimeGrid';

type ViewMode = 'day' | 'week' | 'month';

const VIEWS: Array<{ id: ViewMode; label: string }> = [
  { id: 'day', label: '日' },
  { id: 'week', label: '周' },
  { id: 'month', label: '月' },
];

const REPEAT_LABEL = {
  none: '不重复',
  daily: '每日',
  weekly: '每周',
  monthly: '每月',
} as const;

export function CalendarPage() {
  const [view, setView] = useState<ViewMode>('week');
  const [anchor, setAnchor] = useState(() => new Date());
  const [selected, setSelected] = useState(() => new Date());
  const [formOpen, setFormOpen] = useState(false);
  const [entryKind, setEntryKind] = useState<'event' | 'deadline'>('event');
  const [title, setTitle] = useState('');
  const [startTime, setStartTime] = useState('09:00');
  const [dueAt, setDueAt] = useState(() => format(new Date(), "yyyy-MM-dd'T'HH:mm"));
  const [endTime, setEndTime] = useState('10:00');
  const [timeMode, setTimeMode] = useState<'duration' | 'end'>('duration');
  const [minutes, setMinutes] = useState(60);
  const [location, setLocation] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const [dropNotice, setDropNotice] = useState<string | null>(null);

  const [repeatMode, setRepeatMode] = useState<'none' | 'daily' | 'weekly' | 'monthly'>('none');
  const [repeatWeekdays, setRepeatWeekdays] = useState<number[]>([new Date().getDay()]);
  const [monthlyMode, setMonthlyMode] = useState<'day' | 'nth'>('day');
  const [monthlyDay, setMonthlyDay] = useState(() => new Date().getDate());
  const [nthWeek, setNthWeek] = useState(1);
  const [nthWeekday, setNthWeekday] = useState(() => new Date().getDay());
  const [repeatEnd, setRepeatEnd] = useState<'never' | 'until' | 'count'>('never');
  const [repeatUntil, setRepeatUntil] = useState(() =>
    format(addMonths(new Date(), 3), 'yyyy-MM-dd'),
  );
  const [repeatCount, setRepeatCount] = useState(10);
  const [courseLike, setCourseLike] = useState(false);
  const [editingEventId, setEditingEventId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editDueAt, setEditDueAt] = useState('');
  const [editStart, setEditStart] = useState('');
  const [editEnd, setEditEnd] = useState('');
  const [editLocation, setEditLocation] = useState('');
  const [editRepeatMode, setEditRepeatMode] = useState<
    'none' | 'daily' | 'weekly' | 'monthly'
  >('none');
  const [editRepeatInterval, setEditRepeatInterval] = useState(1);
  const [editRepeatWeekdays, setEditRepeatWeekdays] = useState<number[]>([]);
  const [editRepeatEnd, setEditRepeatEnd] = useState<'never' | 'until' | 'count'>('never');
  const [editRepeatUntil, setEditRepeatUntil] = useState('');
  const [editRepeatCount, setEditRepeatCount] = useState(10);
  const [overridingKey, setOverridingKey] = useState<string | null>(null);
  const [overrideStart, setOverrideStart] = useState('');
  const [overrideEnd, setOverrideEnd] = useState('');

  const settings = useAppStore((state) => state.settings);
  const tasks = useAppStore((state) => state.tasks);
  const events = useAppStore((state) => state.events);
  const timetable = useAppStore((state) => state.timetable);
  const addEvent = useAppStore((state) => state.addEvent);
  const addDeadline = useAppStore((state) => state.addDeadline);
  const removeEvent = useAppStore((state) => state.removeEvent);
  const removeTask = useAppStore((state) => state.removeTask);
  const skipEventOccurrence = useAppStore((state) => state.skipEventOccurrence);
  const scheduleTask = useAppStore((state) => state.scheduleTask);
  const updateEvent = useAppStore((state) => state.updateEvent);
  const overrideEventOccurrence = useAppStore((state) => state.overrideEventOccurrence);

  const weekStartsOn = settings.weekStartsOn;

  const days = useMemo(() => {
    if (view === 'day') return [anchor];
    if (view === 'week') return weekDays(anchor, weekStartsOn);
    return monthGridDays(anchor, weekStartsOn);
  }, [view, anchor, weekStartsOn]);

  const items = useMemo(() => {
    const range =
      view === 'day'
        ? dayRange(anchor)
        : view === 'week'
          ? weekRange(anchor, weekStartsOn)
          : monthRange(anchor, weekStartsOn);
    return buildCalendarItems({ timetable, events, tasks, range });
  }, [view, anchor, weekStartsOn, timetable, events, tasks]);

  const selectedItems = useMemo(() => itemsOnDay(items, selected), [items, selected]);
  const teachingWeek =
    timetable && selected
      ? teachingWeekOf(selected, timetable.meta.termStartDate)
      : 0;

  const unscheduled = tasks
    .filter((task) => !task.scheduledStart && task.status !== 'done' && task.status !== 'archived')
    .slice(0, 6);

  function navigate(delta: number) {
    const next =
      view === 'day'
        ? addDays(anchor, delta)
        : view === 'week'
          ? addDays(anchor, delta * 7)
          : addMonths(anchor, delta);
    setAnchor(next);
    setSelected(next);
  }

  function goToday() {
    const now = new Date();
    setAnchor(now);
    setSelected(now);
  }

  function changeView(next: ViewMode) {
    setView(next);
    if (next === 'day') setAnchor(selected);
  }

  async function handleDropTask(taskId: string, day: Date, start: Date) {
    await scheduleTask(taskId, start, 60);
    setDropNotice(`已排期到 ${formatDateLabel(day, 'M 月 d 日')} ${format(start, 'HH:mm')}`);
  }

  function buildRepeat(): EventRecurrence | null {
    if (entryKind === 'deadline' || repeatMode === 'none') return null;

    const rule: EventRecurrence = { frequency: repeatMode, interval: 1 };
    if (repeatMode === 'weekly') {
      rule.byWeekday = repeatWeekdays.length ? repeatWeekdays : [selected.getDay()];
    }
    if (repeatMode === 'monthly') {
      if (monthlyMode === 'day') {
        rule.byMonthDay = monthlyDay;
      } else {
        rule.byWeekday = [nthWeekday];
        rule.bySetPos = nthWeek;
      }
    }
    if (repeatEnd === 'until') rule.until = repeatUntil;
    if (repeatEnd === 'count') rule.count = Math.max(1, repeatCount);
    return rule;
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (entryKind === 'deadline') {
      const due = new Date(dueAt);
      if (Number.isNaN(due.getTime())) {
        setFormError('请选择有效的截止时间');
        return;
      }
      await addDeadline({ title, dueAt: due, location: location || undefined });
      setFormError(null);
      setTitle('');
      setLocation('');
      setFormOpen(false);
      return;
    }

    const [startHour, startMinute] = startTime.split(':').map(Number);
    const start = new Date(selected);
    start.setHours(startHour, startMinute, 0, 0);

    let duration = minutes;
    if (timeMode === 'end') {
      const [endHour, endMinute] = endTime.split(':').map(Number);
      const end = new Date(selected);
      end.setHours(endHour, endMinute, 0, 0);
      duration = Math.round((end.getTime() - start.getTime()) / 60_000);
    }

    if (duration < 5) {
      setFormError('结束时间需晚于开始时间');
      return;
    }

    await addEvent({
      title,
      start,
      minutes: duration,
      location: location || undefined,
      repeat: buildRepeat(),
      courseLike: repeatMode !== 'none' ? courseLike : undefined,
    });
    setFormError(null);
    setTitle('');
    setLocation('');
    setFormOpen(false);
  }

  async function handleRemoveEvent(eventId: string) {
    const target = events.find((item) => item.id === eventId);
    const linkedTaskId = target?.linkedTaskId;
    const alsoTask = linkedTaskId ? window.confirm('该 DDL 关联一条待办，是否同时删除？') : false;
    if (alsoTask && linkedTaskId) {
      await removeTask(linkedTaskId);
    }
    await removeEvent(eventId);
  }

  function startEditEvent(event: ScheduleEvent) {
    setEditingEventId(event.id);
    setEditTitle(event.title);
    setEditDueAt(format(parseISO(event.start), "yyyy-MM-dd'T'HH:mm"));
    setEditStart(format(parseISO(event.start), "yyyy-MM-dd'T'HH:mm"));
    setEditEnd(format(parseISO(event.end), "yyyy-MM-dd'T'HH:mm"));
    setEditLocation(event.location ?? '');

    const repeat = event.repeat;
    setEditRepeatMode(repeat?.frequency ?? 'none');
    setEditRepeatInterval(repeat?.interval ?? 1);
    setEditRepeatWeekdays(repeat?.byWeekday ?? [parseISO(event.start).getDay()]);
    setEditRepeatEnd(repeat?.until ? 'until' : repeat?.count ? 'count' : 'never');
    setEditRepeatUntil(repeat?.until ?? format(addMonths(new Date(), 3), 'yyyy-MM-dd'));
    setEditRepeatCount(repeat?.count ?? 10);
  }

  async function handleEditEvent(submit: FormEvent<HTMLFormElement>) {
    submit.preventDefault();
    if (!editingEventId) return;

    const target = events.find((event) => event.id === editingEventId);
    if (!target) return;

    if (target.kind === 'deadline') {
      const due = new Date(editDueAt);
      if (Number.isNaN(due.getTime())) {
        setFormError('请选择有效的截止时间');
        return;
      }
      await updateEvent(editingEventId, { title: editTitle, start: due, end: due });
      setEditingEventId(null);
      setDropNotice('DDL 已更新，关联待办同步');
      return;
    }

    const start = new Date(editStart);
    const end = new Date(editEnd);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
      setFormError('请选择有效的开始与结束时间');
      return;
    }
    if (end.getTime() <= start.getTime()) {
      setFormError('结束时间需晚于开始时间');
      return;
    }

    let repeat = target.repeat ?? null;
    if (target.repeat) {
      if (editRepeatMode === 'none') {
        repeat = null;
      } else {
        const rule: EventRecurrence = {
          frequency: editRepeatMode,
          interval: Math.max(1, editRepeatInterval),
        };
        if (editRepeatMode === 'weekly') {
          rule.byWeekday = editRepeatWeekdays.length
            ? editRepeatWeekdays
            : [start.getDay()];
        }
        if (editRepeatMode === 'monthly') {
          if (target.repeat?.byMonthDay !== undefined) {
            rule.byMonthDay = target.repeat.byMonthDay;
          } else {
            rule.byWeekday = target.repeat?.byWeekday ?? [start.getDay()];
            rule.bySetPos = target.repeat?.bySetPos ?? 1;
          }
        }
        if (editRepeatEnd === 'until') rule.until = editRepeatUntil;
        if (editRepeatEnd === 'count') rule.count = Math.max(1, editRepeatCount);
        repeat = rule;
      }
    }

    await updateEvent(editingEventId, {
      title: editTitle,
      start,
      end,
      location: editLocation,
      repeat,
    });
    setEditingEventId(null);
    setDropNotice(target.repeat ? '循环日程已更新（影响所有实例）' : '日程已更新');
  }

  async function handleDropTaskToDay(day: Date, taskId: string) {
    const hour = settings.monthDropHour;
    const minutes = settings.monthDropMinutes;
    const start = new Date(day);
    start.setHours(hour, 0, 0, 0);
    await scheduleTask(taskId, start, minutes);
    setDropNotice(
      `已排期到 ${formatDateLabel(day, 'M 月 d 日')} ${String(hour).padStart(2, '0')}:00（${minutes} 分钟）`,
    );
  }

  async function handleMoveItem(item: CalendarItem, day: Date, start: Date) {
    const minutes = Math.max(
      15,
      Math.round((parseISO(item.end).getTime() - parseISO(item.start).getTime()) / 60_000),
    );
    const when = `${formatDateLabel(day, 'M 月 d 日')} ${format(start, 'HH:mm')}`;

    if (item.source === 'task' && item.sourceId) {
      await scheduleTask(item.sourceId, start, minutes);
      setDropNotice(`任务已移动到 ${when}`);
      return;
    }

    if (item.source === 'event' && item.sourceId) {
      const sourceEvent = events.find((event) => event.id === item.sourceId);
      if (!sourceEvent) return;

      const end = new Date(start.getTime() + minutes * 60_000);
      if (sourceEvent.repeat) {
        await overrideEventOccurrence(
          sourceEvent.id,
          format(parseISO(item.start), 'yyyy-MM-dd'),
          start,
          end,
        );
        setDropNotice(`已修改本次日程到 ${when}`);
        return;
      }

      await updateEvent(sourceEvent.id, { start, end });
      setDropNotice(
        sourceEvent.kind === 'deadline'
          ? `DDL 已移动到 ${when}，关联待办同步`
          : `日程已移动到 ${when}`,
      );
    }
  }

  function toggleEditWeekday(index: number) {
    setEditRepeatWeekdays((current) =>
      current.includes(index) ? current.filter((item) => item !== index) : [...current, index],
    );
  }

  function openOverride(eventId: string, date: string, item: CalendarItem) {
    const sourceEvent = events.find((event) => event.id === eventId);
    const existing = sourceEvent?.overrides?.[date];
    setOverridingKey(`${eventId}:${date}`);
    setOverrideStart(format(parseISO(existing?.start ?? item.start), "yyyy-MM-dd'T'HH:mm"));
    setOverrideEnd(format(parseISO(existing?.end ?? item.end), "yyyy-MM-dd'T'HH:mm"));
  }

  async function handleOverride(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!overridingKey) return;

    const [eventId, date] = overridingKey.split(':');
    const start = new Date(overrideStart);
    const end = new Date(overrideEnd);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
      setFormError('请选择有效的开始与结束时间');
      return;
    }
    if (end.getTime() <= start.getTime()) {
      setFormError('结束时间需晚于开始时间');
      return;
    }

    await overrideEventOccurrence(eventId, date, start, end);
    setOverridingKey(null);
    setDropNotice('已修改本次日程');
  }

  const heading =
    view === 'day'
      ? formatDateLabel(anchor, 'yyyy 年 M 月 d 日')
      : view === 'week'
        ? `${formatDateLabel(days[0], 'M 月 d 日')} – ${formatDateLabel(days[6], 'M 月 d 日')}`
        : formatDateLabel(anchor, 'yyyy 年 M 月');

  return (
    <div className="page calendar-page">
      <header className="page-header">
        <div>
          <p className="muted">
            {WEEKDAY_LABELS[selected.getDay()]}
            {teachingWeek > 0 ? ` · 教学周 ${teachingWeek}` : ''}
          </p>
          <h1>{heading}</h1>
        </div>
        <div className="calendar-tools">
          <div className="segmented" role="group" aria-label="日历视图">
            {VIEWS.map((item) => (
              <button
                key={item.id}
                type="button"
                className={clsx(view === item.id && 'is-active')}
                aria-pressed={view === item.id}
                onClick={() => changeView(item.id)}
              >
                {item.label}
              </button>
            ))}
          </div>
          <div className="calendar-nav">
            <button type="button" className="ghost-button" onClick={() => navigate(-1)} aria-label="上一页">
              ‹
            </button>
            <button type="button" className="ghost-button" onClick={goToday}>
              今天
            </button>
            <button type="button" className="ghost-button" onClick={() => navigate(1)} aria-label="下一页">
              ›
            </button>
          </div>
        </div>
      </header>

      <div className="calendar-layout">
        <section className="surface-card calendar-main">
          {view === 'month' ? (
            <MonthGrid
              days={days}
              month={anchor}
              items={items}
              selected={selected}
              onSelect={setSelected}
              onDropTask={handleDropTaskToDay}
            />
          ) : (
            <TimeGrid
              days={days}
              items={items}
              selectedDay={selected}
              onSelectDay={setSelected}
              onDropTask={handleDropTask}
              onMoveItem={handleMoveItem}
            />
          )}
        </section>

        <aside className="surface-card panel calendar-side">
          <div className="panel-head">
            <h2 className="section-title">{formatDateLabel(selected, 'M 月 d 日')}</h2>
            <span className="muted">{selectedItems.length} 项</span>
          </div>

          {selectedItems.length === 0 ? (
            <p className="empty-hint">这一天还没有安排。</p>
          ) : (
            <ul className="day-items">
              {selectedItems.map((item) => {
                const sourceEvent =
                  item.source === 'event' && item.sourceId
                    ? events.find((event) => event.id === item.sourceId)
                    : undefined;

                return (
                  <li key={item.id}>
                    <span className="day-item-time">{formatTimeLabel(item.start)}</span>
                    <div className="day-item-main">
                      <strong>{item.title}</strong>
                      <span className="muted">
                        {item.kind === 'deadline' ? 'DDL' : CALENDAR_SOURCE_LABEL[item.source]}
                        {item.location ? ` · ${item.location}` : ''}
                        {item.completed ? ' · 已完成' : ''}
                      </span>
                    </div>
                    {sourceEvent ? (
                      <button
                        type="button"
                        className="ghost-button"
                        onClick={() => startEditEvent(sourceEvent)}
                      >
                        {sourceEvent.kind === 'deadline' ? '改期' : '编辑'}
                      </button>
                    ) : null}
                    {sourceEvent?.repeat ? (
                      <>
                        <button
                          type="button"
                          className="ghost-button"
                          onClick={() =>
                            void skipEventOccurrence(
                              sourceEvent.id,
                              format(parseISO(item.start), 'yyyy-MM-dd'),
                            )
                          }
                        >
                          跳过本次
                        </button>
                        <button
                          type="button"
                          className="ghost-button"
                          onClick={() =>
                            openOverride(
                              sourceEvent.id,
                              format(parseISO(item.start), 'yyyy-MM-dd'),
                              item,
                            )
                          }
                        >
                          改本次
                        </button>
                      </>
                    ) : null}
                    {item.source === 'event' && item.sourceId ? (
                      <button
                        type="button"
                        className="ghost-button"
                        onClick={() => void handleRemoveEvent(item.sourceId as string)}
                      >
                        删除
                      </button>
                    ) : null}
                    {editingEventId === sourceEvent?.id ? (
                      <form className="event-edit-form" onSubmit={handleEditEvent}>
                        <input
                          value={editTitle}
                          onChange={(event) => setEditTitle(event.target.value)}
                          aria-label="日程标题"
                          required
                        />
                        {sourceEvent.kind === 'deadline' ? (
                          <input
                            type="datetime-local"
                            value={editDueAt}
                            onChange={(event) => setEditDueAt(event.target.value)}
                            aria-label="DDL 截止时间"
                          />
                        ) : (
                          <>
                            <input
                              type="datetime-local"
                              value={editStart}
                              onChange={(event) => setEditStart(event.target.value)}
                              aria-label="开始时间"
                            />
                            <input
                              type="datetime-local"
                              value={editEnd}
                              onChange={(event) => setEditEnd(event.target.value)}
                              aria-label="结束时间"
                            />
                            <input
                              value={editLocation}
                              onChange={(event) => setEditLocation(event.target.value)}
                              placeholder="地点（可选）"
                              aria-label="地点"
                            />
                          </>
                        )}
                        {sourceEvent.repeat ? (
                          <div className="event-edit-repeat">
                            <select
                              value={editRepeatMode}
                              onChange={(event) =>
                                setEditRepeatMode(
                                  event.target.value as 'none' | 'daily' | 'weekly' | 'monthly',
                                )
                              }
                              aria-label="循环频率"
                            >
                              <option value="none">不重复</option>
                              <option value="daily">每天</option>
                              <option value="weekly">每周</option>
                              <option value="monthly">每月</option>
                            </select>
                            {editRepeatMode !== 'none' ? (
                              <input
                                type="number"
                                min={1}
                                value={editRepeatInterval}
                                onChange={(event) =>
                                  setEditRepeatInterval(Number(event.target.value))
                                }
                                aria-label="循环间隔"
                              />
                            ) : null}
                            {editRepeatMode === 'weekly' ? (
                              <div className="weekday-picker">
                                {WEEKDAY_LABELS.map((label, index) => (
                                  <button
                                    key={label}
                                    type="button"
                                    className={`weekday-chip${
                                      editRepeatWeekdays.includes(index) ? ' is-active' : ''
                                    }`}
                                    aria-pressed={editRepeatWeekdays.includes(index)}
                                    onClick={() => toggleEditWeekday(index)}
                                  >
                                    {label.replace('周', '')}
                                  </button>
                                ))}
                              </div>
                            ) : null}
                            {editRepeatMode !== 'none' ? (
                              <>
                                <select
                                  value={editRepeatEnd}
                                  onChange={(event) =>
                                    setEditRepeatEnd(
                                      event.target.value as 'never' | 'until' | 'count',
                                    )
                                  }
                                  aria-label="循环结束条件"
                                >
                                  <option value="never">永不结束</option>
                                  <option value="until">到某日</option>
                                  <option value="count">共 N 次</option>
                                </select>
                                {editRepeatEnd === 'until' ? (
                                  <input
                                    type="date"
                                    value={editRepeatUntil}
                                    onChange={(event) => setEditRepeatUntil(event.target.value)}
                                    aria-label="循环结束日期"
                                  />
                                ) : null}
                                {editRepeatEnd === 'count' ? (
                                  <input
                                    type="number"
                                    min={1}
                                    value={editRepeatCount}
                                    onChange={(event) =>
                                      setEditRepeatCount(Number(event.target.value))
                                    }
                                    aria-label="循环次数"
                                  />
                                ) : null}
                              </>
                            ) : null}
                          </div>
                        ) : null}
                        <button type="submit" className="primary-button">
                          保存
                        </button>
                        <button
                          type="button"
                          className="ghost-button"
                          onClick={() => setEditingEventId(null)}
                        >
                          取消
                        </button>
                      </form>
                    ) : null}
                    {overridingKey ===
                    `${sourceEvent?.id}:${format(parseISO(item.start), 'yyyy-MM-dd')}` ? (
                      <form className="event-edit-form" onSubmit={handleOverride}>
                        <input
                          type="datetime-local"
                          value={overrideStart}
                          onChange={(event) => setOverrideStart(event.target.value)}
                          aria-label="本次开始时间"
                        />
                        <input
                          type="datetime-local"
                          value={overrideEnd}
                          onChange={(event) => setOverrideEnd(event.target.value)}
                          aria-label="本次结束时间"
                        />
                        <button type="submit" className="primary-button">
                          保存本次
                        </button>
                        <button
                          type="button"
                          className="ghost-button"
                          onClick={() => setOverridingKey(null)}
                        >
                          取消
                        </button>
                      </form>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          )}

          {formOpen ? (
            <form className="event-form" onSubmit={handleSubmit}>
              <div className="segmented entry-kind" role="group" aria-label="类型">
                <button
                  type="button"
                  className={clsx(entryKind === 'event' && 'is-active')}
                  aria-pressed={entryKind === 'event'}
                  onClick={() => setEntryKind('event')}
                >
                  日程
                </button>
                <button
                  type="button"
                  className={clsx(entryKind === 'deadline' && 'is-active')}
                  aria-pressed={entryKind === 'deadline'}
                  onClick={() => setEntryKind('deadline')}
                >
                  DDL
                </button>
              </div>

              <input
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                placeholder={entryKind === 'deadline' ? 'DDL 标题，例如：提交实验报告' : '日程标题'}
                aria-label="标题"
                required
              />

              {entryKind === 'event' ? (
                <div className="event-form-row">
                  <input
                    type="time"
                    value={startTime}
                    onChange={(event) => setStartTime(event.target.value)}
                    aria-label="开始时间"
                  />
                  <div className="segmented time-mode" role="group" aria-label="时间输入方式">
                    <button
                      type="button"
                      className={clsx(timeMode === 'duration' && 'is-active')}
                      aria-pressed={timeMode === 'duration'}
                      onClick={() => setTimeMode('duration')}
                    >
                      时长
                    </button>
                    <button
                      type="button"
                      className={clsx(timeMode === 'end' && 'is-active')}
                      aria-pressed={timeMode === 'end'}
                      onClick={() => setTimeMode('end')}
                    >
                      结束
                    </button>
                  </div>
                  {timeMode === 'duration' ? (
                    <select
                      value={minutes}
                      onChange={(event) => setMinutes(Number(event.target.value))}
                      aria-label="时长"
                    >
                      {[15, 30, 45, 60, 90, 120].map((value) => (
                        <option key={value} value={value}>
                          {value} 分钟
                        </option>
                      ))}
                    </select>
                  ) : (
                    <input
                      type="time"
                      value={endTime}
                      onChange={(event) => setEndTime(event.target.value)}
                      aria-label="结束时间"
                    />
                  )}
                </div>
              ) : (
                <input
                  type="datetime-local"
                  value={dueAt}
                  onChange={(event) => setDueAt(event.target.value)}
                  aria-label="截止时间"
                />
              )}

              {entryKind === 'event' ? (
                <div className="repeat-panel">
                  <div className="segmented repeat-mode" role="group" aria-label="重复">
                    {(['none', 'daily', 'weekly', 'monthly'] as const).map((value) => (
                      <button
                        key={value}
                        type="button"
                        className={clsx(repeatMode === value && 'is-active')}
                        aria-pressed={repeatMode === value}
                        onClick={() => setRepeatMode(value)}
                      >
                        {REPEAT_LABEL[value]}
                      </button>
                    ))}
                  </div>

                  {repeatMode === 'weekly' ? (
                    <div className="weekday-picker" role="group" aria-label="星期">
                      {WEEKDAY_LABELS.map((label, index) => (
                        <button
                          key={label}
                          type="button"
                          className={clsx(repeatWeekdays.includes(index) && 'is-active')}
                          aria-pressed={repeatWeekdays.includes(index)}
                          onClick={() =>
                            setRepeatWeekdays((current) =>
                              current.includes(index)
                                ? current.filter((value) => value !== index)
                                : [...current, index],
                            )
                          }
                        >
                          {label.replace('周', '')}
                        </button>
                      ))}
                    </div>
                  ) : null}

                  {repeatMode === 'monthly' ? (
                    <div className="event-form-row">
                      <select
                        value={monthlyMode}
                        onChange={(event) =>
                          setMonthlyMode(event.target.value as 'day' | 'nth')
                        }
                        aria-label="每月方式"
                      >
                        <option value="day">每月某日</option>
                        <option value="nth">每月第几个周几</option>
                      </select>
                      {monthlyMode === 'day' ? (
                        <input
                          type="number"
                          min={1}
                          max={31}
                          value={monthlyDay}
                          onChange={(event) => setMonthlyDay(Number(event.target.value))}
                          aria-label="每月日"
                        />
                      ) : (
                        <>
                          <select
                            value={nthWeek}
                            onChange={(event) => setNthWeek(Number(event.target.value))}
                            aria-label="第几个"
                          >
                            {[1, 2, 3, 4, -1].map((value) => (
                              <option key={value} value={value}>
                                {value === -1 ? '最后一个' : `第 ${value} 个`}
                              </option>
                            ))}
                          </select>
                          <select
                            value={nthWeekday}
                            onChange={(event) => setNthWeekday(Number(event.target.value))}
                            aria-label="星期"
                          >
                            {WEEKDAY_LABELS.map((label, index) => (
                              <option key={label} value={index}>
                                {label}
                              </option>
                            ))}
                          </select>
                        </>
                      )}
                    </div>
                  ) : null}

                  {repeatMode !== 'none' ? (
                    <div className="event-form-row">
                      <select
                        value={repeatEnd}
                        onChange={(event) =>
                          setRepeatEnd(event.target.value as 'never' | 'until' | 'count')
                        }
                        aria-label="结束条件"
                      >
                        <option value="never">永不结束</option>
                        <option value="until">到某日</option>
                        <option value="count">共 N 次</option>
                      </select>
                      {repeatEnd === 'until' ? (
                        <input
                          type="date"
                          value={repeatUntil}
                          onChange={(event) => setRepeatUntil(event.target.value)}
                          aria-label="结束日期"
                        />
                      ) : null}
                      {repeatEnd === 'count' ? (
                        <input
                          type="number"
                          min={1}
                          value={repeatCount}
                          onChange={(event) => setRepeatCount(Number(event.target.value))}
                          aria-label="次数"
                        />
                      ) : null}
                    </div>
                  ) : null}

                  {repeatMode !== 'none' ? (
                    <label className="course-toggle">
                      <input
                        type="checkbox"
                        checked={courseLike}
                        onChange={(event) => setCourseLike(event.target.checked)}
                      />
                      <span>标记为课程（可在课表视图展示）</span>
                    </label>
                  ) : null}
                </div>
              ) : null}

              {formError ? <span className="form-error">{formError}</span> : null}
              <input
                value={location}
                onChange={(event) => setLocation(event.target.value)}
                placeholder="地点（可选）"
                aria-label="地点"
              />
              <div className="event-form-actions">
                <button type="button" className="ghost-button" onClick={() => setFormOpen(false)}>
                  取消
                </button>
                <button type="submit" className="primary-button">
                  {entryKind === 'deadline' ? '添加 DDL' : '添加日程'}
                </button>
              </div>
            </form>
          ) : (
            <button type="button" className="primary-button block-button" onClick={() => setFormOpen(true)}>
              在 {format(selected, 'M/d')} 添加日程
            </button>
          )}

          {dropNotice ? (
            <div className="notice-bar" role="status">
              <span>{dropNotice}</span>
              <button type="button" className="ghost-button" onClick={() => setDropNotice(null)}>
                关闭
              </button>
            </div>
          ) : null}

          <div className="unscheduled">
            <div className="panel-head">
              <h3 className="section-title">待排期</h3>
              <span className="muted">{unscheduled.length} 项</span>
            </div>
            {unscheduled.length === 0 ? (
              <p className="empty-hint">没有待排期任务。</p>
            ) : (
              <ul className="unscheduled-list">
                {unscheduled.map((task) => (
                  <li
                    key={task.id}
                    className="unscheduled-item"
                    draggable
                    onDragStart={(event) => {
                      event.dataTransfer.setData('text/plain', task.id);
                      event.dataTransfer.setData('text/task-id', task.id);
                      event.dataTransfer.effectAllowed = 'move';
                    }}
                  >
                    <span>{task.title}</span>
                    <span className="muted">{task.estimateMinutes ?? 60} 分钟</span>
                  </li>
                ))}
              </ul>
            )}
            <p className="page-foot muted">
              拖到左侧时间格即可排期（默认 60 分钟），也可去
              <Link className="text-link" to="/tasks">
                待办页
              </Link>
              设置精确时间。
            </p>
          </div>
        </aside>
      </div>
    </div>
  );
}