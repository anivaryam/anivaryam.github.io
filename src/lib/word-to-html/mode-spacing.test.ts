import { describe, it, expect } from "vitest";
import { addSpacing, addSpacingBetweenParagraphs, getHeadingSpacingIssues } from "./mode-spacing";
import { convertWordToHtml, getUnformattedHtml } from "./converter";
import { formatCompact } from "./html-formatter";
import { getCustomSpacerWarnings, sanitizeCustomSpacerMarkup } from "./spacer";
import { validateMode } from "./validator";

describe("spacing pipeline parity", () => {
  it.each(['<p>&nbsp;</p>', '<p><em>&nbsp;</em></p>', '<p><br></p>', '<br>'])('removes existing first-FAQ spacing: %s', (gap) => {
    const output = addSpacing(`<h2>Frequently Asked Questions About How Often Do Newborns Eat?</h2>${gap}<h3>First question?</h3><p>Answer.</p><h3>Second question?</h3>`);
    const doc = new DOMParser().parseFromString(output, 'text/html');
    expect(doc.querySelector('h2')?.nextElementSibling).toBe(doc.querySelector('h3'));
    expect(doc.querySelectorAll('h3')[1].previousElementSibling?.innerHTML).toBe('&nbsp;');
    expect(validateMode(output, 'blogs', {}).results.find(r => r.ruleId === 'spacing-rules')?.passed).toBe(true);
  });

  it('does not carry the FAQ exception into a later section', () => {
    const output = addSpacing('<h2>FAQ</h2><p>Introduction.</p><h2>Product details</h2><h3>First product</h3>');
    const doc = new DOMParser().parseFromString(output, 'text/html');
    expect(doc.querySelector('h3')?.previousElementSibling?.innerHTML).toBe('&nbsp;');
  });
  it.each([
    '<ul><li>Content</li></ul><p>Sources:</p>',
    '<p>Sources: An inline citation.</p>',
  ])("adds the Sources spacing required by validation: %s", (input) => {
    const output = addSpacing(input);
    const validation = validateMode(output, 'blogs', {});
    expect(validation.results.find(result => result.ruleId === 'spacing-rules')?.passed).toBe(true);
    expect(addSpacing(output)).toBe(output);
  });

  it("fills every paragraph gap even when the preceding gap already has spacing", () => {
    const doc = new DOMParser().parseFromString('<p>A</p><p>&nbsp;</p><p>B</p><p>C</p>', 'text/html');
    addSpacingBetweenParagraphs(doc);
    expect(doc.body.innerHTML).toBe('<p>A</p><p>&nbsp;</p><p>B</p><p>&nbsp;</p><p>C</p>');
    const validation = validateMode(doc.body.innerHTML, 'shoppables', { paragraphSpacing: true });
    expect(validation.results.find(result => result.ruleId === 'paragraph-spacing')?.passed).toBe(true);
  });
});

describe("addSpacing — Disclaimer section", () => {
  it("inserts spacing before an inline-form Disclaimer paragraph (single <p>)", () => {
    const input = `
      <p>No. DairyPill specifically addresses lactose digestion and isn't formulated to manage broader IBS-related symptoms or triggers in any way.</p>
      <p><em>Disclaimer: These statements have not been evaluated by the Food and Drug Administration. This product is not intended to diagnose, treat, cure, or prevent any disease.</em></p>
    `;

    const output = addSpacing(input);

    const disclaimerIndex = output.indexOf("Disclaimer:");
    const spacingIndex = output.lastIndexOf("<p>&nbsp;</p>", disclaimerIndex);
    expect(spacingIndex).toBeGreaterThan(-1);
    expect(spacingIndex).toBeLessThan(disclaimerIndex);
  });

  it("does not duplicate spacing when Disclaimer is already on its own line", () => {
    const input = `
      <p>No. DairyPill specifically addresses lactose digestion and isn't formulated to manage broader IBS-related symptoms or triggers in any way.</p>
      <p>&nbsp;</p>
      <p><em>Disclaimer:</em></p>
      <p>These statements have not been evaluated by the Food and Drug Administration.</p>
    `;

    const output = addSpacing(input);

    const matches = output.match(/<p>&nbsp;<\/p>/g) ?? [];
    expect(matches.length).toBe(1);
  });

  it("inserts spacing for the bare label 'Disclaimer'", () => {
    const input = `
      <p>Some preceding content paragraph.</p>
      <p><em>Disclaimer</em></p>
      <p>Body text after the label.</p>
    `;

    const output = addSpacing(input);

    const disclaimerIndex = output.indexOf("Disclaimer");
    const spacingIndex = output.lastIndexOf("<p>&nbsp;</p>", disclaimerIndex);
    expect(spacingIndex).toBeGreaterThan(-1);
    expect(spacingIndex).toBeLessThan(disclaimerIndex);
  });

  it("returns input unchanged when there is no Disclaimer", () => {
    const input = `
      <p>Some content paragraph.</p>
      <p>Another content paragraph.</p>
    `;

    const output = addSpacing(input);

    expect(output.replace(/\s+/g, " ").trim()).toBe(
      input.replace(/\s+/g, " ").trim()
    );
  });

  it("matches case-insensitively (DISCLAIMER:)", () => {
    const input = `
      <p>Preceding content paragraph.</p>
      <p><em>DISCLAIMER: These statements have not been evaluated.</em></p>
    `;

    const output = addSpacing(input);

    const disclaimerIndex = output.indexOf("DISCLAIMER:");
    const spacingIndex = output.lastIndexOf("<p>&nbsp;</p>", disclaimerIndex);
    expect(spacingIndex).toBeGreaterThan(-1);
    expect(spacingIndex).toBeLessThan(disclaimerIndex);
  });
});

describe("custom spacer", () => {
  const CUSTOM_SPACER = '<div style="height:10px;"></div>';
  // The converter marks every spacer it inserts, so the emitted markup
  // carries the marker attribute.
  const MARKED_SPACER = '<div style="height:10px;" data-w2h-spacer="1"></div>';
  const SOURCE_HTML = '<p>Body text.</p><p>Sources:</p><ol><li>Source one</li></ol>';

  it("replaces the default spacer with the configured markup", () => {
    const output = convertWordToHtml(SOURCE_HTML, "blogs", { customSpacer: CUSTOM_SPACER });

    expect(output).toContain(MARKED_SPACER);
    expect(output).not.toContain("<p>&nbsp;</p>");
  });

  it("keeps the default spacer when no custom spacer is configured", () => {
    const output = convertWordToHtml(SOURCE_HTML, "blogs", {});

    expect(output).toContain("<p>&nbsp;</p>");
    expect(output).not.toContain(CUSTOM_SPACER);
    expect(output).not.toContain("data-w2h-spacer");
  });

  it("keeps the custom spacer in the formatted output", () => {
    const output = convertWordToHtml(SOURCE_HTML, "blogs", { customSpacer: CUSTOM_SPACER });
    const doc = new DOMParser().parseFromString(output, "text/html");

    expect(doc.querySelector("div[style='height:10px;']")).not.toBeNull();
  });

  it("uses the custom spacer for paragraph spacing", () => {
    const output = convertWordToHtml("<p>First.</p><p>Second.</p>", "regular", {
      customSpacer: CUSTOM_SPACER,
      paragraphSpacing: true,
    });

    expect(output).toContain(MARKED_SPACER);
    expect(output).not.toContain("<p>&nbsp;</p>");
  });

  it("validates the custom spacer as spacing", () => {
    const output = getUnformattedHtml(SOURCE_HTML, "blogs", { customSpacer: CUSTOM_SPACER });
    const validation = validateMode(output, "blogs", { customSpacer: CUSTOM_SPACER });

    expect(validation.results.find(result => result.ruleId === "spacing-rules")?.passed).toBe(true);
  });

  it("exempts the custom spacer from the sanitizer allowlist", () => {
    const output = getUnformattedHtml(SOURCE_HTML, "blogs", { customSpacer: CUSTOM_SPACER });
    const validation = validateMode(output, "blogs", { customSpacer: CUSTOM_SPACER });
    const result = validation.results.find(item => item.ruleId === "sanitized-structure");

    expect(result?.passed).toBe(true);
    // The marker attribute is banned by the allowlist rule, so the exempt
    // spacer must not flag itself.
    expect(result?.details).toBeNull();
  });

  it("marks the inserted spacer and leaves the default path untouched", () => {
    const withSpacer = getUnformattedHtml(SOURCE_HTML, "blogs", { customSpacer: CUSTOM_SPACER });
    const withoutSpacer = getUnformattedHtml(SOURCE_HTML, "blogs", {});

    expect(withSpacer).toContain('data-w2h-spacer="1"');
    expect(withoutSpacer).not.toContain("data-w2h-spacer");
  });

  it("flags a hand written element that matches the configured spacer", () => {
    const dangerous = '<img src="x" onerror="window.__XSS=1">';
    const validation = validateMode(`<p>Body</p>${dangerous}<p>More</p>`, "blogs", { customSpacer: dangerous });
    const result = validation.results.find(item => item.ruleId === "sanitized-structure");

    expect(result?.passed).toBe(false);
    expect(result?.details?.join(" ")).toContain("onerror");
  });

  it("recognizes the custom spacer as the spacing before a heading", () => {
    const output = getUnformattedHtml("<p>Intro.</p><h2>Section</h2><p>Body.</p>", "blogs", {
      customSpacer: CUSTOM_SPACER,
    });
    const validation = validateMode(output, "blogs", { customSpacer: CUSTOM_SPACER });

    expect(output).toContain(MARKED_SPACER);
    expect(validation.results.find(result => result.ruleId === "spacing-rules")?.passed).toBe(true);
  });

  it("treats the custom spacer as spacing before the first FAQ question", () => {
    const heading = "<h2>Frequently Asked Questions</h2>";
    const question = "<h3>How often should I feed my newborn?</h3>";
    const custom = new DOMParser().parseFromString(
      `${heading}${MARKED_SPACER}${question}`, "text/html");
    const fallback = new DOMParser().parseFromString(
      `${heading}<p>&nbsp;</p>${question}`, "text/html");

    const customMessages = getHeadingSpacingIssues(custom, CUSTOM_SPACER).map(issue => issue.message);
    const fallbackMessages = getHeadingSpacingIssues(fallback).map(issue => issue.message);

    expect(customMessages).toContain('Unexpected spacing before first FAQ question: "How often should I feed my new..."');
    expect(fallbackMessages).toContain('Unexpected spacing before first FAQ question: "How often should I feed my new..."');
  });

  it("keeps a custom spacer nested inside a block element", () => {
    const formatted = formatCompact(`<div>${MARKED_SPACER}</div>`, CUSTOM_SPACER);

    expect(formatted).toContain("height:10px");
    expect(formatted).toContain('data-w2h-spacer="1"');
  });

  it("warns about dangerous spacer markup only", () => {
    expect(getCustomSpacerWarnings('<img src="x" onerror="window.__XSS=1">')).not.toHaveLength(0);
    expect(getCustomSpacerWarnings('<iframe src="javascript:alert(1)"></iframe>')).not.toHaveLength(0);
    expect(getCustomSpacerWarnings('<a href="javascript:alert(1)">x</a>')).not.toHaveLength(0);
    expect(getCustomSpacerWarnings('<div style="height:10px;"></div>')).toHaveLength(0);
    expect(getCustomSpacerWarnings("")).toHaveLength(0);
  });

  it("sanitizes the spacer markup on request and keeps a safe spacer unchanged", () => {
    expect(sanitizeCustomSpacerMarkup('<div style="height:10px;"></div>')).toBe('<div style="height:10px;"></div>');
    expect(sanitizeCustomSpacerMarkup('<img src="x" onerror="window.__XSS=1">')).not.toContain("onerror");
    expect(sanitizeCustomSpacerMarkup("")).toBe("");
  });

  it("keeps the opt-in BR spacer untouched", () => {
    const output = convertWordToHtml('<p>Body text.</p><p>Read more:</p>', "shoppables", {
      customSpacer: CUSTOM_SPACER,
      brBeforeReadMore: true,
    });

    expect(output).toContain("<p><br></p>");
    expect(output).not.toContain(CUSTOM_SPACER);
  });

  it("falls back to the default spacer for unusable markup", () => {
    const output = convertWordToHtml(SOURCE_HTML, "blogs", { customSpacer: "not markup <" });

    expect(output).toContain("<p>&nbsp;</p>");
  });

  it("falls back to the default spacer for markup with several roots", () => {
    const output = convertWordToHtml(SOURCE_HTML, "blogs", {
      customSpacer: '<div style="height:10px;"></div><div style="height:10px;"></div>',
    });

    expect(output).toContain("<p>&nbsp;</p>");
    expect(output).not.toContain("height:10px");
  });
});
