import { describe, expect, it } from 'vitest';
import { buildReviewMarkdown, parseReviewMarkdown } from '@/domain/rules/reviewReport';
import type { ReviewMetrics } from '@/domain/models';

const questions = [
  { key: 'win', label: '最值得肯定的一件事' },
  { key: 'blocker', label: '最大的干扰或卡点' },
  { key: 'next', label: '接下来最重要的一件事' },
];

const metrics: ReviewMetrics = {
  focusMinutes: 100,
  focusSessions: 4,
  tasksCompleted: 5,
  tasksCreated: 7,
  completionRate: 0.714,
  courseMinutes: 240,
  habitCompletionRate: 0.8,
};

describe('复盘 Markdown', () => {
  it('生成包含指标与问答的 Markdown', () => {
    const markdown = buildReviewMarkdown({
      mode: 'weekly',
      periodStart: '2026-09-07',
      periodEnd: '2026-09-13',
      metrics,
      answers: { win: '完成实验', blocker: '手机' },
      questions,
    });

    expect(markdown).toContain('# 周复盘 2026-09-07 ~ 2026-09-13');
    expect(markdown).toContain('- 专注：100 分钟（4 次）');
    expect(markdown).toContain('- 任务：完成 5 / 新建 7（71%）');
    expect(markdown).toContain('- 课程：240 分钟');
    expect(markdown).toContain('- 习惯达成：80%');
    expect(markdown).toContain('- 最值得肯定的一件事：完成实验');
    expect(markdown).toContain('- 最大的干扰或卡点：手机');
    expect(markdown).toContain('- 接下来最重要的一件事：（未填写）');
  });

  it('能从 Markdown 读回指标与问答', () => {
    const parsed = parseReviewMarkdown(
      [
        '# 日复盘 2026-09-07',
        '',
        '- 专注：100 分钟（4 次）',
        '- 任务：完成 5 / 新建 7（71%）',
        '- 课程：240 分钟',
        '- 习惯达成：80%',
        '',
        '## 问答',
        '- 最值得肯定的一件事：完成实验',
        '- 最大的干扰或卡点：（未填写）',
        '- 接下来最重要的一件事：写了周报',
      ].join('\n'),
      questions,
    );

    expect(parsed.metrics).toMatchObject({
      focusMinutes: 100,
      focusSessions: 4,
      tasksCompleted: 5,
      tasksCreated: 7,
      courseMinutes: 240,
      habitCompletionRate: 0.8,
    });
    expect(parsed.metrics.completionRate).toBeCloseTo(0.71);
    expect(parsed.answers).toEqual({ win: '完成实验', next: '写了周报' });
  });
});