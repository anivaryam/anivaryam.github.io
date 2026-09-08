import { describe, it, expect } from "vitest";
import { addSpacing } from "./mode-spacing";

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
