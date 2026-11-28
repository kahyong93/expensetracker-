# Personal Cashflow Tracker

A personal money tracker: entries grouped by month, a next-month budget, and AI helpers. One person's data per account.

## Language

**Month**:
A named period such as `Jan-25` that holds that month's entries.
_Avoid_: Period, sheet

**Entry**:
One money movement in a month: an item, an amount and an optional note.
_Avoid_: Transaction, item (in code)

**Type**:
Whether an entry is money out (`Out`) or money in (`In`).
_Avoid_: Direction, kind

**Category**:
A user-named board column in a month. Income entries are grouped by category. Expense entries keep one only as a storage anchor.
_Avoid_: Bucket, tag

**Section**:
One of the three fixed spending groups of the budget plan: Basic Needs, Investment / Savings, Entertainment.
_Avoid_: Group, bucket

**Line**:
One fixed item inside a section, such as Groceries. Every expense entry and every budget amount belongs to a line.
_Avoid_: Category (for a plan line), budget item

**Budget**:
The amount planned for a line in a given month.
_Avoid_: Limit, allowance

**Plan**:
All budgets for one month, plus its expected income and AI note. It can exist before the month does.
_Avoid_: Forecast

**Split**:
The target share of expected income for each section (default 50 / 20 / 30).
_Avoid_: Ratio, allocation

**Carry-over**:
The unused (or overspent) budget of earlier months, added to a line's available amount in a later month.
_Avoid_: Rollover

**Unassigned**:
An expense entry that has no line yet. It is excluded from budget progress until the user picks one.
_Avoid_: Uncategorised
