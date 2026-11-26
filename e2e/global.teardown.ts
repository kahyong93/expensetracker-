import { test as teardown } from '@playwright/test';
import { deleteUserRows } from './db';
import { clerkBackend, findUserIds } from './users';

teardown('delete Clerk test users and their data', async () => {
  const ids = await findUserIds();
  await deleteUserRows(ids);
  const clerk = clerkBackend();
  for (const id of ids) await clerk.users.deleteUser(id);
});
