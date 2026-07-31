import { describe, it, expect } from "vitest";

describe("vitest smoke test", () => {
  it("runs", () => {
    expect(1 + 1).toBe(2);
  });

  it("has access to jsdom globals", () => {
    expect(typeof document).toBe("object");
  });
});
