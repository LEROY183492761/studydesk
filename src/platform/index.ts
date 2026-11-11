import type { PlatformPort } from './types';
import { createTauriPlatform } from './tauri';
import { createWebPlatform } from './web';

let cached: Promise<PlatformPort> | undefined;

function detect(): Promise<PlatformPort> {
  const isTauri = typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;
  return Promise.resolve(isTauri ? createTauriPlatform() : createWebPlatform());
}

export function getPlatform(): Promise<PlatformPort> {
  cached ??= detect();
  return cached;
}

export type { PlatformPort } from './types';