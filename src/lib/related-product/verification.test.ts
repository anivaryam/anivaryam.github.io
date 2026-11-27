import { afterEach, describe, expect, it, vi } from "vitest";
import { automaticallyVerifyResults, createSmartReviewInput, getReviewSummary, markVerificationIncomplete } from "./verification";
import { DEFAULT_SMART_COLLECTION_OPTIONS, previewSmartCollectionTitles } from "./smart-collection";
import type { ProductReviewInput } from "./types";

afterEach(() => vi.unstubAllGlobals());

const provider = { apiBase: "https://api.example.com/v1", apiKey: "test-key", model: "review-model" };
const products = ["Chenille Wash Mitt", "Chenille Wash Pad", "Seat Cleaner"].map((name, index) => ({
  name, productType: "Supplies", description: `${name} details`, price: "",
  url: `https://shop.example/products/${index}`,
}));
const manual: ProductReviewInput = {
  mode: "manual", draft: "Motorcycle washing with a mitt and seat cleaner.", sourceModel: "matching-model",
  products: products.map((product, index) => ({ product, selected: index !== 2 })),
};
const suggestion = {
  categories: [], titleIncludes: [{ match: "any" as const, values: ["Chenille"] }],
  titleExcludes: [], notes: [],
};
const revised = { ...suggestion, titleIncludes: [{ match: "any" as const, values: ["Chenille Wash Mitt", "Seat Cleaner"] }] };
const smart = {
  suggestion, options: DEFAULT_SMART_COLLECTION_OPTIONS, urls: ["https://shop.example/collections/supplies"],
};
const smartInput = createSmartReviewInput(manual.draft, manual.sourceModel, products, suggestion, smart.options);
const completion = (payload: unknown) => new Response(JSON.stringify({
  choices: [{ message: { content: JSON.stringify(payload) } }],
}), { status: 200 });
const review = (labels: Array<boolean | null>, needsCorrection = false, warnings: string[] = []) => completion({
  assessments: labels.map((related, index) => ({ id: `product-${index + 1}`, related, reason: "Evidence from the supplied draft and product." })),
  warnings, needsCorrection,
});

describe("automatic verification and correction", () => {
  it("applies manual corrections only after both passes agree and returns an audit", async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(review([true, false, true])).mockResolvedValueOnce(review([true, false, true]));
    vi.stubGlobal("fetch", fetchMock);
    const result = await automaticallyVerifyResults(provider, manual);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(result.final.products.map((entry) => entry.selected)).toEqual([true, false, true]);
    expect(manual.products.map((entry) => entry.selected)).toEqual([true, true, false]);
    expect(result.changes).toEqual([
      { label: "Chenille Wash Pad", before: "Related", after: "Unrelated" },
      { label: "Seat Cleaner", before: "Unrelated", after: "Related" },
    ]);
    expect(result.status).toBe("complete");
    expect(result.correctionAttempted).toBe(true);
    expect(result.review && getReviewSummary(result.final, result.review).mismatches).toBe(0);
  });

  it("keeps uncertain or contradictory manual decisions original and stops after one recheck", async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(review([null, false, true])).mockResolvedValueOnce(review([true, true, true]));
    vi.stubGlobal("fetch", fetchMock);
    const result = await automaticallyVerifyResults(provider, manual);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(result.final.products.map((entry) => entry.selected)).toEqual([true, true, true]);
    expect(result.changes).toEqual([{ label: "Seat Cleaner", before: "Unrelated", after: "Related" }]);
    expect(result.uncertainIndices).toEqual([0, 1]);
    expect(result.status).toBe("needs-review");
  });

  it("does not spend a correction call on agreement, uncertainty alone, or generic warnings", async () => {
    const fetchMock = vi.fn().mockResolvedValue(review([true, true, null], false, ["Shopify category assignments are unknown."]));
    vi.stubGlobal("fetch", fetchMock);
    const result = await automaticallyVerifyResults(provider, smartInput, { smart });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(result.correctionAttempted).toBe(false);
    expect(result.changes).toEqual([]);
    expect(result.status).toBe("needs-review");
  });

  it("regenerates smart rules with stable feedback IDs and recomputes matches before applying", async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(review([true, false, true]))
      .mockResolvedValueOnce(completion(revised)).mockResolvedValueOnce(review([true, false, true]));
    vi.stubGlobal("fetch", fetchMock);
    const result = await automaticallyVerifyResults(provider, smartInput, { smart });
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(result.status).toBe("complete");
    expect(result.suggestion).toEqual(revised);
    expect(result.final.products.map((entry) => entry.selected)).toEqual([true, false, true]);
    expect(result.changes).toHaveLength(1);
    expect(previewSmartCollectionTitles(products, result.suggestion!, smart.options).passed.map((product) => product.name))
      .toEqual(["Chenille Wash Mitt", "Seat Cleaner"]);
    const bodies = fetchMock.mock.calls.map((call) => JSON.parse(String(call[1].body)));
    expect(bodies.map((body) => body.model)).toEqual(["review-model", "matching-model", "review-model"]);
    const correction = JSON.parse(bodies[1].messages[1].content);
    expect(correction.clientOptions).toEqual(smart.options);
    expect(correction.feedback.previousSuggestion).toEqual(suggestion);
    expect(correction.samples.map((sample: { id: string }) => sample.id)).toEqual(["product-1", "product-2", "product-3"]);
    expect(correction.feedback.assessments[1].related).toBe(false);
    expect(bodies[1].messages[0].content).toContain("single correction attempt");
    expect(JSON.stringify(bodies)).not.toContain("https://shop.example");
  });

  it("preserves client category/match/status/inventory settings during an actionable rule correction", async () => {
    const options = { ...smart.options, useCategory: true, includeSubcategories: false, status: "Draft" as const, inventory: null, availableCategories: ["Supplies"] };
    const previous = { ...suggestion, categories: ["Supplies"] };
    const corrected = { ...revised, categories: ["Supplies"] };
    const fetchMock = vi.fn().mockResolvedValueOnce(review([true, true, false], true))
      .mockResolvedValueOnce(completion(corrected)).mockResolvedValueOnce(review([true, false, true]));
    vi.stubGlobal("fetch", fetchMock);
    const result = await automaticallyVerifyResults(provider, createSmartReviewInput(manual.draft, manual.sourceModel, products, previous, options), {
      smart: { ...smart, suggestion: previous, options },
    });
    // A later change of opinion cannot erase the initial review's definite evidence.
    expect(result.status).toBe("needs-review");
    expect(result.suggestion).toEqual(previous);
    expect(result.changes).toEqual([]);
    const data = JSON.parse(JSON.parse(String(fetchMock.mock.calls[1][1].body)).messages[1].content);
    expect(data.clientOptions).toEqual(options);
  });

  it("corrects an actionable rule risk even when sampled title decisions already agree", async () => {
    const tighter = { ...suggestion, titleIncludes: [{ match: "any" as const, values: ["Chenille Wash"] }] };
    const fetchMock = vi.fn().mockResolvedValueOnce(review([true, true, false], true))
      .mockResolvedValueOnce(completion(tighter)).mockResolvedValueOnce(review([true, true, false]));
    vi.stubGlobal("fetch", fetchMock);
    const result = await automaticallyVerifyResults(provider, smartInput, { smart });
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(result.suggestion).toEqual(tighter);
    expect(result.status).toBe("complete");
    expect(result.changes).toHaveLength(1);
  });

  it("does not treat removing all title evidence as fixing definite mismatches", async () => {
    const options = { ...smart.options, useCategory: true };
    const previous = { ...suggestion, categories: ["Supplies"] };
    const fetchMock = vi.fn().mockResolvedValueOnce(review([true, false, true]))
      .mockResolvedValueOnce(completion({ ...previous, titleIncludes: [] }))
      .mockResolvedValueOnce(review([true, false, true]));
    vi.stubGlobal("fetch", fetchMock);
    const result = await automaticallyVerifyResults(provider, createSmartReviewInput(manual.draft, manual.sourceModel, products, previous, options), {
      smart: { ...smart, suggestion: previous, options },
    });
    expect(result.suggestion).toEqual(previous);
    expect(result.status).toBe("needs-review");
    expect(result.changes).toEqual([]);
  });

  it("surfaces conflicting or uncertain recheck evidence even when smart corrections are rejected", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValueOnce(review([true, false, true]))
      .mockResolvedValueOnce(completion(revised)).mockResolvedValueOnce(review([true, true, null])));
    const result = await automaticallyVerifyResults(provider, smartInput, { smart });
    expect(result.suggestion).toEqual(suggestion);
    expect(result.status).toBe("needs-review");
    expect(result.uncertainIndices).toEqual([1, 2]);
    expect(result.changes).toEqual([]);
  });

  it.each(["same rules", "recheck disagrees", "initial evidence disagrees"])("retains original smart rules when %s", async (scenario) => {
    const wrong = { ...suggestion, titleIncludes: [{ match: "any" as const, values: ["Chenille Wash Pad"] }] };
    const fetchMock = vi.fn().mockResolvedValueOnce(review([true, false, true]))
      .mockResolvedValueOnce(completion(scenario === "same rules" ? suggestion : scenario === "initial evidence disagrees" ? wrong : revised))
      .mockResolvedValueOnce(review(scenario === "initial evidence disagrees" ? [false, true, false] : [true, false, false]));
    vi.stubGlobal("fetch", fetchMock);
    const result = await automaticallyVerifyResults(provider, smartInput, { smart });
    expect(fetchMock).toHaveBeenCalledTimes(scenario === "same rules" ? 2 : 3);
    expect(result.suggestion).toEqual(suggestion);
    expect(result.final).toBe(smartInput);
    expect(result.status).toBe("needs-review");
    expect(result.changes).toEqual([]);
    expect(result.message).toContain("Original rules retained");
  });

  it.each(["initial review", "correction", "recheck"])("rolls back the whole correction if %s fails", async (stage) => {
    const broken = completion({ invalid: true });
    const fetchMock = vi.fn();
    if (stage !== "initial review") fetchMock.mockResolvedValueOnce(review([true, false, true]));
    if (stage === "recheck") fetchMock.mockResolvedValueOnce(completion(revised));
    fetchMock.mockResolvedValueOnce(broken);
    vi.stubGlobal("fetch", fetchMock);
    const result = await automaticallyVerifyResults(provider, smartInput, { smart });
    expect(result.status).toBe("incomplete");
    expect(result.final).toBe(smartInput);
    expect(result.changes).toEqual([]);
    expect(result.review).toBeNull();
    expect(result.message).toBeTruthy();
    expect(fetchMock).toHaveBeenCalledTimes(stage === "initial review" ? 1 : stage === "correction" ? 2 : 3);
  });

  it("rejects a correction that changes disabled categories or adds unsupported status fields", async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(review([true, false, true]))
      .mockResolvedValueOnce(completion({ ...revised, status: "Archived" }));
    vi.stubGlobal("fetch", fetchMock);
    const result = await automaticallyVerifyResults(provider, smartInput, { smart });
    expect(result.status).toBe("incomplete");
    expect(result.changes).toEqual([]);
    expect(result.message).toContain("invalid smart-collection conditions");
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("marks empty or cancelled work incomplete without requests, and stops cancellation before the recheck", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    expect((await automaticallyVerifyResults(provider, { ...smartInput, products: [] }, { smart })).status).toBe("incomplete");
    const cancelled = new AbortController();
    cancelled.abort();
    expect((await automaticallyVerifyResults(provider, manual, { signal: cancelled.signal })).status).toBe("incomplete");
    expect(fetchMock).not.toHaveBeenCalled();
    fetchMock.mockResolvedValueOnce(review([true, false, true]));
    const controller = new AbortController();
    const result = await automaticallyVerifyResults(provider, manual, {
      signal: controller.signal,
      onProgress: (phase) => { if (phase === "rechecking") controller.abort(); },
    });
    expect(result.status).toBe("incomplete");
    expect(result.final).toBe(manual);
    expect(result.changes).toEqual([]);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("rechecks all batches with exact IDs before applying even the last product's correction", async () => {
    const fetchMock = vi.fn(async (_url, init) => {
      const data = JSON.parse(JSON.parse(init.body).messages[1].content);
      return completion({
        assessments: data.products.reverse().map((product: { id: string }) => ({
          id: product.id, related: product.id !== "product-31", reason: "Supplied evidence.",
        })),
        warnings: [], needsCorrection: false,
      });
    });
    vi.stubGlobal("fetch", fetchMock);
    const result = await automaticallyVerifyResults(provider, {
      ...manual, products: Array.from({ length: 31 }, () => manual.products[0]),
    });
    expect(fetchMock).toHaveBeenCalledTimes(4);
    expect(result.final.products[30].selected).toBe(false);
    expect(result.review?.assessments).toHaveLength(31);
    expect(result.changes).toHaveLength(1);
  });

  it("discarding a completed report after cancellation restores its original output", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValueOnce(review([true, false, true])).mockResolvedValueOnce(review([true, false, true])));
    const completed = await automaticallyVerifyResults(provider, manual);
    const discarded = markVerificationIncomplete(completed, "Request cancelled.");
    expect(discarded.final).toBe(manual);
    expect(discarded.changes).toEqual([]);
    expect(discarded.review).toBeNull();
    expect(discarded.status).toBe("incomplete");
  });
});
