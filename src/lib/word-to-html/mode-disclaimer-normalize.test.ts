import { describe, it, expect } from "vitest";
import { normalizeDisclaimer } from "./mode-disclaimer-normalize";

describe("normalizeDisclaimer", () => {
  it("wraps an inline-form Disclaimer and preserves the <em> wrapping around the body", () => {
    const input = `
      <p>No. DairyPill specifically addresses lactose digestion and isn't formulated to manage broader IBS-related symptoms or triggers in any way.</p>
      <p><em>Disclaimer: These statements have not been evaluated by the Food and Drug Administration. This product is not intended to diagnose, treat, cure, or prevent any disease.</em></p>
    `;

    const output = normalizeDisclaimer(input);

    expect(output).toContain("<strong><em>Disclaimer:</em></strong>");
    expect(output).toMatch(
      /<strong><em>Disclaimer:<\/em><\/strong>\s*<em>[\s\S]*?These statements have not been evaluated[\s\S]*?<\/em>/
    );
  });

  it("adds a single space after the colon when the body has no leading whitespace", () => {
    const input = `<p>Disclaimer:Body text.</p>`;

    const output = normalizeDisclaimer(input);

    expect(output).toContain("<strong><em>Disclaimer:</em></strong> Body text.");
    expect(output).not.toContain("<strong><em>Disclaimer:</em></strong>Body text.");
  });

  it("does not add a duplicate space when the body already starts with whitespace", () => {
    const input = `<p><em>Disclaimer: Body text.</em></p>`;

    const output = normalizeDisclaimer(input);

    expect(output).not.toContain("<strong><em>Disclaimer:</em></strong>  ");
  });

  it("wraps a plain (no formatting) Disclaimer paragraph and adds a space", () => {
    const input = `<p>Disclaimer: Some body text here.</p>`;

    const output = normalizeDisclaimer(input);

    expect(output).toContain("<strong><em>Disclaimer:</em></strong>");
    expect(output).toContain("<strong><em>Disclaimer:</em></strong> Some body text here.");
  });

  it("wraps a standalone Disclaimer label paragraph (label-only, no body)", () => {
    const input = `
      <p>Preceding content.</p>
      <p><em>Disclaimer:</em></p>
      <p>These statements have not been evaluated by the Food and Drug Administration.</p>
    `;

    const output = normalizeDisclaimer(input);

    expect(output).toContain("<strong><em>Disclaimer:</em></strong>");
    expect(output).not.toMatch(/<strong><em>Disclaimer:<\/em><\/strong>\s+<\/p>/);
  });

  it("is case-insensitive", () => {
    const input = `<p><em>DISCLAIMER: Body text.</em></p>`;

    const output = normalizeDisclaimer(input);

    expect(output).toContain("<strong><em>Disclaimer:</em></strong>");
    expect(output).toContain("Body text.");
  });

  it("is idempotent — does not re-wrap an already-normalized paragraph", () => {
    const input = `<p><strong><em>Disclaimer:</em></strong> Body text.</p>`;

    const output = normalizeDisclaimer(input);

    const strongMatches = output.match(/<strong>/g) ?? [];
    expect(strongMatches.length).toBe(1);
    const emMatches = output.match(/<em>/g) ?? [];
    expect(emMatches.length).toBe(1);
  });

  it("leaves non-Disclaimer paragraphs untouched", () => {
    const input = `
      <p>Just a regular paragraph.</p>
      <p>Another regular paragraph with a colon: at the end.</p>
    `;

    const output = normalizeDisclaimer(input);

    expect(output).not.toContain("<strong>");
    expect(output).not.toContain("<em>");
  });

  it("returns empty string for empty input", () => {
    expect(normalizeDisclaimer("")).toBe("");
  });
});
