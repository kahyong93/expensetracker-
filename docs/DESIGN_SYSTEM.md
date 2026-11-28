# DESIGN_SYSTEM.md — Personal Cashflow Tracker

This file is the visual source of truth. Behaviour, business rules and user-facing copy live in `PRD.md`, and code rules live in `CLAUDE.md`; this file links to them rather than repeating them. Every value here was taken from the approved design (`Cashflow Tracker v2.dc.html`). If a value is not listed, look in that file before inventing one. **Do not "improve" the look.** Make it work and keep it looking exactly like the design.

---

## 1. Principles

1. **Cute, soft and happy.** Pink paper with a dotted pattern, chunky rounded cards, pastel fills and friendly copy. A smiley mascot and kaomoji show the mood.
2. **Tactile "3D sticker" depth.** Surfaces get a solid, offset bottom shadow (`0 6px 0 <border colour>`) instead of a blurry drop shadow. Primary buttons look like pressable candy.
3. **Colour means money direction.**
   - Mint = income ("Earned")
   - Peach = expenses ("Spent")
   - Butter = balance ("Left")
   - Pink = brand and actions

   Never swap these.
4. **Numbers first.** Amounts use Fredoka and `font-variant-numeric: tabular-nums` (set on the app root). Labels stay small and quiet.
5. **Show less on small screens.** The phone layout hides secondary detail rather than stacking everything (see §8).
6. **One primary action per surface.** Primary actions are solid pink with a 3D shadow. Everything else is soft pink, outline or ghost.

---

## 2. Colour tokens

Define these once as CSS custom properties, for example in `globals.css` under `:root`. If the project uses Tailwind, map them into `theme.extend.colors`. Components must reference tokens, never raw hex.

### 2.1 Brand and neutrals

| Token | Hex | Use |
|---|---|---|
| `--cf-bg` | `#FFF5F7` | Page ground, list-row hover, chat suggestion area |
| `--cf-bg-dot` | `#FAD2DE` | Dot pattern: `radial-gradient(var(--cf-bg-dot) 1.3px, transparent 1.4px)` at `24px 24px` |
| `--cf-header-glass` | `rgba(255,245,247,0.92)` | Sticky header fill, with `backdrop-filter: blur(8px)` |
| `--cf-surface` | `#FFFFFF` | Cards, inputs on cards, active tab, modal |
| `--cf-field` | `#FFFAFB` | Input fill inside cards/modals, item cards, chat chips |
| `--cf-surface-hover` | `#FFF8FA` | Collapsible header hover, audit tiles |
| `--cf-track` | `#FBEAF0` | Progress-bar tracks, segmented-control ground, neutral chips, ghost hover |
| `--cf-line` | `#FCE1E9` | Card borders, dividers, 3D card shadow colour |
| `--cf-line-strong` | `#F8CFDC` | Input and outline-button borders, active-tab shadow |
| `--cf-line-danger` | `#F6C9D6` | Border of the "Reset" button only |
| `--cf-soft` | `#FDE6EE` | Soft (AI) button fill, text-button hover, drag-over ring |
| `--cf-soft-hover` | `#FBD5E2` | Soft button hover |
| `--cf-soft-note` | `#FDE9EF` | AI note callout fill, summary icon tint |
| `--cf-note-ink` | `#6E3A4E` | Text in the AI note callout |
| `--cf-cancel-hover` | `#F7DCE6` | Modal Cancel hover |
| `--cf-peach-hover` | `#FFF0E6` | Outline-button hover (+ Month, + Category, Export CSV) |
| `--cf-sparkle` | `#F59AB5` | `✦` before section titles, merchant bars, item-card hover border |
| `--cf-primary` | `#C9446F` | Primary buttons, active tab text, links, focus ring, toast, user chat bubble |
| `--cf-primary-hover` | `#B83C64` | Primary hover |
| `--cf-primary-deep` | `#A8335A` | 3D shadow under primary buttons, soft-button text, link hover |
| `--cf-ink` | `#3B2F3A` | Body text, mascot features |
| `--cf-ink-soft` | `#6E5E6A` | Form labels, secondary text, chips |
| `--cf-ink-muted` | `#8A7A86` | Meta text, counts, inactive tabs, placeholders, icon buttons |
| `--cf-overlay` | `rgba(59,47,58,0.35)` | Modal backdrop |
| `--cf-neutral-bar` | `#D9CBC0` | "This month actual" bar in the budget planner |

### 2.2 Money-direction families

| Role | Card fill | Card border / 3D shadow | Tint (chips, pills) | Tint hover | Tag text | Big numeral | Sub text | Solid / bar | Mascot cheeks |
|---|---|---|---|---|---|---|---|---|---|
| **Income (mint)** | `#DDF5EA` | `#BCEAD4` | `#E3F6EE` | `#CDEFE0` | `#23795D` | `#1E6E54` | `#3F7F69` | bar `#3FAE8A`, toggle `#2E9A77`, under-budget `#7DD3B0` | `#9FE0C3` |
| **Expense (peach)** | `#FFE6DA` | `#FFCDB8` | `#FDEDE4` | `#FBDCCB` | `#B4532A` | `#A44A24` | `#9A5A3E` | toggle `#F08A5D`, over-budget `#E8794A` | `#FFB59A` |
| **Balance (butter)** | `#FFF2C4` | `#F7DE8C` | `#FFF1C9` | — | `#7A5A12` | `#3B2F3A` | `#7A5A12` | saving bar `#7DD3B0`, overspent bar `#F2A65A` | — |

More income-related values:
- Expected-income input: fill `#F4FBF8`, border `#CDEFE0`, text `#23795D`.
- Income bar track: `#E3F6EE`.

### 2.3 Category palette

Categories get colours by index in their order list, cycling every 6. Each pair is `[dot/bar/segment, tint]`:

| # | Solid | Tint |
|---|---|---|
| 0 | `#FFB86B` | `#FFF1E0` |
| 1 | `#7CC6F2` | `#E6F4FC` |
| 2 | `#B49CF0` | `#F1ECFD` |
| 3 | `#F59AB5` | `#FDE9EF` |
| 4 | `#7DD3B0` | `#E5F7EF` |
| 5 | `#F2CC4E` | `#FDF5D6` |

Keep this as a single exported constant, e.g. `CATEGORY_PALETTE` in `lib/design/palette.ts`. JS needs it for the donut `conic-gradient` and the stacked share bar.

### 2.4 Contrast notes

These are known and kept on purpose, because the user approved the look:
- `--cf-ink-muted` on `--cf-bg` is about 3.8:1. Use it only for meta and secondary text, never for text a task depends on.
- White on `--cf-primary` is about 4.2:1. It is acceptable because every primary label is 13px+ and weight 800.

If something new needs body-size text on pink, use `--cf-ink` or `--cf-ink-soft`.

---

## 3. Typography

Load both fonts through `next/font/google` and expose them as CSS variables `--font-heading` and `--font-body`. Do not use a `<link>` tag.

- **Fredoka**, weights 500, 600 and 700. Headings, numerals, the brand and modal titles. Default weight is **600**.
- **Nunito**, weights 400, 600, 700 and 800. Everything else. Buttons, tabs and labels use **800**, body text 400–700.

| Role | Font | Size / weight | Notes |
|---|---|---|---|
| Brand wordmark | Fredoka | 22 / 600, lh 1.1 | `--cf-primary` |
| Brand subtitle | Nunito | 12 / 400 | muted; hidden on phone |
| KPI numeral (laptop) | Fredoka | 36 / 600, lh 1.1 | role numeral colour |
| KPI numeral (phone strip) | Fredoka | 17 / 600 | single line, ellipsis |
| Page title (budget) | Fredoka | 26 / 600 | |
| Section title | Fredoka | 21 / 600 | prefixed by `✦` in `--cf-sparkle`, gap 6 |
| Modal title | Fredoka | 22 / 600 | |
| Board column total | Fredoka | 22 / 600 | |
| Budget summary figures | Fredoka | 24 / 600 | expected-income input 20 / 600 |
| AI card title | Fredoka | 18 / 600 | |
| Board column name / donut centre | Fredoka | 16 / 600 | |
| Body, chat bubbles, inputs | Nunito | 14 / 400–800 | lh 1.45 for prose |
| Row text, buttons, tabs | Nunito | 13 / 800 (buttons), 13 / 400–800 (rows) | |
| Small buttons, meta, KPI sub, chips | Nunito | 12 / 700–800 | |
| Tags, counts, tiny buttons | Nunito | 11 / 700–800 | |
| Overline label | Nunito | 11 / 800, uppercase, `letter-spacing: .06em` | muted (e.g. "ALL INCOME LINES", plan table header) |

Rules:
- `text-wrap: pretty` on helper paragraphs and AI text.
- On phone (< 720px), every `input`, `select` and `textarea` is **16px** to stop iOS zoom-on-focus.
- Amount format: currency symbol + `toLocaleString('en-US', {min 2, max 2 decimals})`. Negatives use the true minus `−` (U+2212), e.g. `−S$12.00`.

---

## 4. Spacing, layout grid and sizing

Base unit 2px. The design uses these values; don't add new ones:
`2 · 4 · 6 · 8 · 10 · 12 · 14 · 16 · 18 · 20 · 22 · 24 · 26 · 28`

| Context | Value |
|---|---|
| Content max width | `1240px`, centred |
| Header padding | `14px 24px`, gap 14 |
| Main padding | laptop `24px`; phone `14px 12px 100px` (bottom clears the FAB) |
| Gap between page sections | 20 |
| KPI grid gap | 16 |
| Board grid gap | 14 |
| Card padding | 22 (AI cards 20, board column header 14, item list 10, modal 26) |
| Row padding in lists | 6–12 vertical |
| Inline icon/text gap | 6–10 |

Grid recipes. Use these exactly; they produce the tablet behaviour automatically:

| Area | `grid-template-columns` |
|---|---|
| KPI row (laptop) | `repeat(auto-fit, minmax(240px, 1fr))` |
| KPI strip (phone) | `repeat(3, minmax(0, 1fr))`, gap 6 |
| Dashboard pair (Where it went / What came in) | `repeat(auto-fit, minmax(min(100%, 460px), 1fr))`, `align-items: start` |
| Top spending list | `repeat(auto-fill, minmax(min(100%, 320px), 1fr))`, column gap 28, row gap 4 |
| Category board | `repeat(auto-fill, minmax(250px, 1fr))`, `align-items: start` |
| AI insight cards | `repeat(auto-fit, minmax(min(100%, 300px), 1fr))` |
| AI tools (chat / paste) | `repeat(auto-fit, minmax(min(100%, 420px), 1fr))` |
| Budget planner row (laptop) | `minmax(140px,1.2fr) 110px 150px minmax(120px,2fr)`, gap 16 |
| Budget planner row (phone) | `minmax(0,1fr) auto`; input and bars span `1 / -1` |
| Audit tiles | `repeat(auto-fit, minmax(260px, 1fr))`, gap 12 |
| Main nav (phone) | `repeat(5, minmax(0,1fr))`, gap 4 |

Fixed sizes:
- Logo tile 48×48
- Mascot 38×38
- Donut 156 with 104 hole
- FAB 58×58
- Rank badge 22×22
- Category dot 10 (legend 9)
- Bars: 12 (stacked share), 10 (KPI saving), 7 (category), 6 (budget), 5 (merchant)

---

## 5. Shape: radius, borders, shadows

### Radius
| Token | px | Use |
|---|---|---|
| `--cf-r-pill` | 999 | Buttons, tabs, segmented controls, tags, bars, toast |
| `--cf-r-modal` | 32 | Modal |
| `--cf-r-card` | 30 | Main cards, KPI cards |
| `--cf-r-column` | 28 | Board columns |
| `--cf-r-card-sm` | 26 | Phone KPI strip, board share bar card |
| `--cf-r-item` | 20 | Draggable item cards |
| `--cf-r-tile` | 18 | Logo tile, phone KPI tiles |
| `--cf-r-bubble` | 16 | Chat bubbles |
| `--cf-r-inner` | 14 | Hover rows, inner panels, AI points, drop zone, AI note |
| `--cf-r-input` | 12 | Inputs, selects, textarea, modal type toggle, parsed rows |
| `--cf-r-input-sm` | 10 | Budget/rate number inputs, AI icon badge |
| `--cf-r-xs` | 8 | Icon buttons, rank badge, "Move to" select, tiny text buttons |

Nothing is square-cornered.

### Borders
- Card: `2px solid var(--cf-line)`. KPI cards use their role border colour.
- Board share bar card and AI parsed rows: `1.5px solid var(--cf-line)`.
- Inputs and outline buttons: `1.5px solid var(--cf-line-strong)`.
- In-card dividers: `1.5px dashed var(--cf-line)` (top border). Table row rules: `1.5px solid var(--cf-track)`.
- Empty drop zone: `2px dashed var(--cf-line)`, height 88, centred muted 12px "Drop items here".

### Shadows

| Token | Value | Use |
|---|---|---|
| `--cf-shadow-card` | `0 6px 0 #FCE1E9, 0 16px 32px rgba(233,120,160,0.10)` | Main cards |
| `--cf-shadow-kpi` | `0 6px 0 <role border>` | KPI cards |
| `--cf-shadow-strip` | `0 4px 0 #FCE1E9` | Phone KPI strip |
| `--cf-shadow-column` | `0 3px 0 #FCE1E9` | Board columns at rest |
| `--cf-shadow-drop` | `0 0 0 4px #FDE6EE` (+ border `--cf-primary`) | Board column while dragging over |
| `--cf-shadow-btn` | `0 4px 0 #A8335A` | Primary buttons |
| `--cf-shadow-fab` | `0 4px 0 #A8335A, 0 10px 24px rgba(201,68,111,0.35)` | FAB |
| `--cf-shadow-tab` | `0 2px 0 #F8CFDC` | Active nav tab |
| `--cf-shadow-logo` | `0 4px 0 #F8B9CC` | Logo tile (also rotated −6°) |
| `--cf-shadow-modal` | `0 20px 50px rgba(59,47,58,0.25)` | Modal |
| `--cf-shadow-toast` | `0 8px 24px rgba(59,47,58,0.25)` | Toast |
| `--cf-shadow-frame` | `0 0 0 2px #FCE1E9, 0 20px 60px rgba(233,120,160,0.18)` | Framed phone preview (§8.3) |

---

## 6. Iconography and decoration

- **Line icons** (rename, delete, phone and laptop toggle): 24-unit viewBox, `stroke="currentColor"`, `stroke-width 1.8`, round caps and joins, rendered at 14px. If the project already has an icon library, use its closest glyphs at stroke 1.8. Otherwise keep inline SVG components in `components/icons/`.
- **Glyph icons** are text characters, part of the brand, and kept as-is:
  - `✦` sparkle (section titles, AI tab and buttons)
  - `!` alerts
  - `↓` tips
  - `→` "board" links
  - `▲` / `▼` toggles
  - `×` remove
- **Mascot**: a white circle face with two eyes, a smile and two cheek dots. It appears in the logo (pink cheeks `#F9A8C0`) and on the Earned and Spent KPI cards (role cheek colour). Build it as one `<Mascot cheek="…"/>` component. It is decorative, so set `aria-hidden`.
- **Kaomoji mood** on the balance card: text glyphs in Nunito 15/800, butter tag colour (which one shows: PRD D3).
- **KPI bubble**: a 130px white circle at 45% opacity, positioned `right:-34px; bottom:-46px` inside an `overflow:hidden` card.
- **Donut**: CSS `conic-gradient` of category solids by share, with a white 104px centre showing "Total out" and the amount.
- No emoji, no gradients other than the donut and the dot pattern, no photography.

---

## 7. Components

Every component below exists in the design. Build each once and reuse it. Names are suggestions; follow the project's existing naming if it differs (see CLAUDE.md).

### 7.1 Buttons

| Variant | Fill / text | Border | Shadow | Hover | Use |
|---|---|---|---|---|---|
| **Primary** | `--cf-primary` / white | none | `--cf-shadow-btn` | `--cf-primary-hover` + `translateY(-1px)` | + Add item, Save, Create, Ask, Add N entries |
| **Soft (AI)** | `--cf-soft` / `--cf-primary-deep` | none | none | `--cf-soft-hover` | Generate/Refresh, ✦ Suggest, Read it, ✦ Suggest with AI |
| **Outline** | white / `--cf-ink` | 1.5 `--cf-line-strong` | none | `--cf-peach-hover` | + Month, + Category, Fill with…, Export CSV |
| **Danger-soft** | `--cf-soft` / `--cf-primary-deep` | 1.5 `--cf-line-danger` | none | `--cf-soft-hover` | Reset to sample data |
| **Neutral** | `--cf-track` / `--cf-ink` | none | none | `--cf-cancel-hover` | Cancel, Discard |
| **Ghost** | transparent / `--cf-ink-muted` | none | none | `--cf-track` | Clear, Delete (item) |
| **Text-link** | transparent / `--cf-primary` | none | none | `--cf-soft` | Edit (item), Hide/Show |
| **Role link** | role tint / role tag text | none | none | role tint hover | "Expenses board →" (peach), "Income board →" (mint) |
| **Icon** | transparent / `--cf-ink-muted`, padding 4, r 8 | none | none | white | Rename, delete column |
| **FAB** | `--cf-primary` / white, Fredoka 32 "+" | none | `--cf-shadow-fab` | — | Phone only: add item |

Sizes:
- Large: padding `9px 16–18px`, 13px.
- Medium: `8px 12px` or `7px 12px`, 12–13px.
- Small: `6px 12px` or `5px 10px`, 12px.
- Tiny: `3px 7–9px`, 11px.

All buttons use font weight 800 (outline buttons 700) and `cursor: pointer`.

### 7.2 Segmented control / tabs
- Ground: `--cf-track`, pill, padding 3–4, gap 2–4.
- Option: pill, transparent, `--cf-ink-muted`.
- Active option: white, `--cf-primary` text. The main nav also gets `--cf-shadow-tab`.
- Used for the main nav, the layout toggle (Phone/Laptop), and Merchants / Biggest 10.
- Main nav tab labels and count badges: PRD §7.2 G2. Badges show on laptop only.
- Build the main nav with `role="tablist"` / `role="tab"` / `aria-selected`.

### 7.3 Form fields
- **Text/number input:** padding `9px 12px`, r 12, 1.5 `--cf-line-strong`, fill `--cf-field` (white when on the page ground), 14px.
- **Label:** stacked column, gap 5, 12px / 800 / `--cf-ink-soft`.
- **Select:** same as an input. Header selects (Month, Currency) are pills, 13/800, white.
- **Textarea** (Paste to add): 5 rows, `resize: vertical`, lh 1.45.
- **Checkbox row:** a `--cf-bg` panel, r 12, padding 12, `accent-color: var(--cf-primary)`.
- **Type toggle** (modal): 2 equal buttons, r 12. The active button fills solid: Out `#F08A5D`, In `#2E9A77`, white text. Inactive buttons are white with a `--cf-line-strong` border.
- **Invalid state** (new, needed for real validation): border `#E8794A`, helper text 11px/700 `#B4532A` below the field. No red.

### 7.4 Cards and surfaces
- **Card:** white, 2px `--cf-line`, r 30, padding 22, `--cf-shadow-card`, flex column with gap 14–16. The header row holds the section title on the left and an action on the right, with `flex-wrap`.
- **KPI card** (laptop): role fill, role border, r 30, padding 22, `--cf-shadow-kpi`, decorative bubble. It contains:
  - a white tag pill (12/800, role tag text) with the mascot on the right
  - the 36px numeral
  - a 12/700 sub line
  - The balance card swaps the mascot for the kaomoji and the sub line for a saving bar plus "% saved".
- **Phone KPI strip:** one white card (r 26, padding 12, `--cf-shadow-strip`). Inside are three role-filled tiles (r 18, padding 10: label 11/800 and numeral 17), then a saving bar with "x% saved" and the kaomoji.
- **Collapsible panel** (audit): white card, `overflow: hidden`. The header is a full-width button (padding `14px 22px`, hover `--cf-surface-hover`) with a butter `!` badge, a title and a Hide/Show label.

### 7.5 Data display
- **Progress bar:** pill track (`--cf-track`, or white on tinted grounds) with a pill fill whose width is a percentage. Budget state:
  - Within budget: fill `#7DD3B0`, text `#23795D`.
  - Over budget: fill `#E8794A`, text `#B4532A`.
  - Wording: PRD D4.
- **Category row** (Where it went): a button row (r 14, padding `8px 10px`, hover `--cf-bg`). It holds a dot, the name (ellipsis), a muted (count), the total, and a % pill in the category tint (laptop only). Below that sit a bar and an optional budget line.
- **Ranked row** (Top spending): a 22px rank badge (`--cf-track`, r 8), label (ellipsis), muted meta, amount, and a 5px `--cf-sparkle` bar scaled to the #1 item.
- **Tag/chip:** pill, padding `1px 7px` (or `4px 12px` on KPI cards), 11/700–800.
- **Stacked share bar:** 12px pill with a gap of 2 between segments, plus a wrapping legend (dot, name, **pct**).

### 7.6 Category board
- **Column:** white, r 28, 2px border, `--cf-shadow-column`. The header uses the category tint (padding 14):
  - Top row: dot, name (Fredoka 16), white count chip, rename and delete icon buttons.
  - Then the total (Fredoka 22) with a white % pill.
  - Then an optional budget bar.
- **Item list:** padding 10, gap 8, `min-height: 110px`, scrolls past `max-height` (460 laptop / 340 phone).
- **Item card:** `--cf-field`, 1.5 `--cf-line`, r 20, padding `11px 14px`, `cursor: grab`, hover border `--cf-sparkle` with a white fill. It shows the label (13/800), an optional note (11 muted), the amount, a "Move to…" select (11px, r 8, max-width 120), and Edit/Delete text buttons.
  - **Saving state:** while an added item is still being saved (optimistic placeholder), the card is at 70% opacity with `cursor: progress` and `aria-busy`; Move, Edit and Delete are disabled and it can't be dragged until the saved copy arrives.
- **Column footer:** a full-width "+ Add to {name}" button (12/800 `--cf-ink-soft`, top border 1.5 `--cf-track`). On phone, add a "Show N items ▼ / Hide items ▲" toggle in `--cf-primary`.
- **Drag over:** border `--cf-primary` plus `--cf-shadow-drop`.
- **Keyboard and touch:** the "Move to…" select is the accessible way to move items. Never remove it.

### 7.7 Chat
- Scroll area: `min-height 150`, `max-height 360`, gap 8.
- Bubbles: max-width 85%, padding `10px 14px`, r 16, 14px, `white-space: pre-wrap`.
  - User: right-aligned, `--cf-primary` fill, white text.
  - Assistant: left-aligned, `--cf-track` fill, ink text.
- Empty state: muted prompt plus suggestion chips (outline pills, 12/700, hover border `--cf-sparkle`).
- Busy state: an assistant bubble reading "Thinking…" in muted text.
- Input row: a flex input plus a primary "Ask" button. Enter sends.

### 7.8 AI insight card
Uses the card styles with padding 20 and `min-height 150`.
- Header: a 30px icon badge (r 10, role tint and colour), Fredoka 18 title, and a soft button.
- Empty state: a muted description.
- Filled state: a 15/800 headline, then point tiles (`--cf-bg`, r 14, padding `10px 12px`, title 13/800, text 13 `--cf-ink-soft`).

| Card | Icon | Tint | Fg |
|---|---|---|---|
| Monthly summary | ✦ | `#FDE9EF` | `#C9446F` |
| Spending alerts | ! | `#FFF1C9` | `#7A5A12` |
| Savings tips | ↓ | `#E5F7EF` | `#23795D` |

### 7.9 Modal
- Backdrop: `--cf-overlay`, click to close.
- Laptop: centred, padding 16.
- Phone: a **bottom sheet** (`place-items: end center`, padding 0).
- Panel: `width: min(420px, 100%)`, `max-height: 88vh`, scrolls, white, r 32, padding 26, gap 14, `--cf-shadow-modal`.
- Actions are right-aligned: Neutral "Cancel" plus Primary submit.
- Variants: Add/Edit item, New/Rename category, Create month, Confirm.
- Needs `role="dialog"`, `aria-modal`, a focus trap, Esc to close, and focus returned to the trigger.

### 7.10 Toast
- Fixed position, bottom-right (laptop `20px`/`16px`).
- Phone: `bottom: 96px` so it sits above the FAB, with `max-width: calc(100% - 32px)`.
- Style: `--cf-primary` fill, white 13/800, padding `12px 20px`, pill, `--cf-shadow-toast`.
- Auto-hides after **2600ms**. A new toast replaces the current one. Use `role="status"` and `aria-live="polite"`.

### 7.11 Header
- Sticky, with `--cf-header-glass` and blur, and a 2px `--cf-line` bottom border. It is a wrapping flex row:
  1. Brand: logo tile, wordmark and subtitle.
  2. Main nav.
  3. Controls: layout toggle, Month select, "+ Month", Currency select, rate input (non-SGD only: "S$1 = [input] sym", input 70px r 10), Settings, and "+ Add item" (laptop only).
- **Settings** (PRD §7.8, §14 Q1): an Outline `md` button holding only the gear line icon (§6), `aria-label="Settings"`, 44px square on phone. It opens a Modal titled "Settings" with one checkbox row (§7 Field `CheckboxRow`) per setting (S3–S5, labels word for word from the PRD) and Cancel / Save. Save stores only the changed settings and toasts "Settings saved".

### 7.12 Footer
Right-aligned, wrapping: "Export CSV" (Outline) and "Reset to sample data" (Danger-soft).

---

## 8. Responsive rules

### 8.1 Breakpoints
| Name | Width | Layout |
|---|---|---|
| Phone | `< 720px` | Phone layout (below) |
| Tablet | `720–1023px` | Laptop layout. The grids in §4 collapse to 1–2 columns on their own and the header wraps onto two lines. No extra rules. |
| Laptop / desktop | `≥ 1024px` | Laptop layout. Content is capped at 1240px. |

**720 is the only hard breakpoint.** Use it for every phone/laptop switch: a CSS `@media (max-width: 719px)` or the `useLayoutMode` hook.

### 8.2 What changes on phone
| Element | Laptop | Phone |
|---|---|---|
| Brand subtitle | shown | hidden |
| Main nav | inline pill, full labels and count badges | full-width 5-column grid placed **below** the controls (`order: 3; width: 100%`), short labels, no badges, tab padding `9px 4px` |
| Layout toggle labels | icon + "Phone"/"Laptop" | icon only |
| "+ Add item" | header button | hidden, replaced by the FAB (fixed, right 18, bottom 24) |
| KPIs | 3 large KPI cards | 1 compact strip (§7.4) |
| Donut | shown | hidden |
| % pills on category rows | shown | hidden |
| "All income lines" list | shown | hidden |
| Top spending | 8 merchants / 10 biggest | 5 / 5 |
| Audit panel | shown (sample month only) | hidden |
| Board columns | items open | items collapsed with a Show/Hide toggle; searching opens all |
| Board item list max height | 460 | 340 |
| Budget planner | 4-column table with an overline header | header hidden; each row stacks (name and actual on top, input and bars full width) |
| Modal | centred | bottom sheet |
| Main padding | 24 | `14px 12px 100px` |
| Form control font size | as specified | 16px |

### 8.3 Layout override (kept by request)
A user preference `layout: 'auto' | 'phone' | 'laptop'`, saved per user.
- `auto` follows the 720px breakpoint.
- Clicking the active option returns to `auto`. A toast confirms: "Layout follows your screen size", "Phone layout on" or "Laptop layout on".
- **Framed phone preview:** when `layout === 'phone'` and the viewport is ≥ 720px, the app root becomes `max-width: 430px; margin: 0 auto; box-shadow: var(--cf-shadow-frame)`. Fixed elements are positioned against the frame:
  - FAB `right: calc(50% - 197px)`
  - Toast `right: calc(50% - 199px)`, `max-width: 398px`
- Because the layout can be forced, phone vs laptop can't be pure CSS media queries. Drive it from one `isPhoneLayout` boolean (context or hook) and use CSS only for things that never change under the override (e.g. the 16px input rule).
- Hydration: render `auto` on the server as the laptop layout, then resolve on mount. Avoid a layout flash by reading the saved preference before first paint where the project allows it.

---

## 9. Interaction states

| State | Rule |
|---|---|
| **Hover** | Each component's hover from §7. Primary also lifts `translateY(-1px)`. Rows tint `--cf-bg`. Item cards get a `--cf-sparkle` border. Transition `background-color, transform, border-color 120ms ease`. |
| **Active / pressed** | Primary and FAB: `translateY(2px)` and shadow reduced to `0 2px 0 #A8335A`, so the candy presses in. Other buttons: one step darker than their hover. |
| **Selected** | Tabs and segmented options: white fill and `--cf-primary` text. Modal type toggle: solid role fill. |
| **Focus** | Global `:focus-visible { outline: 2px solid var(--cf-primary); outline-offset: 2px; }`. Never remove it. No browser blue. |
| **Disabled** | `opacity: .55; cursor: not-allowed;` with no hover or transform. Buttons are disabled while their AI request runs. |
| **Loading (AI)** | The button label changes and the button is disabled: Generate/Refresh → `Thinking…`, ✦ Suggest → `Thinking…`, Read it → `Reading…`, ✦ Suggest with AI → `Thinking…`. Chat shows the "Thinking…" bubble. Results appear without animation. |
| **Loading (data)** | Skeleton blocks in the final shapes (r 30 cards, pill bars) filled with `--cf-track`, with a soft opacity pulse (1.2s). No spinners. |
| **Empty** | Board column: dashed "Drop items here". Chat: suggestions. AI card: description text. Budget row: "No budget set yet". |
| **Dragging** | Source: `cursor: grab` / `grabbing`. Target column: `--cf-primary` border and `--cf-shadow-drop`. |
| **Error** | A toast with friendly copy (see CLAUDE.md §9), plus inline field errors (§7.3). Never show raw error text. |
| **Reduced motion** | Under `prefers-reduced-motion: reduce`, drop the transforms and the pulse. |

---

## 10. Copy and voice

All user-facing strings are owned by `PRD.md` and the prototype; use them word for word. For new copy, write it friendly, short and plain, in sentence case, and use the real month key ("Budget for Feb-25"). Toasts are past-tense confirmations ("Item added").

---

## 11. Rules for new UI

1. Compose from §7 components. If a new one is truly needed, build it from these tokens: white or tinted surface, r ≥ 12, a 1.5–2px pink border, a 3D offset shadow if it is a card, Fredoka for numbers and titles, Nunito 800 for actions.
2. Use colour only for money direction (§2.2) or category identity (§2.3), never decoration.
3. Every new component must define hover, focus-visible, disabled and phone behaviour before it ships.
4. No new fonts, colours, radii or shadow recipes without updating this file first.

---

## 12. Implementation additions (frontend build, Nov 2026)

Tokens added to `app/globals.css` for values already used in the reference design but not named above:
- `--cf-logo-tile` `#FFD6E2`, `--cf-logo-shadow` `#F8B9CC`, `--cf-logo-cheek` `#F9A8C0` (header logo tile).
- `--cf-in-input-fill` `#F4FBF8` (expected-income input, §2.2).
- `--cf-invalid-border` `#E8794A`, `--cf-invalid-text` `#B4532A` (invalid state, §7.3).
- `--cf-shadow-btn-pressed` `0 2px 0 #A8335A` and `--cf-shadow-fab-pressed` (pressed state, §9).
- Per-role KPI shadows `--cf-shadow-kpi-in|out|bal` (§5 `--cf-shadow-kpi`).
- Tailwind utility `bg-cf-paper`: the dot-pattern ground, used by the body and the framed phone preview.

Components added beyond §7:
- **Confirm** (`components/ui/confirm.tsx`, `useConfirm()`): the Confirm modal variant of §7.9 as a promise-based hook.
- **Shell skeleton** (`components/shell/shell-skeleton.tsx`): prerendered laptop-shaped fallback while the month/tab stream in.
- **Month missing** (`components/shell/month-missing.tsx`): card shown when the URL month doesn't exist, with a primary link to the latest month.

Sign-in and sign-up (PRD A1):
- **Auth frame** (`components/auth/auth-frame.tsx`): signed-out screens on the dot paper; centred logo tile, Fredoka 26/600 wordmark in `--cf-primary`, 12px muted subtitle.
- **Welcome** (`components/auth/welcome.tsx`, `/`): Card (max 420px, centred) with one line of copy, a primary "Sign in" and an outline "Create account" button. Both open Clerk's modal. Signed-in users are forwarded to their latest month.
- **First run** (`components/shell/first-run.tsx`, `/`, PRD A3): shown to a signed-in user with no months. Same auth frame and card as Welcome: one line of copy, a primary "Start fresh" and an outline "Try with sample data" button (size `touch`, full width). The chosen button reads "Setting up…" / "Loading…" while both are disabled; an error shows as a 12px bold `--cf-invalid-text` line under the buttons (`role="alert"`).
- **Logo tile** (`components/header/logo-tile.tsx`): the header logo tile, shared with the auth frame.
- **Account button** (`components/header/account-button.tsx`): Clerk `UserButton` at the end of the header controls; avatar 36px on laptop, 44px on phone. Its menu holds "Sign out".
- **Clerk appearance** (`components/auth/clerk-appearance.ts`): Clerk variables mapped to tokens: primary `--cf-primary`, text `--cf-ink` / `--cf-ink-muted`, surface `--cf-surface`, border `--cf-line-strong`, error `--cf-invalid-text`, backdrop `--cf-overlay`, font Nunito, radius `--cf-r-input`. Card `--cf-r-modal` + 2px `--cf-line` + `--cf-shadow-modal`; primary button pill + `--cf-shadow-btn`; titles Fredoka. Clerk's CSS sits in the `clerk` layer, declared before Tailwind's utilities in `app/globals.css`.
- **Button size `touch`**: min-height 44px, padding 10px 20px, 13px. For full-width actions that must meet the phone hit target.

### 12.1 Sections and lines (PRD §7.10)
- **Expenses board:** columns are the fixed plan lines, grouped under a section heading (Fredoka 18, colour `fg` of the section, with its muted sub-label such as "Fixed costs"). A column uses the section's tint and colour. Rename, delete and "+ Category" are hidden on Expenses; Income keeps them. Expenses with no line show in a final **Unassigned** group (neutral palette colour, no "+ Add to" button, and it is never a drop target).
- **Budget page:** one card per section. Header: "{n}. {title}" with its sub-label, the section total (Fredoka 20), "{pct}% of income · target {amount} ({split}%)", a 6px bar (turns `--cf-invalid-border` colour when over target) and a status line (12/800: `--cf-in-tag` when fine, `--cf-out-tag` when over, muted when nothing is planned). Below it, the overline header and one row per line, with the line's hint as an 11px muted line under its name.
- **Split and carry card:** a card above the sections. Split inputs (64px wide, number, tinted with the section colours) with an "Adds up to 100%" line in `--cf-in-tag`, or `--cf-out-tag` when the total is off. Carry-over uses the segmented control (§7.2): Off / Last month only / Cumulative, with a one-line hint.
- **Add / Edit item (expenses):** a Section select, then a Category select that lists only that section's lines and is disabled until a section is chosen.
- **Section spend bar** (`components/budget/section-spend.tsx`): under each section heading on the Expenses board, and in the Dashboard's "Where it went" card. A 6px bar (`under` / `over` fill) with "S$x left of S$y budget" or "S$x over the S$y budget", where the budget already includes carry-over. A muted 11px line adds "+S$x unused carried over" or "−S$x overspent carried over". Without a budget it only reads "S$x spent". Column headers and Budget page rows use the same carry wording.
