import type { Assignment, Exam, Grade } from '@/domain/models';

export interface AcademicImportPayload {
  term: string;
  grades: Grade[];
  exams: Exam[];
  assignments: Assignment[];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function text(value: unknown, field: string): string {
  if (typeof value !== 'string' || !value.trim()) {
    throw new Error(`字段 ${field} 需要非空字符串`);
  }
  return value.trim();
}

function optionalText(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

function optionalNumber(value: unknown): number | undefined {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : undefined;
  }
  return undefined;
}

function parseAssignmentStatus(value: unknown, statusCode?: number): Assignment['status'] {
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    if (normalized === 'pending' || normalized === 'submitted' || normalized === 'graded') {
      return normalized;
    }
  }
  switch (statusCode) {
    case 0:
      return 'submitted';
    case 1:
      return 'graded';
    case 2:
    case 99:
      return 'pending';
    default:
      return 'unknown';
  }
}

export function parseAcademicPayload(source: string): AcademicImportPayload {
  let raw: unknown;
  try {
    raw = JSON.parse(source);
  } catch {
    throw new Error('不是有效的 JSON');
  }

  if (!isRecord(raw)) throw new Error('顶层需要是对象');
  const term = text(raw.term, 'term');

  const grades = Array.isArray(raw.grades)
    ? raw.grades.map((item, index) => {
        if (!isRecord(item)) throw new Error(`grades[${index}] 需要是对象`);
        const score =
          item.score === undefined || item.score === null ? undefined : Number(item.score);
        const gradePoint =
          item.gradePoint === undefined || item.gradePoint === null
            ? undefined
            : Number(item.gradePoint);

        return {
          id: text(item.id, `grades[${index}].id`),
          courseId: text(item.courseId, `grades[${index}].courseId`),
          courseName: text(item.courseName, `grades[${index}].courseName`),
          credit: Number(item.credit ?? 0),
          score: Number.isFinite(score) ? score : undefined,
          term: optionalText(item.term) ?? term,
          gradePoint: Number.isFinite(gradePoint) ? gradePoint : undefined,
        } satisfies Grade;
      })
    : [];

  const exams = Array.isArray(raw.exams)
    ? raw.exams.map((item, index) => {
        if (!isRecord(item)) throw new Error(`exams[${index}] 需要是对象`);
        return {
          id: text(item.id, `exams[${index}].id`),
          courseId: text(item.courseId, `exams[${index}].courseId`),
          courseName: text(item.courseName, `exams[${index}].courseName`),
          title: text(item.title, `exams[${index}].title`),
          startAt: optionalText(item.startAt),
          endAt: optionalText(item.endAt),
          location: optionalText(item.location),
          confirmed: item.confirmed === true,
        } satisfies Exam;
      })
    : [];

  const assignments = Array.isArray(raw.assignments)
    ? raw.assignments.map((item, index) => {
        if (!isRecord(item)) throw new Error(`assignments[${index}] 需要是对象`);
        const statusCode = optionalNumber(item.statusCode);
        return {
          id: text(item.id, `assignments[${index}].id`),
          courseId: text(item.courseId, `assignments[${index}].courseId`),
          courseName: text(item.courseName, `assignments[${index}].courseName`),
          title: text(item.title, `assignments[${index}].title`),
          dueAt: optionalText(item.dueAt),
          status: parseAssignmentStatus(item.status, statusCode),
          statusCode,
          statusText: optionalText(item.statusText),
          phaseCode: optionalNumber(item.phaseCode),
          dueConfirmed: item.dueConfirmed === true,
          linkedTaskId: optionalText(item.linkedTaskId),
          linkedDeadlineId: optionalText(item.linkedDeadlineId),
        } satisfies Assignment;
      })
    : [];

  return { term, grades, exams, assignments };
}
function upsertById<T extends { id: string }>(current: T[], incoming: T[]): T[] {
  const map = new Map(current.map((item) => [item.id, item]));
  for (const item of incoming) {
    map.set(item.id, item);
  }
  return [...map.values()];
}

/** 增量合并：按 id upsert，保留本地已转待办/倒数日的关联 */
export function mergeAcademicPayload(
  current: AcademicImportPayload,
  incoming: AcademicImportPayload,
): AcademicImportPayload {
  const assignments = incoming.assignments.map((item) => {
    const existing = current.assignments.find((entry) => entry.id === item.id);
    if (!existing) return item;
    return {
      ...item,
      linkedTaskId: item.linkedTaskId ?? existing.linkedTaskId,
      linkedDeadlineId: item.linkedDeadlineId ?? existing.linkedDeadlineId,
    };
  });

  return {
    term: incoming.term || current.term,
    grades: upsertById(current.grades, incoming.grades),
    exams: upsertById(current.exams, incoming.exams),
    assignments: upsertById(current.assignments, assignments),
  };
}