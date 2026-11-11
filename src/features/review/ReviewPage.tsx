import { useMemo, useRef, useState } from 'react';
import type { ChangeEvent } from 'react';
import { addDays, eachDayOfInterval, format, startOfWeek } from 'date-fns';
import clsx from 'clsx';
import type { ReviewMetrics } from '@/domain/models';
import { DonutChart } from '@/components/charts/DonutChart';
import { Heatmap, HeatmapLegend } from '@/components/charts/Heatmap';
import { TrendChart } from '@/components/charts/TrendChart';
import { buildCalendarItems, dayRange, weekRange } from '@/domain/selectors/calendar';
import { computeWeeklyMetrics } from '@/domain/selectors/review';
import {
  computeDailyHeatmap,
  computeFocusBreakdown,
  heatmapSummary,
} from '@/domain/selectors/reviewCharts';
import type { HeatmapMode } from '@/domain/selectors/reviewCharts';
import { computeDailyMetrics } from '@/domain/selectors/reviewMetrics';
import { buildReviewMarkdown, parseReviewMarkdown } from '@/domain/rules/reviewReport';
import { formatDateLabel } from '@/lib/dates';
import { useAppStore } from '@/state/appStore';

type ReviewMode = 'daily' | 'weekly';

const QUESTIONS = [
  { key: 'win', label: '最值得肯定的一件事' },
  { key: 'blocker', label: '最大的干扰或卡点' },
  { key: 'next', label: '接下来最重要的一件事' },
  { key: 'mood', label: '心情（1–5）' },
  { key: 'sleep', label: '睡眠（小时）' },
];

function formatFocusDuration(minutes: number, seconds?: number): string {
  const total = seconds ?? minutes * 60;
  const wholeMinutes = Math.floor(total / 60);
  const rest = total % 60;
  return rest > 0 ? `${wholeMinutes}分${rest}秒` : `${wholeMinutes}分钟`;
}

export function ReviewPage() {
  const [mode, setMode] = useState<ReviewMode>('daily');
  const [anchor, setAnchor] = useState(() => new Date());
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [notice, setNotice] = useState<string | null>(null);
  const [heatmapMode, setHeatmapMode] = useState<HeatmapMode>('focus');
  const [heatmapWeeks, setHeatmapWeeks] = useState(12);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const tasks = useAppStore((state) => state.tasks);
  const focusSessions = useAppStore((state) => state.focusSessions);
  const events = useAppStore((state) => state.events);
  const timetable = useAppStore((state) => state.timetable);
  const habits = useAppStore((state) => state.habits);
  const habitLogs = useAppStore((state) => state.habitLogs);
  const categories = useAppStore((state) => state.categories);
  const reviews = useAppStore((state) => state.reviews);
  const addReview = useAppStore((state) => state.addReview);
  const removeReview = useAppStore((state) => state.removeReview);

  const weekStart = useMemo(() => startOfWeek(anchor, { weekStartsOn: 1 }), [anchor]);
  const weekEnd = useMemo(() => addDays(weekStart, 6), [weekStart]);

  const dayItems = useMemo(
    () => buildCalendarItems({ timetable, events, tasks, range: dayRange(anchor) }),
    [timetable, events, tasks, anchor],
  );
  const weekItems = useMemo(
    () => buildCalendarItems({ timetable, events, tasks, range: weekRange(anchor, 1) }),
    [timetable, events, tasks, anchor],
  );

  const dailyMetrics = useMemo(
    () =>
      computeDailyMetrics({
        date: format(anchor, 'yyyy-MM-dd'),
        tasks,
        items: dayItems,
        focusSessions,
        habits,
        habitLogs,
      }),
    [anchor, tasks, dayItems, focusSessions, habits, habitLogs],
  );

  const weeklyMetrics = useMemo(
    () =>
      computeWeeklyMetrics({
        weekStart,
        weekEnd,
        tasks,
        items: weekItems,
        focusSessions,
        habits,
        habitLogs,
      }),
    [weekStart, weekEnd, tasks, weekItems, focusSessions, habits, habitLogs],
  );

  const metrics: ReviewMetrics =
    mode === 'daily'
      ? dailyMetrics
      : {
          focusMinutes: weeklyMetrics.focusMinutes,
          focusSeconds: weeklyMetrics.focusSeconds,
          abandonedSessions: weeklyMetrics.abandonedSessions,
          focusSessions: weeklyMetrics.focusSessions,
          tasksCompleted: weeklyMetrics.tasksCompleted,
          tasksCreated: weeklyMetrics.tasksCreated,
          completionRate: weeklyMetrics.completionRate,
          courseMinutes: weeklyMetrics.courseMinutes,
          habitCompletionRate: weeklyMetrics.habitCompletionRate,
        };

  const periodStart = mode === 'daily' ? format(anchor, 'yyyy-MM-dd') : format(weekStart, 'yyyy-MM-dd');
  const periodEnd = mode === 'daily' ? format(anchor, 'yyyy-MM-dd') : format(weekEnd, 'yyyy-MM-dd');
  const history = reviews.filter((review) => review.type === mode).slice(0, 5);

  function navigate(delta: number) {
    setAnchor((current) => addDays(current, mode === 'daily' ? delta : delta * 7));
  }

  async function handleSave() {
    await addReview({ type: mode, periodStart, periodEnd, metrics, answers });
    setAnswers({});
    setNotice(`已保存${mode === 'daily' ? '日' : '周'}复盘`);
  }

  function buildReport(): string {
    return buildReviewMarkdown({
      mode,
      periodStart,
      periodEnd,
      metrics,
      answers,
      questions: QUESTIONS,
    });
  }

  async function copyReport() {
    try {
      await navigator.clipboard.writeText(buildReport());
      setNotice('复盘已复制到剪贴板');
    } catch {
      setNotice('复制失败，请检查剪贴板权限');
    }
  }

  function exportReport() {
    const blob = new Blob([buildReport()], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `studydesk-复盘-${periodStart}${
      periodStart === periodEnd ? '' : `-${periodEnd}`
    }.md`;
    link.click();
    URL.revokeObjectURL(url);
    setNotice('复盘已导出为 Markdown');
  }

  async function handleImportFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;

    const text = await file.text();
    const parsed = parseReviewMarkdown(text, QUESTIONS);
    if (Object.keys(parsed.answers).length === 0) {
      setNotice('未识别到问答内容');
      return;
    }
    setAnswers(parsed.answers);
    setNotice('已从 Markdown 导入问答（指标仍按当前数据计算）');
  }

  const rangeStart =
    mode === 'daily'
      ? new Date(anchor.getFullYear(), anchor.getMonth(), anchor.getDate())
      : weekStart;
  const rangeEnd =
    mode === 'daily'
      ? new Date(anchor.getFullYear(), anchor.getMonth(), anchor.getDate(), 23, 59, 59)
      : new Date(weekEnd.getFullYear(), weekEnd.getMonth(), weekEnd.getDate(), 23, 59, 59);

  const breakdown = computeFocusBreakdown({
    focusSessions,
    tasks,
    categories,
    rangeStart,
    rangeEnd,
    dayCount: mode === 'daily' ? 1 : 7,
  });

  const previousBreakdown = computeFocusBreakdown({
    focusSessions,
    tasks,
    categories,
    rangeStart: mode === 'daily' ? addDays(rangeStart, -1) : addDays(rangeStart, -7),
    rangeEnd: mode === 'daily' ? addDays(rangeEnd, -1) : addDays(rangeEnd, -7),
    dayCount: mode === 'daily' ? 1 : 7,
  });

  const deltaPercent =
    previousBreakdown.totalMinutes === 0
      ? null
      : Math.round(
          ((breakdown.totalMinutes - previousBreakdown.totalMinutes) /
            previousBreakdown.totalMinutes) *
            100,
        );

  const heatmap = useMemo(() => {
    const base = startOfWeek(new Date(), { weekStartsOn: 1 });
    const start = addDays(base, -7 * (heatmapWeeks - 1));
    const end = addDays(base, 6);
    const days = eachDayOfInterval({ start, end });
    const items = buildCalendarItems({
      timetable,
      events,
      tasks,
      range: { start, end },
    });
    const cells = computeDailyHeatmap({ days, focusSessions, items, mode: heatmapMode });

    return { cells, summary: heatmapSummary(cells) };
  }, [timetable, events, tasks, focusSessions, heatmapMode, heatmapWeeks]);

  const cards = [
    {
      label: '专注时长',
      value: formatFocusDuration(metrics.focusMinutes, metrics.focusSeconds),
    },
    { label: '放弃次数', value: metrics.abandonedSessions ?? 0 },
    { label: '专注次数', value: metrics.focusSessions },
    { label: '完成任务', value: metrics.tasksCompleted },
    { label: '新建任务', value: metrics.tasksCreated },
    { label: '完成率', value: `${Math.round(metrics.completionRate * 100)}%` },
    { label: '课程分钟', value: metrics.courseMinutes },
    { label: '习惯达成', value: `${Math.round(metrics.habitCompletionRate * 100)}%` },
  ];

  return (
    <div className="page review-page">
      <header className="page-header">
        <div>
          <p className="muted">
            {mode === 'daily'
              ? formatDateLabel(anchor, 'yyyy 年 M 月 d 日')
              : `${formatDateLabel(weekStart, 'M 月 d 日')} – ${formatDateLabel(weekEnd, 'M 月 d 日')}`}
          </p>
          <h1>复盘</h1>
        </div>
        <div className="calendar-tools">
          <div className="segmented" role="group" aria-label="复盘范围">
            <button
              type="button"
              className={clsx(mode === 'daily' && 'is-active')}
              aria-pressed={mode === 'daily'}
              onClick={() => setMode('daily')}
            >
              日
            </button>
            <button
              type="button"
              className={clsx(mode === 'weekly' && 'is-active')}
              aria-pressed={mode === 'weekly'}
              onClick={() => setMode('weekly')}
            >
              周
            </button>
          </div>
          <div className="calendar-nav">
            <button type="button" className="ghost-button" onClick={() => navigate(-1)} aria-label="上一段">
              ‹
            </button>
            <button type="button" className="ghost-button" onClick={() => setAnchor(new Date())}>
              今天
            </button>
            <button type="button" className="ghost-button" onClick={() => navigate(1)} aria-label="下一段">
              ›
            </button>
          </div>
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

      <div className="review-layout">
        <section className="surface-card panel">
          <div className="panel-head">
            <h2 className="section-title">自动指标</h2>
            <div className="panel-actions">
              <span className="muted">来自专注、任务与课程记录</span>
              <button type="button" className="ghost-button" onClick={() => void copyReport()}>
                复制复盘
              </button>
              <button type="button" className="ghost-button" onClick={exportReport}>
                导出 .md
              </button>
              <button
                type="button"
                className="ghost-button"
                onClick={() => fileInputRef.current?.click()}
              >
                导入 .md
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept=".md,text/markdown,text/plain"
                className="visually-hidden"
                aria-label="导入复盘 Markdown"
                onChange={(event) => void handleImportFile(event)}
              />
            </div>
          </div>

          <div className="review-metrics">
            {cards.map((card) => (
              <div key={card.label} className="metric-card">
                <strong>{card.value}</strong>
                <span>{card.label}</span>
              </div>
            ))}
          </div>

          <div className="review-charts">
            <section className="chart-card">
              <div className="panel-head">
                <h3 className="section-title">专注分布</h3>
                <span className="muted">
                  {breakdown.totalMinutes} 分钟 · 日均 {breakdown.dailyAverage}
                </span>
              </div>

              {breakdown.slices.length === 0 ? (
                <p className="empty-hint">该区间还没有专注记录。</p>
              ) : (
                <div className="donut-layout">
                  <DonutChart slices={breakdown.slices} />
                  <ul className="donut-legend">
                    {breakdown.slices.slice(0, 6).map((slice) => (
                      <li key={slice.key}>
                        <span className="legend-dot" style={{ background: slice.color }} />
                        <span className="legend-label">{slice.label}</span>
                        <span className="muted">
                          {Math.round(slice.percent * 100)}% · {slice.minutes} 分钟
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              <p className="page-foot muted">
                {deltaPercent === null
                  ? '上一周期暂无数据'
                  : `比上期 ${deltaPercent >= 0 ? '+' : ''}${deltaPercent}%`}
                {mode === 'weekly' && weeklyMetrics.bestFocusDate
                  ? ` · 最佳专注日 ${weeklyMetrics.bestFocusDate}`
                  : ''}
              </p>
            </section>

            <section className="chart-card">
              <div className="panel-head">
                <h3 className="section-title">学习热力图</h3>
                <select
                  className="heatmap-range"
                  value={heatmapWeeks}
                  onChange={(event) => setHeatmapWeeks(Number(event.target.value))}
                  aria-label="热力图范围"
                >
                  <option value={12}>近 12 周</option>
                  <option value={26}>近 26 周</option>
                  <option value={53}>近 53 周</option>
                </select>
                <div className="segmented" role="group" aria-label="热力图口径">
                  <button
                    type="button"
                    className={clsx(heatmapMode === 'focus' && 'is-active')}
                    aria-pressed={heatmapMode === 'focus'}
                    onClick={() => setHeatmapMode('focus')}
                  >
                    专注
                  </button>
                  <button
                    type="button"
                    className={clsx(heatmapMode === 'all' && 'is-active')}
                    aria-pressed={heatmapMode === 'all'}
                    onClick={() => setHeatmapMode('all')}
                  >
                    专注+课程
                  </button>
                </div>
              </div>

              <div className="heatmap-summary">
                <span>累计 {heatmap.summary.totalMinutes} 分钟</span>
                <span>学习 {heatmap.summary.activeDays} 天</span>
                <span>日均 {heatmap.summary.averageMinutes} 分钟</span>
              </div>

              <Heatmap
                cells={heatmap.cells}
                color={heatmapMode === 'focus' ? 'var(--color-primary)' : 'var(--color-success)'}
                autoScroll={heatmapWeeks > 12}
              />
              <HeatmapLegend />
            </section>

            <section className="surface-card panel">
              <div className="panel-head">
                <h3 className="section-title">专注趋势</h3>
                <span className="muted">当前周期每日分钟</span>
              </div>
              <TrendChart
                points={weeklyMetrics.days.map((day) => ({
                  label: day.date.slice(5),
                  value: day.metrics.focusMinutes,
                }))}
              />
            </section>
          </div>

          <div className="review-form">
            {QUESTIONS.map((question) => (
              <label key={question.key} className="review-question">
                <span>{question.label}</span>
                <textarea
                  value={answers[question.key] ?? ''}
                  onChange={(event) =>
                    setAnswers((current) => ({ ...current, [question.key]: event.target.value }))
                  }
                  rows={2}
                  aria-label={question.label}
                />
              </label>
            ))}
            <button type="button" className="primary-button" onClick={() => void handleSave()}>
              保存复盘
            </button>
          </div>
        </section>

        <aside className="surface-card panel">
          <div className="panel-head">
            <h2 className="section-title">历史复盘</h2>
            <span className="muted">{history.length} 条</span>
          </div>
          {history.length === 0 ? (
            <p className="empty-hint">还没有记录。</p>
          ) : (
            <ul className="review-history">
              {history.map((review) => (
                <li key={review.id}>
                  <div>
                    <strong>
                      {review.periodStart === review.periodEnd
                        ? review.periodStart
                        : `${review.periodStart} – ${review.periodEnd}`}
                    </strong>
                    <span className="muted">
                      完成率 {Math.round(review.metrics.completionRate * 100)}% · 专注{' '}
                      {formatFocusDuration(
                        review.metrics.focusMinutes,
                        review.metrics.focusSeconds,
                      )}
                    </span>
                  </div>
                  <button
                    type="button"
                    className="ghost-button"
                    aria-label="删除复盘"
                    onClick={() => void removeReview(review.id)}
                  >
                    删除
                  </button>
                </li>
              ))}
            </ul>
          )}
          <p className="page-foot muted">
            复盘只保存在本机；M2 之后可接入 AI 生成周报初稿。
          </p>
        </aside>
      </div>
    </div>
  );
}