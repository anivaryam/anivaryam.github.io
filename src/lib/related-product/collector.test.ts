import { afterEach, describe, expect, it, vi } from "vitest";
import { collectProductsFromUrls, deduplicateProducts, normalizeCollectionUrl, parseCollectionHtml } from "./collector";

afterEach(() => vi.unstubAllGlobals());

describe("related product collection scope", () => {
  it("normalizes public collection URLs and blocks private destinations", () => {
    expect(normalizeCollectionUrl("shop.example/collections/acceptors"))
      .toBe("https://shop.example/collections/acceptors");
    expect(() => normalizeCollectionUrl("http://127.0.0.1/products/secret")).toThrow("private-network");
    expect(() => normalizeCollectionUrl("http://[fd00::1]/products/secret")).toThrow("private-network");
    expect(() => normalizeCollectionUrl("https://store.example.local/")).toThrow("private-network");
  });

  it("extracts product cards and pagination only from the provided origin", () => {
    const result = parseCollectionHtml(
      `<main>
        <article class="product-card"><a href="/products/acceptor"><h2>Bill Acceptor</h2><p>For vending machines</p></a></article>
        <article class="product-card"><a href="https://elsewhere.example/products/reader">External Reader</a></article>
        <a rel="next" href="/collections/acceptors?page=2">Next</a>
        <a href="https://elsewhere.example/collections/other?page=2">Next store</a>
      </main>`,
      "https://shop.example/collections/acceptors",
    );

    expect(result.products).toHaveLength(1);
    expect(result.products[0]).toMatchObject({
      name: "Bill Acceptor",
      description: "For vending machines",
      url: "https://shop.example/products/acceptor",
    });
    expect(result.pagination).toEqual(["https://shop.example/collections/acceptors?page=2"]);
  });

  it("reads Shopify Product structured data without following external product URLs", () => {
    const result = parseCollectionHtml(
      `<script type="application/ld+json">
        {"@context":"https://schema.org","@type":"Product","name":"Stacker","url":"/products/stacker","description":"Replacement stacker"}
      </script>`,
      "https://shop.example/collections/acceptors",
    );
    expect(result.products).toEqual([
      expect.objectContaining({
        name: "Stacker",
        description: "Replacement stacker",
        url: "https://shop.example/products/stacker",
      }),
    ]);
  });

  it("flags JavaScript load-more collections instead of presenting a partial list", () => {
    const result = parseCollectionHtml(
      `<article class="product-card"><a href="/products/acceptor">Bill Acceptor</a></article>
       <button>Load more products</button>`,
      "https://shop.example/collections/acceptors",
    );
    expect(result.hasDynamicLoadMore).toBe(true);
  });

  it("bounds the number of submitted collections before making requests", async () => {
    const urls = Array.from({ length: 11 }, (_, index) => `https://shop-${index}.example/collections/items`);
    await expect(collectProductsFromUrls(urls, new AbortController().signal, () => undefined))
      .rejects.toThrow("up to 10 collection URLs");
  });

  it("does not repeat the same product name or canonical product URL across collections", () => {
    const products = [
      { name: "Bill Acceptor", productType: "", description: "first", price: "", url: "https://shop.example/products/acceptor?source=one" },
      { name: " bill   acceptor ", productType: "", description: "duplicate name", price: "", url: "https://other.example/products/acceptor" },
      { name: "Stacker", productType: "", description: "stacker", price: "", url: "https://shop.example/products/stacker" },
      { name: "Replacement", productType: "", description: "same URL", price: "", url: "https://shop.example/products/stacker?variant=2" },
    ];

    expect(deduplicateProducts(products)).toEqual([products[0], products[2]]);
  });

  it("records submitted source URLs and preserves all of them for duplicate products", async () => {
    const urls = [
      "https://shop.example/collections/acceptors",
      "https://shop.example/collections/bill-handling",
      "https://shop.example/products/stacker",
    ];
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const proxyUrl = new URL(String(input), "http://localhost:8000");
      const targetUrl = new URL(proxyUrl.searchParams.get("url") || "");
      expect(proxyUrl.pathname).toBe("/__related-product/page");

      const contents = targetUrl.pathname === "/products/stacker"
        ? "<html><body><h1>Replacement Stacker</h1></body></html>"
        : JSON.stringify({
          products: [{
            title: "Bill Acceptor",
            handle: "bill-acceptor",
            product_type: "Bill acceptor",
            body_html: "<p>Accepts bills</p>",
            variants: [{ price: "10.00" }],
          }],
        });
      return new Response(JSON.stringify({ contents }), { status: 200 });
    });
    vi.stubGlobal("fetch", fetchMock);

    const result = await collectProductsFromUrls(urls, new AbortController().signal, () => undefined);

    expect(result.products).toHaveLength(2);
    expect(result.products[0]).toMatchObject({
      name: "Bill Acceptor",
      foundVia: urls.slice(0, 2),
    });
    expect(result.products[1]).toMatchObject({
      name: "Replacement Stacker",
      foundVia: [urls[2]],
    });
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it("does not fall back to a partial collection if a Shopify feed stops midway", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const proxyUrl = new URL(String(input), "http://localhost:8000");
      const targetUrl = new URL(proxyUrl.searchParams.get("url") || "");
      expect(proxyUrl.pathname).toBe("/__related-product/page");
      expect(new Headers(init?.headers).get("X-Related-Product-Dev-Proxy")).toBe("1");
      if (targetUrl.searchParams.get("page") === "1") {
        const products = Array.from({ length: 250 }, (_, index) => ({
          title: `Product ${index + 1}`,
          handle: `product-${index + 1}`,
          product_type: "Accessory",
          body_html: "<p>Product details</p>",
          variants: [{ price: "10.00" }],
        }));
        return new Response(JSON.stringify({ contents: JSON.stringify({ products }) }), { status: 200 });
      }
      return new Response("blocked", { status: 503 });
    });
    vi.stubGlobal("fetch", fetchMock);

    await expect(collectProductsFromUrls(
      ["https://shop.example/collections/items"],
      new AbortController().signal,
      () => undefined,
    )).rejects.toThrow("No partial result was used");
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
