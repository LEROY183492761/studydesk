import { useCallback, useEffect, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import { isSameDay, parseISO } from 'date-fns';
import clsx from 'clsx';
import type { TimerMode } from '@/domain/models';
import { cycleLabel, normalizePlan, totalPlannedMinutes } from '@/domain/rules/pomodoro';
import { getPlatform } from '@/platform';
import type { FocusSnapshot, PlatformPort } from '@/platform/types';
import { useAppStore } from '@/state/appStore';

type Phase = 'focus' | 'break';

function formatClock(totalSeconds: number): string {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

const TIMER_MODE_LABEL: Record<TimerMode, string> = {
  countdown: '倒计时',
  stopwatch: '正计时',
  none: '不计时',
};

export function FocusPage() {
  const settings = useAppStore((state) => state.settings);
  const tasks = useAppStore((state) => state.tasks);
  const focusSessions = useAppStore((state) => state.focusSessions);
  const logFocus = useAppStore((state) => state.logFocus);
  const addTask = useAppStore((state) => state.addTask);
  const updateTaskProgress = useAppStore((state) => state.updateTaskProgress);
  const categories = useAppStore((state) => state.categories);

  const [selectedTaskId, setSelectedTaskId] = useState('');
  const [phase, setPhase] = useState<Phase>('focus');
  const [cycle, setCycle] = useState(0);
  const [snapshot, setSnapshot] = useState<FocusSnapshot | null>(null);
  const [ready, setReady] = useState(false);

  const [quickOpen, setQuickOpen] = useState(false);
  const [quickTitle, setQuickTitle] = useState('');
  const [quickMode, setQuickMode] = useState<TimerMode>('countdown');
  const [quickFocus, setQuickFocus] = useState(settings.focusMinutes);
  const [quickBreak, setQuickBreak] = useState(settings.breakMinutes);
  const [quickCycles, setQuickCycles] = useState(1);
  const [quickNote, setQuickNote] = useState('');
  const [quickCategory, setQuickCategory] = useState('');
  const [quickDue, setQuickDue] = useState('');

  const platformRef = useRef<PlatformPort | null>(null);
  const busyRef = useRef(false);

  const selectedTask = tasks.find((task) => task.id === selectedTaskId) ?? null;
  const plan = normalizePlan(
    selectedTask
      ? {
          timerMode: selectedTask.timerMode,
          focusMinutes: selectedTask.focusMinutes,
          breakMinutes: selectedTask.breakMinutes,
          cyclesPlanned: selectedTask.cyclesPlanned,
        }
      : {},
    {
      focusMinutes: settings.focusMinutes,
      breakMinutes: settings.breakMinutes,
    },
  );

  const planRef = useRef(plan);
  planRef.current = plan;
  const cycleRef = useRef(cycle);
  cycleRef.current = cycle;
  const taskRef = useRef(selectedTask);
  taskRef.current = selectedTask;
  const phaseRef = useRef(phase);
  phaseRef.current = phase;

  useEffect(() => {
    let cancelled = false;
    void getPlatform().then((platform) => {
      if (cancelled) return;
      platformRef.current = platform;
      setReady(true);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const startPhase = useCallback(async (nextPhase: Phase) => {
    const platform = platformRef.current;
    if (!platform) return;
    const currentPlan = planRef.current;
    const seconds =
      (nextPhase === 'focus' ? currentPlan.focusMinutes : currentPlan.breakMinutes) * 60;

    setPhase(nextPhase);
    setSnapshot(
      await platform.focus.start({
        mode: nextPhase,
        plannedSeconds: seconds,
        taskId: taskRef.current?.id,
      }),
    );
  }, []);

  const finishRound = useCallback(async () => {
    if (busyRef.current) return;
    const platform = platformRef.current;
    if (!platform) return;

    busyRef.current = true;
    try {
      const result = await platform.focus.stop();
      const currentPlan = planRef.current;
      const currentTask = taskRef.current;

      const notificationsEnabled = settings.notifications;

      if (result.mode === 'break') {
        if (currentPlan.timerMode === 'countdown' && cycleRef.current < currentPlan.cyclesPlanned) {
          if (notificationsEnabled) {
            await platform.notification.notify('休息结束', '继续下一轮专注');
          }
          await startPhase('focus');
        } else {
          setSnapshot(null);
        }
        return;
      }

      if (result.actual_seconds > 0) {
        await logFocus({
          plannedSeconds: result.planned_seconds,
          actualSeconds: result.actual_seconds,
          mode: 'focus',
          taskId: result.task_id ?? undefined,
          note: currentTask ? `专注：${currentTask.title}` : '专注完成',
          startedAt: result.started_at_ms
            ? new Date(result.started_at_ms).toISOString()
            : undefined,
          cycleIndex: cycleRef.current + 1,
        });
      }

      const completed = cycleRef.current + 1;
      setCycle(completed);
      if (currentTask) {
        await updateTaskProgress(currentTask.id, completed);
      }

      const hasNextRound =
        currentPlan.timerMode === 'countdown' && completed < currentPlan.cyclesPlanned;

      if (notificationsEnabled) {
        await platform.notification.notify(
          '专注结束',
          hasNextRound ? `休息 ${currentPlan.breakMinutes} 分钟` : '本轮专注已记录',
        );
      }

      if (hasNextRound) {
        await startPhase('break');
      } else {
        setSnapshot(null);
        setCycle(0);
        setPhase('focus');
      }
    } finally {
      busyRef.current = false;
    }
  }, [logFocus, startPhase, updateTaskProgress, settings.notifications]);

  useEffect(() => {
    if (!ready) return;
    const handle = window.setInterval(() => {
      const platform = platformRef.current;
      if (!platform) return;
      void platform.focus.status().then((next) => {
        setSnapshot(next);
        if (next.running && next.remaining_seconds === 0) {
          void finishRound();
        }
      });
    }, 500);
    return () => window.clearInterval(handle);
  }, [ready, finishRound]);

  const totalSeconds = (phase === 'focus' ? plan.focusMinutes : plan.breakMinutes) * 60;
  const started = Boolean(snapshot && snapshot.planned_seconds === totalSeconds);
  const running = snapshot?.running ?? false;
  const remaining = started ? (snapshot?.remaining_seconds ?? totalSeconds) : totalSeconds;
  const progress = totalSeconds === 0 ? 0 : 1 - remaining / totalSeconds;

  const todayMinutes = Math.round(
    focusSessions
      .filter(
        (session) => session.mode === 'focus' && isSameDay(parseISO(session.startedAt), new Date()),
      )
      .reduce((sum, session) => sum + session.actualSeconds, 0) / 60,
  );

  async function toggleRunning() {
    const platform = platformRef.current;
    if (!platform) return;

    if (!started) {
      await startPhase(phase);
      return;
    }
    if (snapshot?.running) {
      setSnapshot(await platform.focus.pause());
    } else {
      setSnapshot(await platform.focus.resume());
    }
  }

  async function abandon() {
    const platform = platformRef.current;
    if (!platform) return;
    const result = await platform.focus.stop();
    if (result.mode === 'focus' && result.actual_seconds > 0) {
      await logFocus({
        plannedSeconds: result.planned_seconds,
        actualSeconds: result.actual_seconds,
        mode: 'focus',
        taskId: result.task_id ?? undefined,
        note: '放弃本轮',
        startedAt: result.started_at_ms
          ? new Date(result.started_at_ms).toISOString()
          : undefined,
        cycleIndex: cycle + 1,
        abandoned: true,
      });
    }
    setSnapshot(null);
    setCycle(0);
    setPhase('focus');
  }

  async function skipBreak() {
    const platform = platformRef.current;
    if (!platform) return;
    await platform.focus.stop();
    await startPhase('focus');
  }

  async function handleQuickCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const task = await addTask({
      title: quickTitle,
      note: quickNote || undefined,
      timerMode: quickMode,
      focusMinutes: quickFocus,
      breakMinutes: quickBreak,
      cyclesPlanned: quickCycles,
      categoryId: quickCategory || undefined,
      dueAt: quickDue ? new Date(quickDue).toISOString() : undefined,
    });
    if (!task) return;

    setSelectedTaskId(task.id);
    setQuickOpen(false);
    setQuickTitle('');
    setQuickNote('');
    setQuickCategory('');
    setQuickDue('');
  }

  const planMinutes = totalPlannedMinutes(plan);

  return (
    <div className="page focus-page">
      <header className="page-header">
        <div>
          <p className="muted">一次只做一件事</p>
          <h1>专注</h1>
        </div>
        <div className="header-badge">今日 {todayMinutes} 分钟</div>
      </header>

      <div className="focus-layout">
        <section className="surface-card focus-stage">
          <div className="focus-task-bar">
            <label className="focus-select">
              <span className="muted">当前任务</span>
              <select
                value={selectedTaskId}
                onChange={(event) => {
                  setSelectedTaskId(event.target.value);
                  setSnapshot(null);

                  setPhase('focus');
                }}
              >
                <option value="">不指定任务（使用全局设置）</option>
                {tasks
                  .filter((task) => task.status !== 'done' && task.status !== 'archived')
                  .map((task) => (
                    <option key={task.id} value={task.id}>
                      {task.title}
                    </option>
                  ))}
              </select>
            </label>
            <button
              type="button"
              className="ghost-button"
              onClick={() => setQuickOpen((current) => !current)}
            >
              {quickOpen ? '收起' : '快速新建任务'}
            </button>
          </div>

          {quickOpen ? (
            <form className="quick-task" onSubmit={handleQuickCreate}>
              <input
                value={quickTitle}
                onChange={(event) => setQuickTitle(event.target.value)}
                placeholder="任务名称，例如：背单词"
                aria-label="任务名称"
                required
              />
              <div className="quick-task-row">
                <select
                  value={quickMode}
                  onChange={(event) => setQuickMode(event.target.value as TimerMode)}
                  aria-label="计时模式"
                >
                  {(Object.keys(TIMER_MODE_LABEL) as TimerMode[]).map((mode) => (
                    <option key={mode} value={mode}>
                      {TIMER_MODE_LABEL[mode]}
                    </option>
                  ))}
                </select>
                {quickMode === 'countdown' ? (
                  <>
                    <label>
                      番茄
                      <input
                        type="number"
                        min={1}
                        value={quickFocus}
                        onChange={(event) => setQuickFocus(Number(event.target.value))}
                      />
                    </label>
                    <label>
                      休息
                      <input
                        type="number"
                        min={1}
                        value={quickBreak}
                        onChange={(event) => setQuickBreak(Number(event.target.value))}
                      />
                    </label>
                    <label>
                      轮数
                      <input
                        type="number"
                        min={1}
                        value={quickCycles}
                        onChange={(event) => setQuickCycles(Number(event.target.value))}
                      />
                    </label>
                  </>
                ) : null}
              </div>
              <input
                value={quickNote}
                onChange={(event) => setQuickNote(event.target.value)}
                placeholder="备注（可选）"
                aria-label="任务备注"
              />
              <div className="quick-task-row">
                <select
                  value={quickCategory}
                  onChange={(event) => setQuickCategory(event.target.value)}
                  aria-label="任务分类"
                >
                  <option value="">未分类</option>
                  {categories.map((category) => (
                    <option key={category.id} value={category.id}>
                      {category.name}
                    </option>
                  ))}
                </select>
                <input
                  type="datetime-local"
                  value={quickDue}
                  onChange={(event) => setQuickDue(event.target.value)}
                  aria-label="任务截止时间"
                />
              </div>
              <div className="quick-task-actions">
                <button type="button" className="ghost-button" onClick={() => setQuickOpen(false)}>
                  取消
                </button>
                <button type="submit" className="primary-button">
                  创建并选中
                </button>
              </div>
            </form>
          ) : null}

          <div className="focus-plan">
            <span>{TIMER_MODE_LABEL[plan.timerMode]}</span>
            {plan.timerMode === 'countdown' ? (
              <span className="muted">
                {plan.focusMinutes}+{plan.breakMinutes} × {plan.cyclesPlanned}
                {planMinutes > 0 ? ` · 预计 ${planMinutes} 分钟` : ''}
              </span>
            ) : null}
            {plan.timerMode === 'countdown' && started ? (
              <span className="muted">{cycleLabel(cycle, plan.cyclesPlanned)}</span>
            ) : null}
          </div>

          <div
            className={clsx('focus-ring', phase === 'break' && 'is-break')}
            style={{ background: `conic-gradient(var(--color-primary) ${progress * 100}%, var(--color-surface-muted) 0)` }}
            role="timer"
            aria-live="off"
          >
            <div className="focus-ring-inner">
              <span className="focus-clock">{formatClock(remaining)}</span>
              <span className="muted">
                {phase === 'break' ? '休息一下' : plan.timerMode === 'stopwatch' ? '正计时' : '专注中'}
              </span>
            </div>
          </div>

          <div className="focus-actions">
            <button type="button" className="primary-button" onClick={() => void toggleRunning()}>
              {running ? '暂停' : started ? '继续' : '开始'}
            </button>
            <button type="button" className="ghost-button" onClick={() => void abandon()}>
              放弃
            </button>
            {phase === 'break' ? (
              <button type="button" className="ghost-button" onClick={() => void skipBreak()}>
                跳过休息
              </button>
            ) : null}
          </div>

          <p className="page-foot muted">
            桌面端由 Rust 计时；倒计时按「专注 → 休息 → 下一轮」执行，完成记录写入时间轴。
          </p>
        </section>

        <aside className="surface-card panel focus-summary">
          <h2 className="section-title">专注记录</h2>
          {focusSessions.length === 0 ? (
            <p className="empty-hint">完成第一次专注后，这里会生成记录并写入时间轴。</p>
          ) : (
            <ul className="focus-log">
              {[...focusSessions]
                .reverse()
                .slice(0, 6)
                .map((session) => (
                  <li key={session.id}>
                    <span className={clsx('log-dot', session.mode === 'break' && 'is-break')} />
                    <div>
                      <strong>{Math.round(session.actualSeconds / 60)} 分钟</strong>
                      <span className="muted">
                        {session.mode === 'focus' ? '专注' : '休息'}
                        {session.cycleIndex ? ` · 第 ${session.cycleIndex} 轮` : ''}
                        {session.abandoned ? ' · 已放弃' : ''}
                      </span>
                    </div>
                  </li>
                ))}
            </ul>
          )}
          <p className="page-foot muted">
            {ready && platformRef.current?.kind === 'tauri'
              ? '当前使用 Rust 时钟。'
              : '当前使用浏览器计时（Web 预览模式）。'}
          </p>
        </aside>
      </div>
    </div>
  );
}