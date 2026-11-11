import type { FeatureModule } from '@/app/registry/types';
import { PlaceholderPage } from '@/features/placeholder/PlaceholderPage';

export const quickCaptureFeature: FeatureModule = {
  id: 'quick-capture',
  title: '快捷录入',
  path: '/capture',
  icon: '⌁',
  group: 'lab',
  order: 11,
  nav: true,
  flag: 'quickCapture',
  element: (
    <PlaceholderPage
      title="全局快捷录入"
      phase="v1.1 预留模块"
      description="通过 Ctrl + Alt + N 在任何界面唤起，一句话解析为待办、日程、随想或记账。"
      bullets={[
        '数据模型：CaptureRecord / CaptureDraft 已定义',
        '仓储接口：CaptureRepository 已预留',
        '解析器接口：NaturalLanguageParser（规则优先，AI 可选）',
        '依赖：向下游分发到 Task / Note / Event / Ledger，被悬浮窗复用',
      ]}
    />
  ),
};