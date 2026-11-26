import { clerk } from '@clerk/testing/playwright';
import { expect, type Page } from '@playwright/test';
import { TEST_USERS, type TestUserKey } from './users';

export async function signIn(page: Page, who: TestUserKey) {
  await page.goto('/');
  await clerk.signIn({ page, emailAddress: TEST_USERS[who] });
  await page.goto('/');
}

export async function signOut(page: Page) {
  await page.goto('/');
  await clerk.signOut({ page });
}

/** The toast region's latest message. */
export function toast(page: Page, text: string | RegExp) {
  return expect(page.getByRole('status').filter({ hasText: text }).first()).toBeVisible();
}

/** KPI card amount by tag (Earned / Spent / Left …). */
export function kpi(page: Page, tag: 'Earned' | 'Spent' | 'Left') {
  return page.getByRole('region', { name: 'Month totals' }).locator('div', { hasText: new RegExp(`^${tag}`) }).first();
}
