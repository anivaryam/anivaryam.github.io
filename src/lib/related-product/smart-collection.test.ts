import { describe, expect, it } from "vitest";
import {
  formatSmartCollectionSuggestion,
  getSmartCollectionRows,
  parseSmartCollectionSuggestion,
  previewSmartCollectionTitles,
  SMART_COLLECTION_NOTICE,
} from "./smart-collection";
import type { ProductCandidate } from "./types";

const suggestion = {
  categories: ["Earrings"],
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
      categories: ["Watches"], titleIncludes: [{ match: "any", values: ["Men"] }],
      titleExcludes: [], notes: [],
    });
    expect(previewSmartCollectionTitles(products, parsed).passed).toEqual(products.slice(0, 2));
    parsed.titleExcludes.push("Women");
    expect(previewSmartCollectionTitles(products, parsed).passed).toEqual([products[0]]);

    parsed.titleIncludes = [{ match: "any", values: ["[Gold]"] }];
    expect(previewSmartCollectionTitles(products, parsed).passed).toEqual([products[3]]);
    parsed.titleIncludes = [];
    parsed.titleExcludes = [];
    expect(previewSmartCollectionTitles(products, parsed).passed).toEqual(products);
    expect(previewSmartCollectionTitles([], parsed)).toEqual({ passed: [], excluded: [] });
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
    expect(output).toContain("Include subcategories: ON");
    expect(output).toContain(SMART_COLLECTION_NOTICE);
    expect(output).toContain("Check complete pairs in Shopify.");
  });

  it.each([
    { ...suggestion, categories: [] },
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
    expect(() => parseSmartCollectionSuggestion(payload)).not.toThrow();
    payload.titleExcludes.push("One too many");
    expect(() => parseSmartCollectionSuggestion(payload)).toThrow("invalid smart-collection conditions");
  });
});
