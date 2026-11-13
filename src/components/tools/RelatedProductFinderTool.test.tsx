import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { RelatedProductFinderTool } from "./RelatedProductFinderTool";
import { unlockProviderSettings } from "@/lib/related-product/storage";

afterEach(() => {
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
