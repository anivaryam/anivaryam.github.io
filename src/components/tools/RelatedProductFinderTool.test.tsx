import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { RelatedProductFinderTool } from "./RelatedProductFinderTool";
import { unlockProviderSettings } from "@/lib/related-product/storage";

afterEach(() => {
  cleanup();
  localStorage.clear();
  vi.unstubAllGlobals();
});

describe("RelatedProductFinderTool model selection", () => {
  it("does not select a model automatically and preserves the radio selection after refresh", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({
        data: [{ id: "model-a", owned_by: "provider" }, { id: "model-b", owned_by: "provider" }],
      }), { status: 200, headers: { "Content-Type": "application/json" } }))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        data: [{ id: "model-b", owned_by: "provider" }],
      }), { status: 200, headers: { "Content-Type": "application/json" } }));
    vi.stubGlobal("fetch", fetchMock);
    render(<RelatedProductFinderTool />);

    fireEvent.change(await screen.findByLabelText("API key"), {
      target: { value: "test-api-key" },
    });
    fireEvent.change(screen.getByLabelText("Vault passphrase"), {
      target: { value: "a-long-test-passphrase" },
    });
    fireEvent.change(screen.getByLabelText("Confirm passphrase"), {
      target: { value: "a-long-test-passphrase" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Connect & load models" }));

    const firstModel = await screen.findByRole("radio", { name: /model-a/ });
    expect(firstModel.getAttribute("aria-checked")).toBe("false");

    fireEvent.click(firstModel);
    await waitFor(() => expect(firstModel.getAttribute("aria-checked")).toBe("true"));
    await waitFor(async () => {
      expect((await unlockProviderSettings("a-long-test-passphrase")).selectedModel).toBe("model-a");
    });

    fireEvent.click(screen.getByRole("button", { name: "Refresh models" }));
    expect(await screen.findByText("Saved model unavailable: model-a")).toBeTruthy();
    expect(screen.getByRole("radio", { name: /model-b/ }).getAttribute("aria-checked")).toBe("false");
    expect((await unlockProviderSettings("a-long-test-passphrase")).selectedModel).toBe("model-a");
  });
});

describe("RelatedProductFinderTool result presentation", () => {
  it("groups product names under their submitted source URL", async () => {
    const sourceUrl = "https://shop.example/collections/polishing-kits";
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.endsWith("/models")) {
        return new Response(JSON.stringify({ data: [{ id: "model-a", owned_by: "provider" }] }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }

      if (url.startsWith("/__related-product/page")) {
        const targetUrl = new URL(url, "http://localhost:8000").searchParams.get("url");
        expect(targetUrl).toContain("/collections/polishing-kits/products.json");
        return new Response(JSON.stringify({
          contents: JSON.stringify({
            products: [
              {
                title: "Polishing Cloth",
                handle: "polishing-cloth",
                product_type: "Accessory",
                body_html: "Soft polishing cloth",
                variants: [{ price: "8.00" }],
              },
              {
                title: "Paint Polish",
                handle: "paint-polish",
                product_type: "Polish",
                body_html: "Paint correction polish",
                variants: [{ price: "18.00" }],
              },
              {
                title: "Heavy Metal Polish",
                handle: "heavy-metal-polish",
                product_type: "Polish",
                body_html: "Metal polish compound",
                variants: [{ price: "20.00" }],
              },
            ],
          }),
        }), { status: 200 });
      }

      if (url.endsWith("/chat/completions")) {
        const request = JSON.parse(String(init?.body));
        const inputProducts = JSON.parse(request.messages[1].content).products;
        return new Response(JSON.stringify({
          choices: [{
            message: {
              content: JSON.stringify({
                classifications: inputProducts.map((product: { id: string }) => ({
                  id: product.id,
                  related: product.id === "product-1",
                })),
              }),
            },
          }],
        }), { status: 200, headers: { "Content-Type": "application/json" } });
      }

      throw new Error(`Unexpected request: ${url}`);
    });
    vi.stubGlobal("fetch", fetchMock);
    render(<RelatedProductFinderTool />);

    fireEvent.change(await screen.findByLabelText("API key"), {
      target: { value: "test-api-key" },
    });
    fireEvent.change(screen.getByLabelText("Vault passphrase"), {
      target: { value: "a-long-test-passphrase" },
    });
    fireEvent.change(screen.getByLabelText("Confirm passphrase"), {
      target: { value: "a-long-test-passphrase" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Connect & load models" }));

    const model = await screen.findByRole("radio", { name: /model-a/ });
    fireEvent.click(model);
    await waitFor(() => expect(model.getAttribute("aria-checked")).toBe("true"));
    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Find related products" }).hasAttribute("disabled"))
        .toBe(false);
    });

    fireEvent.change(screen.getByLabelText("Collection or product URLs"), {
      target: { value: sourceUrl },
    });
    fireEvent.change(screen.getByLabelText("Content draft"), {
      target: { value: "A draft about polishing cloths." },
    });
    fireEvent.click(screen.getByRole("button", { name: "Find related products" }));

    expect(await screen.findByRole("heading", { name: "Unrelated Product" })).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Submitted URL" })).toBeTruthy();
    expect(screen.getByRole("link", { name: sourceUrl }).getAttribute("href")).toBe(sourceUrl);
    expect(screen.getByText("2 products")).toBeTruthy();
    expect(screen.getByText("Paint Polish")).toBeTruthy();
    expect(screen.getByText("Heavy Metal Polish")).toBeTruthy();
    expect(screen.queryByText("Polishing Cloth")).toBeNull();
  });
});
