import 'server-only';
import { auth } from '@clerk/nextjs/server';

/** Thrown by every /data helper when nobody is signed in. */
export class UnauthorisedError extends Error {
  constructor() {
    super('Unauthorised');
    this.name = 'UnauthorisedError';
  }
}

/** The signed-in Clerk user id, or null. For pages that branch on signed-in state. */
export async function getSignedInUserId(): Promise<string | null> {
  const { userId } = await auth();
  return userId ?? null;
}

/**
 * The signed-in Clerk user id. Every /data helper gets the user id from here and never
 * from its caller (docs/data-fetching.md §3.1).
 */
export async function requireUserId(): Promise<string> {
  const userId = await getSignedInUserId();
  if (!userId) throw new UnauthorisedError();
  return userId;
}
