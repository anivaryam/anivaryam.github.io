import { afterEach, describe, expect, it, vi } from "vitest";
import {
  buildMinorityResult,
  classifyProducts,
  fetchAvailableModels,
  formatMinorityResult,
  normalizeApiBase,
} from "./api";
import type { ProductCandidate } from "./types";

const products: ProductCandidate[] = [
  { name: "Cash Acceptor", productType: "Bill acceptor", description: "Accepts bills.", price: "", url: "https://shop.example/products/cash-acceptor", foundVia: ["https://shop.example/collections/acceptors"] },
  { name: "Card Reader", productType: "Card reader", description: "Accepts cards.", price: "", url: "https://shop.example/products/card-reader", foundVia: ["https://shop.example/collections/readers"] },
];

afterEach(() => vi.unstubAllGlobals());

describe("related product API", () => {
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
});
