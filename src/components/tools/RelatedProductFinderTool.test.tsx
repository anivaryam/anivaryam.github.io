import { StrictMode } from "react";
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { RelatedProductFinderTool } from "./RelatedProductFinderTool";
import { DEFAULT_API_BASE } from "@/lib/related-product/api";
import * as providerStorage from "@/lib/related-product/storage";
import {
  DEFAULT_SMART_COLLECTION_OPTIONS,
  formatSmartCollectionSuggestion,
  parseSmartCollectionOptions,
  parseSmartCollectionSuggestion,
  SMART_COLLECTION_ANY_NOTICE,
} from "@/lib/related-product/smart-collection";

afterEach(() => {
  cleanup();
  localStorage.clear();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

async function connectProvider() {
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
  return screen.findByRole("radio", { name: /model-a/ });
}

const sourceUrl = "https://shop.example/collections/polishing-kits";
const productNames = ["Polishing Cloth", "Paint Polish", "Heavy Metal Polish"];
const productHandles = ["polishing-cloth", "paint-polish", "heavy-metal-polish"];

function completionResponse(payload: unknown) {
  return new Response(JSON.stringify({
    choices: [{ message: { content: JSON.stringify(payload) } }],
  }), { status: 200, headers: { "Content-Type": "application/json" } });
}

function mockFinderFetch(related: boolean[]) {
  return vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    if (url.endsWith("/models")) {
      return new Response(JSON.stringify({ data: [{ id: "model-a", owned_by: "provider" }] }), {
        status: 200, headers: { "Content-Type": "application/json" },
      });
    }
    if (url.startsWith("/__related-product/page")) {
      const targetUrl = new URL(url, "http://localhost:8000").searchParams.get("url");
      expect(targetUrl).toContain("/collections/polishing-kits/products.json");
      return new Response(JSON.stringify({
        contents: JSON.stringify({
          products: productNames.map((title, index) => ({
            title, handle: productHandles[index], product_type: "Polish",
            body_html: `${title} description`, variants: [{ price: "18.00" }],
          })),
        }),
      }), { status: 200 });
    }
    if (url.endsWith("/chat/completions")) {
      const request = JSON.parse(String(init?.body));
      const inputProducts = JSON.parse(request.messages[1].content).products;
      if (request.messages[0].content.startsWith("Act as an advisory verifier")) {
        return completionResponse({
          assessments: inputProducts.map((product: { id: string; selected: boolean | null }, index: number) => ({
            id: product.id, related: product.selected ?? related[index], reason: "Supplied details support this decision.",
          })),
          warnings: [], needsCorrection: false,
        });
      }
      return completionResponse({
        classifications: inputProducts.map((product: { id: string }, index: number) => ({
          id: product.id, related: related[index],
        })),
      });
    }
    throw new Error(`Unexpected request: ${url}`);
  });
}

const smartConditions = {
  categories: [],
  titleIncludes: [{ match: "any", values: ["Polishing"] }],
  titleExcludes: ["Replacement"],
  notes: ["Confirm category labels and stock in Shopify."],
};

function mockSmartFinderFetch(payload: unknown = smartConditions, blocked = false) {
  const manualFetch = mockFinderFetch([true, false, false]);
  return vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    if (url.endsWith("/chat/completions")) {
      if (JSON.parse(String(init?.body)).messages[0].content.startsWith("Act as an advisory verifier")) {
        return manualFetch(input, init);
      }
      return completionResponse(payload);
    }
    if (blocked && url.startsWith("/__related-product/page")) return new Response("blocked", { status: 429 });
    return manualFetch(input, init);
  });
}

describe("RelatedProductFinderTool model selection", () => {
  it("requires explicit selection, collapses after saving, and reopens unavailable models through Manage", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({
        data: [{ id: "model-a", owned_by: "provider" }, { id: "model-b", owned_by: "provider" }],
      }), { status: 200, headers: { "Content-Type": "application/json" } }))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        data: [{ id: "model-b", owned_by: "provider" }],
      }), { status: 200, headers: { "Content-Type": "application/json" } }));
    vi.stubGlobal("fetch", fetchMock);
    render(<RelatedProductFinderTool />);

    const firstModel = await connectProvider();
    expect(firstModel.getAttribute("aria-checked")).toBe("false");
    expect(screen.getByRole("button", { name: "Hide settings" }).hasAttribute("disabled")).toBe(true);

    firstModel.focus();
    fireEvent.click(firstModel);
    const manage = await screen.findByRole("button", { name: "Manage" });
    expect(manage.getAttribute("aria-expanded")).toBe("false");
    expect(screen.queryByRole("radio")).toBeNull();
    expect(screen.getByText("Connected")).toBeTruthy();
    expect(screen.getByText("OpenAI")).toBeTruthy();
    expect(within(screen.getByRole("region", { name: "LLM connection" })).getByText("model-a")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Lock" })).toBeTruthy();
    expect(document.activeElement).toBe(screen.getByLabelText("Collection links"));
    expect((await providerStorage.unlockProviderSettings("a-long-test-passphrase")).selectedModel).toBe("model-a");

    fireEvent.click(manage);
    expect(screen.getByRole("button", { name: "Hide settings" }).getAttribute("aria-expanded")).toBe("true");
    expect(screen.getByRole("radio", { name: /model-a/ }).getAttribute("aria-checked")).toBe("true");
    fireEvent.click(screen.getByRole("button", { name: "Refresh models" }));
    expect(await screen.findByText("Saved model unavailable: model-a")).toBeTruthy();
    expect(screen.getByRole("radio", { name: /model-b/ }).getAttribute("aria-checked")).toBe("false");
    expect(screen.getByRole("button", { name: "Hide settings" }).hasAttribute("disabled")).toBe(true);
    expect((await providerStorage.unlockProviderSettings("a-long-test-passphrase")).selectedModel).toBe("model-a");

    fireEvent.click(screen.getByRole("radio", { name: /model-b/ }));
    expect(await screen.findByRole("button", { name: "Manage" })).toBeTruthy();
    expect((await providerStorage.unlockProviderSettings("a-long-test-passphrase")).selectedModel).toBe("model-b");
  });

  it("waits for the latest queued model save before collapsing and does not steal input focus", async () => {
    vi.stubGlobal("fetch", mockFinderFetch([]).mockResolvedValueOnce(new Response(JSON.stringify({
      data: [{ id: "model-a" }, { id: "model-b" }],
    }), { status: 200 })));
    render(<RelatedProductFinderTool />);
    const firstModel = await connectProvider();
    const persist = providerStorage.saveProviderSettings;
    let finishFirst!: () => void;
    let finishLatest!: () => void;
    const firstSave = new Promise<void>((resolve) => { finishFirst = resolve; });
    const latestSave = new Promise<void>((resolve) => { finishLatest = resolve; });
    const save = vi.spyOn(providerStorage, "saveProviderSettings")
      .mockImplementationOnce(async (...args) => { await firstSave; await persist(...args); })
      .mockImplementationOnce(async (...args) => { await latestSave; await persist(...args); });

    fireEvent.click(firstModel);
    fireEvent.click(screen.getByRole("radio", { name: /model-b/ }));
    expect(screen.getByText("Saving selection…")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Manage" })).toBeNull();
    finishFirst();
    await waitFor(() => expect(save).toHaveBeenCalledTimes(2));
    expect(screen.getByRole("radio", { name: /model-b/ }).getAttribute("aria-checked")).toBe("true");
    expect(screen.getByText("Saving selection…")).toBeTruthy();
    const draft = screen.getByLabelText("Draft content");
    draft.focus();
    finishLatest();
    expect(await screen.findByRole("button", { name: "Manage" })).toBeTruthy();
    expect(document.activeElement).toBe(draft);
    expect((await providerStorage.unlockProviderSettings("a-long-test-passphrase")).selectedModel).toBe("model-b");
  });

  it("keeps settings and save errors visible if the selected model cannot be persisted", async () => {
    vi.stubGlobal("fetch", mockFinderFetch([]));
    render(<RelatedProductFinderTool />);
    const model = await connectProvider();
    vi.spyOn(Storage.prototype, "setItem").mockImplementationOnce(() => {
      throw new Error("Storage is full");
    });
    fireEvent.click(model);
    expect(await screen.findByText("Could not save encrypted settings in this browser.")).toBeTruthy();
    expect(screen.getByRole("radio", { name: /model-a/ })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Hide settings" }).hasAttribute("disabled")).toBe(true);
    expect(screen.queryByRole("button", { name: "Manage" })).toBeNull();
    expect((await providerStorage.unlockProviderSettings("a-long-test-passphrase")).selectedModel).toBe("");
  });

  it.each([true, false])("validates saved model availability before collapsing after unlock: %s", async (available) => {
    await providerStorage.saveProviderSettings({
      apiBase: DEFAULT_API_BASE, apiKey: "test-api-key", selectedModel: "model-a",
    }, "a-long-test-passphrase");
    vi.stubGlobal("fetch", mockFinderFetch([]).mockResolvedValueOnce(new Response(JSON.stringify({
      data: [{ id: available ? "model-a" : "model-b" }],
    }), { status: 200 })));
    render(<RelatedProductFinderTool />);
    fireEvent.change(await screen.findByLabelText("Unlock your saved settings"), {
      target: { value: "a-long-test-passphrase" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Unlock & load models" }));
    if (available) {
      expect(await screen.findByRole("button", { name: "Manage" })).toBeTruthy();
      expect(screen.queryByRole("radio")).toBeNull();
      fireEvent.click(screen.getByRole("button", { name: "Lock" }));
      expect(await screen.findByLabelText("Unlock your saved settings")).toBeTruthy();
      expect(screen.queryByRole("button", { name: "Manage" })).toBeNull();
    } else {
      expect(await screen.findByText("Saved model unavailable: model-a")).toBeTruthy();
      expect(screen.getByRole("radio", { name: /model-b/ }).getAttribute("aria-checked")).toBe("false");
      expect(screen.getByRole("button", { name: "Hide settings" }).hasAttribute("disabled")).toBe(true);
    }
  });

  it("shows model-loading errors after unlock and allows refresh before manually hiding settings", async () => {
    await providerStorage.saveProviderSettings({
      apiBase: DEFAULT_API_BASE, apiKey: "test-api-key", selectedModel: "model-a",
    }, "a-long-test-passphrase");
    vi.stubGlobal("fetch", mockFinderFetch([]).mockResolvedValueOnce(new Response(JSON.stringify({
      error: { message: "Check your provider access." },
    }), { status: 401 })));
    render(<RelatedProductFinderTool />);
    fireEvent.change(await screen.findByLabelText("Unlock your saved settings"), {
      target: { value: "a-long-test-passphrase" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Unlock & load models" }));
    expect(await screen.findByText("Provider error (401): Check your provider access.")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Manage" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Refresh models" }));
    expect(await screen.findByRole("radio", { name: /model-a/ })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Hide settings" }));
    expect(screen.getByRole("button", { name: "Manage" }).getAttribute("aria-expanded")).toBe("false");
  });
});

describe("RelatedProductFinderTool result presentation", () => {
  it("shows the related, unrelated, and summary panels before connecting", async () => {
    render(<RelatedProductFinderTool />);
    expect(await screen.findByLabelText("API key")).toBeTruthy();
    for (const name of ["Related Products", "Unrelated Products", "Summary"]) {
      expect(screen.getByRole("region", { name })).toBeTruthy();
    }
    expect(screen.getByLabelText("Collection links")).toBeTruthy();
    expect(screen.getByLabelText("Draft content")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Copy result" }).hasAttribute("disabled")).toBe(true);
    expect(screen.getByRole("button", { name: "New check" }).hasAttribute("disabled")).toBe(true);
  });

  it.each([
    { name: "mixed", related: [true, false, false], summary: "Check complete",
      copied: `Unrelated Product\n\nSubmitted URL: ${sourceUrl}\n- Paint Polish\n- Heavy Metal Polish` },
    { name: "all related", related: [true, true, true], summary: "All related", copied: "All related" },
    { name: "all unrelated", related: [false, false, false], summary: "All unrelated", copied: "All unrelated" },
  ])("shows both $name groups and keeps the summary/copy contract", async ({ related, summary, copied }) => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal("navigator", { clipboard: { writeText }, userAgent: navigator.userAgent, platform: navigator.platform });
    vi.stubGlobal("fetch", mockFinderFetch(related));
    render(<RelatedProductFinderTool />);

    const model = await connectProvider();
    fireEvent.click(model);
    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Find related products" }).hasAttribute("disabled"))
        .toBe(false);
    });

    fireEvent.change(screen.getByLabelText("Collection links"), {
      target: { value: sourceUrl },
    });
    fireEvent.change(screen.getByLabelText("Draft content"), {
      target: { value: "A draft about polishing cloths." },
    });
    fireEvent.click(screen.getByRole("button", { name: "Find related products" }));

    const summaryPanel = within(screen.getByRole("region", { name: "Summary" }));
    expect(await summaryPanel.findByRole("status")).toHaveProperty("textContent", summary);
    const relatedPanel = within(screen.getByRole("region", { name: "Related Products" }));
    const unrelatedPanel = within(screen.getByRole("region", { name: "Unrelated Products" }));
    const relatedCount = related.filter(Boolean).length;
    expect(summaryPanel.getByText("Unique products").nextElementSibling?.textContent).toBe("3");
    expect(summaryPanel.getByText("Related").nextElementSibling?.textContent).toBe(String(relatedCount));
    expect(summaryPanel.getByText("Unrelated").nextElementSibling?.textContent).toBe(String(3 - relatedCount));
    productNames.forEach((name, index) => {
      const panel = related[index] ? relatedPanel : unrelatedPanel;
      const other = related[index] ? unrelatedPanel : relatedPanel;
      const link = panel.getByRole("link", { name: new RegExp(name) });
      expect(link.getAttribute("href")).toBe(`https://shop.example/products/${productHandles[index]}`);
      expect(link.getAttribute("rel")).toBe("noopener noreferrer");
      expect(other.queryByText(name)).toBeNull();
    });
    for (const panel of [relatedPanel, unrelatedPanel]) {
      if (panel.queryAllByRole("link").length > 0) {
        expect(panel.getByRole("link", { name: sourceUrl }).getAttribute("href")).toBe(sourceUrl);
      }
    }
    fireEvent.click(summaryPanel.getByRole("button", { name: "Copy result" }));
    await waitFor(() => expect(writeText).toHaveBeenCalledWith(copied));

    const savedSettings = localStorage.getItem("related-product-finder.v1");
    fireEvent.click(screen.getByRole("button", { name: "New check" }));
    expect((screen.getByLabelText("Collection links") as HTMLTextAreaElement).value).toBe("");
    expect((screen.getByLabelText("Draft content") as HTMLTextAreaElement).value).toBe("");
    expect(screen.queryByText("Polishing Cloth")).toBeNull();
    expect(document.activeElement).toBe(screen.getByLabelText("Collection links"));
    expect(screen.getByRole("button", { name: "Manage" })).toBeTruthy();
    expect(screen.queryByRole("radio")).toBeNull();
    expect(localStorage.getItem("related-product-finder.v1")).toBe(savedSettings);
    expect(await providerStorage.unlockProviderSettings("a-long-test-passphrase")).toEqual({
      apiBase: DEFAULT_API_BASE, apiKey: "test-api-key", selectedModel: "model-a",
    });
    expect(summaryPanel.getByRole("button", { name: "Copy result" }).hasAttribute("disabled")).toBe(true);

    fireEvent.change(screen.getByLabelText("Collection links"), { target: { value: sourceUrl } });
    fireEvent.change(screen.getByLabelText("Draft content"), { target: { value: "Another draft for a new check." } });
    fireEvent.click(screen.getByRole("button", { name: "Find related products" }));
    expect(await summaryPanel.findByRole("status")).toHaveProperty("textContent", summary);
    expect(screen.getByRole("button", { name: "Manage" })).toBeTruthy();
  });

  it("keeps validation errors out of completed results and clears them without forgetting the key", async () => {
    vi.stubGlobal("fetch", mockFinderFetch([true, false, false]));
    render(<RelatedProductFinderTool />);
    fireEvent.click(await connectProvider());
    await waitFor(() => expect(screen.getByRole("button", { name: "Find related products" }).hasAttribute("disabled")).toBe(false));
    fireEvent.click(screen.getByRole("button", { name: "Find related products" }));
    expect(within(screen.getByRole("region", { name: "Check products against a draft" })).getByRole("alert").textContent)
      .toContain("Add one or more collection or product URLs.");
    expect(within(screen.getByRole("region", { name: "Summary" })).queryByRole("status")).toBeNull();
    expect(screen.getByRole("button", { name: "Manage" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "New check" }));
    expect(screen.queryByText("Add one or more collection or product URLs.")).toBeNull();
    expect(screen.getByRole("button", { name: "Lock" })).toBeTruthy();
    expect(document.activeElement).toBe(screen.getByLabelText("Collection links"));
  });

  it("reopens model settings for provider failures during classification", async () => {
    const successfulFetch = mockFinderFetch([]);
    vi.stubGlobal("fetch", vi.fn((input: RequestInfo | URL, init?: RequestInit) => (
      String(input).endsWith("/chat/completions")
        ? Promise.resolve(new Response(JSON.stringify({ error: { message: "Model access was revoked." } }), { status: 403 }))
        : successfulFetch(input, init)
    )));
    render(<RelatedProductFinderTool />);
    fireEvent.click(await connectProvider());
    await screen.findByRole("button", { name: "Manage" });
    fireEvent.change(screen.getByLabelText("Collection links"), { target: { value: sourceUrl } });
    fireEvent.change(screen.getByLabelText("Draft content"), { target: { value: "A draft to check." } });
    fireEvent.click(screen.getByRole("button", { name: "Find related products" }));
    expect(await screen.findByText("Provider error (403): Model access was revoked.")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Hide settings" }).getAttribute("aria-expanded")).toBe("true");
    expect(screen.getByRole("radio", { name: /model-a/ }).getAttribute("aria-checked")).toBe("true");
  });
});

describe("RelatedProductFinderTool smart collection suggestions", () => {
  it("generates and copies conditions with a title-only sample preview, then preserves manual matching", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal("navigator", { clipboard: { writeText }, userAgent: navigator.userAgent, platform: navigator.platform });
    const fetchMock = mockSmartFinderFetch();
    vi.stubGlobal("fetch", fetchMock);
    render(<RelatedProductFinderTool />);
    fireEvent.change(screen.getByLabelText("Output mode"), { target: { value: "smart" } });
    expect(screen.getByRole("region", { name: "Smart Collection Suggestions" })).toBeTruthy();
    fireEvent.click(await connectProvider());
    await waitFor(() => expect(screen.getByRole("button", { name: "Suggest smart conditions" }).hasAttribute("disabled")).toBe(false));
    fireEvent.change(screen.getByLabelText("Collection links"), { target: { value: sourceUrl } });
    fireEvent.change(screen.getByLabelText("Draft content"), { target: { value: "A draft about polishing cloths." } });
    fireEvent.click(screen.getByRole("button", { name: "Suggest smart conditions" }));

    const summary = within(screen.getByRole("region", { name: "Summary" }));
    expect(await summary.findByRole("status")).toHaveProperty("textContent", "Suggestions ready — review in Shopify");
    const table = within(screen.getByRole("table", { name: "Suggested Shopify conditions" }));
    expect(table.getByRole("cell", { name: "Active" })).toBeTruthy();
    expect(table.getByRole("cell", { name: "Inventory stock" })).toBeTruthy();
    const passed = within(screen.getByRole("region", { name: "Samples passing title rules" }));
    const excluded = within(screen.getByRole("region", { name: "Samples not matching title rules" }));
    expect(passed.getByText("Polishing Cloth")).toBeTruthy();
    expect(passed.queryByText("Paint Polish")).toBeNull();
    expect(excluded.getByText("Paint Polish")).toBeTruthy();
    expect(excluded.getByText("Heavy Metal Polish")).toBeTruthy();
    expect(summary.getByText("Products sampled").nextElementSibling?.textContent).toBe("3");
    expect(summary.getByText("Sampled titles matching rules").nextElementSibling?.textContent).toBe("1");
    expect(summary.getByText("Sampled titles not matching rules").nextElementSibling?.textContent).toBe("2");
    expect(summary.getByText("Actual Shopify matches").nextElementSibling?.textContent).toContain("Unverified");
    expect(table.queryByRole("cell", { name: "Category" })).toBeNull();
    expect(screen.getByLabelText("Add category condition").getAttribute("aria-checked")).toBe("false");
    expect(summary.getByText(/Sample only:/)).toBeTruthy();
    expect(screen.getByText(/Counts below are sample counts/)).toBeTruthy();
    const completions = fetchMock.mock.calls.filter(([url]) => String(url).endsWith("/chat/completions"));
    expect(completions).toHaveLength(2);
    expect(JSON.parse(JSON.parse(String(completions[0][1]?.body)).messages[1].content).samples).toHaveLength(3);
    const copyButton = summary.getByRole("button", { name: "Copy conditions" });
    expect(copyButton.className).toContain("hover:bg-muted");
    expect(copyButton.className).toContain("hover:text-foreground");
    fireEvent.click(copyButton);
    await waitFor(() => expect(writeText).toHaveBeenCalled());
    expect(writeText.mock.calls[0][0]).toContain(formatSmartCollectionSuggestion(parseSmartCollectionSuggestion(smartConditions)));
    expect(writeText.mock.calls[0][0]).toContain("Sampling notes:");
    expect(writeText.mock.calls[0][0]).toContain("Products sampled: 3\nSampled titles matching rules: 1\nSampled titles not matching rules: 2\nActual Shopify matches: Unverified");

    fireEvent.change(screen.getByLabelText("Output mode"), { target: { value: "manual" } });
    expect(screen.queryByRole("table", { name: "Suggested Shopify conditions" })).toBeNull();
    expect((screen.getByLabelText("Collection links") as HTMLTextAreaElement).value).toBe(sourceUrl);
    expect(summary.getByRole("button", { name: "Copy result" }).hasAttribute("disabled")).toBe(true);
    expect(screen.getByRole("button", { name: "Manage" })).toBeTruthy();
    vi.stubGlobal("fetch", mockFinderFetch([true, false, false]));
    fireEvent.click(screen.getByRole("button", { name: "Find related products" }));
    expect(await summary.findByRole("status")).toHaveProperty("textContent", "Check complete");
    expect(within(screen.getByRole("region", { name: "Related Products" })).getByText("Polishing Cloth")).toBeTruthy();
  });

  it("makes no-sample fallback explicit and clears results without forgetting the provider", async () => {
    vi.stubGlobal("fetch", mockSmartFinderFetch(smartConditions, true));
    render(<RelatedProductFinderTool />);
    fireEvent.click(await connectProvider());
    await screen.findByRole("button", { name: "Manage" });
    fireEvent.change(screen.getByLabelText("Output mode"), { target: { value: "smart" } });
    fireEvent.change(screen.getByLabelText("Collection links"), { target: { value: sourceUrl } });
    fireEvent.change(screen.getByLabelText("Draft content"), { target: { value: "A draft about polishing cloths." } });
    fireEvent.click(screen.getByRole("button", { name: "Suggest smart conditions" }));
    expect(await screen.findByText(/No product samples were readable/)).toBeTruthy();
    const summary = within(screen.getByRole("region", { name: "Summary" }));
    expect(summary.getByText("Products sampled").nextElementSibling?.textContent).toBe("0");
    expect(summary.getByText(/No sample from/)).toBeTruthy();
    expect(await within(screen.getByRole("region", { name: "AI result verifier" })).findByText("AI verification incomplete — original output retained.")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Verify results with AI" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "New check" }));
    expect(screen.queryByRole("table", { name: "Suggested Shopify conditions" })).toBeNull();
    expect((screen.getByLabelText("Output mode") as HTMLSelectElement).value).toBe("smart");
    expect((screen.getByLabelText("Draft content") as HTMLTextAreaElement).value).toBe("");
    expect(summary.getByRole("button", { name: "Copy conditions" }).hasAttribute("disabled")).toBe(true);
    expect(screen.getByRole("button", { name: "Manage" })).toBeTruthy();
    expect(document.activeElement).toBe(screen.getByLabelText("Collection links"));
  });

  it("rejects combining different stores before collecting or generating conditions", async () => {
    const fetchMock = mockSmartFinderFetch();
    vi.stubGlobal("fetch", fetchMock);
    render(<RelatedProductFinderTool />);
    fireEvent.click(await connectProvider());
    await screen.findByRole("button", { name: "Manage" });
    fireEvent.change(screen.getByLabelText("Output mode"), { target: { value: "smart" } });
    fireEvent.change(screen.getByLabelText("Collection links"), {
      target: { value: `${sourceUrl}\nhttps://different.example/collections/pins` },
    });
    fireEvent.change(screen.getByLabelText("Draft content"), { target: { value: "Draft" } });
    fireEvent.click(screen.getByRole("button", { name: "Suggest smart conditions" }));
    expect(await screen.findByText("Use URLs from one Shopify store for smart-collection suggestions.")).toBeTruthy();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("rejects unsupported conditions rather than displaying or copying unsafe model output", async () => {
    vi.stubGlobal("fetch", mockSmartFinderFetch({ ...smartConditions, status: "Draft" }));
    render(<RelatedProductFinderTool />);
    fireEvent.click(await connectProvider());
    await screen.findByRole("button", { name: "Manage" });
    fireEvent.change(screen.getByLabelText("Output mode"), { target: { value: "smart" } });
    fireEvent.change(screen.getByLabelText("Collection links"), { target: { value: sourceUrl } });
    fireEvent.change(screen.getByLabelText("Draft content"), { target: { value: "Draft" } });
    fireEvent.click(screen.getByRole("button", { name: "Suggest smart conditions" }));
    expect(await screen.findByText("The selected model returned invalid smart-collection conditions. Try another model.")).toBeTruthy();
    expect(screen.queryByRole("table", { name: "Suggested Shopify conditions" })).toBeNull();
    expect(screen.getByRole("button", { name: "Copy conditions" }).hasAttribute("disabled")).toBe(true);
    expect(screen.getByRole("button", { name: "Hide settings" })).toBeTruthy();
  });

  it("cancels a pending suggestion without publishing a result or losing the connection", async () => {
    const normalFetch = mockSmartFinderFetch();
    let started!: () => void;
    const providerStarted = new Promise<void>((resolve) => { started = resolve; });
    vi.stubGlobal("fetch", vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
      if (!String(input).endsWith("/chat/completions")) return normalFetch(input, init);
      started();
      return new Promise<Response>((_, reject) => {
        init?.signal?.addEventListener("abort", () => reject(new DOMException("Aborted", "AbortError")), { once: true });
      });
    }));
    render(<RelatedProductFinderTool />);
    fireEvent.click(await connectProvider());
    await screen.findByRole("button", { name: "Manage" });
    fireEvent.change(screen.getByLabelText("Output mode"), { target: { value: "smart" } });
    fireEvent.change(screen.getByLabelText("Collection links"), { target: { value: sourceUrl } });
    fireEvent.change(screen.getByLabelText("Draft content"), { target: { value: "Draft" } });
    fireEvent.click(screen.getByRole("button", { name: "Suggest smart conditions" }));
    await providerStarted;
    expect(screen.getByLabelText("Output mode").hasAttribute("disabled")).toBe(true);
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(await screen.findByText("Request cancelled.")).toBeTruthy();
    expect(screen.queryByRole("table", { name: "Suggested Shopify conditions" })).toBeNull();
    expect(screen.getByRole("button", { name: "Copy conditions" }).hasAttribute("disabled")).toBe(true);
    expect(screen.getByLabelText("Output mode").hasAttribute("disabled")).toBe(false);
    expect(screen.getByRole("button", { name: "Manage" })).toBeTruthy();
  });

  it("uses per-client settings in generation, preview and copy, and resets them for the next client", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal("navigator", { clipboard: { writeText }, userAgent: navigator.userAgent, platform: navigator.platform });
    const categoryConditions = { ...smartConditions, categories: ["Cleaning Supplies"] };
    const fetchMock = mockSmartFinderFetch(categoryConditions);
    vi.stubGlobal("fetch", fetchMock);
    render(<RelatedProductFinderTool />);
    fireEvent.click(await connectProvider());
    await screen.findByRole("button", { name: "Manage" });
    fireEvent.change(screen.getByLabelText("Output mode"), { target: { value: "smart" } });
    fireEvent.change(screen.getByLabelText("Collection links"), { target: { value: sourceUrl } });
    fireEvent.change(screen.getByLabelText("Draft content"), { target: { value: "A polishing cloth draft." } });
    fireEvent.click(screen.getByLabelText("Add category condition"));
    fireEvent.change(screen.getByLabelText("Available categories (optional)"), { target: { value: "Cleaning Supplies\nShop Supplies" } });
    fireEvent.change(screen.getByLabelText("Match conditions"), { target: { value: "any" } });
    fireEvent.click(screen.getByLabelText("Include subcategories"));
    fireEvent.change(screen.getByLabelText("Product status"), { target: { value: "Draft" } });
    fireEvent.change(screen.getByLabelText("Inventory comparison"), { target: { value: "is less than" } });
    fireEvent.change(screen.getByLabelText("Inventory value"), { target: { value: "5" } });
    expect(screen.getByText(SMART_COLLECTION_ANY_NOTICE)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Suggest smart conditions" }));
    const summary = within(screen.getByRole("region", { name: "Summary" }));
    await summary.findByText("Suggestions ready — review in Shopify");
    const table = within(screen.getByRole("table", { name: "Suggested Shopify conditions" }));
    expect(table.getByRole("cell", { name: "Draft" })).toBeTruthy();
    expect(table.queryByRole("cell", { name: "Active" })).toBeNull();
    expect(table.getByRole("cell", { name: "is less than" })).toBeTruthy();
    expect(table.getByRole("cell", { name: "5" })).toBeTruthy();
    expect(screen.getByText("Products → Match ANY conditions")).toBeTruthy();
    expect(screen.getByText("Include subcategories: OFF. Add each title exclusion as its own condition.")).toBeTruthy();
    expect(within(screen.getByRole("region", { name: "Samples passing title rules" })).getByText("Paint Polish")).toBeTruthy();
    const options = parseSmartCollectionOptions({
      ...DEFAULT_SMART_COLLECTION_OPTIONS, useCategory: true, match: "any", includeSubcategories: false, status: "Draft",
      inventory: { operator: "is less than", value: 5 }, availableCategories: ["Cleaning Supplies", "Shop Supplies"],
    });
    const completion = fetchMock.mock.calls.find(([url]) => String(url).endsWith("/chat/completions"));
    expect(JSON.parse(JSON.parse(String(completion[1]?.body)).messages[1].content).clientOptions).toEqual(options);
    fireEvent.click(summary.getByRole("button", { name: "Copy conditions" }));
    await waitFor(() => expect(writeText).toHaveBeenCalled());
    expect(writeText.mock.calls[0][0]).toContain(formatSmartCollectionSuggestion(parseSmartCollectionSuggestion(categoryConditions, options), options));

    fireEvent.change(screen.getByLabelText("Inventory value"), { target: { value: "10" } });
    expect(screen.queryByRole("table", { name: "Suggested Shopify conditions" })).toBeNull();
    expect(summary.getByRole("button", { name: "Copy conditions" }).hasAttribute("disabled")).toBe(true);
    fireEvent.click(screen.getByRole("button", { name: "New check" }));
    expect((screen.getByLabelText("Available categories (optional)") as HTMLTextAreaElement).value).toBe("");
    expect((screen.getByLabelText("Match conditions") as HTMLSelectElement).value).toBe("all");
    expect((screen.getByLabelText("Product status") as HTMLSelectElement).value).toBe("Active");
    expect((screen.getByLabelText("Inventory value") as HTMLInputElement).value).toBe("0");
    expect(screen.getByLabelText("Include subcategories").getAttribute("aria-checked")).toBe("true");
    expect(screen.getByLabelText("Add category condition").getAttribute("aria-checked")).toBe("false");
    expect(screen.getByRole("button", { name: "Manage" })).toBeTruthy();
  });

  it("omits disabled status and stock conditions instead of silently restoring the defaults", async () => {
    vi.stubGlobal("fetch", mockSmartFinderFetch());
    render(<RelatedProductFinderTool />);
    fireEvent.click(await connectProvider());
    await screen.findByRole("button", { name: "Manage" });
    fireEvent.change(screen.getByLabelText("Output mode"), { target: { value: "smart" } });
    fireEvent.change(screen.getByLabelText("Collection links"), { target: { value: sourceUrl } });
    fireEvent.change(screen.getByLabelText("Draft content"), { target: { value: "Draft" } });
    fireEvent.change(screen.getByLabelText("Product status"), { target: { value: "any" } });
    fireEvent.click(screen.getByLabelText("Add inventory condition"));
    expect(screen.queryByLabelText("Inventory value")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Suggest smart conditions" }));
    const table = within(await screen.findByRole("table", { name: "Suggested Shopify conditions" }));
    expect(table.queryByRole("cell", { name: "Status" })).toBeNull();
    expect(table.queryByRole("cell", { name: "Inventory stock" })).toBeNull();
  });

  it("blocks invalid settings before page or model requests and rejects out-of-list categories", async () => {
    const fetchMock = mockSmartFinderFetch({ ...smartConditions, categories: ["Cleaning Supplies"] });
    vi.stubGlobal("fetch", fetchMock);
    render(<RelatedProductFinderTool />);
    fireEvent.click(await connectProvider());
    await screen.findByRole("button", { name: "Manage" });
    fireEvent.change(screen.getByLabelText("Output mode"), { target: { value: "smart" } });
    fireEvent.change(screen.getByLabelText("Collection links"), { target: { value: sourceUrl } });
    fireEvent.change(screen.getByLabelText("Draft content"), { target: { value: "Draft" } });
    fireEvent.change(screen.getByLabelText("Inventory value"), { target: { value: "" } });
    fireEvent.click(screen.getByRole("button", { name: "Suggest smart conditions" }));
    expect(await screen.findByText("Check smart collection settings: use valid options, a whole-number stock value, and at most 200 category labels of 1–120 characters.")).toBeTruthy();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    fireEvent.change(screen.getByLabelText("Inventory value"), { target: { value: "0" } });
    fireEvent.click(screen.getByLabelText("Add category condition"));
    fireEvent.change(screen.getByLabelText("Available categories (optional)"), { target: { value: "Lawn Seeds\nSprinklers" } });
    fireEvent.click(screen.getByRole("button", { name: "Suggest smart conditions" }));
    expect(await screen.findByText("The model suggested a category outside your available categories. Review the list or try again.")).toBeTruthy();
    expect(screen.queryByRole("table", { name: "Suggested Shopify conditions" })).toBeNull();
    expect(screen.getByRole("button", { name: "Copy conditions" }).hasAttribute("disabled")).toBe(true);
  });

  it("does not present all samples as title matches when only category conditions are suggested", async () => {
    vi.stubGlobal("fetch", mockSmartFinderFetch({
      categories: ["Cleaning Supplies"], titleIncludes: [], titleExcludes: [], notes: [],
    }));
    render(<RelatedProductFinderTool />);
    fireEvent.click(await connectProvider());
    await screen.findByRole("button", { name: "Manage" });
    fireEvent.change(screen.getByLabelText("Output mode"), { target: { value: "smart" } });
    fireEvent.click(screen.getByLabelText("Add category condition"));
    fireEvent.change(screen.getByLabelText("Collection links"), { target: { value: sourceUrl } });
    fireEvent.change(screen.getByLabelText("Draft content"), { target: { value: "Draft" } });
    fireEvent.click(screen.getByRole("button", { name: "Suggest smart conditions" }));
    const summary = within(screen.getByRole("region", { name: "Summary" }));
    await summary.findByText("Suggestions ready — review in Shopify");
    expect(summary.getByText("Products sampled").nextElementSibling?.textContent).toBe("3");
    expect(summary.getByText("Sampled titles matching rules").nextElementSibling?.textContent).toBe("Not evaluated");
    const passed = within(screen.getByRole("region", { name: "Samples passing title rules" }));
    expect(passed.getByText(/No title conditions were suggested/)).toBeTruthy();
    expect(passed.queryByText("Polishing Cloth")).toBeNull();
  });
});

function mockVerifiedFinderFetch(mode: "manual" | "smart") {
  const base = mode === "manual" ? mockFinderFetch([true, false, false]) : mockSmartFinderFetch();
  return vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    if (String(input).endsWith("/models")) {
      return new Response(JSON.stringify({ data: [{ id: "model-a" }, { id: "model-b" }] }), { status: 200 });
    }
    if (String(input).endsWith("/chat/completions")) {
      const body = JSON.parse(String(init?.body));
      if (body.messages[0].content.startsWith("Act as an advisory verifier")) {
        return completionResponse({
          assessments: [
            { id: "product-3", related: null, reason: "Not enough information about intended use." },
            { id: "product-2", related: true, reason: "This polish is a relevant supporting supply." },
            { id: "product-1", related: false, reason: "This cloth does not fit the draft's specified use." },
          ],
          warnings: [], needsCorrection: false,
        });
      }
      if (JSON.parse(body.messages[1].content).feedback) {
        return completionResponse(correctedSmartConditions);
      }
    }
    return base(input, init);
  });
}

const correctedSmartConditions = {
  ...smartConditions, titleIncludes: [{ match: "any", values: ["Paint Polish"] }],
};

async function prepareAutomaticRun(mode: "manual" | "smart") {
  fireEvent.click(await connectProvider());
  await screen.findByRole("button", { name: "Manage" });
  if (mode === "smart") fireEvent.change(screen.getByLabelText("Output mode"), { target: { value: "smart" } });
  fireEvent.change(screen.getByLabelText("Collection links"), { target: { value: sourceUrl } });
  fireEvent.change(screen.getByLabelText("Draft content"), { target: { value: "A draft about polishing supplies." } });
  return {
    run: screen.getByRole("button", { name: mode === "smart" ? "Suggest smart conditions" : "Find related products" }),
    summary: within(screen.getByRole("region", { name: "Summary" })),
  };
}

describe("RelatedProductFinderTool AI verification", () => {
  it.each(["manual", "smart"] as const)("automatically corrects %s output and copy after one recheck, even in Strict Mode", async (mode) => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal("navigator", { clipboard: { writeText }, userAgent: navigator.userAgent, platform: navigator.platform });
    const fetchMock = mockVerifiedFinderFetch(mode);
    vi.stubGlobal("fetch", fetchMock);
    render(<StrictMode><RelatedProductFinderTool /></StrictMode>);
    const { run, summary } = await prepareAutomaticRun(mode);
    expect(screen.getByText(/One correction and one recheck may add provider requests/)).toBeTruthy();
    expect(fetchMock.mock.calls.filter(([url]) => String(url).endsWith("/chat/completions"))).toHaveLength(0);
    fireEvent.change(screen.getByLabelText("Verifier model"), { target: { value: "model-b" } });
    expect(screen.getByText(/different model can still share/)).toBeTruthy();
    fireEvent.click(run);
    fireEvent.click(run);
    const reviewPanel = within(await screen.findByRole("region", { name: "AI result verifier" }));
    await reviewPanel.findByText("AI review needs attention — review flagged items.");
    await summary.findByRole("status");
    expect(screen.queryByRole("button", { name: "Verify results with AI" })).toBeNull();
    expect(reviewPanel.getByText(`Applied changes (${mode === "smart" ? 1 : 2})`)).toBeTruthy();
    expect(reviewPanel.getByText("Products reviewed").nextElementSibling?.textContent).toBe("3");
    expect(reviewPanel.getByText("Remaining mismatches").nextElementSibling?.textContent).toBe("0");
    expect(reviewPanel.getByText("Uncertain / conflicting", { selector: "dt" }).nextElementSibling?.textContent).toBe("1");
    expect(reviewPanel.getByText("This polish is a relevant supporting supply.")).toBeTruthy();
    const panel = within(screen.getByRole("region", { name: mode === "smart" ? "Samples passing title rules" : "Related Products" }));
    expect(panel.getByText("Paint Polish")).toBeTruthy();
    expect(panel.queryByText("Polishing Cloth")).toBeNull();
    if (mode === "smart") {
      expect(summary.getByText("Actual Shopify matches").nextElementSibling?.textContent).toContain("Unverified");
      const table = within(screen.getByRole("table", { name: "Suggested Shopify conditions" }));
      expect(table.getByRole("cell", { name: "Paint Polish" })).toBeTruthy();
      expect(table.queryByRole("cell", { name: "Polishing" })).toBeNull();
    }
    fireEvent.click(summary.getByRole("button", { name: mode === "smart" ? "Copy conditions" : "Copy result" }));
    await waitFor(() => expect(writeText).toHaveBeenCalledTimes(1));
    expect(writeText.mock.calls[0][0]).toContain("AI review needs attention — review flagged items.");
    if (mode === "smart") {
      expect(writeText.mock.calls[0][0]).toContain(formatSmartCollectionSuggestion(parseSmartCollectionSuggestion(correctedSmartConditions)));
    } else {
      expect(writeText.mock.calls[0][0]).toContain(`Unrelated Product\n\nSubmitted URL: ${sourceUrl}\n- Polishing Cloth\n- Heavy Metal Polish`);
    }
    const completions = fetchMock.mock.calls.filter(([url]) => String(url).endsWith("/chat/completions"));
    expect(completions).toHaveLength(mode === "smart" ? 4 : 3);
    expect(completions.map((call) => JSON.parse(String(call[1]?.body)).model))
      .toEqual(mode === "smart" ? ["model-a", "model-b", "model-a", "model-b"] : ["model-a", "model-b", "model-b"]);
    const reviewData = JSON.parse(JSON.parse(String(completions[1][1]?.body)).messages[1].content);
    expect(reviewData.products.map((product: { selected: boolean }) => product.selected)).toEqual([true, false, false]);
    const recheckData = JSON.parse(JSON.parse(String(completions.at(-1)![1]?.body)).messages[1].content);
    expect(recheckData.products.map((product: { selected: boolean }) => product.selected)).toEqual([false, true, false]);
    fireEvent.change(screen.getByLabelText("Draft content"), { target: { value: "Changed draft" } });
    expect(screen.queryByRole("region", { name: "AI result verifier" })).toBeNull();
    expect(summary.queryByRole("status")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "New check" }));
    expect((screen.getByLabelText("Verifier model") as HTMLSelectElement).value).toBe("");
    expect(fetchMock.mock.calls.filter(([url]) => String(url).endsWith("/chat/completions"))).toHaveLength(completions.length);
  });

  it.each(["manual", "smart"] as const)("rolls back %s corrections if the recheck fails, with no automatic retry", async (mode) => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal("navigator", { clipboard: { writeText }, userAgent: navigator.userAgent, platform: navigator.platform });
    const normalFetch = mockVerifiedFinderFetch(mode);
    let reviews = 0;
    const fetchMock = vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
      if (String(input).endsWith("/chat/completions")
        && JSON.parse(String(init?.body)).messages[0].content.startsWith("Act as an advisory verifier")
        && ++reviews === 2) {
        return Promise.resolve(completionResponse({ assessments: [], warnings: [] }));
      }
      return normalFetch(input, init);
    });
    vi.stubGlobal("fetch", fetchMock);
    render(<RelatedProductFinderTool />);
    const { run, summary } = await prepareAutomaticRun(mode);
    fireEvent.click(run);
    await within(await screen.findByRole("region", { name: "AI result verifier" })).findByText("AI verification incomplete — original output retained.");
    await summary.findByRole("status");
    const panel = within(screen.getByRole("region", { name: mode === "smart" ? "Samples passing title rules" : "Related Products" }));
    expect(panel.getByText("Polishing Cloth")).toBeTruthy();
    expect(panel.queryByText("Paint Polish")).toBeNull();
    expect(screen.getByText("No automatic changes were applied.")).toBeTruthy();
    expect(screen.queryByRole("list", { name: "AI product assessments" })).toBeNull();
    expect(within(screen.getByRole("region", { name: "AI result verifier" })).getByRole("alert").textContent).toContain("invalid review");
    expect(reviews).toBe(2);
    expect(fetchMock.mock.calls.filter(([url]) => String(url).endsWith("/chat/completions"))).toHaveLength(mode === "smart" ? 4 : 3);
    fireEvent.click(summary.getByRole("button", { name: mode === "smart" ? "Copy conditions" : "Copy result" }));
    await waitFor(() => expect(writeText).toHaveBeenCalledTimes(1));
    expect(writeText.mock.calls[0][0]).toContain("AI verification incomplete — original output retained.");
    if (mode === "smart") expect(writeText.mock.calls[0][0]).toContain(formatSmartCollectionSuggestion(parseSmartCollectionSuggestion(smartConditions)));
    else expect(writeText.mock.calls[0][0]).toContain(`Unrelated Product\n\nSubmitted URL: ${sourceUrl}\n- Paint Polish\n- Heavy Metal Polish`);
    fireEvent.click(run);
    await within(await screen.findByRole("region", { name: "AI result verifier" })).findByText("AI review needs attention — review flagged items.");
    expect(panel.getByText("Paint Polish")).toBeTruthy();
    expect(screen.queryByText("AI verification incomplete — original output retained.")).toBeNull();
  });

  it.each([
    { mode: "manual", action: "cancel" }, { mode: "smart", action: "cancel" },
    { mode: "manual", action: "lock" }, { mode: "smart", action: "lock" },
    { mode: "manual", action: "unmount" }, { mode: "smart", action: "unmount" },
  ] as const)("aborts $mode review on $action and ignores late results", async ({ mode, action }) => {
    const normalFetch = mockVerifiedFinderFetch(mode);
    let finish!: (response: Response) => void;
    let signal: AbortSignal | undefined;
    const fetchMock = vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
      if (String(input).endsWith("/chat/completions")
        && JSON.parse(String(init?.body)).messages[0].content.startsWith("Act as an advisory verifier")) {
        signal = init?.signal as AbortSignal;
        return new Promise<Response>((resolve) => { finish = resolve; });
      }
      return normalFetch(input, init);
    });
    vi.stubGlobal("fetch", fetchMock);
    const view = render(<RelatedProductFinderTool />);
    const { run, summary } = await prepareAutomaticRun(mode);
    fireEvent.click(run);
    await waitFor(() => expect(signal).toBeDefined());
    for (const label of ["Collection links", "Draft content", "Output mode", "Verifier model"]) {
      expect(screen.getByLabelText(label).hasAttribute("disabled")).toBe(true);
    }
    expect(summary.getByRole("button", { name: mode === "smart" ? "Copy conditions" : "Copy result" }).hasAttribute("disabled")).toBe(true);
    expect(screen.getByRole("button", { name: "New check" }).hasAttribute("disabled")).toBe(true);
    fireEvent.click(screen.getByRole("button", { name: "Manage" }));
    expect(screen.getByRole("button", { name: "Refresh models" }).hasAttribute("disabled")).toBe(true);
    for (const radio of screen.getAllByRole("radio")) expect(radio.hasAttribute("disabled")).toBe(true);
    if (action === "cancel") fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    if (action === "lock") fireEvent.click(screen.getByRole("button", { name: "Lock" }));
    if (action === "unmount") view.unmount();
    expect(signal?.aborted).toBe(true);
    // Deliberately ignore abort at the transport boundary; no late report may apply.
    await act(async () => {
      finish(completionResponse({
        assessments: productNames.map((_, index) => ({ id: `product-${index + 1}`, related: true, reason: "Late result." })),
        warnings: [], needsCorrection: false,
      }));
    });
    expect(fetchMock.mock.calls.filter(([url]) => String(url).endsWith("/chat/completions"))).toHaveLength(2);
    if (action === "unmount") {
      render(<RelatedProductFinderTool />);
      await screen.findByLabelText("Unlock your saved settings");
      expect(screen.queryByRole("region", { name: "AI result verifier" })).toBeNull();
    } else {
      expect(await within(screen.getByRole("region", { name: "AI result verifier" })).findByText("AI verification incomplete — original output retained.")).toBeTruthy();
      expect(within(screen.getByRole("region", { name: "AI result verifier" })).getByRole("alert").textContent).toContain("Request cancelled.");
      expect(screen.getByText("No automatic changes were applied.")).toBeTruthy();
      const panel = within(screen.getByRole("region", { name: mode === "smart" ? "Samples passing title rules" : "Related Products" }));
      expect(panel.getByText("Polishing Cloth")).toBeTruthy();
      expect(panel.queryByText("Paint Polish")).toBeNull();
      expect(summary.getByRole("button", { name: mode === "smart" ? "Copy conditions" : "Copy result" }).hasAttribute("disabled")).toBe(false);
      if (action === "lock") expect(screen.getByLabelText("Unlock your saved settings")).toBeTruthy();
    }
  });

  it("blocks an unavailable preselected reviewer until the user chooses an available model", async () => {
    const fetchMock = mockVerifiedFinderFetch("manual");
    vi.stubGlobal("fetch", fetchMock);
    render(<RelatedProductFinderTool />);
    const { run } = await prepareAutomaticRun("manual");
    fireEvent.change(screen.getByLabelText("Verifier model"), { target: { value: "model-b" } });
    fireEvent.click(screen.getByRole("button", { name: "Manage" }));
    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({ data: [{ id: "model-a" }] }), { status: 200 }));
    fireEvent.click(screen.getByRole("button", { name: "Refresh models" }));
    await screen.findByRole("option", { name: "Saved reviewer unavailable: model-b" });
    expect(run.hasAttribute("disabled")).toBe(true);
    fireEvent.click(run);
    expect(fetchMock.mock.calls.filter(([url]) => String(url).endsWith("/chat/completions"))).toHaveLength(0);
    fireEvent.change(screen.getByLabelText("Verifier model"), { target: { value: "" } });
    expect(run.hasAttribute("disabled")).toBe(false);
  });
});
