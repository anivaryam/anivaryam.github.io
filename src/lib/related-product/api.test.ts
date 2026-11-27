import { afterEach, describe, expect, it, vi } from "vitest";
import {
  buildMinorityResult,
  classifyProducts,
  fetchAvailableModels,
  formatMinorityResult,
  groupProductsBySource,
  normalizeApiBase,
  suggestSmartCollection,
  verifyProductResults,
} from "./api";
import type { ProductCandidate, ProductReviewInput } from "./types";
import { DEFAULT_SMART_COLLECTION_OPTIONS, parseSmartCollectionOptions } from "./smart-collection";

const products: ProductCandidate[] = [
  { name: "Cash Acceptor", productType: "Bill acceptor", description: "Accepts bills.", price: "", url: "https://shop.example/products/cash-acceptor", foundVia: ["https://shop.example/collections/acceptors"] },
  { name: "Card Reader", productType: "Card reader", description: "Accepts cards.", price: "", url: "https://shop.example/products/card-reader", foundVia: ["https://shop.example/collections/readers"] },
];

afterEach(() => vi.unstubAllGlobals());

describe("related product API", () => {
  it("groups products by every submitted URL without duplicating repeated sources", () => {
    const first = { ...products[0], foundVia: ["https://shop.example/first", "https://shop.example/second", "https://shop.example/first"] };
    const second = { ...products[1], foundVia: ["https://shop.example/second"] };
    expect(groupProductsBySource([first, second])).toEqual([
      { sourceUrl: "https://shop.example/first", products: [first] },
      { sourceUrl: "https://shop.example/second", products: [first, second] },
    ]);
    expect(groupProductsBySource([])).toEqual([]);
    expect(groupProductsBySource([{ ...products[0], foundVia: [] }])).toEqual([
      { sourceUrl: null, products: [{ ...products[0], foundVia: [] }] },
    ]);
  });

  it("normalizes API roots and rejects insecure or credential-bearing URLs", () => {
    expect(normalizeApiBase("https://api.example.com/v1/")).toBe("https://api.example.com/v1");
    expect(() => normalizeApiBase("http://api.example.com/v1")).toThrow("must use HTTPS");
    expect(() => normalizeApiBase("https://user:pass@api.example.com/v1")).toThrow("must use HTTPS");
  });

  it("loads model ids with bearer authentication without choosing a model", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      data: [
        { id: "model-b", owned_by: "provider" },
        { id: "model-a", owned_by: "provider" },
        { id: "model-a", owned_by: "provider" },
      ],
    }), { status: 200, headers: { "Content-Type": "application/json" } }));
    vi.stubGlobal("fetch", fetchMock);

    const models = await fetchAvailableModels("https://api.example.com/v1", "key");

    expect(fetchMock.mock.calls[0][0]).toBe("https://api.example.com/v1/models");
    expect(fetchMock.mock.calls[0][1].headers.Authorization).toBe("Bearer key");
    expect(models.map((model) => model.id)).toEqual(["model-a", "model-b"]);
  });

  it("requires exact classifications for every product and does not send product URLs", async () => {
    const fetchMock = vi.fn().mockImplementation(async (_url: string, init: RequestInit) => {
      const body = JSON.parse(String(init.body));
      const input = JSON.parse(body.messages[1].content);
      return new Response(JSON.stringify({
        choices: [{
          message: {
            content: JSON.stringify({
              classifications: input.products.map((product: { id: string }) => ({
                id: product.id,
                related: product.id === "product-1",
              })),
            }),
          },
        }],
      }), { status: 200, headers: { "Content-Type": "application/json" } });
    });
    vi.stubGlobal("fetch", fetchMock);

    const decisions = await classifyProducts(
      "https://api.example.com/v1",
      "key",
      "model-a",
      "Draft text",
      products,
    );

    expect(decisions).toEqual([
      { id: "product-1", related: true },
      { id: "product-2", related: false },
    ]);
    expect(String(fetchMock.mock.calls[0][1].body)).not.toContain("https://shop.example");
  });

  it("formats all-related, all-unrelated, small unrelated lists, and the minority result", () => {
    const formatResult = (items: ProductCandidate[], related: boolean[]) => formatMinorityResult(
      buildMinorityResult(items, related.map((isRelated, index) => ({
        id: `product-${index + 1}`,
        related: isRelated,
      }))),
    );

    expect(formatMinorityResult(
      buildMinorityResult([products[0]], [{ id: "product-1", related: true }]),
    )).toBe("All related");
    expect(formatMinorityResult(
      buildMinorityResult([products[0]], [{ id: "product-1", related: false }]),
    )).toBe("All unrelated");
    expect(formatResult(
      [
        { ...products[0], name: "Relevant" },
        {
          ...products[1],
          name: "Other",
          foundVia: [
            "https://shop.example/collections/other",
            "https://shop.example/collections/accessories",
          ],
        },
      ],
      [true, false],
    )).toBe(
      "Unrelated Product\n\n"
      + "Submitted URL: https://shop.example/collections/other\n"
      + "- Other\n\n"
      + "Submitted URL: https://shop.example/collections/accessories\n"
      + "- Other",
    );

    const names = Array.from({ length: 12 }, (_, index) => `Product ${index + 1}`);
    const candidates = names.map((name, index) => ({
      ...products[0],
      name,
      foundVia: [`https://shop.example/collections/${index + 1}`],
    }));
    expect(formatResult(candidates, names.map((_, index) => index < 2))).toBe(
      "Related Product\n\n"
      + "Submitted URL: https://shop.example/collections/1\n"
      + "- Product 1\n\n"
      + "Submitted URL: https://shop.example/collections/2\n"
      + "- Product 2",
    );
  });

  it("suggests one source using the chosen model, draft and bounded sample data without sending URLs", async () => {
    const conditions = {
      categories: [], titleIncludes: [], titleExcludes: ["Women", "Ladies", "Lady"],
      notes: ["Check gender-neutral titles and vintage age in the listing."],
    };
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      choices: [{ message: { content: `\`\`\`json\n${JSON.stringify(conditions)}\n\`\`\`` } }],
    }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    const result = await suggestSmartCollection(
      "https://api.example.com/v1", "secret-key", "chosen-model", "Men's watch gift draft",
      ["https://shop.example/collections/mens-watches?private=query"],
      [{ ...products[0], name: "Neutral Watch", description: "x".repeat(500) }],
    );
    expect(result).toEqual(conditions);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://api.example.com/v1/chat/completions");
    expect(init.headers.Authorization).toBe("Bearer secret-key");
    const body = JSON.parse(String(init.body));
    expect(body.model).toBe("chosen-model");
    expect(body.messages[0].content).toContain("ONE Products source with Match ALL");
    expect(body.messages[0].content).toContain("Men matches inside Women");
    expect(body.messages[0].content).toContain("untrusted data");
    expect(body.messages[0].content).toContain("Category is disabled");
    expect(JSON.parse(body.messages[1].content)).toEqual({
      draft: "Men's watch gift draft",
      clientOptions: DEFAULT_SMART_COLLECTION_OPTIONS,
      collectionPaths: ["/collections/mens-watches"],
      samples: [{ name: "Neutral Watch", type: products[0].productType, description: "x".repeat(300) }],
    });
    expect(init.body).not.toContain("secret-key");
    expect(init.body).not.toContain("https://shop.example");
    expect(init.body).not.toContain("private=query");
  });

  it.each([
    { content: "not json", error: "valid JSON" },
    { content: JSON.stringify({ categories: ["Watches"], titleIncludes: [], titleExcludes: [], notes: [], vendor: "Rolex" }), error: "invalid smart-collection conditions" },
    { content: "null", error: "invalid smart-collection conditions" },
  ])("rejects invalid smart suggestions: $content", async ({ content, error }) => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({
      choices: [{ message: { content } }],
    }), { status: 200 })));
    await expect(suggestSmartCollection(
      "https://api.example.com/v1", "key", "chosen-model", "Draft", [], [],
    )).rejects.toThrow(error);
  });

  it("redacts the key from smart suggestion provider errors", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({
      error: { message: "Invalid secret-key" },
    }), { status: 401 })));
    await expect(suggestSmartCollection(
      "https://api.example.com/v1", "secret-key", "model", "Draft", [], [],
    )).rejects.toThrow("Provider error (401): Invalid [redacted]");
  });

  it("sends selected client options and rejects categories outside the client's list", async () => {
    const options = parseSmartCollectionOptions({
      ...DEFAULT_SMART_COLLECTION_OPTIONS, useCategory: true, match: "any", includeSubcategories: false,
      status: "Draft", inventory: null, availableCategories: "Lawn Seeds\nSprinklers",
    });
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      choices: [{ message: { content: JSON.stringify({
        categories: ["Earrings"], titleIncludes: [], titleExcludes: [], notes: [],
      }) } }],
    }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    await expect(suggestSmartCollection(
      "https://api.example.com/v1", "key", "chosen-model", "A lawn-care draft", [], [], undefined, options,
    )).rejects.toThrow("outside your available categories");
    const request = JSON.parse(String(fetchMock.mock.calls[0][1].body));
    expect(JSON.parse(request.messages[1].content).clientOptions).toEqual(options);
    expect(request.messages[0].content).toContain("Match ANY conditions");
    expect(request.messages[0].content).toContain("combined with OR");
    expect(request.messages[0].content).toContain("total at most 59");
    expect(request.messages[0].content).toContain("ONLY from that exact list");
    expect(request.messages[0].content).not.toContain("application adds Status is Active");
  });
});

const reviewInput: ProductReviewInput = {
  mode: "manual", draft: "A draft about vending machine payments.", sourceModel: "first-model",
  products: products.map((product, index) => ({ product, selected: index === 0 })),
};

function reviewResponse(assessments: unknown, warnings: unknown = []) {
  return new Response(JSON.stringify({
    choices: [{ message: { content: JSON.stringify({ assessments, warnings }) } }],
  }), { status: 200 });
}

describe("AI result verification API", () => {
  it("reviews both selections in a separate chosen-model request and orders evidence by exact IDs", async () => {
    const fetchMock = vi.fn().mockResolvedValue(reviewResponse([
      { id: "product-2", related: null, reason: "Compatibility details are missing." },
      { id: "product-1", related: false, reason: "The supplied product is not suitable for this draft." },
    ], ["Review fit manually."]));
    vi.stubGlobal("fetch", fetchMock);
    const result = await verifyProductResults("https://api.example.com/v1", "secret-key", "review-model", reviewInput);
    expect(result.model).toBe("review-model");
    expect(result.assessments.map((assessment) => assessment.id)).toEqual(["product-1", "product-2"]);
    expect(result.assessments[1].related).toBeNull();
    expect(result.warnings).toEqual(["Review fit manually."]);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://api.example.com/v1/chat/completions");
    expect(init.headers.Authorization).toBe("Bearer secret-key");
    const body = JSON.parse(init.body);
    expect(body.model).toBe("review-model");
    expect(body.messages[0].content).toContain("untrusted data");
    expect(body.messages[0].content).toContain("Category assignments, status, inventory and actual store-wide counts are unknown");
    expect(JSON.parse(body.messages[1].content).products.map((product: { selected: boolean }) => product.selected))
      .toEqual([true, false]);
    expect(init.body).not.toContain("https://shop.example");
    expect(init.body).not.toContain("secret-key");
    expect(init.body).not.toContain("first-model");
  });

  it("batches all products with globally unique IDs, includes smart rules, and deduplicates warnings", async () => {
    const progress = vi.fn();
    const fetchMock = vi.fn(async (_url, init) => {
      const data = JSON.parse(JSON.parse(init.body).messages[1].content);
      expect(data.conditions).toBe("Products → Match ALL conditions");
      return reviewResponse(data.products.reverse().map((product: { id: string }) => ({
        id: product.id, related: true, reason: "The supplied details support relevance.",
      })), ["Review category assignments."]);
    });
    vi.stubGlobal("fetch", fetchMock);
    const result = await verifyProductResults("https://api.example.com/v1", "key", "review-model", {
      ...reviewInput, mode: "smart", conditions: "Products → Match ALL conditions",
      products: Array.from({ length: 31 }, () => ({ product: products[0], selected: null })),
    }, { onProgress: progress });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(result.assessments).toHaveLength(31);
    expect(result.assessments[30].id).toBe("product-31");
    expect(result.warnings).toEqual(["Review category assignments."]);
    expect(progress.mock.calls).toEqual([[30, 31], [31, 31]]);
  });

  it.each([
    { assessments: [{ id: "product-1", related: true, reason: "Valid." }], error: "did not review every product" },
    { assessments: [
      { id: "product-1", related: true, reason: "Valid." },
      { id: "product-1", related: false, reason: "Duplicate." },
    ], error: "mismatched product IDs" },
    { assessments: [
      { id: "invented", related: true, reason: "Unknown." },
      { id: "product-2", related: false, reason: "Valid." },
    ], error: "mismatched product IDs" },
    { assessments: [{ id: "product-1", related: "yes", reason: "Invalid." }], error: "invalid review" },
    { assessments: [{ id: "product-1", related: true }], error: "invalid review" },
    { assessments: [{ id: "product-1", related: true, reason: "" }], error: "invalid review" },
    { assessments: [{ id: "product-1", related: true, reason: "x".repeat(601) }], error: "invalid review" },
    { assessments: [{ id: "product-1", related: true, reason: "Valid.", url: "https://invented.example" }], error: "invalid review" },
  ])("rejects incomplete or invalid reviews: $error", async ({ assessments, error }) => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(reviewResponse(assessments)));
    await expect(verifyProductResults("https://api.example.com/v1", "key", "model", reviewInput)).rejects.toThrow(error);
  });

  it("does not report partial success if a later batch fails", async () => {
    const fetchMock = vi.fn(async (_url, init) => {
      const data = JSON.parse(JSON.parse(init.body).messages[1].content);
      if (data.products[0].id === "product-31") return new Response("unavailable", { status: 503 });
      return reviewResponse(data.products.map((product: { id: string }) => ({
        id: product.id, related: true, reason: "Evidence.",
      })));
    });
    vi.stubGlobal("fetch", fetchMock);
    await expect(verifyProductResults("https://api.example.com/v1", "key", "model", {
      ...reviewInput, products: Array.from({ length: 31 }, () => reviewInput.products[0]),
    })).rejects.toThrow("503");
  });

  it("rejects empty input and respects cancellation before requests and after response decoding", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    await expect(verifyProductResults("https://api.example.com/v1", "key", "model", {
      ...reviewInput, products: [],
    })).rejects.toThrow("No collected products");
    const controller = new AbortController();
    controller.abort();
    await expect(verifyProductResults("https://api.example.com/v1", "key", "model", reviewInput, {
      signal: controller.signal,
    })).rejects.toThrow("cancelled");
    expect(fetchMock).not.toHaveBeenCalled();

    const lateController = new AbortController();
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => {
        lateController.abort();
        return {};
      },
    });
    await expect(verifyProductResults("https://api.example.com/v1", "key", "model", reviewInput, {
      signal: lateController.signal,
    })).rejects.toThrow("cancelled");
  });

  it("redacts provider errors and rejects invalid JSON instead of claiming verification", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValueOnce(new Response(JSON.stringify({
      error: { message: "Invalid secret-key" },
    }), { status: 401 })).mockResolvedValueOnce(new Response(JSON.stringify({
      choices: [{ message: { content: "not JSON" } }],
    }), { status: 200 })));
    await expect(verifyProductResults("https://api.example.com/v1", "secret-key", "model", reviewInput))
      .rejects.toThrow("Invalid [redacted]");
    await expect(verifyProductResults("https://api.example.com/v1", "key", "model", reviewInput))
      .rejects.toThrow("valid JSON");
  });
});
