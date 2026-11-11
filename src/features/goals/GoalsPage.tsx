import { useMemo, useState } from 'react';
import type { FormEvent } from 'react';
import { format } from 'date-fns';
import clsx from 'clsx';
import {
  countdownDays,
  countdownLabel,
  goalHabitProgress,
  goalStats,
  goalTaskProgress,
  sortCountdowns,
} from '@/domain/rules/goals';
import { useAppStore } from '@/state/appStore';

type ViewMode = 'goals' | 'countdowns';

export function GoalsPage() {
  const [view, setView] = useState<ViewMode>('goals');
  const now = useMemo(() => new Date(), []);

  const goals = useAppStore((state) => state.goals);
  const tasks = useAppStore((state) => state.tasks);
  const habits = useAppStore((state) => state.habits);
  const habitLogs = useAppStore((state) => state.habitLogs);
  const countdowns = useAppStore((state) => state.countdowns);
  const categories = useAppStore((state) => state.categories);
  const addGoal = useAppStore((state) => state.addGoal);
  const updateGoal = useAppStore((state) => state.updateGoal);
  const removeGoal = useAppStore((state) => state.removeGoal);
  const addCountdown = useAppStore((state) => state.addCountdown);
  const removeCountdown = useAppStore((state) => state.removeCountdown);

  const [goalTitle, setGoalTitle] = useState('');
  const [goalTarget, setGoalTarget] = useState('');
  const [goalCategory, setGoalCategory] = useState('');
  const [goalNote, setGoalNote] = useState('');
  const [goalHabitId, setGoalHabitId] = useState('');
  const [goalTargetAmount, setGoalTargetAmount] = useState(100);
  const [goalTaskIds, setGoalTaskIds] = useState<string[]>([]);

  const [countdownTitle, setCountdownTitle] = useState('');
  const [countdownDate, setCountdownDate] = useState(() => format(new Date(), 'yyyy-MM-dd'));
  const [countdownYearly, setCountdownYearly] = useState(false);
  const [countdownNote, setCountdownNote] = useState('');
  const [countdownRemindAt, setCountdownRemindAt] = useState('09:00');

  const stats = useMemo(() => goalStats(goals), [goals]);
  const today = format(now, 'yyyy-MM-dd');
  const sortedCountdowns = useMemo(() => sortCountdowns(countdowns, now), [countdowns, now]);
  const activeGoals = goals.filter((goal) => goal.status === 'active');
  const doneGoals = goals.filter((goal) => goal.status === 'done');

  function categoryName(id?: string) {
    return categories.find((category) => category.id === id)?.name;
  }

  async function handleAddGoal(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const goal = await addGoal({
      title: goalTitle,
      targetDate: goalTarget || undefined,
      categoryId: goalCategory || undefined,
      note: goalNote || undefined,
      habitId: goalHabitId || undefined,
      taskIds: goalTaskIds.length > 0 ? goalTaskIds : undefined,
      targetAmount: goalHabitId ? Math.max(1, goalTargetAmount) : undefined,
      autoProgress: Boolean(goalHabitId || goalTaskIds.length > 0),
    });
    if (!goal) return;
    setGoalTitle('');
    setGoalTarget('');
    setGoalNote('');
    setGoalHabitId('');
    setGoalTargetAmount(100);
    setGoalTaskIds([]);
  }

  async function handleAddCountdown(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const item = await addCountdown({
      title: countdownTitle,
      date: countdownDate,
      yearly: countdownYearly,
      note: countdownNote || undefined,
      remindAt: countdownRemindAt || '09:00',
    });
    if (!item) return;
    setCountdownTitle('');
    setCountdownNote('');
    setCountdownYearly(false);
    setCountdownRemindAt('09:00');
  }

  return (
    <div className="page goals-page">
      <header className="page-header">
        <div>
          <p className="muted">长期方向与重要日子</p>
          <h1>目标</h1>
        </div>
        <div className="segmented" role="group" aria-label="目标视图">
          <button
            type="button"
            className={clsx(view === 'goals' && 'is-active')}
            aria-pressed={view === 'goals'}
            onClick={() => setView('goals')}
          >
            目标
          </button>
          <button
            type="button"
            className={clsx(view === 'countdowns' && 'is-active')}
            aria-pressed={view === 'countdowns'}
            onClick={() => setView('countdowns')}
          >
            倒数日
          </button>
        </div>
      </header>

      {view === 'goals' ? (
        <>
          <form className="surface-card goal-composer" onSubmit={handleAddGoal}>
            <input
              value={goalTitle}
              onChange={(event) => setGoalTitle(event.target.value)}
              placeholder="新目标，例如：期末绩点 3.7"
              aria-label="目标名称"
              required
            />
            <input
              type="date"
              value={goalTarget}
              onChange={(event) => setGoalTarget(event.target.value)}
              aria-label="目标日期"
            />
            <select
              value={goalCategory}
              onChange={(event) => setGoalCategory(event.target.value)}
              aria-label="目标分类"
            >
              <option value="">未分类</option>
              {categories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </select>
            <select
              value={goalHabitId}
              onChange={(event) => setGoalHabitId(event.target.value)}
              aria-label="绑定习惯"
            >
              <option value="">不绑定习惯</option>
              {habits
                .filter((habit) => !habit.archived)
                .map((habit) => (
                  <option key={habit.id} value={habit.id}>
                    习惯：{habit.name}
                  </option>
                ))}
            </select>
            <select
              multiple
              value={goalTaskIds}
              onChange={(event) =>
                setGoalTaskIds(
                  Array.from(event.target.selectedOptions, (option) => option.value),
                )
              }
              aria-label="关联任务"
              className="goal-task-select"
            >
              {tasks
                .filter((task) => task.status !== 'archived')
                .map((task) => (
                  <option key={task.id} value={task.id}>
                    {task.status === 'done' ? '✓ ' : ''}
                    {task.title}
                  </option>
                ))}
            </select>
            {goalHabitId ? (
              <input
                type="number"
                min={1}
                value={goalTargetAmount}
                onChange={(event) => setGoalTargetAmount(Number(event.target.value))}
                aria-label="目标总量"
                placeholder="目标总量"
              />
            ) : null}
            <input
              value={goalNote}
              onChange={(event) => setGoalNote(event.target.value)}
              placeholder="备注（可选）"
              aria-label="目标备注"
            />
            <button type="submit" className="primary-button">
              添加目标
            </button>
          </form>

          <div className="goal-stats">
            <span>
              进行中 <strong>{stats.active}</strong>
            </span>
            <span>
              已完成 <strong>{stats.done}</strong>
            </span>
            <span>
              平均进度 <strong>{stats.averageProgress}%</strong>
            </span>
          </div>

          {activeGoals.length === 0 && doneGoals.length === 0 ? (
            <p className="empty-hint">还没有目标，先写下一个想达成的结果。</p>
          ) : (
            <div className="goal-grid">
              {[...activeGoals, ...doneGoals].map((goal) => {
                const habitProgressInfo = goal.habitId
                  ? goalHabitProgress(
                      goal,
                      habits,
                      habitLogs,
                      format(new Date(goal.createdAt), 'yyyy-MM-dd'),
                      goal.targetDate ?? today,
                    )
                  : null;
                const taskProgressInfo = goalTaskProgress(goal, tasks);
                const displayProgress = habitProgressInfo
                  ? Math.round(habitProgressInfo.ratio * 100)
                  : taskProgressInfo
                    ? Math.round(taskProgressInfo.ratio * 100)
                    : goal.progress;

                return (
                  <article
                    key={goal.id}
                    className={clsx('surface-card goal-card', goal.status === 'done' && 'is-done')}
                  >
                  <div className="goal-head">
                    <strong>{goal.title}</strong>
                    <span className="muted">
                      {goal.status === 'done'
                        ? '已完成'
                        : goal.targetDate
                          ? `目标 ${goal.targetDate}`
                          : '无目标日期'}
                      {categoryName(goal.categoryId) ? ` · ${categoryName(goal.categoryId)}` : ''}
                    </span>
                  </div>
                  {goal.note ? <p className="goal-note muted">{goal.note}</p> : null}

                  <div className="goal-progress-row">
                    <input
                      type="range"
                      min={0}
                      max={100}
                      step={5}
                      value={displayProgress}
                      disabled={
                        goal.status !== 'active' ||
                        Boolean(habitProgressInfo) ||
                        Boolean(taskProgressInfo)
                      }
                      onChange={(event) =>
                        void updateGoal(goal.id, { progress: Number(event.target.value) })
                      }
                      aria-label={`${goal.title} 进度`}
                    />
                    <strong>{displayProgress}%</strong>
                    {habitProgressInfo ? (
                      <span className="muted goal-habit-progress">
                        {habitProgressInfo.done}/{habitProgressInfo.target} {habitProgressInfo.unit}
                      </span>
                    ) : null}
                    {taskProgressInfo ? (
                      <span className="muted goal-habit-progress">
                        {taskProgressInfo.done}/{taskProgressInfo.total} 任务
                      </span>
                    ) : null}
                  </div>

                  <div className="goal-actions">
                    <button
                      type="button"
                      className="ghost-button"
                      onClick={() =>
                        void updateGoal(goal.id, {
                          status: goal.status === 'done' ? 'active' : 'done',
                        })
                      }
                    >
                      {goal.status === 'done' ? '恢复' : '标记完成'}
                    </button>
                    <button
                      type="button"
                      className="ghost-button"
                      onClick={() => void removeGoal(goal.id)}
                    >
                      删除
                    </button>
                  </div>
                </article>
                );
              })}
            </div>
          )}
        </>
      ) : (
        <>
          <form className="surface-card countdown-composer" onSubmit={handleAddCountdown}>
            <input
              value={countdownTitle}
              onChange={(event) => setCountdownTitle(event.target.value)}
              placeholder="新倒数日，例如：期末考试"
              aria-label="倒数日名称"
              required
            />
            <input
              type="date"
              value={countdownDate}
              onChange={(event) => setCountdownDate(event.target.value)}
              aria-label="倒数日日期"
            />
            <input
              type="time"
              value={countdownRemindAt}
              onChange={(event) => setCountdownRemindAt(event.target.value)}
              aria-label="倒数日提醒时间"
            />
            <label className="habit-toggle">
              <input
                type="checkbox"
                checked={countdownYearly}
                onChange={(event) => setCountdownYearly(event.target.checked)}
              />
              <span>每年重复</span>
            </label>
            <input
              value={countdownNote}
              onChange={(event) => setCountdownNote(event.target.value)}
              placeholder="备注（可选）"
              aria-label="倒数日备注"
            />
            <button type="submit" className="primary-button">
              添加倒数日
            </button>
          </form>

          {sortedCountdowns.length === 0 ? (
            <p className="empty-hint">还没有倒数日，添加一个值得期待的日子。</p>
          ) : (
            <div className="countdown-list">
              {sortedCountdowns.map((item) => {
                const days = countdownDays(item, now);
                return (
                  <article key={item.id} className="surface-card countdown-card">
                    <div className="countdown-days">
                      <strong>{days === 0 ? '今天' : Math.abs(days)}</strong>
                      {days === 0 ? null : <span>天</span>}
                    </div>
                    <div className="countdown-main">
                      <strong>{item.title}</strong>
                      <span className="muted">
                        {item.date}
                        {item.yearly ? ' · 每年重复' : ''}
                        {item.remindAt ? ` · 提醒 ${item.remindAt}` : ''} ·{' '}
                        {countdownLabel(days)}
                      </span>
                      {item.note ? <span className="muted">{item.note}</span> : null}
                    </div>
                    <button
                      type="button"
                      className="ghost-button"
                      onClick={() => void removeCountdown(item.id)}
                    >
                      删除
                    </button>
                  </article>
                );
              })}
            </div>
          )}
        </>
      )}
    </div>
  );
}