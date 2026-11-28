import { describe, expect, it } from 'vitest';
import { CURRENCIES } from '@/lib/money';
import type { MonthData } from '@/lib/types';
import { PLAN_LINES } from '@/lib/plan';
import { LIMITS } from '@/lib/validation';
import { parseBudgetReply, parseCategoryReply, parseInsightReply, parseLineReply, parsePasteReply } from './parse';
import { budgetPrompt, categorisePrompt, chatMessages, insightPrompt, monthContext, pastePrompt, systemPrompt } from './prompts';
import { budgetSchema, CATEGORY_LINE_SCHEMA as lineSchema, PASTE_SCHEMA as pasteSchema } from './schemas';
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
  const NO_PLAN = { lineBudgets: {}, carry: {}, split: { needs: 50, invest: 20, fun: 30 } };

  it('lists the plan sections, their lines, the split targets and the entries in the display currency', () => {
    const text = monthContext(MONTH, NO_PLAN, USD);
    expect(text.startsWith('Month: Jan-25. Currency: USD (US$).\n')).toBe(true);
    expect(text).toContain('Budget plan, target share of income: Basic Needs 50%, Investment / Savings 20%, Entertainment 30%.');
    expect(text).toContain('Expense categories by section:\nBasic Needs: Rent / mortgage; Utilities; Phone and internet;');
    expect(text).toContain('\nInvestment / Savings: Emergency fund;');
    expect(text).toContain('\nEntertainment: Dining out and food delivery;');
    expect(text).toContain('\nIncome categories: Work.');
    expect(text).toContain('\nEntries (type | category | item | amount):\nOut | Food | Kopi | 0.90\nIn | Work | Salary (Jan pay) | 2500.00');
    expect(text).not.toContain('Budget set for this month');
  });

  it("adds this month's budgets per line, with carry-over", () => {
    const text = monthContext(
      MONTH,
      { lineBudgets: { groceries: 20000, rent: 80000 }, carry: { groceries: 3000, util: -500 }, split: NO_PLAN.split },
      SGD,
    );
    expect(text).toContain(
      '\nBudget set for this month (carry-over is unused budget from earlier months, negative if overspent): ' +
        'Rent / mortgage 800.00; Utilities (carry-over -5.00); Groceries 200.00 (carry-over +30.00)\n',
    );
  });
});

describe('categorisePrompt', () => {
  it('keeps the reference wording for income', () => {
    expect(categorisePrompt({ type: 'In', label: 'Bonus', note: 'Dec', categories: ['Work', 'Interest'] })).toBe(
      'Categorise this income item: "Bonus" (note: Dec). Existing categories: Work, Interest. Pick the best existing one; only propose a short new name if none fit. JSON: {"category": string}',
    );
  });
});

describe('suggest category for expenses (AI-1)', () => {
  it('asks the AI to pick a plan line id, listing every section and line', () => {
    const prompt = categorisePrompt({ type: 'Out', label: 'Kopi', note: 'with Ann', categories: ['Food'] });
    expect(prompt.startsWith('Categorise this expense item: "Kopi" (note: with Ann). Pick the best category (id = name) from these sections: ')).toBe(true);
    expect(prompt).toContain('Basic Needs: rent = Rent / mortgage; util = Utilities;');
    expect(prompt).toContain('Investment / Savings: emergency = Emergency fund;');
    expect(prompt).toContain('Entertainment: dining = Dining out and food delivery;');
    expect(prompt.endsWith('. JSON: {"lineId": string}')).toBe(true);
    expect(prompt).not.toContain('Food');
  });

  it('reads a line id back as its section, line and name', () => {
    expect(parseLineReply({ lineId: ' groceries ' })).toEqual({
      category: 'Groceries',
      isNew: false,
      sectionId: 'needs',
      lineId: 'groceries',
    });
  });

  it('rejects unknown line ids and bad shapes', () => {
    expect(parseLineReply({ lineId: 'pets' })).toBeNull();
    expect(parseLineReply({ lineId: 'Groceries' })).toBeNull();
    expect(parseLineReply({ category: 'Groceries' })).toBeNull();
    expect(parseLineReply({ lineId: 7 })).toBeNull();
    expect(parseLineReply(null)).toBeNull();
  });

  it('forces the form to one of the real line ids', () => {
    const enumIds = (lineSchema.properties.lineId as { enum: string[] }).enum;
    expect(enumIds).toHaveLength(23);
    expect(enumIds).toContain('groceries');
    expect(lineSchema.required).toEqual(['lineId']);
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
  const allLines = (amount: unknown) => Object.fromEntries(PLAN_LINES.map((l) => [l.id, amount]));

  it('asks for one amount per plan line id, with expected income in the display currency', () => {
    const prompt = budgetPrompt({ context: 'CTX', nextKey: 'Feb-25', currency: USD, expectedCents: 500000 });
    expect(prompt.startsWith('CTX\n\nTask: Suggest a realistic budget for each expense line for Feb-25, based on this month.')).toBe(true);
    expect(prompt).toContain('Treat one-off or annual items (like large insurance payments) as non-recurring unless they clearly repeat. Expected income: US$2500.00.');
    expect(prompt).toContain('Use these line ids exactly: rent, util, phone,');
    expect(prompt).toContain(', gifts.');
    expect(prompt.endsWith('\nJSON: {"budgets": {"<lineId>": number}, "note": one or two sentences explaining the plan}')).toBe(true);
  });

  it('builds a strict form with one required number per plan line', () => {
    const schema = budgetSchema();
    const budgets = schema.properties.budgets as { properties: Record<string, unknown>; required: string[]; additionalProperties: boolean };
    expect(Object.keys(budgets.properties)).toEqual(PLAN_LINES.map((l) => l.id));
    expect(budgets.required).toEqual(PLAN_LINES.map((l) => l.id));
    expect(budgets.additionalProperties).toBe(false);
    expect(schema.required).toEqual(['budgets', 'note']);
  });

  it('keeps exact line ids, converts display amounts to SGD cents, and keeps the note', () => {
    const reply = { budgets: { ...allLines(0), groceries: 50, pets: 99 }, note: ' Trimmed a little. ' };
    const parsed = parseBudgetReply(reply, USD);
    expect(parsed?.note).toBe('Trimmed a little.');
    expect(parsed?.budgets.groceries).toBe(10000);
    expect(parsed?.budgets.rent).toBe(0);
    expect(Object.keys(parsed?.budgets ?? {})).toHaveLength(23);
    expect(parsed?.budgets).not.toHaveProperty('pets');
  });

  it('rejects the whole reply when any line is missing or has a bad amount, so nothing is saved', () => {
    expect(parseBudgetReply({ budgets: { ...allLines(5), rent: -5 }, note: '' }, SGD)).toBeNull();
    expect(parseBudgetReply({ budgets: { ...allLines(5), rent: Number.NaN }, note: '' }, SGD)).toBeNull();
    const missing = allLines(5);
    delete missing.util;
    expect(parseBudgetReply({ budgets: missing, note: 'x' }, SGD)).toBeNull();
    expect(parseBudgetReply({ budgets: allLines(5), note: 42 }, SGD)).toBeNull();
    expect(parseBudgetReply({ budgets: 'nope', note: 'x' }, SGD)).toBeNull();
  });
});

describe('paste to add (AI-6)', () => {
  const income = ['Work'];
  const row = (over: Record<string, unknown> = {}) => ({
    type: 'Out',
    category: 'food',
    lineId: 'groceries',
    label: 'Kopi',
    amount: 0.9,
    note: '',
    ...over,
  });

  it('asks for a plan line id on every expense, and an object with an entries array', () => {
    const prompt = pastePrompt({ incomeCategories: income, currency: USD, text: 'Kopi 1.80' });
    expect(prompt.startsWith('Extract every money entry from the text below. Expense lines (id = name) by section: Basic Needs: rent = Rent / mortgage;')).toBe(true);
    expect(prompt).toContain(' Income categories: Work. ');
    expect(prompt).toContain('For an expense set "lineId" to the best line id; for income use an existing category when it fits, otherwise a short new one, and set "lineId" to "".');
    expect(prompt).toContain('Amounts as plain numbers in USD.');
    expect(prompt).toContain(
      '\nReturn a JSON object: {"entries": [{"type": "Out" or "In", "category": string, "lineId": string, "label": short merchant or source, "amount": number, "note": short string or ""}]}',
    );
    expect(prompt.endsWith('\n\nText:\nKopi 1.80')).toBe(true);
  });

  it('forces each row to a real line id, or an empty one for income', () => {
    const items = (pasteSchema.properties.entries as { items: { properties: { lineId: { enum: string[] } }; required: string[] } }).items;
    expect(items.properties.lineId.enum).toHaveLength(24);
    expect(items.properties.lineId.enum).toContain('');
    expect(items.properties.lineId.enum).toContain('dining');
    expect(items.required).toContain('lineId');
  });

  it('gives an expense its line, section and the line name as category, and converts to SGD cents', () => {
    expect(parsePasteReply({ entries: [row({ lineId: 'dining', label: 'Grab Food', amount: 50 })] }, income, USD)).toEqual([
      { type: 'Out', category: 'Dining out and food delivery', label: 'Grab Food', amountCents: 10000, note: '', sectionId: 'fun', lineId: 'dining' },
    ]);
  });

  it('falls back to the keyword rules when the line id is unknown or empty, then to Unassigned', () => {
    const rows = parsePasteReply(
      {
        entries: [
          row({ lineId: 'pets', label: 'Netflix' }),
          row({ lineId: '', label: 'Vet visit', category: 'Pets' }),
        ],
      },
      income,
      SGD,
    );
    expect(rows).toEqual([
      { type: 'Out', category: 'Streaming services', label: 'Netflix', amountCents: 90, note: '', sectionId: 'fun', lineId: 'streaming' },
      { type: 'Out', category: 'Unassigned', label: 'Vet visit', amountCents: 90, note: '', sectionId: null, lineId: null },
    ]);
  });

  it('matches existing income categories case-insensitively and keeps new ones, with no line', () => {
    const rows = parsePasteReply(
      {
        entries: [
          row({ type: 'In', category: 'work', lineId: '', label: 'Salary', amount: 100 }),
          row({ type: 'In', category: 'Bonus', lineId: 'rent', label: 'Year-end', amount: 50, note: 'Dec' }),
        ],
      },
      income,
      USD,
    );
    expect(rows).toEqual([
      { type: 'In', category: 'Work', label: 'Salary', amountCents: 20000, note: '', sectionId: null, lineId: null },
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
      income,
      SGD,
    );
    expect(rows).toEqual([
      { type: 'Out', category: 'Groceries', label: 'Kopi', amountCents: 90, note: 'n'.repeat(LIMITS.note), sectionId: 'needs', lineId: 'groceries' },
    ]);
  });

  it('keeps at most 200 rows and rejects a bad shape', () => {
    expect(parsePasteReply({ entries: Array.from({ length: 250 }, () => row()) }, income, SGD)).toHaveLength(200);
    expect(parsePasteReply({ entries: 'nope' }, income, SGD)).toBeNull();
    expect(parsePasteReply([row()], income, SGD)).toBeNull();
  });
});
