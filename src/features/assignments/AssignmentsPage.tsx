import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { invoke } from '@tauri-apps/api/core';
import { format } from 'date-fns';
import clsx from 'clsx';
import type { Assignment, AssignmentDetail } from '@/domain/models';
import {
  ASSIGNMENT_FILTERS,
  assignmentStatusLabel,
  countAssignments,
  filterAssignments,
  formatFileSize,
  isOverdue,
  remainingLabel,
  sortAssignments,
} from '@/domain/rules/assignments';
import type { AssignmentFilter } from '@/domain/rules/assignments';
import { getPlatform } from '@/platform';
import { useAppStore } from '@/state/appStore';
import {
  loadAcademicData,
  refreshBuptAcademic,
  saveAcademicData,
} from '@/features/academic/refreshAcademic';

const DETAIL_KEY = 'studydesk.assignmentDetails';

function loadDetails(): Record<string, AssignmentDetail> {
  try {
    const raw = window.localStorage.getItem(DETAIL_KEY);
    if (!raw) return {};
    const parsed: unknown = JSON.parse(raw);
    return typeof parsed === 'object' && parsed !== null
      ? (parsed as Record<string, AssignmentDetail>)
      : {};
  } catch {
    return {};
  }
}

function saveDetails(details: Record<string, AssignmentDetail>): void {
  window.localStorage.setItem(DETAIL_KEY, JSON.stringify(details));
}

function formatTime(value: string | null | undefined): string {
  if (!value) return '—';
  try {
    return format(new Date(value), 'yyyy-MM-dd HH:mm');
  } catch {
    return value;
  }
}

export function AssignmentsPage() {
  const addTask = useAppStore((state) => state.addTask);
  const addDeadline = useAppStore((state) => state.addDeadline);
  const [data, setData] = useState(() => loadAcademicData());
  const [filter, setFilter] = useState<AssignmentFilter>('all');
  const [details, setDetails] = useState<Record<string, AssignmentDetail>>(loadDetails);
  const [active, setActive] = useState<Assignment | null>(null);
  const [detail, setDetail] = useState<AssignmentDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setData(loadAcademicData());
  }, []);

  const items = useMemo(() => sortAssignments(data?.assignments ?? []), [data]);
  const counts = useMemo(() => countAssignments(items), [items]);
  const visible = useMemo(() => filterAssignments(items, filter), [items, filter]);

  async function handleRefresh() {
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const result = await refreshBuptAcademic();
      setData(result.data);
      const cloudNote = result.cloudError ? `（教学云：${result.cloudError}）` : '';
      setNotice(
        `已刷新作业 ${result.data.assignments.length} 条${
          result.timetable ? `，课表 ${result.timetable.courses.length} 门` : ''
        }${cloudNote}`,
      );
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '刷新失败');
    } finally {
      setBusy(false);
    }
  }

  function updateAssignments(next: Assignment[]) {
    if (!data) return;
    const payload = { ...data, assignments: next };
    saveAcademicData(payload);
    setData(payload);
  }

  async function handleConvertToTask(item: Assignment) {
    if (item.linkedTaskId) return;
    const task = await addTask({
      title: item.title,
      note: `课程：${item.courseName}`,
      dueAt: item.dueConfirmed ? item.dueAt : undefined,
      priority: 'normal',
      source: 'assignment',
    });
    if (!task || !data) return;
    updateAssignments(
      data.assignments.map((entry) =>
        entry.id === item.id ? { ...entry, linkedTaskId: task.id } : entry,
      ),
    );
    setNotice(`已转为待办：${item.title}`);
  }

  async function handleConvertToDeadline(item: Assignment) {
    if (item.linkedDeadlineId) return;
    if (!item.dueAt) {
      setError('该作业没有确认的截止时间，无法创建倒数日');
      return;
    }
    const event = await addDeadline({
      title: item.title,
      dueAt: new Date(item.dueAt),
      location: item.courseName,
      category: 'assignment',
      note: `课程：${item.courseName}`,
    });
    if (!event || !data) return;
    updateAssignments(
      data.assignments.map((entry) =>
        entry.id === item.id ? { ...entry, linkedDeadlineId: event.id } : entry,
      ),
    );
    setNotice(`已创建倒数日：${item.title}`);
  }

  async function handleOpenDetail(item: Assignment) {
    setActive(item);
    setDetailError(null);
    setDetail(details[item.id] ?? null);
    if (details[item.id]) return;

    const platform = await getPlatform();
    if (platform.kind !== 'tauri') {
      setDetailError('作业详情需要桌面端与已保存的教学云账号');
      return;
    }

    setDetailLoading(true);
    try {
      const raw = await invoke<AssignmentDetail>('bupt_fetch_assignment_detail', {
        assignmentId: item.id,
      });
      setDetail(raw);
      const next = { ...details, [item.id]: raw };
      setDetails(next);
      saveDetails(next);
    } catch (cause) {
      setDetailError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setDetailLoading(false);
    }
  }

  function closeDetail() {
    setActive(null);
    setDetail(null);
    setDetailError(null);
  }

  return (
    <div className="page assignments-page">
      <header className="page-header">
        <div>
          <p className="muted">
            来自北邮教学云的作业；详情内容需在「设置 → 个人账号」保存教学云密码后在线获取
          </p>
          <h1>作业</h1>
        </div>
        <div className="assignment-header-actions">
          <button
            type="button"
            className="primary-button"
            disabled={busy}
            onClick={() => void handleRefresh()}
          >
            {busy ? '刷新中…' : '刷新作业'}
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
      {error ? <p className="form-error">{error}</p> : null}

      <div className="academic-summary assignment-summary">
        <span>
          全部 <strong>{counts.total}</strong>
        </span>
        <span>
          未提交 <strong>{counts.unsubmitted}</strong>
        </span>
        <span>
          已转待办/倒数日 <strong>{counts.converted}</strong>
        </span>
      </div>

      <div className="assignment-filters" role="tablist" aria-label="作业筛选">
        {ASSIGNMENT_FILTERS.map((entry) => (
          <button
            key={entry.id}
            type="button"
            role="tab"
            aria-selected={filter === entry.id}
            className={clsx('filter-chip', filter === entry.id && 'is-active')}
            onClick={() => setFilter(entry.id)}
          >
            {entry.label}
          </button>
        ))}
      </div>

      {items.length === 0 ? (
        <section className="surface-card panel">
          <p className="empty-hint">
            还没有作业数据。可以到 <Link to="/settings">设置 → 个人账号</Link> 保存账号后刷新，
            或在 <Link to="/academic">教务</Link> 页导入 JSON。
          </p>
        </section>
      ) : visible.length === 0 ? (
        <p className="empty-hint">当前筛选下没有作业。</p>
      ) : (
        <section className="assignment-list">
          {visible.map((item) => {
            const overdue = isOverdue(item);
            return (
              <article
                key={item.id}
                className={clsx('assignment-card', overdue && 'is-overdue', item.linkedTaskId && 'is-converted')}
              >
                <div className="assignment-card-main">
                  <div className="assignment-card-head">
                    <span className="assignment-course">{item.courseName}</span>
                    <span className={clsx('assignment-badge', `is-${item.status}`)}>
                      {assignmentStatusLabel(item)}
                    </span>
                  </div>
                  <h2 className="assignment-title">{item.title}</h2>
                  <p className={clsx('assignment-due', overdue && 'is-overdue')}>
                    {remainingLabel(item.dueAt)}
                    {item.dueAt ? ` · ${formatTime(item.dueAt)}` : ''}
                  </p>
                </div>
                <div className="assignment-card-actions">
                  <button type="button" className="ghost-button" onClick={() => void handleOpenDetail(item)}>
                    详情
                  </button>
                  {item.linkedTaskId ? (
                    <span className="muted">已转待办</span>
                  ) : (
                    <button type="button" className="ghost-button" onClick={() => void handleConvertToTask(item)}>
                      转待办
                    </button>
                  )}
                  {item.linkedDeadlineId ? (
                    <span className="muted">已建倒数日</span>
                  ) : (
                    <button
                      type="button"
                      className="ghost-button"
                      disabled={!item.dueAt}
                      onClick={() => void handleConvertToDeadline(item)}
                    >
                      加倒数日
                    </button>
                  )}
                </div>
              </article>
            );
          })}
        </section>
      )}

      {active ? (
        <div className="assignment-drawer-backdrop" role="presentation" onClick={closeDetail}>
          <aside
            className="assignment-drawer"
            role="dialog"
            aria-modal="true"
            aria-label="作业详情"
            onClick={(event) => event.stopPropagation()}
          >
            <header className="assignment-drawer-head">
              <div>
                <p className="muted">{active.courseName}</p>
                <h2>{active.title}</h2>
              </div>
              <button type="button" className="ghost-button" onClick={closeDetail}>
                关闭
              </button>
            </header>

            {detailLoading ? (
              <p className="empty-hint">正在从教学云获取详情…</p>
            ) : detailError ? (
              <p className="form-error">{detailError}</p>
            ) : detail ? (
              <div className="assignment-detail-body">
                <dl className="assignment-detail-meta">
                  <div>
                    <dt>开始时间</dt>
                    <dd>{formatTime(detail.beginAt)}</dd>
                  </div>
                  <div>
                    <dt>截止时间</dt>
                    <dd>{formatTime(detail.dueAt)}</dd>
                  </div>
                  <div>
                    <dt>能否逾期补交</dt>
                    <dd>{typeof detail.allowLate === 'boolean' ? (detail.allowLate ? '能' : '不能') : '—'}</dd>
                  </div>
                  <div>
                    <dt>作业模式</dt>
                    <dd>{detail.mode || '—'}</dd>
                  </div>
                  <div>
                    <dt>班级</dt>
                    <dd>{detail.className || detail.groupName || '—'}</dd>
                  </div>
                  <div>
                    <dt>联系章节</dt>
                    <dd>{detail.chapterName || '—'}</dd>
                  </div>
                  <div>
                    <dt>总分数</dt>
                    <dd>{typeof detail.fullMark === 'number' ? `${detail.fullMark} 分` : '—'}</dd>
                  </div>
                  <div>
                    <dt>阶段</dt>
                    <dd>{detail.statusText || '—'}</dd>
                  </div>
                </dl>

                <section>
                  <h3 className="section-title">作业内容</h3>
                  {detail.contentText ? (
                    <p className="assignment-detail-content">{detail.contentText}</p>
                  ) : (
                    <p className="empty-hint">作业内容为空，可能在附件中。</p>
                  )}
                  {detail.images.length > 0 ? (
                    <div className="assignment-detail-images">
                      {detail.images.map((source) => (
                        <img key={source} src={source} alt="作业图片" loading="lazy" />
                      ))}
                    </div>
                  ) : null}
                </section>

                <section>
                  <h3 className="section-title">附件</h3>
                  {detail.attachments.length === 0 ? (
                    <p className="empty-hint">无附件。</p>
                  ) : (
                    <ul className="assignment-attachments">
                      {detail.attachments.map((attachment) => (
                        <li key={attachment.name}>
                          <span>{attachment.name}</span>
                          <span className="muted">{formatFileSize(attachment.size)}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </section>

                <div className="assignment-drawer-actions">
                  <button
                    type="button"
                    className="ghost-button"
                    disabled={Boolean(active.linkedTaskId)}
                    onClick={() => void handleConvertToTask(active)}
                  >
                    转待办
                  </button>
                  <button
                    type="button"
                    className="ghost-button"
                    disabled={Boolean(active.linkedDeadlineId) || !active.dueAt}
                    onClick={() => void handleConvertToDeadline(active)}
                  >
                    加倒数日
                  </button>
                </div>
              </div>
            ) : (
              <p className="empty-hint">暂无详情。</p>
            )}
          </aside>
        </div>
      ) : null}
    </div>
  );
}