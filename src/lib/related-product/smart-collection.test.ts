import { describe, expect, it } from "vitest";
import {
  formatSmartCollectionSuggestion,
  DEFAULT_SMART_COLLECTION_OPTIONS,
  getSmartCollectionLabels,
  getSmartCollectionRuleBudget,
  getSmartCollectionRows,
  parseSmartCollectionOptions,
  parseSmartCollectionSuggestion,
  previewSmartCollectionTitles,
  SMART_COLLECTION_NOTICE,
  SMART_COLLECTION_ANY_NOTICE,
} from "./smart-collection";
import type { ProductCandidate } from "./types";

const suggestion = {
  categories: [],
  titleIncludes: [
    { match: "all", values: ["Stud", "Earring"] },
    { match: "any", values: ["Diamond", "Topaz"] },
  ],
  titleExcludes: ["Single"],
  notes: ["Check complete pairs in Shopify."],
};

function candidates(names: string[]): ProductCandidate[] {
  return names.map((name, index) => ({
    name, productType: "", description: "", price: "",
    url: `https://shop.example/products/${index}`,
  }));
}

describe("smart collection conditions", () => {
  it("combines contains groups with AND, values with any/all, and individual exclusions", () => {
    const products = candidates([
      "Diamond Stud Earrings", "TOPAZ STUD EARRINGS", "Diamond Pendant",
      "Single Diamond Stud Earring", "Gold Stud Earrings",
    ]);
    const parsed = parseSmartCollectionSuggestion(suggestion);
    const result = previewSmartCollectionTitles(products, parsed);
    expect(result.passed).toEqual(products.slice(0, 2));
    expect(result.excluded).toEqual(products.slice(2));
  });

  it("uses literal substring matching and does not pretend to evaluate categories or stock", () => {
    const products = candidates(["Men's Watch", "Women's Watch", "Neutral Watch", "[Gold] Watch"]);
    const parsed = parseSmartCollectionSuggestion({
      categories: [], titleIncludes: [{ match: "any", values: ["Men"] }],
      titleExcludes: [], notes: [],
    });
    expect(previewSmartCollectionTitles(products, parsed).passed).toEqual(products.slice(0, 2));
    parsed.titleExcludes.push("Women");
    expect(previewSmartCollectionTitles(products, parsed).passed).toEqual([products[0]]);

    parsed.titleIncludes = [{ match: "any", values: ["[Gold]"] }];
    expect(previewSmartCollectionTitles(products, parsed).passed).toEqual([products[3]]);
    parsed.titleIncludes = [];
    parsed.titleExcludes = [];
    expect(previewSmartCollectionTitles(products, parsed)).toEqual({ passed: [], excluded: [], evaluated: false });
    expect(previewSmartCollectionTitles([], parsed)).toEqual({ passed: [], excluded: [], evaluated: false });
  });

  it("uses the same condition rows for display and copy, with fixed Active and stock rules", () => {
    const parsed = parseSmartCollectionSuggestion({
      ...suggestion, titleExcludes: ["Single", "Replacement"],
    });
    const rows = getSmartCollectionRows(parsed);
    const output = formatSmartCollectionSuggestion(parsed);
    expect(rows.filter((row) => row.operator === "doesn’t contain").map((row) => row.values))
      .toEqual([["Single"], ["Replacement"]]);
    expect(rows.slice(-2)).toEqual([
      { field: "Status", operator: "is", values: ["Active"] },
      { field: "Inventory stock", operator: "is greater than", values: ["0"] },
    ]);
    for (const row of rows) {
      expect(output).toContain(`${row.field} → ${row.operator} → ${row.values.map((value) => JSON.stringify(value)).join(", ")}`);
    }
    expect(output).toContain("Products → Match ALL conditions");
    expect(output).toContain("Category condition: omitted");
    expect(rows.some((row) => row.field === "Category")).toBe(false);
    expect(output).toContain(SMART_COLLECTION_NOTICE);
    expect(output).toContain("Check complete pairs in Shopify.");
  });

  it.each([
    { ...suggestion, categories: [false] },
    { ...suggestion, categories: ["  "] },
    { ...suggestion, titleIncludes: [{ match: "none", values: ["Diamond"] }] },
    { ...suggestion, titleIncludes: [{ match: "any", values: [] }] },
    { ...suggestion, titleIncludes: [{ match: "all", values: ["Co"] }] },
    { ...suggestion, titleExcludes: [false] },
    { ...suggestion, status: "Draft" },
    { ...suggestion, titleIncludes: [{ match: "all", values: ["Diamond"], operator: "regex" }] },
    { ...suggestion, notes: ["x".repeat(601)] },
    null,
  ])("rejects unsupported, empty or malformed model conditions: %j", (payload) => {
    expect(() => parseSmartCollectionSuggestion(payload)).toThrow("invalid smart-collection conditions");
  });

  it("enforces Shopify's 60-value limit including the two application-owned conditions", () => {
    const payload = {
      categories: Array.from({ length: 12 }, (_, index) => `Category ${index}`),
      titleIncludes: Array.from({ length: 4 }, (_, group) => ({
        match: "any",
        values: Array.from({ length: 10 }, (_, index) => `Keyword ${group}-${index}`),
      })),
      titleExcludes: Array.from({ length: 6 }, (_, index) => `Excluded ${index}`),
      notes: [],
    };
    const withCategory = { ...DEFAULT_SMART_COLLECTION_OPTIONS, useCategory: true };
    expect(() => parseSmartCollectionSuggestion(payload, withCategory)).not.toThrow();
    payload.titleExcludes.push("One too many");
    expect(() => parseSmartCollectionSuggestion(payload, withCategory)).toThrow("invalid smart-collection conditions");
    const noExtraConditions = { ...withCategory, status: null, inventory: null };
    expect(() => parseSmartCollectionSuggestion(payload, noExtraConditions)).not.toThrow();
    expect(getSmartCollectionRuleBudget(noExtraConditions)).toBe(60);
    expect(getSmartCollectionRuleBudget(DEFAULT_SMART_COLLECTION_OPTIONS)).toBe(58);
  });

  it("normalizes per-client categories and inventory inputs without mutating the defaults", () => {
    const options = parseSmartCollectionOptions({
      ...DEFAULT_SMART_COLLECTION_OPTIONS,
      match: "any",
      includeSubcategories: false,
      status: "Draft",
      inventory: { operator: "is less than", value: " 5 " },
      availableCategories: "  Power Tools\r\nLawn Seeds\npower tools\n\n",
    });
    expect(options).toEqual({
      match: "any", useCategory: false, includeSubcategories: false, status: "Draft",
      inventory: { operator: "is less than", value: 5 },
      availableCategories: ["power tools", "Lawn Seeds"],
    });
    expect(DEFAULT_SMART_COLLECTION_OPTIONS.inventory.value).toBe(0);
    expect(DEFAULT_SMART_COLLECTION_OPTIONS.availableCategories).toEqual([]);
  });

  it.each([
    { match: "none" },
    { useCategory: "yes" },
    { includeSubcategories: "yes" },
    { status: "Unknown status" },
    { inventory: { operator: "at least", value: 5 } },
    { inventory: { operator: "is greater than", value: "" } },
    { inventory: { operator: "is greater than", value: "2.5" } },
    { inventory: { operator: "is greater than", value: Infinity } },
    { inventory: { operator: "is greater than", value: Number.MAX_SAFE_INTEGER + 1 } },
    { availableCategories: [""] },
    { availableCategories: "x".repeat(121) },
    { availableCategories: Array.from({ length: 201 }, (_, index) => `Category ${index}`) },
  ])("rejects invalid client settings: %j", (changes) => {
    expect(() => parseSmartCollectionOptions({ ...DEFAULT_SMART_COLLECTION_OPTIONS, ...changes }))
      .toThrow("Check smart collection settings");
  });

  it("restricts model categories to the client list and preserves the supplied labels", () => {
    const options = parseSmartCollectionOptions({
      ...DEFAULT_SMART_COLLECTION_OPTIONS, useCategory: true, availableCategories: "Lawn Seeds\nSprinklers",
    });
    const payload = { categories: ["lawn seeds"], titleIncludes: [], titleExcludes: [], notes: [] };
    expect(parseSmartCollectionSuggestion(payload, options).categories).toEqual(["Lawn Seeds"]);
    expect(() => parseSmartCollectionSuggestion({ ...payload, categories: ["Earrings"] }, options))
      .toThrow("outside your available categories");
    expect(parseSmartCollectionSuggestion({ ...payload, categories: ["Sprinklers"] }, options).categories)
      .toEqual(["Sprinklers"]);
  });

  it("uses selected matching, subcategory, status and stock values in display and copy", () => {
    const options = parseSmartCollectionOptions({
      ...DEFAULT_SMART_COLLECTION_OPTIONS, useCategory: true, match: "any", includeSubcategories: false,
      status: "Archived", inventory: { operator: "is equal to", value: -1 },
    });
    const parsed = parseSmartCollectionSuggestion({ ...suggestion, categories: ["Earrings"] }, options);
    const rows = getSmartCollectionRows(parsed, options);
    expect(rows.slice(-2)).toEqual([
      { field: "Status", operator: "is", values: ["Archived"] },
      { field: "Inventory stock", operator: "is equal to", values: ["-1"] },
    ]);
    const output = formatSmartCollectionSuggestion(parsed, options);
    const labels = getSmartCollectionLabels(options);
    expect(output).toContain(labels.source);
    expect(output).toContain("Products → Match ANY conditions");
    expect(output).toContain(labels.subcategories);
    expect(output).toContain("Include subcategories: OFF");
    expect(output).toContain(SMART_COLLECTION_ANY_NOTICE);
    for (const row of rows) {
      expect(output).toContain(`${row.field} → ${row.operator} → ${row.values.map((value) => JSON.stringify(value)).join(", ")}`);
    }
    const omitted = formatSmartCollectionSuggestion(parsed, { ...options, status: null, inventory: null });
    expect(omitted).not.toContain("Status →");
    expect(omitted).not.toContain("Inventory stock →");
  });

  it("honors source-level ANY for title conditions, including separate negative rows", () => {
    const parsed = parseSmartCollectionSuggestion({
      categories: [], titleIncludes: [], titleExcludes: ["Women", "Ladies"], notes: [],
    });
    const products = candidates(["Women's Watch", "Ladies Watch", "Women's Ladies Watch", "Neutral Watch"]);
    expect(previewSmartCollectionTitles(products, parsed).passed).toEqual([products[3]]);
    expect(previewSmartCollectionTitles(products, parsed, { ...DEFAULT_SMART_COLLECTION_OPTIONS, match: "any" }).passed)
      .toEqual([products[0], products[1], products[3]]);

    parsed.titleIncludes = [{ match: "any", values: ["Neutral"] }, { match: "all", values: ["Ladies", "Watch"] }];
    parsed.titleExcludes = [];
    expect(previewSmartCollectionTitles(products, parsed).passed).toEqual([]);
    expect(previewSmartCollectionTitles(products, parsed, { ...DEFAULT_SMART_COLLECTION_OPTIONS, match: "any" }).passed)
      .toEqual([products[1], products[2], products[3]]);
  });

  it("makes category opt-in and rejects status/stock-only or overridden category settings", () => {
    expect(DEFAULT_SMART_COLLECTION_OPTIONS.useCategory).toBe(false);
    expect(parseSmartCollectionSuggestion(suggestion).categories).toEqual([]);
    expect(() => parseSmartCollectionSuggestion({ ...suggestion, categories: ["Earrings"] }))
      .toThrow("did not follow your category setting");
    expect(() => parseSmartCollectionSuggestion(suggestion, { ...DEFAULT_SMART_COLLECTION_OPTIONS, useCategory: true }))
      .toThrow("did not follow your category setting");
    expect(() => parseSmartCollectionSuggestion({ ...suggestion, titleIncludes: [], titleExcludes: [] }))
      .toThrow("no category or title conditions");
    const options = { ...DEFAULT_SMART_COLLECTION_OPTIONS, useCategory: true };
    const categoryOnly = parseSmartCollectionSuggestion({
      categories: ["Earrings"], titleIncludes: [], titleExcludes: [], notes: [],
    }, options);
    expect(getSmartCollectionRows(categoryOnly, options)[0]).toEqual({
      field: "Category", operator: "is → any of", values: ["Earrings"],
    });
    expect(formatSmartCollectionSuggestion(categoryOnly, options)).toContain("Include subcategories: ON");
    expect(previewSmartCollectionTitles(candidates(["Diamond Earrings"]), categoryOnly, options))
      .toEqual({ passed: [], excluded: [], evaluated: false });
  });
});
