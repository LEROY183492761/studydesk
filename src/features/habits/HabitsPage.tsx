import { useEffect, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import { addDays, eachDayOfInterval, format, startOfWeek } from 'date-fns';
import clsx from 'clsx';
import type { Habit, HabitFrequency, HabitLog } from '@/domain/models';
import { Heatmap, HeatmapLegend } from '@/components/charts/Heatmap';
import {
  HABIT_UNIT_OPTIONS,
  habitDayAmount,
  habitProgress,
  habitStreak,
  habitUnit,
  habitWeekProgress,
  isTimeUnit,
} from '@/domain/rules/habits';
import { getPlatform } from '@/platform';
import type { PlatformPort } from '@/platform/types';
import { useAppStore } from '@/state/appStore';

const COLORS = [
  'var(--color-course-1)',
  'var(--color-course-2)',
  'var(--color-course-3)',
  'var(--color-course-4)',
  'var(--color-course-5)',
  'var(--color-course-6)',
];

const HABIT_TIMER_KEY = 'studydesk.habit.timer';

function formatClock(totalSeconds: number): string {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

/** 任务型显示「开始–结束」时间段；轻量打卡仍显示时刻 */
function formatLogRange(log: HabitLog, timed: boolean): string {
  const end = log.recordedAt ? new Date(log.recordedAt) : null;
  if (!end) return '';
  if (!timed) return format(end, 'HH:mm');

  const start = log.startedAt
    ? new Date(log.startedAt)
    : log.minutes
      ? new Date(end.getTime() - log.minutes * 60_000)
      : null;
  if (!start) return format(end, 'HH:mm');

  const sameDay = format(start, 'yyyy-MM-dd') === format(end, 'yyyy-MM-dd');
  return sameDay
    ? `${format(start, 'HH:mm')}–${format(end, 'HH:mm')}`
    : `${format(start, 'M/d HH:mm')}–${format(end, 'M/d HH:mm')}`;
}

/** 时长展示：45m / 1h / 1h1m */
function formatDuration(minutes: number): string {
  const total = Math.max(1, Math.round(minutes));
  const hours = Math.floor(total / 60);
  const rest = total % 60;
  if (hours === 0) return `${rest}m`;
  return rest === 0 ? `${hours}h` : `${hours}h${rest}m`;
}

export function HabitsPage() {
  const habits = useAppStore((state) => state.habits);
  const habitLogs = useAppStore((state) => state.habitLogs);
  const goals = useAppStore((state) => state.goals);
  const addHabit = useAppStore((state) => state.addHabit);
  const updateHabit = useAppStore((state) => state.updateHabit);
  const removeHabit = useAppStore((state) => state.removeHabit);
  const addHabitLog = useAppStore((state) => state.addHabitLog);
  const removeHabitLog = useAppStore((state) => state.removeHabitLog);
  const categories = useAppStore((state) => state.categories);

  const [composerOpen, setComposerOpen] = useState(false);
  const [name, setName] = useState('');
  const [frequencyType, setFrequencyType] = useState<'daily' | 'weekly'>('daily');
  const [timesPerWeek, setTimesPerWeek] = useState(3);
  const [color, setColor] = useState(COLORS[0]);
  const [habitMode, setHabitMode] = useState<'light' | 'task'>('light');
  const [logToTimeline, setLogToTimeline] = useState(false);
  const [categoryId, setCategoryId] = useState('');
  const [remindAt, setRemindAt] = useState('');
  const [unit, setUnit] = useState('次');
  const [dailyTarget, setDailyTarget] = useState(1);
  const [unitMinutes, setUnitMinutes] = useState(0);
  const [goalId, setGoalId] = useState('');
  const [editingHabitId, setEditingHabitId] = useState<string | null>(null);
  const [activeHabitId, setActiveHabitId] = useState<string | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [logValues, setLogValues] = useState<Record<string, string>>({});
  const [logUnits, setLogUnits] = useState<Record<string, string>>({});
  const [notice, setNotice] = useState<string | null>(null);

  const platformRef = useRef<PlatformPort | null>(null);

  const now = new Date();
  const today = format(now, 'yyyy-MM-dd');
  const weekStart = startOfWeek(now, { weekStartsOn: 1 });
  const weekDays = eachDayOfInterval({ start: weekStart, end: addDays(weekStart, 6) });
  const activeHabits = habits.filter((habit) => !habit.archived);

  const heatmapStart = addDays(now, -29);
  const habitHeatmapCells = eachDayOfInterval({ start: heatmapStart, end: now }).map((day) => {
    const date = format(day, 'yyyy-MM-dd');
    return { date, value: habitLogs.filter((log) => log.date === date).length };
  });
  const heatmapTotal = habitHeatmapCells.reduce((sum, cell) => sum + cell.value, 0);
  const heatmapActiveDays = habitHeatmapCells.filter((cell) => cell.value > 0).length;

  useEffect(() => {
    void getPlatform().then((platform) => {
      platformRef.current = platform;
    });
  }, []);

  useEffect(() => {
    const raw = window.localStorage.getItem(HABIT_TIMER_KEY);
    if (!raw) return;

    try {
      const saved = JSON.parse(raw) as { habitId?: string };
      if (!saved.habitId) {
        window.localStorage.removeItem(HABIT_TIMER_KEY);
        return;
      }

      void getPlatform().then(async (platform) => {
        platformRef.current = platform;
        const snapshot = await platform.focus.status();
        if (snapshot.running && snapshot.mode === 'focus') {
          setActiveHabitId(saved.habitId!);
          setNotice('已恢复上次未结束的习惯计时');
        } else {
          window.localStorage.removeItem(HABIT_TIMER_KEY);
        }
      });
    } catch {
      window.localStorage.removeItem(HABIT_TIMER_KEY);
    }
  }, []);

  useEffect(() => {
    if (!activeHabitId) return;
    const handle = window.setInterval(() => {
      const platform = platformRef.current;
      if (!platform) return;
      void platform.focus.status().then((snapshot) => setElapsed(snapshot.elapsed_seconds));
    }, 1000);
    return () => window.clearInterval(handle);
  }, [activeHabitId]);

  function resetComposer() {
    setEditingHabitId(null);
    setName('');
    setColor(COLORS[0]);
    setFrequencyType('daily');
    setTimesPerWeek(3);
    setHabitMode('light');
    setLogToTimeline(false);
    setCategoryId('');
    setRemindAt('');
    setUnit('次');
    setDailyTarget(1);
    setUnitMinutes(0);
    setGoalId('');
  }

  function openComposer(habit?: Habit) {
    if (!habit) {
      resetComposer();
      setComposerOpen(true);
      return;
    }

    setEditingHabitId(habit.id);
    setName(habit.name);
    setColor(habit.color);
    if (habit.frequency.type === 'daily') {
      setFrequencyType('daily');
    } else {
      setFrequencyType('weekly');
      setTimesPerWeek(habit.frequency.timesPerWeek);
    }
    setHabitMode(habit.mode ?? 'light');
    setLogToTimeline(habit.logToTimeline ?? false);
    setCategoryId(habit.categoryId ?? '');
    setRemindAt(habit.remindAt ?? '');
    setUnit(habitUnit(habit));
    setDailyTarget(habit.dailyTarget ?? 1);
    setUnitMinutes(habit.unitMinutes ?? 0);
    setGoalId(habit.goalId ?? '');
    setComposerOpen(true);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const frequency: HabitFrequency =
      frequencyType === 'daily' ? { type: 'daily' } : { type: 'weekly', timesPerWeek };
    const payload = {
      name,
      color,
      frequency,
      mode: habitMode,
      logToTimeline,
      categoryId: categoryId || undefined,
      remindAt: remindAt || undefined,
      unit: unit.trim() || '次',
      dailyTarget: Math.max(1, Number(dailyTarget) || 1),
      unitMinutes: unitMinutes > 0 ? unitMinutes : undefined,
      goalId: goalId || undefined,
    };

    if (editingHabitId) {
      await updateHabit(editingHabitId, payload);
      setNotice('习惯已更新');
    } else {
      await addHabit(payload);
      setNotice('习惯已添加');
    }

    resetComposer();
    setComposerOpen(false);
  }

  function loggedValue(habit: Habit): string {
    return logValues[habit.id] ?? '1';
  }

  function loggedUnit(habit: Habit): string {
    return logUnits[habit.id] ?? habitUnit(habit);
  }

  async function handleCheck(habit: Habit) {
    const value = Number(loggedValue(habit));
    if (!Number.isFinite(value) || value <= 0) {
      setNotice('完成量需大于 0');
      return;
    }
    await addHabitLog(habit.id, today, value, loggedUnit(habit));
    setLogValues((current) => ({ ...current, [habit.id]: '1' }));
    setNotice(`已记录 ${value}${loggedUnit(habit)}`);
  }

  async function startHabitTimer(habitId: string) {
    const platform = platformRef.current;
    if (!platform) return;

    const snapshot = await platform.focus.status();
    if (snapshot.running) {
      setNotice('已有计时正在运行，请先在专注页结束或暂停');
      return;
    }

    await platform.focus.start({ mode: 'focus', plannedSeconds: 4 * 60 * 60 });
    window.localStorage.setItem(HABIT_TIMER_KEY, JSON.stringify({ habitId }));
    setActiveHabitId(habitId);
    setElapsed(0);
  }

  async function finishHabitTimer(habit: Habit) {
    const platform = platformRef.current;
    if (!platform) return;

    const result = await platform.focus.stop();
    const seconds = Math.max(1, result.actual_seconds);
    const minutes = Math.max(1, Math.round(seconds / 60));
    const habitUnitValue = habitUnit(habit);
    const value = isTimeUnit(habitUnitValue)
      ? habitUnitValue === '小时' || habitUnitValue === 'h'
        ? Math.max(0.01, Math.round((minutes / 60) * 100) / 100)
        : minutes
      : Math.max(0.01, Number(loggedValue(habit)) || 1);

    await addHabitLog(habit.id, today, value, habitUnitValue, minutes, seconds);
    window.localStorage.removeItem(HABIT_TIMER_KEY);
    setActiveHabitId(null);
    setElapsed(0);
    setNotice(`已记录 ${value}${habitUnitValue}，用时 ${minutes} 分钟`);
  }

  return (
    <div className="page habits-page">
      <header className="page-header">
        <div>
          <p className="muted">每天一点点，长期可见</p>
          <h1>习惯</h1>
        </div>
        <div className="habit-toolbar">
          <div className="header-badge">
            今日已完成 {activeHabits.filter((habit) => habitProgress(habit, habitLogs, today).ratio > 0).length}
            /{activeHabits.length}
          </div>
          <button type="button" className="primary-button" onClick={() => openComposer()}>
            + 添加习惯
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

      {composerOpen ? (
        <form className="surface-card habit-composer" onSubmit={handleSubmit}>
          <div className="habit-composer-head">
            <strong>{editingHabitId ? '编辑习惯' : '添加习惯'}</strong>
            <span className="muted">同一天可多次打卡，每次记录本次数量</span>
          </div>

          <input
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="新习惯，例如：每天背 20 个单词"
            aria-label="习惯名称"
            required
          />

          <select
            value={frequencyType}
            onChange={(event) => setFrequencyType(event.target.value as 'daily' | 'weekly')}
            aria-label="频率类型"
          >
            <option value="daily">每天</option>
            <option value="weekly">每周</option>
          </select>

          {frequencyType === 'weekly' ? (
            <select
              value={timesPerWeek}
              onChange={(event) => setTimesPerWeek(Number(event.target.value))}
              aria-label="每周次数"
            >
              {[1, 2, 3, 4, 5, 6].map((value) => (
                <option key={value} value={value}>
                  每周 {value} 次
                </option>
              ))}
            </select>
          ) : null}

          <select
            value={habitMode}
            onChange={(event) => setHabitMode(event.target.value as 'light' | 'task')}
            aria-label="习惯模式"
          >
            <option value="light">轻量打卡</option>
            <option value="task">任务化（自动计时）</option>
          </select>

          <label className="habit-duration">
            <select
              value={unit}
              onChange={(event) => setUnit(event.target.value)}
              aria-label="打卡单位"
            >
              {HABIT_UNIT_OPTIONS.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
            <span>单位</span>
          </label>

          <label className="habit-duration">
            <input
              type="number"
              min={1}
              value={dailyTarget}
              onChange={(event) => setDailyTarget(Number(event.target.value))}
              aria-label="每日目标量"
            />
            <span>{unit} / 天</span>
          </label>

          {habitMode === 'task' ? (
            <span className="muted habit-hint">任务型无需填写时长，结束任务时按系统时间自动记录。</span>
          ) : null}

          <label className="habit-duration">
            <input
              type="number"
              min={0}
              step={0.5}
              value={unitMinutes}
              onChange={(event) => setUnitMinutes(Number(event.target.value))}
              aria-label="每单位折算分钟"
            />
            <span>分钟 / 单位</span>
          </label>

          <label className="habit-duration">
            <input
              type="time"
              value={remindAt}
              onChange={(event) => setRemindAt(event.target.value)}
              aria-label="提醒时间"
            />
            <span>提醒</span>
          </label>

          <select
            value={goalId}
            onChange={(event) => setGoalId(event.target.value)}
            aria-label="绑定目标"
          >
            <option value="">不绑定目标</option>
            {goals
              .filter((goal) => goal.status !== 'archived')
              .map((goal) => (
                <option key={goal.id} value={goal.id}>
                  目标：{goal.title}
                </option>
              ))}
          </select>

          <select
            value={categoryId}
            onChange={(event) => setCategoryId(event.target.value)}
            aria-label="习惯分类"
          >
            <option value="">未分类</option>
            {categories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </select>

          <label className="habit-toggle">
            <input
              type="checkbox"
              checked={logToTimeline}
              onChange={(event) => setLogToTimeline(event.target.checked)}
            />
            <span>写时间轴</span>
          </label>

          <div className="color-picker" role="group" aria-label="颜色">
            {COLORS.map((value) => (
              <button
                key={value}
                type="button"
                className={clsx('color-dot', color === value && 'is-active')}
                style={{ background: value }}
                aria-label={`颜色 ${value}`}
                aria-pressed={color === value}
                onClick={() => setColor(value)}
              />
            ))}
          </div>

          <div className="habit-composer-actions">
            <button
              type="button"
              className="ghost-button"
              onClick={() => {
                resetComposer();
                setComposerOpen(false);
              }}
            >
              取消
            </button>
            <button type="submit" className="primary-button">
              {editingHabitId ? '保存修改' : '添加习惯'}
            </button>
          </div>
        </form>
      ) : null}

      {activeHabits.length === 0 ? (
        <p className="empty-hint">还没有习惯，先添加一个每天能做到的小目标。</p>
      ) : (
        <div className="habit-grid">
          {activeHabits.map((habit) => {
            const unitValue = habitUnit(habit);
            const progress = habitProgress(habit, habitLogs, today);
            const streak = habitStreak(habitLogs, habit.id, now);
            const weekProgress = habitWeekProgress(habit, habitLogs, weekStart);
            const weekTarget = habit.frequency.type === 'daily' ? 7 : habit.frequency.timesPerWeek;
            const todayLogs = habitLogs
              .filter((log) => log.habitId === habit.id && log.date === today)
              .slice(-3)
              .reverse();
            const weekAmount = habitDayAmount(habitLogs, habit.id, today, unitValue).done;

            return (
              <article key={habit.id} className="surface-card habit-card">
                <div className="habit-head">
                  <span className="habit-dot" style={{ background: habit.color }} />
                  <div className="habit-title">
                    <strong>{habit.name}</strong>
                    <span className="muted">
                      {habit.frequency.type === 'daily'
                        ? '每天'
                        : `每周 ${habit.frequency.timesPerWeek} 次`}
                      {' · '}
                      {habit.mode === 'task' ? '任务化' : '轻量'}
                      {' · '}
                      {unitValue} / 天 {progress.target}
                      {habit.logToTimeline ? ' · 写时间轴' : ''}
                      {habit.remindAt ? ` · 提醒 ${habit.remindAt}` : ''}
                    </span>
                  </div>
                  <button type="button" className="ghost-button" onClick={() => openComposer(habit)}>
                    编辑
                  </button>
                  <button
                    type="button"
                    className="ghost-button"
                    aria-label={`删除 ${habit.name}`}
                    onClick={() => void removeHabit(habit.id)}
                  >
                    删除
                  </button>
                </div>

                <div className="habit-progress-head">
                  <span>
                    {habit.mode === 'task' ? '已打卡' : '已完成'} <strong>{progress.done}</strong> /{' '}
                    {progress.target} {unitValue}
                  </span>
                  <strong>{Math.round(progress.ratio * 100)}%</strong>
                </div>
                <div className="habit-progress">
                  <span style={{ width: `${progress.ratio * 100}%`, background: habit.color }} />
                </div>
                {progress.skipped > 0 ? (
                  <span className="muted habit-hint">
                    另有 {progress.skipped} 条其他单位记录未计入
                  </span>
                ) : null}

                <div className="habit-stats">
                  <span>
                    连续 <strong>{streak}</strong> 天
                  </span>
                  <span className="muted">
                    本周 {Math.round(weekProgress * weekTarget)}/{weekTarget} 天 · 今日累计 {weekAmount}
                    {unitValue}
                  </span>
                </div>

                <div className="habit-week">
                  {weekDays.map((day) => {
                    const date = format(day, 'yyyy-MM-dd');
                    const amount = habitDayAmount(habitLogs, habit.id, date, unitValue).done;
                    const checked = amount > 0;
                    return (
                      <button
                        key={date}
                        type="button"
                        className={clsx(
                          'habit-cell',
                          checked && 'is-done',
                          date === today && 'is-today',
                        )}
                        style={checked ? { background: habit.color } : undefined}
                        title={checked ? `${date}：累计 ${amount}${unitValue}` : `${date}：点击补记 1`}
                        aria-label={checked ? `${date} 已累计 ${amount}${unitValue}` : `${date} 补记 1`}
                        onClick={() => void addHabitLog(habit.id, date, 1, unitValue)}
                      >
                        {checked ? amount : format(day, 'd')}
                      </button>
                    );
                  })}
                </div>

                {todayLogs.length > 0 ? (
                  <ul className="habit-log-list">
                    {todayLogs.map((log) => (
                      <li key={log.id}>
                        <span>
                          {log.value}
                          {log.unit ?? unitValue}
                          {log.recordedAt
                            ? ` · ${formatLogRange(log, habit.mode === 'task')}`
                            : ''}
                          {habit.mode === 'task' && log.minutes
                            ? ` ${formatDuration(log.minutes)}`
                            : ''}
                        </span>
                        <button
                          type="button"
                          className="ghost-button"
                          aria-label="删除这条打卡"
                          onClick={() => void removeHabitLog(log.id)}
                        >
                          删除
                        </button>
                      </li>
                    ))}
                  </ul>
                ) : null}

                <div className="habit-check-row">
                  <input
                    type="number"
                    min={0.01}
                    step={0.5}
                    value={loggedValue(habit)}
                    onChange={(event) =>
                      setLogValues((current) => ({ ...current, [habit.id]: event.target.value }))
                    }
                    aria-label={`${habit.name} 本次完成量`}
                  />
                  <select
                    value={loggedUnit(habit)}
                    onChange={(event) =>
                      setLogUnits((current) => ({ ...current, [habit.id]: event.target.value }))
                    }
                    aria-label={`${habit.name} 本次单位`}
                  >
                    {HABIT_UNIT_OPTIONS.map((option) => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}
                  </select>
                  <button type="button" className="primary-button" onClick={() => void handleCheck(habit)}>
                    打卡
                  </button>
                </div>

                {habit.mode === 'task' ? (
                  activeHabitId === habit.id ? (
                    <button
                      type="button"
                      className="primary-button habit-check"
                      onClick={() => void finishHabitTimer(habit)}
                    >
                      结束并记录 · {formatClock(elapsed)}
                    </button>
                  ) : (
                    <button
                      type="button"
                      className="primary-button habit-check"
                      onClick={() => void startHabitTimer(habit.id)}
                    >
                      开始任务（自动计时）
                    </button>
                  )
                ) : null}
              </article>
            );
          })}
        </div>
      )}

      <section className="surface-card panel habit-heatmap-panel">
        <div className="panel-head">
          <h2 className="section-title">近 30 天打卡</h2>
          <span className="muted">
            共 {heatmapTotal} 次 · {heatmapActiveDays} 天有记录
          </span>
        </div>
        <Heatmap
          cells={habitHeatmapCells}
          color="var(--color-primary)"
          unit="次"
          label="近 30 天习惯打卡"
          autoScroll
        />
        <HeatmapLegend />
      </section>
    </div>
  );
}