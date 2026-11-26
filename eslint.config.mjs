import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

/*
 * Data-access guardrails (docs/data-fetching.md §4). Flat config does not merge rule
 * options, so each file group below gets one complete no-restricted-imports setting.
 */
const DOCS = "See docs/data-fetching.md.";

const DB_ACCESS = {
  group: ["@/db", "@/db/*", "drizzle-orm", "drizzle-orm/*", "@neondatabase/serverless"],
  message: `Query the database only through helpers in /data. ${DOCS}`,
};
const SCOPE_INTERNALS = {
  group: ["@/data/scope"],
  message: `data/scope takes a userId and is internal to /data. Call a /data helper instead. ${DOCS}`,
};
const DATA_HELPERS = {
  group: ["@/data", "@/data/*"],
  message: `Components and lib code never load data. Fetch in a Server Component (page/layout) and pass props. ${DOCS}`,
};

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Read-only reference design (not app code).
    "docs/**",
  ]),
  {
    // Pages, layouts, Server Actions, proxy: may call /data helpers, never the DB.
    // e2e/** is test code: it reads the DB to check what the app stored, and cleans up.
    files: ["**/*.{ts,tsx}"],
    ignores: ["data/**", "db/**", "components/**", "lib/**", "e2e/**", "drizzle.config.ts"],
    rules: {
      "no-restricted-imports": ["error", { patterns: [DB_ACCESS, SCOPE_INTERNALS] }],
    },
  },
  {
    // Client UI and shared utilities: no DB and no /data helpers at all.
    files: ["components/**/*.{ts,tsx}", "lib/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-imports": ["error", { patterns: [DB_ACCESS, DATA_HELPERS] }],
    },
  },
  {
    // /data helpers: Drizzle ORM only, no raw SQL and no raw Neon client.
    files: ["data/**/*.ts"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          paths: [
            { name: "drizzle-orm", importNames: ["sql"], message: `No raw SQL. Use Drizzle operators and builders. ${DOCS}` },
            { name: "@neondatabase/serverless", message: `Use the Drizzle db from @/db, not the raw Neon client. ${DOCS}` },
          ],
        },
      ],
    },
  },
  {
    files: ["**/*.{ts,tsx}"],
    ignores: ["db/**"],
    rules: {
      "no-restricted-syntax": [
        "error",
        {
          selector: "CallExpression[callee.property.name='execute'][callee.object.name='db']",
          message: `No raw SQL via db.execute(). Use Drizzle's query API or builders. ${DOCS}`,
        },
        {
          selector: "MemberExpression[property.name='$client'][object.name='db']",
          message: `No raw driver access via db.$client. ${DOCS}`,
        },
      ],
    },
  },
]);

export default eslintConfig;
