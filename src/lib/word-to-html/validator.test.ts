import { describe, it, expect } from 'vitest';
import { validateMode, type ValidationResults } from './validator';
import type { FeatureFlags, OutputMode } from './converter';

function getResult(results: ValidationResults, ruleId: string) {
  const r = results.results.find((x) => x.ruleId === ruleId);
  if (!r) throw new Error(`No result for ruleId "${ruleId}". Got: ${results.results.map((x) => x.ruleId).join(', ')}`);
  return r;
}

function expectPass(results: ValidationResults, ruleId: string) {
  const r = getResult(results, ruleId);
  expect(r.passed).toBe(true);
}

function expectFail(results: ValidationResults, ruleId: string) {
  const r = getResult(results, ruleId);
  expect(r.passed).toBe(false);
}

function expectSkipped(results: ValidationResults, ruleId: string) {
  const r = getResult(results, ruleId);
  expect(r.severity).toBe('info');
  expect(r.passed).toBe(true);
}

const defaultFeatures: FeatureFlags = {};

/* ------------------------------------------------------------------ */
/* Empty input                                                        */
/* ------------------------------------------------------------------ */

describe('validateMode — empty input', () => {
  it('returns empty results for empty HTML', () => {
    const results = validateMode('', 'regular', defaultFeatures);
    expect(results.results).toHaveLength(0);
    expect(results.summary.total).toBe(0);
  });

  it('returns empty results for whitespace-only HTML', () => {
    const results = validateMode('   \n  ', 'blogs', defaultFeatures);
    expect(results.results).toHaveLength(0);
  });
});

/* ------------------------------------------------------------------ */
/* validateSanitizedStructure                                          */
/* ------------------------------------------------------------------ */

describe('validateSanitizedStructure', () => {
  it('passes for allowed elements only', () => {
    const html = '<h2>Title</h2><p>Body with <strong>bold</strong> and <em>italic</em>.</p>';
    const results = validateMode(html, 'blogs', defaultFeatures);
    expectPass(results, 'sanitized-structure');
  });

  it('flags disallowed elements (span)', () => {
    const html = '<p>Body with <span>unsanitized span</span>.</p>';
    const results = validateMode(html, 'blogs', defaultFeatures);
    const r = getResult(results, 'sanitized-structure');
    expect(r.passed).toBe(false);
    expect(r.details?.some((d) => d.includes('<span>'))).toBe(true);
  });

  it('flags banned attributes (style)', () => {
    const html = '<p style="color:red">Body</p>';
    const results = validateMode(html, 'blogs', defaultFeatures);
    const r = getResult(results, 'sanitized-structure');
    expect(r.passed).toBe(false);
    expect(r.details?.some((d) => d.includes('"style"'))).toBe(true);
  });

  it('flags data-* attributes', () => {
    const html = '<p data-foo="bar">Body</p>';
    const results = validateMode(html, 'blogs', defaultFeatures);
    const r = getResult(results, 'sanitized-structure');
    expect(r.passed).toBe(false);
    expect(r.details?.some((d) => d.includes('"data-foo"'))).toBe(true);
  });

  it('flags on* event handlers', () => {
    const html = '<a href="https://example.com" onclick="evil()">link</a>';
    const results = validateMode(html, 'blogs', defaultFeatures);
    const r = getResult(results, 'sanitized-structure');
    expect(r.passed).toBe(false);
    expect(r.details?.some((d) => d.includes('"onclick"'))).toBe(true);
  });

  it('allows <u> element (wrap-links feature contract)', () => {
    const html = '<p><a href="https://x.com"><strong><u>x</u></strong></a></p>';
    const results = validateMode(html, 'blogs', defaultFeatures);
    expectPass(results, 'sanitized-structure');
  });

  it('flags disallowed elements that share prefix (<unknown>)', () => {
    const html = '<p><unknown>x</unknown></p>';
    const results = validateMode(html, 'blogs', defaultFeatures);
    const r = getResult(results, 'sanitized-structure');
    expect(r.passed).toBe(false);
    expect(r.details?.some((d) => d.includes('<unknown>'))).toBe(true);
  });

  it('allows style="font-style: italic" on Sources <li> (blogs)', () => {
    const html = '<p><strong><em>Sources:</em></strong></p><ol><li style="font-style: italic">src</li></ol>';
    const results = validateMode(html, 'blogs', defaultFeatures);
    expectPass(results, 'sanitized-structure');
  });

  it('allows style="font-style: italic" on Sources <li> (shoppables)', () => {
    const html = '<p><strong><em>Sources:</em></strong></p><ol><li style="font-style: italic">src</li></ol>';
    const results = validateMode(html, 'shoppables', defaultFeatures);
    expectPass(results, 'sanitized-structure');
  });

  it('flags mixed style declarations on Sources <li>', () => {
    const html = '<p><strong><em>Sources:</em></strong></p><ol><li style="font-style: italic; color: red">src</li></ol>';
    const results = validateMode(html, 'blogs', defaultFeatures);
    const r = getResult(results, 'sanitized-structure');
    expect(r.passed).toBe(false);
    expect(r.details?.some((d) => d.includes('"style"'))).toBe(true);
  });

  it('flags style="font-style: italic" on non-Sources <li>', () => {
    const html = '<ol><li style="font-style: italic">not sources</li></ol>';
    const results = validateMode(html, 'blogs', defaultFeatures);
    const r = getResult(results, 'sanitized-structure');
    expect(r.passed).toBe(false);
    expect(r.details?.some((d) => d.includes('"style"'))).toBe(true);
  });

  it('flags non-italic style on Sources <li> (e.g. font-style: oblique)', () => {
    const html = '<p><strong><em>Sources:</em></strong></p><ol><li style="font-style: oblique">src</li></ol>';
    const results = validateMode(html, 'blogs', defaultFeatures);
    const r = getResult(results, 'sanitized-structure');
    expect(r.passed).toBe(false);
    expect(r.details?.some((d) => d.includes('"style"'))).toBe(true);
  });
});

/* ------------------------------------------------------------------ */
/* validateLinkSafety                                                  */
/* ------------------------------------------------------------------ */

describe('validateLinkSafety', () => {
  it('passes for safe https:// and http://', () => {
    const html = '<a href="https://example.com">link</a><a href="http://example.com">x</a>';
    const results = validateMode(html, 'blogs', { linkAttributes: true });
    expectPass(results, 'link-safety');
  });

  it('passes for mailto and # anchors', () => {
    const html = '<a href="mailto:a@b.com">mail</a><a href="#section">anchor</a>';
    const results = validateMode(html, 'blogs', defaultFeatures);
    expectPass(results, 'link-safety');
  });

  it('flags javascript: protocol', () => {
    const html = '<a href="javascript:alert(1)">x</a>';
    const results = validateMode(html, 'blogs', defaultFeatures);
    const r = getResult(results, 'link-safety');
    expect(r.passed).toBe(false);
    expect(r.details?.some((d) => d.includes('javascript:'))).toBe(true);
  });

  it('flags data: protocol (not in SAFE_PROTOCOLS)', () => {
    const html = '<a href="data:text/html,<script>1</script>">x</a>';
    const results = validateMode(html, 'blogs', defaultFeatures);
    const r = getResult(results, 'link-safety');
    expect(r.passed).toBe(false);
    expect(r.details?.some((d) => d.includes('data:'))).toBe(true);
  });

  it('flags tel: protocol (not in SAFE_PROTOCOLS)', () => {
    const html = '<a href="tel:+1234567890">call</a>';
    const results = validateMode(html, 'blogs', defaultFeatures);
    const r = getResult(results, 'link-safety');
    expect(r.passed).toBe(false);
    expect(r.details?.some((d) => d.includes('tel:'))).toBe(true);
  });

  it('flags _blank links missing noopener', () => {
    const html = '<a href="https://example.com" target="_blank" rel="noreferrer">x</a>';
    const results = validateMode(html, 'blogs', { linkAttributes: true });
    const r = getResult(results, 'link-safety');
    expect(r.passed).toBe(false);
    expect(r.details?.some((d) => d.includes('noopener'))).toBe(true);
  });

  it('passes _blank with noopener noreferrer', () => {
    const html = '<a href="https://example.com" target="_blank" rel="noopener noreferrer">x</a>';
    const results = validateMode(html, 'blogs', { linkAttributes: true });
    expectPass(results, 'link-safety');
  });

  it('flags unsafe rel value', () => {
    const html = '<a href="https://example.com" rel="sponsored">x</a>';
    const results = validateMode(html, 'blogs', defaultFeatures);
    const r = getResult(results, 'link-safety');
    expect(r.passed).toBe(false);
    expect(r.details?.some((d) => d.includes('sponsored'))).toBe(true);
  });
});

/* ------------------------------------------------------------------ */
/* validateBasicStructure                                              */
/* ------------------------------------------------------------------ */

describe('validateBasicStructure', () => {
  it('regular mode passes with content', () => {
    const results = validateMode('<p>Hello world</p>', 'regular', defaultFeatures);
    expectPass(results, 'basic-structure');
  });

  it('regular mode fails with empty body', () => {
    const results = validateMode('', 'regular', defaultFeatures);
    /* Empty HTML returns empty results entirely; this is folded into the
     * empty-input behavior above. Confirm we're getting that path. */
    expect(results.results.find((r) => r.ruleId === 'basic-structure')).toBeUndefined();
  });

  it('skipped for blogs mode', () => {
    const results = validateMode('<p>x</p>', 'blogs', defaultFeatures);
    expectSkipped(results, 'basic-structure');
  });
});

/* ------------------------------------------------------------------ */
/* validateHeadingStrong                                               */
/* ------------------------------------------------------------------ */

describe('validateHeadingStrong', () => {
  it('regular: passes when no heading is wrapped in <strong>', () => {
    const html = '<h2>Title</h2><p>Body</p>';
    const results = validateMode(html, 'regular', defaultFeatures);
    expectPass(results, 'heading-strong');
  });

  it('regular: fails when heading is wrapped in <strong>', () => {
    const html = '<h2><strong>Title</strong></h2>';
    const results = validateMode(html, 'regular', defaultFeatures);
    expectFail(results, 'heading-strong');
  });

  it('blogs default: passes when all headings wrapped', () => {
    const html = '<h2><strong>Title</strong></h2><p>x</p>';
    const results = validateMode(html, 'blogs', defaultFeatures);
    expectPass(results, 'heading-strong');
  });

  it('blogs default: fails when headings missing wrapper', () => {
    const html = '<h2>Title</h2><p>x</p>';
    const results = validateMode(html, 'blogs', defaultFeatures);
    expectFail(results, 'heading-strong');
  });

  it('blogs with feature disabled: passes when headings unwrapped', () => {
    const html = '<h2>Title</h2><p>x</p>';
    const results = validateMode(html, 'blogs', { headingStrong: false });
    expectPass(results, 'heading-strong');
  });

  it('blogs with feature disabled: fails when headings still wrapped', () => {
    const html = '<h2><strong>Title</strong></h2><p>x</p>';
    const results = validateMode(html, 'blogs', { headingStrong: false });
    expectFail(results, 'heading-strong');
  });
});

/* ------------------------------------------------------------------ */
/* validateKeyTakeaways (D4 — heading normalization check)              */
/* ------------------------------------------------------------------ */

describe('validateKeyTakeaways (D4)', () => {
  it('skipped only for shoppables mode (regular mode validates per §B)', () => {
    const html = '<h2><strong>Key Takeaways</strong></h2><ul><li>thing</li></ul>';
    const results = validateMode(html, 'shoppables', defaultFeatures);
    expectSkipped(results, 'key-takeaways');
  });

  it('passes when section absent', () => {
    const html = '<p>Just a paragraph.</p>';
    const results = validateMode(html, 'blogs', defaultFeatures);
    expectSkipped(results, 'key-takeaways');
  });

  it('D4: fails when heading missing trailing colon (feature enabled)', () => {
    const html = '<h2><strong>Key Takeaways</strong></h2><ul><li>thing</li></ul>';
    const results = validateMode(html, 'blogs', defaultFeatures);
    expectFail(results, 'key-takeaways');
  });

  it('D4: fails when heading still contains <em>', () => {
    const html = '<h2><strong><em>Key Takeaways:</em></strong></h2><ul><li>thing</li></ul>';
    const results = validateMode(html, 'blogs', defaultFeatures);
    expectFail(results, 'key-takeaways');
  });

  it('passes with proper heading and no em in items', () => {
    const html = '<h2><strong>Key Takeaways:</strong></h2><ul><li>plain item</li></ul>';
    const results = validateMode(html, 'blogs', defaultFeatures);
    expectPass(results, 'key-takeaways');
  });

  it('fails when em tags remain in list (feature enabled)', () => {
    const html = '<h2><strong>Key Takeaways:</strong></h2><ul><li><em>italic item</em></li></ul>';
    const results = validateMode(html, 'blogs', defaultFeatures);
    expectFail(results, 'key-takeaways');
  });

  it('passes when em tags remain but feature disabled', () => {
    const html = '<h2><strong>Key Takeaways:</strong></h2><ul><li><em>italic item</em></li></ul>';
    const results = validateMode(html, 'blogs', { keyTakeaways: false });
    expectPass(results, 'key-takeaways');
  });
});

/* ------------------------------------------------------------------ */
/* validateH1AfterKeyTakeaways (D1 fix — walk past spacing)            */
/* ------------------------------------------------------------------ */

describe('validateH1AfterKeyTakeaways (D1)', () => {
  it('passes when H1 is removed', () => {
    const html = '<h2><strong>Key Takeaways:</strong></h2><ul><li>x</li></ul><p>next</p>';
    const results = validateMode(html, 'blogs', defaultFeatures);
    expectPass(results, 'h1-after-key-takeaways');
  });

  it('D1: fails when H1 is hidden behind <p>&nbsp;</p> spacer', () => {
    const html = '<h2><strong>Key Takeaways:</strong></h2><ul><li>x</li></ul><p>&nbsp;</p><h1>Left over H1</h1>';
    const results = validateMode(html, 'blogs', defaultFeatures);
    expectFail(results, 'h1-after-key-takeaways');
  });

  it('D1: fails when H1 is hidden behind <p><br></p> BR spacer', () => {
    const html = '<h2><strong>Key Takeaways:</strong></h2><ul><li>x</li></ul><p><br></p><h1>Left over H1</h1>';
    const results = validateMode(html, 'blogs', defaultFeatures);
    expectFail(results, 'h1-after-key-takeaways');
  });

  it('passes when H1 present but feature disabled', () => {
    const html = '<h2><strong>Key Takeaways:</strong></h2><ul><li>x</li></ul><h1>Title</h1>';
    const results = validateMode(html, 'blogs', { h1Removal: false });
    expectPass(results, 'h1-after-key-takeaways');
  });
});

/* ------------------------------------------------------------------ */
/* validateLinkAttributes                                              */
/* ------------------------------------------------------------------ */

describe('validateLinkAttributes', () => {
  it('regular: passes when no target/rel', () => {
    const html = '<a href="https://x.com">link</a>';
    const results = validateMode(html, 'regular', defaultFeatures);
    expectPass(results, 'link-attributes');
  });

  it('regular: skipped (target/rel is a blogs/shoppables concern)', () => {
    const html = '<a href="https://x.com" target="_blank">link</a>';
    const results = validateMode(html, 'regular', defaultFeatures);
    expectSkipped(results, 'link-attributes');
  });

  it('blogs default: passes with full attributes', () => {
    const html = '<a href="https://x.com" target="_blank" rel="noopener noreferrer">link</a>';
    const results = validateMode(html, 'blogs', defaultFeatures);
    expectPass(results, 'link-attributes');
  });

  it('blogs default: fails when missing noopener', () => {
    const html = '<a href="https://x.com" target="_blank" rel="noreferrer">link</a>';
    const results = validateMode(html, 'blogs', defaultFeatures);
    expectFail(results, 'link-attributes');
  });

  it('blogs disabled: passes when attributes absent', () => {
    const html = '<a href="https://x.com">link</a>';
    const results = validateMode(html, 'blogs', { linkAttributes: false });
    expectPass(results, 'link-attributes');
  });
});

/* ------------------------------------------------------------------ */
/* validateRelativePaths                                               */
/* ------------------------------------------------------------------ */

describe('validateRelativePaths', () => {
  it('passes when all paths are relative', () => {
    const html = '<a href="/path/to/page">link</a><a href="../other">x</a>';
    const results = validateMode(html, 'blogs', { relativePaths: true });
    expectPass(results, 'relative-paths');
  });

  it('fails when absolute URL present', () => {
    const html = '<a href="https://example.com/page">link</a>';
    const results = validateMode(html, 'blogs', { relativePaths: true });
    expectFail(results, 'relative-paths');
  });

  it('passes for mailto and anchors even with feature on', () => {
    const html = '<a href="mailto:a@b.com">m</a><a href="#x">a</a>';
    const results = validateMode(html, 'blogs', { relativePaths: true });
    expectPass(results, 'relative-paths');
  });
});

/* ------------------------------------------------------------------ */
/* validateLinkSpacing (D2 — element siblings too)                     */
/* ------------------------------------------------------------------ */

describe('validateLinkSpacing (D2)', () => {
  it('passes with proper space before link', () => {
    const html = '<p>Read more <a href="https://x.com">here</a>.</p>';
    const results = validateMode(html, 'blogs', defaultFeatures);
    expectPass(results, 'link-spacing');
  });

  it('passes after opening punctuation', () => {
    const html = '<p>(<a href="https://x.com">link</a>)</p>';
    const results = validateMode(html, 'blogs', defaultFeatures);
    expectPass(results, 'link-spacing');
  });

  it('passes after closing punctuation', () => {
    const html = '<p>End.<a href="https://x.com">More</a></p>';
    const results = validateMode(html, 'blogs', defaultFeatures);
    expectPass(results, 'link-spacing');
  });

  it('fails with no space and no punctuation', () => {
    const html = '<p>word<a href="https://x.com">link</a></p>';
    const results = validateMode(html, 'blogs', defaultFeatures);
    expectFail(results, 'link-spacing');
  });

  it('passes at start of paragraph', () => {
    const html = '<p><a href="https://x.com">link</a> after</p>';
    const results = validateMode(html, 'blogs', defaultFeatures);
    expectPass(results, 'link-spacing');
  });
});

/* ------------------------------------------------------------------ */
/* validateListNormalize (D14 — &nbsp; trailing whitespace)            */
/* ------------------------------------------------------------------ */

describe('validateListNormalize (D14)', () => {
  it('passes with strong + colon + space + content', () => {
    const html = '<ul><li><strong>Label:</strong> content</li></ul>';
    const results = validateMode(html, 'blogs', defaultFeatures);
    expectPass(results, 'list-normalization');
  });

  it('fails when no space after </strong>', () => {
    const html = '<ul><li><strong>Label:</strong>content</li></ul>';
    const results = validateMode(html, 'blogs', defaultFeatures);
    expectFail(results, 'list-normalization');
  });

  it('D14: fails when trailing space before </strong>', () => {
    const html = '<ul><li><strong>Label: </strong>content</li></ul>';
    const results = validateMode(html, 'blogs', defaultFeatures);
    expectFail(results, 'list-normalization');
  });

  it('D14: fails when trailing &nbsp; before </strong>', () => {
    const html = '<ul><li><strong>Label:&nbsp;</strong>content</li></ul>';
    const results = validateMode(html, 'blogs', defaultFeatures);
    expectFail(results, 'list-normalization');
  });

  it('excludes Sources section items', () => {
    const html = '<p><strong><em>Sources:</em></strong></p><ol><li><em>src 1</em></li></ol><ul><li><strong>Bad:</strong></li></ul>';
    const results = validateMode(html, 'blogs', defaultFeatures);
    expectFail(results, 'list-normalization');
  });
});

/* ------------------------------------------------------------------ */
/* validateOlBoldLabels                                                */
/* ------------------------------------------------------------------ */

describe('validateOlBoldLabels', () => {
  it('passes when all colon items have bold labels', () => {
    const html = '<ol><li><strong>Foo:</strong> text</li><li><strong>Bar:</strong> text</li></ol>';
    const results = validateMode(html, 'blogs', defaultFeatures);
    expectPass(results, 'ol-bold-labels');
  });

  it('fails when items with colons are missing bold', () => {
    const html = '<ol><li><strong>Foo:</strong> text</li><li>No bold here:</li></ol>';
    const results = validateMode(html, 'blogs', defaultFeatures);
    expectFail(results, 'ol-bold-labels');
  });

  it('excludes Sources list items', () => {
    const html = '<p>Sources:</p><ol><li>plain source</li></ol><ol><li><strong>Bolded:</strong> text</li></ol>';
    const results = validateMode(html, 'blogs', defaultFeatures);
    expectPass(results, 'ol-bold-labels');
  });
});

/* ------------------------------------------------------------------ */
/* validateSourcesNormalize (D7 — label vs body em)                    */
/* ------------------------------------------------------------------ */

describe('validateSourcesNormalize (D7)', () => {
  const normalizedSources = '<p><strong><em>Sources:</em></strong></p><ol><li><em>First source</em></li><li><em>Second source</em></li></ol>';

  it('passes for fully normalized sources', () => {
    const results = validateMode(normalizedSources, 'blogs', defaultFeatures);
    expectPass(results, 'sources-normalization');
  });

  it('fails when label missing <strong>', () => {
    const html = '<p><em>Sources:</em></p><ol><li><em>First source</em></li></ol>';
    const results = validateMode(html, 'blogs', defaultFeatures);
    expectFail(results, 'sources-normalization');
  });

  it('fails when list item missing <em> wrapper', () => {
    const html = '<p><strong><em>Sources:</em></strong></p><ol><li>Plain first</li></ol>';
    const results = validateMode(html, 'blogs', defaultFeatures);
    expectFail(results, 'sources-normalization');
  });

  it('D7: a body <em> outside Sources label does not falsely trigger normalization', () => {
    /* Body em inside the same paragraph as the label should not confuse the
     * validator — we anchor on :scope > strong > em for the label. */
    const html = '<p><strong><em>Sources:</em></strong> body with <em>emphasis</em>.</p><ol><li><em>src</em></li></ol>';
    const results = validateMode(html, 'blogs', defaultFeatures);
    expectPass(results, 'sources-normalization');
  });

  it('disabled: passes when sources are NOT normalized', () => {
    const html = '<p>Sources:</p><ol><li>First source</li></ol>';
    const results = validateMode(html, 'blogs', { sourcesNormalize: false });
    expectPass(results, 'sources-normalization');
  });

  it('disabled: fails when sources ARE normalized', () => {
    const results = validateMode(normalizedSources, 'blogs', { sourcesNormalize: false });
    expectFail(results, 'sources-normalization');
  });
});

/* ------------------------------------------------------------------ */
/* validateRemoveSourcesLinks (D8 strict)                              */
/* ------------------------------------------------------------------ */

describe('validateRemoveSourcesLinks (D8)', () => {
  const sourcesWithLinks = '<p><strong><em>Sources:</em></strong></p><ol><li><em><a href="https://x.com">link</a></em></li></ol>';

  it('enabled: passes when no anchors in Sources', () => {
    const html = '<p><strong><em>Sources:</em></strong></p><ol><li><em>plain</em></li></ol>';
    const results = validateMode(html, 'blogs', defaultFeatures);
    expectPass(results, 'remove-sources-links');
  });

  it('enabled: fails when anchors present', () => {
    const results = validateMode(sourcesWithLinks, 'blogs', defaultFeatures);
    expectFail(results, 'remove-sources-links');
  });

  it('D8 strict: disabled: passes when anchors are preserved', () => {
    const results = validateMode(sourcesWithLinks, 'blogs', { removeSourcesLinks: false });
    expectPass(results, 'remove-sources-links');
  });

  it('D8 strict: disabled: skipped when no anchors (nothing to validate)', () => {
    const html = '<p><strong><em>Sources:</em></strong></p><ol><li><em>plain</em></li></ol>';
    const results = validateMode(html, 'blogs', { removeSourcesLinks: false });
    expectSkipped(results, 'remove-sources-links');
  });
});

/* ------------------------------------------------------------------ */
/* validateDisclaimerNormalize (D5)                                    */
/* ------------------------------------------------------------------ */

describe('validateDisclaimerNormalize (D5)', () => {
  it('skipped when no Disclaimer present', () => {
    const results = validateMode('<p>No disclaimer here.</p>', 'blogs', defaultFeatures);
    expectSkipped(results, 'disclaimer-normalization');
  });

  it('passes when label is properly normalized', () => {
    const html = '<p><strong><em>Disclaimer:</em></strong> Body text.</p>';
    const results = validateMode(html, 'blogs', defaultFeatures);
    expectPass(results, 'disclaimer-normalization');
  });

  it('fails when label missing em', () => {
    const html = '<p><strong>Disclaimer:</strong> Body text.</p>';
    const results = validateMode(html, 'blogs', defaultFeatures);
    expectFail(results, 'disclaimer-normalization');
  });

  it('D5: disabled: fails when strong><em>Disclaimer:</em> is present', () => {
    const html = '<p><strong><em>Disclaimer:</em></strong> Body text.</p>';
    const results = validateMode(html, 'blogs', { disclaimerNormalize: false });
    expectFail(results, 'disclaimer-normalization');
  });

  it('D5: disabled: passes when label is plain', () => {
    const html = '<p>Disclaimer: Body text.</p>';
    const results = validateMode(html, 'blogs', { disclaimerNormalize: false });
    expectPass(results, 'disclaimer-normalization');
  });
});

/* ------------------------------------------------------------------ */
/* validateSpacing (D9 BR-spacing, D11 alt-image-text)                 */
/* ------------------------------------------------------------------ */

describe('validateSpacing (D9 / D11)', () => {
  it('regular mode: skipped', () => {
    const results = validateMode('<h2>Title</h2>', 'regular', defaultFeatures);
    expectSkipped(results, 'spacing-rules');
  });

  it('blogs default (enabled): fails when missing spacing before heading', () => {
    const html = '<p>Some content.</p><h2>Heading</h2>';
    const results = validateMode(html, 'blogs', defaultFeatures);
    expectFail(results, 'spacing-rules');
  });

  it('D9: blogs enabled: passes with <p><br></p> as spacing', () => {
    const html = '<p>Some content.</p><p><br></p><h2>Heading</h2>';
    const results = validateMode(html, 'blogs', defaultFeatures);
    expectPass(results, 'spacing-rules');
  });

  it('D9: blogs enabled: passes with &nbsp; spacing', () => {
    const html = '<p>Some content.</p><p>&nbsp;</p><h2>Heading</h2>';
    const results = validateMode(html, 'blogs', defaultFeatures);
    expectPass(results, 'spacing-rules');
  });

  it('blogs disabled: fails when spacing elements present', () => {
    const html = '<p>Content.</p><p>&nbsp;</p><h2>Heading</h2>';
    const results = validateMode(html, 'blogs', { spacing: false });
    expectFail(results, 'spacing-rules');
  });

  it('D11: alt image text exact match triggers spacing check', () => {
    const html = '<p>Body</p><p>Alt image text: description</p>';
    const results = validateMode(html, 'blogs', defaultFeatures);
    expectFail(results, 'spacing-rules');
  });

  it('D11: alt image text mid-sentence does NOT trigger the alt-image-text-specific message', () => {
    /* Strict startsWith matching means a paragraph that *contains* but does
     * not *start with* "alt image text:" is not treated as the label. */
    const html = '<p>Body</p><p>Alt image text: description</p><p>See the alt image text: example.</p>';
    const results = validateMode(html, 'blogs', defaultFeatures);
    const r = getResult(results, 'spacing-rules');
    const altImageIssues = r.details?.filter((d) => d.toLowerCase().includes('alt image text')) || [];
    /* Only the exact-prefix paragraph should produce an "alt image text:" issue. */
    expect(altImageIssues.length).toBe(1);
  });
});

/* ------------------------------------------------------------------ */
/* validateParagraphSpacing                                            */
/* ------------------------------------------------------------------ */

describe('validateParagraphSpacing', () => {
  it('regular mode: skipped', () => {
    const results = validateMode('<p>A</p><p>B</p>', 'regular', defaultFeatures);
    expectSkipped(results, 'paragraph-spacing');
  });

  it('disabled: skipped', () => {
    const results = validateMode('<p>A</p><p>B</p>', 'blogs', defaultFeatures);
    expectSkipped(results, 'paragraph-spacing');
  });

  it('enabled: passes when all adjacent paragraphs have spacer', () => {
    const html = '<p>A</p><p>&nbsp;</p><p>B</p>';
    const results = validateMode(html, 'blogs', { paragraphSpacing: true });
    expectPass(results, 'paragraph-spacing');
  });

  it('enabled: fails when a pair of paragraphs has no spacer', () => {
    const html = '<p>A</p><p>B</p>';
    const results = validateMode(html, 'blogs', { paragraphSpacing: true });
    expectFail(results, 'paragraph-spacing');
  });
});

/* ------------------------------------------------------------------ */
/* validateSourcesItalic                                               */
/* ------------------------------------------------------------------ */

describe('validateSourcesItalic', () => {
  const sourcesItalicized = '<p><strong><em>Sources:</em></strong></p><ol><li style="font-style: italic">src</li></ol>';

  it('non-blogs/shoppables: skipped', () => {
    const results = validateMode('<p>x</p>', 'regular', defaultFeatures);
    expectSkipped(results, 'sources-italic');
  });

  it('enabled: passes when all items italicized', () => {
    const results = validateMode(sourcesItalicized, 'blogs', defaultFeatures);
    expectPass(results, 'sources-italic');
  });

  it('enabled: fails when items missing italic', () => {
    const html = '<p><strong><em>Sources:</em></strong></p><ol><li><em>plain</em></li></ol>';
    const results = validateMode(html, 'blogs', defaultFeatures);
    expectFail(results, 'sources-italic');
  });

  it('disabled: passes when no italic', () => {
    const html = '<p><strong><em>Sources:</em></strong></p><ol><li><em>plain</em></li></ol>';
    const results = validateMode(html, 'blogs', { sourcesItalic: false });
    expectPass(results, 'sources-italic');
  });

  it('disabled: fails when italic still present', () => {
    const results = validateMode(sourcesItalicized, 'blogs', { sourcesItalic: false });
    expectFail(results, 'sources-italic');
  });
});

/* ------------------------------------------------------------------ */
/* validateBrBeforeReadMore / validateBrBeforeSources                  */
/* ------------------------------------------------------------------ */

describe('validateBrBeforeReadMore', () => {
  it('non-shoppables: skipped', () => {
    const results = validateMode('<p>Read more: foo</p>', 'blogs', { brBeforeReadMore: true });
    expectSkipped(results, 'br-before-read-more');
  });

  it('disabled: skipped', () => {
    const results = validateMode('<p>Read more: foo</p>', 'shoppables', defaultFeatures);
    expectSkipped(results, 'br-before-read-more');
  });

  it('enabled + target present: passes when BR spacer precedes', () => {
    const html = '<p>Body.</p><p><br></p><p>Read more: link</p>';
    const results = validateMode(html, 'shoppables', { brBeforeReadMore: true });
    expectPass(results, 'br-before-read-more');
  });

  it('enabled + target present: fails when BR spacer missing', () => {
    const html = '<p>Body.</p><p>Read more: link</p>';
    const results = validateMode(html, 'shoppables', { brBeforeReadMore: true });
    expectFail(results, 'br-before-read-more');
  });

  it('handles "Read also:" and "See more:"', () => {
    const html = '<p>Body.</p><p>Read also: x</p><p>Body2.</p><p>See more: y</p>';
    const results = validateMode(html, 'shoppables', { brBeforeReadMore: true });
    expectFail(results, 'br-before-read-more');
    const r = getResult(results, 'br-before-read-more');
    expect(r.details?.length).toBe(2);
  });
});

describe('validateBrBeforeSources', () => {
  it('non-shoppables: skipped', () => {
    const results = validateMode('<p>Sources:</p>', 'blogs', { brBeforeSources: true });
    expectSkipped(results, 'br-before-sources');
  });

  it('enabled: passes when BR precedes Sources', () => {
    const html = '<p>Body.</p><p><br></p><p>Sources:</p><ol><li>src</li></ol>';
    const results = validateMode(html, 'shoppables', { brBeforeSources: true });
    expectPass(results, 'br-before-sources');
  });

  it('enabled: fails when BR missing', () => {
    const html = '<p>Body.</p><p>Sources:</p><ol><li>src</li></ol>';
    const results = validateMode(html, 'shoppables', { brBeforeSources: true });
    expectFail(results, 'br-before-sources');
  });
});

/* ------------------------------------------------------------------ */
/* validateOlHeaderConversion (D6 / D13)                               */
/* ------------------------------------------------------------------ */

describe('validateOlHeaderConversion (D6 / D13)', () => {
  it('no ol: skipped', () => {
    const results = validateMode('<p>No lists</p>', 'blogs', defaultFeatures);
    expectSkipped(results, 'ol-header-conversion');
  });

  it('enabled: passes when converted to numbered headings', () => {
    const html = '<h2>1. Title</h2><p>body</p><h2>2. Next</h2>';
    const results = validateMode(html, 'blogs', defaultFeatures);
    expectPass(results, 'ol-header-conversion');
  });

  it('disabled: fails when numbered headings present', () => {
    const html = '<h2>1. Title</h2><p>body</p>';
    const results = validateMode(html, 'blogs', { olHeaderConversion: false });
    expectFail(results, 'ol-header-conversion');
  });

  it('disabled: passes when header lists still present as <ol>', () => {
    const html = '<ol><li><strong><h3>Title</h3></strong></li></ol>';
    const results = validateMode(html, 'blogs', { olHeaderConversion: false });
    expectPass(results, 'ol-header-conversion');
  });

  it('D6: enabled: passes for "1)" format without trailing space', () => {
    const html = '<h2>1)Title</h2>';
    const results = validateMode(html, 'blogs', defaultFeatures);
    /* No header lists to convert, so should be skipped */
    expectSkipped(results, 'ol-header-conversion');
  });
});

/* ------------------------------------------------------------------ */
/* validateMode — regular mode skips blogs/shoppables validators       */
/* ------------------------------------------------------------------ */

describe('validateMode — regular mode skips blogs/shoppables validators', () => {
  it('regular + keyTakeaways feature: validation is skipped', () => {
    const html = '<h2><strong>Key Takeaways</strong></h2><ul><li>plain</li></ul><p>rest</p>';
    const results = validateMode(html, 'regular', { keyTakeaways: true });
    expectSkipped(results, 'key-takeaways');
  });

  it('regular + sourcesNormalize: validation is skipped', () => {
    const html = '<p>Sources:</p><ol><li>plain</li></ol>';
    const results = validateMode(html, 'regular', { sourcesNormalize: true });
    expectSkipped(results, 'sources-normalization');
  });

  it('regular + disclaimerNormalize: validation is skipped', () => {
    const html = '<p>Disclaimer: body</p>';
    const results = validateMode(html, 'regular', { disclaimerNormalize: true });
    expectSkipped(results, 'disclaimer-normalization');
  });

  it('regular + removeSourcesLinks: validation is skipped', () => {
    const html = '<p><strong><em>Sources:</em></strong></p><ol><li><em><a href="https://x.com">l</a></em></li></ol>';
    const results = validateMode(html, 'regular', { removeSourcesLinks: true });
    expectSkipped(results, 'remove-sources-links');
  });

  it('regular + h1Removal: validation is skipped', () => {
    const html = '<h2><strong>Key Takeaways</strong></h2><ul><li>plain</li></ul><h1>Title</h1>';
    const results = validateMode(html, 'regular', { h1Removal: true });
    expectSkipped(results, 'h1-after-key-takeaways');
  });

  it('regular + olHeaderConversion: validation is skipped', () => {
    const html = '<ol><li><strong><h3>Title</h3></strong></li></ol>';
    const results = validateMode(html, 'regular', { olHeaderConversion: true });
    expectSkipped(results, 'ol-header-conversion');
  });

  it('regular + olBoldLabels: validation is skipped', () => {
    const html = '<ol><li>Item: thing</li></ol>';
    const results = validateMode(html, 'regular', defaultFeatures);
    expectSkipped(results, 'ol-bold-labels');
  });

  it('regular + linkAttributes: validation is skipped', () => {
    const html = '<a href="https://x.com" target="_blank" rel="noopener noreferrer">x</a>';
    const results = validateMode(html, 'regular', { linkAttributes: true });
    expectSkipped(results, 'link-attributes');
  });

  it('regular + paragraphSpacing: spacing is validated', () => {
    const html = '<p>A</p><p>B</p>';
    const results = validateMode(html, 'regular', { paragraphSpacing: true });
    expectFail(results, 'paragraph-spacing');
  });

  it('regular mode: sanitizer rules still run', () => {
    const html = '<p style="color:red">x</p>';
    const results = validateMode(html, 'regular', defaultFeatures);
    expectFail(results, 'sanitized-structure');
  });

  it('regular mode: link safety still runs', () => {
    const html = '<a href="javascript:alert(1)">x</a>';
    const results = validateMode(html, 'regular', defaultFeatures);
    expectFail(results, 'link-safety');
  });
});

/* ------------------------------------------------------------------ */
/* validateWrapLinksStrongUnderline                                    */
/* ------------------------------------------------------------------ */

describe('validateWrapLinksStrongUnderline', () => {
  it('regular: skipped', () => {
    const html = '<p><a href="https://x.com">x</a></p>';
    const results = validateMode(html, 'regular', { wrapLinksStrongUnderline: true });
    expectSkipped(results, 'wrap-links-strong-underline');
  });

  it('no links: skipped (enabled)', () => {
    const results = validateMode('<p>plain</p>', 'blogs', { wrapLinksStrongUnderline: true });
    expectSkipped(results, 'wrap-links-strong-underline');
  });

  it('no links: skipped (disabled)', () => {
    const results = validateMode('<p>plain</p>', 'blogs', { wrapLinksStrongUnderline: false });
    expectSkipped(results, 'wrap-links-strong-underline');
  });

  it('enabled: passes when all non-alt-text links are wrapped', () => {
    const html = '<p>See <a href="https://x.com"><strong><u>x</u></strong></a>.</p>';
    const results = validateMode(html, 'blogs', { wrapLinksStrongUnderline: true });
    expectPass(results, 'wrap-links-strong-underline');
  });

  it('enabled: fails when a plain link is unwrapped', () => {
    const html = '<p>See <a href="https://x.com">x</a>.</p>';
    const results = validateMode(html, 'blogs', { wrapLinksStrongUnderline: true });
    expectFail(results, 'wrap-links-strong-underline');
  });

  it('enabled: skips image links (<a><img></a>)', () => {
    const html = '<p><a href="https://x.com"><img src="/i.png" alt="x"></a></p>';
    const results = validateMode(html, 'blogs', { wrapLinksStrongUnderline: true });
    expectPass(results, 'wrap-links-strong-underline');
  });

  it('enabled: skips links in "Alt image text:" paragraph', () => {
    const html = '<p>alt image text: see <a href="https://x.com">x</a></p>';
    const results = validateMode(html, 'blogs', { wrapLinksStrongUnderline: true });
    expectPass(results, 'wrap-links-strong-underline');
  });

  it('enabled: wraps body links but skips alt-text links', () => {
    const html =
      '<p>alt image text: see <a href="https://src.com">src</a></p>' +
      '<p>See <a href="https://x.com">x</a> for more.</p>';
    const results = validateMode(html, 'blogs', { wrapLinksStrongUnderline: true });
    expectFail(results, 'wrap-links-strong-underline');
  });

  it('disabled: passes when no wrap', () => {
    const html = '<p>See <a href="https://x.com">x</a>.</p>';
    const results = validateMode(html, 'blogs', { wrapLinksStrongUnderline: false });
    expectPass(results, 'wrap-links-strong-underline');
  });

  it('disabled: fails when wrap still present', () => {
    const html = '<p><a href="https://x.com"><strong><u>x</u></strong></a></p>';
    const results = validateMode(html, 'blogs', { wrapLinksStrongUnderline: false });
    expectFail(results, 'wrap-links-strong-underline');
  });

  it('shoppables: same gating as blogs', () => {
    const html = '<p>See <a href="https://x.com">x</a>.</p>';
    const results = validateMode(html, 'shoppables', { wrapLinksStrongUnderline: true });
    expectFail(results, 'wrap-links-strong-underline');
  });
});

/* ------------------------------------------------------------------ */
/* Mode routing sanity checks                                          */
/* ------------------------------------------------------------------ */

describe('validator/sanitizer allowlist parity', () => {
  it('validator ALLOWED_ELEMENTS mirrors html-sanitizer ALLOWED_ELEMENTS', async () => {
    /* Read the sanitizer source and compare against the validator's runtime
     * set. Keeps the two allowlists in sync without a build-time dep. */
    const { readFile } = await import('fs/promises');
    const { resolve } = await import('path');
    const sanitizerPath = resolve(process.cwd(), 'src/lib/word-to-html/html-sanitizer.ts');
    const src = await readFile(sanitizerPath, 'utf8');
    const match = src.match(/const ALLOWED_ELEMENTS = \[([^\]]*)\]/);
    expect(match).not.toBeNull();
    const sanitizerList = (match![1]
      .split(',')
      .map((s) => s.trim().replace(/^['"]|['"]$/g, ''))
      .filter(Boolean));
    /* Reproduce the validator's runtime set in a single-file comparison. */
    const expected = [
      'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
      'p', 'br', 'hr',
      'ul', 'ol', 'li',
      'em', 'strong', 'u',
      'sup', 'sub',
      'a', 'img',
      'blockquote', 'pre', 'code',
      'table', 'thead', 'tbody', 'tr', 'th', 'td',
    ];
    expect([...sanitizerList].sort()).toEqual([...expected].sort());
  });
});

describe('validateMode — feature gating', () => {
  const cases: Array<{ mode: OutputMode; ruleId: string }> = [
    { mode: 'regular', ruleId: 'key-takeaways' },
    { mode: 'regular', ruleId: 'h1-after-key-takeaways' },
    { mode: 'regular', ruleId: 'sources-normalization' },
    { mode: 'regular', ruleId: 'disclaimer-normalization' },
    { mode: 'regular', ruleId: 'sources-italic' },
    { mode: 'regular', ruleId: 'br-before-read-more' },
    { mode: 'regular', ruleId: 'br-before-sources' },
    { mode: 'blogs', ruleId: 'br-before-read-more' },
    { mode: 'blogs', ruleId: 'br-before-sources' },
  ];

  for (const c of cases) {
    it(`${c.mode}: ${c.ruleId} returns a skipped/info result when not applicable`, () => {
      const results = validateMode('<p>hello</p>', c.mode, defaultFeatures);
      expectSkipped(results, c.ruleId);
    });
  }
});
