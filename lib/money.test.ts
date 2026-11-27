import { describe, expect, it } from "vitest";
import {
  BASE_CURRENCY,
  CURRENCIES,
  centsToInput,
  currencyLabel,
  displayToCents,
  formatMoney,
  inputToCents,
  isCurrencyCode,
  prefilledInputToCents,
  resolveCurrency,
  toCents,
} from "@/lib/money";

const USD = resolveCurrency("USD");
const GBP = resolveCurrency("GBP");
const INR = resolveCurrency("INR");

describe("currencies", () => {
  it("has the default rates from CLAUDE.md §6", () => {
    expect(Object.fromEntries(CURRENCIES.map((c) => [c.code, c.rate]))).toEqual({
      SGD: 1,
      USD: 0.77,
      INR: 66.5,
      MYR: 3.3,
      EUR: 0.67,
      GBP: 0.58,
    });
  });

  it("recognises supported codes only", () => {
    expect(isCurrencyCode("GBP")).toBe(true);
    expect(isCurrencyCode("gbp")).toBe(false);
    expect(isCurrencyCode("JPY")).toBe(false);
  });

  it("labels options as symbol + code", () => {
    expect(currencyLabel(BASE_CURRENCY)).toBe("S$ SGD");
    expect(currencyLabel(INR)).toBe("₹ INR");
  });
});

describe("resolveCurrency", () => {
  it("uses a positive user override", () => {
    expect(resolveCurrency("USD", { USD: 0.8 }).rate).toBe(0.8);
  });

  it("ignores zero or negative overrides", () => {
    expect(resolveCurrency("USD", { USD: 0 }).rate).toBe(0.77);
    expect(resolveCurrency("USD", { USD: -1 }).rate).toBe(0.77);
  });

  it("never overrides SGD", () => {
    expect(resolveCurrency("SGD", { SGD: 2 }).rate).toBe(1);
  });
});

describe("formatMoney", () => {
  it("formats SGD cents with grouping and 2 decimals", () => {
    expect(formatMoney(123450)).toBe("S$1,234.50");
    expect(formatMoney(0)).toBe("S$0.00");
    expect(formatMoney(100000000)).toBe("S$1,000,000.00");
  });

  it("uses a true minus sign (U+2212) for negatives", () => {
    expect(formatMoney(-1200)).toBe("−S$12.00");
    expect(formatMoney(-1)).toBe("−S$0.01");
  });

  it("converts to the display currency", () => {
    expect(formatMoney(10000, USD)).toBe("US$77.00");
    expect(formatMoney(100, INR)).toBe("₹66.50");
    expect(formatMoney(-18942, GBP)).toBe("−£109.86");
  });
});

describe("centsToInput / inputToCents", () => {
  it("pre-fills 2 decimals without symbol or grouping", () => {
    expect(centsToInput(123450)).toBe("1234.50");
    expect(centsToInput(101, GBP)).toBe("0.59");
  });

  it("parses typed amounts to SGD cents", () => {
    expect(inputToCents("12.34")).toBe(1234);
    expect(inputToCents("  7 ")).toBe(700);
    expect(inputToCents("0")).toBe(0);
    expect(inputToCents("19.99")).toBe(1999);
  });

  it("divides by the rate for other currencies", () => {
    expect(inputToCents("77", USD)).toBe(10000);
    expect(inputToCents("66.5", INR)).toBe(100);
  });

  it("rejects empty, non-numeric and negative input", () => {
    expect(inputToCents("")).toBeNull();
    expect(inputToCents("   ")).toBeNull();
    expect(inputToCents("abc")).toBeNull();
    expect(inputToCents("12,50")).toBeNull();
    expect(inputToCents("-1")).toBeNull();
    expect(inputToCents("Infinity")).toBeNull();
  });
});

describe("prefilledInputToCents (edit-form drift guard)", () => {
  const prefilled = { input: centsToInput(101, GBP), cents: 101 };

  it("round-tripping a rate below 1 would drift by a cent", () => {
    expect(inputToCents(prefilled.input, GBP)).toBe(102);
  });

  it("keeps the stored cents while the pre-filled text is unchanged", () => {
    expect(prefilledInputToCents("0.59", GBP, prefilled)).toBe(101);
    expect(prefilledInputToCents(" 0.59 ", GBP, prefilled)).toBe(101);
  });

  it("converts once the user changes the text", () => {
    expect(prefilledInputToCents("1.16", GBP, prefilled)).toBe(200);
    expect(prefilledInputToCents("", GBP, prefilled)).toBeNull();
  });

  it("behaves like inputToCents without a pre-filled value", () => {
    expect(prefilledInputToCents("0.59", GBP)).toBe(102);
  });
});

describe("toCents", () => {
  it("rounds decimal amounts to whole cents", () => {
    expect(toCents(151.96)).toBe(15196);
    expect(toCents(0.29)).toBe(29);
    expect(toCents(3299.25)).toBe(329925);
  });
});

describe("displayToCents (AI amounts)", () => {
  it("converts a display-currency number to SGD cents with the input rule", () => {
    expect(displayToCents(12.34, BASE_CURRENCY)).toBe(1234);
    expect(displayToCents(77, USD)).toBe(10000); // 77 / 0.77
    expect(displayToCents(0, USD)).toBe(0);
  });

  it("rejects negative, non-finite and non-number values", () => {
    expect(displayToCents(-1, BASE_CURRENCY)).toBeNull();
    expect(displayToCents(Number.NaN, BASE_CURRENCY)).toBeNull();
    expect(displayToCents(Number.POSITIVE_INFINITY, BASE_CURRENCY)).toBeNull();
    expect(displayToCents("12", BASE_CURRENCY)).toBeNull();
  });
});
