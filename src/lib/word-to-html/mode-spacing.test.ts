import { describe, it, expect } from "vitest";
import { addBoldParagraphSpacing, addSpacing, addSpacingBetweenParagraphs, getBoldParagraphSpacingIssues, getHeadingSpacingIssues } from "./mode-spacing";
import { convertWordToHtml, getUnformattedHtml } from "./converter";
import { formatCompact } from "./html-formatter";
import { getCustomSpacerWarnings, sanitizeCustomSpacerMarkup, stripSpacerMarkers } from "./spacer";
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
    const output = addSpacing('<h2>FAQ</h2><p>Introduction.</p><h2>Product details</h2><p>Product body.</p><h3>First product</h3>');
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

  it('adds spacing only before labeled read-more and Disclaimer paragraphs', () => {
    const body = '<p>Intro.</p><p>Bacteria spread more quickly.</p><p>You will see more results.</p><p>Read more about it later.</p><p>Disclaimers vary by state.</p>';
    const output = getUnformattedHtml(body + '<p>Read more: Details.</p>', 'blogs');
    expect(output).toBe(body + '<p>&nbsp;</p><p>Read more: Details.</p>');
    expect(validateMode(output, 'blogs', {}).summary.failed).toBe(0);
  });

  it("fills every paragraph gap even when the preceding gap already has spacing", () => {
    const doc = new DOMParser().parseFromString('<p>A</p><p>&nbsp;</p><p>B</p><p>C</p>', 'text/html');
    addSpacingBetweenParagraphs(doc);
    expect(doc.body.innerHTML).toBe('<p>A</p><p>&nbsp;</p><p>B</p><p>&nbsp;</p><p>C</p>');
    const validation = validateMode(doc.body.innerHTML, 'shoppables', { paragraphSpacing: true });
    expect(validation.results.find(result => result.ruleId === 'paragraph-spacing')?.passed).toBe(true);
  });
});

describe('fully bold paragraph gap decisions', () => {
  const paragraph = '<p><strong>Something</strong></p>';

  it.each(['<p>Gap</p>', '<p><strong>G</strong>ap</p>', '<p><strong>Gap</strong></p>', '<blockquote><p><strong>Gap</strong></p></blockquote>'])('amended whole-configuration gate disables generic decisions for any text: %s', (customSpacer) => {
    const doc = new DOMParser().parseFromString(paragraph + '<p><strong>Next.</strong></p>', 'text/html');
    expect(getBoldParagraphSpacingIssues(doc, customSpacer)).toEqual([]);
    expect(addBoldParagraphSpacing(doc.body.innerHTML, customSpacer)).toBe(doc.body.innerHTML);
  });

  it.each(Array.from('\t\n\r\f\v \u00A0\u2000\u2001\u2002\u2003\u2004\u2005\u2006\u2007\u2008\u2009\u200A\u200B\u3000\uFEFF'))('amended block-space character %j is blank configuration and not a target', (space) => {
    const customSpacer = `<p><strong>${space}</strong></p>`;
    const doc = new DOMParser().parseFromString(customSpacer + paragraph, 'text/html');
    expect(getBoldParagraphSpacingIssues(doc, customSpacer)).toEqual([]);
    const alone = new DOMParser().parseFromString(paragraph, 'text/html');
    expect(getBoldParagraphSpacingIssues(alone, customSpacer).map(issue => issue.element)).toEqual([alone.body.firstElementChild]);
    expect(getBoldParagraphSpacingIssues(new DOMParser().parseFromString(customSpacer, 'text/html'))).toEqual([]);
  });

  it.each(['\u0085', '\u1680', '\u2028', '\u2029', '\u202F', '\u205F', '\u2060', 'X'])('amended blank boundary excludes non-contract character %j', (text) => {
    const doc = new DOMParser().parseFromString(paragraph, 'text/html');
    expect(getBoldParagraphSpacingIssues(doc, `<p>${text}</p>`)).toEqual([]);
  });

  it('amended generic decision reuses surviving decorated zero-width gaps without broadening older recognizers', () => {
    const input = '<p class="gap"><strong>\u200B</strong></p>' + paragraph;
    const doc = new DOMParser().parseFromString(input, 'text/html');
    expect(getBoldParagraphSpacingIssues(doc)).toEqual([]);
    expect(addBoldParagraphSpacing(input)).toBe(input);
  });

  it.each(['<p>&nbsp;</p>', '<p><em>&nbsp;</em></p>', '<p><br></p>', '<hr>', '<p><strong>Gap</strong></p>'])('reuses recognized %s across only whitespace/comments without changing the document', (gap) => {
    const input = `${gap}\n <!--spacing--> \t${paragraph}`;
    const doc = new DOMParser().parseFromString(input, 'text/html');
    const before = doc.body.innerHTML;
    expect(getBoldParagraphSpacingIssues(doc, gap)).toEqual([]);
    expect(doc.body.innerHTML).toBe(before);
    expect(addBoldParagraphSpacing(input, gap)).toBe(before);
  });

  it.each(['Actual body.', '<span></span>', '<br>'])('does not jump across %s to an earlier gap', (barrier) => {
    const input = `<p>&nbsp;</p>${barrier}${paragraph}`;
    const doc = new DOMParser().parseFromString(input, 'text/html');
    expect(getBoldParagraphSpacingIssues(doc).map(issue => issue.element)).toEqual([doc.body.lastElementChild]);
    expect(addBoldParagraphSpacing(input)).toBe(`<p>&nbsp;</p>${barrier}<p>&nbsp;</p>${paragraph}`);
  });

  it('counts a standalone BR only when configured as the spacer and never deletes existing gaps', () => {
    expect(addBoldParagraphSpacing(`<br>${paragraph}`, '<br>')).toBe(`<br>${paragraph}`);
    const input = `<p>&nbsp;</p><p>&nbsp;</p>${paragraph}`;
    expect(addBoldParagraphSpacing(input)).toBe(input);
  });

  it.each(['', ' data-w2h-spacer="1"'])('excludes semantic custom spacer roots and nested descendants (%s)', (marker) => {
    const customSpacer = '<blockquote><p><strong>Gap</strong></p></blockquote>';
    const input = `<blockquote${marker}><p><strong>Gap</strong></p></blockquote>${paragraph}`;
    const doc = new DOMParser().parseFromString(input, 'text/html');
    expect(getBoldParagraphSpacingIssues(doc, customSpacer)).toEqual([]);
    expect(addBoldParagraphSpacing(input, customSpacer)).toBe(input);
    // An inserted spacer is recognized even without its original custom setting.
    if (marker) expect(getBoldParagraphSpacingIssues(doc)).toEqual([]);
  });

  it('excludes a retained code ancestor, not an inline code descendant or outside bold ancestor', () => {
    const doc = new DOMParser().parseFromString('<code></code><p><strong>Inline <code>sample()</code></strong></p><strong></strong>', 'text/html');
    const inside = doc.createElement('p');
    inside.innerHTML = '<strong>Code paragraph.</strong>';
    doc.querySelector('code')!.append(inside);
    const outside = doc.createElement('p');
    outside.textContent = 'Inherited only.';
    doc.body.lastElementChild!.append(outside);
    const before = doc.body.innerHTML;
    expect(getBoldParagraphSpacingIssues(doc).map(issue => issue.element)).toEqual([doc.body.children[1]]);
    expect(doc.body.innerHTML).toBe(before);
  });
});

describe('consecutive heading spacing', () => {
  it.each(['', '\n \t', '<!--no body-->', '\n <!--no body--> \n'])('preserves adjacency across only whitespace/comments: %j', (gap) => {
    const input = `<h2>Hello World</h2>${gap}<h3>The world is beautiful</h3>`;
    const doc = new DOMParser().parseFromString(input, 'text/html');
    expect(getHeadingSpacingIssues(doc)).toEqual([]);
    expect(addSpacing(input)).toBe(input);
  });

  it.each(['h1', 'h2', 'h3', 'h4', 'h5', 'h6'])('does not generate a gap after an adjacent %s at any heading rank', (tag) => {
    for (const next of ['h1', 'h2', 'h3', 'h4', 'h5', 'h6']) {
      const input = `<${tag}>First</${tag}><${next}>Next</${next}>`;
      expect(addSpacing(input)).toBe(input);
    }
  });

  it.each([
    '<p>Actual body.</p>', '<ul><li>Actual body.</li></ul>', 'Actual body.',
    '<br>', '<hr>', '<img src="photo.png" alt="Photo">', '<span></span>', '<div style="height:10px;"></div>',
  ])('does not cross substantive text or an intervening element: %s', (body) => {
    const input = `<h2>First</h2>${body}<h3>Next</h3>`;
    const doc = new DOMParser().parseFromString(input, 'text/html');
    expect(getHeadingSpacingIssues(doc).map(issue => [issue.element, issue.kind])).toEqual([[doc.querySelector('h3'), 'missing']]);
    expect(addSpacing(input)).toBe(`<h2>First</h2>${body}<p>&nbsp;</p><h3>Next</h3>`);
  });

  it.each(['<p></p>', '<p>&nbsp;</p>', '<p><em>&nbsp;</em></p>', '<p><br></p>'])('retains existing ordinary spacing without duplication or deletion: %s', (gap) => {
    const input = `<h2>First</h2>${gap}<h3>Next</h3>`;
    expect(getHeadingSpacingIssues(new DOMParser().parseFromString(input, 'text/html'))).toEqual([]);
    expect(addSpacing(input)).toBe(input);
    expect(addSpacing(addSpacing(input))).toBe(input);
  });

  it('consumes the first FAQ question before exempting adjacency and resets for ordinary sections', () => {
    const output = addSpacing('<h2>FAQ</h2><h3>First question?</h3><p>Answer.</p><h3>Second question?</h3><h2>Products</h2><h3>First product</h3><p>Product body.</p><h3>Next product</h3>');
    const doc = new DOMParser().parseFromString(output, 'text/html');
    const headings = doc.querySelectorAll('h3');
    expect(headings[0].previousElementSibling).toBe(doc.querySelector('h2'));
    expect(headings[1].previousElementSibling?.innerHTML).toBe('&nbsp;');
    expect(headings[2].previousElementSibling?.textContent).toBe('Products');
    expect(headings[3].previousElementSibling?.innerHTML).toBe('&nbsp;');
    expect(getHeadingSpacingIssues(doc)).toEqual([]);
  });

  it('keeps the Key Takeaways heading exception and spacing after its list', () => {
    const output = addSpacing('<p>Intro.</p><h2>Key Takeaways</h2><ul><li>Point.</li></ul><h2>Details</h2><h3>Subheading</h3>');
    const doc = new DOMParser().parseFromString(output, 'text/html');
    expect(doc.querySelector('h2')?.previousElementSibling?.textContent).toBe('Intro.');
    expect(doc.querySelector('ul')?.nextElementSibling?.innerHTML).toBe('&nbsp;');
    expect(doc.querySelector('h3')?.previousElementSibling?.textContent).toBe('Details');
    expect(validateMode(output, 'blogs', {}).results.find(r => r.ruleId === 'spacing-rules')?.passed).toBe(true);
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
  // The converter marks every spacer it inserts in the unformatted output it
  // validates. The formatted output carries the configured markup only.
  const MARKED_SPACER = '<div style="height:10px;" data-w2h-spacer="1"></div>';
  const SOURCE_HTML = '<p>Body text.</p><p>Sources:</p><ol><li>Source one</li></ol>';

  it.each(['<div><p><strong>Gap</strong></p></div>', '<p style="height:10px"><strong>Gap</strong></p>'])('amended ordinary cleaning preserves unsafe/forged/near-match input parity for %s', (customSpacer) => {
    expect(getCustomSpacerWarnings(customSpacer)).toEqual([]);
    const root = new DOMParser().parseFromString(customSpacer, 'text/html').body.firstElementChild!;
    const variants = [
      (element: Element) => element.setAttribute('onclick', 'window.__D3_XSS = 1'),
      (element: Element) => element.querySelector('strong')!.setAttribute('onmouseover', 'window.__D3_XSS = 1'),
      (element: Element) => element.setAttribute('style', 'background-image:url(javascript:alert(1))'),
      (element: Element) => { element.setAttribute('data-w2h-spacer', '1'); element.setAttribute('style', 'font-weight:400'); },
      (element: Element) => element.insertAdjacentHTML('beforeend', '<a href="javascript:alert(1)" style="background-image:url(javascript:alert(1))">Keep link text.</a>'),
    ];
    for (const mutate of variants) {
      const element = root.cloneNode(true) as Element;
      mutate(element);
      const input = element.outerHTML;
      for (const spacing of [false, true]) {
        const actual = getUnformattedHtml(input, 'blogs', { spacing, customSpacer });
        // With generic text-custom spacing withdrawn, this must be the same
        // ordinary source cleanup even when Spacing Rules is enabled.
        expect(actual).toBe(getUnformattedHtml(input, 'blogs', { spacing: false }));
        const doc = new DOMParser().parseFromString(actual, 'text/html');
        expect(doc.querySelector('[style], [onclick], [onmouseover], [href], [data-w2h-spacer]')).toBeNull();
        expect(doc.body.textContent).toContain('Gap');
      }
    }
  });

  it.each([
    '<div onclick="alert(1)"><p><strong>Gap</strong></p></div>',
    '<p style="height:10px;background-image:url(javascript:alert(1))"><strong>Gap</strong></p>',
    '<p style="height:10px;background-image: u\\72l(https://example.com/x)"><strong>Gap</strong></p>',
    '<p><strong>Gap</strong><a href="javascript:alert(1)">Keep.</a></p>',
    '<p><strong>Gap</strong><a href="ftp://example.com/file">Keep.</a></p>',
    '<p><strong>Gap</strong><a href="/guide" target="_blank">Keep.</a></p>',
    '<p><strong>Gap</strong><input value="Untrusted control"></p>',
    '<p style="height:expression(alert(1))"><strong>Gap</strong></p>',
    '<p style="background-image:url(https://example.invalid/x)"><strong>Gap</strong></p>',
  ])('amended input safety uses ordinary cleaning ON/OFF, not template admission: %s', (customSpacer) => {
    for (const spacing of [false, true]) {
      expect(getUnformattedHtml(customSpacer, 'blogs', { spacing, customSpacer })).toBe(
        getUnformattedHtml(customSpacer, 'blogs', { spacing: false }));
    }
  });

  it.each(['<div><p><strong>Gap</strong></p></div>', '<p style="height:10px"><strong>Gap</strong></p>'])('amended text setting retains authored Gap without adding another: %s', (customSpacer) => {
    const authored = '<p><strong>Gap</strong></p><p>After.</p>';
    let input = authored;
    for (let cycle = 0; cycle < 3; cycle++) {
      const output = convertWordToHtml(input, 'blogs', { customSpacer });
      expect(output.replace(/>\s+</g, '><')).toBe(authored);
      input = output;
    }
  });

  it("replaces the default spacer with the configured markup", () => {
    const output = convertWordToHtml(SOURCE_HTML, "blogs", { customSpacer: CUSTOM_SPACER });

    expect(output).toContain(CUSTOM_SPACER);
    expect(output).not.toContain("data-w2h-spacer");
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

    expect(output).toContain(CUSTOM_SPACER);
    expect(output).not.toContain("data-w2h-spacer");
    expect(output).not.toContain("<p>&nbsp;</p>");
  });

  it("validates the custom spacer as spacing", () => {
    const output = getUnformattedHtml(SOURCE_HTML, "blogs", { customSpacer: CUSTOM_SPACER });
    const validation = validateMode(output, "blogs", { customSpacer: CUSTOM_SPACER });

    expect(validation.results.find(result => result.ruleId === "spacing-rules")?.passed).toBe(true);
  });

  it.each(["", CUSTOM_SPACER, "<p>&#8203;</p>", "<hr>"])("validates spacer %j and does not double it when the copied output is converted again", (customSpacer) => {
    const article = '<h2>Key Takeaways</h2><ul><li>Point.</li></ul><p>Intro.</p><p>Body.</p><h2>Section</h2><p>Text.</p>' +
      '<p>Read more: Care.</p><p>Sources:</p><ol><li>Source one</li></ol><p>Disclaimer: General information.</p>';
    const features = { customSpacer, spacing: true, paragraphSpacing: true };
    for (const mode of ["regular", "blogs", "shoppables"] as const) {
      const output = getUnformattedHtml(article, mode, features);
      const failures = validateMode(output, mode, features).results.filter(result => !result.passed).map(result => result.ruleId);
      expect(failures).toEqual([]);

      const copied = stripSpacerMarkers(output);
      expect(stripSpacerMarkers(getUnformattedHtml(copied, mode, features))).toBe(copied);
      // The copied code carries formatting whitespace between the tags.
      const formatted = convertWordToHtml(article, mode, features);
      const blocks = (html: string) => stripSpacerMarkers(html).replace(/>\s+</g, "><");
      expect(blocks(getUnformattedHtml(formatted, mode, features))).toBe(copied);
    }
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

    expect(formatted).toContain(CUSTOM_SPACER);
    expect(formatted).not.toContain("data-w2h-spacer");
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
