import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ProductResultVerifier } from "./ProductResultVerifier";
import type { ProductReviewInput } from "@/lib/related-product/types";
import type { AutomaticVerificationReport } from "@/lib/related-product/verification";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const input: ProductReviewInput = {
  mode: "smart", draft: "A draft about compatible supplies.", sourceModel: "model-a",
  products: ["Supply", "Spare", "Unknown"].map((name, index) => ({
    product: { name, productType: "", description: "", price: "", url: `https://shop.example/products/${index}` },
    selected: index === 0,
  })),
};
const report: AutomaticVerificationReport = {
  status: "complete", original: input, final: input,
  review: {
    model: "model-a", needsCorrection: false, warnings: [],
    assessments: input.products.map((entry, index) => ({
      id: `product-${index + 1}`, related: entry.selected, reason: "Supported by the supplied description.",
    })),
  },
  changes: [], uncertainIndices: [], correctionAttempted: false,
};

describe("ProductResultVerifier report", () => {
  it("renders pending and complete reports without owning requests or actions", () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const view = render(<ProductResultVerifier input={input} report={null} />);
    expect(screen.getByRole("status").textContent).toBe("Automatic AI verification is running…");
    expect(screen.getByRole("region", { name: "AI result verifier" }).getAttribute("aria-busy")).toBe("true");
    expect(screen.queryByRole("button")).toBeNull();
    expect(screen.queryByLabelText("Verifier model")).toBeNull();
    view.rerender(<ProductResultVerifier input={input} report={report} />);
    expect(screen.getByRole("status").textContent).toBe("AI review complete — human review still required.");
    expect(screen.getByRole("region", { name: "AI result verifier" }).getAttribute("aria-busy")).toBe("false");
    expect(screen.getByText("Products reviewed").nextElementSibling?.textContent).toBe("3");
    expect(screen.getByText("Remaining mismatches").nextElementSibling?.textContent).toBe("0");
    expect(screen.getByText(/same model generated and reviewed/)).toBeTruthy();
    expect(screen.getByText("No automatic changes were applied.")).toBeTruthy();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("shows applied before/after changes and final decisions separately from uncertainty", () => {
    const changed: AutomaticVerificationReport = {
      ...report, status: "needs-review", correctionAttempted: true, uncertainIndices: [2],
      final: { ...input, products: input.products.map((entry, index) => ({ ...entry, selected: index === 1 })) },
      changes: [{ label: "Supply", before: "Matched", after: "Did not match" }],
      review: {
        ...report.review!, model: "model-b", warnings: ["Check compatibility manually."],
        assessments: report.review!.assessments.map((entry, index) => ({ ...entry, related: index === 2 ? null : index === 1 })),
      },
    };
    render(<ProductResultVerifier input={input} report={changed} />);
    expect(screen.getByRole("status").textContent).toBe("AI review needs attention — review flagged items.");
    expect(screen.getByText("Applied changes (1)")).toBeTruthy();
    expect(screen.getByText("Before: Matched")).toBeTruthy();
    expect(screen.getByText("After: Did not match")).toBeTruthy();
    expect(screen.getByText("Original title result: matched")).toBeTruthy();
    expect(screen.getByText("Final title result: matched")).toBeTruthy();
    expect(screen.getByText("Uncertain / conflicting").nextElementSibling?.textContent).toBe("1");
    expect(screen.getByText("Uncertain / conflicting reviews")).toBeTruthy();
    expect(screen.getByText("Check compatibility manually.")).toBeTruthy();
    expect(screen.getByText("Reviewed by: model-b")).toBeTruthy();
    expect(screen.queryByText(/same model generated and reviewed/)).toBeNull();
    const link = screen.getByRole("link", { name: "Supply" });
    expect(link.getAttribute("href")).toBe(input.products[0].product.url);
    expect(link.getAttribute("rel")).toBe("noopener noreferrer");
  });

  it("highlights remaining false positives and missed products", () => {
    render(<ProductResultVerifier input={input} report={{
      ...report, status: "needs-review",
      review: {
        ...report.review!, assessments: report.review!.assessments.map((entry, index) => ({ ...entry, related: index === 1 })),
      },
    }} />);
    expect(screen.getByText("Remaining mismatches").nextElementSibling?.textContent).toBe("2");
    expect(screen.getByText("Potential false positive")).toBeTruthy();
    expect(screen.getByText("Potential missed product")).toBeTruthy();
  });

  it("shows incomplete work without presenting partial evidence as a completed review", () => {
    render(<ProductResultVerifier input={input} report={{
      ...report, status: "incomplete", review: null, message: "Request cancelled.",
    }} />);
    expect(screen.getByRole("status").textContent).toBe("AI verification incomplete — original output retained.");
    expect(screen.getByRole("alert").textContent).toBe("Request cancelled.");
    expect(screen.getByText("No automatic changes were applied.")).toBeTruthy();
    expect(screen.queryByText("Products reviewed")).toBeNull();
    expect(screen.queryByRole("list", { name: "AI product assessments" })).toBeNull();
  });

  it("does not manufacture title disagreements when there is no title-match baseline", () => {
    const noTitles: ProductReviewInput = { ...input, products: input.products.map((entry) => ({ ...entry, selected: null })) };
    render(<ProductResultVerifier input={noTitles} report={{ ...report, original: noTitles, final: noTitles }} />);
    expect(screen.getByText("Remaining mismatches").nextElementSibling?.textContent).toBe("0");
    expect(screen.getByText(/No title-match baseline/)).toBeTruthy();
    expect(screen.getAllByText("Original title result: not evaluated")).toHaveLength(3);
  });

  it("explains missing samples without displaying a fabricated review count", () => {
    const empty: ProductReviewInput = { ...input, products: [] };
    render(<ProductResultVerifier input={empty} report={{ ...report, original: empty, final: empty, status: "incomplete", review: null }} />);
    expect(screen.getByText(/No product samples are available/)).toBeTruthy();
    expect(screen.queryByText("Products reviewed")).toBeNull();
  });
});
