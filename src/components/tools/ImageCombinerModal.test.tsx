import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { ImageCombinerModal } from "./ImageCombinerModal";
import type { ExtractedImage } from "@/lib/image-extractor/extractor";

const makeImage = (id: string): ExtractedImage => ({
  id,
  src: `data:image/png;base64,${id}`,
  alt: id,
  width: 10,
  height: 10,
  blob: new Blob([new Uint8Array([1, 2, 3])], { type: "image/png" }),
  filename: `${id}.png`,
});

describe("ImageCombinerModal", () => {
  it("renders nothing when closed", () => {
    render(
      <ImageCombinerModal
        groupId="g1"
        images={[makeImage("a")]}
        open={false}
        onOpenChange={() => {}}
      />,
    );
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it.skip("renders Dialog when open", () => {
    render(
      <ImageCombinerModal
        groupId="g1"
        images={[makeImage("a"), makeImage("b")]}
        open={true}
        onOpenChange={() => {}}
      />,
    );
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });
});
