import { StrictMode } from "react";
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { RelatedProductFinderTool } from "./RelatedProductFinderTool";
import { CopyButton } from "@/components/ui/copy-button";
import { DEFAULT_API_BASE } from "@/lib/related-product/api";
import { MAX_SAMPLE_PRODUCTS_PER_URL } from "@/lib/related-product/collector";
import * as providerStorage from "@/lib/related-product/storage";
import {
  DEFAULT_SMART_COLLECTION_OPTIONS,
  formatSmartCollectionSuggestion,
  getSmartCollectionRows,
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

const sourceUrl = "https://shop.example/collections/polishing-kits";
const productNames = ["Polishing Cloth", "Paint Polish", "Heavy Metal Polish"];
const productHandles = ["polishing-cloth", "paint-polish", "heavy-metal-polish"];
const smartConditions = {
  categories: [],
  titleIncludes: [{ match: "any", values: ["Polishing"] }],
  titleExcludes: ["Replacement"],
  notes: ["Confirm category labels and stock in Shopify."],
};
const correctedSmartConditions = {
  ...smartConditions, titleIncludes: [{ match: "any", values: ["Paint Polish"] }],
};

function completionResponse(payload: unknown) {
  return new Response(JSON.stringify({ choices: [{ message: { content: JSON.stringify(payload) } }] }), {
    status: 200, headers: { "Content-Type": "application/json" },
  });
}

function mockFinderFetch(related: boolean[] = [true, false, false], suggestion: unknown = smartConditions) {
  return vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    if (url.endsWith("/models")) {
      return new Response(JSON.stringify({ data: [{ id: "model-a", owned_by: "provider" }] }), { status: 200 });
    }
    if (url.startsWith("/__related-product/page")) {
      const targetUrl = new URL(url, "http://localhost:8000").searchParams.get("url");
      expect(new URL(targetUrl!).pathname.endsWith("/products.json")).toBe(true);
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
      const data = JSON.parse(request.messages[1].content);
      if (data.samples) return completionResponse(suggestion);
      if (request.messages[0].content.startsWith("Act as an advisory verifier")) {
        return completionResponse({
          assessments: data.products.map((product: { id: string; selected: boolean | null }, index: number) => ({
            id: product.id, related: product.selected ?? related[index], reason: "Supplied details support this decision.",
          })),
          warnings: [], needsCorrection: false,
        });
      }
      return completionResponse({
        classifications: data.products.map((product: { id: string }, index: number) => ({
          id: product.id, related: related[index],
        })),
      });
    }
    throw new Error(`Unexpected request: ${url}`);
  });
}

function stubClipboard() {
  const writeText = vi.fn().mockResolvedValue(undefined);
  vi.stubGlobal("navigator", { clipboard: { writeText }, userAgent: navigator.userAgent, platform: navigator.platform });
  return writeText;
}

async function connectProvider() {
  fireEvent.change(await screen.findByLabelText("API key"), { target: { value: "test-api-key" } });
  fireEvent.change(screen.getByLabelText("Vault passphrase"), { target: { value: "a-long-test-passphrase" } });
  fireEvent.change(screen.getByLabelText("Confirm passphrase"), { target: { value: "a-long-test-passphrase" } });
  fireEvent.click(screen.getByRole("button", { name: "Connect & load models" }));
  return screen.findByRole("radio", { name: /model-a/ });
}

async function chooseModel() {
  fireEvent.click(await connectProvider());
  await waitFor(() => expect(screen.getByRole("button", { name: "Run check" }).hasAttribute("disabled")).toBe(false));
}

function setInputs(urls = sourceUrl) {
  fireEvent.change(screen.getByLabelText("Collection links"), { target: { value: urls } });
  fireEvent.change(screen.getByLabelText("Draft content"), { target: { value: "A draft about polishing supplies." } });
}

async function finishRun() {
  await waitFor(() => expect(screen.getByRole("button", { name: "Run check" }).hasAttribute("disabled")).toBe(false));
}

async function runCheck() {
  fireEvent.click(screen.getByRole("button", { name: "Run check" }));
  await finishRun();
}

function openDetails(text: string) {
  const summary = screen.getByText(text, { selector: "summary" });
  if (!summary.parentElement?.hasAttribute("open")) fireEvent.click(summary);
}

function completions(fetchMock: ReturnType<typeof mockFinderFetch>) {
  return fetchMock.mock.calls.filter(([url]) => String(url).endsWith("/chat/completions"))
    .map(([, init]) => JSON.parse(String(init?.body)));
}

describe("RelatedProductFinderTool visible model settings", () => {
  it("requires explicit selection, persists it, and never hides the sidebar when refreshing unavailable models", async () => {
    const fetchMock = mockFinderFetch().mockResolvedValueOnce(new Response(JSON.stringify({
      data: [{ id: "model-a" }, { id: "model-b" }],
    }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    render(<RelatedProductFinderTool />);
    const firstModel = await connectProvider();
    expect(firstModel.getAttribute("aria-checked")).toBe("false");
    expect(screen.getByRole("button", { name: "Run check" }).hasAttribute("disabled")).toBe(true);
    firstModel.focus();
    fireEvent.click(firstModel);
    await finishRun();
    expect(document.activeElement).toBe(firstModel);
    expect(screen.queryByRole("button", { name: "Manage" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Hide settings" })).toBeNull();
    expect(screen.getByText("Connected")).toBeTruthy();
    expect((await providerStorage.unlockProviderSettings("a-long-test-passphrase")).selectedModel).toBe("model-a");
    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({ data: [{ id: "model-b" }] }), { status: 200 }));
    fireEvent.click(screen.getByRole("button", { name: "Refresh models" }));
    await screen.findByText("Saved model unavailable: model-a");
    expect(screen.getByRole("radio", { name: /model-b/ }).getAttribute("aria-checked")).toBe("false");
    expect(screen.getByRole("button", { name: "Run check" }).hasAttribute("disabled")).toBe(true);
    expect((await providerStorage.unlockProviderSettings("a-long-test-passphrase")).selectedModel).toBe("model-a");
    fireEvent.click(screen.getByRole("radio", { name: /model-b/ }));
    await finishRun();
    expect((await providerStorage.unlockProviderSettings("a-long-test-passphrase")).selectedModel).toBe("model-b");
    expect(screen.getByRole("radio", { name: /model-b/ }).getAttribute("aria-checked")).toBe("true");
  });

  it("waits for queued model saves without hiding settings or stealing draft focus", async () => {
    vi.stubGlobal("fetch", mockFinderFetch().mockResolvedValueOnce(new Response(JSON.stringify({
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
    finishFirst();
    await waitFor(() => expect(save).toHaveBeenCalledTimes(2));
    expect(screen.getByRole("radio", { name: /model-b/ }).getAttribute("aria-checked")).toBe("true");
    expect(screen.getByText("Saving selection…")).toBeTruthy();
    const draft = screen.getByLabelText("Draft content");
    draft.focus();
    finishLatest();
    await finishRun();
    expect(screen.queryByText("Saving selection…")).toBeNull();
    expect(document.activeElement).toBe(draft);
    expect((await providerStorage.unlockProviderSettings("a-long-test-passphrase")).selectedModel).toBe("model-b");
  });

  it("keeps persistence failures visible without changing encrypted saved settings", async () => {
    vi.stubGlobal("fetch", mockFinderFetch());
    render(<RelatedProductFinderTool />);
    const model = await connectProvider();
    vi.spyOn(Storage.prototype, "setItem").mockImplementationOnce(() => { throw new Error("Storage is full"); });
    fireEvent.click(model);
    await screen.findByText("Could not save encrypted settings in this browser.");
    expect(screen.getByRole("radio", { name: /model-a/ })).toBeTruthy();
    expect((await providerStorage.unlockProviderSettings("a-long-test-passphrase")).selectedModel).toBe("");
  });

  it.each([true, false])("validates saved model availability after unlocking: %s", async (available) => {
    await providerStorage.saveProviderSettings({
      apiBase: DEFAULT_API_BASE, apiKey: "test-api-key", selectedModel: "model-a",
    }, "a-long-test-passphrase");
    vi.stubGlobal("fetch", mockFinderFetch().mockResolvedValueOnce(new Response(JSON.stringify({
      data: [{ id: available ? "model-a" : "model-b" }],
    }), { status: 200 })));
    render(<RelatedProductFinderTool />);
    fireEvent.change(await screen.findByLabelText("Unlock your saved settings"), { target: { value: "a-long-test-passphrase" } });
    fireEvent.click(screen.getByRole("button", { name: "Unlock & load models" }));
    if (available) {
      await screen.findByRole("radio", { name: /model-a/ });
      expect(screen.getByRole("radio", { name: /model-a/ }).getAttribute("aria-checked")).toBe("true");
      fireEvent.click(screen.getByRole("button", { name: "Lock" }));
      await screen.findByLabelText("Unlock your saved settings");
    } else {
      await screen.findByText("Saved model unavailable: model-a");
      expect(screen.getByRole("radio", { name: /model-b/ }).getAttribute("aria-checked")).toBe("false");
      expect(screen.getByRole("button", { name: "Run check" }).hasAttribute("disabled")).toBe(true);
    }
    expect(screen.queryByRole("button", { name: "Manage" })).toBeNull();
  });

  it("keeps provider loading errors visible and permits refreshing models after unlock", async () => {
    await providerStorage.saveProviderSettings({
      apiBase: DEFAULT_API_BASE, apiKey: "test-api-key", selectedModel: "model-a",
    }, "a-long-test-passphrase");
    vi.stubGlobal("fetch", mockFinderFetch().mockResolvedValueOnce(new Response(JSON.stringify({
      error: { message: "Check your provider access." },
    }), { status: 401 })));
    render(<RelatedProductFinderTool />);
    fireEvent.change(await screen.findByLabelText("Unlock your saved settings"), { target: { value: "a-long-test-passphrase" } });
    fireEvent.click(screen.getByRole("button", { name: "Unlock & load models" }));
    await screen.findByText("Provider error (401): Check your provider access.");
    fireEvent.click(screen.getByRole("button", { name: "Refresh models" }));
    await screen.findByRole("radio", { name: /model-a/ });
    expect(screen.getByRole("radio", { name: /model-a/ }).getAttribute("aria-checked")).toBe("true");
  });
});

describe("RelatedProductFinderTool simultaneous outputs", () => {
  it("shows the sidebar, inputs and all three output panels without an output-mode selector", async () => {
    render(<RelatedProductFinderTool />);
    await screen.findByLabelText("API key");
    for (const name of ["Smart Collection Suggestions", "Related Products", "Unrelated Products", "Summary"]) {
      expect(screen.getByRole("region", { name })).toBeTruthy();
    }
    expect(screen.getByRole("complementary", { name: "Connection settings and summary" })).toBeTruthy();
    expect(screen.queryByLabelText("Output mode")).toBeNull();
    expect(screen.getByLabelText("Collection links")).toBeTruthy();
    expect(screen.getByLabelText("Draft content")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Copy all final outputs" }).hasAttribute("disabled")).toBe(true);
    expect(screen.getByRole("button", { name: "Copy result" }).hasAttribute("disabled")).toBe(true);
    expect(screen.getByRole("button", { name: "New check" }).hasAttribute("disabled")).toBe(true);
  });

  it.each([
    { related: [true, false, false], summary: "Check complete", copied: `Unrelated Product\n\nSubmitted URL: ${sourceUrl}\n- Paint Polish\n- Heavy Metal Polish` },
    { related: [true, true, true], summary: "All related", copied: "All related" },
    { related: [false, false, false], summary: "All unrelated", copied: "All unrelated" },
  ])("preserves complete product groups and the legacy copy contract: $summary", async ({ related, summary, copied }) => {
    const writeText = stubClipboard();
    const fetchMock = mockFinderFetch(related);
    vi.stubGlobal("fetch", fetchMock);
    render(<RelatedProductFinderTool />);
    await chooseModel();
    setInputs();
    await runCheck();
    const summaryPanel = within(screen.getByRole("region", { name: "Summary" }));
    expect(summaryPanel.getByRole("status").textContent).toBe(summary);
    expect(summaryPanel.getByText("Unique products").nextElementSibling?.textContent).toBe("3");
    expect(summaryPanel.getByText("Related").nextElementSibling?.textContent).toBe(String(related.filter(Boolean).length));
    expect(summaryPanel.getByText("Unrelated").nextElementSibling?.textContent).toBe(String(related.filter((value) => !value).length));
    productNames.forEach((name, index) => {
      const panel = within(screen.getByRole("region", { name: related[index] ? "Related Products" : "Unrelated Products" }));
      const link = panel.getByRole("link", { name });
      expect(link.getAttribute("href")).toBe(`https://shop.example/products/${productHandles[index]}`);
      expect(link.getAttribute("rel")).toBe("noopener noreferrer");
    });
    expect(completions(fetchMock)).toHaveLength(4);
    expect(screen.getByRole("button", { name: "Copy Title contains → any of value: Polishing" })).toBeTruthy();
    fireEvent.click(summaryPanel.getByRole("button", { name: "Copy result" }));
    await waitFor(() => expect(writeText).toHaveBeenCalledWith(copied));
    const saved = localStorage.getItem("related-product-finder.v1");
    fireEvent.click(screen.getByRole("button", { name: "New check" }));
    expect((screen.getByLabelText("Collection links") as HTMLTextAreaElement).value).toBe("");
    expect((screen.getByLabelText("Draft content") as HTMLTextAreaElement).value).toBe("");
    expect(screen.queryByRole("link", { name: "Polishing Cloth" })).toBeNull();
    expect(document.activeElement).toBe(screen.getByLabelText("Collection links"));
    expect(screen.getByRole("radio", { name: /model-a/ })).toBeTruthy();
    expect(localStorage.getItem("related-product-finder.v1")).toBe(saved);
    expect(await providerStorage.unlockProviderSettings("a-long-test-passphrase")).toEqual({
      apiBase: DEFAULT_API_BASE, apiKey: "test-api-key", selectedModel: "model-a",
    });
    expect(screen.getByRole("button", { name: "Copy result" }).hasAttribute("disabled")).toBe(true);
    setInputs();
    await runCheck();
    expect(summaryPanel.getByRole("status").textContent).toBe(summary);
  });

  it("copies exact names, condition values, conditions, panels and final outputs without duplicate names from overlapping sources", async () => {
    const writeText = stubClipboard();
    vi.stubGlobal("fetch", mockFinderFetch());
    render(<RelatedProductFinderTool />);
    await chooseModel();
    setInputs(`${sourceUrl}\nhttps://shop.example/collections/other-supplies`);
    await runCheck();
    expect(screen.getAllByRole("button", { name: "Copy product name: Polishing Cloth" })).toHaveLength(1);
    expect(screen.getByRole("region", { name: "Product matching review" }).closest("details")?.hasAttribute("open")).toBe(false);
    const relatedPanel = within(screen.getByRole("region", { name: "Related Products" }));
    expect(relatedPanel.getByText("Submitted sources", { selector: "summary" }).parentElement?.hasAttribute("open")).toBe(false);
    const row = getSmartCollectionRows(parseSmartCollectionSuggestion(smartConditions))[0];
    for (const [name, text] of [
      ["Copy product name: Polishing Cloth", "Polishing Cloth"],
      ["Copy product name: Paint Polish", "Paint Polish"],
      [`Copy ${row.field} ${row.operator} value: Polishing`, "Polishing"],
      [`Copy ${row.field} ${row.operator} condition`, `${row.field} → ${row.operator}\nPolishing`],
      ["Copy all related product names", "Polishing Cloth"],
      ["Copy all unrelated product names", "Paint Polish\nHeavy Metal Polish"],
    ]) {
      fireEvent.click(screen.getByRole("button", { name }));
      await waitFor(() => expect(writeText).toHaveBeenLastCalledWith(text));
    }
    fireEvent.click(screen.getByRole("button", { name: "Copy smart collection suggestions" }));
    await waitFor(() => expect(writeText).toHaveBeenLastCalledWith(formatSmartCollectionSuggestion(parseSmartCollectionSuggestion(smartConditions))));
    fireEvent.click(screen.getByRole("button", { name: "Copy all final outputs" }));
    await waitFor(() => expect(writeText).toHaveBeenCalledTimes(8));
    expect(writeText.mock.lastCall![0]).toContain("Related Products\nPolishing Cloth\n\nUnrelated Products\nPaint Polish\nHeavy Metal Polish");
    expect(writeText.mock.lastCall![0]).toContain(formatSmartCollectionSuggestion(parseSmartCollectionSuggestion(smartConditions)));
    fireEvent.click(relatedPanel.getByText("Submitted sources", { selector: "summary" }));
    expect(relatedPanel.getByRole("link", { name: sourceUrl }).getAttribute("href")).toBe(sourceUrl);
  });

  it("keeps validation errors outside completed results and resets without forgetting the key", async () => {
    const fetchMock = mockFinderFetch();
    vi.stubGlobal("fetch", fetchMock);
    render(<RelatedProductFinderTool />);
    await chooseModel();
    await runCheck();
    expect(within(screen.getByRole("region", { name: "Check products against a draft" })).getByRole("alert").textContent)
      .toContain("Add one or more collection or product URLs.");
    expect(within(screen.getByRole("region", { name: "Summary" })).queryByRole("status")).toBeNull();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole("button", { name: "New check" }));
    expect(screen.queryByText("Add one or more collection or product URLs.")).toBeNull();
    expect(screen.getByRole("button", { name: "Lock" })).toBeTruthy();
    expect(document.activeElement).toBe(screen.getByLabelText("Collection links"));
  });

  it("retains smart suggestions when classification fails and keeps model settings visible", async () => {
    const base = mockFinderFetch();
    vi.stubGlobal("fetch", vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
      if (String(input).endsWith("/chat/completions")) {
        const data = JSON.parse(JSON.parse(String(init?.body)).messages[1].content);
        if (data.products && !data.mode) return Promise.resolve(new Response(JSON.stringify({
          error: { message: "Model access was revoked." },
        }), { status: 403 }));
      }
      return base(input, init);
    }));
    render(<RelatedProductFinderTool />);
    await chooseModel();
    setInputs();
    await runCheck();
    expect(screen.getByText(/Product matching: Provider error \(403\)/)).toBeTruthy();
    expect(screen.getByRole("radio", { name: /model-a/ })).toBeTruthy();
    expect(within(screen.getByRole("region", { name: "Related Products" })).queryByRole("link", { name: "Polishing Cloth" })).toBeNull();
    expect(screen.getByRole("button", { name: "Copy Title contains → any of value: Polishing" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Copy result" }).hasAttribute("disabled")).toBe(true);
    expect(screen.getByRole("button", { name: "Copy all final outputs" }).hasAttribute("disabled")).toBe(false);
  });

  it("retains verified product matching when smart conditions are invalid", async () => {
    vi.stubGlobal("fetch", mockFinderFetch(undefined, { ...smartConditions, status: "Draft" }));
    render(<RelatedProductFinderTool />);
    await chooseModel();
    setInputs();
    await runCheck();
    expect(screen.getByText("The selected model returned invalid smart-collection conditions. Try another model.")).toBeTruthy();
    expect(within(screen.getByRole("region", { name: "Related Products" })).getByRole("link", { name: "Polishing Cloth" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Copy smart collection suggestions" }).hasAttribute("disabled")).toBe(true);
    expect(screen.getByRole("button", { name: "Copy result" }).hasAttribute("disabled")).toBe(false);
  });

  it("preserves cross-store matching but does not generate store-wide rules across different stores", async () => {
    const fetchMock = mockFinderFetch();
    vi.stubGlobal("fetch", fetchMock);
    render(<RelatedProductFinderTool />);
    await chooseModel();
    setInputs(`${sourceUrl}\nhttps://different.example/collections/pins`);
    await runCheck();
    expect(screen.getByText(/Smart collection suggestions require URLs from one Shopify store/)).toBeTruthy();
    expect(within(screen.getByRole("region", { name: "Related Products" })).getByRole("link", { name: "Polishing Cloth" })).toBeTruthy();
    expect(completions(fetchMock)).toHaveLength(2);
    expect(screen.getByRole("button", { name: "Copy smart collection suggestions" }).hasAttribute("disabled")).toBe(true);
  });

  it("makes no-sample fallback explicit instead of presenting a partial product audit", async () => {
    const base = mockFinderFetch();
    vi.stubGlobal("fetch", vi.fn((input: RequestInfo | URL, init?: RequestInit) => (
      String(input).startsWith("/__related-product/page") ? Promise.resolve(new Response("blocked", { status: 429 })) : base(input, init)
    )));
    render(<RelatedProductFinderTool />);
    await chooseModel();
    setInputs();
    await runCheck();
    expect(screen.getByText(/No product samples were readable/)).toBeTruthy();
    expect(screen.queryByRole("link", { name: "Polishing Cloth" })).toBeNull();
    const summary = within(screen.getByRole("region", { name: "Summary" }));
    expect(summary.getByText("Unique products").nextElementSibling?.textContent).toBe("—");
    expect(summary.getByText("Smart samples").nextElementSibling?.textContent).toBe("0");
    openDetails("Reasons, sources & initial output");
    expect(within(screen.getByRole("region", { name: "Smart collection review" })).getByRole("status").textContent)
      .toBe("AI verification incomplete — original output retained.");
    expect(screen.getByText(/No sample from/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "New check" }));
    expect(screen.getByRole("button", { name: "Copy smart collection suggestions" }).hasAttribute("disabled")).toBe(true);
    expect(screen.getByRole("radio", { name: /model-a/ })).toBeTruthy();
  });

  it("uses bounded deduplicated per-source samples without repeating a successful full collection", async () => {
    const base = mockFinderFetch();
    const pageRequests: string[] = [];
    const calls: Array<{ products?: unknown[]; samples?: unknown[]; mode?: string }> = [];
    vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.startsWith("/__related-product/page")) {
        const target = new URL(new URL(url, "http://localhost").searchParams.get("url")!);
        pageRequests.push(target.href);
        const source = target.pathname.includes("polishing-kits") ? "a" : "b";
        return new Response(JSON.stringify({ contents: JSON.stringify({
          products: Array.from({ length: MAX_SAMPLE_PRODUCTS_PER_URL + 5 }, (_, index) => {
            const handle = index < 5 ? `shared-${index}` : `${source}-${index}`;
            return { title: `Target ${handle}`, handle, body_html: "Sample details", variants: [] };
          }),
        }) }), { status: 200 });
      }
      if (url.endsWith("/chat/completions")) {
        const data = JSON.parse(JSON.parse(String(init?.body)).messages[1].content);
        calls.push(data);
        if (data.samples) return completionResponse({ categories: [], titleIncludes: [{ match: "any", values: ["Target"] }], titleExcludes: [], notes: [] });
        if (data.mode) return completionResponse({
          assessments: data.products.map((product: { id: string; selected: boolean }) => ({
            id: product.id, related: product.selected, reason: "Supported.",
          })), warnings: [], needsCorrection: false,
        });
        return completionResponse({ classifications: data.products.map((product: { id: string }) => ({ id: product.id, related: true })) });
      }
      return base(input, init);
    }));
    render(<RelatedProductFinderTool />);
    await chooseModel();
    setInputs(`${sourceUrl}\nhttps://shop.example/collections/other`);
    await runCheck();
    expect(pageRequests).toHaveLength(2);
    expect(calls.filter((call) => call.products && !call.mode).flatMap((call) => call.products!)).toHaveLength(85);
    expect(calls.find((call) => call.samples)?.samples).toHaveLength(75);
    expect(screen.getAllByRole("button", { name: "Copy product name: Target shared-0" })).toHaveLength(1);
  });

  it("never turns samples from an incomplete paginated feed into complete matching results", async () => {
    const base = mockFinderFetch();
    vi.stubGlobal("fetch", vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.startsWith("/__related-product/page")) {
        const target = new URL(new URL(url, "http://localhost").searchParams.get("url")!);
        if (target.searchParams.get("page") === "2") return Promise.resolve(new Response("blocked", { status: 500 }));
        const count = Number(target.searchParams.get("limit"));
        return Promise.resolve(new Response(JSON.stringify({ contents: JSON.stringify({
          products: Array.from({ length: count }, (_, index) => ({
            title: `Polishing ${index}`, handle: `polishing-${index}`, body_html: "A polishing supply.", variants: [],
          })),
        }) }), { status: 200 }));
      }
      return base(input, init);
    }));
    render(<RelatedProductFinderTool />);
    await chooseModel();
    setInputs();
    await runCheck();
    expect(screen.getByText(/Product matching: The Shopify feed stopped after 250 products. No partial result was used./)).toBeTruthy();
    expect(within(screen.getByRole("region", { name: "Summary" })).getByText("Unique products").nextElementSibling?.textContent).toBe("—");
    expect(within(screen.getByRole("region", { name: "Summary" })).getByText("Smart samples").nextElementSibling?.textContent).toBe(String(MAX_SAMPLE_PRODUCTS_PER_URL));
    expect(screen.getByRole("button", { name: "Copy smart collection suggestions" }).hasAttribute("disabled")).toBe(false);
    expect(screen.getByRole("button", { name: "Copy all related product names" }).hasAttribute("disabled")).toBe(true);
  });
});

describe("RelatedProductFinderTool client smart settings", () => {
  it("uses per-client settings for generation, preview and copying and resets them for the next client", async () => {
    const writeText = stubClipboard();
    const categoryConditions = { ...smartConditions, categories: ["Cleaning Supplies"] };
    const fetchMock = mockFinderFetch(undefined, categoryConditions);
    vi.stubGlobal("fetch", fetchMock);
    render(<RelatedProductFinderTool />);
    await chooseModel();
    setInputs();
    openDetails("Smart collection settings");
    fireEvent.click(screen.getByLabelText("Add category condition"));
    fireEvent.change(screen.getByLabelText("Available categories (optional)"), { target: { value: "Cleaning Supplies\nShop Supplies" } });
    fireEvent.change(screen.getByLabelText("Match conditions"), { target: { value: "any" } });
    fireEvent.click(screen.getByLabelText("Include subcategories"));
    fireEvent.change(screen.getByLabelText("Product status"), { target: { value: "Draft" } });
    fireEvent.change(screen.getByLabelText("Inventory comparison"), { target: { value: "is less than" } });
    fireEvent.change(screen.getByLabelText("Inventory value"), { target: { value: "5" } });
    await runCheck();
    const options = parseSmartCollectionOptions({
      ...DEFAULT_SMART_COLLECTION_OPTIONS, useCategory: true, match: "any", includeSubcategories: false, status: "Draft",
      inventory: { operator: "is less than", value: 5 }, availableCategories: ["Cleaning Supplies", "Shop Supplies"],
    });
    expect(JSON.parse(completions(fetchMock).find((call) => JSON.parse(call.messages[1].content).samples).messages[1].content).clientOptions).toEqual(options);
    expect(screen.getAllByText(SMART_COLLECTION_ANY_NOTICE).length).toBeGreaterThan(0);
    expect(screen.getByText("Products → Match ANY conditions")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Copy Category is → any of value: Cleaning Supplies" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Copy smart collection suggestions" }));
    await waitFor(() => expect(writeText).toHaveBeenCalledWith(formatSmartCollectionSuggestion(parseSmartCollectionSuggestion(categoryConditions, options), options)));
    openDetails("Rule details & notes");
    expect(screen.getByText("Include subcategories: OFF. Add each title exclusion as its own condition.")).toBeTruthy();
    fireEvent.change(screen.getByLabelText("Inventory value"), { target: { value: "10" } });
    expect(screen.getByRole("button", { name: "Copy smart collection suggestions" }).hasAttribute("disabled")).toBe(true);
    expect(screen.getByRole("button", { name: "Copy result" }).hasAttribute("disabled")).toBe(true);
    fireEvent.click(screen.getByRole("button", { name: "New check" }));
    expect((screen.getByLabelText("Available categories (optional)") as HTMLTextAreaElement).value).toBe("");
    expect((screen.getByLabelText("Match conditions") as HTMLSelectElement).value).toBe("all");
    expect((screen.getByLabelText("Product status") as HTMLSelectElement).value).toBe("Active");
    expect((screen.getByLabelText("Inventory value") as HTMLInputElement).value).toBe("0");
    expect(screen.getByLabelText("Include subcategories").getAttribute("aria-checked")).toBe("true");
    expect(screen.getByLabelText("Add category condition").getAttribute("aria-checked")).toBe("false");
  });

  it("omits disabled status and stock instead of silently restoring defaults", async () => {
    vi.stubGlobal("fetch", mockFinderFetch());
    render(<RelatedProductFinderTool />);
    await chooseModel();
    setInputs();
    openDetails("Smart collection settings");
    fireEvent.change(screen.getByLabelText("Product status"), { target: { value: "any" } });
    fireEvent.click(screen.getByLabelText("Add inventory condition"));
    expect(screen.queryByLabelText("Inventory value")).toBeNull();
    await runCheck();
    const panel = within(screen.getByRole("region", { name: "Smart Collection Suggestions" }));
    expect(panel.queryByRole("region", { name: /Status .* condition/ })).toBeNull();
    expect(panel.queryByRole("region", { name: /Inventory stock .* condition/ })).toBeNull();
  });

  it("validates options before page/model calls and rejects categories outside the allowlist", async () => {
    const fetchMock = mockFinderFetch(undefined, { ...smartConditions, categories: ["Cleaning Supplies"] });
    vi.stubGlobal("fetch", fetchMock);
    render(<RelatedProductFinderTool />);
    await chooseModel();
    setInputs();
    openDetails("Smart collection settings");
    fireEvent.change(screen.getByLabelText("Inventory value"), { target: { value: "" } });
    await runCheck();
    expect(screen.getByText(/Check smart collection settings: use valid options/)).toBeTruthy();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    fireEvent.change(screen.getByLabelText("Inventory value"), { target: { value: "0" } });
    fireEvent.click(screen.getByLabelText("Add category condition"));
    fireEvent.change(screen.getByLabelText("Available categories (optional)"), { target: { value: "Lawn Seeds\nSprinklers" } });
    await runCheck();
    expect(screen.getByText("The model suggested a category outside your available categories. Review the list or try again.")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Copy smart collection suggestions" }).hasAttribute("disabled")).toBe(true);
    expect(within(screen.getByRole("region", { name: "Related Products" })).getByRole("link", { name: "Polishing Cloth" })).toBeTruthy();
  });

  it("does not confuse category-only smart suggestions with editorial matches or evaluated title matches", async () => {
    vi.stubGlobal("fetch", mockFinderFetch(undefined, { categories: ["Cleaning Supplies"], titleIncludes: [], titleExcludes: [], notes: [] }));
    render(<RelatedProductFinderTool />);
    await chooseModel();
    setInputs();
    openDetails("Smart collection settings");
    fireEvent.click(screen.getByLabelText("Add category condition"));
    await runCheck();
    openDetails("Reasons, sources & initial output");
    expect(screen.getByText("Sampled titles matching rules").nextElementSibling?.textContent).toBe("Not evaluated");
    expect(screen.getByText(/No title conditions were suggested/)).toBeTruthy();
    expect(within(screen.getByRole("region", { name: "Related Products" })).getByRole("link", { name: "Polishing Cloth" })).toBeTruthy();
    expect(within(screen.getByRole("region", { name: "Unrelated Products" })).getByRole("link", { name: "Paint Polish" })).toBeTruthy();
  });
});

function mockVerifiedFinderFetch() {
  const base = mockFinderFetch();
  return vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    if (String(input).endsWith("/models")) return new Response(JSON.stringify({ data: [{ id: "model-a" }, { id: "model-b" }] }), { status: 200 });
    if (String(input).endsWith("/chat/completions")) {
      const body = JSON.parse(String(init?.body));
      if (body.messages[0].content.startsWith("Act as an advisory verifier")) return completionResponse({
        assessments: [
          { id: "product-3", related: null, reason: "Not enough information about intended use." },
          { id: "product-2", related: true, reason: "This polish is a relevant supporting supply." },
          { id: "product-1", related: false, reason: "This cloth does not fit the draft's specified use." },
        ],
        warnings: [], needsCorrection: false,
      });
      if (JSON.parse(body.messages[1].content).feedback) return completionResponse(correctedSmartConditions);
    }
    return base(input, init);
  });
}

describe("RelatedProductFinderTool independent AI reviews", () => {
  it("corrects both outputs once in Strict Mode, routes the reviewer explicitly and copies final rather than initial results", async () => {
    const writeText = stubClipboard();
    const fetchMock = mockVerifiedFinderFetch();
    vi.stubGlobal("fetch", fetchMock);
    render(<StrictMode><RelatedProductFinderTool /></StrictMode>);
    await chooseModel();
    setInputs();
    expect(completions(fetchMock)).toHaveLength(0);
    fireEvent.change(screen.getByLabelText("Verifier model"), { target: { value: "model-b" } });
    expect(screen.getByText(/different model can still share/)).toBeTruthy();
    const run = screen.getByRole("button", { name: "Run check" });
    fireEvent.click(run);
    fireEvent.click(run);
    await finishRun();
    expect(within(screen.getByRole("region", { name: "Related Products" })).getByRole("link", { name: "Paint Polish" })).toBeTruthy();
    expect(within(screen.getByRole("region", { name: "Unrelated Products" })).getByRole("link", { name: "Polishing Cloth" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Copy Title contains → any of value: Paint Polish" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Copy Title contains → any of value: Polishing" })).toBeNull();
    expect(screen.getByRole("region", { name: "Product matching review" }).closest("details")?.hasAttribute("open")).toBe(false);
    openDetails("Reasons, sources & initial output");
    const manual = within(screen.getByRole("region", { name: "Product matching review" }));
    const smart = within(screen.getByRole("region", { name: "Smart collection review" }));
    expect(manual.getByText("Applied changes (2)")).toBeTruthy();
    expect(smart.getByText("Applied changes (1)")).toBeTruthy();
    for (const panel of [manual, smart]) {
      expect(panel.getByText("Products reviewed").nextElementSibling?.textContent).toBe("3");
      expect(panel.getByText("Remaining mismatches").nextElementSibling?.textContent).toBe("0");
      expect(panel.getByText("Uncertain / conflicting", { selector: "dt" }).nextElementSibling?.textContent).toBe("1");
      expect(panel.getByText("This polish is a relevant supporting supply.")).toBeTruthy();
    }
    expect(screen.getByText("Actual Shopify matches").nextElementSibling?.textContent).toContain("Unverified");
    fireEvent.click(screen.getByRole("button", { name: "Copy result" }));
    await waitFor(() => expect(writeText).toHaveBeenCalledTimes(1));
    expect(writeText.mock.lastCall![0]).toContain(`Unrelated Product\n\nSubmitted URL: ${sourceUrl}\n- Polishing Cloth\n- Heavy Metal Polish`);
    expect(writeText.mock.lastCall![0]).toContain("AI review needs attention — review flagged items.");
    fireEvent.click(screen.getByRole("button", { name: "Copy smart collection suggestions" }));
    await waitFor(() => expect(writeText).toHaveBeenCalledTimes(2));
    expect(writeText.mock.lastCall![0]).toContain(formatSmartCollectionSuggestion(parseSmartCollectionSuggestion(correctedSmartConditions)));
    const requests = completions(fetchMock);
    expect(requests).toHaveLength(7);
    expect(requests.map((request) => request.model)).toEqual(["model-a", "model-b", "model-b", "model-a", "model-b", "model-a", "model-b"]);
    expect(JSON.parse(requests[1].messages[1].content).products.map((product: { selected: boolean }) => product.selected)).toEqual([true, false, false]);
    expect(JSON.parse(requests[6].messages[1].content).products.map((product: { selected: boolean }) => product.selected)).toEqual([false, true, false]);
    fireEvent.change(screen.getByLabelText("Draft content"), { target: { value: "Changed draft" } });
    expect(screen.queryByRole("region", { name: "Product matching review" })).toBeNull();
    expect(screen.getByRole("button", { name: "Copy all final outputs" }).hasAttribute("disabled")).toBe(true);
    fireEvent.click(screen.getByRole("button", { name: "New check" }));
    expect((screen.getByLabelText("Verifier model") as HTMLSelectElement).value).toBe("");
    expect(completions(fetchMock)).toHaveLength(7);
  });

  it.each(["manual", "smart"] as const)("rolls back only the %s correction if its recheck fails, without automatic retry", async (mode) => {
    const writeText = stubClipboard();
    const base = mockVerifiedFinderFetch();
    let reviews = 0;
    const fetchMock = vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
      if (String(input).endsWith("/chat/completions")) {
        const body = JSON.parse(String(init?.body));
        if (body.messages[0].content.startsWith("Act as an advisory verifier")
          && JSON.parse(body.messages[1].content).mode === mode && ++reviews === 2) {
          return Promise.resolve(completionResponse({ assessments: [], warnings: [] }));
        }
      }
      return base(input, init);
    });
    vi.stubGlobal("fetch", fetchMock);
    render(<RelatedProductFinderTool />);
    await chooseModel();
    setInputs();
    await runCheck();
    openDetails("Reasons, sources & initial output");
    const panel = within(screen.getByRole("region", { name: mode === "manual" ? "Product matching review" : "Smart collection review" }));
    expect(panel.getByRole("status").textContent).toBe("AI verification incomplete — original output retained.");
    expect(panel.getByText("No automatic changes were applied.")).toBeTruthy();
    expect(panel.queryByRole("list", { name: "AI product assessments" })).toBeNull();
    expect(panel.getByRole("alert").textContent).toContain("invalid review");
    expect(reviews).toBe(2);
    expect(completions(fetchMock)).toHaveLength(7);
    if (mode === "manual") {
      expect(within(screen.getByRole("region", { name: "Related Products" })).getByRole("link", { name: "Polishing Cloth" })).toBeTruthy();
      fireEvent.click(screen.getByRole("button", { name: "Copy result" }));
    } else {
      expect(screen.getByRole("button", { name: "Copy Title contains → any of value: Polishing" })).toBeTruthy();
      expect(within(screen.getByRole("region", { name: "Related Products" })).getByRole("link", { name: "Paint Polish" })).toBeTruthy();
      fireEvent.click(screen.getByRole("button", { name: "Copy smart collection suggestions" }));
    }
    await waitFor(() => expect(writeText).toHaveBeenCalledTimes(1));
    expect(writeText.mock.lastCall![0]).toContain("AI verification incomplete — original output retained.");
    await runCheck();
    openDetails("Reasons, sources & initial output");
    expect(within(screen.getByRole("region", { name: mode === "manual" ? "Product matching review" : "Smart collection review" })).getByRole("status").textContent)
      .toBe("AI review needs attention — review flagged items.");
  });

  it.each([
    { mode: "manual", action: "cancel" }, { mode: "smart", action: "cancel" },
    { mode: "manual", action: "lock" }, { mode: "smart", action: "lock" },
    { mode: "manual", action: "unmount" }, { mode: "smart", action: "unmount" },
  ] as const)("aborts $mode review on $action, retains completed work and ignores late results", async ({ mode, action }) => {
    const base = mockVerifiedFinderFetch();
    let finish!: (response: Response) => void;
    let signal: AbortSignal | undefined;
    const fetchMock = vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
      if (String(input).endsWith("/chat/completions")) {
        const body = JSON.parse(String(init?.body));
        if (body.messages[0].content.startsWith("Act as an advisory verifier") && JSON.parse(body.messages[1].content).mode === mode) {
          signal = init?.signal as AbortSignal;
          return new Promise<Response>((resolve) => { finish = resolve; });
        }
      }
      return base(input, init);
    });
    vi.stubGlobal("fetch", fetchMock);
    const view = render(<RelatedProductFinderTool />);
    await chooseModel();
    setInputs();
    fireEvent.click(screen.getByRole("button", { name: "Run check" }));
    await waitFor(() => expect(signal).toBeDefined());
    const relatedPanel = within(screen.getByRole("region", { name: "Related Products" }));
    if (mode === "manual") {
      expect(relatedPanel.queryByRole("link", { name: "Polishing Cloth" })).toBeNull();
    } else {
      expect(relatedPanel.getByRole("link", { name: "Paint Polish" })).toBeTruthy();
      expect(screen.queryByRole("button", { name: "Copy Title contains → any of value: Polishing" })).toBeNull();
    }
    for (const label of ["Collection links", "Draft content", "Verifier model"]) expect(screen.getByLabelText(label).matches(":disabled")).toBe(true);
    expect(screen.getByRole("button", { name: "Copy all final outputs" }).hasAttribute("disabled")).toBe(true);
    expect(screen.getByRole("button", { name: "New check" }).hasAttribute("disabled")).toBe(true);
    expect(screen.getByRole("button", { name: "Refresh models" }).hasAttribute("disabled")).toBe(true);
    for (const radio of screen.getAllByRole("radio")) expect(radio.hasAttribute("disabled")).toBe(true);
    if (action === "cancel") fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    if (action === "lock") fireEvent.click(screen.getByRole("button", { name: "Lock" }));
    if (action === "unmount") view.unmount();
    expect(signal?.aborted).toBe(true);
    await act(async () => finish(completionResponse({
      assessments: productNames.map((_, index) => ({ id: `product-${index + 1}`, related: true, reason: "Late result." })),
      warnings: [], needsCorrection: false,
    })));
    expect(completions(fetchMock)).toHaveLength(mode === "manual" ? 2 : 5);
    if (action === "unmount") {
      render(<RelatedProductFinderTool />);
      await screen.findByLabelText("Unlock your saved settings");
      expect(screen.queryByRole("region", { name: "Product matching review" })).toBeNull();
    } else {
      await waitFor(() => expect(screen.queryByRole("button", { name: "Cancel" })).toBeNull());
      openDetails("Reasons, sources & initial output");
      const panel = within(screen.getByRole("region", { name: mode === "manual" ? "Product matching review" : "Smart collection review" }));
      expect(panel.getByRole("status").textContent).toBe("AI verification incomplete — original output retained.");
      expect(panel.getByRole("alert").textContent).toContain("Request cancelled.");
      expect(panel.getByText("No automatic changes were applied.")).toBeTruthy();
      const productPanel = within(screen.getByRole("region", { name: "Related Products" }));
      expect(productPanel.getByRole("link", { name: mode === "manual" ? "Polishing Cloth" : "Paint Polish" })).toBeTruthy();
      expect(screen.getByRole("button", { name: "Copy result" }).hasAttribute("disabled")).toBe(false);
      if (mode === "smart") expect(screen.getByRole("button", { name: "Copy Title contains → any of value: Polishing" })).toBeTruthy();
      if (action === "lock") expect(screen.getByLabelText("Unlock your saved settings")).toBeTruthy();
    }
  });

  it("cancels pending smart generation without discarding already-reviewed product matching", async () => {
    const base = mockFinderFetch();
    let started!: () => void;
    const providerStarted = new Promise<void>((resolve) => { started = resolve; });
    vi.stubGlobal("fetch", vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
      if (String(input).endsWith("/chat/completions") && JSON.parse(JSON.parse(String(init?.body)).messages[1].content).samples) {
        started();
        return new Promise<Response>((_, reject) => init?.signal?.addEventListener("abort", () => reject(new DOMException("Aborted", "AbortError")), { once: true }));
      }
      return base(input, init);
    }));
    render(<RelatedProductFinderTool />);
    await chooseModel();
    setInputs();
    fireEvent.click(screen.getByRole("button", { name: "Run check" }));
    await providerStarted;
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    await finishRun();
    expect(within(screen.getByRole("region", { name: "Related Products" })).getByRole("link", { name: "Polishing Cloth" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Copy smart collection suggestions" }).hasAttribute("disabled")).toBe(true);
    expect(screen.getByRole("button", { name: "Copy result" }).hasAttribute("disabled")).toBe(false);
  });

  it("blocks an unavailable preselected reviewer until an available one is chosen", async () => {
    const fetchMock = mockVerifiedFinderFetch();
    vi.stubGlobal("fetch", fetchMock);
    render(<RelatedProductFinderTool />);
    await chooseModel();
    setInputs();
    fireEvent.change(screen.getByLabelText("Verifier model"), { target: { value: "model-b" } });
    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({ data: [{ id: "model-a" }] }), { status: 200 }));
    fireEvent.click(screen.getByRole("button", { name: "Refresh models" }));
    await screen.findByRole("option", { name: "Saved reviewer unavailable: model-b" });
    expect(screen.getByRole("button", { name: "Run check" }).hasAttribute("disabled")).toBe(true);
    expect(completions(fetchMock)).toHaveLength(0);
    fireEvent.change(screen.getByLabelText("Verifier model"), { target: { value: "" } });
    expect(screen.getByRole("button", { name: "Run check" }).hasAttribute("disabled")).toBe(false);
  });
});

describe("shared copy button compatibility", () => {
  it("keeps default labels and never submits a form or enables an empty value", async () => {
    const writeText = stubClipboard();
    const submit = vi.fn((event) => event.preventDefault());
    const view = render(<form onSubmit={submit}><CopyButton text="Name">Copy name</CopyButton></form>);
    fireEvent.click(screen.getByRole("button", { name: "Copy name" }));
    await waitFor(() => expect(writeText).toHaveBeenCalledWith("Name"));
    expect(submit).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Copied!" })).toBeTruthy();
    view.rerender(<CopyButton text="" disabled={false} />);
    expect(screen.getByRole("button").hasAttribute("disabled")).toBe(true);
  });

  it("keeps icon-only actions compact and does not show success when clipboard access fails", async () => {
    const writeText = stubClipboard().mockRejectedValue(new Error("Clipboard denied"));
    render(<CopyButton text="Name" iconOnly aria-label="Copy individual name" />);
    const button = screen.getByRole("button", { name: "Copy individual name" });
    expect(button.textContent).toBe("");
    fireEvent.click(button);
    await waitFor(() => expect(writeText).toHaveBeenCalledWith("Name"));
    await waitFor(() => expect(button.hasAttribute("disabled")).toBe(false));
    expect(button.querySelector(".lucide-check")).toBeNull();
    expect(button.textContent).toBe("");
  });
});
