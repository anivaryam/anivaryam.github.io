import { describe, expect, it } from 'vitest';
import { convertToHtml, getUnformattedHtml } from './converter';
import { cleanWordHtml } from './word-html-cleaner';
import { validateMode } from './validator';
import {
  getStoreHost,
  isShopifyImageBlock,
  mergeImageLibrary,
  normalizeAltText,
  parseImageLibraryJson,
  parseShopifyImages,
  type ImageLibraryEntry,
} from './image-library';

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

  it('skips images without alt text or without an absolute link naming the store', () => {
    const html = `<img src="${CDN}" alt="No link">`
      + `<a href="/collections/seed"><img src="${CDN}" alt="Relative link"></a>`
      + `<a href="https://lawnsynergy.com/a"><img src="${CDN}" alt=""></a>`
      + `<a href="https://lawnsynergy.com/a"><img src="javascript:alert(1)" alt="Script"></a>`;
    expect(parseShopifyImages(html)).toEqual({ entries: [], skipped: 4 });
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

  it('replaces the alt text and link paragraphs with the Shopify image markup', () => {
    const alt = 'Kill Weeds. Keep Your Lawn: Shop Weed Killer For Lawns';
    const features = { imageLibrary: library };
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
    const output = getUnformattedHtml(draft(draftCta(library[0].alt, href)), 'blogs', { imageLibrary: library, linkAttributes: false });
    expect(output).toContain(imageBlock(href, library[0].alt).replace('noopener noreferrer', 'noopener'));
  });

  it('uses the draft link, not the link the image had in the earlier article', () => {
    const draftHref = 'https://lawnsynergy.com/collections/spring-weed-control';
    const output = getUnformattedHtml(draft(draftCta(library[0].alt, draftHref)), 'blogs', { imageLibrary: library });
    expect(output).toContain(imageBlock(draftHref, library[0].alt));
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
