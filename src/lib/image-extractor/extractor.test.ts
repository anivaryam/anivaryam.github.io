import { describe, it, expect, vi } from "vitest";
import { formatImageName, extractImages } from "./extractor";

describe("formatImageName", () => {
  it("uses alt text when available with extension appended", () => {
    expect(formatImageName("data:image/png;base64,AAA", "my-photo", 0)).toBe(
      "my-photo.png",
    );
  });

  it("sanitizes alt text to be filename-safe with extension appended", () => {
    expect(formatImageName("x", "my photo /test 1", 5)).toBe("my photo _test 1.png");
  });

  it("preserves spaces in the alt text when forming the filename", () => {
    expect(formatImageName("x", "A red circle", 0)).toBe("A red circle.png");
    expect(formatImageName("x", "Hero banner footer", 0)).toBe("Hero banner footer.png");
  });

  it("falls back to image-N with extension when alt is empty", () => {
    expect(formatImageName("x", "", 3)).toBe("image-4.png");
  });

  it("returns extension inferred from src mime", () => {
    const name = formatImageName("data:image/jpeg;base64,X", "", 0);
    expect(name).toMatch(/\.jpg$/);
  });

  it("returns .png for URLs ending in .png", () => {
    const name = formatImageName("https://example.com/x.png", "", 0);
    expect(name).toMatch(/\.png$/);
  });
});

describe("extractImages", () => {
  it("returns empty array for HTML with no images", async () => {
    const result = await extractImages("<p>hello world</p>");
    expect(result).toEqual([]);
  });

  it("extracts a single img tag with src attribute", async () => {
    const html =
      '<img src="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAIAAAD91JpzAAAAGUlEQVR4nGNkYGD4z8DAwMDw//9JD4MAAAAASUVORK5CYII=" alt="red-dot" />';
    const result = await extractImages(html);
    expect(result.length).toBe(1);
    expect(result[0]!.alt).toBe("red-dot");
    expect(result[0]!.blob).toBeInstanceOf(Blob);
    expect(result[0]!.blob!.size).toBeGreaterThan(0);
  });

  it("sets fetchError for malformed src", async () => {
    const result = await extractImages('<img src="not-a-valid-url-or-data-uri" />');
    expect(result.length).toBe(1);
    expect(result[0]!.blob).toBeNull();
    expect(result[0]!.fetchError).toBeDefined();
  });

  it("extracts a blob: URL by fetching it (used by the zip loader rewrite)", async () => {
    const fakeFetch = vi.fn(async () => new Response(new Blob([])));
    const originalFetch = globalThis.fetch;
    globalThis.fetch = fakeFetch as typeof fetch;
    try {
      const result = await extractImages(
        '<img src="blob:https://example.com/abc-12345" alt="blob-img" />',
      );
      expect(result.length).toBe(1);
      expect(result[0]!.alt).toBe("blob-img");
      expect(result[0]!.fetchError).toBeUndefined();
      expect(fakeFetch).toHaveBeenCalledTimes(1);
      expect(fakeFetch).toHaveBeenCalledWith(
        "blob:https://example.com/abc-12345",
        expect.objectContaining({ mode: "cors" }),
      );
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it("uses 'alt text:' prefix in the surrounding paragraph as the alt", async () => {
    const html = `<p>alt text: A red circle
      <img src="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=" alt="" />
    </p>`;
    const result = await extractImages(html);
    expect(result.length).toBe(1);
    expect(result[0]!.alt).toBe("A red circle");
    expect(result[0]!.filename).toBe("A red circle.png");
  });

  it("uses 'alt image text:' prefix in the surrounding paragraph as the alt", async () => {
    const html = `<p>alt image text: Hero banner footer
      <img src="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=" alt="" />
    </p>`;
    const result = await extractImages(html);
    expect(result.length).toBe(1);
    expect(result[0]!.alt).toBe("Hero banner footer");
  });

  it("uses 'link:' prefix from inside an anchor as the alt", async () => {
    const html = `<p><a href="https://example.com/x.png">link: Important logo</a>
      <img src="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=" alt="" />
    </p>`;
    const result = await extractImages(html);
    expect(result.length).toBe(1);
    expect(result[0]!.alt).toBe("Important logo");
  });

  it("stops the alt text at the next prefix in the same paragraph", async () => {
    const html = `<p>alt text: First image link: backup.png
      <img src="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=" alt="" />
    </p>`;
    const result = await extractImages(html);
    expect(result.length).toBe(1);
    expect(result[0]!.alt).toBe("First image");
  });

  it("prefers an existing alt attribute over the surrounding context", async () => {
    const html = `<p>alt text: From context
      <img src="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=" alt="From attribute" />
    </p>`;
    const result = await extractImages(html);
    expect(result.length).toBe(1);
    expect(result[0]!.alt).toBe("From attribute");
  });

  it("uses 'alt text:' from the previous sibling paragraph when image is alone", async () => {
    const html = `<p>alt text: First image</p>
      <p><img src="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=" alt="" /></p>
      <p>alt text: Second image</p>
      <p><img src="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=" alt="" /></p>`;
    const result = await extractImages(html);
    expect(result.length).toBe(2);
    expect(result[0]!.alt).toBe("First image");
    expect(result[1]!.alt).toBe("Second image");
  });
});
