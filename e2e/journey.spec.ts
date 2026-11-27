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

async function fillEntry(opts: { type?: 'Out' | 'In'; category?: string; newCategory?: string; label: string; amount: string; note?: string }) {
  const d = dialog();
  if (opts.type) await d.getByRole('button', { name: opts.type === 'Out' ? 'Out · Expense' : 'In · Income' }).click();
  // Pick the category first: a picked category switches auto-categorise off (PRD AI-1).
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

async function addItem(opts: Parameters<typeof fillEntry>[0]) {
  await page.getByRole('button', { name: '+ Add item' }).click();
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
  await addItem({ category: 'Food', label: 'Lunch', amount: '12.50', note: 'team lunch' });
  await toast(page, 'Item added');
  await expect(page).toHaveURL(new RegExp(`/m/${THIS}$`)); // E6: stays on the Dashboard
  await expectTotals('S$0.00', 'S$12.50', '−S$12.50');

  await addItem({ type: 'In', category: 'Work', label: 'Salary', amount: '3000' });
  await expectTotals('S$3,000.00', 'S$12.50', 'S$2,987.50');
  await expect(totals()).toContainText('99.6% saved');

  await expect.poll(async () => (await entriesOf(ids.a)).map((e) => [e.type, e.category, e.label, e.cents, e.note]).sort())
    .toEqual([['In', 'Work', 'Salary', 300000, null], ['Out', 'Food', 'Lunch', 1250, 'team lunch']].sort());
});

test('E5: edit an item; the new amount is stored and survives a reload', async () => {
  await nav(/^Expenses/).click();
  await column('Food').getByRole('button', { name: 'Edit Lunch' }).click();
  await expect(dialog().getByLabel(/^Amount/)).toHaveValue('12.50');
  await dialog().getByLabel(/^Amount/).fill('15');
  await dialog().getByRole('button', { name: 'Save' }).click();
  await toast(page, 'Item updated');
  await expect.poll(async () => (await entryNamed('Lunch'))?.cents).toBe(1500);

  await page.reload();
  await expectTotals('S$3,000.00', 'S$15.00', 'S$2,985.00');
  await expect(column('Food')).toContainText('S$15.00');
});

test('B7/B6: move with "Move to…" and with drag and drop', async () => {
  await column('Food').getByLabel('Move Lunch to category').selectOption('Transport');
  await toast(page, 'Moved "Lunch" to Transport');
  await expect(column('Transport')).toContainText('Lunch');
  await expect.poll(async () => (await entryNamed('Lunch'))?.category).toBe('Transport');

  await column('Transport').getByText('Lunch', { exact: true }).dragTo(column('Food'));
  await toast(page, 'Moved "Lunch" to Food');
  await expect(column('Food')).toContainText('Lunch');
  await expect.poll(async () => (await entryNamed('Lunch'))?.category).toBe('Food');
});

test('B2/B8/B5: search, "+ Add to", delete with confirm', async () => {
  await column('Shopping & Insurance').getByRole('button', { name: '+ Add to Shopping & Insurance' }).click();
  await expect(dialog().getByLabel('Category', { exact: true })).toHaveValue('Shopping & Insurance');
  await fillEntry({ label: 'Shoes', amount: '80' });
  await expect(column('Shopping & Insurance')).toContainText('Shoes');
  await expect.poll(async () => (await entryNamed('Shoes'))?.cents).toBe(8000);

  await page.getByPlaceholder('Search items, e.g. Uniqlo').fill('lun');
  await expect(column('Food')).toContainText('Lunch');
  await expect(column('Shopping & Insurance')).not.toContainText('Shoes');
  await page.getByPlaceholder('Search items, e.g. Uniqlo').fill('');

  await column('Shopping & Insurance').getByRole('button', { name: 'Delete Shoes' }).click();
  await expect(dialog()).toContainText('Delete "Shoes" (S$80.00) from Shopping & Insurance?');
  await confirmWith('Delete');
  await toast(page, 'Item deleted');
  await expect.poll(async () => await entryNamed('Shoes')).toBeUndefined();
});

test('B9-B11: create, rename and delete-empty-only categories', async () => {
  await page.getByRole('button', { name: '+ Category' }).click();
  await dialog().getByLabel('Category name').fill('Pets');
  await dialog().getByRole('button', { name: 'Save' }).click();
  await toast(page, 'Added "Pets"');
  await expect(column('Pets')).toBeVisible();

  // Duplicate (case-insensitive) is ignored.
  await page.getByRole('button', { name: '+ Category' }).click();
  await dialog().getByLabel('Category name').fill('pets');
  await dialog().getByRole('button', { name: 'Save' }).click();
  await expect(dialog()).toBeHidden();

  await column('Pets').getByRole('button', { name: 'Rename Pets' }).click();
  await dialog().getByLabel('Category name').fill('Pet care');
  await dialog().getByRole('button', { name: 'Save' }).click();
  await toast(page, 'Renamed to "Pet care"');
  const names = async () => (await snapshot(ids.a)).months[0].categories.map((c) => c.name);
  await expect.poll(async () => (await names()).filter((n) => /^pet/i.test(n))).toEqual(['Pet care']);

  // Non-empty column can't be deleted.
  await column('Food').getByRole('button', { name: 'Delete empty category Food' }).click();
  await toast(page, 'Move or delete the 1 items in "Food" first');

  await column('Pet care').getByRole('button', { name: 'Delete empty category Pet care' }).click();
  await expect(dialog()).toContainText('Remove the empty "Pet care" column?');
  await confirmWith('Remove');
  await toast(page, 'Removed "Pet care"');
  await expect.poll(names).not.toContain('Pet care');

  // Rename a category with items: items follow (B10).
  await column('Transport').getByRole('button', { name: 'Rename Transport' }).click();
  await dialog().getByLabel('Category name').fill('Travel');
  await dialog().getByRole('button', { name: 'Save' }).click();
  await toast(page, 'Renamed to "Travel"');
  await column('Food').getByLabel('Move Lunch to category').selectOption('Travel');
  await expect.poll(async () => (await entryNamed('Lunch'))?.category).toBe('Travel');
  await column('Travel').getByRole('button', { name: 'Rename Travel' }).click();
  await dialog().getByLabel('Category name').fill('Transport');
  await dialog().getByRole('button', { name: 'Save' }).click();
  await expect.poll(async () => (await entryNamed('Lunch'))?.category).toBe('Transport');
  await column('Transport').getByLabel('Move Lunch to category').selectOption('Food');
  await expect.poll(async () => (await entryNamed('Lunch'))?.category).toBe('Food');
});

test('E2: "+ New category…" in the item form creates the category on save', async () => {
  await addItem({ newCategory: 'Coffee', label: 'Latte', amount: '6.40' });
  await expect(column('Coffee')).toContainText('Latte');
  await expect.poll(async () => await entryNamed('Latte')).toMatchObject({ category: 'Coffee', cents: 640, type: 'Out' });
});

test('AI-1: auto-categorise on blur picks an existing category; "✦ Suggest" can propose a new one', async () => {
  // The app runs with AI_FAKE=1: canned replies, no provider call.
  await page.getByRole('button', { name: '+ Add item' }).click();
  const d = dialog();
  await d.getByLabel('Item / merchant / source').fill('Grab home');
  await d.getByLabel(/^Amount/).focus(); // blur the item name
  await toast(page, 'Suggested category: Transport');
  await expect(d.getByLabel('Category', { exact: true })).toHaveValue('Transport');

  await d.getByLabel('Item / merchant / source').fill('Vet visit');
  await d.getByRole('button', { name: '✦ Suggest' }).click();
  await toast(page, 'Suggested category: Misc');
  await expect(d.getByLabel('New category name')).toHaveValue('Misc');

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
  await expect(column('Food')).toContainText('US$11.55');
  await expect.poll(async () => (await snapshot(ids.a)).user?.currency).toBe('USD');

  const rate = page.getByLabel('Rate: USD per S$1');
  await rate.fill('0.8');
  await rate.press('Enter');
  await expectTotals('US$2,400.00', 'US$17.12', 'US$2,382.88'); // × 0.8
  await expect.poll(async () => (await snapshot(ids.a)).user?.currencyRates.map((r) => [r.code, r.rate])).toEqual([['USD', 0.8]]);

  // Typing 4.00 in US$ at 0.8 stores S$5.00 (500 cents).
  await addItem({ category: 'Food', label: 'Bagel', amount: '4.00' });
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
  await addItem({ category: 'Food', label: 'Gum', amount: '1.01' });
  await expect.poll(async () => (await entryNamed('Gum'))?.cents).toBe(101);

  for (const code of ['GBP', 'EUR', 'USD']) {
    await page.getByRole('combobox', { name: 'Currency' }).selectOption(code);
    await expect(page.getByRole('combobox', { name: 'Currency' })).toHaveValue(code);
    await nav(/^Expenses/).click();
    await column('Food').getByRole('button', { name: 'Edit Gum' }).click();
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
  await expect(column('Food')).toContainText('team lunch');
  await page.getByRole('button', { name: 'Settings' }).click();
  await expect(dialog().getByLabel('Auto-categorise on item name blur')).toBeChecked();
  await expect(dialog().getByLabel('Show sample audit panel')).toBeChecked();
  await dialog().getByLabel('Compact item cards (hide notes on boards)').check();
  await dialog().getByRole('button', { name: 'Save' }).click();
  await toast(page, 'Settings saved');
  await expect(column('Food')).not.toContainText('team lunch');
  await expect.poll(async () => (await snapshot(ids.a)).user?.compactCards).toBe(true);

  await page.reload();
  await expect(column('Food')).not.toContainText('team lunch');
  await page.getByRole('button', { name: 'Settings' }).click();
  await dialog().getByLabel('Compact item cards (hide notes on boards)').uncheck();
  await dialog().getByRole('button', { name: 'Save' }).click();
  await expect(column('Food')).toContainText('team lunch');
  await expect.poll(async () => (await snapshot(ids.a)).user?.compactCards).toBe(false);
});

test('AI-4: "✦ Suggest with AI" fills and saves next month\'s budget and AI note', async () => {
  await nav(/^Next month budget/).click();
  await page.getByRole('button', { name: 'Suggest with AI' }).click(); // the ✦ is aria-hidden
  await toast(page, 'AI budget filled in. Edit any number.');
  const note = 'I set every category to 100 to keep next month simple.';
  await expect(page.getByText(note)).toBeVisible();
  await expect(page.getByLabel(`Food budget for ${NEXT} (S$)`)).toHaveValue('100.00');

  const plan = async () => (await snapshot(ids.a)).plans.find((p) => p.monthKey === NEXT);
  await expect.poll(async () => (await plan())?.aiNote).toBe(note);
  const lines = (await plan())!.budgetLines;
  expect(lines.length).toBeGreaterThan(0);
  expect(lines.every((l) => l.amountCents === 10000)).toBe(true);

  // Leave next month empty for the P1-P9 test.
  await page.getByRole('button', { name: 'Clear', exact: true }).click();
  await expect.poll(async () => (await plan())?.budgetLines.length).toBe(0);
  await expect.poll(async () => (await plan())?.aiNote ?? null).toBeNull();
});

test('P1-P9: next month budget saves per month key, fill and clear work', async () => {
  await nav(/^Next month budget/).click();
  await expect(page.getByRole('heading', { name: `Budget for ${NEXT}` })).toBeVisible();

  const food = page.getByLabel(`Food budget for ${NEXT} (S$)`);
  await food.fill('50');
  await food.press('Enter');
  await expect.poll(async () => (await snapshot(ids.a)).plans.find((p) => p.monthKey === NEXT)?.budgetLines.map((l) => [l.categoryName, l.amountCents]))
    .toEqual([['Food', 5000]]);
  await expect(page.getByText('Total budget').locator('..')).toContainText('S$50.00');

  const expected = page.getByLabel(/Expected income/);
  await expected.fill('3500');
  await expected.press('Enter');
  await expect.poll(async () => (await snapshot(ids.a)).plans.find((p) => p.monthKey === NEXT)?.expectedIncomeCents).toBe(350000);
  await expect(page.getByText('Left to save').locator('..')).toContainText('S$3,450.00');

  await page.getByRole('button', { name: `Fill with ${THIS} amounts` }).click();
  await toast(page, `Filled with ${THIS} amounts`);
  await expect.poll(async () => {
    const lines = (await snapshot(ids.a)).plans.find((p) => p.monthKey === NEXT)?.budgetLines ?? [];
    return Object.fromEntries(lines.map((l) => [l.categoryName, l.amountCents]));
  }).toEqual({ Food: 1500 + 500 + 101, Transport: 0, 'Fixed & Bills': 0, 'Shopping & Insurance': 0, Coffee: 640 }); // every category, like the reference

  await page.getByRole('button', { name: 'Clear', exact: true }).click();
  await expect.poll(async () => (await snapshot(ids.a)).plans.find((p) => p.monthKey === NEXT)?.budgetLines.length).toBe(0);

  // P9: clearing one input removes that budget. Set Food = 50 again for the next test.
  await food.fill('50');
  await food.press('Enter');
  await expect.poll(async () => (await snapshot(ids.a)).plans.find((p) => p.monthKey === NEXT)?.budgetLines.length).toBe(1);
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
  await expect(page.getByText('S$50.00 left of S$50.00 budget').first()).toBeVisible();

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
  await column('Food').getByLabel('Move Lunch to category').selectOption('Transport');
  await toast(page, 'Something went wrong, try again');
  await page.unroute('**/*');
  await expect(column('Food')).toContainText('Lunch');
  expect((await entryNamed('Lunch'))?.category).toBe('Food');
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

  await nav(/^Expenses/).click();
  await expect(column('Food')).toContainText('S$151.96');
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
  expect(lines.length).toBeGreaterThanOrEqual(1 + 73);
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
  await addItem({ category: 'Food', label: 'Mine', amount: '1' });
  await expect.poll(async () => (await entryNamed('Mine', ids.b))?.id).toBeTruthy();
  const mineId = (await entryNamed('Mine', ids.b))!.id;
  await nav(/^Expenses/).click();
  await expect(column('Food').getByRole('button', { name: 'Delete Mine' })).toBeEnabled();

  let untamper = await tamperNextAction(mineId, lunchIdOfA);
  await column('Food').getByRole('button', { name: 'Delete Mine' }).click();
  await confirmWith('Delete');
  await toast(page, 'Something went wrong, try again');
  await untamper();

  untamper = await tamperNextAction(mineId, lunchIdOfA);
  await column('Food').getByLabel('Move Mine to category').selectOption('Transport');
  await toast(page, 'Something went wrong, try again');
  await untamper();

  const lunch = (await snapshot(ids.a)).entries.find((e) => e.id === lunchIdOfA);
  expect(lunch).toMatchObject({ label: 'Lunch', category: 'Food', cents: 1500 });
  expect((await entryNamed('Mine', ids.b))?.category).toBe('Food');
});

// ---------------------------------------------------------------------------- phone

test('G6/G7: phone layout, FAB adds an item', async () => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.reload();
  const fab = page.getByRole('button', { name: 'Add item' });
  await expect(fab).toBeVisible();
  await fab.click();
  await fillEntry({ category: 'Transport', label: 'Bus', amount: '2.10' });
  await expect.poll(async () => (await entryNamed('Bus', ids.b))?.cents).toBe(210);

  // Layout toggle saves per user.
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.getByRole('group', { name: 'Layout' }).getByRole('button', { name: /Phone/ }).click();
  await expect.poll(async () => (await snapshot(ids.b)).user?.layout).toBe('phone');
  await page.getByRole('group', { name: 'Layout' }).getByRole('button', { name: /Phone/ }).click();
  await expect.poll(async () => (await snapshot(ids.b)).user?.layout).toBe('auto');
});

