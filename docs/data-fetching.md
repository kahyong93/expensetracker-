# Data fetching

> **⚠️ CRITICAL: these rules are not optional.** Every page, component, action and helper in this app must follow them. A change that breaks any of them is a bug. It must not be merged, whatever else it does.

There are three rules, in short:

1. **Fetch data ONLY in Server Components.** Never in route handlers, Client Components or anywhere else.
2. **Query the database ONLY through helper functions in `/data`.** Those helpers use **Drizzle ORM** and **never raw SQL**.
3. **A signed-in user can read and change ONLY their own data.** Nothing that belongs to anyone else, ever.

---

## 1. Fetch data ONLY in Server Components

All data fetching happens in **Server Components** (pages, layouts and the async server components they render). The Server Component calls a `/data` helper, gets plain serialisable values back, and passes them as props to any Client Component that needs them.

```tsx
// app/(app)/m/[month]/expenses/page.tsx  (Server Component, no "use client")
import { notFound } from 'next/navigation';
import { getMonthBoard } from '@/data/months';
import { CategoryBoard } from '@/components/board/category-board';

export default async function ExpensesPage({ params }: { params: Promise<{ month: string }> }) {
  const { month } = await params;
  const board = await getMonthBoard(decodeURIComponent(month), 'Out');
  if (!board) notFound();
  return <CategoryBoard board={board} />; // Client Component gets data as props
}
```

### How this app does it

- **`app/(app)/m/[month]/layout.tsx`** (Server Component) is where the app's data is fetched. It calls `getAppData()` (`data/settings.ts`) and `getMonthBundle(monthKey)` (`data/months.ts`), then passes the result as the `data` prop to `CashflowDataProvider`.
- **`components/providers/cashflow-data-provider.tsx`** (Client Component) only holds those props. Components read them with `useMonthView()` / `useCashflowData()`. It never fetches.
- **`app/page.tsx`** (Server Component) uses `getLatestMonthKey()` to send a signed-in user to their latest month, or shows the first-run choice.
- **Mutations** are Server Actions in `server/actions/*`. They validate input (`lib/validation.ts` `parse*`), call a `/data` helper and revalidate the month layout through `runAction()`. Components call them through `useMutate()`, optionally with an optimistic patch (`lib/optimistic.ts`).

### ❌ Forbidden: no exceptions

| Don't | Why |
|---|---|
| `fetch('/api/…')`, `useEffect` + fetch, SWR, React Query, or any other client-side fetching in a Client Component | Data must never be loaded from the browser |
| Route handlers (`app/api/**/route.ts`) that return app data for the UI to read | Route handlers are not a data-fetching layer |
| Server Actions used as "getters" (called just to return data for display) | Server Actions are for mutations only. The one exception is the AI actions below |
| Importing `db` or a `/data` helper into a file marked `"use client"` | DB code must never reach the client bundle |
| Reading data in `proxy.ts` (middleware) | Middleware handles auth/routing only |

### Mutations

Writes go through **Server Actions**. They also use `/data` helpers, so the rules in §2 and §3 still apply. After a write, the action revalidates the affected path (`revalidatePath`). Fresh data then reaches the UI **by the Server Component re-rendering**, not by the client fetching it again. Optimistic UI is fine, but what the client shows in the end always comes from Server Component props.

### The one exception: AI actions

The AI Server Actions in `server/actions/ai.ts` (CLAUDE.md §7) may **read** the signed-in user's month through `/data` helpers (`getAppData`, `getMonthBundle`). They need it to build the prompt on the server, so the client never sends amounts or categories it could fake. The rules still hold:

- They read only through `/data` helpers, which scope every query to the signed-in user (§3).
- They return the AI's answer (a category, a chat reply, an insight, suggested rows), never raw records for the UI to display.
- Anything they save (insights, budgets and the AI note) goes through `/data` write helpers and revalidates the month layout, like any other mutation.

---

## 2. Query the database ONLY through `/data` helpers, with Drizzle, never raw SQL

- Every database query, read or write, lives in a helper function in the **`/data`** directory at the project root (e.g. `data/months.ts`, `data/entries.ts`, `data/budgets.ts`, `data/settings.ts`).
- Pages, layouts, components, Server Actions and route handlers **never import `db` from `@/db` directly**. They call a `/data` helper.
- Every file in `/data` starts with `import 'server-only';`.
- Helpers use **Drizzle ORM**: the relational query API (`db.query.<table>.findFirst/findMany`) for reads and the query builder (`db.insert/update/delete`, `db.batch`) for writes.

### ❌ No raw SQL

The following are **forbidden** in `/data` and everywhere else in app code:

- `` sql`…` `` template literals used to write queries or conditions
- `db.execute(…)` with a SQL string
- Using the `neon()` client from `@neondatabase/serverless` directly to run queries
- Building SQL strings by concatenation or interpolation

Use Drizzle's operators and builders instead (`eq`, `and`, `inArray`, `notExists`, `exists`, `asc`, `desc`, …). For example, the B11 rule "delete a category only if it has no entries" becomes a single Drizzle statement using `notExists(db.select().from(entries).where(eq(entries.categoryId, categories.id)))`.

> The `` sql`…` `` uses in `db/schema.ts` (check constraints and the expression index) are part of the **schema definition**, not queries, and are allowed there only.

---

## 3. A user can ONLY access their own data

This is the most important rule in this document. **User A must never be able to read, change or delete anything that belongs to user B**, whatever id, month key or URL they send.

### 3.1 The user id comes from Clerk, inside the helper

- Every `/data` helper gets the current user's id **itself**, from Clerk on the server, through one shared function:

  ```ts
  // data/auth.ts
  import 'server-only';
  import { auth } from '@clerk/nextjs/server';

  export async function requireUserId(): Promise<string> {
    const { userId } = await auth();
    if (!userId) throw new Error('Unauthorised');
    return userId;
  }
  ```

- **Helpers never take a `userId` parameter** from their caller. A user id must never come from URL params, search params, form data, request bodies, cookies the app sets, or Client Component props.
- The one exception is `data/scope.ts`. Its building blocks (`ownedMonthIds`, `ownedCategoryIds`, `findOwnedMonth`, `ensureUserRow`) take the `userId` that a public helper has **just** got from `requireUserId()`. They are internal to `/data`, and lint blocks importing them anywhere else (§4).
- If there is no signed-in user, the helper throws. It never returns someone else's data, or "all" data, as a fallback.

### 3.2 Every query is scoped to that user

Load records **by id AND by owner**, never by id alone. How you scope depends on the table:

| Table | How to scope |
|---|---|
| `users` | `where: { id: userId }` |
| `months`, `currency_rates`, `month_plans` | `where: { userId, … }` (they have a `userId` column) |
| `budget_lines` | `where: { userId, monthKey, … }` |
| `categories` | through the month: `where: { id, month: { userId } }` |
| `entries` | through category → month: `where: { id, category: { month: { userId } } }` |
| `ai_insights` | through the month: `where: { monthId, month: { userId } }` |

```ts
// data/entries.ts
import 'server-only';
import { db } from '@/db';
import { requireUserId } from './auth';

export async function getEntry(entryId: string) {
  const userId = await requireUserId();
  return db.query.entries.findFirst({
    where: { id: entryId, category: { month: { userId } } }, // id AND owner
  });
}
```

### 3.3 Writes are scoped too

- **Update/delete:** the `WHERE` clause must include the ownership condition. For tables without a `userId` column, that means a Drizzle `exists`/`inArray` subquery up to `months.userId`. Never update or delete by id alone.
- **Insert:** set `userId` from `requireUserId()`, never from input. When inserting a child row (category, entry, insight), check first that its parent (month, category) belongs to the user.
- **Moving an entry:** the target category must belong to the **same user and the same month** (see CLAUDE.md §6).
- If a record isn't found **for this user**, treat it as not found (`null` / `notFound()`). Never show whether it exists for someone else.

### 3.4 Checklist for every new `/data` helper

- [ ] File starts with `import 'server-only';`
- [ ] Calls `requireUserId()` and takes **no** `userId` argument
- [ ] Every query and write is filtered by the owner (directly or through relations)
- [ ] Uses Drizzle only, with no `` sql`…` ``, `db.execute` or raw `neon()` client
- [ ] Returns only the columns the UI needs, as plain serialisable values
- [ ] Has an integration test proving user A cannot read or change user B's data (CLAUDE.md §11)

---

## 4. Enforcement

`npm run lint` checks these rules (`eslint.config.mjs`), so breaking one is a lint error, not just a review comment:

| Where | Blocked |
|---|---|
| Everywhere except `data/**`, `db/**` and `e2e/**` | importing `@/db`, `drizzle-orm` or `@neondatabase/serverless` |
| Everywhere except `data/**` | importing `@/data/scope` (it takes a `userId`) |
| `components/**`, `lib/**` | importing any `@/data/*` helper (only pages/layouts fetch, plus Server Actions for writes) |
| `data/**` | `import { sql } from 'drizzle-orm'` and the raw `@neondatabase/serverless` client |
| Everywhere except `db/**` | `db.execute(…)` and `db.$client` |

`db/index.ts` and every `/data` file start with `import 'server-only'`, so the build fails if either is pulled into a Client Component.

`e2e/**` is the only exemption: end-to-end tests read the database directly to check what the app stored and to clean up their test users. App code never does.

Lint can't catch everything. Review still has to check that every query is **owner-scoped** (§3.2–3.3) and that no Client Component loads data another way (`fetch`, `useEffect`, a route handler).
