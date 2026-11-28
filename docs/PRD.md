# PRD.md — Personal Cashflow Tracker

| | |
|---|---|
| **Status** | Draft v1.0, ready for build |
| **Date** | 21 Nov 2026 |
| **Owner** | Product owner (you) |
| **Companion docs** | `DESIGN_SYSTEM.md` (visual spec), `CLAUDE.md` (engineering rules) |
| **Reference design** | `Cashflow Tracker v2.dc.html` (approved prototype) |

How the three docs relate: this PRD defines **what** to build and **why**, including behaviour, rules and all user-facing copy. `DESIGN_SYSTEM.md` defines **how it looks**, including tokens, components and what changes on phone. `CLAUDE.md` defines **how it is built**, including data schema and code rules. Each fact lives in one file only; the others link to it.

---

## 1. Summary

A friendly web app for tracking money in and money out, month by month. It replaces a personal spreadsheet ("Jan-25 sheet") with categorised boards, a dashboard, next-month budget planning and seven AI helpers. It works on phone and laptop, supports multiple display currencies (default S$), and stores each user's data in their own account.

## 2. Problem

The current spreadsheet works but is painful:
- **Totals drift.** Formula ranges miss rows. In the Jan-25 sheet, Food shows S$117.16 but its rows add up to S$151.96, and Interest shows S$15.15 against S$54.94.
- **Recategorising is slow.** Moving an item means cutting and pasting rows and fixing formulas.
- **No overview.** It is hard to see where money went, which merchants dominate, or how this month compares to a plan.
- **No planning loop.** Next month's budget isn't connected to this month's actual spending.
- **Manual entry is tedious.** Bank SMS and receipts have to be retyped.
- **It's joyless.** Tracking feels like a chore, so it gets skipped.

## 3. Goals and non-goals

### Goals
| # | Goal | Measure of success |
|---|---|---|
| G1 | Correct totals, always | 0 calculation discrepancies; totals are derived, never typed |
| G2 | Fast capture | Add an item in ≤ 10 s on phone; paste-to-add turns a bank SMS into entries in ≤ 3 taps |
| G3 | Clear monthly picture | User can answer "where did my money go?" from the dashboard without scrolling on laptop |
| G4 | Plan the next month | User creates a next-month budget in ≤ 2 min ("Fill with…" or "Suggest with AI") |
| G5 | Make it pleasant | Cute, happy design that matches the approved prototype on phone and laptop |
| G6 | Private and durable | Data is tied to a user account and available on any device |

### Non-goals (v1)
- Bank account linking or automatic transaction import
- Shared or household accounts and multi-user editing
- Live FX rates (rates are user-editable defaults)
- Investments, net worth, debts or recurring-payment reminders
- Native iOS/Android apps (the responsive web app covers phone)
- Receipt photo OCR (paste text only)
- Multi-language UI (English only)

## 4. Users

**Primary persona: "Organised but busy" individual, Singapore-based.**
- Salaried, with a few income streams (salary, reimbursements, bank interest).
- About 60–80 expenses a month, many small (food, transport) and a few large (rent, insurance).
- Currently tracks in a spreadsheet and knows their categories.
- Uses a phone to log on the go and a laptop to review and plan.
- Sometimes thinks in other currencies (USD, INR, MYR, EUR, GBP).

**User needs**
1. Log spending quickly, wherever they are.
2. Trust the totals.
3. See the month at a glance.
4. Reorganise categories freely.
5. Plan next month realistically.
6. Get plain-language insight without doing analysis.

## 5. Key user stories

| ID | As a user, I want to… | So that… |
|---|---|---|
| US1 | sign up and sign in | my data is private and syncs across devices |
| US2 | add an expense or income with item, category, amount and note | my month is up to date |
| US3 | have the category suggested for me | I don't have to think about it |
| US4 | paste a bank SMS or receipt and get entries | I don't retype |
| US5 | see Earned, Spent, Left and saving % | I know how the month is going |
| US6 | see spending by category and top merchants | I know where the money went |
| US7 | drag items between categories | fixing a category is instant |
| US8 | create, rename and remove categories | the structure fits my life |
| US9 | switch between months and create the next one | I can track over time |
| US10 | carry recurring items into a new month | I don't re-enter rent and salary |
| US11 | set a budget per category for next month | I have a plan |
| US12 | have AI suggest that budget | I get a realistic starting point |
| US13 | see budget progress while spending | I can adjust in time |
| US14 | ask questions about my money | I get answers without building reports |
| US15 | get a monthly summary, spending alerts and savings tips | I learn something each month |
| US16 | view amounts in another currency | I can think in the currency I want |
| US17 | export a month to CSV | I keep my own copy |
| US18 | use it comfortably on phone and laptop | it fits how I use each device |

## 6. Scope and release plan

| Release | Contents |
|---|---|
| **MVP (v1.0)** | Everything in §7 except items marked *v1.1* |
| **v1.1** | Spending alerts and savings tips refinement, sample audit panel, CSV injection hardening review, onboarding polish |
| **Later** | Recurring rules, multi-month trends chart, receipt photo OCR, live FX, shared accounts |

MVP must ship with all seven AI features. Alerts and tips are in MVP, and v1.1 refines their prompts from real usage.

---

## 7. Functional requirements

Priority: **P0** = must for MVP, **P1** = should for MVP, **P2** = later.

### 7.1 Accounts and onboarding
| ID | Requirement | P |
|---|---|---|
| A1 | Sign up, sign in, sign out and reset password, using the project's existing auth solution. Screens are styled per DESIGN_SYSTEM. Signed-out visitors land on a welcome page whose "Sign in" and "Create account" buttons open Clerk's sign-in / sign-up as a modal; opening an app page while signed out returns to the welcome page with sign-in open. Sign out is in the account menu (avatar) in the header. | P0 |
| A2 | Each user's data (months, entries, categories, budgets, settings, AI results) is visible and editable only by that user. | P0 |
| A3 | **First run:** a new user chooses between "Start fresh" (creates the current month, e.g. `Nov-26`, with default categories) and "Try with sample data" (loads the Jan-25 sample). | P0 |
| A4 | Default categories for "Start fresh": Out: Food, Transport, Fixed & Bills, Shopping & Insurance. In: Work, Reimburse, Interest. | P0 |
| A5 | Delete account: removes all of the user's data after typed confirmation. | P1 |

### 7.2 Global shell
| ID | Requirement | P |
|---|---|---|
| G1 | Sticky header: brand ("Personal Cashflow Tracker" + "Money in, money out, and next month's plan"), main nav, and controls. | P0 |
| G2 | Main nav tabs: Dashboard, Expenses (count), Income (count), Next month budget, ✦ AI helper. On phone: Home, Spent, Earned, Budget, AI. | P0 |
| G3 | **Month switcher** lists the user's months in chronological order. Switching shows the toast "Switched to {month}". The URL reflects month and tab. | P0 |
| G4 | **+ Month** opens "Create a new month": the label defaults to the month after the active one, and "Copy recurring items (Fixed & Bills, Work salary, Interest)" is checked by default. Duplicate labels are rejected with "That month already exists". On create, the app switches to the new month. | P0 |
| G5 | **Currency switcher:** S$ SGD (default), US$ USD, ₹ INR, RM MYR, € EUR, £ GBP. For non-SGD currencies, an editable "S$1 = [rate] {sym}" field appears. The choice and rates are saved per user. | P0 |
| G6 | **Layout toggle:** Phone / Laptop. Clicking the active one returns to Auto (follows screen width). The choice is saved per user. See DESIGN_SYSTEM §8.3. | P0 |
| G7 | **+ Add item** (laptop header) or **FAB** (phone) opens Add item. It defaults to Income when on the Income tab, otherwise Expense. | P0 |
| G8 | Footer: **Export CSV** and **Reset to sample data**. | P0 |
| G9 | Toast confirmation for every change (2.6 s). | P0 |

### 7.3 Entries (items)
| ID | Requirement | P |
|---|---|---|
| E1 | Fields: type (Out · Expense / In · Income), item/merchant/source (required), category (required), amount in the current currency (required, ≥ 0, 2 decimals), note (optional). | P0 |
| E2 | Category select lists the type's categories, plus "+ New category…" which reveals a name field. The new category is created on save. | P0 |
| E3 | When adding to Food or Transport, the item name is pre-filled with the category name. | P1 |
| E4 | Amounts are stored in SGD. Entering an amount in another currency converts it with the current rate. | P0 |
| E5 | Edit: same form, pre-filled. Delete: confirm "Delete "{item}" ({amount}) from {category}?". | P0 |
| E6 | After saving, the user stays on Dashboard or Budget if they were there, otherwise goes to the matching board. | P1 |
| E7 | Validation message: "Please fill in item, category and amount". | P0 |

### 7.4 Dashboard
On phone, several dashboard and board elements are reduced or hidden. That list lives in DESIGN_SYSTEM §8.2 and applies to §7.4–§7.6.

| ID | Requirement | P |
|---|---|---|
| D1 | **Earned** card: total income and "{n} items · {n} categories". | P0 |
| D2 | **Spent** card: total expenses and "{n} items · {n} categories". | P0 |
| D3 | **Left** card: income − expenses. Tag reads "Left · saved" (≥ 0) or "Left · a little over" (< 0). Mood (ﾉ◕ヮ◕)ﾉ / (｡•́︿•̀｡). Bar shows spent ÷ earned (capped at 100%, orange when over). Label "{x}% saved". | P0 |
| D4 | **Where it went:** a donut of expense share by category, and one row per category with colour, name, (count), total, % share and a bar. If the category has a budget this month, the bar shows budget use and a line reads "S$x left of S$y budget" or "S$x over the S$y budget". Clicking a row or "Expenses board →" opens Expenses. | P0 |
| D5 | **What came in:** one row per income category (count, total, % share, bar) and "Income board →". It also lists every income line with its category chip. | P0 |
| D6 | **Top spending** with a Merchants / Biggest 10 toggle. Merchants groups expenses by item name (total, count × category, bar relative to #1), top 8. Biggest 10 lists the largest single expenses (category · note). | P0 |
| D7 | **Sample audit panel** (sample month only, setting on): collapsible "Jan-25 sheet formula check" explaining the Food and Interest discrepancies. | P2 |

### 7.5 Expenses and Income boards
| ID | Requirement | P |
|---|---|---|
| B1 | Title pill: "Expenses board · drag cards between columns" (peach) / "Income board · drag cards between columns" (mint). | P0 |
| B2 | Search box ("Search items, e.g. Uniqlo") filters items by name and note within all columns. | P0 |
| B3 | Stacked share bar and legend (name + %) for the board's categories. | P0 |
| B4 | One column per category, in saved order. The header shows colour, name, count, total, % share, and the budget bar and line (Expenses only, when budgeted). | P0 |
| B5 | Item card: name, note (hidden if "compact cards" is on), amount, "Move to…" select, Edit, Delete. | P0 |
| B6 | **Drag and drop** an item card onto another column moves it. The target column highlights while dragging over it. Toast: "Moved "{item}" to {category}". | P0 |
| B7 | **Move to…** select does the same without dragging (keyboard and touch). | P0 |
| B8 | "+ Add to {category}" opens Add item with that category pre-selected. | P0 |
| B9 | **+ Category** creates an empty column. Duplicate names in the same board are ignored. | P0 |
| B10 | **Rename** a category: all its items move to the new name, and the toast reads "Renamed to "{name}"". | P0 |
| B11 | **Delete** a category: allowed only if empty (confirm "Remove the empty "{name}" column?"). Otherwise the toast reads "Move or delete the {n} items in "{name}" first". | P0 |
| B12 | Empty column shows a "Drop items here" target. | P0 |

### 7.6 Next month budget
| ID | Requirement | P |
|---|---|---|
| P1 | Title "Budget for {next month}", with the explainer: "Set a limit per category, using {month} spending as a guide. When you create {next}, these limits appear as progress bars on its dashboard and board." | P0 |
| P2 | One row per expense category: name, this month's spend, a budget input (placeholder = this month's spend), a comparison bar pair (actual grey, budget in colour, same scale), and a difference line: "Same as {month}" / "S$x less than {month}" / "S$x more than {month}" / "No budget set yet". | P0 |
| P3 | **Expected income** input. It defaults to this month's income and saves per next month. | P0 |
| P4 | **Total budget** (sum of rows) and **Left to save** (expected − total), updated live. | P0 |
| P5 | **Fill with {month} amounts** copies actuals into all rows. | P0 |
| P6 | **✦ Suggest with AI** (see AI-4). | P0 |
| P7 | **Clear** empties all rows and the note. | P0 |
| P8 | Budgets can be set before the next month exists. They attach automatically when that month is created. | P0 |
| P9 | Clearing a single input removes that category's budget. | P0 |

### 7.7 AI helper
All AI runs on the server, using only the signed-in user's data for the active month. Responses use the user's display currency. Each button shows its own busy label and is disabled while running.

| ID | Feature | Where | Behaviour | P |
|---|---|---|---|---|
| AI-1 | **Auto-categorise** | Add item modal | "✦ Suggest" button next to Category. It also runs automatically when the item name loses focus on a **new** item if: the setting is on, the user hasn't picked a category, and the name changed since the last suggestion. It picks an existing category (case-insensitive match) or proposes a new one (fills "+ New category…"). Toast: "Suggested category: {name}". | P0 |
| AI-2 | **Ask your money** | AI tab | A chat about the active month. Empty state shows four suggestions: "How much did I spend on Uniqlo?", "Can I afford a {sym}300 trip next month?", "What was my biggest expense?", "How much did food cost per day?". Enter sends. A "Thinking…" bubble shows while waiting. Replies are plain text under 120 words. "Clear" resets. History is kept for the session only. | P0 |
| AI-3 | **Monthly summary** | AI tab card | Generate → a headline plus 3 points: biggest driver, savings result, one notable pattern. Saved per month. "Refresh" regenerates. | P0 |
| AI-4 | **Smart budget suggestions** | Budget tab | Suggests a budget for each existing expense category for next month, treating one-off or annual items (e.g. large insurance) as non-recurring, and taking expected income into account. Fills the rows (editable), stores a one or two sentence "AI note" shown under the buttons, and toasts "AI budget filled in. Edit any number." | P0 |
| AI-5 | **Spending alerts** | AI tab card | 2–4 noteworthy items: one-off spikes, small repeated spends that add up, categories over budget. Saved per month. | P0 |
| AI-6 | **Paste to add** | AI tab | Textarea for a bank SMS, receipt or list → "Read it" → a preview list of extracted entries (type, category chip, item, amount; income shown with "+"). Each row can be removed. "Discard" or "Add {n} entries to {month}" saves them. New categories are created as needed. Nothing is saved before confirmation. Max 4,000 characters. | P0 |
| AI-7 | **Savings tips** | AI tab card | 3 practical tips tied to specific merchants or categories, each with an estimated monthly saving. Saved per month. | P0 |

AI guardrails:
- Never invent transactions; only the provided data is used.
- Bad AI output shows "Couldn't read the AI reply, try again".
- Provider errors or the rate limit show "AI is busy, try again in a moment".
- Limit: about 15 AI requests per user per minute.
- Chat (AI-2) sends the month's data plus the last 10 messages of the conversation.
- Paste to add (AI-6) reads amounts in the currency the user is viewing, then stores them in SGD like typed amounts.
- Cached results (AI-3/5/7) are stored per month.

### 7.8 Settings
| ID | Setting | Default | P |
|---|---|---|---|
| S1 | Display currency + custom rates | SGD | P0 |
| S2 | Layout: Auto / Phone / Laptop | Auto | P0 |
| S3 | Auto-categorise on item name blur | On | P0 |
| S4 | Compact item cards (hide notes on boards) | Off | P1 |
| S5 | Show sample audit panel | On | P2 |

Settings are reached from a small settings entry in the header, styled per DESIGN_SYSTEM. Its exact placement needs a design addition (see §14).

### 7.9 Export and reset
| ID | Requirement | P |
|---|---|---|
| X1 | **Export CSV** of the active month, file `{month}_Cashflow.csv`. Columns: Month, Type, Category, Item, Amount (SGD), Amount ({currency}), Note. Next month budget rows are appended as type "Budget". Toast: "Exported {file}". | P0 |
| X2 | **Reset to sample data:** confirms, then restores the Jan-25 sample month (66 expenses, 7 income) to its original state, with each expense in its section and line. All budgets, expected income and AI budget notes are cleared, and split and carry-over go back to 50/20/30 and cumulative. Other months are untouched. Toast: "Restored Jan-25 data". | P1 |

---

### 7.10 Sections and lines (budget plan connected to entries)
Source: the `PLAN` constant in the reference design. See `GLOSSARY.md` and ADR 0002.
| ID | Requirement | P |
|---|---|---|
| S1 | The Add / Edit item form on **Expenses** has a **Section** select (Basic Needs, Investment / Savings, Entertainment) and a **Category** select listing only that section's lines, in budget-page order. Each expense entry saves its section id and line id. Income keeps its own categories. | P0 |
| S2 | The Expenses board is grouped by section, then line, with the budget page's names and order. Expense entries with no line show under **Unassigned** and can be changed on any entry. | P0 |
| S3 | Existing expense entries without a section or line are filled once by the keyword rules (`mapEntry()`). | P0 |
| S4 | **Spent vs budget** matches entries to budget lines by saved line id, on the budget page, Dashboard and Expenses board. Dashboard and board bars read the viewed month's plan per section and per line, including carry-over. | P0 |
| S5 | Carry-over applies to Basic Needs, Investment / Savings and Entertainment. | P0 |
| S6 | AI **Suggest** category chooses from the same sections and lines. AI chat and insights see sections, lines, split targets and carry-over. | P0 |
| S7 | **Reset to sample data** also clears plans, the AI note, split and carry. | P0 |

## 8. Calculation rules

All totals are calculated from entries, never stored or typed.

| Metric | Formula |
|---|---|
| Earned | Σ amount where type = In |
| Spent | Σ amount where type = Out |
| Left | Earned − Spent |
| Saved % | Left ÷ Earned × 100 (0 if Earned = 0), 1 decimal |
| Category share | Category total ÷ type total × 100; 1 decimal (expenses), 2 decimals (income) |
| Budget use | min(spent ÷ budget, 100%). Over when spent > budget. |
| Merchant total | Σ expenses grouped by trimmed item name |
| Next month key | `Mon-YY` → following month (Dec-25 → Jan-26) |
| Display amount | SGD amount × rate (formatting: DESIGN_SYSTEM §3) |

Money is stored as integer cents in SGD, so there are no rounding drift errors.

---

## 9. UX and design requirements

The UI must match the approved prototype. Visuals, breakpoints (phone < 720px, tablet, laptop) and every phone/laptop difference are defined in `DESIGN_SYSTEM.md`. User-facing copy is defined in §7 of this PRD and in the prototype.

## 10. Non-functional requirements

| Area | Requirement |
|---|---|
| Performance | Dashboard first paint < 1.5 s on 4G mid-range phone; interactions (move, edit) feel instant with optimistic updates (< 100 ms visual response); handles 500 entries per month smoothly |
| AI latency | Show busy state immediately; target response < 8 s; timeout at 30 s with the busy toast |
| Availability | Data saved server-side; no data loss on refresh or device switch |
| Security | Auth on every request; per-user data scoping; secrets server-only; no `dangerouslySetInnerHTML`; CSV formula-injection guard; rate-limited AI |
| Privacy | Financial data is never logged in plain text in production; sent to the AI provider only when the user triggers an AI feature; account deletion removes everything |
| Accessibility | WCAG 2.1 AA target for interaction (keyboard, focus, labels, dialogs, live regions); keyboard alternative to drag; known contrast exceptions documented in DESIGN_SYSTEM §2.4 |
| Browser support | Latest 2 versions of Chrome, Safari (incl. iOS), Edge, Firefox |
| Responsiveness | 360px to 1920px wide without horizontal scroll (except the phone nav row if ever needed) |

## 11. Data model

The schema is defined in `CLAUDE.md` §6. Product rule: budgets and expected income attach to a month **label**, so they can be planned before the month exists (P8).

## 12. Analytics (privacy-safe, no amounts or item names)

Track counts only:
- sign-ups and the first-run choice
- items added (manual vs paste)
- AI feature used (by feature), AI suggestion accepted (auto-categorise kept or changed)
- budgets created (fill / AI / manual)
- months created
- CSV exports
- layout mode used

Use these to check the success metrics below.

| Metric | Target (first 3 months) |
|---|---|
| Weekly active users who log ≥ 5 items/week | 60% of active users |
| Users who create a next-month budget | 50% |
| Auto-categorise suggestions kept unchanged | ≥ 80% |
| Paste-to-add entries kept (not removed before saving) | ≥ 85% |

## 13. Acceptance criteria (release checklist)

- [ ] A new user can sign up, choose "Start fresh" or sample data, and land on the Dashboard.
- [ ] Adding, editing, deleting, dragging and moving an item updates every total, bar and count right away and keeps them after a refresh.
- [ ] Jan-25 sample totals match the rows: Food S$151.96, Interest S$54.94, and Earned/Spent/Left consistent.
- [ ] Category create, rename (items follow) and delete-empty-only all work on both boards.
- [ ] Creating Feb-25 from Jan-25 with "copy recurring" copies only Fixed & Bills, Work and Interest items. Budgets set earlier for Feb-25 appear as progress bars.
- [ ] Switching currency changes every displayed amount, input and AI reply. Stored values are unchanged.
- [ ] All 7 AI features work end to end, show busy states, recover cleanly from bad output and rate limits, and never save without confirmation where required.
- [ ] CSV opens correctly in Excel and Google Sheets.
- [ ] Phone layout at 390px and laptop at 1280px match the prototype. The Phone/Laptop toggle works, including the framed preview on wide screens.
- [ ] User A cannot see or change user B's data (verified by test).
- [ ] Keyboard-only use is possible for every feature, including moving items.

## 14. Open questions

| # | Question | Default if not answered |
|---|---|---|
| Q1 | Where does the Settings entry sit in the header, and how does it look? | **Decided (default taken):** a small gear icon button after the currency select, opening a modal (DESIGN_SYSTEM §7.11) |
| Q2 | Should recurring categories for "copy recurring items" be user-configurable? | Fixed list in v1 (Fixed & Bills, Work, Interest) |
| Q3 | Design for sign-in, sign-up and the first-run choice screen? | Built from DESIGN_SYSTEM components (card, fields, primary button, mascot) |
| Q4 | Can a user delete a whole month? | Yes, with typed confirmation, in v1.1 |
| Q5 | Is chat history saved across sessions? | No (session only) |
| Q6 | Should the contrast exceptions be fixed? | Keep as designed |
| Q7 | Custom month labels (not `Mon-YY`)? | Allowed; "next month" becomes "{label} (next)" |

## 15. Risks

| Risk | Mitigation |
|---|---|
| AI suggests wrong categories or numbers | Always editable; never saved without user action (except cached insights, which are read-only text) |
| AI cost or abuse | Per-user rate limit; token caps per feature; paste length cap |
| Drag and drop on touch devices is unreliable | "Move to…" select on every card |
| Currency confusion | Single SGD base; rate shown next to the selector; CSV includes both SGD and display amounts |
| Scope creep beyond the prototype | Non-goals list; changes go through this PRD first |

## 16. Glossary

- **Entry / item:** one expense or income line.
- **Category:** a column on a board. Expense and income categories are separate.
- **Month:** a labelled period such as `Jan-25`, holding its own entries and categories.
- **Board:** the drag-and-drop column view for Expenses or Income.
- **Budget:** a planned limit per expense category for a month.
- **Expected income:** the income assumed when planning a month's budget.
- **Base currency:** SGD. Everything is stored in it.
