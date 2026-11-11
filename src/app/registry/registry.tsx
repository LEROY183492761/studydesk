import { AcademicPage } from '@/features/academic/AcademicPage';
import { AssignmentsPage } from '@/features/assignments/AssignmentsPage';
import { CalendarPage } from '@/features/calendar/CalendarPage';
import { ClassroomsPage } from '@/features/classrooms/ClassroomsPage';
import { FocusPage } from '@/features/focus/FocusPage';
import { GoalsPage } from '@/features/goals/GoalsPage';
import { HabitsPage } from '@/features/habits/HabitsPage';
import { NotesPage } from '@/features/notes/NotesPage';
import { ReviewPage } from '@/features/review/ReviewPage';
import { floatingWindowFeature } from '@/features/lab/floating-window/manifest';
import { ledgerFeature } from '@/features/lab/ledger/manifest';
import { quickCaptureFeature } from '@/features/lab/quick-capture/manifest';
import { reviewCardsFeature } from '@/features/lab/review-cards/manifest';

import { TasksPage } from '@/features/tasks/TasksPage';
import { TimelinePage } from '@/features/timeline/TimelinePage';
import { TimetablePage } from '@/features/timetable/TimetablePage';
import { TodayPage } from '@/features/today/TodayPage';
import type { FeatureFlags } from '@/domain/models';
import type { FeatureModule } from './types';


/**
 * 唯一的功能注册表。
 * 路由与导航均由该列表派生，新增模块不需要修改 router 或 AppShell。
 */
export const featureModules: FeatureModule[] = [
  {
    id: 'today',
    title: '今日',
    path: '/',
    icon: '◐',
    group: 'core',
    order: 1,
    nav: true,
    element: <TodayPage />,
  },
  {
    id: 'calendar',
    title: '日程',
    path: '/calendar',
    icon: '▦',
    group: 'core',
    order: 2,
    nav: true,
    element: <CalendarPage />,
  },
  {
    id: 'tasks',
    title: '待办',
    path: '/tasks',
    icon: '✓',
    group: 'core',
    order: 3,
    nav: true,
    element: <TasksPage />,
  },
  {
    id: 'focus',
    title: '专注',
    path: '/focus',
    icon: '◷',
    group: 'core',
    order: 4,
    nav: true,
    element: <FocusPage />,
  },
  {
    id: 'timetable',
    title: '课表',
    path: '/timetable',
    icon: '▤',
    group: 'core',
    order: 5,
    nav: true,
    element: <TimetablePage />,
  },
  {
    id: 'timeline',
    title: '时间轴',
    path: '/timeline',
    icon: '┄',
    group: 'extension',
    order: 6,
    nav: true,
    element: <TimelinePage />,
  },
  {
    id: 'habits',
    title: '习惯',
    path: '/habits',
    icon: '◆',
    group: 'extension',
    order: 7,
    nav: true,
    element: <HabitsPage />,
  },
  {
    id: 'notes',
    title: '随想',
    path: '/notes',
    icon: '✎',
    group: 'extension',
    order: 8,
    nav: true,
    element: <NotesPage />,
  },
  {
    id: 'review',
    title: '复盘',
    path: '/review',
    icon: '◎',
    group: 'extension',
    order: 9,
    nav: true,
    element: <ReviewPage />,
  },
  {
    id: 'goals',
    title: '目标',
    path: '/goals',
    icon: '⌖',
    group: 'extension',
    order: 10,
    nav: true,
    element: <GoalsPage />,
  },
  {
    id: 'classrooms',
    title: '空教室',
    path: '/classrooms',
    icon: '▣',
    group: 'extension',
    order: 11,
    nav: true,
    element: <ClassroomsPage />,
  },
  {
    id: 'academic',
    title: '教务',
    path: '/academic',
    icon: '▥',
    group: 'extension',
    order: 12,
    nav: true,
    element: <AcademicPage />,
  },
  {
    id: 'assignments',
    title: '作业',
    path: '/assignments',
    icon: '▧',
    group: 'extension',
    order: 13,
    nav: true,
    element: <AssignmentsPage />,
  },
  reviewCardsFeature,
  quickCaptureFeature,
  floatingWindowFeature,
  ledgerFeature,
];

export function navFeatures(flags: FeatureFlags): FeatureModule[] {
  return featureModules
    .filter((feature) => feature.nav && (!feature.flag || flags[feature.flag]))
    .sort((a, b) => a.order - b.order);
}

export function routeEntries(): Array<{ path: string; element: FeatureModule['element'] }> {
  return featureModules.map((feature) => ({
    path: feature.path === '/' ? '' : feature.path.replace(/^\//, ''),
    element: feature.element,
  }));
}

export function getFeature(id: string): FeatureModule | undefined {
  return featureModules.find((feature) => feature.id === id);
}