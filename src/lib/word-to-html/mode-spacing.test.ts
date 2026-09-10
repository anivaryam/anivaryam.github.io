import { describe, it, expect } from "vitest";
import { addSpacing, addSpacingBetweenParagraphs } from "./mode-spacing";
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
