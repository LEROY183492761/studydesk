import { describe, expect, it } from 'vitest';
import { mergeAcademicPayload, parseAcademicPayload } from '@/domain/rules/academicImport';

const valid = JSON.stringify({
  term: '2026 秋',
  grades: [
    { id: 'g1', courseId: 'c1', courseName: '线性代数', credit: 3, score: 92, gradePoint: 4.2 },
  ],
  exams: [
    {
      id: 'e1',
      courseId: 'c1',
      courseName: '线性代数',
      title: '期末考试',
      startAt: '2027-01-10T09:00:00.000Z',
      confirmed: true,
    },
  ],
  assignments: [
    { id: 'a1', courseId: 'c1', courseName: '线性代数', title: '第三次作业', dueAt: '2026-12-05T23:59:00.000Z' },
  ],
});

describe('教务导入解析', () => {
  it('解析成绩、考试与作业', () => {
    const payload = parseAcademicPayload(valid);
    expect(payload.term).toBe('2026 秋');
    expect(payload.grades).toHaveLength(1);
    expect(payload.grades[0].score).toBe(92);
    expect(payload.exams[0].confirmed).toBe(true);
    expect(payload.assignments[0].title).toBe('第三次作业');
  });

  it('拒绝非法 JSON 与缺少学期', () => {
    expect(() => parseAcademicPayload('{')).toThrow('不是有效的 JSON');
    expect(() => parseAcademicPayload(JSON.stringify({ grades: [] }))).toThrow('term');
  });

  it('文本或 null 成绩保持未公布，不误读为 0', () => {
    const payload = parseAcademicPayload(
      JSON.stringify({
        term: '2026 秋',
        grades: [
          { id: 'g1', courseId: 'c1', courseName: '体育', credit: 1, score: null },
          { id: 'g2', courseId: 'c2', courseName: '军训', credit: 1, score: '优秀' },
        ],
        exams: [],
        assignments: [],
      }),
    );

    expect(payload.grades[0].score).toBeUndefined();
    expect(payload.grades[1].score).toBeUndefined();
  });

  it('解析教学云提交状态与关联标记', () => {
    const payload = parseAcademicPayload(
      JSON.stringify({
        term: '2026 秋',
        grades: [],
        exams: [],
        assignments: [
          {
            id: 'a1',
            courseId: 'c1',
            courseName: '线性代数',
            title: '作业',
            statusCode: 99,
            statusText: '未提交',
            phaseCode: 2,
            linkedDeadlineId: 'e1',
          },
          {
            id: 'a2',
            courseId: 'c1',
            courseName: '线性代数',
            title: '作业2',
            status: 'graded',
          },
        ],
      }),
    );

    expect(payload.assignments[0].status).toBe('pending');
    expect(payload.assignments[0].statusCode).toBe(99);
    expect(payload.assignments[0].phaseCode).toBe(2);
    expect(payload.assignments[0].linkedDeadlineId).toBe('e1');
    expect(payload.assignments[1].status).toBe('graded');
  });

  it('合并导入按 id upsert 并保留 linkedTaskId', () => {
    const current = parseAcademicPayload(
      JSON.stringify({
        term: '2026 秋',
        grades: [{ id: 'g1', courseId: 'c1', courseName: '线性代数', credit: 3, score: 80 }],
        exams: [],
        assignments: [
          { id: 'a1', courseId: 'c1', courseName: '线性代数', title: '作业', linkedTaskId: 't1', linkedDeadlineId: 'e1' },
        ],
      }),
    );
    const incoming = parseAcademicPayload(
      JSON.stringify({
        term: '2026 秋',
        grades: [{ id: 'g1', courseId: 'c1', courseName: '线性代数', credit: 3, score: 95 }],
        exams: [],
        assignments: [
          { id: 'a1', courseId: 'c1', courseName: '线性代数', title: '作业（更新）' },
        ],
      }),
    );

    const merged = mergeAcademicPayload(current, incoming);
    expect(merged.grades[0].score).toBe(95);
    expect(merged.assignments[0].title).toBe('作业（更新）');
    expect(merged.assignments[0].linkedTaskId).toBe('t1');
    expect(merged.assignments[0].linkedDeadlineId).toBe('e1');
  });
});