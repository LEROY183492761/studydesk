import type { FeatureModule } from '@/app/registry/types';
import { PlaceholderPage } from '@/features/placeholder/PlaceholderPage';

export const floatingWindowFeature: FeatureModule = {
  id: 'floating-window',
  title: '悬浮窗',
  path: '/floating',
  icon: '❐',
  group: 'lab',
  order: 12,
  nav: true,
  flag: 'floatingWindow',
  element: (
    <PlaceholderPage
      title="桌面悬浮窗"
      phase="v1.1 预留模块"
      description="置顶显示专注倒计时与下一节课，减少切换主窗口的频率。"
      bullets={[
        '数据模型：FloatingWindowState 已定义',
        '平台端口：WindowPort + 全局快捷键端口已预留',
        '依赖：只读订阅专注与课表状态，不产生新业务数据',
      ]}
    />
  ),
};