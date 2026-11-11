import type { ReviewMetrics } from '../models';

export interface ReviewQuestion {
  key: string;
  label: string;
}

export interface ReviewReportInput {
  mode: 'daily' | 'weekly';
  periodStart: string;
  periodEnd: string;
  metrics: ReviewMetrics;
  answers: Record<string, string>;
  questions: ReviewQuestion[];
}

export function buildReviewMarkdown(input: ReviewReportInput): string {
  const { mode, periodStart, periodEnd, metrics, answers, questions } = input;
  const range = periodStart === periodEnd ? periodStart : `${periodStart} ~ ${periodEnd}`;

  const lines = [
    `# ${mode === 'daily' ? '日' : '周'}复盘 ${range}`,
    '',
    `- 专注：${metrics.focusMinutes} 分钟（${metrics.focusSessions} 次）`,
    `- 任务：完成 ${metrics.tasksCompleted} / 新建 ${metrics.tasksCreated}（${Math.round(
      metrics.completionRate * 100,
    )}%）`,
    `- 课程：${metrics.courseMinutes} 分钟`,
    `- 习惯达成：${Math.round(metrics.habitCompletionRate * 100)}%`,
    '',
    '## 问答',
    ...questions.map(
      (question) => `- ${question.label}：${answers[question.key]?.trim() || '（未填写）'}`,
    ),
  ];

  return lines.join('\n');
}

export interface ParsedReviewReport {
  metrics: Partial<ReviewMetrics>;
  answers: Record<string, string>;
}

function numberMatch(text: string, pattern: RegExp): number | undefined {
  const match = pattern.exec(text);
  if (!match) return undefined;
  const value = Number(match[1]);
  return Number.isFinite(value) ? value : undefined;
}

export function parseReviewMarkdown(
  text: string,
  questions: ReviewQuestion[],
): ParsedReviewReport {
  const metrics: Partial<ReviewMetrics> = {};

  const focusMinutes = numberMatch(text, /- 专注：(\d+)\s*分钟/);
  if (focusMinutes !== undefined) metrics.focusMinutes = focusMinutes;
  const focusSessions = numberMatch(text, /- 专注：\d+\s*分钟（(\d+)\s*次）/);
  if (focusSessions !== undefined) metrics.focusSessions = focusSessions;

  const tasksCompleted = numberMatch(text, /- 任务：完成\s*(\d+)/);
  if (tasksCompleted !== undefined) metrics.tasksCompleted = tasksCompleted;
  const tasksCreated = numberMatch(text, /- 任务：完成\s*\d+\s*\/\s*新建\s*(\d+)/);
  if (tasksCreated !== undefined) metrics.tasksCreated = tasksCreated;
  const completionRate = numberMatch(text, /- 任务：.*（(\d+)%）/);
  if (completionRate !== undefined) metrics.completionRate = completionRate / 100;

  const courseMinutes = numberMatch(text, /- 课程：(\d+)\s*分钟/);
  if (courseMinutes !== undefined) metrics.courseMinutes = courseMinutes;

  const habitRate = numberMatch(text, /- 习惯达成：(\d+)%/);
  if (habitRate !== undefined) metrics.habitCompletionRate = habitRate / 100;

  const answers: Record<string, string> = {};
  for (const question of questions) {
    const match = new RegExp(`- ${question.label}：(.+)`).exec(text);
    if (!match) continue;
    const value = match[1].trim();
    if (value && value !== '（未填写）') {
      answers[question.key] = value;
    }
  }

  return { metrics, answers };
}