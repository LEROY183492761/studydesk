import { addDays } from 'date-fns';
import type { CaptureDraft } from '@/domain/models';

export interface ParseContext {
  now: Date;
}

/**
 * 自然语言解析器契约。
 * v1.1 接入规则解析；后续可替换/叠加 AI 解析，调用方无需改动。
 */
export interface NaturalLanguageParser {
  readonly id: string;
  parse(text: string, context: ParseContext): CaptureDraft | null;
}

const AMOUNT_PATTERN = /(?:花了|支出|花了|买)\D{0,6}(\d+(?:\.\d{1,2})?)/;
const TOMORROW_PATTERN = /明天/;
const CLOCK_PATTERN = /(\d{1,2})[:：点](\d{1,2})?/;

export const ruleBasedParser: NaturalLanguageParser = {
  id: 'rule-based',
  parse(text, context) {
    const trimmed = text.trim();
    if (!trimmed) return null;

    const amountMatch = AMOUNT_PATTERN.exec(trimmed);
    if (amountMatch) {
      const amount = Number(amountMatch[1]);
      return {
        kind: 'ledger',
        title: trimmed,
        amountCents: Math.round(amount * 100),
        occurredAt: context.now.toISOString(),
      };
    }

    let dueAt: string | undefined;
    if (TOMORROW_PATTERN.test(trimmed)) {
      const clock = CLOCK_PATTERN.exec(trimmed);
      const date = addDays(context.now, 1);
      date.setHours(clock ? Number(clock[1]) : 18, clock?.[2] ? Number(clock[2]) : 0, 0, 0);
      dueAt = date.toISOString();
    }

    return { kind: 'task', title: trimmed, dueAt };
  },
};