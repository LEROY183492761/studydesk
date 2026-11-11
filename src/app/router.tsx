import { createHashRouter } from 'react-router-dom';
import { AppShell } from './layout/AppShell';
import { SettingsPage } from '@/features/settings/SettingsPage';
import { PlaceholderPage } from '@/features/placeholder/PlaceholderPage';
import { routeEntries } from './registry/registry';

export const router = createHashRouter([
  {
    path: '/',
    element: <AppShell />,
    children: [
      ...routeEntries().map((entry) => ({
        index: entry.path === '',
        path: entry.path === '' ? undefined : entry.path,
        element: entry.element,
      })),
      { path: 'settings', element: <SettingsPage /> },
      {
        path: '*',
        element: (
          <PlaceholderPage
            title="页面不存在"
            phase="404"
            description="链接可能已失效，或对应模块尚未启用。"
          />
        ),
      },
    ],
  },
]);