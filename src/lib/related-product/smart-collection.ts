import { z } from "zod";
import type { ProductCandidate } from "./types";

export const SMART_COLLECTION_NOTICE = "Suggestions only. Confirm category labels in Shopify. The preview checks sampled titles only; category, status and inventory are not verified. Rules apply store-wide, not just within the submitted collections. Review Shopify’s matching-product preview before saving.";

interface ConditionRow {
  field: string;
  operator: string;
  values: string[];
}

const fixedConditions: ConditionRow[] = [
  { field: "Status", operator: "is", values: ["Active"] },
  { field: "Inventory stock", operator: "is greater than", values: ["0"] },
];

const keyword = z.string().trim().min(3).max(120);
const suggestionSchema = z.object({
  categories: z.array(z.string().trim().min(1).max(120)).min(1).max(12),
  titleIncludes: z.array(z.object({
    match: z.enum(["any", "all"]),
    values: z.array(keyword).min(1).max(12),
  }).strict()).max(4),
  titleExcludes: z.array(keyword).max(12),
  notes: z.array(z.string().trim().min(1).max(600)).max(6),
}).strict().refine((suggestion) => (
  suggestion.categories.length
  + suggestion.titleIncludes.reduce((count, group) => count + group.values.length, 0)
  + suggestion.titleExcludes.length
  + fixedConditions.reduce((count, row) => count + row.values.length, 0)
  <= 60
), "A Products source supports at most 60 condition values.");

export type SmartCollectionSuggestion = z.infer<typeof suggestionSchema>;

export function parseSmartCollectionSuggestion(payload: unknown): SmartCollectionSuggestion {
  const result = suggestionSchema.safeParse(payload);
  if (!result.success) {
    throw new Error("The selected model returned invalid smart-collection conditions. Try another model.");
  }
  return result.data;
}

export function getSmartCollectionRows(suggestion: SmartCollectionSuggestion): ConditionRow[] {
  return [
    { field: "Category", operator: "is → any of", values: suggestion.categories },
    ...suggestion.titleIncludes.map((group) => ({
      field: "Title",
      operator: `contains → ${group.match} of`,
      values: group.values,
    })),
    // Each exclusion is its own AND condition, avoiding ambiguous negative any/all grouping.
    ...suggestion.titleExcludes.map((value) => ({
      field: "Title", operator: "doesn’t contain", values: [value],
    })),
    ...fixedConditions,
  ];
}

export function previewSmartCollectionTitles(
  products: ProductCandidate[],
  suggestion: SmartCollectionSuggestion,
): { passed: ProductCandidate[]; excluded: ProductCandidate[] } {
  const passed: ProductCandidate[] = [];
  const excluded: ProductCandidate[] = [];
  for (const product of products) {
    const title = product.name.toLowerCase();
    const includes = suggestion.titleIncludes.every((group) => {
      const matches = (value: string) => title.includes(value.toLowerCase());
      return group.match === "all" ? group.values.every(matches) : group.values.some(matches);
    });
    const excludes = suggestion.titleExcludes.some((value) => title.includes(value.toLowerCase()));
    (includes && !excludes ? passed : excluded).push(product);
  }
  return { passed, excluded };
}

export function formatSmartCollectionSuggestion(suggestion: SmartCollectionSuggestion): string {
  return [
    "Products → Match ALL conditions",
    "Include subcategories: ON",
    ...getSmartCollectionRows(suggestion).map((row) => (
      `${row.field} → ${row.operator} → ${row.values.map((value) => JSON.stringify(value)).join(", ")}`
    )),
    "",
    SMART_COLLECTION_NOTICE,
    ...(suggestion.notes.length > 0 ? ["", "Review notes:", ...suggestion.notes.map((note) => `- ${note}`)] : []),
  ].join("\n");
}
