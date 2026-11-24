import { z } from "zod";
import type { ProductCandidate } from "./types";

export const SMART_COLLECTION_NOTICE = "Suggestions only. Confirm category labels in Shopify. The preview checks sampled titles only; category, status and inventory are not verified. Rules apply store-wide, not just within the submitted collections. Review Shopify’s matching-product preview before saving.";
export const SMART_COLLECTION_ANY_NOTICE = "Match ANY lets a category, title, status or stock condition independently qualify a product. Title-only nonmatches may still be included. Use ALL when every filter must apply.";
export const SMART_COLLECTION_STATUSES = ["Active", "Draft", "Archived", "Unlisted"] as const;
export const SMART_INVENTORY_OPERATORS = ["is greater than", "is less than", "is equal to", "is not equal to"] as const;
export const MAX_SMART_COLLECTION_VALUES = 60;

interface ConditionRow {
  field: string;
  operator: string;
  values: string[];
}

const categoryLabel = z.string().trim().min(1).max(120);
const categoryList = z.array(categoryLabel).max(200);
const stockNumber = z.number().int().safe();
const optionsSchema = z.object({
  match: z.enum(["all", "any"]),
  includeSubcategories: z.boolean(),
  status: z.enum(SMART_COLLECTION_STATUSES).nullable(),
  inventory: z.object({
    operator: z.enum(SMART_INVENTORY_OPERATORS),
    value: z.union([stockNumber, z.string().trim().min(1).transform(Number).pipe(stockNumber)]),
  }).strict().nullable(),
  availableCategories: z.union([
    categoryList,
    z.string().transform((text) => text.split("\n").map((line) => line.trim()).filter(Boolean)).pipe(categoryList),
  ]).transform((categories) => [...new Map(categories.map((value) => [value.toLowerCase(), value])).values()]),
}).strict();

export type SmartCollectionOptions = z.output<typeof optionsSchema>;
export type SmartCollectionOptionsInput = z.input<typeof optionsSchema>;

export const DEFAULT_SMART_COLLECTION_OPTIONS: SmartCollectionOptions = {
  match: "all",
  includeSubcategories: true,
  status: "Active",
  inventory: { operator: "is greater than", value: 0 },
  availableCategories: [],
};

export function parseSmartCollectionOptions(payload: unknown): SmartCollectionOptions {
  const result = optionsSchema.safeParse(payload);
  if (!result.success) {
    throw new Error("Check smart collection settings: use valid options, a whole-number stock value, and at most 200 category labels of 1–120 characters.");
  }
  return result.data;
}

function getAdditionalConditions(options: SmartCollectionOptions): ConditionRow[] {
  return [
    ...(options.status === null ? [] : [{ field: "Status", operator: "is", values: [options.status] }]),
    ...(options.inventory === null ? [] : [{
      field: "Inventory stock",
      operator: options.inventory.operator,
      values: [String(options.inventory.value)],
    }]),
  ];
}

export function getSmartCollectionRuleBudget(options: SmartCollectionOptions): number {
  return MAX_SMART_COLLECTION_VALUES - getAdditionalConditions(options).length;
}

export function getSmartCollectionLabels(options: SmartCollectionOptions) {
  return {
    source: `Products → Match ${options.match.toUpperCase()} conditions`,
    subcategories: `Include subcategories: ${options.includeSubcategories ? "ON" : "OFF"}`,
  };
}

const keyword = z.string().trim().min(3).max(120);
const suggestionSchema = z.object({
  categories: z.array(categoryLabel).min(1).max(12),
  titleIncludes: z.array(z.object({
    match: z.enum(["any", "all"]),
    values: z.array(keyword).min(1).max(12),
  }).strict()).max(4),
  titleExcludes: z.array(keyword).max(12),
  notes: z.array(z.string().trim().min(1).max(600)).max(6),
}).strict();

export type SmartCollectionSuggestion = z.infer<typeof suggestionSchema>;

export function parseSmartCollectionSuggestion(
  payload: unknown,
  options: SmartCollectionOptions = DEFAULT_SMART_COLLECTION_OPTIONS,
): SmartCollectionSuggestion {
  const result = suggestionSchema.safeParse(payload);
  if (!result.success) {
    throw new Error("The selected model returned invalid smart-collection conditions. Try another model.");
  }
  if (options.availableCategories.length > 0) {
    const allowed = new Map(options.availableCategories.map((value) => [value.toLowerCase(), value]));
    result.data.categories = result.data.categories.map((value) => {
      const category = allowed.get(value.toLowerCase());
      if (!category) throw new Error("The model suggested a category outside your available categories. Review the list or try again.");
      return category;
    });
  }
  if (getSmartCollectionRows(result.data, options).reduce((count, row) => count + row.values.length, 0) > MAX_SMART_COLLECTION_VALUES) {
    throw new Error("The selected model returned invalid smart-collection conditions. A Products source supports at most 60 condition values.");
  }
  return result.data;
}

export function getSmartCollectionRows(
  suggestion: SmartCollectionSuggestion,
  options: SmartCollectionOptions = DEFAULT_SMART_COLLECTION_OPTIONS,
): ConditionRow[] {
  return [
    { field: "Category", operator: "is → any of", values: suggestion.categories },
    ...suggestion.titleIncludes.map((group) => ({
      field: "Title",
      operator: `contains → ${group.match} of`,
      values: group.values,
    })),
    // Separate rows make the selected source-level ALL/ANY behavior explicit.
    ...suggestion.titleExcludes.map((value) => ({
      field: "Title", operator: "doesn’t contain", values: [value],
    })),
    ...getAdditionalConditions(options),
  ];
}

export function previewSmartCollectionTitles(
  products: ProductCandidate[],
  suggestion: SmartCollectionSuggestion,
  options: SmartCollectionOptions = DEFAULT_SMART_COLLECTION_OPTIONS,
): { passed: ProductCandidate[]; excluded: ProductCandidate[] } {
  const passed: ProductCandidate[] = [];
  const excluded: ProductCandidate[] = [];
  for (const product of products) {
    const title = product.name.toLowerCase();
    const conditions = suggestion.titleIncludes.map((group) => {
      const matches = (value: string) => title.includes(value.toLowerCase());
      return group.match === "all" ? group.values.every(matches) : group.values.some(matches);
    });
    conditions.push(...suggestion.titleExcludes.map((value) => !title.includes(value.toLowerCase())));
    const matches = conditions.length === 0 || (
      options.match === "all" ? conditions.every(Boolean) : conditions.some(Boolean)
    );
    (matches ? passed : excluded).push(product);
  }
  return { passed, excluded };
}

export function formatSmartCollectionSuggestion(
  suggestion: SmartCollectionSuggestion,
  options: SmartCollectionOptions = DEFAULT_SMART_COLLECTION_OPTIONS,
): string {
  const labels = getSmartCollectionLabels(options);
  return [
    labels.source,
    labels.subcategories,
    ...getSmartCollectionRows(suggestion, options).map((row) => (
      `${row.field} → ${row.operator} → ${row.values.map((value) => JSON.stringify(value)).join(", ")}`
    )),
    "",
    SMART_COLLECTION_NOTICE,
    ...(options.match === "any" ? ["", SMART_COLLECTION_ANY_NOTICE] : []),
    ...(suggestion.notes.length > 0 ? ["", "Review notes:", ...suggestion.notes.map((note) => `- ${note}`)] : []),
  ].join("\n");
}
