import { isSameDay } from 'date-fns';
import clsx from 'clsx';
import type { CSSProperties, DragEvent } from 'react';
import type { CalendarItem } from '@/domain/models';
import { DAY_END_HOUR, DAY_START_HOUR, itemGeometry, itemsOnDay } from '@/domain/selectors/calendar';
import { formatDateLabel, formatTimeLabel, WEEKDAY_LABELS } from '@/lib/dates';

const HOURS = Array.from(
  { length: DAY_END_HOUR - DAY_START_HOUR + 1 },
  (_, index) => DAY_START_HOUR + index,
);

export interface TimeGridProps {
  days: Date[];
  items: CalendarItem[];
  selectedDay: Date;
  onSelectDay: (day: Date) => void;
  onDropTask?: (taskId: string, day: Date, start: Date) => void;
  onMoveItem?: (item: CalendarItem, day: Date, start: Date) => void;
}

export function TimeGrid({
  days,
  items,
  selectedDay,
  onSelectDay,
  onDropTask,
  onMoveItem,
}: TimeGridProps) {
  const columns = `56px repeat(${days.length}, minmax(0, 1fr))`;

  function dropStart(event: DragEvent<HTMLDivElement>, day: Date): Date {
    const rect = event.currentTarget.getBoundingClientRect();
    const ratio = Math.min(0.999, Math.max(0, (event.clientY - rect.top) / rect.height));
    const rawMinutes = (DAY_START_HOUR + ratio * (DAY_END_HOUR - DAY_START_HOUR)) * 60;
    const minutes = Math.round(rawMinutes / 15) * 15;

    const start = new Date(day);
    start.setHours(0, 0, 0, 0);
    start.setMinutes(minutes);
    return start;
  }

  function handleDrop(event: DragEvent<HTMLDivElement>, day: Date) {
    const itemId = event.dataTransfer.getData('text/calendar-item');
    if (itemId && onMoveItem) {
      const item = items.find((entry) => entry.id === itemId);
      if (!item) return;
      event.preventDefault();
      onMoveItem(item, day, dropStart(event, day));
      return;
    }

    if (!onDropTask) return;
    const taskId =
      event.dataTransfer.getData('text/plain') ||
      event.dataTransfer.getData('text/task-id');
    if (!taskId) return;

    event.preventDefault();
    onDropTask(taskId, day, dropStart(event, day));
  }

  return (
    <div className="time-grid">
      <div className="time-grid-head" style={{ gridTemplateColumns: columns }}>
        <div className="time-gutter" />
        {days.map((day) => (
          <button
            key={day.toISOString()}
            type="button"
            className={clsx('time-day-head', isSameDay(day, selectedDay) && 'is-selected')}
            onClick={() => onSelectDay(day)}
          >
            <span>{WEEKDAY_LABELS[day.getDay()]}</span>
            <strong>{formatDateLabel(day, 'd')}</strong>
          </button>
        ))}
      </div>

      <div className="time-grid-body" style={{ gridTemplateColumns: columns }}>
        <div className="time-gutter time-gutter-axis">
          {HOURS.map((hour) => (
            <span
              key={hour}
              className="time-label"
              style={{ top: `${((hour - DAY_START_HOUR) / (DAY_END_HOUR - DAY_START_HOUR)) * 100}%` }}
            >
              {hour}:00
            </span>
          ))}
        </div>

        {days.map((day) => {
          const dayItems = itemsOnDay(items, day);
          return (
            <div key={day.toISOString()} className="time-column"
              onDragOver={(event) => {
                if (onDropTask) event.preventDefault();
              }}
              onDrop={(event) => handleDrop(event, day)}
            >
              {HOURS.map((hour) => (
                <span
                  key={hour}
                  className="hour-line"
                  style={{
                    top: `${((hour - DAY_START_HOUR) / (DAY_END_HOUR - DAY_START_HOUR)) * 100}%`,
                  }}
                />
              ))}

              {dayItems.map((item) => {
                const geometry = itemGeometry(item, DAY_START_HOUR, DAY_END_HOUR);
                if (geometry.top >= 100) return null;

                const style: CSSProperties = {
                  top: `${geometry.top}%`,
                  height: `${Math.max(geometry.height, 5)}%`,
                  backgroundColor: item.color,
                };

                const movable =
                  Boolean(onMoveItem) &&
                  !item.allDay &&
                  !item.title.endsWith('（续）') &&
                  (item.source === 'task' || item.source === 'event');

                return (
                  <div
                    key={item.id}
                    className={clsx(
                      'time-block',
                      item.completed && 'is-completed',
                      movable && 'is-movable',
                    )}
                    style={style}
                    title={`${item.title} ${formatTimeLabel(item.start)}–${formatTimeLabel(item.end)}`}
                    draggable={movable}
                    onDragStart={(event) => {
                      event.dataTransfer.setData('text/calendar-item', item.id);
                      event.dataTransfer.setData('text/plain', item.id);
                      event.dataTransfer.effectAllowed = 'move';
                    }}
                  >
                    <strong>{item.title}</strong>
                    <span>{formatTimeLabel(item.start)}</span>
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>
    </div>
  );
}