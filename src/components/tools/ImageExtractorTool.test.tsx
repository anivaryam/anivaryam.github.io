import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { ImageExtractorTool } from "./ImageExtractorTool";
import { loadZipAsHtml } from "@/lib/image-extractor/load-zip";

const { toast } = vi.hoisted(() => ({ toast: vi.fn() }));
vi.mock("@/hooks/use-toast", () => ({ toast, useToast: () => ({ toast }) }));
vi.mock("@/lib/image-extractor/load-zip", () => ({ loadZipAsHtml: vi.fn() }));

const HIT = "data-image-extractor-hit";
const PAYLOAD = `<img src="x" onerror="document.documentElement.setAttribute('${HIT}', '')">`;

beforeEach(() => {
  // jsdom has no object URLs; the Extracted panel previews each image blob with one.
  vi.stubGlobal("URL", Object.assign(class extends URL {}, { createObjectURL: () => "blob:preview", revokeObjectURL: () => {} }));
});

afterEach(() => {
  cleanup();
  document.documentElement.removeAttribute(HIT);
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

function editor(): HTMLElement {
  return document.querySelector('[contenteditable="true"]') as HTMLElement;
}

function paste(type: "text/html" | "text/plain", data: string) {
  fireEvent.paste(editor(), { clipboardData: { getData: (t: string) => (t === type ? data : "") } });
}

// jsdom never fetches images, so dispatch the error a browser fires for src="x".
function failImageLoads() {
  const images = editor().querySelectorAll("img");
  expect(images.length).toBeGreaterThan(0);
  images.forEach((image) => image.dispatchEvent(new Event("error")));
}

async function loadZip(html: string) {
  vi.mocked(loadZipAsHtml).mockResolvedValue(html);
  fireEvent.change(screen.getByLabelText("Upload Google Docs zip file"), {
    target: { files: [new File(["zip"], "document.zip")] },
  });
  await waitFor(() => expect(editor().querySelector("img")).not.toBeNull());
}

describe("ImageExtractorTool", () => {
  it.each(["text/html", "text/plain"] as const)("does not run inline handlers from pasted %s", (type) => {
    render(<ImageExtractorTool />);
    paste(type, `<p>Pasted</p>${PAYLOAD}`);
    expect(editor().textContent).toBe("Pasted");
    failImageLoads();
    expect(document.documentElement.hasAttribute(HIT)).toBe(false);
  });

  it("does not run inline handlers from zip HTML written into the editor", async () => {
    render(<ImageExtractorTool />);
    await loadZip(`<html><head></head><body><p>Zipped</p>${PAYLOAD}</body></html>`);
    failImageLoads();
    expect(document.documentElement.hasAttribute(HIT)).toBe(false);
  });

  it("keeps pasted images and their alt text for extraction", async () => {
    render(<ImageExtractorTool />);
    const png = "data:image/png;base64,iVBORw0KGgo=";
    const gif = "data:image/gif;base64,R0lGODlh";
    paste(
      "text/html",
      `<meta charset="utf-8"><b id="docs-internal-guid-1" style="font-weight:normal">` +
        `<p dir="ltr"><img src="${png}" width="10" height="10"></p>` +
        `<p dir="ltr"><span>Alt text: Red square</span></p>` +
        `<p><img src="${gif}" alt="Blue circle"></p></b>`,
    );

    const shown = Array.from(editor().querySelectorAll("img"), (image) => [image.getAttribute("src"), image.alt]);
    expect(shown).toEqual([[png, ""], [gif, "Blue circle"]]);
    expect(editor().textContent).toContain("Alt text: Red square");
    expect(await screen.findByText("Red square.png")).toBeTruthy();
    expect(screen.getByText("Blue circle.gif")).toBeTruthy();
    expect(screen.getByText("2 images ·", { exact: false })).toBeTruthy();
  });

  it("keeps blob: image sources from the zip loader when the editor is re-read", async () => {
    const fetchImage = vi.fn(async () => new Response(new ArrayBuffer(4)));
    vi.stubGlobal("fetch", fetchImage);
    render(<ImageExtractorTool />);
    const src = "blob:http://localhost:3000/zip-image";
    await loadZip(`<html><head></head><body><p><img src="${src}" alt="Zip photo"></p></body></html>`);
    expect(editor().querySelector("img")?.getAttribute("src")).toBe(src);

    // Typing re-reads the editor DOM into state, so extraction then uses it.
    fireEvent.input(editor());
    expect(await screen.findByText("Zip photo.png")).toBeTruthy();
    expect(screen.queryByText("Missing src")).toBeNull();
    expect(fetchImage).toHaveBeenLastCalledWith(src, expect.objectContaining({ mode: "cors" }));
  });
});
