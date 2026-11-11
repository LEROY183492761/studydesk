import type { Timetable } from '@/domain/models';

const ALL_WEEKS = Array.from({ length: 16 }, (_, index) => index + 1);

/** BUPT 示例课表（2026 秋，第 1–16 周） */
export const BUPT_SAMPLE_TIMETABLE: Timetable = {
  meta: { semester: '2026 秋 · BUPT 示例', termStartDate: '2026-08-31', totalWeeks: 20 },
  courses: [
    { id: 'sample-c1', name: '工科数学分析（上）', teacher: '胡细宝, 吕卓生', color: 'var(--color-course-1)' },
    { id: 'sample-c2', name: '程序设计思维与方法', teacher: '郑伟', color: 'var(--color-course-2)' },
    { id: 'sample-c3', name: '基础综合英语', teacher: '乔明选', color: 'var(--color-course-3)' },
    { id: 'sample-c4', name: '信息与通信工程专业导论', teacher: '廖浩野', color: 'var(--color-course-4)' },
    { id: 'sample-c5', name: '习近平新时代中国特色社会主义思想概论', teacher: '任瑞姣', color: 'var(--color-course-5)' },
    { id: 'sample-c6', name: '线性代数', teacher: '姚悦', color: 'var(--color-course-6)' },
    { id: 'sample-c7', name: '大学美学', teacher: '于奎战', color: 'var(--color-course-1)' },
    { id: 'sample-c8', name: '全景3D技术与创意', teacher: '于迅博', color: 'var(--color-course-2)' },
  ],
  sessions: [
    { id: 'sample-s1', courseId: 'sample-c1', weekday: 1, startPeriod: 2, endPeriod: 4, weeks: ALL_WEEKS, parity: 'all', location: '教学实验综合楼-S103' },
    { id: 'sample-s2', courseId: 'sample-c1', weekday: 4, startPeriod: 3, endPeriod: 5, weeks: ALL_WEEKS, parity: 'all', location: '教学实验综合楼-S106' },
    { id: 'sample-s3', courseId: 'sample-c2', weekday: 3, startPeriod: 3, endPeriod: 4, weeks: ALL_WEEKS, parity: 'all', location: '智慧教学楼-413' },
    { id: 'sample-s4', courseId: 'sample-c3', weekday: 4, startPeriod: 8, endPeriod: 8, weeks: ALL_WEEKS, parity: 'all', location: '智慧教学楼-317' },
    { id: 'sample-s5', courseId: 'sample-c4', weekday: 5, startPeriod: 8, endPeriod: 9, weeks: ALL_WEEKS, parity: 'all', location: '教学实验综合楼-S201' },
    { id: 'sample-s6', courseId: 'sample-c5', weekday: 1, startPeriod: 6, endPeriod: 8, weeks: ALL_WEEKS, parity: 'all', location: '教学实验综合楼-S302' },
    { id: 'sample-s7', courseId: 'sample-c6', weekday: 2, startPeriod: 6, endPeriod: 8, weeks: ALL_WEEKS, parity: 'all', location: '教学实验综合楼-S104' },
    { id: 'sample-s8', courseId: 'sample-c7', weekday: 3, startPeriod: 13, endPeriod: 14, weeks: ALL_WEEKS, parity: 'all', location: '教学实验综合楼-N308' },
    { id: 'sample-s9', courseId: 'sample-c8', weekday: 5, startPeriod: 13, endPeriod: 14, weeks: ALL_WEEKS, parity: 'all', location: '教学实验综合楼-N401' },
  ],
};

export interface SampleTask {
  title: string;
  importance: 'high' | 'low';
  priority: 'urgent' | 'high' | 'normal' | 'low';
  dueInDays: number | null;
}

/** 四象限示例待办（用于导入演示） */
export const BUPT_SAMPLE_TASKS: SampleTask[] = [
  { title: '英语阅读*1 + 口语', importance: 'high', priority: 'urgent', dueInDays: 1 },
  { title: 'pta', importance: 'high', priority: 'urgent', dueInDays: 1 },
  { title: '第二次英语作文', importance: 'high', priority: 'urgent', dueInDays: 1 },
  { title: '了解挑战杯、雏鹰计划', importance: 'high', priority: 'urgent', dueInDays: 1 },
  { title: '心理健康小作文、选修两学分', importance: 'high', priority: 'normal', dueInDays: 7 },
  { title: '第三次英语作文', importance: 'high', priority: 'normal', dueInDays: 7 },
  { title: '问景天零数学', importance: 'high', priority: 'normal', dueInDays: 7 },
  { title: '给陈老师打电话', importance: 'high', priority: 'normal', dueInDays: 7 },
  { title: 'Everyday', importance: 'high', priority: 'normal', dueInDays: 7 },
  { title: '买零食', importance: 'low', priority: 'urgent', dueInDays: 1 },
  { title: '数分数智实践大作业', importance: 'low', priority: 'urgent', dueInDays: 1 },
  { title: '修手机', importance: 'low', priority: 'urgent', dueInDays: 1 },
  { title: '看病', importance: 'low', priority: 'urgent', dueInDays: 1 },
  { title: '买东西', importance: 'low', priority: 'low', dueInDays: null },
];