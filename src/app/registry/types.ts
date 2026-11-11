import type { ComponentType, ReactNode } from 'react';
import type { FeatureFlags } from '@/domain/models';

export type FeatureGroup = 'core' | 'extension' | 'lab';

export interface CommandContribution {
  id: string;
  title: string;
  run: () => void | Promise<void>;
}

export interface WidgetContribution {
  id: string;
  title: string;
  size: 'sm' | 'md';
  component: ComponentType;
}

/**
 * 功能模块契约。
 * 新增业务域只需实现该接口并在 registry 中注册，路由、导航、命令面板自动生效。
 */
export interface FeatureModule {
  id: string;
  title: string;
  path: string;
  icon: string;
  group: FeatureGroup;
  order: number;
  element: ReactNode;
  nav: boolean;
  flag?: keyof FeatureFlags;
  commands?: CommandContribution[];
  widgets?: WidgetContribution[];
}