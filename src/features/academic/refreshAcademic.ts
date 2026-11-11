import { invoke } from '@tauri-apps/api/core';
import type { Timetable } from '@/domain/models';
import { mergeAcademicPayload, parseAcademicPayload } from '@/domain/rules/academicImport';
import type { AcademicImportPayload } from '@/domain/rules/academicImport';
import { getPlatform } from '@/platform';
import { useAppStore } from '@/state/appStore';

export const ACADEMIC_STORAGE_KEY = 'studydesk.academicData';

export interface AcademicRefreshOverrides {
  account?: string;
  password?: string;
}

export interface AcademicRefreshResult {
  data: AcademicImportPayload;
  timetable?: Timetable;
  cloudError?: string;
}

export function loadAcademicData(): AcademicImportPayload | null {
  try {
    const cached = window.localStorage.getItem(ACADEMIC_STORAGE_KEY);
    return cached ? parseAcademicPayload(cached) : null;
  } catch {
    return null;
  }
}

export function saveAcademicData(data: AcademicImportPayload): void {
  window.localStorage.setItem(ACADEMIC_STORAGE_KEY, JSON.stringify(data));
}

/**
 * 统一刷新入口：设置页与作业页共用，避免两处各写一遍凭据读取与合并逻辑。
 * 只读取已保存到凭据管理器的值；输入框中的临时值通过 overrides 传入。
 */
export async function refreshBuptAcademic(
  overrides: AcademicRefreshOverrides = {},
): Promise<AcademicRefreshResult> {
  const platform = await getPlatform();
  if (platform.kind !== 'tauri') {
    throw new Error('北邮教务刷新仅桌面端可用');
  }

  const account = overrides.account || (await platform.secrets.get('bupt.account')) || '';
  const password = overrides.password || (await platform.secrets.get('bupt.password')) || '';
  if (!account || !password) {
    throw new Error('请先在设置页保存学号与教务密码');
  }
  const cloudPassword = (await platform.secrets.get('bupt.cloudPassword')) || undefined;

  const raw = await invoke<{ timetable?: Timetable; cloudError?: string | null }>(
    'bupt_fetch_academic',
    { account, password, cloudPassword },
  );
  const parsed = parseAcademicPayload(JSON.stringify(raw));
  const current = loadAcademicData();
  const next = current ? mergeAcademicPayload(current, parsed) : parsed;
  saveAcademicData(next);

  if (raw.timetable?.meta) {
    await useAppStore.getState().saveTimetable(raw.timetable);
  }

  return { data: next, timetable: raw.timetable, cloudError: raw.cloudError ?? undefined };
}