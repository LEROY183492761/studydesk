import type { FeatureModule } from '@/app/registry/types';
import { PlaceholderPage } from '@/features/placeholder/PlaceholderPage';

export const ledgerFeature: FeatureModule = {
  id: 'ledger',
  title: '记账',
  path: '/ledger',
  icon: '¥',
  group: 'lab',
  order: 13,
  nav: true,
  flag: 'ledger',
  element: (
    <PlaceholderPage
      title="轻量记账"
      phase="v1.1 预留模块"
      description="手动记录支出与收入，按月汇总并在今日页显示今日支出。"
      bullets={[
        '数据模型：LedgerEntry / LedgerCategory / LedgerBudget 已定义',
        '仓储接口：LedgerRepository 已预留，金额以“分”为单位',
        '依赖：可接收快捷录入分发的记账草稿，不依赖复习卡片',
      ]}
    />
  ),
};