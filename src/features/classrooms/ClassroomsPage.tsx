import { useMemo, useState } from 'react';
import type { FormEvent } from 'react';
import { format, parseISO } from 'date-fns';
import clsx from 'clsx';
import type { ClassroomSlot } from '@/domain/models';
import { DEFAULT_PERIOD_TIMES } from '@/domain/models';
import {
  allPeriods,
  freePeriodsForDate,
  matchClassroomSlots,
} from '@/domain/selectors/classrooms';
import { createId } from '@/lib/ids';
import { useAppStore } from '@/state/appStore';

const STORAGE_KEY = 'studydesk.classroomSlots';

function loadSlots(): ClassroomSlot[] {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as ClassroomSlot[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveSlots(slots: ClassroomSlot[]) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(slots));
  } catch {
    /* ignore quota errors */
  }
}

export function ClassroomsPage() {
  const timetable = useAppStore((state) => state.timetable);

  const [date, setDate] = useState(() => format(new Date(), 'yyyy-MM-dd'));
  const [slots, setSlots] = useState<ClassroomSlot[]>(loadSlots);
  const [building, setBuilding] = useState('教三');
  const [room, setRoom] = useState('');
  const [campus, setCampus] = useState('本部');
  const [startPeriod, setStartPeriod] = useState(1);
  const [endPeriod, setEndPeriod] = useState(4);
  const [notice, setNotice] = useState<string | null>(null);

  const selectedDate = parseISO(date);
  const freePeriods = useMemo(
    () => freePeriodsForDate(timetable, selectedDate),
    [timetable, selectedDate],
  );
  const matches = useMemo(
    () => matchClassroomSlots(slots, selectedDate, freePeriods),
    [slots, selectedDate, freePeriods],
  );
  const daySlots = slots.filter((slot) => slot.date === date);

  function persist(next: ClassroomSlot[]) {
    setSlots(next);
    saveSlots(next);
  }

  function handleAdd(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!building.trim() || !room.trim()) return;

    const slot: ClassroomSlot = {
      id: createId('classroom'),
      building: building.trim(),
      room: room.trim(),
      campus: campus.trim() || '未知校区',
      date,
      startPeriod,
      endPeriod: Math.max(startPeriod, endPeriod),
    };
    persist([...slots, slot]);
    setRoom('');
    setNotice('已添加空教室');
  }

  function handleRemove(id: string) {
    persist(slots.filter((slot) => slot.id !== id));
    setNotice('已删除空教室');
  }

  function handleSample() {
    const sample = [
      { room: '201', startPeriod: 1, endPeriod: 5 },
      { room: '305', startPeriod: 6, endPeriod: 8 },
      { room: 's-201', startPeriod: 9, endPeriod: 14 },
    ].map<ClassroomSlot>((item) => ({
      id: createId('classroom'),
      building: '教三',
      room: item.room,
      campus: '本部',
      date,
      startPeriod: item.startPeriod,
      endPeriod: item.endPeriod,
    }));
    persist([...slots, ...sample]);
    setNotice('已导入当天示例空教室');
  }

  return (
    <div className="page classrooms-page">
      <header className="page-header">
        <div>
          <p className="muted">先录入空教室，再与个人空闲节次求交集</p>
          <h1>空教室</h1>
        </div>
        <div className="classroom-toolbar">
          <input
            type="date"
            value={date}
            onChange={(event) => setDate(event.target.value)}
            aria-label="查看日期"
          />
          <button type="button" className="ghost-button" onClick={handleSample}>
            导入当天示例
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
        <div className="panel-head">
          <h2 className="section-title">我的空闲节次</h2>
          <span className="muted">{date}</span>
        </div>
        <div className="free-period-list">
          {allPeriods().map((period) => {
            const free = freePeriods.includes(period);
            const time = DEFAULT_PERIOD_TIMES.find((item) => item.period === period);
            return (
              <span
                key={period}
                className={clsx('free-period-chip', free ? 'is-free' : 'is-busy')}
                title={`第${period}节 ${time?.start ?? ''}-${time?.end ?? ''}`}
              >
                第{period}节
              </span>
            );
          })}
        </div>
      </section>

      <section className="surface-card panel">
        <div className="panel-head">
          <h2 className="section-title">推荐空教室</h2>
          <span className="muted">{matches.length} 间可用</span>
        </div>
        {matches.length === 0 ? (
          <p className="empty-hint">
            当天还没有可用空教室。先录入教室空余时间，或导入示例。
          </p>
        ) : (
          <ul className="classroom-match-list">
            {matches.map(({ slot, matchedPeriods }) => (
              <li key={slot.id}>
                <div>
                  <strong>
                    {slot.building} {slot.room}
                  </strong>
                  <span className="muted">
                    {slot.campus} · 第 {slot.startPeriod}–{slot.endPeriod} 节
                  </span>
                </div>
                <span className="classroom-match-periods">
                  可覆盖第 {matchedPeriods.join('、')} 节
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <div className="classroom-forms">
        <form className="surface-card classroom-form" onSubmit={handleAdd}>
          <div className="panel-head">
            <h2 className="section-title">录入空教室</h2>
          </div>
          <input
            value={building}
            onChange={(event) => setBuilding(event.target.value)}
            placeholder="教学楼，如 教三"
            aria-label="教学楼"
            required
          />
          <input
            value={room}
            onChange={(event) => setRoom(event.target.value)}
            placeholder="教室号，如 201"
            aria-label="教室号"
            required
          />
          <input
            value={campus}
            onChange={(event) => setCampus(event.target.value)}
            placeholder="校区（可选）"
            aria-label="校区"
          />
          <label className="habit-duration">
            <select
              value={startPeriod}
              onChange={(event) => setStartPeriod(Number(event.target.value))}
              aria-label="空余开始节次"
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
              aria-label="空余结束节次"
            >
              {DEFAULT_PERIOD_TIMES.map((time) => (
                <option key={time.period} value={time.period}>
                  {time.period}
                </option>
              ))}
            </select>
          </label>
          <button type="submit" className="primary-button">
            添加空教室
          </button>
        </form>

        <section className="surface-card panel">
          <div className="panel-head">
            <h2 className="section-title">当天已录入</h2>
            <span className="muted">{daySlots.length} 条</span>
          </div>
          {daySlots.length === 0 ? (
            <p className="empty-hint">当天还没有录入空教室。</p>
          ) : (
            <ul className="classroom-slot-list">
              {daySlots.map((slot) => (
                <li key={slot.id}>
                  <span>
                    {slot.building} {slot.room} · 第 {slot.startPeriod}–{slot.endPeriod} 节
                    {slot.campus ? ` · ${slot.campus}` : ''}
                  </span>
                  <button
                    type="button"
                    className="ghost-button"
                    onClick={() => handleRemove(slot.id)}
                  >
                    删除
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}