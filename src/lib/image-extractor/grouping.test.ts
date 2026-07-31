import { describe, it, expect } from "vitest";
import { groupImages } from "./grouping";
import type { ExtractedImage } from "./extractor";

function makeImg(id: string, src = `data:image/png;base64,${id}`): ExtractedImage {
  return {
    id,
    src,
    alt: id,
    width: 10,
    height: 10,
    blob: null,
    filename: `${id}.png`,
  };
}

function parse(html: string): Document {
  return new DOMParser().parseFromString(html, "text/html");
}

describe("groupImages (separator algorithm)", () => {
  it("returns [] for empty images", () => {
    expect(groupImages([], parse("<p><img src='a'/></p>"))).toEqual([]);
  });

  it("returns [] when no <img> in source", () => {
    expect(groupImages([makeImg("a")], parse("<p>no images here</p>"))).toEqual([]);
  });

  it("1 image in <div> → 1 group", () => {
    const result = groupImages([makeImg("a")], parse("<div><img src='a'/></div>"));
    expect(result).toHaveLength(1);
    expect(result[0]!.imageIds).toEqual(["a"]);
  });

  it("2 images in same <p> → 1 group", () => {
    const result = groupImages(
      [makeImg("a"), makeImg("b")],
      parse("<p><img src='a'/><img src='b'/></p>"),
    );
    expect(result).toHaveLength(1);
    expect(result[0]!.imageIds).toEqual(["a", "b"]);
  });

  it("3 images each in own <p> → 3 groups", () => {
    const result = groupImages(
      [makeImg("a"), makeImg("b"), makeImg("c")],
      parse("<p><img src='a'/></p><p><img src='b'/></p><p><img src='c'/></p>"),
    );
    expect(result).toHaveLength(3);
    expect(result.map((g) => g.imageIds)).toEqual([["a"], ["b"], ["c"]]);
  });

  it("<p>img1</p><strong>img2</strong> → 2 groups", () => {
    const result = groupImages(
      [makeImg("a"), makeImg("b")],
      parse("<p><img src='a'/></p><strong><img src='b'/></strong>"),
    );
    expect(result).toHaveLength(2);
    expect(result[0]!.imageIds).toEqual(["a"]);
    expect(result[1]!.imageIds).toEqual(["b"]);
  });

  it("2 images separated by <br> → 1 group (BR is not a separator)", () => {
    const result = groupImages(
      [makeImg("a"), makeImg("b")],
      parse("<br><img src='a'/><br><img src='b'/><br>"),
    );
    expect(result).toHaveLength(1);
    expect(result[0]!.imageIds).toEqual(["a", "b"]);
  });

  it("2 images inside <table> → 1 group (TABLE descends)", () => {
    const result = groupImages(
      [makeImg("a"), makeImg("b")],
      parse("<table><tr><td><img src='a'/></td><td><img src='b'/></td></tr></table>"),
    );
    expect(result).toHaveLength(1);
    expect(result[0]!.imageIds).toEqual(["a", "b"]);
  });

  it("<p>img1</p><p>img2</p><p>img3</p><ul><li>img4</li></ul> → 4 groups", () => {
    const result = groupImages(
      [makeImg("a"), makeImg("b"), makeImg("c"), makeImg("d")],
      parse(
        "<p><img src='a'/></p><p><img src='b'/></p><p><img src='c'/></p><ul><li><img src='d'/></li></ul>",
      ),
    );
    expect(result).toHaveLength(4);
  });

  it("preserves image order within a group", () => {
    const result = groupImages(
      [makeImg("a"), makeImg("b"), makeImg("c")],
      parse("<p><img src='a'/><img src='b'/></p><p><img src='c'/></p>"),
    );
    expect(result[0]!.imageIds).toEqual(["a", "b"]);
  });
});
