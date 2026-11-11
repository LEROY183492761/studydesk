import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { format } from 'date-fns';
import clsx from 'clsx';
import type { FeatureFlags, ThemeId } from '@/domain/models';
import { refreshBuptAcademic } from '@/features/academic/refreshAcademic';
import {
  clearReminderHistory,
  readReminderHistory,
  type ReminderHistoryItem,
} from '@/domain/rules/notificationHistory';
import { getPlatform } from '@/platform';
import { useAppStore } from '@/state/appStore';

const THEMES: Array<{ id: ThemeId; label: string; hint: string }> = [
  { id: 'light', label: '浅色', hint: '默认，信息密度高' },
  { id: 'dark', label: '深色', hint: '夜间与低光环境' },
  { id: 'sepia', label: '米色', hint: '长时间阅读更柔和' },
];

const FLAGS: Array<{ key: keyof FeatureFlags; label: string; description: string }> = [
  { key: 'reviewCards', label: '间隔重复卡片', description: '把随想与课程笔记转成复习卡片' },
  { key: 'quickCapture', label: '全局快捷录入', description: 'Ctrl + Alt + N 随时记录' },
  { key: 'floatingWindow', label: '桌面悬浮窗', description: '置顶显示专注倒计时与下一节课' },
  { key: 'ledger', label: '轻量记账', description: '手动记录支出，按月汇总' },
];

const CATEGORY_COLORS = [
  'var(--color-course-1)',
  'var(--color-course-2)',
  'var(--color-course-3)',
  'var(--color-course-4)',
  'var(--color-course-5)',
  'var(--color-course-6)',
];

export function SettingsPage() {
  const settings = useAppStore((state) => state.settings);
  const setTheme = useAppStore((state) => state.setTheme);
  const setFlag = useAppStore((state) => state.setFlag);
  const setNotifications = useAppStore((state) => state.setNotifications);
  const setReminderConfig = useAppStore((state) => state.setReminderConfig);
  const setCalendarDropConfig = useAppStore((state) => state.setCalendarDropConfig);
  const resetDemoData = useAppStore((state) => state.resetDemoData);
  const categories = useAppStore((state) => state.categories);
  const addCategory = useAppStore((state) => state.addCategory);
  const updateCategory = useAppStore((state) => state.updateCategory);
  const removeCategory = useAppStore((state) => state.removeCategory);


  const [resetting, setResetting] = useState(false);
  const [categoryName, setCategoryName] = useState('');
  const [categoryColor, setCategoryColor] = useState(CATEGORY_COLORS[0]);
  const [editingCategoryId, setEditingCategoryId] = useState<string | null>(null);
  const [editCategoryName, setEditCategoryName] = useState('');
  const [categoryNotice, setCategoryNotice] = useState<string | null>(null);
  const [reminderHistory, setReminderHistory] = useState<ReminderHistoryItem[]>([]);
  const [buptAccount, setBuptAccount] = useState('');
  const [buptPassword, setBuptPassword] = useState('');
  const [buptSecretStatus, setBuptSecretStatus] = useState('尚未保存账号');
  const [buptCloudPassword, setBuptCloudPassword] = useState('');
  const [buptCampus, setBuptCampus] = useState<'xicheng' | 'shahe'>('xicheng');
  const [buptBusy, setBuptBusy] = useState(false);
  const [buptError, setBuptError] = useState<string | null>(null);
  const [buptPasswordSaved, setBuptPasswordSaved] = useState(false);
  const [buptCloudSaved, setBuptCloudSaved] = useState(false);

  useEffect(() => {
    setReminderHistory(readReminderHistory());
  }, []);

  useEffect(() => {
    void getPlatform().then(async (platform) => {
      const account = await platform.secrets.get('bupt.account');
      const password = await platform.secrets.get('bupt.password');
      const cloud = await platform.secrets.get('bupt.cloudPassword');
      if (account) setBuptAccount(account);
      setBuptPasswordSaved(Boolean(password));
      setBuptCloudSaved(Boolean(cloud));
      setBuptCampus(
        window.localStorage.getItem('studydesk.buptCampus') === 'shahe' ? 'shahe' : 'xicheng',
      );
      setBuptSecretStatus(
        password ? '教务密码已保存（留空不修改）' : '尚未保存教务密码',
      );
    });
  }, []);

  async function handleReset() {
    if (!window.confirm('将清除本地演示数据并恢复初始状态，确认继续？')) return;
    setResetting(true);
    try {
      await resetDemoData();
    } finally {
      setResetting(false);
    }
  }

  async function handleTestNotification() {
    const platform = await getPlatform();
    await platform.notification.notify('StudyDesk 提醒测试', '看到这条通知说明系统提醒已生效。');
  }

  async function handleSaveBuptAccount() {
    setBuptError(null);
    const platform = await getPlatform();
    if (platform.kind !== 'tauri') {
      setBuptSecretStatus('仅桌面端可保存到系统凭据管理器');
      return;
    }
    if (!buptAccount.trim()) {
      setBuptSecretStatus('请填写学号');
      return;
    }

    try {
      await platform.secrets.set('bupt.account', buptAccount.trim());
      if (buptPassword) {
        await platform.secrets.set('bupt.password', buptPassword);
        setBuptPasswordSaved(true);
      }
      if (buptCloudPassword) {
        await platform.secrets.set('bupt.cloudPassword', buptCloudPassword);
        setBuptCloudSaved(true);
      }
      window.localStorage.setItem('studydesk.buptCampus', buptCampus);
      setBuptPassword('');
      setBuptCloudPassword('');
      setBuptSecretStatus('已保存到 Windows 凭据管理器');
    } catch (cause) {
      setBuptSecretStatus(cause instanceof Error ? cause.message : '保存失败');
    }
  }

  async function handleUseTeacherPassword() {
    setBuptError(null);
    const platform = await getPlatform();
    const source = buptPassword || (await platform.secrets.get('bupt.password')) || '';
    if (!source) {
      setBuptError('请先输入或保存教务密码');
      return;
    }

    await platform.secrets.set('bupt.cloudPassword', source);
    setBuptCloudPassword('');
    setBuptCloudSaved(true);
    setBuptSecretStatus('教学云密码已同步为教务密码');
  }

  async function handleRefreshBupt() {
    setBuptError(null);
    const platform = await getPlatform();
    if (platform.kind !== 'tauri') {
      setBuptError('北邮教务刷新仅桌面端可用');
      return;
    }

    const account = buptAccount.trim() || (await platform.secrets.get('bupt.account')) || '';
    const password = buptPassword || (await platform.secrets.get('bupt.password')) || '';

    if (!account || !password) {
      setBuptError('请先填写并保存学号与教务密码');
      return;
    }

    setBuptBusy(true);
    try {
      const result = await refreshBuptAcademic({ account, password });
      const cloudNote = result.cloudError ? `（教学云：${result.cloudError}）` : '';
      setBuptSecretStatus(
        `已刷新：成绩 ${result.data.grades.length}、考试 ${result.data.exams.length}、作业 ${result.data.assignments.length}${
          result.timetable ? `、课表 ${result.timetable.courses.length} 门` : ''
        }${cloudNote}`,
      );
    } catch (cause) {
      setBuptError(cause instanceof Error ? cause.message : '刷新失败');
    } finally {
      setBuptBusy(false);
    }
  }

  async function handleClearBuptAccount() {
    const platform = await getPlatform();
    await platform.secrets.delete('bupt.account');
    await platform.secrets.delete('bupt.password');
    await platform.secrets.delete('bupt.cloudPassword');
    setBuptAccount('');
    setBuptPassword('');
    setBuptCloudPassword('');
    setBuptPasswordSaved(false);
    setBuptCloudSaved(false);
    setBuptSecretStatus('已清除保存的账号');
  }

  async function handleAddCategory(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const name = categoryName.trim();
    if (!name) return;
    if (categories.some((category) => category.name === name)) {
      setCategoryNotice('分类名称已存在');
      return;
    }
    await addCategory({ name, color: categoryColor });
    setCategoryName('');
    setCategoryNotice(`已添加分类「${name}」`);
  }

  function startEditCategory(id: string) {
    const category = categories.find((item) => item.id === id);
    if (!category) return;
    setEditingCategoryId(id);
    setEditCategoryName(category.name);
  }

  async function handleSaveCategory(id: string) {
    const ok = await updateCategory(id, { name: editCategoryName });
    if (!ok) {
      setCategoryNotice('保存失败：名称为空或与已有分类重名');
      return;
    }
    setEditingCategoryId(null);
    setCategoryNotice('分类已更新');
  }

  async function handleRemoveCategory(id: string) {
    if (!window.confirm('删除分类后，已使用该分类的任务会显示为未分类，确认删除？')) return;
    await removeCategory(id);
    setCategoryNotice('分类已删除');
  }

  return (
    <div className="page settings-page">
      <header className="page-header">
        <div>
          <p className="muted">外观、分类、实验功能与本地数据</p>
          <h1>设置</h1>
        </div>
      </header>

      <section className="surface-card panel">
        <h2 className="section-title">主题</h2>
        <div className="theme-grid">
          {THEMES.map((theme) => (
            <button
              key={theme.id}
              type="button"
              className={clsx('theme-card', settings.theme === theme.id && 'is-active')}
              aria-pressed={settings.theme === theme.id}
              onClick={() => void setTheme(theme.id)}
            >
              <strong>{theme.label}</strong>
              <span className="muted">{theme.hint}</span>
            </button>
          ))}
        </div>
      </section>

      <section className="surface-card panel">
        <div className="panel-head">
          <h2 className="section-title">系统通知</h2>
          <span className="muted">番茄结束 · 课前 10 分钟 · 习惯到点</span>
        </div>
        <ul className="settings-list">
          <li>
            <div>
              <strong>桌面提醒</strong>
              <span className="muted">应用运行时生效；关闭后所有提醒静默</span>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={settings.notifications}
              aria-label="桌面提醒"
              className={clsx('switch', settings.notifications && 'is-on')}
              onClick={() => void setNotifications(!settings.notifications)}
            >
              <span />
            </button>
          </li>
          <li>
            <div>
              <strong>课前提前量</strong>
              <span className="muted">课程/日程开始前多少分钟提醒</span>
            </div>
            <input
              type="number"
              min={1}
              max={120}
              defaultValue={settings.reminderLeadMinutes}
              onBlur={(event) =>
                void setReminderConfig({ leadMinutes: Number(event.target.value) })
              }
              aria-label="课前提醒提前量"
            />
          </li>
          <li>
            <div>
              <strong>习惯提醒宽限</strong>
              <span className="muted">到点后多少分钟内仍可提醒</span>
            </div>
            <input
              type="number"
              min={1}
              max={120}
              defaultValue={settings.habitGraceMinutes}
              onBlur={(event) =>
                void setReminderConfig({ habitGraceMinutes: Number(event.target.value) })
              }
              aria-label="习惯提醒宽限"
            />
          </li>
        </ul>
        <button
          type="button"
          className="ghost-button"
          onClick={() => void handleTestNotification()}
        >
          发送测试提醒
        </button>

        {reminderHistory.length > 0 ? (
          <>
            <ul className="reminder-history">
              {reminderHistory.slice(0, 5).map((item) => (
                <li key={item.id}>
                  <div>
                    <strong>{item.title}</strong>
                    <span className="muted">{format(new Date(item.at), 'M/d HH:mm')}</span>
                  </div>
                  <span className="muted">{item.body}</span>
                </li>
              ))}
            </ul>
            <button
              type="button"
              className="ghost-button"
              onClick={() => {
                clearReminderHistory();
                setReminderHistory([]);
              }}
            >
              清空提醒历史
            </button>
          </>
        ) : (
          <p className="muted reminder-empty">暂无提醒记录</p>
        )}
      </section>

      <section className="surface-card panel">
        <div className="panel-head">
          <h2 className="section-title">个人账号</h2>
          <span className="muted">保存到 Windows 凭据管理器，不写入设置文件</span>
        </div>
        <div className="settings-account">
          <label>
            <span>学号</span>
            <input
              value={buptAccount}
              onChange={(event) => setBuptAccount(event.target.value)}
              placeholder="例如 2026210300"
              aria-label="北邮学号"
            />
          </label>
          <label>
            <span>教务密码</span>
            <input
              type="password"
              value={buptPassword}
              onChange={(event) => setBuptPassword(event.target.value)}
              placeholder={
                buptPasswordSaved ? '已安全保存，留空保持不变' : '请输入移动教务密码'
              }
              aria-label="教务密码"
              autoComplete="off"
            />
          </label>
          <label>
            <span>教学云平台密码</span>
            <input
              type="password"
              value={buptCloudPassword}
              onChange={(event) => setBuptCloudPassword(event.target.value)}
              placeholder={
                buptCloudSaved
                  ? '独立密码已安全保存，留空保持不变'
                  : '仅用于作业 DDL；留空可稍后设置'
              }
              aria-label="教学云平台密码"
              autoComplete="off"
            />
          </label>
          <button
            type="button"
            className="ghost-button"
            onClick={() => void handleUseTeacherPassword()}
          >
            使用教务密码
          </button>

          <div className="settings-campus">
            <span>默认校区</span>
            <div className="segmented" role="group" aria-label="默认校区">
              <button
                type="button"
                className={clsx(buptCampus === 'xicheng' && 'is-active')}
                onClick={() => setBuptCampus('xicheng')}
              >
                西土城
              </button>
              <button
                type="button"
                className={clsx(buptCampus === 'shahe' && 'is-active')}
                onClick={() => setBuptCampus('shahe')}
              >
                沙河
              </button>
            </div>
          </div>

          <div className="settings-account-actions">
            <button
              type="button"
              className="primary-button"
              onClick={() => void handleSaveBuptAccount()}
            >
              保存设置
            </button>
            <button
              type="button"
              className="ghost-button"
              disabled={buptBusy}
              onClick={() => void handleRefreshBupt()}
            >
              {buptBusy ? '刷新中…' : '获取/刷新个人课表'}
            </button>
            <button
              type="button"
              className="ghost-button"
              onClick={() => void handleClearBuptAccount()}
            >
              清除账号
            </button>
          </div>

          <p className="muted academic-hint">{buptSecretStatus}</p>
          {buptError ? <p className="form-error">{buptError}</p> : null}
        </div>
      </section>

      <section className="surface-card panel">
        <div className="panel-head">
          <h2 className="section-title">分类管理</h2>
          <span className="muted">{categories.length} 类</span>
        </div>

        <form className="category-composer" onSubmit={handleAddCategory}>
          <input
            value={categoryName}
            onChange={(event) => setCategoryName(event.target.value)}
            placeholder="新分类名称，例如：数学"
            aria-label="新分类名称"
          />
          <div className="color-picker" role="group" aria-label="分类颜色">
            {CATEGORY_COLORS.map((value) => (
              <button
                key={value}
                type="button"
                className={clsx('color-dot', categoryColor === value && 'is-active')}
                style={{ background: value }}
                aria-label={`颜色 ${value}`}
                aria-pressed={categoryColor === value}
                onClick={() => setCategoryColor(value)}
              />
            ))}
          </div>
          <button type="submit" className="primary-button">
            添加分类
          </button>
        </form>

        <ul className="category-list">
          {categories.map((category) => (
            <li key={category.id}>
              <span className="legend-dot" style={{ background: category.color }} />
              {editingCategoryId === category.id ? (
                <>
                  <input
                    value={editCategoryName}
                    onChange={(event) => setEditCategoryName(event.target.value)}
                    aria-label={`${category.name} 分类名称`}
                  />
                  <button
                    type="button"
                    className="primary-button"
                    onClick={() => void handleSaveCategory(category.id)}
                  >
                    保存
                  </button>
                  <button
                    type="button"
                    className="ghost-button"
                    onClick={() => setEditingCategoryId(null)}
                  >
                    取消
                  </button>
                </>
              ) : (
                <>
                  <span className="category-name">{category.name}</span>
                  <button
                    type="button"
                    className="ghost-button"
                    onClick={() => startEditCategory(category.id)}
                  >
                    改名
                  </button>
                  <button
                    type="button"
                    className="ghost-button"
                    onClick={() => void handleRemoveCategory(category.id)}
                  >
                    删除
                  </button>
                </>
              )}
            </li>
          ))}
        </ul>

        {categoryNotice ? <p className="muted category-notice">{categoryNotice}</p> : null}
      </section>

      <section className="surface-card panel">
        <div className="panel-head">
          <h2 className="section-title">日历</h2>
          <span className="muted">月视图拖入待办的默认时间</span>
        </div>
        <ul className="settings-list">
          <li>
            <div>
              <strong>默认开始小时</strong>
              <span className="muted">拖入月份格后从几点开始</span>
            </div>
            <input
              type="number"
              min={0}
              max={23}
              defaultValue={settings.monthDropHour}
              onBlur={(event) =>
                void setCalendarDropConfig({ hour: Number(event.target.value) })
              }
              aria-label="月视图默认开始小时"
            />
          </li>
          <li>
            <div>
              <strong>默认时长</strong>
              <span className="muted">拖入后创建的时间块长度（分钟）</span>
            </div>
            <input
              type="number"
              min={15}
              max={720}
              step={15}
              defaultValue={settings.monthDropMinutes}
              onBlur={(event) =>
                void setCalendarDropConfig({ minutes: Number(event.target.value) })
              }
              aria-label="月视图默认时长"
            />
          </li>
        </ul>
      </section>

      <section className="surface-card panel">
        <div className="panel-head">
          <h2 className="section-title">实验功能</h2>
          <span className="muted">v1.1 预留，开启后入口可见</span>
        </div>
        <ul className="settings-list">
          {FLAGS.map((flag) => (
            <li key={flag.key}>
              <div>
                <strong>{flag.label}</strong>
                <span className="muted">{flag.description}</span>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={settings.flags[flag.key]}
                aria-label={flag.label}
                className={clsx('switch', settings.flags[flag.key] && 'is-on')}
                onClick={() => void setFlag(flag.key, !settings.flags[flag.key])}
              >
                <span />
              </button>
            </li>
          ))}
        </ul>
      </section>

      <section className="surface-card panel">
        <h2 className="section-title">本地数据</h2>
        <p className="muted">
          所有数据仅保存在本机。M0 使用浏览器存储作为过渡实现，M1 将迁移到 SQLite，仓储接口保持不变。
        </p>
        <button type="button" className="danger-button" disabled={resetting} onClick={() => void handleReset()}>
          {resetting ? '正在重置…' : '重置演示数据'}
        </button>
      </section>

      <section className="surface-card panel">
        <h2 className="section-title">关于</h2>
        <p className="muted">
          StudyDesk v0.1.0 · v0.4 · React + TypeScript + Tauri 2
        </p>
        <p className="muted">课表与学务数据接入遵循只读、本地、可降级原则。</p>
      </section>
    </div>
  );
}