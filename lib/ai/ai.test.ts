import { describe, expect, it } from 'vitest';
import { CURRENCIES } from '@/lib/money';
import type { MonthData } from '@/lib/types';
import { parseCategoryReply } from './parse';
import { categorisePrompt, monthContext, systemPrompt } from './prompts';
import { createRateLimiter } from './rate-limit';

const SGD = CURRENCIES[0];
const USD = { ...CURRENCIES[1], rate: 0.5 };

const MONTH: MonthData = {
  key: 'Jan-25',
  isSample: false,
  outOrder: ['Food', 'Transport'],
  inOrder: ['Work'],
  entries: [
    { id: '1', type: 'Out', category: 'Food', label: 'Kopi', amountCents: 180, note: '' },
    { id: '2', type: 'In', category: 'Work', label: 'Salary', amountCents: 500000, note: 'Jan pay' },
  ],
};

describe('systemPrompt', () => {
  it('uses the display symbol and the JSON or plain-text ending', () => {
    expect(systemPrompt(SGD, true)).toBe(
      'You are a cheerful, concise personal finance helper inside a budgeting app. Use only the data provided and never invent transactions. Write amounts like S$12.34. Reply with valid JSON only, no markdown or code fences.',
    );
    expect(systemPrompt(USD, false)).toMatch(/like US\$12\.34\. Reply in plain text without markdown, under 120 words\.$/);
  });
});

describe('monthContext', () => {
  it('lists categories and entries with amounts in the display currency', () => {
    expect(monthContext(MONTH, {}, USD)).toBe(
      'Month: Jan-25. Currency: USD (US$).\nExpense categories: Food, Transport. Income categories: Work.' +
        '\nEntries (type | category | item | amount):\nOut | Food | Kopi | 0.90\nIn | Work | Salary (Jan pay) | 2500.00',
    );
  });

  it('adds the budget line when budgets are set', () => {
    expect(monthContext(MONTH, { Food: 20000 }, SGD)).toContain('\nBudget set for this month: Food 200.00\n');
  });
});

describe('categorisePrompt', () => {
  it('matches the reference wording', () => {
    expect(categorisePrompt({ type: 'Out', label: 'Kopi', note: 'with Ann', categories: ['Food', 'Transport'] })).toBe(
      'Categorise this expense item: "Kopi" (note: with Ann). Existing categories: Food, Transport. Pick the best existing one; only propose a short new name if none fit. JSON: {"category": string}',
    );
    expect(categorisePrompt({ type: 'In', label: 'Bonus', note: '', categories: [] })).toMatch(/^Categorise this income item: "Bonus"\. /);
  });
});

describe('parseCategoryReply', () => {
  const cats = ['Food', 'Fixed & Bills'];

  it('matches an existing category case-insensitively', () => {
    expect(parseCategoryReply({ category: ' fixed & bills ' }, cats)).toEqual({ category: 'Fixed & Bills', isNew: false });
  });

  it('returns a proposed new category', () => {
    expect(parseCategoryReply({ category: 'Pets' }, cats)).toEqual({ category: 'Pets', isNew: true });
  });

  it('rejects bad replies', () => {
    expect(parseCategoryReply(null, cats)).toBeNull();
    expect(parseCategoryReply({ category: '' }, cats)).toBeNull();
    expect(parseCategoryReply({ category: 42 }, cats)).toBeNull();
    expect(parseCategoryReply({ category: 'x'.repeat(41) }, cats)).toBeNull();
  });
});

describe('createRateLimiter', () => {
  it('allows `limit` requests per window per key, then frees up as the window slides', () => {
    let t = 0;
    const limiter = createRateLimiter({ limit: 2, windowMs: 1000, now: () => t });
    expect(limiter.take('a')).toBe(true);
    t = 500;
    expect(limiter.take('a')).toBe(true);
    expect(limiter.take('a')).toBe(false);
    expect(limiter.take('b')).toBe(true);
    t = 1000; // the first request has left the window
    expect(limiter.take('a')).toBe(true);
    expect(limiter.take('a')).toBe(false);
  });
});
