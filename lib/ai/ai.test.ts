import { describe, expect, it } from 'vitest';
import { CURRENCIES } from '@/lib/money';
import type { MonthData } from '@/lib/types';
import { parseCategoryReply, parseInsightReply } from './parse';
import { categorisePrompt, chatMessages, insightPrompt, monthContext, systemPrompt } from './prompts';
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

describe('chatMessages', () => {
  it('frames the month context like the reference, then the conversation', () => {
    const history = [
      { role: 'user' as const, content: 'Biggest expense?' },
      { role: 'assistant' as const, content: 'Kopi.' },
      { role: 'user' as const, content: 'And income?' },
    ];
    expect(chatMessages('CTX', history)).toEqual([
      { role: 'user', content: 'Here is my data:\nCTX' },
      { role: 'assistant', content: 'Got it. What would you like to know?' },
      ...history,
    ]);
  });
});

describe('insightPrompt', () => {
  it('adds the reference summary task and JSON shape to the month context', () => {
    expect(insightPrompt('CTX', 'summary')).toBe(
      'CTX\n\nTask: Write a friendly monthly summary with 3 points: the biggest spending driver, the savings result, and one notable pattern.' +
        '\nJSON shape: {"headline": one sentence, "points": [{"title": short, "text": one or two sentences}]}',
    );
  });
});

describe('parseInsightReply', () => {
  const point = (n: number) => ({ title: `T${n}`, text: `Text ${n}` });
  const reply = (count: number) => ({ headline: 'A good month.', points: Array.from({ length: count }, (_, i) => point(i + 1)) });

  it('accepts a summary with exactly 3 points and cuts extras', () => {
    expect(parseInsightReply(reply(3), 'summary')).toEqual(reply(3));
    expect(parseInsightReply(reply(5), 'summary')).toEqual(reply(3));
  });

  it('rejects a summary with too few points or a bad shape', () => {
    expect(parseInsightReply(reply(2), 'summary')).toBeNull();
    expect(parseInsightReply({ headline: '', points: [point(1), point(2), point(3)] }, 'summary')).toBeNull();
    expect(parseInsightReply({ headline: 'x', points: 'nope' }, 'summary')).toBeNull();
    expect(parseInsightReply(null, 'summary')).toBeNull();
  });
});
