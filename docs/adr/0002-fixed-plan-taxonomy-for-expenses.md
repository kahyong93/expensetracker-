# ADR 0002: Expenses use a fixed section and line taxonomy

- **Status:** Accepted
- **Date:** 2026-11-28

## Context

Budgets were keyed by the user's free-text expense category name, so spend could not be matched reliably to a budget, and the reference design's `PLAN` (3 sections, 23 lines) was not connected to entries.

## Decision

1. Expense entries store `section_id` and `line_id` (the `PLAN` ids, never renamed). Spent-vs-budget matches on `line_id`.
2. `entries.category_id` stays `NOT NULL` as a storage anchor: saving an expense finds or creates a month category named after its line (or "Unassigned"). Boards, forms and the AI use sections and lines, not user categories.
3. `budget_lines` is keyed by `line_id`. Old name-keyed rows that do not match a line name are deleted.
4. `split` and `carry` live on `users` (global, as in the reference).
5. `mapEntry()` keyword rules place expenses that have no saved line. They run on read (so old entries show a line at once), and the guess is saved the first time the entry is edited. Budgets and carry-over use the same placement.
6. Income keeps user categories and has no sections.
7. AI: for expenses, Suggest category, Paste to add and Smart budget choose a plan line id (structured output limits the reply to real ids; unknown ids are rejected or fall back to the keyword rules, then Unassigned). Chat and insights see the sections, lines, split targets, this month's budgets and carry-over.

## Consequences

- Users lose free-form expense categories. Income and legacy data keep them.
- The `PLAN` constant is code, not data: adding a line is a deploy.
- Old budgets that do not match a line name are lost when the schema is pushed.
