import { useMemo, useRef, useState } from 'react';
import type { DragEvent, FormEvent } from 'react';
import { format } from 'date-fns';
import clsx from 'clsx';
import type { Task, TaskPriority } from '@/domain/models';
import type { Quadrant } from '@/domain/rules/quadrants';
import {
  QUADRANT_META,
  groupByQuadrant,
  quadrantImportance,
  quadrantOf,
} from '@/domain/rules/quadrants';
import { buildCalendarItems, dayRange } from '@/domain/selectors/calendar';
import { applySchedule, scheduleConflicts } from '@/domain/rules/schedule';
import { formatTimeLabel } from '@/lib/dates';
import { useAppStore } from '@/state/appStore';

type Filter = 'open' | 'done' | 'all';
type ViewMode = 'list' | 'quadrant';

const PRIORITY_LABEL: Record<TaskPriority, string> = {
  low: '低',
  normal: '普通',
  high: '高',
  urgent: '紧急',
};

const QUADRANTS: Quadrant[] = ['q1', 'q2', 'q3', 'q4'];

export function TasksPage() {
  const [view, setView] = useState<ViewMode>('list');
  const [filter, setFilter] = useState<Filter>('open');
  const [title, setTitle] = useState('');
  const [priority, setPriority] = useState<TaskPriority>('normal');
  const [categoryId, setCategoryId] = useState('');
  const [pendingQuadrant, setPendingQuadrant] = useState<Quadrant | null>(null);
  const [categoryFilter, setCategoryFilter] = useState('');
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editDue, setEditDue] = useState('');
  const [editPriority, setEditPriority] = useState<TaskPriority>('normal');
  const [editEstimate, setEditEstimate] = useState(60);
  const [editNote, setEditNote] = useState('');

  const [schedulingId, setSchedulingId] = useState<string | null>(null);
  const [scheduleStart, setScheduleStart] = useState(() => format(new Date(), "yyyy-MM-dd'T'HH:mm"));
  const [scheduleMinutes, setScheduleMinutes] = useState(60);
  const [scheduleError, setScheduleError] = useState<string | null>(null);
  const [scheduleNotice, setScheduleNotice] = useState<string | null>(null);

  const titleInputRef = useRef<HTMLInputElement>(null);

  const tasks = useAppStore((state) => state.tasks);
  const events = useAppStore((state) => state.events);
  const timetable = useAppStore((state) => state.timetable);
  const addTask = useAppStore((state) => state.addTask);
  const toggleTask = useAppStore((state) => state.toggleTask);
  const removeTask = useAppStore((state) => state.removeTask);
  const removeEvent = useAppStore((state) => state.removeEvent);
  const scheduleTask = useAppStore((state) => state.scheduleTask);
  const unscheduleTask = useAppStore((state) => state.unscheduleTask);
  const setTaskImportance = useAppStore((state) => state.setTaskImportance);
  const categories = useAppStore((state) => state.categories);
  const setTaskCategory = useAppStore((state) => state.setTaskCategory);
  const updateTask = useAppStore((state) => state.updateTask);

  const visible = useMemo(() => {
    const sorted = [...tasks].sort((a, b) => (a.dueAt ?? '9999').localeCompare(b.dueAt ?? '9999'));
    const byStatus =
      filter === 'all'
        ? sorted
        : filter === 'done'
          ? sorted.filter((task) => task.status === 'done')
          : sorted.filter((task) => task.status !== 'done' && task.status !== 'archived');

    if (!categoryFilter) return byStatus;
    if (categoryFilter === 'none') return byStatus.filter((task) => !task.categoryId);
    return byStatus.filter((task) => task.categoryId === categoryFilter);
  }, [tasks, filter, categoryFilter]);

  const quadrants = useMemo(() => groupByQuadrant(tasks), [tasks]);
  const scheduledCount = tasks.filter(
    (task) => task.scheduledStart && task.status !== 'done',
  ).length;

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await addTask({
      title,
      priority,
      importance: pendingQuadrant ? quadrantImportance(pendingQuadrant) : undefined,
      categoryId: categoryId || undefined,
    });
    setTitle('');
    setPriority('normal');
    setPendingQuadrant(null);
  }

  async function handleRemoveTask(taskId: string) {
    const task = tasks.find((item) => item.id === taskId);
    const linkedEventId = task?.linkedEventId;
    const alsoEvent = linkedEventId
      ? window.confirm('该待办关联一条 DDL 日程，是否同时删除？')
      : false;
    if (alsoEvent && linkedEventId) {
      await removeEvent(linkedEventId);
    }
    await removeTask(taskId);
  }

  function openEdit(task: Task) {
    setEditingTaskId(task.id);
    setEditTitle(task.title);
    setEditDue(task.dueAt ? format(new Date(task.dueAt), "yyyy-MM-dd'T'HH:mm") : '');
    setEditPriority(task.priority);
    setEditEstimate(task.estimateMinutes ?? 60);
    setEditNote(task.note ?? '');
  }

  function openSchedule(taskId: string) {
    const task = tasks.find((item) => item.id === taskId);
    setSchedulingId(taskId);
    setScheduleStart(format(new Date(), "yyyy-MM-dd'T'HH:mm"));
    setScheduleMinutes(task?.estimateMinutes ?? 60);
    setScheduleError(null);
  }

  async function handleSchedule(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!schedulingId) return;

    const start = new Date(scheduleStart);
    if (Number.isNaN(start.getTime())) {
      setScheduleError('请选择有效的开始时间');
      return;
    }

    const task = tasks.find((item) => item.id === schedulingId);
    if (task) {
      const draft = applySchedule(task, start, scheduleMinutes);
      const items = buildCalendarItems({
        timetable,
        events,
        tasks,
        range: dayRange(start),
      });
      const conflicts = scheduleConflicts(draft, items);
      if (conflicts.length > 0) {
        const names = conflicts
          .slice(0, 2)
          .map((item) => item.title)
          .join('、');
        setScheduleError(`与「${names}」时间重叠，已阻止排期`);
        return;
      }

      setScheduleNotice(`已排期到 ${format(start, 'M/d HH:mm')}`);
    }

    await scheduleTask(schedulingId, start, scheduleMinutes);
    setSchedulingId(null);
  }

  async function handleEditTask(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editingTaskId) return;

    let dueAt: string | undefined;
    if (editDue) {
      const due = new Date(editDue);
      if (Number.isNaN(due.getTime())) {
        setScheduleError('请选择有效的截止时间');
        return;
      }
      dueAt = due.toISOString();
    }

    await updateTask(editingTaskId, {
      title: editTitle,
      dueAt,
      priority: editPriority,
      estimateMinutes: editEstimate,
      note: editNote || undefined,
    });
    setEditingTaskId(null);
    setScheduleNotice('任务已更新');
  }

  function openQuadrantCreate(quadrant: Quadrant) {
    setPendingQuadrant(quadrant);
    titleInputRef.current?.focus();
  }

  async function handleDropTask(event: DragEvent<HTMLElement>, target: Quadrant) {
    const taskId =
      event.dataTransfer.getData('text/plain') ||
      event.dataTransfer.getData('text/task-id');
    if (!taskId) return;
    event.preventDefault();

    const task = tasks.find((item) => item.id === taskId);
    if (!task) return;

    const importance = quadrantImportance(target);
    await setTaskImportance(taskId, importance);

    const actual = quadrantOf({ ...task, importance });
    if (actual !== target) {
      setScheduleNotice(
        `已调整重要性；紧急性由截止时间决定，任务仍落在「${QUADRANT_META[actual].title}」`,
      );
    }
  }

  return (
    <div className="page tasks-page">
      <header className="page-header">
        <div>
          <p className="muted">收集、排期、执行</p>
          <h1>待办</h1>
        </div>
        <div className="tasks-tools">
          <div className="segmented" role="group" aria-label="视图">
            <button
              type="button"
              className={clsx(view === 'list' && 'is-active')}
              aria-pressed={view === 'list'}
              onClick={() => setView('list')}
            >
              列表
            </button>
            <button
              type="button"
              className={clsx(view === 'quadrant' && 'is-active')}
              aria-pressed={view === 'quadrant'}
              onClick={() => setView('quadrant')}
            >
              四象限
            </button>
          </div>
          {view === 'list' ? (
            <div className="filter-group" role="group" aria-label="筛选待办">
              {(
                [
                  ['open', '未完成'],
                  ['done', '已完成'],
                  ['all', '全部'],
                ] as Array<[Filter, string]>
              ).map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  className={clsx('filter-chip', filter === value && 'is-active')}
                  aria-pressed={filter === value}
                  onClick={() => setFilter(value)}
                >
                  {label}
                </button>
              ))}
            </div>
          ) : null}
          {view === 'list' ? (
            <select
              className="category-filter"
              value={categoryFilter}
              onChange={(event) => setCategoryFilter(event.target.value)}
              aria-label="按分类筛选"
            >
              <option value="">全部分类</option>
              <option value="none">未分类</option>
              {categories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </select>
          ) : null}
        </div>
      </header>

      <form className="surface-card task-composer" onSubmit={handleSubmit}>
        <input
          ref={titleInputRef}
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          placeholder={
            pendingQuadrant ? `新建到「${QUADRANT_META[pendingQuadrant].title}」` : '添加待办，回车保存'
          }
          aria-label="待办标题"
        />
        <select
          value={priority}
          onChange={(event) => setPriority(event.target.value as TaskPriority)}
          aria-label="优先级"
        >
          {(Object.keys(PRIORITY_LABEL) as TaskPriority[]).map((value) => (
            <option key={value} value={value}>
              {PRIORITY_LABEL[value]}
            </option>
          ))}
        </select>
        <select
          value={categoryId}
          onChange={(event) => setCategoryId(event.target.value)}
          aria-label="分类"
        >
          <option value="">未分类</option>
          {categories.map((category) => (
            <option key={category.id} value={category.id}>
              {category.name}
            </option>
          ))}
        </select>
        <button type="submit" className="primary-button">
          添加
        </button>
      </form>

      {scheduleNotice ? (
        <div className="notice-bar" role="status">
          <span>{scheduleNotice}</span>
          <button type="button" className="ghost-button" onClick={() => setScheduleNotice(null)}>
            关闭
          </button>
        </div>
      ) : null}

      {view === 'quadrant' ? (
        <div className="quadrant-grid">
          {QUADRANTS.map((key) => (
            <section
              key={key}
              className={clsx('quadrant-cell', key)}
              onDragOver={(event) => {
                event.preventDefault();
                event.dataTransfer.dropEffect = 'move';
              }}
              onDrop={(event) => void handleDropTask(event, key)}
            >
              <header className="quadrant-head">
                <strong>{QUADRANT_META[key].title}</strong>
                <span className="muted">
                  {quadrants[key].length} 项 · {QUADRANT_META[key].hint}
                </span>
              </header>

              <div className="quadrant-items">
                {quadrants[key].map((task) => (
                  <article
                    key={task.id}
                    className="quadrant-card"
                    draggable
                    onDragStart={(event) => {
                      event.dataTransfer.setData('text/plain', task.id);
                      event.dataTransfer.setData('text/task-id', task.id);
                      event.dataTransfer.effectAllowed = 'move';
                    }}
                  >
                    <div className="quadrant-card-main">
                      <span>{task.title}</span>
                      <span className="muted">
                        {task.dueAt ? `截止 ${formatTimeLabel(task.dueAt)}` : '无截止时间'}
                        {task.priority !== 'normal' ? ` · ${PRIORITY_LABEL[task.priority]}` : ''}
                        {task.categoryId
                          ? ` · ${
                              categories.find((item) => item.id === task.categoryId)?.name ?? '未分类'
                            }`
                          : ''}
                      </span>
                    </div>
                    <button
                      type="button"
                      className="ghost-button"
                      aria-label={`完成 ${task.title}`}
                      onClick={() => void toggleTask(task.id)}
                    >
                      完成
                    </button>
                  </article>
                ))}

                <button
                  type="button"
                  className="quadrant-add"
                  onClick={() => openQuadrantCreate(key)}
                >
                  + 新建
                </button>
              </div>
            </section>
          ))}
        </div>
      ) : (
        <section className="surface-card panel">
          {visible.length === 0 ? (
            <p className="empty-hint">这里还没有待办。</p>
          ) : (
            <ul className="task-list task-list-full">
              {visible.map((task) => (
                <li
                  key={task.id}
                  className={clsx('task-item', task.status === 'done' && 'is-done')}
                >
                  <div className="task-row">
                    <button
                      type="button"
                      className={clsx('task-check', task.status === 'done' && 'is-checked')}
                      aria-label={task.status === 'done' ? `恢复 ${task.title}` : `完成 ${task.title}`}
                      onClick={() => void toggleTask(task.id)}
                    />
                    <div className="task-main">
                      <span>{task.title}</span>
                      <span className="muted task-meta">
                        优先级 {PRIORITY_LABEL[task.priority]}
                        {task.scheduledStart
                          ? ` · 已排期 ${formatTimeLabel(task.scheduledStart)}`
                          : task.dueAt
                            ? ` · 截止 ${formatTimeLabel(task.dueAt)}`
                            : ''}
                        {task.categoryId
                          ? ` · ${
                              categories.find((item) => item.id === task.categoryId)?.name ?? '未分类'
                            }`
                          : ''}
                        {task.source === 'assignment' ? ' · 来自作业' : ''}
                        {task.source === 'deadline' ? ' · 来自 DDL' : ''}
                      </span>
                    </div>
                    <select
                      className="task-category-select"
                      value={task.categoryId ?? ''}
                      onChange={(event) =>
                        void setTaskCategory(task.id, event.target.value || undefined)
                      }
                      aria-label={`修改 ${task.title} 的分类`}
                    >
                      <option value="">未分类</option>
                      {categories.map((category) => (
                        <option key={category.id} value={category.id}>
                          {category.name}
                        </option>
                      ))}
                    </select>
                    {task.scheduledStart ? (
                      <button
                        type="button"
                        className="ghost-button"
                        onClick={() => void unscheduleTask(task.id)}
                      >
                        取消排期
                      </button>
                    ) : (
                      <button
                        type="button"
                        className="ghost-button"
                        onClick={() => openSchedule(task.id)}
                      >
                        排期
                      </button>
                    )}
                    <button
                      type="button"
                      className="ghost-button"
                      onClick={() => openEdit(task)}
                    >
                      编辑
                    </button>
                    <button
                      type="button"
                      className="ghost-button"
                      aria-label={`删除 ${task.title}`}
                      onClick={() => void handleRemoveTask(task.id)}
                    >
                      删除
                    </button>
                  </div>

                  {schedulingId === task.id ? (
                    <form className="task-schedule-form" onSubmit={handleSchedule}>
                      <input
                        type="datetime-local"
                        value={scheduleStart}
                        onChange={(event) => setScheduleStart(event.target.value)}
                        aria-label="开始时间"
                      />
                      <select
                        value={scheduleMinutes}
                        onChange={(event) => setScheduleMinutes(Number(event.target.value))}
                        aria-label="时长"
                      >
                        {[15, 30, 45, 60, 90, 120].map((value) => (
                          <option key={value} value={value}>
                            {value} 分钟
                          </option>
                        ))}
                      </select>
                      <button type="submit" className="primary-button">
                        确定排期
                      </button>
                      <button
                        type="button"
                        className="ghost-button"
                        onClick={() => setSchedulingId(null)}
                      >
                        取消
                      </button>
                      {scheduleError ? <span className="form-error">{scheduleError}</span> : null}
                    </form>
                  ) : null}

                  {editingTaskId === task.id ? (
                    <form className="task-schedule-form" onSubmit={handleEditTask}>
                      <input
                        value={editTitle}
                        onChange={(event) => setEditTitle(event.target.value)}
                        aria-label="任务标题"
                        required
                      />
                      <input
                        type="datetime-local"
                        value={editDue}
                        onChange={(event) => setEditDue(event.target.value)}
                        aria-label="任务截止时间"
                      />
                      <select
                        value={editPriority}
                        onChange={(event) => setEditPriority(event.target.value as TaskPriority)}
                        aria-label="任务优先级"
                      >
                        {(Object.keys(PRIORITY_LABEL) as TaskPriority[]).map((value) => (
                          <option key={value} value={value}>
                            {PRIORITY_LABEL[value]}
                          </option>
                        ))}
                      </select>
                      <input
                        type="number"
                        min={1}
                        value={editEstimate}
                        onChange={(event) => setEditEstimate(Number(event.target.value))}
                        aria-label="预估分钟"
                      />
                      <input
                        value={editNote}
                        onChange={(event) => setEditNote(event.target.value)}
                        placeholder="备注（可选）"
                        aria-label="任务备注"
                      />
                      <button type="submit" className="primary-button">
                        保存
                      </button>
                      <button
                        type="button"
                        className="ghost-button"
                        onClick={() => setEditingTaskId(null)}
                      >
                        取消
                      </button>
                    </form>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      <p className="page-foot muted">
        当前共 {tasks.length} 项待办，{scheduledCount} 项已排期。
        {view === 'quadrant' ? ' 拖拽任务可调整重要性；紧急性由截止时间自动判断。' : ''}
      </p>
    </div>
  );
}