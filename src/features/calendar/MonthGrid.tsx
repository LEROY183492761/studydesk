import { isSameDay } from 'date-fns';
import clsx from 'clsx';
import type { CalendarItem } from '@/domain/models';
import { itemsOnDay } from '@/domain/selectors/calendar';
import { WEEKDAY_LABELS } from '@/lib/dates';

export interface MonthGridProps {
  days: Date[];
  month: Date;
  items: CalendarItem[];
  selected: Date;
  onSelect: (day: Date) => void;
  onDropTask?: (day: Date, taskId: string) => void;
}

export function MonthGrid({ days, month, items, selected, onSelect, onDropTask }: MonthGridProps) {
  const today = new Date();
  const weekdayHeaders = days.slice(0, 7).map((day) => WEEKDAY_LABELS[day.getDay()]);

  return (
    <div className="month-grid-wrap">
      <div className="month-weekday-row">
        {weekdayHeaders.map((label, index) => (
          <span key={`${label}-${index}`}>{label}</span>
        ))}
      </div>
      <div className="month-grid">
        {days.map((day) => {
          const dayItems = itemsOnDay(items, day);
          const outside = day.getMonth() !== month.getMonth();

          return (
            <button
              key={day.toISOString()}
              type="button"
              className={clsx(
                'month-cell',
                outside && 'is-outside',
                isSameDay(day, selected) && 'is-selected',
              )}
              onClick={() => onSelect(day)}
              onDragOver={(event) => {
                if (!onDropTask) return;
                event.preventDefault();
                event.dataTransfer.dropEffect = 'move';
              }}
              onDrop={(event) => {
                if (!onDropTask) return;
                const taskId =
                  event.dataTransfer.getData('text/plain') ||
                  event.dataTransfer.getData('text/task-id');
                if (!taskId) return;
                event.preventDefault();
                onDropTask(day, taskId);
              }}
            >
              <span className={clsx('month-date', isSameDay(day, today) && 'is-today')}>
                {day.getDate()}
              </span>
              <div className="month-events">
                {dayItems.slice(0, 3).map((item) => (
                  <span
                    key={item.id}
                    className="month-event"
                    style={{ borderLeftColor: item.color }}
                  >
                    {item.title}
                  </span>
                ))}
                {dayItems.length > 3 ? (
                  <span className="month-more">+{dayItems.length - 3}</span>
                ) : null}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}