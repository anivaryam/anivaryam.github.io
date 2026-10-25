import { describe, expect, it } from 'vitest';
import { convertToHtml, getUnformattedHtml } from './converter';
import { cleanWordHtml } from './word-html-cleaner';
import { validateMode } from './validator';
import { FINGERPRINT_LENGTH, FINGERPRINT_THRESHOLD, encodeFingerprint } from './image-fingerprint';
import {
  findDraftImages,
  getStoreHost,
  isShopifyImageBlock,
  mergeImageLibrary,
  normalizeAltText,
  parseImageLibraryJson,
  parseShopifyImages,
  resolveImageCta,
  type ImageCta,
  type ImageLibraryEntry,
} from './image-library';

const fp = (value: number) => encodeFingerprint(new Uint8Array(FINGERPRINT_LENGTH).fill(value));

const CDN = 'https://cdn.shopify.com/s/files/1/0609/1168/1674/files/Kill_Weeds.png?v=1792864065';

// The Shopify editor HTML for an uploaded image CTA
const shopifySnippet = `<div style="text-align: center;"><a href="https://lawnsynergy.com/collections/weed-killer-for-lawns" target="_blank" rel="noopener"><img src="${CDN}" alt="Kill Weeds. Keep Your Lawn. Shop Weed Killer For Lawns." style="float: none;"></a></div>`;

const library: ImageLibraryEntry[] = [
  { host: 'lawnsynergy.com', alt: 'Kill Weeds. Keep Your Lawn. Shop Weed Killer For Lawns.', src: CDN },
];

// Google Docs clipboard markup: the draft image shares a paragraph with the
// alt text label, and the link label sits in the next paragraph.
const draftCta = (alt: string, href: string) =>
  `<p dir="ltr"><span><img src="https://lh7-rt.googleusercontent.com/docsz/draft.png" width="602" height="200"></span><span>Alt Image Text: ${alt}</span></p>`
  + `<p dir="ltr"><span>Link to: </span><a href="${href}"><span style="text-decoration:underline;">${href}</span></a></p>`;

const draft = (cta: string) =>
  '<b style="font-weight:normal;" id="docs-internal-guid-1a2b3c">'
  + '<p dir="ltr"><span>Weeds compete with grass for water.</span></p><br>'
  + cta
  + '<br><h2 dir="ltr"><span>Final Thoughts</span></h2><p dir="ltr"><span>Done.</span></p></b>';

const imageBlock = (href: string, alt: string) =>
  `<div style="text-align: center;"><a href="${href}" target="_blank" rel="noopener noreferrer"><img src="${CDN}" alt="${alt}" style="float: none;"></a></div>`;

describe('image library: saving Shopify images', () => {
  it('reads the store, alt text, and CDN URL from Shopify editor HTML', () => {
    expect(parseShopifyImages(shopifySnippet)).toEqual({ entries: library, skipped: 0 });
  });

  it('skips images without alt text or a usable store, keeping a linkless one under the paste host', () => {
    const html = `<img src="${CDN}" alt="No link">`
      + `<a href="/collections/seed"><img src="${CDN}" alt="Relative link"></a>`
      + `<a href="https://lawnsynergy.com/a"><img src="${CDN}" alt=""></a>`
      + `<a href="https://lawnsynergy.com/a"><img src="javascript:alert(1)" alt="Script"></a>`;
    // Every link names one store, so the linkless image belongs to it; an
    // image whose own link names no store stays out
    expect(parseShopifyImages(html)).toEqual({
      entries: [{ host: 'lawnsynergy.com', alt: 'No link', src: CDN }],
      skipped: 3,
    });
  });

  it('replaces the saved image for the same store and alt text', () => {
    const replacement = { host: 'lawnsynergy.com', alt: 'Kill weeds, keep your lawn: shop weed killer for lawns', src: `${CDN}&new` };
    const other = { host: 'other-store.com', alt: library[0].alt, src: CDN };
    expect(mergeImageLibrary(library, [replacement, other])).toEqual({ library: [replacement, other], added: 1, updated: 1 });
  });

  it('saves each image of a pasted article once, across pastes', () => {
    const block = (name: string, alt: string) =>
      `<p>&nbsp;</p><div style="text-align: center;"><a href="https://lawnsynergy.com/collections/${name}" target="_blank" rel="noopener"><img src="https://cdn.shopify.com/s/files/1/0609/1168/1674/files/${name}.png?v=1" alt="${alt}" style="float: none;"></a></div><p>&nbsp;</p>`;
    const insect = block('insect-control', 'Keep Your Lawn Healthy And Pest-Free: Shop Insect Control');
    const fertilizer = block('lawn-fertilizer', 'Feed Your Lawn. Grow Beyond Green: Shop Lawn Fertilizer');
    const seed = block('grass-seed', 'Start With The Right Seed: Shop Grass Seed');
    const fungicide = block('fungicide', 'Protect Your Lawn From Disease: Shop Fungicide');
    const article = (...blocks: string[]) => `<h2><strong>Key Takeaways:</strong></h2><p>Body <a href="https://lawnsynergy.com/blogs/x">link</a>.</p>${blocks.join('<p>More body.</p>')}`;

    const first = mergeImageLibrary([], parseShopifyImages(article(insect, fertilizer, seed)).entries);
    expect(first).toMatchObject({ added: 3, updated: 0 });
    // A later article with one new image and two already saved
    const second = mergeImageLibrary(first.library, parseShopifyImages(article(insect, fungicide, seed)).entries);
    expect(second).toMatchObject({ added: 1, updated: 0 });
    expect(second.library.map(entry => entry.alt)).toEqual([
      'Keep Your Lawn Healthy And Pest-Free: Shop Insect Control',
      'Feed Your Lawn. Grow Beyond Green: Shop Lawn Fertilizer',
      'Start With The Right Seed: Shop Grass Seed',
      'Protect Your Lawn From Disease: Shop Fungicide',
    ]);
  });

  it('keeps only well-formed entries from stored JSON', () => {
    const json = JSON.stringify([library[0], { host: 'x.com', alt: '', src: CDN }, { host: 'x.com', alt: 'A', src: 'javascript:1' }, null, 'text', { ...library[0], extra: true }]);
    expect(parseImageLibraryJson(json)).toEqual([library[0], library[0]]);
    expect(parseImageLibraryJson('not json')).toEqual([]);
    expect(parseImageLibraryJson('{"host":"x.com"}')).toEqual([]);
  });

  it('names the store from absolute, www, and Google Docs redirect links', () => {
    expect(getStoreHost('https://www.LawnSynergy.com/collections/x')).toBe('lawnsynergy.com');
    expect(getStoreHost('https://www.google.com/url?q=https://lawnsynergy.com/collections/x&sa=D')).toBe('lawnsynergy.com');
    expect(getStoreHost('/collections/x')).toBeNull();
    expect(getStoreHost('mailto:a@b.com')).toBeNull();
  });

  it('compares alt text without case, punctuation, or extra whitespace', () => {
    // Variants of the same CTA found across drafts
    expect(normalizeAltText('Kill Weeds. Keep Your Lawn: Shop Weed Killer For Lawns'))
      .toBe(normalizeAltText('Kill Weeds. Keep Your Lawn. Shop Weed Killer For Lawns.'));
    expect(normalizeAltText('Stop Weeds Before They Start: Shop Pre-Emergent'))
      .toBe(normalizeAltText('Stop Weeds Before They Start. Shop Pre-Emergent.'));
  });
});

describe('image library: blogs conversion', () => {
  const href = 'https://lawnsynergy.com/collections/weed-killer-for-lawns';

  /**
   * Only an exact picture match is applied, so the CTA-shape tests pair a
   * fingerprinted library with identical draft fingerprints.
   */
  const fpLibrary = library.map(entry => ({ ...entry, fp: fp(10) }));
  const draftFps = (alt: string) => ({ [normalizeAltText(alt)]: fp(10) });

  it('replaces the alt text and link paragraphs with the Shopify image markup', () => {
    const alt = 'Kill Weeds. Keep Your Lawn: Shop Weed Killer For Lawns';
    const features = { imageLibrary: fpLibrary, draftImageFingerprints: draftFps(alt) };
    const output = convertToHtml(cleanWordHtml(draft(draftCta(alt, href))), 'blogs', features);
    for (const html of [output.formatted, output.unformatted]) {
      const block = new DOMParser().parseFromString(html, 'text/html').querySelector('div');
      expect(block?.outerHTML).toBe(imageBlock(href, alt));
      // The block keeps the spacer the alt text paragraph got
      expect(block?.previousElementSibling?.outerHTML).toBe('<p>&nbsp;</p>');
      expect(html).not.toMatch(/Alt Image Text|Link to/i);
      expect(validateMode(html, 'blogs', features).summary.failed).toBe(0);
    }
  });

  it('keeps the Shopify editor link attributes when Link Attributes is off', () => {
    const output = getUnformattedHtml(draft(draftCta(library[0].alt, href)), 'blogs', { imageLibrary: fpLibrary, linkAttributes: false, draftImageFingerprints: draftFps(library[0].alt) });
    expect(output).toContain(imageBlock(href, library[0].alt).replace('noopener noreferrer', 'noopener'));
  });

  it('uses the draft link, not the link the image had in the earlier article', () => {
    const draftHref = 'https://lawnsynergy.com/collections/spring-weed-control';
    const output = getUnformattedHtml(draft(draftCta(library[0].alt, draftHref)), 'blogs', { imageLibrary: fpLibrary, draftImageFingerprints: draftFps(library[0].alt) });
    expect(output).toContain(imageBlock(draftHref, library[0].alt));
  });

  it('uses a link anchored on the alt text when no "Link to:" paragraph follows', () => {
    const draft = `<p>Body text.</p><p>Alt Image Text: <a href="${href}">Kill Weeds. Keep Your Lawn: Shop Weed Killer For Lawns</a></p><h2>Next</h2>`;
    const features = { imageLibrary: fpLibrary, draftImageFingerprints: draftFps('Kill Weeds. Keep Your Lawn: Shop Weed Killer For Lawns') };
    const output = getUnformattedHtml(draft, 'blogs', features);
    expect(output).toContain(imageBlock(href, 'Kill Weeds. Keep Your Lawn: Shop Weed Killer For Lawns'));
    expect(output).not.toMatch(/Alt Image Text/i);
    expect(validateMode(output, 'blogs', features).summary.failed).toBe(0);
  });

  it('prefers the explicit "Link to:" paragraph over a link anchored on the alt text', () => {
    const linkToHref = 'https://lawnsynergy.com/collections/spring-weed-control';
    const draft = `<p>Body text.</p><p>Alt Image Text: <a href="${href}">${library[0].alt}</a></p>`
      + `<p>Link to: <a href="${linkToHref}">${linkToHref}</a></p><h2>Next</h2>`;
    const output = getUnformattedHtml(draft, 'blogs', { imageLibrary: fpLibrary, draftImageFingerprints: draftFps(library[0].alt) });
    expect(output).toContain(imageBlock(linkToHref, library[0].alt));
    expect(output).not.toMatch(/Alt Image Text|Link to/i);
  });

  it('uses a paragraph holding nothing but the link below the alt text', () => {
    const features = { imageLibrary: fpLibrary, draftImageFingerprints: draftFps(library[0].alt) };
    for (const linkParagraph of [
      `<p><a href="${href}">${href}</a></p>`,   // lone anchor
      `<p>${href}</p>`,                          // bare URL text
      `<p><a href="${href}">Shop now</a></p>`,   // lone anchor, worded
    ]) {
      const draft = `<p>Body text.</p><p>Alt Image Text: ${library[0].alt}</p>${linkParagraph}<h2>Next</h2>`;
      const output = getUnformattedHtml(draft, 'blogs', features);
      expect(output).toContain(imageBlock(href, library[0].alt));
      expect(output).not.toMatch(/Alt Image Text|Shop now/i);
      expect(validateMode(output, 'blogs', features).summary.failed).toBe(0);
    }
  });

  it('does not treat a body sentence containing a link as the CTA link', () => {
    const draft = `<p>Alt Image Text: ${library[0].alt}</p>`
      + `<p>Read our guide at <a href="https://lawnsynergy.com/blogs/x">the blog</a> today.</p>`;
    const output = getUnformattedHtml(draft, 'blogs', { imageLibrary: library });
    // The sentence is not consumed and no image is inserted from it
    expect(output).toContain('Read our guide at');
    expect(output).not.toContain('<div');
  });

  it('replaces a linkless alt text (the hero) on an exact picture match, without a link', () => {
    const heroAlt = 'Healthy Green Lawn In The Bay Area';
    const features = {
      imageLibrary: [{ host: 'lawnsynergy.com', alt: 'Old hero wording', src: CDN, fp: fp(10) }],
      draftImageFingerprints: { [normalizeAltText(heroAlt)]: fp(11) },
    };
    const draft = `<p>Body text.</p><p>Alt Image Text: ${heroAlt}</p><p>More body.</p>`;
    const output = getUnformattedHtml(draft, 'blogs', features);
    expect(output).toContain(`<div style="text-align: center;"><img src="${CDN}" alt="${heroAlt}" style="float: none;"></div>`);
    expect(output).not.toMatch(/Alt Image Text|<a /);
    expect(validateMode(output, 'blogs', features).summary.failed).toBe(0);
  });

  it('leaves a linkless alt text alone, in silence, when no picture matches exactly', () => {
    const heroAlt = 'Healthy Green Lawn In The Bay Area';
    const draft = `<p>Body text.</p><p>Alt Image Text: ${heroAlt}</p><p>More body.</p>`;
    for (const draftFps of [
      undefined,                                         // image unreadable or absent
      { [normalizeAltText(heroAlt)]: fp(200) },          // matches nothing
    ]) {
      const features = { imageLibrary: library.map(entry => ({ ...entry, fp: fp(10) })), draftImageFingerprints: draftFps };
      const output = getUnformattedHtml(draft, 'blogs', features);
      expect(output).toContain(`<p>Alt Image Text: ${heroAlt}</p>`);
      const result = validateMode(output, 'blogs', features).results.find(r => r.ruleId === 'image-library');
      expect(result?.passed).toBe(true);
    }
  });

  it('saves a linkless image under the store every link in the paste names', () => {
    const hero = `<img src="${CDN}" alt="Healthy Green Lawn">`;
    const oneStore = `${shopifySnippet}${hero}`;
    expect(parseShopifyImages(oneStore).entries).toEqual([
      library[0],
      { host: 'lawnsynergy.com', alt: 'Healthy Green Lawn', src: CDN },
    ]);
    // Links naming two stores leave the linkless image out
    const twoStores = `${oneStore}<a href="https://other-store.com/x">x</a>`;
    expect(parseShopifyImages(twoStores)).toEqual({ entries: [library[0]], skipped: 1 });
  });

  it('keeps the CTA paragraphs and warns when no saved image matches', () => {
    const otherStore = 'https://other-store.com/collections/weed-killer-for-lawns';
    for (const [cta, detail] of [
      [draftCta(library[0].alt, otherStore), `No saved image for "${library[0].alt}" on other-store.com`],
      [draftCta('Shop Grass Seed', href), 'No saved image for "Shop Grass Seed" on lawnsynergy.com'],
    ]) {
      const features = { imageLibrary: library };
      const output = getUnformattedHtml(draft(cta), 'blogs', features);
      expect(output).toMatch(/<p>Alt Image Text: .+<\/p><p>Link to: <a /);
      expect(output).not.toContain('<div');
      const result = validateMode(output, 'blogs', features).results.find(r => r.ruleId === 'image-library');
      expect(result).toMatchObject({ passed: false, severity: 'warning', details: [detail] });
    }
  });

  it('leaves alt text without a link paragraph (the hero image) unchanged', () => {
    const hero = `<p dir="ltr"><span>Alt Image Text: ${library[0].alt}</span></p>`;
    const output = getUnformattedHtml(draft(hero), 'blogs', { imageLibrary: library });
    expect(output).toContain(`<p>Alt Image Text: ${library[0].alt}</p>`);
    expect(output).not.toContain('<div');
  });

  it('only runs in Blogs mode', () => {
    for (const mode of ['regular', 'shoppables'] as const) {
      const output = getUnformattedHtml(draft(draftCta(library[0].alt, href)), mode, { imageLibrary: library });
      expect(output).toMatch(/Alt Image Text/);
      expect(output).not.toContain('<div');
      expect(validateMode(output, mode, { imageLibrary: library }).results.find(r => r.ruleId === 'image-library')?.passed).toBe(true);
    }
  });
});

describe('image library: sanitized structure exception', () => {
  it('accepts only the exact Shopify image block shape', () => {
    const parse = (html: string) => new DOMParser().parseFromString(html, 'text/html').body.firstElementChild!;
    expect(isShopifyImageBlock(parse(shopifySnippet))).toBe(true);
    expect(isShopifyImageBlock(parse(`<div style="text-align:center"><img src="${CDN}" alt="A" style="float:none"></div>`))).toBe(true);
    expect(isShopifyImageBlock(parse(`<div style="text-align: center; color: red;"><img src="${CDN}" alt="A" style="float: none;"></div>`))).toBe(false);
    expect(isShopifyImageBlock(parse(`<div style="text-align: center;"><img src="${CDN}" alt="A" style="float: none;">text</div>`))).toBe(false);
    expect(isShopifyImageBlock(parse(`<div style="text-align: center;"><p>Text</p></div>`))).toBe(false);
  });

  it('still flags other <div> and style markup', () => {
    const html = `<div style="color: red;"><p>Text</p></div><div style="text-align: center;"><img src="${CDN}" alt="A" style="float: none;" data-x="1"></div>`;
    const result = validateMode(html, 'blogs', {}).results.find(r => r.ruleId === 'sanitized-structure');
    expect(result?.details).toEqual([
      'Disallowed element <div> present',
      'Banned attribute "style" on <div>',
      'Banned attribute "data-x" on <img>',
    ]);
  });
});

describe('image library: picture fingerprints', () => {
  const href = 'https://lawnsynergy.com/collections/weed-killer-for-lawns';
  const entry = (alt: string, value?: number): ImageLibraryEntry =>
    ({ host: 'lawnsynergy.com', alt, src: CDN, ...(value === undefined ? {} : { fp: fp(value) }) });
  const cta = (alt: string): ImageCta => {
    const doc = new DOMParser().parseFromString(`<p>Alt Image Text: ${alt}</p><p>Link to: <a href="${href}">x</a></p>`, 'text/html');
    const [altParagraph, linkParagraph] = Array.from(doc.querySelectorAll('p'));
    return { altParagraph, linkParagraph, alt, href };
  };
  const fps = (alt: string, value: number | null) => ({ [normalizeAltText(alt)]: value === null ? null : fp(value) });

  it('matches by picture even when the alt text was reworded', () => {
    const saved = entry('Old wording of this banner', 10);
    expect(resolveImageCta(cta('Completely New Wording'), [saved], fps('Completely New Wording', 10)))
      .toEqual({ status: 'matched', entry: saved, confidence: 'high' });
  });

  it('refuses an alt-text match when the pictures differ', () => {
    const saved = entry('Shop Weed Killer', 10);
    expect(resolveImageCta(cta('Shop Weed Killer'), [saved], fps('Shop Weed Killer', 10 + FINGERPRINT_THRESHOLD + 1)))
      .toEqual({ status: 'conflict', entry: saved });
  });

  it('holds an alt-only match instead of applying it', () => {
    const saved = entry('Shop Weed Killer', 10);
    const held = { status: 'below-confidence', entry: saved, confidence: 'low' };
    // Draft image unreadable
    expect(resolveImageCta(cta('Shop Weed Killer'), [saved], fps('Shop Weed Killer', null))).toEqual(held);
    // No draft fingerprint at all
    expect(resolveImageCta(cta('Shop Weed Killer'), [saved], undefined)).toEqual(held);
    // Saved entry has no fingerprint yet
    const legacy = entry('Shop Weed Killer');
    expect(resolveImageCta(cta('Shop Weed Killer'), [legacy], fps('Shop Weed Killer', 10)))
      .toEqual({ status: 'below-confidence', entry: legacy, confidence: 'low' });
  });

  it('holds a picture match outside the calibrated same-image range', () => {
    // One cell differs by 40: within the threshold but not an exact match
    const cells = new Uint8Array(FINGERPRINT_LENGTH).fill(10);
    cells[0] = 50;
    const saved = { ...entry('Shop Weed Killer'), fp: encodeFingerprint(cells) };
    expect(resolveImageCta(cta('Shop Weed Killer'), [saved], fps('Shop Weed Killer', 10)))
      .toEqual({ status: 'below-confidence', entry: saved, confidence: 'medium' });
  });

  it('warns when a match is held, naming why', () => {
    const saved = entry('Shop Grass Seed');
    const draft = '<p>Body text.</p><p>Alt Image Text: Shop Grass Seed</p>'
      + `<p>Link to: <a href="${href}">${href}</a></p><p>Done.</p>`;
    const features = { imageLibrary: [saved] };
    const output = getUnformattedHtml(draft, 'blogs', features);
    expect(output).not.toContain('<img');
    const result = validateMode(output, 'blogs', features).results.find(r => r.ruleId === 'image-library');
    expect(result?.details).toEqual([
      'Picture for "Shop Grass Seed" on lawnsynergy.com not verified; image not applied',
    ]);
    // A near-but-not-exact picture match is named differently
    const cells = new Uint8Array(FINGERPRINT_LENGTH).fill(10);
    cells[0] = 50;
    const near = { imageLibrary: [{ ...saved, fp: encodeFingerprint(cells) }], draftImageFingerprints: { [normalizeAltText('Shop Grass Seed')]: fp(10) } };
    const nearResult = validateMode(getUnformattedHtml(draft, 'blogs', near), 'blogs', near).results.find(r => r.ruleId === 'image-library');
    expect(nearResult?.details).toEqual([
      'Picture match for "Shop Grass Seed" on lawnsynergy.com is not exact; image not applied',
    ]);
  });

  it('keeps pictures scoped to the store of the draft link', () => {
    const otherStore = { ...entry('Other wording', 10), host: 'other-store.com' };
    expect(resolveImageCta(cta('Shop Weed Killer'), [otherStore], fps('Shop Weed Killer', 10)))
      .toEqual({ status: 'unmatched' });
  });

  it('converts with a conflict kept as text and warned about', () => {
    const saved = entry('Shop Grass Seed', 10);
    const draft = '<p>Body text.</p><p>Alt Image Text: Shop Grass Seed</p>'
      + `<p>Link to: <a href="${href}">${href}</a></p><p>Done.</p>`;
    const features = { imageLibrary: [saved], draftImageFingerprints: fps('Shop Grass Seed', 200) };
    const output = getUnformattedHtml(draft, 'blogs', features);
    expect(output).toContain('Alt Image Text: Shop Grass Seed');
    expect(output).not.toContain('<img');
    const result = validateMode(output, 'blogs', features).results.find(r => r.ruleId === 'image-library');
    expect(result).toMatchObject({
      passed: false,
      severity: 'warning',
      details: ['The draft picture differs from the saved image for "Shop Grass Seed" on lawnsynergy.com'],
    });
  });

  it('converts with a cross-alt picture match inserted under the draft alt text', () => {
    const saved = entry('Old banner wording', 10);
    const draft = '<p>Body text.</p><p>Alt Image Text: New Banner Wording</p>'
      + `<p>Link to: <a href="${href}">${href}</a></p><p>Done.</p>`;
    const features = { imageLibrary: [saved], draftImageFingerprints: fps('New Banner Wording', 12) };
    const output = getUnformattedHtml(draft, 'blogs', features);
    expect(output).toContain(`<img src="${CDN}" alt="New Banner Wording" style="float: none;">`);
    expect(validateMode(output, 'blogs', features).summary.failed).toBe(0);
  });

  it('keeps a saved fingerprint when the same image is saved again without one', () => {
    const saved = entry('Shop Weed Killer', 10);
    const merged = mergeImageLibrary([saved], [entry('Shop Weed Killer')]);
    expect(merged).toEqual({ library: [saved], added: 0, updated: 0 });
    // A new upload (different src) drops the stale fingerprint
    const reuploaded = { ...entry('Shop Weed Killer'), src: `${CDN}&new` };
    expect(mergeImageLibrary([saved], [reuploaded]).library).toEqual([reuploaded]);
  });

  it('keeps a valid fingerprint through JSON and drops a malformed one', () => {
    const saved = entry('Shop Weed Killer', 10);
    expect(parseImageLibraryJson(JSON.stringify([saved]))).toEqual([saved]);
    expect(parseImageLibraryJson(JSON.stringify([{ ...saved, fp: 'bad!' }])))
      .toEqual([entry('Shop Weed Killer')]);
  });

  it('finds the draft images with the alt text of their CTA', () => {
    const html = '<p><img src="data:image/png;base64,AAA">Alt Image Text: Same Paragraph</p>'
      + '<p><img src="https://lh7-rt.googleusercontent.com/docsz/x=s800"></p><p>Alt Image Text: Next Paragraph</p>'
      + '<p><img src="https://host.com/hero.png"></p><p>No label here</p>'
      + '<p><img src="/relative.png">Alt Image Text: Relative Skipped</p>';
    expect(findDraftImages(html)).toEqual([
      { alt: 'Same Paragraph', src: 'data:image/png;base64,AAA' },
      { alt: 'Next Paragraph', src: 'https://lh7-rt.googleusercontent.com/docsz/x=s800' },
    ]);
  });
});
