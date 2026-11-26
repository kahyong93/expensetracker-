import { defineConfig, devices } from '@playwright/test';

/**
 * End-to-end tests against the real app, real Clerk (development instance) and the real
 * Neon database. Global setup creates two throwaway Clerk test users; teardown deletes
 * them and every row they own. See e2e/README.md.
 */
const PORT = Number(process.env.E2E_PORT ?? 3100);

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  workers: 1,
  timeout: 90_000,
  expect: { timeout: 15_000 },
  reporter: [['list']],
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    { name: 'setup', testMatch: /global\.setup\.ts/, teardown: 'teardown' },
    { name: 'teardown', testMatch: /global\.teardown\.ts/ },
    {
      name: 'laptop',
      testMatch: /.*\.spec\.ts/,
      use: { ...devices['Desktop Chrome'], viewport: { width: 1280, height: 900 } },
      dependencies: ['setup'],
    },
  ],
  webServer: {
    // A production build: stable and fast, and it doesn't clash with a running `next dev`.
    command: `npx next build && npx next start -p ${PORT}`,
    url: `http://localhost:${PORT}`,
    // Canned AI replies (lib/ai/fake.ts): tests never call OpenAI.
    env: { AI_FAKE: '1' },
    reuseExistingServer: !!process.env.E2E_REUSE_SERVER,
    timeout: 420_000,
  },
});
