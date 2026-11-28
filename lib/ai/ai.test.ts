import { describe, expect, it } from 'vitest';
import { CURRENCIES } from '@/lib/money';
import type { MonthData } from '@/lib/types';
import { LIMITS } from '@/lib/validation';
import { parseBudgetReply, parseCategoryReply, parseInsightReply, parsePasteReply } from './parse';
import { budgetPrompt, categorisePrompt, chatMessages, insightPrompt, monthContext, pastePrompt, systemPrompt } from './prompts';
import { budgetSchema } from './schemas';
import { createRateLimiter } from './rate-limit';

const SGD = CURRENCIES[0];
const USD = { ...CURRENCIES[1], rate: 0.5 };

const MONTH: MonthData = {
  key: 'Jan-25',
  isSample: false,
  outOrder: ['Food', 'Transport'],
  inOrder: ['Work'],
  entries: [
    { id: '1', type: 'Out', category: 'Food', label: 'Kopi', amountCents: 180, note: '', sectionId: null, lineId: null },
    { id: '2', type: 'In', category: 'Work', label: 'Salary', amountCents: 500000, note: 'Jan pay', sectionId: null, lineId: null },
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

describe('alerts (AI-5)', () => {
  const point = (n: number) => ({ title: `T${n}`, text: `Text ${n}` });
  const reply = (count: number) => ({ headline: 'Two things stood out.', points: Array.from({ length: count }, (_, i) => point(i + 1)) });

  it('uses the reference alerts task', () => {
    expect(insightPrompt('CTX', 'alerts')).toBe(
      'CTX\n\nTask: Find 2-4 unusual or noteworthy spending items: one-off large payments, repeated small spends that add up, or categories over budget.' +
        '\nJSON shape: {"headline": one sentence, "points": [{"title": short, "text": one or two sentences}]}',
    );
  });

  it('needs 2 to 4 alerts and cuts extras', () => {
    expect(parseInsightReply(reply(1), 'alerts')).toBeNull();
    expect(parseInsightReply(reply(2), 'alerts')).toEqual(reply(2));
    expect(parseInsightReply(reply(4), 'alerts')).toEqual(reply(4));
    expect(parseInsightReply(reply(6), 'alerts')).toEqual(reply(4));
  });
});

describe('tips (AI-7)', () => {
  const point = (n: number) => ({ title: `T${n}`, text: `Text ${n}` });
  const reply = (count: number) => ({ headline: 'Three easy wins.', points: Array.from({ length: count }, (_, i) => point(i + 1)) });

  it('uses the reference tips task', () => {
    expect(insightPrompt('CTX', 'tips')).toBe(
      'CTX\n\nTask: Give 3 practical savings tips tied to specific merchants or categories in the data, each with an estimated monthly saving.' +
        '\nJSON shape: {"headline": one sentence, "points": [{"title": short, "text": one or two sentences}]}',
    );
  });

  it('needs 3 tips and cuts extras', () => {
    expect(parseInsightReply(reply(2), 'tips')).toBeNull();
    expect(parseInsightReply(reply(3), 'tips')).toEqual(reply(3));
    expect(parseInsightReply(reply(4), 'tips')).toEqual(reply(3));
  });
});

describe('smart budget (AI-4)', () => {
  const cats = ['Food', 'Fixed & Bills'];

  it('uses the reference budget task with expected income in the display currency', () => {
    expect(budgetPrompt({ context: 'CTX', nextKey: 'Feb-25', currency: USD, expectedCents: 500000, categories: cats })).toBe(
      'CTX\n\nTask: Suggest a realistic budget for each expense category for Feb-25, based on this month. Treat one-off or annual items (like large insurance payments) as non-recurring unless they clearly repeat. Expected income: US$2500.00. Use these category names exactly: Food, Fixed & Bills.' +
        '\nJSON: {"budgets": {"<category>": number}, "note": one or two sentences explaining the plan}',
    );
  });

  it('builds a strict form with one required number per category', () => {
    const schema = budgetSchema(cats);
    const budgets = schema.properties.budgets as { properties: Record<string, unknown>; required: string[]; additionalProperties: boolean };
    expect(Object.keys(budgets.properties)).toEqual(cats);
    expect(budgets.required).toEqual(cats);
    expect(budgets.additionalProperties).toBe(false);
    expect(schema.required).toEqual(['budgets', 'note']);
  });

  it('keeps exact category names, converts display amounts to SGD cents, and keeps the note', () => {
    expect(parseBudgetReply({ budgets: { Food: 50, 'Fixed & Bills': 0, Pets: 50 }, note: ' Trimmed a little. ' }, cats, USD)).toEqual({
      budgets: { Food: 10000, 'Fixed & Bills': 0 },
      note: 'Trimmed a little.',
    });
  });

  it('rejects the whole reply when any category is missing or has a bad amount, so nothing is saved', () => {
    expect(parseBudgetReply({ budgets: { Food: -5, 'Fixed & Bills': 20 }, note: '' }, cats, SGD)).toBeNull();
    expect(parseBudgetReply({ budgets: { Food: Number.NaN, 'Fixed & Bills': 20 }, note: '' }, cats, SGD)).toBeNull();
    expect(parseBudgetReply({ budgets: { Food: 5 }, note: 'x' }, cats, SGD)).toBeNull(); // Fixed & Bills missing
    expect(parseBudgetReply({ budgets: { Food: 5, 'Fixed & Bills': 1 }, note: 42 }, cats, SGD)).toBeNull();
    expect(parseBudgetReply({ budgets: 'nope', note: 'x' }, cats, SGD)).toBeNull();
  });
});

describe('paste to add (AI-6)', () => {
  const cats = { Out: ['Food', 'Transport'], In: ['Work'] };
  const row = (over: Record<string, unknown> = {}) => ({ type: 'Out', category: 'food', label: 'Kopi', amount: 0.9, note: '', ...over });

  it('uses the reference paste task, asking for an object with an entries array', () => {
    expect(pastePrompt({ categories: cats, currency: USD, text: 'Kopi 1.80' })).toBe(
      'Extract every money entry from the text below. Expense categories: Food, Transport. Income categories: Work. Use an existing category when it fits, otherwise a short new one. Amounts as plain numbers in USD.' +
        '\nReturn a JSON object: {"entries": [{"type": "Out" or "In", "category": string, "label": short merchant or source, "amount": number, "note": short string or ""}]}' +
        '\n\nText:\nKopi 1.80',
    );
  });

  it('matches existing categories by type, converts amounts to SGD cents, and keeps new categories', () => {
    expect(
      parsePasteReply({ entries: [row(), row({ type: 'In', category: 'Bonus', label: 'Year-end', amount: 50, note: 'Dec' })] }, cats, USD),
    ).toEqual([
      // Expenses are placed by the keyword rules until the AI picks lines itself (food -> Groceries).
      { type: 'Out', category: 'Food', label: 'Kopi', amountCents: 180, note: '', sectionId: 'needs', lineId: 'groceries' },
      { type: 'In', category: 'Bonus', label: 'Year-end', amountCents: 10000, note: 'Dec', sectionId: null, lineId: null },
    ]);
  });

  it('drops bad rows and trims an over-long note', () => {
    const rows = parsePasteReply(
      {
        entries: [
          row({ type: 'Sideways' }),
          row({ label: '' }),
          row({ label: 'x'.repeat(LIMITS.label + 1) }),
          row({ amount: 0 }),
          row({ amount: -3 }),
          row({ category: '' }),
          row({ note: 'n'.repeat(LIMITS.note + 10) }),
        ],
      },
      cats,
      SGD,
    );
    expect(rows).toEqual([{ type: 'Out', category: 'Food', label: 'Kopi', amountCents: 90, note: 'n'.repeat(LIMITS.note), sectionId: 'needs', lineId: 'groceries' }]);
  });

  it('keeps at most 200 rows and rejects a bad shape', () => {
    expect(parsePasteReply({ entries: Array.from({ length: 250 }, () => row()) }, cats, SGD)).toHaveLength(200);
    expect(parsePasteReply({ entries: 'nope' }, cats, SGD)).toBeNull();
    expect(parsePasteReply([row()], cats, SGD)).toBeNull();
  });
});
