import 'dotenv/config';
import { createClerkClient } from '@clerk/backend';
import fs from 'node:fs';
import path from 'node:path';

/** Two throwaway Clerk test users (development instance only). */
export const TEST_USERS = {
  a: 'cashflow-e2e-a+clerk_test@example.com',
  b: 'cashflow-e2e-b+clerk_test@example.com',
  // Own users for the budget plan journey (plan.spec.ts): c at 1280px, d at 390px.
  c: 'cashflow-e2e-c+clerk_test@example.com',
  d: 'cashflow-e2e-d+clerk_test@example.com',
} as const;
export type TestUserKey = keyof typeof TEST_USERS;

export const STATE_DIR = path.join(__dirname, '../playwright/.clerk');
const IDS_FILE = path.join(STATE_DIR, 'ids.json');

export function clerkBackend() {
  const secretKey = process.env.CLERK_SECRET_KEY ?? '';
  if (!secretKey.startsWith('sk_test_')) throw new Error('E2E tests only run against a Clerk development instance');
  return createClerkClient({ secretKey });
}

export async function findUserIds(): Promise<string[]> {
  const { data } = await clerkBackend().users.getUserList({ emailAddress: Object.values(TEST_USERS) });
  return data.map((u) => u.id);
}

export function saveIds(ids: Record<TestUserKey, string>) {
  fs.mkdirSync(STATE_DIR, { recursive: true });
  fs.writeFileSync(IDS_FILE, JSON.stringify(ids));
}

export function loadIds(): Record<TestUserKey, string> {
  return JSON.parse(fs.readFileSync(IDS_FILE, 'utf8'));
}
