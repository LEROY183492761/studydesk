import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import clsx from 'clsx';
import { useEffect } from 'react';
import { useAppStore } from '@/state/appStore';
import { navFeatures } from '../registry/registry';

export function AppShell() {
  const settings = useAppStore((state) => state.settings);
  const navigate = useNavigate();
  const features = navFeatures(settings.flags);
  const core = features.filter((feature) => feature.group === 'core');
  const extended = features.filter((feature) => feature.group !== 'core');

  useEffect(() => {
    function handleKeydown(event: KeyboardEvent) {
      if (!(event.ctrlKey || event.metaKey) || event.key.toLowerCase() !== 'k') return;
      event.preventDefault();
      navigate(settings.flags.quickCapture ? '/capture' : '/settings');
    }
    window.addEventListener('keydown', handleKeydown);
    return () => window.removeEventListener('keydown', handleKeydown);
  }, [navigate, settings.flags.quickCapture]);

  return (
    <div className="app-shell">
      <aside className="nav-rail">
        <div className="brand">
          <span className="brand-mark">SD</span>
          <div>
            <strong>StudyDesk</strong>
            <span className="muted">本地优先 · 学务一体</span>
          </div>
        </div>

        <nav className="nav-groups" aria-label="主导航">
          <NavGroup title="日常" features={core} />
          {extended.length > 0 ? <NavGroup title="扩展" features={extended} /> : null}
        </nav>

        <div className="nav-footer">
          <button type="button" className="capture-trigger" onClick={() => navigate('/settings')}>
            <span>快速记录</span>
            <kbd>Ctrl K</kbd>
          </button>
          <NavLink
            to="/settings"
            className={({ isActive }) => clsx('nav-item', isActive && 'is-active')}
          >
            <span className="nav-icon">⚙</span>
            设置
          </NavLink>
        </div>
      </aside>

      <main className="app-main">
        <Outlet />
      </main>
    </div>
  );
}

interface NavGroupProps {
  title: string;
  features: ReturnType<typeof navFeatures>;
}

function NavGroup({ title, features }: NavGroupProps) {
  return (
    <div className="nav-group">
      <p className="nav-group-title">{title}</p>
      {features.map((feature) => (
        <NavLink
          key={feature.id}
          to={feature.path}
          className={({ isActive }) => clsx('nav-item', isActive && 'is-active')}
        >
          <span className="nav-icon" aria-hidden="true">
            {feature.icon}
          </span>
          {feature.title}
        </NavLink>
      ))}
    </div>
  );
}