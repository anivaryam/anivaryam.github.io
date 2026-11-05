import { afterEach, describe, expect, it, vi } from 'vitest';
import { convertToHtml, getUnformattedHtml } from './converter';
import { cleanWordHtml } from './word-html-cleaner';
import { validateMode } from './validator';
import { FINGERPRINT_LENGTH, FINGERPRINT_THRESHOLD, encodeFingerprint } from './image-fingerprint';
import * as imageFingerprint from './image-fingerprint';
import {
  applyImageLibrary,
  findDraftImages,
  getImageCtaIssues,
  getStoreHost,
  isAltLabelParagraph,
  isShopifyImageBlock,
  mergeImageLibrary,
  parseImageLibraryJson,
  parseShopifyImages,
  readAltLabel,
  reconcileImageLibrary,
  resolveImageCta,
  type ImageCta,
  type ImageLibraryEntry,
} from './image-library';

const fp = (value: number) => encodeFingerprint(new Uint8Array(FINGERPRINT_LENGTH).fill(value));

const CDN = 'https://cdn.shopify.com/s/files/1/0609/1168/1674/files/Kill_Weeds.png?v=1792864065';
const DRAFT_SRC = 'https://lh7-rt.googleusercontent.com/docsz/draft.png';
const draftFps = (value = 10, href: string | null = 'https://lawnsynergy.com/collections/weed-killer-for-lawns') =>
  [{ src: DRAFT_SRC, href, fp: fp(value) }];

// The Shopify editor HTML for an uploaded image CTA
const shopifySnippet = `<div style="text-align: center;"><a href="https://lawnsynergy.com/collections/weed-killer-for-lawns" target="_blank" rel="noopener"><img src="${CDN}" alt="Kill Weeds. Keep Your Lawn. Shop Weed Killer For Lawns." style="float: none;"></a></div>`;

const library: ImageLibraryEntry[] = [
  { host: 'lawnsynergy.com', alt: 'Kill Weeds. Keep Your Lawn. Shop Weed Killer For Lawns.', src: CDN },
];

// Google Docs clipboard markup: the draft image shares a paragraph with the
// alt text label, and the link label sits in the next paragraph.
const draftCta = (alt: string, href: string, label = 'Alt Image Text:') =>
  `<p dir="ltr"><span><img src="https://lh7-rt.googleusercontent.com/docsz/draft.png" width="602" height="200"></span><span>${label} ${alt}</span></p>`
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

  it('accepts missing alt text and skips unusable URLs or stores', () => {
    const html = `<img src="${CDN}" alt="No link">`
      + `<a href="/collections/seed"><img src="${CDN}" alt="Relative link"></a>`
      + `<a href="https://lawnsynergy.com/a"><img src="${CDN}" alt=""></a>`
      + `<a href="https://lawnsynergy.com/a"><img src="javascript:alert(1)" alt="Script"></a>`;
    // Every link names one store, so the linkless image belongs to it; an
    // image whose own link names no store stays out
    expect(parseShopifyImages(html)).toEqual({
      entries: [{ host: 'lawnsynergy.com', alt: 'No link', src: CDN }, { host: 'lawnsynergy.com', alt: '', src: CDN }],
      skipped: 2,
    });
  });

  it('keeps different image sources even when their alt text is identical', () => {
    const replacement = { host: 'lawnsynergy.com', alt: 'Kill weeds, keep your lawn: shop weed killer for lawns', src: `${CDN}&new` };
    const other = { host: 'other-store.com', alt: library[0].alt, src: CDN };
    expect(mergeImageLibrary(library, [replacement, other])).toEqual({ library: [...library, replacement, other], added: 2, updated: 0 });
    const sameAlt = { ...library[0], src: `${CDN}&different` };
    expect(mergeImageLibrary(library, [sameAlt]).library).toEqual([...library, sameAlt]);
    const renamed = { ...library[0], alt: 'A new description' };
    expect(mergeImageLibrary(library, [renamed])).toEqual({ library: [renamed], added: 0, updated: 1 });
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
    expect(parseImageLibraryJson(json)).toEqual([library[0], { host: 'x.com', alt: '', src: CDN }, library[0]]);
    expect(parseImageLibraryJson(JSON.stringify([{ host: 'x.com', src: CDN }]))).toEqual([{ host: 'x.com', alt: '', src: CDN }]);
    expect(parseImageLibraryJson('not json')).toEqual([]);
    expect(parseImageLibraryJson('{"host":"x.com"}')).toEqual([]);
  });

  it('reports invalid imports without changing tolerant storage parsing', () => {
    for (const json of ['not json', '{}', '[null]', JSON.stringify([{ host: 'x.com', src: 'javascript:1' }])]) {
      expect(() => parseImageLibraryJson(json, true)).toThrow();
      expect(parseImageLibraryJson(json)).toEqual([]);
    }
    expect(parseImageLibraryJson('[]', true)).toEqual([]);
    expect(parseImageLibraryJson(JSON.stringify(library), true)).toEqual(library);
    expect(parseImageLibraryJson(JSON.stringify([library[0], null]), true)).toEqual(library);
  });

  it('merges stale-tab additions and deletions without overwriting unrelated images', () => {
    const red = library[0];
    const green = { ...red, src: `${CDN}&green`, alt: 'Green' };
    expect(reconcileImageLibrary([], [green], [red])).toEqual([red, green]);
    expect(reconcileImageLibrary([red], [], [red, green])).toEqual([green]);
    expect(reconcileImageLibrary([red], [red], [green])).toEqual([green]);
  });

  it('preserves concurrent metadata edits during backfill and never resurrects remote deletions', () => {
    const original = library[0];
    const backfilled = { ...original, fp: fp(10) };
    const renamed = { ...original, alt: 'Renamed elsewhere' };
    expect(reconcileImageLibrary([original], [backfilled], [renamed])).toEqual([{ ...renamed, fp: fp(10) }]);
    expect(reconcileImageLibrary([original], [backfilled], [])).toEqual([]);
    expect(reconcileImageLibrary([original], [renamed], [backfilled])).toEqual([{ ...renamed, fp: fp(10) }]);
  });

  it('names the store from absolute, www, and Google Docs redirect links', () => {
    expect(getStoreHost('https://www.LawnSynergy.com/collections/x')).toBe('lawnsynergy.com');
    expect(getStoreHost('https://www.google.com/url?q=https://lawnsynergy.com/collections/x&sa=D')).toBe('lawnsynergy.com');
    expect(getStoreHost('/collections/x')).toBeNull();
    expect(getStoreHost('mailto:a@b.com')).toBeNull();
  });

});

describe('image library: matching reuse', () => {
  afterEach(() => vi.restoreAllMocks());

  it('reuses decoding and comparisons across conversion, validation and text edits', () => {
    const saved = Array.from({ length: 50 }, (_, index) => ({ ...library[0], src: `${CDN}&image=${index}`, fp: fp(index + 10) }));
    const fingerprints = draftFps();
    const decode = vi.spyOn(imageFingerprint, 'decodeFingerprint');
    const compare = vi.spyOn(imageFingerprint, 'fingerprintDistance');
    const html = `<p>Before</p><img src="${DRAFT_SRC}" alt="Draft description">`;
    const output = applyImageLibrary(html, saved, true, fingerprints);
    expect(output).toContain(`src="${saved[0].src.replace(/&/g, '&amp;')}"`);
    expect(decode).toHaveBeenCalledTimes(51);
    expect(compare).toHaveBeenCalledTimes(50);
    expect(getImageCtaIssues(saved, fingerprints)).toEqual([]);
    expect(applyImageLibrary(html.replace('Before', 'Edited'), saved, true, fingerprints)).toBe(output.replace('Before', 'Edited'));
    expect(decode).toHaveBeenCalledTimes(51);
    expect(compare).toHaveBeenCalledTimes(50);
  });

  it('refreshes matches after fingerprint backfill, source edits and library membership changes', () => {
    const saved = [{ ...library[0], fp: undefined as string | undefined }, { ...library[0], src: `${CDN}&second`, fp: fp(100) }];
    const fingerprints = draftFps(10);
    const cta = { src: DRAFT_SRC, href: null };
    expect(resolveImageCta(cta, saved, fingerprints).status).toBe('unmatched');
    saved[0].fp = fp(10);
    expect(resolveImageCta(cta, saved, fingerprints).entry).toBe(saved[0]);
    saved[0].fp = fp(200);
    expect(resolveImageCta(cta, saved, fingerprints).status).toBe('unmatched');
    fingerprints[0].fp = fp(100);
    expect(resolveImageCta(cta, saved, fingerprints).entry).toBe(saved[1]);
    saved[0].fp = fp(100);
    saved[0].alt = 'Updated description';
    expect(resolveImageCta(cta, saved, fingerprints).entry).toBe(saved[0]);
    saved[0].host = 'other-store.com';
    expect(resolveImageCta({ ...cta, href: 'https://lawnsynergy.com/x' }, saved, fingerprints).entry).toBe(saved[1]);
    saved.splice(0, 1);
    expect(resolveImageCta(cta, saved, fingerprints).entry).toBe(saved[0]);
    fingerprints[0].fp = 'invalid';
    expect(resolveImageCta(cta, saved, fingerprints).status).toBe('unverified');
  });
});

describe('image library: blogs conversion', () => {
  const href = 'https://lawnsynergy.com/collections/weed-killer-for-lawns';

  /**
   * Only an exact picture match is applied, so the CTA-shape tests pair a
   * fingerprinted library with identical draft fingerprints.
   */
  const fpLibrary = library.map(entry => ({ ...entry, fp: fp(10) }));

  it('replaces the alt text and link paragraphs with the Shopify image markup', () => {
    const alt = 'Kill Weeds. Keep Your Lawn: Shop Weed Killer For Lawns';
    const features = { imageLibrary: fpLibrary, draftImageFingerprints: draftFps() };
    const output = convertToHtml(cleanWordHtml(draft(draftCta(alt, href)), true), 'blogs', features);
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
    const output = getUnformattedHtml(draft(draftCta(library[0].alt, href)), 'blogs', { imageLibrary: fpLibrary, linkAttributes: false, draftImageFingerprints: draftFps() });
    expect(output).toContain(imageBlock(href, library[0].alt).replace('noopener noreferrer', 'noopener'));
  });

  it('uses the draft link, not the link the image had in the earlier article', () => {
    const draftHref = 'https://lawnsynergy.com/collections/spring-weed-control';
    const output = getUnformattedHtml(draft(draftCta(library[0].alt, draftHref)), 'blogs', { imageLibrary: fpLibrary, draftImageFingerprints: draftFps(10, draftHref) });
    expect(output).toContain(imageBlock(draftHref, library[0].alt));
  });

  it('uses a link anchored on the alt text when no "Link to:" paragraph follows', () => {
    const draft = `<p>Body text.</p><p><img src="${DRAFT_SRC}">Alt Image Text: <a href="${href}">Kill Weeds. Keep Your Lawn: Shop Weed Killer For Lawns</a></p><h2>Next</h2>`;
    const features = { imageLibrary: fpLibrary, draftImageFingerprints: draftFps() };
    const output = getUnformattedHtml(draft, 'blogs', features);
    expect(output).toContain(imageBlock(href, 'Kill Weeds. Keep Your Lawn: Shop Weed Killer For Lawns'));
    expect(output).not.toMatch(/Alt Image Text/i);
    expect(validateMode(output, 'blogs', features).summary.failed).toBe(0);
  });

  it('prefers the explicit "Link to:" paragraph over a link anchored on the alt text', () => {
    const linkToHref = 'https://lawnsynergy.com/collections/spring-weed-control';
    const draft = `<p>Body text.</p><p><img src="${DRAFT_SRC}">Alt Image Text: <a href="${href}">${library[0].alt}</a></p>`
      + `<p>Link to: <a href="${linkToHref}">${linkToHref}</a></p><h2>Next</h2>`;
    const output = getUnformattedHtml(draft, 'blogs', { imageLibrary: fpLibrary, draftImageFingerprints: draftFps(10, linkToHref) });
    expect(output).toContain(imageBlock(linkToHref, library[0].alt));
    expect(output).not.toMatch(/Alt Image Text|Link to/i);
  });

  it('uses a paragraph holding nothing but the link below the alt text', () => {
    const features = { imageLibrary: fpLibrary, draftImageFingerprints: draftFps() };
    for (const linkParagraph of [
      `<p><a href="${href}">${href}</a></p>`,   // lone anchor
      `<p>${href}</p>`,                          // bare URL text
      `<p><a href="${href}">Shop now</a></p>`,   // lone anchor, worded
    ]) {
      const draft = `<p>Body text.</p><p><img src="${DRAFT_SRC}">Alt Image Text: ${library[0].alt}</p>${linkParagraph}<h2>Next</h2>`;
      const output = getUnformattedHtml(draft, 'blogs', features);
      expect(output).toContain(imageBlock(href, library[0].alt));
      expect(output).not.toMatch(/Alt Image Text|Shop now/i);
      expect(validateMode(output, 'blogs', features).summary.failed).toBe(0);
    }
  });

  it.each([true, false])('keeps a table-cell image link supplied by metadata (Link Attributes: %s)', linkAttributes => {
    const input = `<table><tr><td>Before<img src="${DRAFT_SRC}"><p>Alt Text: Draft description</p>`
      + `<p>Link to: <a href="${href}">Shop now</a></p><p>After.</p></td><td>Other cell</td></tr></table>`;
    const features = { imageLibrary: fpLibrary, draftImageFingerprints: draftFps(), linkAttributes };
    const output = convertToHtml(cleanWordHtml(input, true), 'blogs', features);
    for (const html of [output.formatted, output.unformatted]) {
      const doc = new DOMParser().parseFromString(html, 'text/html');
      const image = doc.querySelector('td > a > img');
      expect(image?.getAttribute('src')).toBe(CDN);
      expect(image?.getAttribute('alt')).toBe('Draft description');
      expect(image?.hasAttribute('style')).toBe(false);
      expect(image?.parentElement?.getAttribute('href')).toBe(href);
      expect(image?.parentElement?.getAttribute('target')).toBe('_blank');
      expect(image?.parentElement?.getAttribute('rel')).toBe(linkAttributes ? 'noopener noreferrer' : 'noopener');
      expect(doc.querySelector('td div, a a')).toBeNull();
      expect(doc.body.textContent).toContain('Before');
      expect(doc.body.textContent).toContain('After.');
      expect(doc.body.textContent).toContain('Other cell');
      expect(doc.body.textContent).not.toMatch(/Alt Text|Link to|Shop now/);
      expect(validateMode(html, 'blogs', features).summary.failed).toBe(0);
    }
  });

  it('keeps existing inline image link attributes when replacing its picture', () => {
    const input = `<table><tr><td>Before <a href="${href}" target="_self" rel="nofollow"><img src="${DRAFT_SRC}" alt="Draft description"></a> after</td></tr></table>`;
    const features = { imageLibrary: fpLibrary, draftImageFingerprints: draftFps(), linkAttributes: false };
    const output = convertToHtml(cleanWordHtml(input, true), 'blogs', features);
    for (const html of [output.formatted, output.unformatted]) {
      const doc = new DOMParser().parseFromString(html, 'text/html');
      expect(doc.querySelector('a')?.outerHTML).toBe(`<a href="${href}" target="_self" rel="nofollow"><img src="${CDN}" alt="Draft description"></a>`);
      expect(doc.querySelectorAll('a')).toHaveLength(1);
      expect(doc.querySelector('td')?.textContent).toBe('Before  after');
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
      draftImageFingerprints: draftFps(11, null),
    };
    const draft = `<p>Body text.</p><p><img src="${DRAFT_SRC}">Alt Image Text: ${heroAlt}</p><p>More body.</p>`;
    const output = getUnformattedHtml(draft, 'blogs', features);
    expect(output).toContain(`<div style="text-align: center;"><img src="${CDN}" alt="${heroAlt}" style="float: none;"></div>`);
    expect(output).not.toMatch(/Alt Image Text|<a /);
    expect(validateMode(output, 'blogs', features).summary.failed).toBe(0);
  });

  it('never turns an alt-text-only paragraph into an image', () => {
    const heroAlt = 'Healthy Green Lawn In The Bay Area';
    const draft = `<p>Body text.</p><p>Alt Image Text: ${heroAlt}</p><p>More body.</p>`;
    for (const fingerprints of [undefined, []]) {
      const features = { imageLibrary: library.map(entry => ({ ...entry, fp: fp(10) })), draftImageFingerprints: fingerprints };
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
    for (const [cta, link, detail] of [
      [draftCta(library[0].alt, otherStore), otherStore, 'Image 1 on other-store.com: no saved picture matches; image not applied'],
      [draftCta('Shop Grass Seed', href), href, 'Image 1 on lawnsynergy.com: picture could not be verified; image not applied'],
    ]) {
      const features = { imageLibrary: library, draftImageFingerprints: [{ src: DRAFT_SRC, href: link, fp: null }] };
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

describe('image library: alt text label wordings', () => {
  const href = 'https://lawnsynergy.com/collections/weed-killer-for-lawns';
  const alt = library[0].alt;
  const fpLibrary = library.map(entry => ({ ...entry, fp: fp(10) }));

  // Drafts reorder, shorten, and decorate the label; each one is read
  it.each([
    'Alt Image Text:', 'Alt Text Image:', 'Image Alt Text:', 'Text Alt Image:', 'Image Text Alt:',
    'Alt Text:', 'Alt Image:', 'Image Alt:', 'Alt:', 'ALT IMAGE TEXT:', 'alt text image:',
    'Alt Text :', 'Alt-Text:', 'Alt_Text:', 'AltText:', 'Alt Tag:', 'Image Alt Tag:', 'Alt Attribute:',
    'Alt Text for Image:', 'Alt Text for the Image:', 'Alt Text (Image 1):', 'Image #2 Alt Text:', 'Image 3 Alt Text:',
    'Suggested Alt Text:', 'Featured Image Alt Text:', 'CTA Image Alt Text:', 'Alternative Text:', 'Image/Alt Text:',
    'Alt Image Text -', 'Alt Image Text \u2013', 'Alt Image Text\u2014', 'Alt Image Text\uff1a', 'Alt Image Text-',
    '**Alt Image Text:**', '**Alt Image Text**:', '*Alt Text Image:*', 'Alt\u00a0Image\u00a0Text:', '\u200bAlt Image Text:',
  ])('reads the alt text after "%s"', label => {
    expect(readAltLabel(`${label} ${alt}`)).toBe(alt);
    expect(readAltLabel(`  ${label}  ${alt}  `)).toBe(alt);
  });

  it.each([
    'Alt text helps search engines read images.',     // no separator
    'Alt Image Text Shop Grass Seed',                  // no separator
    'Why Alt Text Matters: search engines read it',    // words a label never has
    'Read the alt image text: it names the picture',   // label mid-sentence
    'Alternatively: mow weekly.',
    'Alternative: try clover.',                        // "alternative" names alt text only with "text"
    'Image Text: Shop Now',                            // text on the picture, not alt text
    'Image: Shop Now',
    'Altitude: 2,000 feet',
    'Ctrl Alt - Delete restarts it',
    'Link to: https://lawnsynergy.com',
    '',
  ])('does not read "%s" as an alt text label', text => {
    expect(readAltLabel(text)).toBeNull();
  });

  it('reads a label alone as empty alt text, and only at the start of a paragraph', () => {
    expect(readAltLabel('Alt Text Image:')).toBe('');
    const doc = new DOMParser().parseFromString(
      `<p><strong>Alt Text Image:</strong> ${alt}</p><h3>Alt Text: Basics</h3><p>See the alt text: here.</p>`,
      'text/html',
    );
    expect(Array.from(doc.body.children).map(isAltLabelParagraph)).toEqual([true, false, false]);
  });

  it.each(['Alt Text Image:', 'Image Alt Text -', '**Alt Text:**', 'ALT-TEXT:'])('replaces a "%s" CTA with the saved Shopify image', label => {
    const features = { imageLibrary: fpLibrary, draftImageFingerprints: draftFps() };
    const raw = draft(draftCta(alt, href, label));
    expect(findDraftImages(raw)).toEqual([{ src: DRAFT_SRC, href }]);
    const output = convertToHtml(cleanWordHtml(raw, true), 'blogs', features);
    for (const html of [output.formatted, output.unformatted]) {
      const doc = new DOMParser().parseFromString(html, 'text/html');
      const block = doc.querySelector('div');
      expect(block?.outerHTML).toBe(imageBlock(href, alt));
      expect(block?.previousElementSibling?.outerHTML).toBe('<p>&nbsp;</p>');
      expect(doc.body.textContent).not.toMatch(/\balt\b|link to/i);
      expect(validateMode(html, 'blogs', features).summary.failed).toBe(0);
    }
  });

  it.each(['Alt Text Image:', 'Image Alt Text -', '**Alt Text:**'])('spaces a "%s" paragraph and leaves its link unwrapped, as validation expects', label => {
    const features = { wrapLinksStrongUnderline: true };
    const raw = `<p>Body with <a href="https://lawnsynergy.com/a">a link</a>.</p><p>${label} <a href="${href}">${alt}</a></p><h2>Next</h2>`;
    const html = getUnformattedHtml(raw, 'blogs', features);
    const doc = new DOMParser().parseFromString(html, 'text/html');
    const altParagraph = Array.from(doc.querySelectorAll('p')).find(isAltLabelParagraph);
    expect(altParagraph?.previousElementSibling?.outerHTML).toBe('<p>&nbsp;</p>');
    expect(altParagraph?.querySelector('strong')).toBeNull();
    expect(doc.querySelector('a[href="https://lawnsynergy.com/a"] > strong > u')).not.toBeNull();
    expect(validateMode(html, 'blogs', features).summary.failed).toBe(0);
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

describe('image library: picture-only image occurrences', () => {
  const first = { host: 'lawnsynergy.com', src: CDN, alt: '', fp: fp(10) };
  const second = { ...first, src: `${CDN}&second`, fp: fp(200) };
  const secondDraft = `${DRAFT_SRC}?second`;
  const featuresFor = (html: string) => ({
    imageLibrary: [first, second],
    draftImageFingerprints: findDraftImages(html).map(image => ({ ...image, fp: fp(image.src === secondDraft ? 200 : 10) })),
  });

  it.each([
    `<img src="${DRAFT_SRC}">`,
    `<p><img src="${DRAFT_SRC}"></p>`,
    `<div class="image"><img class="image" src="${DRAFT_SRC}"></div>`,
    `<figure><img src="${DRAFT_SRC}"><figcaption>A caption</figcaption></figure>`,
    `<table><tr><td><img src="${DRAFT_SRC}"></td><td>Other cell</td></tr></table>`,
    `<ul><li><img src="${DRAFT_SRC}">Body text</li></ul>`,
  ])('matches an image without any alt text or label: %s', input => {
    const features = featuresFor(input);
    const output = getUnformattedHtml(input, 'blogs', features);
    const doc = new DOMParser().parseFromString(output, 'text/html');
    expect(doc.querySelector('img')?.getAttribute('src')).toBe(CDN);
    expect(doc.querySelector('img')?.getAttribute('alt')).toBe('');
    expect(output).not.toContain(DRAFT_SRC);
    expect(validateMode(output, 'blogs', features).results.find(result => result.ruleId === 'sanitized-structure')?.passed).toBe(true);
  });

  it('matches duplicate descriptions independently and leaves label-only paragraphs alone', () => {
    const input = `<p>Alt Image Text: Shop Now</p><p>Body text.</p>`
      + draftCta('Shop Now', 'https://lawnsynergy.com/a')
      + draftCta('Shop Now', 'https://lawnsynergy.com/b').replace(DRAFT_SRC, secondDraft);
    const features = featuresFor(input);
    features.imageLibrary = features.imageLibrary.map(entry => ({ ...entry, alt: 'Shop Now' }));
    const output = getUnformattedHtml(input, 'blogs', features);
    const doc = new DOMParser().parseFromString(output, 'text/html');
    expect(Array.from(doc.querySelectorAll('img'), image => image.getAttribute('src'))).toEqual([CDN, second.src]);
    expect(Array.from(doc.querySelectorAll('img'), image => image.getAttribute('alt'))).toEqual(['Shop Now', 'Shop Now']);
    expect(doc.body.textContent).toContain('Alt Image Text: Shop Now');
  });

  it('preserves mixed text, repeated pictures and their individual links', () => {
    const input = `<p>Before <a href="https://lawnsynergy.com/a"><img src="${DRAFT_SRC}" alt="Same"></a> between `
      + `<a href="https://lawnsynergy.com/b"><img src="${secondDraft}" alt="Same"></a> after <img src="${DRAFT_SRC}"></p>`;
    const features = featuresFor(input);
    const doc = new DOMParser().parseFromString(getUnformattedHtml(input, 'blogs', features), 'text/html');
    expect(Array.from(doc.querySelectorAll('img'), image => image.getAttribute('src'))).toEqual([CDN, second.src, CDN]);
    // The final space separates body text from the trailing inline image.
    expect(doc.querySelector('p')?.textContent).toBe('Before  between  after ');
    expect(doc.querySelectorAll('p a > img')).toHaveLength(2);
    expect(doc.querySelector('p div')).toBeNull();
  });

  it('retains embedded pixels only until matching and never publishes unmatched data images', () => {
    const src = 'data:image/png;base64,AAA';
    const input = `<p><img src="${src}" onerror="alert(1)"></p>`;
    const features = featuresFor(input);
    const output = getUnformattedHtml(input, 'blogs', features);
    expect(output).toContain(`src="${CDN}"`);
    expect(output).not.toMatch(/data:image|onerror/);
    const missing = { ...features, draftImageFingerprints: [{ src, href: null, fp: null }] };
    expect(getUnformattedHtml(input, 'blogs', missing)).not.toContain('<img');
  });

  it('warns for an unreadable unlabelled image even when output is empty', () => {
    const input = `<p><img src="${DRAFT_SRC}"></p>`;
    const features = { imageLibrary: [first], draftImageFingerprints: [{ src: DRAFT_SRC, href: null, fp: null }] };
    const output = getUnformattedHtml(input, 'blogs', features);
    expect(output).toBe('');
    expect(validateMode(output, 'blogs', features).results.find(result => result.ruleId === 'image-library')).toMatchObject({
      passed: false, details: ['Image 1: picture could not be verified; image not applied'],
    });
  });
});

describe('image library: picture fingerprints', () => {
  const href = 'https://lawnsynergy.com/collections/weed-killer-for-lawns';
  const entry = (alt: string, value?: number): ImageLibraryEntry =>
    ({ host: 'lawnsynergy.com', alt, src: CDN, ...(value === undefined ? {} : { fp: fp(value) }) });
  const cta = (alt: string): ImageCta => {
    const doc = new DOMParser().parseFromString(`<p>Alt Image Text: ${alt}</p><p>Link to: <a href="${href}">x</a></p>`, 'text/html');
    const [altParagraph, linkParagraph] = Array.from(doc.querySelectorAll('p'));
    const image = doc.createElement('img');
    image.setAttribute('src', DRAFT_SRC);
    altParagraph.prepend(image);
    return { image, src: DRAFT_SRC, altParagraph, linkParagraph, alt, href };
  };
  const fps = (value: number | null) => [{ src: DRAFT_SRC, href, fp: value === null ? null : fp(value) }];

  it('matches by picture even when the alt text was reworded', () => {
    const saved = entry('Old wording of this banner', 10);
    expect(resolveImageCta(cta('Completely New Wording'), [saved], fps(10)))
      .toEqual({ status: 'matched', entry: saved, confidence: 'high' });
  });

  it('refuses an alt-text match when the pictures differ', () => {
    const saved = entry('Shop Weed Killer', 10);
    expect(resolveImageCta(cta('Shop Weed Killer'), [saved], fps(10 + FINGERPRINT_THRESHOLD + 1)))
      .toEqual({ status: 'unmatched' });
  });

  it('never consults alt text when either picture is unreadable', () => {
    const saved = entry('Shop Weed Killer', 10);
    const held = { status: 'unverified' };
    // Draft image unreadable
    expect(resolveImageCta(cta('Shop Weed Killer'), [saved], fps(null))).toEqual(held);
    expect(resolveImageCta(cta('Completely different words'), [saved], fps(null))).toEqual(held);
    // No draft fingerprint at all
    expect(resolveImageCta(cta('Shop Weed Killer'), [saved], undefined)).toEqual(held);
    // Saved entry has no fingerprint yet
    const legacy = entry('Shop Weed Killer');
    expect(resolveImageCta(cta('Shop Weed Killer'), [legacy], fps(10))).toEqual(held);
  });

  it('holds a picture match outside the calibrated same-image range', () => {
    // One cell differs by 40: within the threshold but not an exact match
    const cells = new Uint8Array(FINGERPRINT_LENGTH).fill(10);
    cells[0] = 50;
    const saved = { ...entry('Shop Weed Killer'), fp: encodeFingerprint(cells) };
    expect(resolveImageCta(cta('Shop Weed Killer'), [saved], fps(10)))
      .toEqual({ status: 'below-confidence', entry: saved, confidence: 'medium' });
  });

  it('warns when a match is held, naming why', () => {
    const saved = entry('Shop Grass Seed');
    const draft = `<p>Body text.</p><p><img src="${DRAFT_SRC}">Alt Image Text: Shop Grass Seed</p>`
      + `<p>Link to: <a href="${href}">${href}</a></p><p>Done.</p>`;
    const features = { imageLibrary: [saved], draftImageFingerprints: fps(null) };
    const output = getUnformattedHtml(draft, 'blogs', features);
    expect(output).not.toContain('<img');
    const result = validateMode(output, 'blogs', features).results.find(r => r.ruleId === 'image-library');
    expect(result?.details).toEqual([
      'Image 1 on lawnsynergy.com: picture could not be verified; image not applied',
    ]);
    // A near-but-not-exact picture match is named differently
    const cells = new Uint8Array(FINGERPRINT_LENGTH).fill(10);
    cells[0] = 50;
    const near = { imageLibrary: [{ ...saved, fp: encodeFingerprint(cells) }], draftImageFingerprints: fps(10) };
    const nearResult = validateMode(getUnformattedHtml(draft, 'blogs', near), 'blogs', near).results.find(r => r.ruleId === 'image-library');
    expect(nearResult?.details).toEqual([
      'Image 1 on lawnsynergy.com: picture match is not exact; image not applied',
    ]);
  });

  it('keeps pictures scoped to the store of the draft link', () => {
    const otherStore = { ...entry('Other wording', 10), host: 'other-store.com' };
    expect(resolveImageCta(cta('Shop Weed Killer'), [otherStore], fps(10)))
      .toEqual({ status: 'unmatched' });
  });

  it('keeps metadata as text and warns when the pictures differ', () => {
    const saved = entry('Shop Grass Seed', 10);
    const draft = `<p>Body text.</p><p><img src="${DRAFT_SRC}">Alt Image Text: Shop Grass Seed</p>`
      + `<p>Link to: <a href="${href}">${href}</a></p><p>Done.</p>`;
    const features = { imageLibrary: [saved], draftImageFingerprints: fps(200) };
    const output = getUnformattedHtml(draft, 'blogs', features);
    expect(output).toContain('Alt Image Text: Shop Grass Seed');
    expect(output).not.toContain('<img');
    const result = validateMode(output, 'blogs', features).results.find(r => r.ruleId === 'image-library');
    expect(result).toMatchObject({
      passed: false,
      severity: 'warning',
      details: ['Image 1 on lawnsynergy.com: no saved picture matches; image not applied'],
    });
  });

  it('converts with a cross-alt picture match inserted under the draft alt text', () => {
    const saved = entry('Old banner wording', 10);
    const draft = `<p>Body text.</p><p><img src="${DRAFT_SRC}">Alt Image Text: New Banner Wording</p>`
      + `<p>Link to: <a href="${href}">${href}</a></p><p>Done.</p>`;
    const features = { imageLibrary: [saved], draftImageFingerprints: fps(12) };
    const output = getUnformattedHtml(draft, 'blogs', features);
    expect(output).toContain(`<img src="${CDN}" alt="New Banner Wording" style="float: none;">`);
    expect(validateMode(output, 'blogs', features).summary.failed).toBe(0);
  });

  it('keeps a saved fingerprint when the same image is saved again without one', () => {
    const saved = entry('Shop Weed Killer', 10);
    const merged = mergeImageLibrary([saved], [entry('Shop Weed Killer')]);
    expect(merged).toEqual({ library: [saved], added: 0, updated: 0 });
    // A different source is a separate picture, regardless of its alt text.
    const reuploaded = { ...entry('Shop Weed Killer'), src: `${CDN}&new` };
    expect(mergeImageLibrary([saved], [reuploaded]).library).toEqual([saved, reuploaded]);
  });

  it('keeps a valid fingerprint through JSON and drops a malformed one', () => {
    const saved = entry('Shop Weed Killer', 10);
    expect(parseImageLibraryJson(JSON.stringify([saved]))).toEqual([saved]);
    expect(parseImageLibraryJson(JSON.stringify([{ ...saved, fp: 'bad!' }])))
      .toEqual([entry('Shop Weed Killer')]);
  });

  it('discovers every actual image independently of labels and alt attributes', () => {
    const html = '<p><img src="data:image/png;base64,AAA">Alt Image Text: Same Paragraph</p>'
      + '<p><img src="https://lh7-rt.googleusercontent.com/docsz/x=s800"></p><p>Alt Image Text: Next Paragraph</p>'
      + '<p><img src="https://host.com/hero.png"></p><p>No label here</p>'
      + '<p><img src="/relative.png">Alt Image Text: Relative</p>'
      + '<img src="https://host.com/bare.png"><div><img src="https://host.com/nested.png"></div>';
    expect(findDraftImages(html)).toEqual([
      { src: 'data:image/png;base64,AAA', href: null },
      { src: 'https://lh7-rt.googleusercontent.com/docsz/x=s800', href: null },
      { src: 'https://host.com/hero.png', href: null },
      { src: '/relative.png', href: null },
      { src: 'https://host.com/bare.png', href: null },
      { src: 'https://host.com/nested.png', href: null },
    ]);
  });
});
