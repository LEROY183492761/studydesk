import { useMemo, useState } from 'react';
import { addDays } from 'date-fns';
import clsx from 'clsx';
import { Link } from 'react-router-dom';
import type { TimelineItem } from '@/domain/selectors/timeline';
import { buildTimeline, plannedMinutes, actualMinutes } from '@/domain/selectors/timeline';
import {
  buildCalendarItems,
  DAY_END_HOUR,
  DAY_START_HOUR,
  dayRange,
  itemGeometry,
} from '@/domain/selectors/calendar';
import { formatDateLabel, formatTimeLabel, WEEKDAY_LABELS } from '@/lib/dates';
import { useAppStore } from '@/state/appStore';

const HOURS = Array.from(
  { length: DAY_END_HOUR - DAY_START_HOUR + 1 },
  (_, index) => DAY_START_HOUR + index,
);

function renderBlock(item: TimelineItem) {
  const geometry = itemGeometry(item, DAY_START_HOUR, DAY_END_HOUR);
  if (geometry.top >= 100) return null;

  return (
    <div
      key={item.id}
      className={clsx('timeline-block', item.layer === 'actual' && 'is-actual')}
      style={{
        top: `${geometry.top}%`,
        height: `${Math.max(geometry.height, 4)}%`,
        backgroundColor: item.color,
      }}
      title={`${item.title} ${formatTimeLabel(item.start)}–${formatTimeLabel(item.end)}`}
    >
      <strong>{item.title}</strong>
      <span>{formatTimeLabel(item.start)}</span>
    </div>
  );
}

function renderHourLines() {
  return HOURS.map((hour) => (
    <span
      key={hour}
      className="hour-line"
      style={{ top: `${((hour - DAY_START_HOUR) / (DAY_END_HOUR - DAY_START_HOUR)) * 100}%` }}
    />
  ));
}

export function TimelinePage() {
  const [date, setDate] = useState(() => new Date());
  const tasks = useAppStore((state) => state.tasks);
  const events = useAppStore((state) => state.events);
  const focusSessions = useAppStore((state) => state.focusSessions);
  const timetable = useAppStore((state) => state.timetable);

  const timeline = useMemo(() => {
    const items = buildCalendarItems({ timetable, events, tasks, range: dayRange(date) });
    return buildTimeline({ date, items, focusSessions });
  }, [date, timetable, events, tasks, focusSessions]);

  const planned = timeline.filter((item) => item.layer === 'planned');
  const actual = timeline.filter((item) => item.layer === 'actual');
  const plannedTotal = Math.round(plannedMinutes(timeline));
  const actualTotal = Math.round(actualMinutes(timeline));
  const gap = actualTotal - plannedTotal;

  return (
    <div className="page timeline-page">
      <header className="page-header">
        <div>
          <p className="muted">
            {formatDateLabel(date, 'yyyy 年 M 月 d 日')} · {WEEKDAY_LABELS[date.getDay()]}
          </p>
          <h1>时间轴</h1>
        </div>
        <div className="calendar-nav">
          <button
            type="button"
            className="ghost-button"
            aria-label="前一天"
            onClick={() => setDate((current) => addDays(current, -1))}
          >
            ‹
          </button>
          <button type="button" className="ghost-button" onClick={() => setDate(new Date())}>
            今天
          </button>
          <button
            type="button"
            className="ghost-button"
            aria-label="后一天"
            onClick={() => setDate((current) => addDays(current, 1))}
          >
            ›
          </button>
        </div>
      </header>

      <div className="timeline-layout">
        <section className="surface-card timeline-main">
          <div className="timeline-lane-head">
            <span>计划层（课程 / 日程 / 排期待办）</span>
            <span>实际层（专注记录）</span>
          </div>
          <div className="timeline-canvas">
            <div className="time-gutter time-gutter-axis">
              {HOURS.map((hour) => (
                <span
                  key={hour}
                  className="time-label"
                  style={{
                    top: `${((hour - DAY_START_HOUR) / (DAY_END_HOUR - DAY_START_HOUR)) * 100}%`,
                  }}
                >
                  {hour}:00
                </span>
              ))}
            </div>
            <div className="timeline-lane">
              {renderHourLines()}
              {planned.map(renderBlock)}
            </div>
            <div className="timeline-lane">
              {renderHourLines()}
              {actual.map(renderBlock)}
            </div>
          </div>
        </section>

        <aside className="surface-card panel">
          <h2 className="section-title">当日对照</h2>
          <ul className="timeline-summary">
            <li>
              <span className="muted">计划总时长</span>
              <strong>{plannedTotal} 分钟</strong>
            </li>
            <li>
              <span className="muted">实际专注</span>
              <strong>{actualTotal} 分钟</strong>
            </li>
            <li>
              <span className="muted">偏差</span>
              <strong className={gap < 0 ? 'is-negative' : undefined}>
                {gap > 0 ? '+' : ''}
                {gap} 分钟
              </strong>
            </li>
            <li>
              <span className="muted">计划事项</span>
              <strong>{planned.length} 项</strong>
            </li>
            <li>
              <span className="muted">专注次数</span>
              <strong>{actual.length} 次</strong>
            </li>
          </ul>

          {actual.length === 0 ? (
            <p className="empty-hint">
              还没有专注记录。
              <Link className="text-link" to="/focus">
                开始一次专注
              </Link>
            </p>
          ) : (
            <p className="panel-foot muted">
              实际层来自番茄记录，M1 仍为前端计时，M1.5 迁移到 Rust 时钟。
            </p>
          )}
        </aside>
      </div>
    </div>
  );
}