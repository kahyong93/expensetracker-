# CLAUDE.md — Personal Cashflow Tracker (Next.js)

Read this file at the start of every session. Source-of-truth docs:
- `PRD.md` covers **what** to build: features, behaviour, copy, acceptance criteria.
- `DESIGN_SYSTEM.md` covers **how it looks**: tokens, components, responsive rules, states.
- This file covers **how to build it**.
- **Reference design:** `Cashflow Tracker v2.dc.html` in `expensetracker\docs\reference` (in the repo: `docs/reference/`). Read-only; never edit it.

> **Read and follow `DESIGN_SYSTEM.md` before implementing or modifying any UI.** If code and docs disagree: the PRD decides behaviour, DESIGN_SYSTEM decides visuals. If something isn't covered, ask. Don't invent.

## 1. First session: inspect, then fill in §2
1. Read `package.json`, the lockfile, `next.config.*`, `tsconfig.json`, the lint/format configs, `tailwind.config.*`/`postcss.config.*`, `.env.example`, `middleware.ts`, and the top two levels of `app/` / `src/` / `pages/`.
2. Replace every `TBD` in §2 with what you actually find. Commit that change on its own.
3. If there is no DB/ORM, auth, AI SDK or test runner, **stop and ask**. Never install one to fill the gap.
4. Never replace an existing library (CSS, ORM, auth, fetching, forms, validation, tests) without the user's agreement.

## 2. Project facts (keep current)
| Item | Value |
|---|---|
| Next.js / Router | TBD (App Router expected; for Pages Router adapt paths, keep the rules) |
| Language | TBD (TypeScript `strict` expected) |
| Package manager | TBD (match the lockfile; never mix) |
| Styling | TBD (use what exists, §5) |
| Database + ORM | TBD |
| Auth | TBD |
| AI provider / SDK | TBD (use the existing one) |
| Validation / Tests / Lint | TBD |
| Scripts | dev TBD · build TBD · lint TBD · test TBD · typecheck TBD |

## 3. Architecture
- **Server Components by default.** Pages load the signed-in user's data on the server and pass serialisable props down.
- **Client Components** only for interaction: the board (drag and drop), modals, chat, forms, the layout toggle and toasts. Put `"use client"` on the smallest subtree that needs it.
- **Mutations** use Server Actions (or route handlers if the project already does). Revalidate the affected month after each one, or update optimistically and reconcile.
- **AI** goes through route handlers under `app/api/ai/*`. Keys live in server env only.
- **The URL holds month and tab:** `/m/[month]`, `/m/[month]/expenses`, `/income`, `/budget`, `/ai`. The month select navigates; tabs are `<Link>`s.

Target structure (adapt to what exists; don't move files without reason):
```
app/(app)/layout.tsx            header, nav, LayoutMode + Toast providers, session guard
app/(app)/m/[month]/…           dashboard, expenses, income, budget, ai pages
app/api/ai/{categorise,chat,insight,budget,paste}/route.ts
app/api/export/[month]/route.ts CSV
components/ui/                  Button, SegmentedControl, Field, Select, Card, Tag, ProgressBar, Modal, Toast, Fab, Skeleton
components/{header,dashboard,board,budget,ai,icons}/
lib/money.ts  lib/months.ts  lib/calc.ts  lib/validation.ts  lib/design/palette.ts
lib/ai/{client,prompts,parse}.ts  lib/db/*  lib/seed/jan25.ts  server/actions/*
```

## 4. Coding standards
- TypeScript strict. No `any` (use `unknown` and narrow). Typed props named for the domain (`entry`, `category`, `month`).
- Naming:
  - components `PascalCase`
  - hooks `useX`
  - utilities `camelCase`
  - constants `SCREAMING_SNAKE`
  - route segments `kebab-case`
- Fixed domain words: **entry**, **category**, **month** (`Jan-25`), **type** (`'Out' | 'In'`), **budget**, **expected income**. No synonyms.
- One component per file. Derived numbers go in **pure functions in `lib/calc.ts`**, never inline in JSX.
- Add `import 'server-only'` to `lib/db/*` and `lib/ai/*`. Small focused commits; don't reformat unrelated files.

## 5. Implementing the design system
1. Put every `--cf-*` token from DESIGN_SYSTEM §2 and §5 in `:root` in the global CSS.
   - **Tailwind present:** map the tokens in `theme.extend` and don't use arbitrary hex.
   - **Otherwise:** CSS Modules with `var(--cf-*)`. No CSS-in-JS.
2. Load fonts with `next/font/google`: Fredoka 500–700 → `--font-heading`, Nunito 400–800 → `--font-body`. Set `tabular-nums` on the root.
3. Global CSS: background with the dot pattern, `a`/`a:hover`, the `:focus-visible` ring, 16px form controls under 720px, and reduced motion.
4. Build `components/ui/*` first, matching DESIGN_SYSTEM §7 with every state from §9. Feature code never restyles a primitive; add a variant instead.
5. Phone vs laptop: one `LayoutModeProvider` exposing `{ mode, isPhone, framed, setMode }`, where `isPhone = mode==='phone' || (mode==='auto' && width<720)`. Every difference in DESIGN_SYSTEM §8.2 reads `isPhone`. Render laptop on the server and resolve on mount, without a layout flash.
6. Copy strings from `PRD.md` and the reference design word for word.
7. After UI work, compare at **390px, 800px and 1280px** against `docs/reference/Cashflow Tracker v2.dc.html`.

## 6. Data
Entities (adapt to the ORM's conventions):
```
UserSettings   userId · currency · layout · showAudit · compactCards · autoCategorise · activeMonth
CurrencyRate   userId · code · rate                      unique(userId, code)
Month          id · userId · key · sortIndex(yyyymm) · isSample        unique(userId, key)
Category       id · monthId · type · name · position                    unique(monthId, type, name)
Entry          id · monthId · categoryId · type · label · amountCents · note · timestamps
Budget         userId · monthKey · categoryName · amountCents   unique(userId, monthKey, categoryName)
ExpectedIncome userId · monthKey · amountCents                  unique(userId, monthKey)
AiInsight      userId · monthId · kind(summary|alerts|tips) · json      unique(monthId, kind)
BudgetNote     userId · monthKey · text
```
Money rules:
- Store **integer cents in SGD**. Never store floats or converted values.
- Convert only at the edges: display `cents/100*rate`, input `round(value/rate*100)`.
- One `formatMoney()` in `lib/money.ts`: symbol + en-US grouping to 2 decimals, `−` (U+2212) for negatives.
- Budgets are keyed by **month key**, because they can exist before the month does.
- Default rates: SGD 1, USD 0.77, INR 66.5, MYR 3.3, EUR 0.67, GBP 0.58. Users can override them. No FX API.

Business rules and formulas are in PRD §7–§8. The sample seed in `lib/seed/jan25.ts` is copied from `seedMonths()` in the reference design.

## 7. AI integration
- Wrap the existing SDK once as `lib/ai/client.ts` → `complete({ system, messages, maxTokens })`. Nothing else imports the SDK.
- `lib/ai/prompts.ts` builds the context on the server from the user's month, with amounts in the display currency:
  - `Month / Currency / categories / [budgets]`
  - `Entries (type | category | item | amount)`
- **System prompt:** "You are a cheerful, concise personal finance helper inside a budgeting app. Use only the data provided and never invent transactions. Write amounts like {sym}12.34." Then append either "Reply with valid JSON only, no markdown or code fences." or "Reply in plain text without markdown, under 120 words."
- Use the task prompts word for word from the reference design: `runInsight`, `suggestBudget`, `runPaste`, `suggestCat`.

| Route | Output (validate the shape) | Max tokens | Persist |
|---|---|---|---|
| categorise | `{category}`, matched case-insensitively to existing categories | 100 | no |
| chat | plain text | 600 | no |
| insight | `{headline, points:[{title,text}]}` | 900 | AiInsight |
| budget | `{budgets:{cat:number}, note}`, exact category names only | 600 | Budget + BudgetNote |
| paste | `[{type,category,label,amount,note}]`, input ≤ 4,000 chars | 1500 | only after user confirms |

- Parse by extracting the first `{…}`/`[…]` and running `JSON.parse` in a try/catch. On a bad shape, toast "Couldn't read the AI reply, try again".
- Rate limit about 15 requests per user per minute and return 429. Toast "AI is busy, try again in a moment".
- Each AI button has its own busy flag. Never log prompts that contain financial data in production. Never send another user's data.

## 8. State, forms, interactions
State ownership:
- **URL:** month, tab.
- **DB:** entries, categories, budgets, settings, insights.
- **Local state:** modal and form, search, drag target, chat, parsed paste rows, collapsed columns, toasts.
- Don't add a global state library unless one already exists.

Interactions:
- Optimistic updates for drag, move, edit and delete. Roll back on error with a toast.
- Native HTML5 drag and drop (`dataTransfer` carries the entry id). Keep the "Move to…" select as the keyboard/touch fallback. No DnD library unless asked.
- Controlled inputs keep the raw string while typing and convert to cents on commit (budget inputs buffer until blur).

## 9. Validation, errors, security
- Validate on the server always, using the same schemas the client uses for inline errors. Reject unknown fields. Field limits are in PRD §7.3 and §7.5.
- Scope every query and mutation by `session.user.id`. Load records by id **and** userId. Server Actions re-check the session.
- Actions return `{ ok: true, data } | { ok: false, code, message }`. Show friendly toasts using PRD copy and log the details server-side. Add `error.tsx` and `not-found.tsx` per segment, styled per the design system.
- Secrets live in server env only (document them in `.env.example`, never as `NEXT_PUBLIC_`).
- Render all user and AI text as text. No `dangerouslySetInnerHTML`.
- CSV: quote every field, and prefix cells starting with `= + - @` with `'`.
- Destructive actions need the Confirm modal.

## 10. Accessibility
- Landmarks. The nav uses `aria-current` or the tab roles. Every input has a visible label. Icon buttons have an `aria-label`.
- Modal: `role="dialog"`, focus trap, Esc closes, focus is restored. Toast and chat log use `aria-live="polite"`.
- Keep the focus ring and honour `prefers-reduced-motion`. Phone hit targets ≥ 44px where the layout allows. Decorative mascot and glyphs are `aria-hidden`.

## 11. Testing
Use the configured runner; ask before adding one.
- **Unit (required):** `money`, `months` (`nextOf` incl. Dec→Jan), `calc`, `ai/parse`, validation.
- **Integration:** server actions, including that user A cannot touch user B's data.
- **E2E** (if available): PRD §13 checklist flows at 390px and 1280px.
- Mock `lib/ai/client.ts`. Never call the real provider in tests.
- Run typecheck, lint and test before finishing any task.

## 12. How to work
**UI change:**
1. Read DESIGN_SYSTEM and the matching section of the reference design.
2. Reuse `components/ui`.
3. Handle both layouts and every state.
4. Check at 390/800/1280.

**New feature:** update the PRD first, then:
1. data shape
2. validation
3. authorised action
4. pure calc
5. UI
6. tests

**Debugging:**
1. Reproduce it and state the cause before changing code.
2. Usual suspects:
   - floats instead of cents
   - missing userId scope
   - stale data (revalidate)
   - hydration mismatch from `isPhone`
   - AI JSON parsing
3. Fix the root cause and add a regression test.

**Always:**
- Ask before adding dependencies, making destructive schema changes, or deviating from the design.
- Never edit `.env*` values or commit secrets.
- When you add a component, token or rule, update DESIGN_SYSTEM.md or PRD.md in the same change.
