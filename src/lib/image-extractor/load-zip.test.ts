import JSZip from "jszip";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { loadZipAsHtml } from "./load-zip";

async function toZipFile(zip: JSZip): Promise<File> {
  const contents = await zip.generateAsync({ type: "uint8array" });
  return new File([contents], "document.zip", { type: "application/zip" });
}

function parse(html: string): Document {
  return new DOMParser().parseFromString(html, "text/html");
}

describe("loadZipAsHtml", () => {
  beforeEach(() => {
    vi.stubGlobal("URL", {
      createObjectURL: vi.fn(() => "blob:test-image"),
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("rewrites a relative image source to a blob URL", async () => {
    const zip = new JSZip();
    zip.file("docs/page/index.html", '<main><img src="../images/./photo.png"></main>');
    zip.file("docs/images/photo.png", new Uint8Array([137, 80, 78, 71]));
    const file = await toZipFile(zip);

    const result = await loadZipAsHtml(file);

    expect(parse(result).querySelector("img")?.getAttribute("src")).toBe("blob:test-image");
    expect(URL.createObjectURL).toHaveBeenCalledOnce();
  });

  it("throws when the zip contains no HTML file", async () => {
    const zip = new JSZip();
    zip.file("images/photo.png", new Uint8Array([137, 80, 78, 71]));
    const file = await toZipFile(zip);

    const action = loadZipAsHtml(file);

    await expect(action).rejects.toThrow("No HTML");
  });

  it("preserves a relative image source when its file is missing", async () => {
    const zip = new JSZip();
    zip.file("docs/index.html", '<img src="images/missing.png">');
    const file = await toZipFile(zip);

    const result = await loadZipAsHtml(file);

    expect(parse(result).querySelector("img")?.getAttribute("src")).toBe("images/missing.png");
    expect(URL.createObjectURL).not.toHaveBeenCalled();
  });

  it("preserves absolute and embedded image sources", async () => {
    const sources = [
      "https://example.com/photo.png",
      "data:image/png;base64,iVBORw0KGgo=",
      "blob:https://example.com/image-id",
    ];
    const zip = new JSZip();
    zip.file("index.html", sources.map((src) => `<img src="${src}">`).join(""));
    const file = await toZipFile(zip);

    const result = await loadZipAsHtml(file);
    const actualSources = Array.from(parse(result).querySelectorAll("img"), (image) =>
      image.getAttribute("src"),
    );

    expect(actualSources).toEqual(sources);
    expect(URL.createObjectURL).not.toHaveBeenCalled();
  });

  it("tags the blob URL with the correct MIME type from the file extension", async () => {
    const zip = new JSZip();
    zip.file("index.html", '<img src="images/photo.jpg">');
    zip.file("images/photo.jpg", new Uint8Array([255, 216, 255]));
    const file = await toZipFile(zip);

    await loadZipAsHtml(file);

    const createObjectURLCall = (URL.createObjectURL as ReturnType<typeof vi.fn>).mock
      .calls[0]?.[0] as Blob;
    expect(createObjectURLCall).toBeInstanceOf(Blob);
    expect(createObjectURLCall.type).toBe("image/jpeg");
  });
});
