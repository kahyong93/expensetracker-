import { clerkSetup } from '@clerk/testing/playwright';
import { test as setup } from '@playwright/test';
import crypto from 'node:crypto';
import { deleteUserRows } from './db';
import { TEST_USERS, clerkBackend, findUserIds, saveIds, type TestUserKey } from './users';

setup.describe.configure({ mode: 'serial' });

setup('create fresh Clerk test users', async () => {
  await clerkSetup();
  const clerk = clerkBackend();

  // Leftovers from an interrupted run: remove them and their data first.
  const stale = await findUserIds();
  await deleteUserRows(stale);
  for (const id of stale) await clerk.users.deleteUser(id);

  const ids = {} as Record<TestUserKey, string>;
  for (const [key, email] of Object.entries(TEST_USERS) as [TestUserKey, string][]) {
    const user = await clerk.users.createUser({
      emailAddress: [email],
      password: crypto.randomBytes(18).toString('base64url') + 'aA1!',
      skipPasswordChecks: true,
    });
    ids[key] = user.id;
  }
  saveIds(ids);
});
