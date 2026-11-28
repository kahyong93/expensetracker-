import { expect, test, type BrowserContext, type Page } from '@playwright/test';
import { snapshot } from './db';
import { signIn, toast } from './helpers';
import { loadIds, type TestUserKey } from './users';

/*
 * The budget plan journey (PRD §7.10): add an expense by section and line, see the board
 * grouped by section, set a budget, see its bars on the Dashboard and the board, then Reset
 * and see the plan cleared. It runs in the `laptop` project (1280px, user c) and in the
 * `phone` project (390px, user d). Each project has its own user, so the runs never share
 * data. Cross-user checks for entries and plans are in journey.spec.ts.
 *
 * The sample month is Jan-25, so its next month is Feb-25.
 */
const MONTH = 'Jan-25';
const NEXT = 'Feb-25';

test.describe.configure({ mode: 'serial' });

let context: BrowserContext;
let page: Page;
let who: TestUserKey;
let phone: boolean;
const ids = loadIds();

test.beforeAll(async ({ browser }, testInfo) => {
  phone = testInfo.project.name === 'phone';
  who = phone ? 'd' : 'c';
  context = await browser.newContext(testInfo.project.use);
  page = await context.newPage();
});
test.afterAll(async () => context.close());

const dialog = () => page.getByRole('dialog');
const column = (name: string) => page.getByRole('region', { name, exact: true });
const section = (name: string) => page.getByRole('region', { name, exact: true });
const entryNamed = async (label: string, month = MONTH) =>
  (await snapshot(ids[who])).entries.find((e) => e.month === month && e.label === label);

/** On phone the items of a column are folded away behind "Show N items". */
async function openColumn(name: string) {
  const toggle = column(name).getByRole('button', { name: /^Show \d+ items/ });
  if (await toggle.isVisible()) await toggle.click();
}

test('start from the sample month', async () => {
  await signIn(page, who);
  await page.getByRole('button', { name: 'Try with sample data' }).click();
  await page.waitForURL(`**/m/${MONTH}`);
  expect((await snapshot(ids[who])).plans).toHaveLength(0);
});

test('S1: add an expense by section and category; the line is saved with its section', async () => {
  await page.goto(`/m/${MONTH}/expenses`);
  await page.getByRole('button', { name: /Add item/ }).first().click();
  const d = dialog();
  await d.getByLabel('Section', { exact: true }).selectOption({ label: 'Basic Needs' });
  const lines = await d.getByLabel('Category', { exact: true }).locator('option').allTextContents();
  expect(lines).toContain('Groceries');
  expect(lines).not.toContain('Dining out and food delivery'); // only the chosen section's lines
  await d.getByLabel('Category', { exact: true }).selectOption({ label: 'Groceries' });
  await d.getByLabel('Item / merchant / source').fill('E2E Soup');
  await d.getByLabel(/^Amount/).fill('10.00');
  await d.getByRole('button', { name: 'Save' }).click();
  await expect(dialog()).toBeHidden();

  await expect.poll(async () => await entryNamed('E2E Soup')).toMatchObject({
    type: 'Out', category: 'Groceries', sectionId: 'needs', lineId: 'groceries', cents: 1000,
  });
});

test('S2: the Expenses board is grouped by section, then by category', async () => {
  await page.goto(`/m/${MONTH}/expenses`);
  for (const title of ['Basic Needs', 'Investment / Savings', 'Entertainment']) {
    await expect(section(title)).toBeVisible();
  }
  await expect(page.getByRole('button', { name: '+ Category' })).toHaveCount(0);
  // The first heading is the section's own; the columns follow in budget-page order.
  await expect(section('Basic Needs').getByRole('heading', { level: 2 }).nth(1)).toHaveText('Rent / mortgage');
  await openColumn('Groceries');
  await expect(section('Basic Needs')).toContainText('E2E Soup');
  await expect(section('Entertainment')).not.toContainText('E2E Soup');
  // The sample's own groceries (151.96 + 13.14 + 15.79 + 13.86) plus the new S$10.00.
  await expect(column('Groceries')).toContainText('S$204.75');
});

test('S4: a budget shows as bars on the Dashboard and the Expenses board of its month', async () => {
  await page.goto(`/m/${MONTH}/budget`);
  const groceries = page.getByLabel(`Groceries budget for ${NEXT} (S$)`);
  await groceries.fill('300');
  await groceries.press('Enter');
  await expect.poll(async () => (await snapshot(ids[who])).plans.find((p) => p.monthKey === NEXT)?.budgetLines.map((l) => [l.lineId, l.amountCents]))
    .toEqual([['groceries', 30000]]);

  // Create the month the plan is for.
  await page.getByRole('button', { name: '+ Month' }).click();
  await expect(dialog().getByLabel('Month label')).toHaveValue(NEXT);
  await dialog().getByRole('button', { name: 'Create' }).click();
  await toast(page, `Created ${NEXT}`);

  await page.goto(`/m/${NEXT}`);
  await expect(page.getByText('S$300.00 left of S$300.00 budget').first()).toBeVisible(); // Dashboard
  await page.goto(`/m/${NEXT}/expenses`);
  await expect(column('Groceries')).toContainText('S$300.00 left of S$300.00 budget'); // per category
  await expect(section('Basic Needs')).toContainText('S$300.00 left of S$300.00 budget'); // per section
});

test('S7: Reset clears the plan, and the bars go with it', async () => {
  await page.goto(`/m/${MONTH}`);
  await page.getByRole('button', { name: 'Reset to sample data' }).click();
  await dialog().getByRole('button', { name: 'Reset', exact: true }).click();
  await toast(page, 'Restored Jan-25 data');
  await page.waitForURL(`**/m/${MONTH}`);

  const db = await snapshot(ids[who]);
  expect(db.plans).toHaveLength(0);
  expect(db.user).toMatchObject({ splitNeeds: 50, splitInvest: 20, splitFun: 30, carryMode: 'cum' });
  expect(await entryNamed('E2E Soup')).toBeUndefined(); // the sample is restored to its original state

  await page.goto(`/m/${MONTH}/budget`);
  await expect(page.getByLabel(`Groceries budget for ${NEXT} (S$)`)).toHaveValue('');
  await page.goto(`/m/${NEXT}/expenses`);
  await expect(column('Groceries')).not.toContainText('budget');
});
