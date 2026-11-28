import { clerk } from '@clerk/testing/playwright';
import { expect, test, type BrowserContext, type Page } from '@playwright/test';
import fs from 'node:fs';
import { snapshot } from './db';
import { signIn, toast } from './helpers';
import { loadIds } from './users';

/*
 * The whole user journey against the real app, Clerk and Neon. Every UI step is checked
 * twice: on screen, and in the database rows the app actually wrote.
 *
 * "Start fresh" creates the current calendar month, so the month keys are computed.
 */
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const keyOf = (d: Date) => `${MONTHS[d.getMonth()]}-${String(d.getFullYear() % 100).padStart(2, '0')}`;
const now = new Date();
const THIS = keyOf(now);
const NEXT = keyOf(new Date(now.getFullYear(), now.getMonth() + 1, 1));

test.describe.configure({ mode: 'serial' });

let context: BrowserContext;
let page: Page;
const ids = loadIds();

test.beforeAll(async ({ browser }) => {
  context = await browser.newContext({ viewport: { width: 1280, height: 900 }, acceptDownloads: true });
  page = await context.newPage();
  if (process.env.E2E_LOG) {
    const t0 = Date.now();
    const at = () => `${((Date.now() - t0) / 1000).toFixed(1)}s`;
    page.on('pageerror', (e) => console.log(at(), 'PAGEERROR', e.message.slice(0, 300)));
    page.on('console', (m) => m.type() === 'error' && console.log(at(), 'CONSOLE', m.text().slice(0, 300)));
    page.on('request', (r) => r.headers()['next-action'] && console.log(at(), 'ACTION >', (r.postData() ?? '').slice(0, 140)));
    page.on('response', (r) => r.request().headers()['next-action'] && console.log(at(), 'ACTION <', r.status()));
  }
});
test.afterAll(async () => context.close());

// ---------------------------------------------------------------------------- helpers

const totals = () => page.getByRole('region', { name: 'Month totals' });
const dialog = () => page.getByRole('dialog');
const column = (name: string) => page.getByRole('region', { name, exact: true });
const nav = (name: RegExp) => page.getByRole('navigation', { name: 'Main' }).getByRole('link', { name });
const entriesOf = async (userId: string, month = THIS) => (await snapshot(userId)).entries.filter((e) => e.month === month);
const entryNamed = async (label: string, userId = ids.a) => (await entriesOf(userId)).find((e) => e.label === label);

type EntryOpts = {
  type?: 'Out' | 'In';
  /** Expenses: plan section and line, by their names. */
  section?: string;
  line?: string;
  /** Income: an existing category, or a new one. */
  category?: string;
  newCategory?: string;
  label: string;
  amount: string;
  note?: string;
};

async function fillEntry(opts: EntryOpts) {
  const d = dialog();
  if (opts.type) await d.getByRole('button', { name: opts.type === 'Out' ? 'Out · Expense' : 'In · Income' }).click();
  // Pick the category first: a picked category switches auto-categorise off (PRD AI-1).
  if (opts.section) await d.getByLabel('Section', { exact: true }).selectOption({ label: opts.section });
  if (opts.line) await d.getByLabel('Category', { exact: true }).selectOption({ label: opts.line });
  if (opts.newCategory) {
    await d.getByLabel('Category', { exact: true }).selectOption({ label: '+ New category…' });
    await d.getByLabel('New category name').fill(opts.newCategory);
  } else if (opts.category) {
    await d.getByLabel('Category', { exact: true }).selectOption(opts.category);
  }
  await d.getByLabel('Item / merchant / source').fill(opts.label);
  await d.getByLabel(/^Amount/).fill(opts.amount);
  if (opts.note !== undefined) await d.getByLabel('Note (optional)').fill(opts.note);
  await d.getByRole('button', { name: 'Save' }).click();
}

async function addItem(opts: EntryOpts) {
  await page.getByRole('button', { name: /Add item/ }).click();
  await expect(dialog()).toBeVisible();
  await fillEntry(opts);
  await expect(dialog()).toBeHidden();
}

async function confirmWith(button: string) {
  await dialog().getByRole('button', { name: button, exact: true }).click();
  await expect(dialog()).toBeHidden();
}

async function expectTotals(earned: string, spent: string, left: string) {
  const t = totals();
  await expect(t).toContainText(earned);
  await expect(t).toContainText(spent);
  await expect(t).toContainText(left);
}

/** Rewrite the arguments of the next Server Action POST (simulates a tampered request). */
async function tamperNextAction(from: string, to: string) {
  let hits = 0;
  await page.route('**/*', async (route) => {
    const req = route.request();
    if (req.method() === 'POST' && req.headers()['next-action'] && hits === 0) {
      hits++;
      const body = req.postData() ?? '';
      await route.continue({ postData: body.split(from).join(to) });
      return;
    }
    await route.continue();
  });
  return () => page.unroute('**/*');
}

// ---------------------------------------------------------------------------- user A

test('A1/A3: sign in, first run "Start fresh" creates this month with default categories', async () => {
  await signIn(page, 'a');
  await page.getByRole('button', { name: 'Start fresh' }).click();
  await page.waitForURL(`**/m/${THIS}`);
  await expectTotals('S$0.00', 'S$0.00', 'S$0.00');

  const db = await snapshot(ids.a);
  expect(db.months.map((m) => m.key)).toEqual([THIS]);
  const cats = ['Out', 'In'].flatMap((t) => db.months[0].categories.filter((c) => c.type === t).map((c) => `${c.type}:${c.name}`));
  expect(cats).toEqual([
    'Out:Food', 'Out:Transport', 'Out:Fixed & Bills', 'Out:Shopping & Insurance',
    'In:Work', 'In:Reimburse', 'In:Interest',
  ]);
});

test('E1/E7: invalid input is rejected with the PRD message and nothing is saved', async () => {
  await page.getByRole('button', { name: '+ Add item' }).click();
  const d = dialog();
  await d.getByLabel('Item / merchant / source').fill('');
  await d.getByRole('button', { name: 'Save' }).click();
  await toast(page, 'Please fill in item, category and amount');
  await expect(d).toBeVisible();

  await d.getByLabel('Item / merchant / source').fill('Bad');
  await d.getByLabel(/^Amount/).fill('-5');
  await d.getByRole('button', { name: 'Save' }).click();
  await expect(d).toBeVisible();
  await d.getByRole('button', { name: 'Cancel' }).click();
  await expect(d).toBeHidden();
  expect(await entriesOf(ids.a)).toHaveLength(0);
});

test('E1/D1-D3: add an expense and an income; totals update and rows land in Neon', async () => {
  await addItem({ section: 'Basic Needs', line: 'Groceries', label: 'Lunch', amount: '12.50', note: 'team lunch' });
  await toast(page, 'Item added');
  await expect(page).toHaveURL(new RegExp(`/m/${THIS}$`)); // E6: stays on the Dashboard
  await expectTotals('S$0.00', 'S$12.50', '−S$12.50');

  await addItem({ type: 'In', category: 'Work', label: 'Salary', amount: '3000' });
  await expectTotals('S$3,000.00', 'S$12.50', 'S$2,987.50');
  await expect(totals()).toContainText('99.6% saved');

  // The expense is saved with its section and line; its category is named after the line.
  await expect.poll(async () => (await entriesOf(ids.a)).map((e) => [e.type, e.category, e.label, e.cents, e.note, e.sectionId, e.lineId]).sort())
    .toEqual([['In', 'Work', 'Salary', 300000, null, null, null], ['Out', 'Groceries', 'Lunch', 1250, 'team lunch', 'needs', 'groceries']].sort());
});

test('E5: edit an item; the new amount is stored and survives a reload', async () => {
  await nav(/^Expenses/).click();
  await column('Groceries').getByRole('button', { name: 'Edit Lunch' }).click();
  await expect(dialog().getByLabel(/^Amount/)).toHaveValue('12.50');
  await dialog().getByLabel(/^Amount/).fill('15');
  await dialog().getByRole('button', { name: 'Save' }).click();
  await toast(page, 'Item updated');
  await expect.poll(async () => (await entryNamed('Lunch'))?.cents).toBe(1500);

  await page.reload();
  await expectTotals('S$3,000.00', 'S$15.00', 'S$2,985.00');
  await expect(column('Groceries')).toContainText('S$15.00');
});

test('B7/B6: move with "Move to…" and with drag and drop', async () => {
  await column('Groceries').getByLabel('Move Lunch to category').selectOption('Transport');
  await toast(page, 'Moved "Lunch" to Transport');
  await expect(column('Transport')).toContainText('Lunch');
  await expect.poll(async () => (await entryNamed('Lunch'))?.lineId).toBe('transport');

  // Native HTML5 drag and drop. Both columns must be on screen: scrolling while the button is
  // down cancels a drag, and Groceries sits on the second row of the Basic Needs grid.
  await page.setViewportSize({ width: 1280, height: 1800 });
  await column('Transport').getByText('Lunch', { exact: true }).dragTo(column('Groceries'));
  await toast(page, 'Moved "Lunch" to Groceries');
  await expect(column('Groceries')).toContainText('Lunch');
  await expect.poll(async () => (await entryNamed('Lunch'))?.lineId).toBe('groceries');
  await page.setViewportSize({ width: 1280, height: 900 });
});

test('B2/B8/B5: search, "+ Add to", delete with confirm', async () => {
  await column('Shopping').getByRole('button', { name: '+ Add to Shopping' }).click();
  await expect(dialog().getByLabel('Section', { exact: true })).toHaveValue('fun');
  await expect(dialog().getByLabel('Category', { exact: true })).toHaveValue('shopping');
  await fillEntry({ label: 'Shoes', amount: '80' });
  await expect(column('Shopping')).toContainText('Shoes');
  await expect.poll(async () => (await entryNamed('Shoes'))?.cents).toBe(8000);

  await page.getByPlaceholder('Search items, e.g. Uniqlo').fill('lun');
  await expect(column('Groceries')).toContainText('Lunch');
  await expect(column('Shopping')).not.toContainText('Shoes');
  await page.getByPlaceholder('Search items, e.g. Uniqlo').fill('');

  await column('Shopping').getByRole('button', { name: 'Delete Shoes' }).click();
  await expect(dialog()).toContainText('Delete "Shoes" (S$80.00) from Shopping?');
  await confirmWith('Delete');
  await toast(page, 'Item deleted');
  await expect.poll(async () => await entryNamed('Shoes')).toBeUndefined();
});

test('S2: the Expenses board groups plan lines by section; income keeps + Category', async () => {
  const headings = page.getByRole('heading', { level: 2 });
  await expect(page.getByRole('region', { name: 'Basic Needs', exact: true })).toBeVisible();
  await expect(page.getByRole('region', { name: 'Investment / Savings', exact: true })).toBeVisible();
  await expect(page.getByRole('region', { name: 'Entertainment', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: '+ Category' })).toHaveCount(0);
  await expect(column('Groceries').getByRole('button', { name: /^Rename/ })).toHaveCount(0);
  // The first Basic Needs columns come in budget-page order.
  const needs = page.getByRole('region', { name: 'Basic Needs', exact: true });
  await expect(needs.getByRole('heading', { level: 2 })).toHaveText([
    '1. Basic Needs Fixed costs', 'Rent / mortgage', 'Utilities', 'Phone and internet', 'Transport', 'Groceries', 'Insurance',
    'Loan or debt repayments', 'Family support', 'Childcare or education fees', 'Essential subscriptions',
  ]);
  void headings;
});

test('B9-B11: create, rename and delete-empty-only categories (Income board)', async () => {
  await nav(/^Income/).click();
  await page.getByRole('button', { name: '+ Category' }).click();
  await dialog().getByLabel('Category name').fill('Side gigs');
  await dialog().getByRole('button', { name: 'Save' }).click();
  await toast(page, 'Added "Side gigs"');
  await expect(column('Side gigs')).toBeVisible();

  // Duplicate (case-insensitive) is ignored.
  await page.getByRole('button', { name: '+ Category' }).click();
  await dialog().getByLabel('Category name').fill('side gigs');
  await dialog().getByRole('button', { name: 'Save' }).click();
  await expect(dialog()).toBeHidden();

  await column('Side gigs').getByRole('button', { name: 'Rename Side gigs' }).click();
  await dialog().getByLabel('Category name').fill('Side hustle');
  await dialog().getByRole('button', { name: 'Save' }).click();
  await toast(page, 'Renamed to "Side hustle"');
  const names = async () => (await snapshot(ids.a)).months[0].categories.map((c) => c.name);
  await expect.poll(async () => (await names()).filter((n) => /^side/i.test(n))).toEqual(['Side hustle']);

  // Non-empty column can't be deleted.
  await column('Work').getByRole('button', { name: 'Delete empty category Work' }).click();
  await toast(page, 'Move or delete the 1 items in "Work" first');

  await column('Side hustle').getByRole('button', { name: 'Delete empty category Side hustle' }).click();
  await expect(dialog()).toContainText('Remove the empty "Side hustle" column?');
  await confirmWith('Remove');
  await toast(page, 'Removed "Side hustle"');
  await expect.poll(names).not.toContain('Side hustle');

  // Rename a category with items: items follow (B10).
  await column('Work').getByRole('button', { name: 'Rename Work' }).click();
  await dialog().getByLabel('Category name').fill('Job');
  await dialog().getByRole('button', { name: 'Save' }).click();
  await toast(page, 'Renamed to "Job"');
  await expect.poll(async () => (await entryNamed('Salary'))?.category).toBe('Job');
  await column('Job').getByRole('button', { name: 'Rename Job' }).click();
  await dialog().getByLabel('Category name').fill('Work');
  await dialog().getByRole('button', { name: 'Save' }).click();
  await expect.poll(async () => (await entryNamed('Salary'))?.category).toBe('Work');
  await nav(/^Expenses/).click();
});

test('S1/E2: the Category select lists only the chosen section; the line is saved with its section', async () => {
  await page.getByRole('button', { name: /Add item/ }).click();
  const d = dialog();
  await expect(d.getByLabel('Category', { exact: true })).toBeDisabled(); // until a section is chosen
  await d.getByLabel('Section', { exact: true }).selectOption({ label: 'Basic Needs' });
  const needsLines = await d.getByLabel('Category', { exact: true }).locator('option').allTextContents();
  expect(needsLines).toEqual([
    'Choose a category…', 'Rent / mortgage', 'Utilities', 'Phone and internet', 'Transport', 'Groceries', 'Insurance',
    'Loan or debt repayments', 'Family support', 'Childcare or education fees', 'Essential subscriptions',
  ]);
  await d.getByLabel('Section', { exact: true }).selectOption({ label: 'Entertainment' });
  const funLines = await d.getByLabel('Category', { exact: true }).locator('option').allTextContents();
  expect(funLines).not.toContain('Rent / mortgage');
  expect(funLines).toContain('Dining out and food delivery');
  await page.keyboard.press('Escape');
  await expect(dialog()).toBeHidden();

  await addItem({ section: 'Entertainment', line: 'Dining out and food delivery', label: 'Latte', amount: '6.40' });
  await expect(column('Dining out and food delivery')).toContainText('Latte');
  await expect.poll(async () => await entryNamed('Latte')).toMatchObject({
    category: 'Dining out and food delivery', sectionId: 'fun', lineId: 'dining', cents: 640, type: 'Out',
  });
});

test('AI-1: auto-categorise on blur picks a plan line; "✦ Suggest" fills both selects', async () => {
  // The app runs with AI_FAKE=1: canned replies, no provider call.
  await page.getByRole('button', { name: /Add item/ }).click();
  const d = dialog();
  await d.getByLabel('Item / merchant / source').fill('Grab home');
  await d.getByLabel(/^Amount/).focus(); // blur the item name
  await toast(page, 'Suggested category: Transport');
  await expect(d.getByLabel('Section', { exact: true })).toHaveValue('needs');
  await expect(d.getByLabel('Category', { exact: true })).toHaveValue('transport');

  await d.getByLabel('Item / merchant / source').fill('Vet visit');
  await d.getByRole('button', { name: '✦ Suggest' }).click();
  await toast(page, 'Suggested category: Shopping');
  await expect(d.getByLabel('Section', { exact: true })).toHaveValue('fun');
  await expect(d.getByLabel('Category', { exact: true })).toHaveValue('shopping');

  await page.keyboard.press('Escape');
  await expect(dialog()).toBeHidden();
  expect(await entryNamed('Vet visit')).toBeUndefined();
});

test('AI-2: ask your money answers a starter question and a follow-up; Clear resets', async () => {
  await nav(/AI helper/).click();
  const log = page.getByRole('log', { name: 'Ask your money' });
  await log.getByRole('button', { name: 'What was my biggest expense?' }).click();
  await expect(log).toContainText('You asked: "What was my biggest expense?"');

  const input = page.getByRole('textbox', { name: 'Ask your money' });
  await input.fill('And my smallest?');
  await input.press('Enter');
  await expect(log).toContainText('You asked: "And my smallest?"');

  await page.getByRole('button', { name: 'Clear' }).click();
  await expect(log.getByRole('button', { name: 'What was my biggest expense?' })).toBeVisible();

  await nav(/^Expenses/).click(); // later tests start from the expenses board
});

test('AI-3: monthly summary is generated, saved for the month, and refreshed', async () => {
  await nav(/AI helper/).click();
  const card = page.getByRole('region', { name: 'Monthly summary' });
  await card.getByRole('button', { name: 'Generate' }).click();
  await expect(card).toContainText('A steady month with money left over.');
  await expect(card.getByRole('button', { name: 'Refresh' })).toBeVisible();

  const saved = async () => (await snapshot(ids.a)).months.find((m) => m.key === THIS)?.aiInsights.find((i) => i.kind === 'summary');
  await expect.poll(async () => (await saved())?.payload).toMatchObject({ headline: 'A steady month with money left over.' });
  const firstAt = (await saved())!.generatedAt.getTime();

  await page.reload();
  await expect(card).toContainText('A steady month with money left over.');
  await card.getByRole('button', { name: 'Refresh' }).click();
  await expect.poll(async () => (await saved())!.generatedAt.getTime()).toBeGreaterThan(firstAt);

  await nav(/^Expenses/).click();
});

/** Generates one insight card on the AI tab and checks it on screen and in Neon (AI-5/7). */
async function generateInsightCard(title: string, kind: 'alerts' | 'tips', headline: string) {
  await nav(/AI helper/).click();
  const card = page.getByRole('region', { name: title });
  await card.getByRole('button', { name: 'Generate' }).click();
  await expect(card).toContainText(headline);
  await expect(card.getByRole('button', { name: 'Refresh' })).toBeVisible();
  await expect
    .poll(async () => (await snapshot(ids.a)).months.find((m) => m.key === THIS)?.aiInsights.find((i) => i.kind === kind)?.payload)
    .toMatchObject({ headline });
  await page.reload();
  await expect(card).toContainText(headline);
  await nav(/^Expenses/).click();
}

test('AI-5: spending alerts are generated and saved for the month', async () => {
  await generateInsightCard('Spending alerts', 'alerts', 'Two things are worth a look this month.');
});

test('AI-7: savings tips are generated and saved for the month', async () => {
  await generateInsightCard('Savings tips', 'tips', 'Three easy wins for next month.');
});

test('G5/S1: currency switch converts every amount; rates are saved; input converts back to SGD', async () => {
  // SGD state: Earned 3000.00, Spent 15.00 + 6.40 = 21.40
  await expectTotals('S$3,000.00', 'S$21.40', 'S$2,978.60');

  await page.getByRole('combobox', { name: 'Currency' }).selectOption('USD');
  await expectTotals('US$2,310.00', 'US$16.48', 'US$2,293.52'); // × 0.77
  await expect(column('Groceries')).toContainText('US$11.55');
  await expect.poll(async () => (await snapshot(ids.a)).user?.currency).toBe('USD');

  const rate = page.getByLabel('Rate: USD per S$1');
  await rate.fill('0.8');
  await rate.press('Enter');
  await expectTotals('US$2,400.00', 'US$17.12', 'US$2,382.88'); // × 0.8
  await expect.poll(async () => (await snapshot(ids.a)).user?.currencyRates.map((r) => [r.code, r.rate])).toEqual([['USD', 0.8]]);

  // Typing 4.00 in US$ at 0.8 stores S$5.00 (500 cents).
  await addItem({ section: 'Basic Needs', line: 'Groceries', label: 'Bagel', amount: '4.00' });
  await expect.poll(async () => (await entryNamed('Bagel'))?.cents).toBe(500);

  await page.reload();
  await expect(page.getByRole('combobox', { name: 'Currency' })).toHaveValue('USD');
  await expect(totals()).toContainText('US$21.12');

  // Stored values never change with the display currency.
  expect((await entryNamed('Lunch'))?.cents).toBe(1500);

  await page.getByRole('combobox', { name: 'Currency' }).selectOption('SGD');
  await expectTotals('S$3,000.00', 'S$26.40', 'S$2,973.60');
});

test('Data consistency: editing only the note in another currency keeps the stored amount', async () => {
  await addItem({ section: 'Basic Needs', line: 'Groceries', label: 'Gum', amount: '1.01' });
  await expect.poll(async () => (await entryNamed('Gum'))?.cents).toBe(101);

  for (const code of ['GBP', 'EUR', 'USD']) {
    await page.getByRole('combobox', { name: 'Currency' }).selectOption(code);
    await expect(page.getByRole('combobox', { name: 'Currency' })).toHaveValue(code);
    await nav(/^Expenses/).click();
    await column('Groceries').getByRole('button', { name: 'Edit Gum' }).click();
    await dialog().getByLabel('Note (optional)').fill(`note in ${code}`);
    await dialog().getByRole('button', { name: 'Save' }).click();
    await toast(page, 'Item updated');
    await expect.poll(async () => (await entryNamed('Gum'))?.note).toBe(`note in ${code}`);
    expect((await entryNamed('Gum'))?.cents, `amount drifted after an edit in ${code}`).toBe(101);
  }
  await page.getByRole('combobox', { name: 'Currency' }).selectOption('SGD');
  await expect(totals()).toContainText('S$27.41');
});

test('S3-S5: settings modal saves per user; compact cards hide notes', async () => {
  await nav(/^Expenses/).click();
  await expect(column('Groceries')).toContainText('team lunch');
  await page.getByRole('button', { name: 'Settings' }).click();
  await expect(dialog().getByLabel('Auto-categorise on item name blur')).toBeChecked();
  await expect(dialog().getByLabel('Show sample audit panel')).toBeChecked();
  await dialog().getByLabel('Compact item cards (hide notes on boards)').check();
  await dialog().getByRole('button', { name: 'Save' }).click();
  await toast(page, 'Settings saved');
  await expect(column('Groceries')).not.toContainText('team lunch');
  await expect.poll(async () => (await snapshot(ids.a)).user?.compactCards).toBe(true);

  await page.reload();
  await expect(column('Groceries')).not.toContainText('team lunch');
  await page.getByRole('button', { name: 'Settings' }).click();
  await dialog().getByLabel('Compact item cards (hide notes on boards)').uncheck();
  await dialog().getByRole('button', { name: 'Save' }).click();
  await expect(column('Groceries')).toContainText('team lunch');
  await expect.poll(async () => (await snapshot(ids.a)).user?.compactCards).toBe(false);
});

test('AI-4: "✦ Suggest with AI" fills and saves next month\'s budget and AI note', async () => {
  await nav(/^Next month budget/).click();
  await page.getByRole('button', { name: 'Suggest with AI' }).click(); // the ✦ is aria-hidden
  await toast(page, 'AI budget filled in. Edit any number.');
  const note = 'I set every category to 100 to keep next month simple.';
  await expect(page.getByText(note)).toBeVisible();
  await expect(page.getByLabel(`Groceries budget for ${NEXT} (S$)`)).toHaveValue('100.00');

  const plan = async () => (await snapshot(ids.a)).plans.find((p) => p.monthKey === NEXT);
  await expect.poll(async () => (await plan())?.aiNote).toBe(note);
  const lines = (await plan())!.budgetLines;
  expect(lines).toHaveLength(23); // every plan line, 100 each (display currency = SGD)
  expect(lines.every((l) => l.amountCents === 10000)).toBe(true);

  // Leave next month empty for the P1-P9 test.
  await page.getByRole('button', { name: 'Clear', exact: true }).click();
  await expect.poll(async () => (await plan())?.budgetLines.length).toBe(0);
  await expect.poll(async () => (await plan())?.aiNote ?? null).toBeNull();
});

test('P1-P9: next month budget saves per plan line, fill and clear work; split and carry save', async () => {
  await nav(/^Next month budget/).click();
  await expect(page.getByRole('heading', { name: `Budget for ${NEXT}` })).toBeVisible();

  const groceries = page.getByLabel(`Groceries budget for ${NEXT} (S$)`);
  await groceries.fill('50');
  await groceries.press('Enter');
  await expect.poll(async () => (await snapshot(ids.a)).plans.find((p) => p.monthKey === NEXT)?.budgetLines.map((l) => [l.lineId, l.amountCents]))
    .toEqual([['groceries', 5000]]);
  await expect(page.getByText('Total budget').locator('..')).toContainText('S$50.00');

  const expected = page.getByLabel(/Expected income/);
  await expected.fill('3500');
  await expected.press('Enter');
  await expect.poll(async () => (await snapshot(ids.a)).plans.find((p) => p.monthKey === NEXT)?.expectedIncomeCents).toBe(350000);
  await expect(page.getByText('Left to save').locator('..')).toContainText('S$3,450.00');
  // Section total against the 50% split target of S$3,500.00.
  await expect(page.getByRole('region', { name: `${NEXT} budget: Basic Needs` })).toContainText('S$1,750.00');

  await page.getByRole('button', { name: `Fill with ${THIS} amounts` }).click();
  await toast(page, `Filled with ${THIS} amounts`);
  await expect.poll(async () => {
    const lines = (await snapshot(ids.a)).plans.find((p) => p.monthKey === NEXT)?.budgetLines ?? [];
    return Object.fromEntries(lines.map((l) => [l.lineId, l.amountCents]));
  }).toEqual({ groceries: 1500 + 500 + 101, dining: 640 }); // the lines with spend this month

  await page.getByRole('button', { name: 'Clear', exact: true }).click();
  await expect.poll(async () => (await snapshot(ids.a)).plans.find((p) => p.monthKey === NEXT)?.budgetLines.length).toBe(0);

  // P9: setting one line again leaves exactly one budget. Groceries = 50 for the next test.
  await groceries.fill('50');
  await groceries.press('Enter');
  await expect.poll(async () => (await snapshot(ids.a)).plans.find((p) => p.monthKey === NEXT)?.budgetLines.length).toBe(1);

  // Split targets and carry-over are saved per user (Reset puts them back).
  const needs = page.getByRole('spinbutton', { name: 'Basic Needs', exact: true });
  await needs.fill('40');
  await needs.press('Enter');
  await expect.poll(async () => (await snapshot(ids.a)).user?.splitNeeds).toBe(40);
  await expect(page.getByText('Adds up to 90%')).toBeVisible();
  await page.getByRole('button', { name: 'Last month only' }).click();
  await expect.poll(async () => (await snapshot(ids.a)).user?.carryMode).toBe('last');
});

test('G4/P8: "+ Month" copies recurring items, rejects duplicates, and earlier budgets attach', async () => {
  await page.getByRole('button', { name: '+ Month' }).click();
  await expect(dialog().getByLabel('Month label')).toHaveValue(NEXT);
  await expect(dialog().getByLabel(/Copy recurring items/)).toBeChecked();
  await dialog().getByRole('button', { name: 'Create' }).click();
  await toast(page, `Created ${NEXT}`);
  await page.waitForURL(`**/m/${NEXT}/budget`);

  const next = await entriesOf(ids.a, NEXT);
  expect(next.map((e) => [e.category, e.label, e.cents])).toEqual([['Work', 'Salary', 300000]]);

  await nav(/^Dashboard/).click();
  await expectTotals('S$3,000.00', 'S$0.00', 'S$3,000.00');
  await expect(page.getByText('S$50.00 left of S$50.00 budget').first()).toBeVisible(); // Dashboard
  await nav(/^Expenses/).click();
  await expect(column('Groceries')).toContainText('S$50.00 left of S$50.00 budget'); // board, per line
  await expect(page.getByRole('region', { name: 'Basic Needs', exact: true })).toContainText('S$50.00 left of S$50.00 budget'); // per section
  await nav(/^Dashboard/).click();

  await page.getByRole('button', { name: '+ Month' }).click();
  await dialog().getByLabel('Month label').fill(THIS);
  await dialog().getByRole('button', { name: 'Create' }).click();
  await toast(page, 'That month already exists');
  await dialog().getByRole('button', { name: 'Cancel' }).click();
  expect((await snapshot(ids.a)).months).toHaveLength(2);
});

test('G3: month switcher shows each month\'s own figures', async () => {
  const month = page.getByRole('combobox', { name: 'Month' });
  await expect(month.locator('option')).toHaveText([THIS, NEXT]);
  await month.selectOption(THIS);
  await toast(page, `Switched to ${THIS}`);
  await page.waitForURL(`**/m/${THIS}`);
  await expectTotals('S$3,000.00', 'S$27.41', 'S$2,972.59');

  await month.selectOption(NEXT);
  await page.waitForURL(`**/m/${NEXT}`);
  await expectTotals('S$3,000.00', 'S$0.00', 'S$3,000.00');

  // Currency switching on a different dataset.
  await page.getByRole('combobox', { name: 'Currency' }).selectOption('INR');
  await expect(totals()).toContainText('₹199,500.00'); // 3000 × 66.5
  await page.getByRole('combobox', { name: 'Currency' }).selectOption('SGD');
  await month.selectOption(THIS);
  await page.waitForURL(`**/m/${THIS}`);
});

test('Error handling: a failed request rolls back the optimistic move and shows a toast', async () => {
  await nav(/^Expenses/).click();
  await page.route('**/*', (route) =>
    route.request().method() === 'POST' && route.request().headers()['next-action'] ? route.abort('failed') : route.continue(),
  );
  await column('Groceries').getByLabel('Move Lunch to category').selectOption('Transport');
  await toast(page, 'Something went wrong, try again');
  await page.unroute('**/*');
  await expect(column('Groceries')).toContainText('Lunch');
  expect((await entryNamed('Lunch'))?.lineId).toBe('groceries');
});

test('X2/X1: reset to sample data, PRD sample totals, CSV export', async () => {
  await page.getByRole('button', { name: 'Reset to sample data' }).click();
  await confirmWith('Reset');
  await toast(page, 'Restored Jan-25 data');
  await page.waitForURL('**/m/Jan-25');

  const jan = await entriesOf(ids.a, 'Jan-25');
  expect(jan.filter((e) => e.type === 'Out')).toHaveLength(66);
  expect(jan.filter((e) => e.type === 'In')).toHaveLength(7);
  const sum = (cat: string) => jan.filter((e) => e.category === cat).reduce((s, e) => s + e.cents, 0);
  expect(sum('Food')).toBe(15196);
  expect(sum('Interest')).toBe(5494);
  // S7: every sample expense sits in a section and line, and Reset cleared the plans, split and carry.
  expect(jan.filter((e) => e.type === 'Out').every((e) => e.sectionId && e.lineId)).toBe(true);
  expect((await snapshot(ids.a)).plans).toHaveLength(0);
  expect((await snapshot(ids.a)).user).toMatchObject({ splitNeeds: 50, splitInvest: 20, splitFun: 30, carryMode: 'cum' });

  await nav(/^Expenses/).click();
  // Groceries: 25 "Food" rows (151.96) + SHENGSHIONG 13.14 and 15.79 + YUENYUENG 13.86.
  await expect(column('Groceries')).toContainText('S$194.75');
  await nav(/^Income/).click();
  await expect(column('Interest')).toContainText('S$54.94');

  const spent = jan.filter((e) => e.type === 'Out').reduce((s, e) => s + e.cents, 0);
  const earned = jan.filter((e) => e.type === 'In').reduce((s, e) => s + e.cents, 0);
  const fmt = (c: number) => `${c < 0 ? '−' : ''}S$${(Math.abs(c) / 100).toLocaleString('en-US', { minimumFractionDigits: 2 })}`;
  await expectTotals(fmt(earned), fmt(spent), fmt(earned - spent));

  const [download] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Export CSV' }).click()]);
  expect(download.suggestedFilename()).toBe('Jan-25_Cashflow.csv');
  await toast(page, 'Exported Jan-25_Cashflow.csv');
  const csv = fs.readFileSync((await download.path())!, 'utf8').replace(/^﻿/, '');
  const lines = csv.trim().split(/\r?\n/);
  expect(lines[0]).toBe('"Month","Type","Category","Item","Amount (SGD)","Amount (SGD)","Note"');
  expect(lines).toHaveLength(1 + 73); // no budget rows after Reset
});

// Runs on the sample month (Jan-25) so later tests keep this month's totals.
test('AI-6: paste to add previews rows, saves nothing until confirmed, then adds the kept rows', async () => {
  const before = await entriesOf(ids.a, 'Jan-25');
  await nav(/AI helper/).click();
  const card = page.getByRole('region', { name: 'Paste to add' });
  await card.getByRole('button', { name: 'Read it' }).click();
  await toast(page, 'Paste some text first');

  await card.getByRole('textbox').fill('x'.repeat(4001));
  await card.getByRole('button', { name: 'Read it' }).click();
  await toast(page, 'Paste up to 4,000 characters');

  await card.getByRole('textbox').fill('DBS: You paid SGD 12.50 to GRAB on 03 Feb. Kopi 1.80, vet visit 45');
  await card.getByRole('button', { name: 'Read it' }).click();
  await expect(card.getByRole('listitem')).toHaveCount(3);
  await card.getByRole('button', { name: 'Discard' }).click();
  await expect(card.getByRole('listitem')).toHaveCount(0);

  await card.getByRole('button', { name: 'Read it' }).click();
  await expect(card.getByRole('listitem')).toHaveCount(3);
  expect(await entriesOf(ids.a, 'Jan-25')).toHaveLength(before.length); // nothing saved yet

  await card.getByRole('button', { name: 'Remove Kopi' }).click();
  await card.getByRole('button', { name: 'Add 2 entries to Jan-25' }).click();
  await toast(page, 'Added 2 entries');

  await expect.poll(async () => (await entriesOf(ids.a, 'Jan-25')).length).toBe(before.length + 2);
  const after = await entriesOf(ids.a, 'Jan-25');
  expect(after.find((e) => e.label === 'Vet visit')).toMatchObject({ category: 'Unassigned', sectionId: null, lineId: null, cents: 4500, type: 'Out' });
  expect(after.find((e) => e.label === 'Grab' && e.note === '03 Feb')).toMatchObject({ category: 'Transport', sectionId: 'needs', lineId: 'transport' });
  expect(after.filter((e) => e.label === 'Grab' && e.note === '03 Feb')).toHaveLength(1 + before.filter((e) => e.label === 'Grab' && e.note === '03 Feb').length);
});

test('A1: data persists after signing out and back in', async () => {
  await clerk.signOut({ page });
  await page.goto(`/m/${THIS}`);
  await page.waitForURL((url) => url.pathname === '/');
  await expect(page.getByText(/Sign in to see your months/)).toBeVisible();

  await signIn(page, 'a');
  await page.waitForURL(/\/m\//);
  await page.goto(`/m/${THIS}`);
  await expectTotals('S$3,000.00', 'S$27.41', 'S$2,972.59');
});

test('A2 setup: user A sets a budget that user B must not see', async () => {
  await page.goto(`/m/${THIS}/budget`);
  const groceries = page.getByLabel(`Groceries budget for ${NEXT} (S$)`);
  await groceries.fill('77');
  await groceries.press('Enter');
  await expect.poll(async () => (await snapshot(ids.a)).plans.find((p) => p.monthKey === NEXT)?.budgetLines.map((l) => [l.lineId, l.amountCents]))
    .toEqual([['groceries', 7700]]);
});

// ---------------------------------------------------------------------------- user B

let lunchIdOfA = '';

test('A2: user B sees none of user A\'s data', async () => {
  lunchIdOfA = (await entryNamed('Lunch'))!.id;
  await clerk.signOut({ page });
  await signIn(page, 'b');
  await expect(page.getByRole('button', { name: 'Start fresh' })).toBeVisible(); // B has no months

  await page.goto(`/m/Jan-25/expenses`); // A's month key
  await expect(page.getByText('Lunch')).toHaveCount(0);
  await expect(page.getByText('S$151.96')).toHaveCount(0);

  await page.goto('/');
  await page.getByRole('button', { name: 'Start fresh' }).click();
  await page.waitForURL(`**/m/${THIS}`);
  await expectTotals('S$0.00', 'S$0.00', 'S$0.00'); // same key as A's month, B's own data
});

test('A2: a tampered request from user B cannot delete or move user A\'s entry', async () => {
  await addItem({ section: 'Basic Needs', line: 'Groceries', label: 'Mine', amount: '1' });
  await expect.poll(async () => (await entryNamed('Mine', ids.b))?.id).toBeTruthy();
  const mineId = (await entryNamed('Mine', ids.b))!.id;
  await nav(/^Expenses/).click();
  await expect(column('Groceries').getByRole('button', { name: 'Delete Mine' })).toBeEnabled();

  let untamper = await tamperNextAction(mineId, lunchIdOfA);
  await column('Groceries').getByRole('button', { name: 'Delete Mine' }).click();
  await confirmWith('Delete');
  await toast(page, 'Something went wrong, try again');
  await untamper();

  untamper = await tamperNextAction(mineId, lunchIdOfA);
  await column('Groceries').getByLabel('Move Mine to category').selectOption('Transport');
  await toast(page, 'Something went wrong, try again');
  await untamper();

  const lunch = (await snapshot(ids.a)).entries.find((e) => e.id === lunchIdOfA);
  expect(lunch).toMatchObject({ label: 'Lunch', category: 'Groceries', lineId: 'groceries', cents: 1500 });
  expect((await entryNamed('Mine', ids.b))?.lineId).toBe('groceries');
});

test('A2: user B sees and changes only their own plan, never user A\'s', async () => {
  await page.goto(`/m/${THIS}/budget`);
  await expect(page.getByRole('heading', { name: `Budget for ${NEXT}` })).toBeVisible();
  // A's S$77.00 budget for the same month key is not shown to B.
  await expect(page.getByLabel(`Groceries budget for ${NEXT} (S$)`)).toHaveValue('');
  await expect(page.getByText('S$77.00')).toHaveCount(0);

  const groceries = page.getByLabel(`Groceries budget for ${NEXT} (S$)`);
  await groceries.fill('11');
  await groceries.press('Enter');
  await expect.poll(async () => (await snapshot(ids.b)).plans.find((p) => p.monthKey === NEXT)?.budgetLines.map((l) => [l.lineId, l.amountCents]))
    .toEqual([['groceries', 1100]]);
  // A's plan is untouched.
  expect((await snapshot(ids.a)).plans.find((p) => p.monthKey === NEXT)?.budgetLines.map((l) => [l.lineId, l.amountCents])).toEqual([['groceries', 7700]]);

  // B's Reset (sample data) must not clear A's plan either.
  await page.getByRole('button', { name: 'Reset to sample data' }).click();
  await confirmWith('Reset');
  await toast(page, 'Restored Jan-25 data');
  expect((await snapshot(ids.a)).plans.find((p) => p.monthKey === NEXT)?.budgetLines).toHaveLength(1);
  expect((await snapshot(ids.b)).plans).toHaveLength(0);
  await page.goto(`/m/${THIS}`);
});

// ---------------------------------------------------------------------------- phone

test('G6/G7: phone layout, FAB adds an item', async () => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.reload();
  const fab = page.getByRole('button', { name: 'Add item', exact: true });
  await expect(fab).toBeVisible();
  await fab.click();
  await fillEntry({ section: 'Basic Needs', line: 'Transport', label: 'Bus', amount: '2.10' });
  await expect.poll(async () => (await entryNamed('Bus', ids.b))?.cents).toBe(210);

  // Layout toggle saves per user.
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.getByRole('group', { name: 'Layout' }).getByRole('button', { name: /Phone/ }).click();
  await expect.poll(async () => (await snapshot(ids.b)).user?.layout).toBe('phone');
  await page.getByRole('group', { name: 'Layout' }).getByRole('button', { name: /Phone/ }).click();
  await expect.poll(async () => (await snapshot(ids.b)).user?.layout).toBe('auto');
});


// ---------------------------------------------------------------------------- user A against user B

test("A2 (reverse): user A's tampered requests cannot delete or move user B's entry, and A's plan changes leave B's plan alone", async () => {
  const mineIdOfB = (await entryNamed('Mine', ids.b))!.id;

  // B has a plan of its own to protect.
  await page.goto(`/m/${THIS}/budget`);
  const bGroceries = page.getByLabel(`Groceries budget for ${NEXT} (S$)`);
  await bGroceries.fill('22');
  await bGroceries.press('Enter');
  await expect.poll(async () => (await snapshot(ids.b)).plans.find((p) => p.monthKey === NEXT)?.budgetLines.map((l) => [l.lineId, l.amountCents]))
    .toEqual([['groceries', 2200]]);

  await clerk.signOut({ page });
  await signIn(page, 'a');
  await page.goto(`/m/${THIS}/expenses`);
  await expect(page.getByText('Mine')).toHaveCount(0); // A never sees B's entry

  // A's delete and move requests are rewritten to name B's entry; both must fail.
  let untamper = await tamperNextAction(lunchIdOfA, mineIdOfB);
  await column('Groceries').getByRole('button', { name: 'Delete Lunch' }).click();
  await confirmWith('Delete');
  await toast(page, 'Something went wrong, try again');
  await untamper();

  untamper = await tamperNextAction(lunchIdOfA, mineIdOfB);
  await column('Groceries').getByLabel('Move Lunch to category').selectOption('Transport');
  await toast(page, 'Something went wrong, try again');
  await untamper();

  expect(await entryNamed('Mine', ids.b)).toMatchObject({ category: 'Groceries', lineId: 'groceries', cents: 100 });
  expect((await entryNamed('Lunch', ids.a))?.lineId).toBe('groceries'); // A's own entry is untouched too

  // A changes A's own plan for the same month key; B's row is not affected.
  await page.goto(`/m/${THIS}/budget`);
  const aGroceries = page.getByLabel(`Groceries budget for ${NEXT} (S$)`);
  await aGroceries.fill('33');
  await aGroceries.press('Enter');
  await expect.poll(async () => (await snapshot(ids.a)).plans.find((p) => p.monthKey === NEXT)?.budgetLines.map((l) => [l.lineId, l.amountCents]))
    .toEqual([['groceries', 3300]]);
  expect((await snapshot(ids.b)).plans.find((p) => p.monthKey === NEXT)?.budgetLines.map((l) => [l.lineId, l.amountCents])).toEqual([['groceries', 2200]]);

  // A's Reset clears A's plan and nothing of B's.
  await page.getByRole('button', { name: 'Reset to sample data' }).click();
  await confirmWith('Reset');
  await toast(page, 'Restored Jan-25 data');
  expect((await snapshot(ids.a)).plans).toHaveLength(0);
  expect((await snapshot(ids.b)).plans.find((p) => p.monthKey === NEXT)?.budgetLines).toHaveLength(1);
  expect(await entryNamed('Mine', ids.b)).toBeTruthy();
});
