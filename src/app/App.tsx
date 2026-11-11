import { useEffect } from 'react';
import { RouterProvider } from 'react-router-dom';
import { useReminders } from '@/app/useReminders';
import { useAppStore } from '@/state/appStore';
import { AppProviders } from './providers';
import { router } from './router';

export function App() {
  const init = useAppStore((state) => state.init);
  const ready = useAppStore((state) => state.ready);
  const error = useAppStore((state) => state.error);

  useReminders();

  useEffect(() => {
    void init();
  }, [init]);

  if (!ready) {
    return <div className="boot-screen">正在加载本地数据…</div>;
  }

  if (error) {
    return <div className="boot-screen">初始化失败：{error}</div>;
  }

  return (
    <AppProviders>
      <RouterProvider router={router} />
    </AppProviders>
  );
}