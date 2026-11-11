import type { EntityId, ISODate, ISODateTime } from './core';

export interface Course {
  id: EntityId;
  name: string;
  teacher?: string;
  credits?: number;
  color?: string;
}

export type WeekParity = 'all' | 'odd' | 'even';

export interface CourseSession {
  id: EntityId;
  courseId: EntityId;
  weekday: 1 | 2 | 3 | 4 | 5 | 6 | 7;
  startPeriod: number;
  endPeriod: number;
  /** 教学周列表，如 [1,2,3,4,5,6,7,8] */
  weeks: number[];
  parity: WeekParity;
  location?: string;
  hidden?: boolean;
}

export interface TimetableMeta {
  semester: string;
  termStartDate: ISODate;
  totalWeeks: number;
}

export interface Timetable {
  meta: TimetableMeta;
  courses: Course[];
  sessions: CourseSession[];
}

export interface PeriodTime {
  period: number;
  start: string;
  end: string;
}

export const DEFAULT_PERIOD_TIMES: PeriodTime[] = [
  { period: 1, start: '08:00', end: '08:45' },
  { period: 2, start: '08:50', end: '09:35' },
  { period: 3, start: '09:50', end: '10:35' },
  { period: 4, start: '10:40', end: '11:25' },
  { period: 5, start: '11:30', end: '12:15' },
  { period: 6, start: '13:00', end: '13:45' },
  { period: 7, start: '13:50', end: '14:35' },
  { period: 8, start: '14:45', end: '15:30' },
  { period: 9, start: '15:40', end: '16:25' },
  { period: 10, start: '16:35', end: '17:20' },
  { period: 11, start: '17:25', end: '18:10' },
  { period: 12, start: '18:30', end: '19:15' },
  { period: 13, start: '19:20', end: '20:05' },
  { period: 14, start: '20:10', end: '20:55' },
];

export type AssignmentStatus = 'pending' | 'submitted' | 'graded' | 'unknown';

export interface Assignment {
  id: EntityId;
  courseId: EntityId;
  courseName: string;
  title: string;
  dueAt?: ISODateTime;
  status: AssignmentStatus;
  /** 接口未明确给出截止时间时为 false，UI 显示“未确认” */
  dueConfirmed: boolean;
  /** 教学云提交状态原始码：99 未提交 / 0 已提交 / 1 已批改 / 2 已驳回 */
  statusCode?: number;
  /** 提交状态或课程阶段的中文说明 */
  statusText?: string;
  /** 作业阶段原始码：1 未开始 / 2 进行中 / 3 已截止 */
  phaseCode?: number;
  /** 已转成 StudyDesk 待办时的任务 id */
  linkedTaskId?: EntityId;
  /** 已转成 StudyDesk 倒数日时的日程 id */
  linkedDeadlineId?: EntityId;
}

export interface AssignmentAttachment {
  name: string;
  size?: number;
}

/** 教学云作业详情（GET /ykt-site/work/detail） */
export interface AssignmentDetail {
  id: EntityId;
  title: string;
  contentText: string;
  images: string[];
  beginAt?: ISODateTime;
  dueAt?: ISODateTime;
  className: string;
  groupName: string;
  chapterName: string;
  fullMark?: number;
  /** true 表示允许逾期补交 */
  allowLate?: boolean;
  mode: string;
  statusCode?: number;
  statusText: string;
  attachments: AssignmentAttachment[];
}

export interface Exam {
  id: EntityId;
  courseId: EntityId;
  courseName: string;
  title: string;
  startAt?: ISODateTime;
  endAt?: ISODateTime;
  location?: string;
  confirmed: boolean;
}

export interface Grade {
  id: EntityId;
  courseId: EntityId;
  courseName: string;
  credit: number;
  score?: number;
  term: string;
  gradePoint?: number;
}

export interface ClassroomSlot {
  id: EntityId;
  building: string;
  room: string;
  campus: string;
  date: ISODate;
  startPeriod: number;
  endPeriod: number;
}