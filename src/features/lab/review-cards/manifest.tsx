import type { FeatureModule } from '@/app/registry/types';
import { PlaceholderPage } from '@/features/placeholder/PlaceholderPage';

export const reviewCardsFeature: FeatureModule = {
  id: 'review-cards',
  title: '复习卡片',
  path: '/review-cards',
  icon: '◧',
  group: 'lab',
  order: 10,
  nav: true,
  flag: 'reviewCards',
  element: (
    <PlaceholderPage
      title="间隔重复卡片"
      phase="v1.1 预留模块"
      description="把随想与课程笔记转成复习卡片，按 SM-2 简化间隔在今日队列中出现。"
      bullets={[
        '数据模型：ReviewCard / ReviewLog 已定义',
        '仓储接口：ReviewCardRepository / ReviewLogRepository 已预留',
        '依赖：与随想、课程关联；不依赖记账与悬浮窗',
      ]}
    />
  ),
};