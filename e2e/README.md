# End-to-end tests

`npm run test:e2e` drives the real app in Chromium against the real Clerk development
instance and the real Neon database. Nothing is mocked except the AI helper, which is
still a frontend stub (`lib/mock/ai.ts`).

- **Server:** Playwright builds the app and serves it on port 3100 (`next build && next start`),
  so it doesn't clash with a running `next dev`. To reuse a server you already started on
  3100, set `E2E_REUSE_SERVER=1`. Change the port with `E2E_PORT`.
- **Users:** `global.setup.ts` creates two throwaway users (`cashflow-e2e-a+clerk_test@example.com`,
  `…-b…`) and signs in with `clerk.signIn({ emailAddress })`. `global.teardown.ts` deletes
  them and every row they own (all tables cascade from `users`). Requires `sk_test_` keys;
  it refuses to run against a production instance.
- **Checks:** every step is asserted on screen and in the database (`e2e/db.ts`), including
  that user B's tampered Server Action requests can't touch user A's rows.
- `e2e/**` may read the database directly; app code may not (docs/data-fetching.md §4).
