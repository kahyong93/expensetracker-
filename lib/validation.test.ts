import { describe, expect, it } from "vitest";
import { resolveCurrency } from "@/lib/money";
import {
  LIMITS,
  MAX_ENTRIES_PER_REQUEST,
  parseAiNote,
  parseCategoryName,
  parseCents,
  parseChatMessages,
  parseCurrencyCode,
  parseEntryInput,
  parseEntryInputs,
  parseEntryType,
  parseId,
  parseInsight,
  parseInsightKind,
  parseLayout,
  parseLineBudgets,
  parseLineId,
  parsePlanPrefs,
  parseMonthLabel,
  parsePlanKey,
  parseRate,
  parseSettingsPatch,
  validateCategoryName,
  validateEntry,
  validateMonthLabel,
  type EntryFormValues,
} from "@/lib/validation";

const SGD = resolveCurrency("SGD");
const GBP = resolveCurrency("GBP");
const UUID = "3f2b8c1e-9a4d-4e7b-8c2a-1d5e6f7a8b9c";

// Income by default: it keeps a free-text category. Expenses use sections and lines (below).
const form = (over: Partial<EntryFormValues> = {}): EntryFormValues => ({
  type: "In",
  label: "Kopi",
  category: "Food",
  amount: "1.20",
  note: "",
  ...over,
});

describe("validateEntry (client form)", () => {
  it("trims and converts a valid entry", () => {
    expect(validateEntry(form({ label: "  Kopi ", category: " Food ", note: " am " }), SGD)).toEqual({
      ok: true,
      data: { type: "In", label: "Kopi", category: "Food", amountCents: 120, note: "am", sectionId: null, lineId: null },
    });
  });

  it("flags every missing required field", () => {
    expect(validateEntry(form({ label: " ", category: "", amount: "" }), SGD)).toEqual({
      ok: false,
      errors: { label: "Required", category: "Required", amount: "Enter an amount of 0 or more" },
    });
  });

  it("rejects negative and non-numeric amounts", () => {
    expect(validateEntry(form({ amount: "-5" }), SGD).ok).toBe(false);
    expect(validateEntry(form({ amount: "abc" }), SGD).ok).toBe(false);
  });

  it("accepts a zero amount", () => {
    expect(validateEntry(form({ amount: "0" }), SGD)).toMatchObject({ ok: true, data: { amountCents: 0 } });
  });

  it("rejects amounts above the cap", () => {
    expect(validateEntry(form({ amount: "10000000.01" }), SGD)).toEqual({
      ok: false,
      errors: { amount: "That amount looks too large" },
    });
    expect(validateEntry(form({ amount: "10000000" }), SGD).ok).toBe(true);
  });

  it("enforces length limits", () => {
    const result = validateEntry(
      form({
        label: "x".repeat(LIMITS.label + 1),
        category: "c".repeat(LIMITS.category + 1),
        note: "n".repeat(LIMITS.note + 1),
      }),
      SGD,
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(Object.keys(result.errors).sort()).toEqual(["category", "label", "note"]);
    expect(validateEntry(form({ label: "x".repeat(LIMITS.label), note: "n".repeat(LIMITS.note) }), SGD).ok).toBe(true);
  });

  it("converts from the display currency", () => {
    expect(validateEntry(form({ amount: "1.16" }), GBP)).toMatchObject({ ok: true, data: { amountCents: 200 } });
  });

  it("keeps the stored cents when an edit leaves the amount untouched", () => {
    const prefilled = { input: "0.59", cents: 101 };
    expect(validateEntry(form({ amount: "0.59" }), GBP, prefilled)).toMatchObject({
      ok: true,
      data: { amountCents: 101 },
    });
  });
});

describe("name validators", () => {
  it("validates category names", () => {
    expect(validateCategoryName(" ")).toBe("Required");
    expect(validateCategoryName("c".repeat(LIMITS.category + 1))).toMatch(/under 40/);
    expect(validateCategoryName("Pets")).toBeNull();
  });

  it("validates month labels", () => {
    expect(validateMonthLabel("")).toBe("Required");
    expect(validateMonthLabel("m".repeat(LIMITS.monthLabel + 1))).toMatch(/under 20/);
    expect(validateMonthLabel("Feb-25")).toBeNull();
  });
});

describe("server parsers: scalars", () => {
  it("parseId accepts UUIDs only (no optimistic placeholder ids)", () => {
    expect(parseId(UUID)).toBe(UUID);
    expect(parseId(`pending-${UUID}`)).toBeNull();
    expect(parseId("tx_1")).toBeNull();
    expect(parseId(42)).toBeNull();
  });

  it("parseEntryType", () => {
    expect(parseEntryType("Out")).toBe("Out");
    expect(parseEntryType("In")).toBe("In");
    expect(parseEntryType("out")).toBeNull();
  });

  it("parseCents accepts whole, non-negative, capped cents", () => {
    expect(parseCents(0)).toBe(0);
    expect(parseCents(LIMITS.maxAmountCents)).toBe(LIMITS.maxAmountCents);
    expect(parseCents(LIMITS.maxAmountCents + 1)).toBeNull();
    expect(parseCents(1.5)).toBeNull();
    expect(parseCents(-1)).toBeNull();
    expect(parseCents("100")).toBeNull();
    expect(parseCents(Number.NaN)).toBeNull();
  });

  it("parses bounded names and labels", () => {
    expect(parseCategoryName("  Pets ")).toBe("Pets");
    expect(parseCategoryName("")).toBeNull();
    expect(parseCategoryName("c".repeat(LIMITS.category + 1))).toBeNull();
    expect(parseMonthLabel("Feb-25")).toBe("Feb-25");
    expect(parseMonthLabel(7)).toBeNull();
  });

  it("parsePlanKey allows a next-month label such as 'Holiday (next)'", () => {
    const label = "h".repeat(LIMITS.monthLabel);
    expect(parsePlanKey(`${label} (next)`)).toBe(`${label} (next)`);
    expect(parsePlanKey(`${label}x (next)`)).toBeNull();
  });

  it("parseAiNote allows empty text", () => {
    expect(parseAiNote("")).toBe("");
    expect(parseAiNote("n".repeat(601))).toBeNull();
  });

  it("parseCurrencyCode", () => {
    expect(parseCurrencyCode("INR")).toBe("INR");
    expect(parseCurrencyCode("JPY")).toBeNull();
    expect(parseCurrencyCode(null)).toBeNull();
  });

  it("parseRate accepts positive finite rates up to the cap", () => {
    expect(parseRate(0.8)).toBe(0.8);
    expect(parseRate(1_000_000)).toBe(1_000_000);
    for (const bad of [0, -1, Number.NaN, Number.POSITIVE_INFINITY, 1_000_001, "0.8"]) {
      expect(parseRate(bad)).toBeNull();
    }
  });

  it("parseLayout", () => {
    expect(parseLayout("phone")).toBe("phone");
    expect(parseLayout("tablet")).toBeNull();
  });

  it("parseInsightKind", () => {
    expect(parseInsightKind("tips")).toBe("tips");
    expect(parseInsightKind("other")).toBeNull();
  });
});

describe("parseEntryInput (untrusted Server Action input)", () => {
  const valid = { type: "In", category: "Food", label: "Kopi", amountCents: 120, note: "", sectionId: null, lineId: null };

  it("accepts a valid entry and trims text", () => {
    expect(parseEntryInput({ ...valid, label: " Kopi ", note: " am " })).toEqual({ ...valid, note: "am" });
  });

  it("rejects unknown and missing fields", () => {
    expect(parseEntryInput({ ...valid, userId: "user_other" })).toBeNull();
    expect(parseEntryInput({ ...valid, id: UUID })).toBeNull();
    expect(parseEntryInput({ type: "In", category: "Food", label: "Kopi", amountCents: 120 })).toBeNull();
  });

  it("rejects bad values", () => {
    expect(parseEntryInput({ ...valid, type: "Both" })).toBeNull();
    expect(parseEntryInput({ ...valid, label: "" })).toBeNull();
    expect(parseEntryInput({ ...valid, amountCents: 1.2 })).toBeNull();
    expect(parseEntryInput({ ...valid, amountCents: -120 })).toBeNull();
    expect(parseEntryInput({ ...valid, note: null })).toBeNull();
    expect(parseEntryInput(null)).toBeNull();
    expect(parseEntryInput([valid])).toBeNull();
  });

  it("parseEntryInputs rejects empty, oversized, or partly invalid batches", () => {
    expect(parseEntryInputs([valid, valid])).toHaveLength(2);
    expect(parseEntryInputs([])).toBeNull();
    expect(parseEntryInputs(Array.from({ length: MAX_ENTRIES_PER_REQUEST + 1 }, () => valid))).toBeNull();
    expect(parseEntryInputs([valid, { ...valid, amountCents: -1 }])).toBeNull();
    expect(parseEntryInputs(valid)).toBeNull();
  });
});

describe("parseSettingsPatch", () => {
  it("accepts known boolean settings", () => {
    expect(parseSettingsPatch({ compactCards: true })).toEqual({ compactCards: true });
    expect(parseSettingsPatch({ autoCategorise: false, showAudit: true })).toEqual({
      autoCategorise: false,
      showAudit: true,
    });
  });

  it("rejects empty, unknown keys, non-booleans and non-objects", () => {
    expect(parseSettingsPatch({})).toBeNull();
    expect(parseSettingsPatch({ currency: "USD" })).toBeNull();
    expect(parseSettingsPatch({ compactCards: true, userId: "x" })).toBeNull();
    expect(parseSettingsPatch({ compactCards: "true" })).toBeNull();
    expect(parseSettingsPatch([true])).toBeNull();
    expect(parseSettingsPatch(null)).toBeNull();
  });
});

describe("parseInsight (AI reply shape)", () => {
  const valid = { headline: "Nice month", points: [{ title: "Food", text: "Down 10%" }] };

  it("accepts the {headline, points:[{title,text}]} shape", () => {
    expect(parseInsight(valid)).toEqual(valid);
    expect(parseInsight({ headline: "Quiet", points: [] })).toEqual({ headline: "Quiet", points: [] });
  });

  it("rejects extra keys, bad points and too many points", () => {
    expect(parseInsight({ ...valid, extra: 1 })).toBeNull();
    expect(parseInsight({ ...valid, points: [{ title: "Food" }] })).toBeNull();
    expect(parseInsight({ ...valid, points: [{ title: "", text: "x" }] })).toBeNull();
    expect(parseInsight({ ...valid, points: Array.from({ length: 9 }, () => valid.points[0]) })).toBeNull();
    expect(parseInsight({ headline: "", points: [] })).toBeNull();
    expect(parseInsight("Nice month")).toBeNull();
  });
});

describe("parseChatMessages (AI-2 chat history)", () => {
  const user = (content: string) => ({ role: "user", content });
  const assistant = (content: string) => ({ role: "assistant", content });

  it("accepts up to 10 messages ending with the user's question, trimmed", () => {
    expect(parseChatMessages([user(" Hi "), assistant("Hello!"), user("Biggest expense?")])).toEqual([
      { role: "user", content: "Hi" },
      { role: "assistant", content: "Hello!" },
      { role: "user", content: "Biggest expense?" },
    ]);
    const ten = Array.from({ length: 9 }, (_, i) => assistant(`a${i}`)).concat(user("q"));
    expect(parseChatMessages(ten)).toHaveLength(10);
  });

  it("keeps only the last 10 messages", () => {
    const twelve = Array.from({ length: 11 }, (_, i) => assistant(`a${i}`)).concat(user("q"));
    const kept = parseChatMessages(twelve);
    expect(kept).toHaveLength(10);
    expect(kept?.[0]).toEqual({ role: "assistant", content: "a2" });
    expect(kept?.[9]).toEqual({ role: "user", content: "q" });
  });

  it("rejects an empty list or a last message not from the user", () => {
    expect(parseChatMessages([])).toBeNull();
    expect(parseChatMessages([user("q"), assistant("a")])).toBeNull();
  });

  it("rejects bad roles, empty or over-long content, and unknown fields", () => {
    expect(parseChatMessages([{ role: "system", content: "x" }])).toBeNull();
    expect(parseChatMessages([user("   ")])).toBeNull();
    expect(parseChatMessages([user("x".repeat(LIMITS.chatMessage + 1))])).toBeNull();
    expect(parseChatMessages([assistant("x".repeat(LIMITS.chatReply + 1)), user("q")])).toBeNull();
    expect(parseChatMessages([assistant("x".repeat(LIMITS.chatMessage + 1)), user("q")])).toHaveLength(2);
    expect(parseChatMessages([{ role: "user", content: "q", extra: 1 }])).toBeNull();
    expect(parseChatMessages("q")).toBeNull();
  });
});

describe("expense placement (sections and lines)", () => {
  const out = (over: Partial<EntryFormValues> = {}) =>
    form({ type: "Out", category: "", sectionId: "needs", lineId: "groceries", ...over });

  it("saves the section id and line id, and names the category after the line", () => {
    expect(validateEntry(out(), SGD)).toEqual({
      ok: true,
      data: { type: "Out", label: "Kopi", category: "Groceries", amountCents: 120, note: "", sectionId: "needs", lineId: "groceries" },
    });
  });

  it("requires a section and a category for an expense", () => {
    expect(validateEntry(out({ sectionId: "", lineId: "" }), SGD)).toEqual({
      ok: false,
      errors: { section: "Required", category: "Required" },
    });
  });

  it("rejects a category that is not in the chosen section", () => {
    expect(validateEntry(out({ sectionId: "fun", lineId: "rent" }), SGD)).toEqual({
      ok: false,
      errors: { category: "Pick a category from this section" },
    });
  });

  it("ignores any section on income", () => {
    expect(validateEntry(form({ sectionId: "needs", lineId: "rent" }), SGD)).toMatchObject({
      ok: true,
      data: { type: "In", sectionId: null, lineId: null },
    });
  });

  it("parseEntryInput derives the category from the line and rejects mismatches", () => {
    const e = { type: "Out", category: "anything", label: "Rent", amountCents: 80000, note: "", sectionId: "needs", lineId: "rent" };
    expect(parseEntryInput(e)).toMatchObject({ category: "Rent / mortgage", sectionId: "needs", lineId: "rent" });
    expect(parseEntryInput({ ...e, sectionId: "fun" })).toBeNull();
    expect(parseEntryInput({ ...e, lineId: "nope" })).toBeNull();
    expect(parseEntryInput({ ...e, lineId: "rent; drop" })).toBeNull();
  });

  it("parseEntryInput puts an expense with no line under Unassigned", () => {
    const e = { type: "Out", category: "Food", label: "Kopi", amountCents: 120, note: "", sectionId: null, lineId: null };
    expect(parseEntryInput(e)).toMatchObject({ category: "Unassigned", sectionId: null, lineId: null });
  });

  it("parseEntryInput rejects a plan placement on income", () => {
    const e = { type: "In", category: "Work", label: "Pay", amountCents: 100, note: "", sectionId: "needs", lineId: "rent" };
    expect(parseEntryInput(e)).toBeNull();
  });
});

describe("plan line budgets and preferences", () => {
  it("parseLineId accepts only real plan line ids", () => {
    expect(parseLineId("groceries")).toBe("groceries");
    expect(parseLineId("Groceries")).toBeNull();
    expect(parseLineId("nope")).toBeNull();
    expect(parseLineId(null)).toBeNull();
  });

  it("parseLineBudgets needs real line ids and valid cents", () => {
    expect(parseLineBudgets({ rent: 80000, stocks: 0 })).toEqual({ rent: 80000, stocks: 0 });
    expect(parseLineBudgets({ Food: 100 })).toBeNull();
    expect(parseLineBudgets({ rent: -1 })).toBeNull();
    expect(parseLineBudgets({ rent: 1.5 })).toBeNull();
    expect(parseLineBudgets([])).toBeNull();
  });

  it("parsePlanPrefs accepts whole-percent splits and a known carry mode", () => {
    const ok = { split: { needs: 50, invest: 20, fun: 30 }, carryMode: "cum" };
    expect(parsePlanPrefs(ok)).toEqual(ok);
    expect(parsePlanPrefs({ ...ok, carryMode: "last" })).toMatchObject({ carryMode: "last" });
    expect(parsePlanPrefs({ ...ok, carryMode: "weekly" })).toBeNull();
    expect(parsePlanPrefs({ ...ok, split: { ...ok.split, fun: 101 } })).toBeNull();
    expect(parsePlanPrefs({ ...ok, split: { ...ok.split, fun: 2.5 } })).toBeNull();
    expect(parsePlanPrefs({ ...ok, split: { needs: 50, invest: 20 } })).toBeNull();
    expect(parsePlanPrefs({ ...ok, extra: 1 })).toBeNull();
  });
});
