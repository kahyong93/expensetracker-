# Spec: AI features via LangChain + OpenAI

- **Status:** Done. All seven features call the real AI Server Actions; the browser stub is deleted.
- **Behaviour source:** PRD §7.7 (AI-1 to AI-7). **Decisions:** `docs/adr/0001-ai-via-langchain.md`. **Rules:** CLAUDE.md §7.
- **Goal:** replace the browser stub `lib/mock/ai.ts` with real AI. The UI stays as it is. Only the function each component calls changes.

## 1. Shared setup (all features)

| Piece | File | What it does |
|---|---|---|
| Client | `lib/ai/client.ts` | The only LangChain import. `complete()` returns plain text, `completeJson()` returns a structured reply (strict JSON Schema). `ChatOpenAI`, model `AI_MODEL` (default `gpt-5.4-mini`), 30 s timeout, 1 retry, plus a 2,000-token reasoning allowance on top of each answer cap. Provider failure → `AiProviderError`. Schema mismatch → `null`. |
| Fake | `lib/ai/fake.ts` | With `AI_FAKE=1`, canned replies built from the prompt, after a 300 ms delay. Used by Playwright. |
| Prompts | `lib/ai/prompts.ts` | Pure builders: `systemPrompt`, `monthContext`, one builder per task. Wording is from the reference design. |
| Schemas | `lib/ai/schemas.ts` | JSON Schemas: every property required, `additionalProperties: false`, object at the root. |
| Checks | `lib/ai/parse.ts` | App rules on top of the schema. Returns `null` on a bad reply. |
| Rate limit | `lib/ai/rate-limit.ts` | 15 requests per user per 60 s, sliding window, in memory. |
| Runner | `server/actions/run-ai.ts` | `runAi()`: session check → rate limit → body → error mapping. `loadAiMonth()` loads the user's month and display currency through `/data`. |
| Actions | `server/actions/ai.ts` | One Server Action per feature (below). |
| Copy | `lib/ai-messages.ts` | `AI_BUSY_MESSAGE`, `AI_BAD_REPLY_MESSAGE`, `PASTE_MAX_CHARS`. Shared with the UI. |

**Results** use the `ActionResult` shape:

| Case | `code` | Toast |
|---|---|---|
| Over the rate limit, provider error or timeout | `ai_busy` | "AI is busy, try again in a moment" |
| Reply fails the schema or `parse.ts` | `ai_bad_reply` | "Couldn't read the AI reply, try again" |
| Bad input | `invalid` | "Something went wrong, try again" |
| Month not found for this user | `month_not_found` | "We couldn't find that month" |
| Not signed in | `unauthorised` | "Please sign in again" |

**Input rule:** the client sends the month key plus the user's own input only. Categories, entries, budgets, expected income and currency are always read on the server for the signed-in user.

**Logging:** in production only error names are logged, never prompts or replies.

## 2. Features

Columns: **Max tokens** is the answer cap from CLAUDE.md §7. **Saves** says what is written to Neon.

### AI-1 Auto-categorise ✅ built
- **Action:** `suggestCategoryAction(monthKey, { type, label, note })` → `{ category, isNew }`
- **Prompt:** `categorisePrompt` (reference `suggestCat`). Categories are that type's categories in the month.
- **Schema:** `{ category: string }`. **Max tokens:** 100. **Saves:** nothing.
- **Checks:** a valid category name (≤ 40 chars). An existing category is matched case-insensitively and returns its exact name; anything else is `isNew`.
- **UI:** `components/entry/entry-modal.tsx`. A match selects the category; a new name fills "+ New category…". Toast "Suggested category: {name}". Runs on blur per PRD AI-1.

### AI-2 Ask your money ✅ built
- **Action:** `askMoneyAction(monthKey, messages)` → `string`
- **Input:** chat history `[{ role: 'user' | 'assistant', content }]`. Only the last 10 are kept. Each message is ≤ 1,000 chars, and the last one must be from the user.
- **Prompt:** reference `sendChat`: `[user: "Here is my data:\n" + context, assistant: "Got it. What would you like to know?", ...last 10]`, system prompt in plain-text mode.
- **Output:** plain text, trimmed. An empty reply is `ai_bad_reply`. **Max tokens:** 600. **Saves:** nothing.
- **UI:** `components/ai/ask-money-chat.tsx`.

### AI-3 Monthly summary · AI-5 Spending alerts · AI-7 Savings tips ✅ built
- **Action:** `generateInsightAction(monthKey, kind)` → `Insight`, where `kind` is `summary`, `alerts` or `tips`. The fake uses the kind as its task name.
- **Prompt:** reference `runInsight`: context + `Task:` line for the kind + the JSON shape line.
- **Schema:** `{ headline: string, points: [{ title: string, text: string }] }`. **Max tokens:** 900.
- **Checks:** the existing `parseInsight` in `lib/validation.ts`, plus a point count: summary and tips need 3, alerts need 2–4. Extra points are cut; too few is `ai_bad_reply`.
- **Saves:** `ai_insights` (one per month and kind) through `data/insights.saveInsight`. Revalidates the month layout. "Refresh" regenerates and replaces it.
- **UI:** `components/ai/insight-card.tsx`, which shows the saved card from Server Component props after revalidation.
- **Build order:** one step per kind (summary, then alerts, then tips). The action is shared, so alerts and tips mostly add a prompt and a fake reply.

### AI-4 Smart budget suggestions ✅ built
- **Action:** `suggestBudgetAction(monthKey)` → `{ budgets: Record<string, number /* SGD cents */>, note }`
- **Prompt:** reference `suggestBudget`. Next month is `nextOf(monthKey)`. Expected income is next month's plan if set, otherwise this month's income total, shown in the display currency.
- **Schema:** built per request. `budgets` is an object with one required number property per expense category, plus `note: string`. **Max tokens:** 600.
- **Checks:** only the exact category names. Each amount must be a finite number ≥ 0, converted from the display currency to SGD cents with `round(value / rate * 100)`. The note is checked with `parseAiNote`. Saving replaces all of next month's budgets, so a missing or bad amount for any category rejects the whole reply and nothing is saved.
- **Saves:** `data/plans.replaceBudgets(nextKey, budgets, note)`. Revalidates. Toast "AI budget filled in. Edit any number."
- **UI:** `components/budget/budget-planner.tsx`. It no longer sends `actuals` or `expectedCents`.

### AI-6 Paste to add ✅ built
- **Action:** `parsePasteAction(monthKey, text)` → `ParsedRow[]` (`{ type, category, label, amountCents, note }`)
- **Input:** text trimmed, 1–4,000 chars. Over the limit gives the existing "Paste up to 4,000 characters" message. Empty text is blocked in the UI with "Paste some text first".
- **Prompt:** reference `runPaste`, with amounts in the display currency code. The shape line asks for `{"entries": [...]}`, because OpenAI needs an object at the root.
- **Schema:** `{ entries: [{ type: "Out" | "In", category, label, amount: number, note }] }`. **Max tokens:** 1500.
- **Checks:** per row: a valid type, a valid category name (an existing one is matched case-insensitively to its exact name), and a label within limits. Amount > 0, converted to SGD cents. A note over the limit is trimmed. Bad rows are dropped. At most 200 rows (`MAX_ENTRIES_PER_REQUEST`). If no rows survive, the toast is "No entries found in that text".
- **Saves:** nothing in this action. "Add {n} entries to {month}" uses the existing `addEntriesAction`, which creates new categories as needed.
- **UI:** `components/ai/paste-to-add.tsx`, `components/ai/parsed-row-item.tsx`. The `ParsedRow` type moves out of `lib/mock/ai.ts`.

## 3. Build steps

Each step is built, checked (typecheck, lint, unit tests, E2E) and committed on its own. You try it in the app before the next one starts.

| # | Step | Status |
|---|---|---|
| 0 | Shared setup (§1) | ✅ built |
| 1 | AI-1 Auto-categorise | ✅ built |
| 2 | AI-2 Ask your money | ✅ built |
| 3 | AI-3 Monthly summary | ✅ built |
| 4 | AI-5 Spending alerts | ✅ built |
| 5 | AI-7 Savings tips | ✅ built |
| 6 | AI-4 Smart budget | ✅ built |
| 7 | AI-6 Paste to add | ✅ built |
| 8 | Delete `lib/mock/ai.ts` | ✅ done |

## 4. Tests

- **Unit** (`lib/ai/*.test.ts`): prompt wording against the reference, every `parse.ts` check (good and bad replies, case-insensitive match, currency conversion), and the rate-limit window.
- **E2E** (`e2e/journey.spec.ts`, `AI_FAKE=1`): one flow per feature, checking the UI result and, where something is saved, the Neon rows.
- **Never** call OpenAI in tests.

## 5. Done when

- All 7 features work against real OpenAI with your key, show busy states, and recover cleanly from bad replies and the rate limit (PRD §13 checklist).
- Nothing in `components/` imports `lib/mock/ai.ts`, and the file is gone.
- CLAUDE.md §7, the ADR and this spec match the code.
