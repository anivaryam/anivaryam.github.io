import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ProductResultVerifier } from "./ProductResultVerifier";
import type { ProductReviewInput } from "@/lib/related-product/types";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const input: ProductReviewInput = {
  mode: "smart", draft: "A draft about compatible supplies.", sourceModel: "model-a",
  products: [{
    product: { name: "Supply", productType: "", description: "", price: "", url: "https://shop.example/products/supply" },
    selected: true,
  }],
};
const props = {
  input, apiBase: "https://api.example.com/v1", apiKey: "test-key", selectedModel: "model-a",
  models: [{ id: "model-a" }, { id: "model-b" }], enabled: true,
};
const response = () => new Response(JSON.stringify({
  choices: [{ message: { content: JSON.stringify({
    assessments: [{ id: "product-1", related: true, reason: "Supported by the supplied description." }],
    warnings: [],
  }) } }],
}), { status: 200 });

describe("ProductResultVerifier lifecycle", () => {
  it("uses a selectable reviewer model only after the explicit action", async () => {
    const fetchMock = vi.fn().mockResolvedValue(response());
    vi.stubGlobal("fetch", fetchMock);
    render(<ProductResultVerifier {...props} />);
    expect(fetchMock).not.toHaveBeenCalled();
    fireEvent.change(screen.getByLabelText("Verifier model"), { target: { value: "model-b" } });
    expect(screen.getByText(/different model can still share/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Verify results with AI" }));
    expect(await screen.findByText("AI review complete — human review still required.")).toBeTruthy();
    expect(JSON.parse(fetchMock.mock.calls[0][1].body).model).toBe("model-b");
    expect(screen.getByText("Reviewed by: model-b")).toBeTruthy();
  });

  it.each(["cancel", "lock", "unmount"] as const)("aborts a pending review on %s", async (action) => {
    let signal: AbortSignal | undefined;
    vi.stubGlobal("fetch", vi.fn((_url, init: RequestInit) => {
      signal = init.signal as AbortSignal;
      return new Promise<Response>((_resolve, reject) => {
        signal?.addEventListener("abort", () => reject(new DOMException("Aborted", "AbortError")), { once: true });
      });
    }));
    const view = render(<ProductResultVerifier {...props} />);
    fireEvent.click(screen.getByRole("button", { name: "Verify results with AI" }));
    expect(screen.getByRole("button", { name: "Verifying results…" }).hasAttribute("disabled")).toBe(true);
    if (action === "cancel") fireEvent.click(screen.getByRole("button", { name: "Cancel verification" }));
    if (action === "lock") view.rerender(<ProductResultVerifier {...props} enabled={false} />);
    if (action === "unmount") view.unmount();
    await waitFor(() => expect(signal?.aborted).toBe(true));
    if (action !== "unmount") {
      expect(await screen.findByText(/Request cancelled/)).toBeTruthy();
      expect(screen.queryByText(/AI review complete/)).toBeNull();
    }
  });

  it("discards a late response when the completed input changes, even if fetch ignores abort", async () => {
    let finish!: (response: Response) => void;
    let oldSignal: AbortSignal | undefined;
    const fetchMock = vi.fn((_url, init: RequestInit) => {
      oldSignal = init.signal as AbortSignal;
      return new Promise<Response>((resolve) => { finish = resolve; });
    });
    vi.stubGlobal("fetch", fetchMock);
    const view = render(<ProductResultVerifier {...props} />);
    fireEvent.click(screen.getByRole("button", { name: "Verify results with AI" }));
    view.rerender(<ProductResultVerifier {...props} input={{ ...input, draft: "A changed draft" }} />);
    expect(oldSignal?.aborted).toBe(true);
    finish(response());
    await waitFor(() => expect(screen.getByRole("button", { name: "Verify results with AI" }).hasAttribute("disabled")).toBe(false));
    expect(screen.queryByText(/AI review complete/)).toBeNull();
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("does not manufacture title disagreements when there is no title-match baseline", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(response()));
    render(<ProductResultVerifier {...props} input={{
      ...input, products: [{ ...input.products[0], selected: null }],
    }} />);
    fireEvent.click(screen.getByRole("button", { name: "Verify results with AI" }));
    await screen.findByText("AI review complete — human review still required.");
    expect(screen.getByText("Potential mismatches").nextElementSibling?.textContent).toBe("0");
    expect(screen.getByText(/No title-match baseline/)).toBeTruthy();
    expect(screen.getByText("Original title result: not evaluated")).toBeTruthy();
  });

  it("blocks empty samples and unavailable reviewer models without requests", () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const view = render(<ProductResultVerifier {...props} input={{ ...input, products: [] }} />);
    expect(screen.getByRole("button", { name: "Verify results with AI" }).hasAttribute("disabled")).toBe(true);
    expect(screen.getByText(/No product samples are available/)).toBeTruthy();
    view.rerender(<ProductResultVerifier {...props} models={[]} />);
    expect(screen.getByRole("button", { name: "Verify results with AI" }).hasAttribute("disabled")).toBe(true);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
