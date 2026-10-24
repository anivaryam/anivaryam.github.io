/**
 * Mode Utility: Image Library (Blogs)
 *
 * Drafts mark a linked image (a visual call to action) with two paragraphs:
 *   <p>Alt Image Text: Start With The Right Seed: Shop Grass Seed</p>
 *   <p>Link to: <a href="https://store.com/collections/grass-seed">...</a></p>
 * The cleaner removes the draft image itself. When an image with the same
 * alt text was already uploaded to the same Shopify store, both paragraphs
 * are replaced with the markup the Shopify editor produces for that image.
 *
 * An entry is matched by the store domain of the draft link plus the alt
 * text. Drafts vary the punctuation of the same alt text ("Kill Weeds. Keep
 * Your Lawn: Shop ..." and "Kill Weeds. Keep Your Lawn. Shop ..."), so the
 * alt text is compared without case, punctuation, or extra whitespace. The
 * domain keeps one store's images out of another store's articles.
 */

import { setLinkAttributes } from './mode-link-attributes';

export interface ImageLibraryEntry {
  /** Store domain, lowercased and without "www." */
  host: string;
  /** Alt text as it was saved */
  alt: string;
  /** Uploaded image URL (the Shopify CDN file) */
  src: string;
}

export interface ImageCta {
  altParagraph: Element;
  linkParagraph: Element;
  alt: string;
  href: string;
}

// Same label variants the Blocks view groups as image blocks.
const ALT_LABEL = /^alt(?: image)? text:\s*/i;
const LINK_LABEL = /^link(?: to)?:\s*/i;

const BLOCK_STYLE = 'text-align: center;';
const IMAGE_STYLE = 'float: none;';

function paragraphText(element: Element): string {
  return (element.textContent || '').replace(/\u00a0/g, ' ').trim();
}

/** Alt text compared without case, punctuation, or extra whitespace. */
export function normalizeAltText(alt: string): string {
  return alt.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
}

/**
 * The store domain a link points to, or null for a relative or invalid URL.
 * Google Docs exports wrap links as google.com/url?q=<target>; the target
 * names the store.
 */
export function getStoreHost(href: string): string | null {
  let url: URL;
  try {
    url = new URL(href.startsWith('//') ? `https:${href}` : href);
  } catch {
    return null;
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return null;
  const host = url.hostname.toLowerCase().replace(/^www\./, '');
  const target = url.searchParams.get('q');
  if (host === 'google.com' && url.pathname === '/url' && target) {
    return getStoreHost(target);
  }
  return host || null;
}

function entryKey(host: string, alt: string): string {
  return `${host} ${normalizeAltText(alt)}`;
}

/**
 * Reads the uploaded images from Shopify editor HTML. An image is kept when
 * it has alt text and sits in a link with an absolute URL, which names the
 * store; `skipped` counts the images without one of those.
 */
export function parseShopifyImages(html: string): { entries: ImageLibraryEntry[]; skipped: number } {
  const doc = new DOMParser().parseFromString(html, 'text/html');
  const entries: ImageLibraryEntry[] = [];
  let skipped = 0;
  doc.querySelectorAll('img').forEach(image => {
    const alt = (image.getAttribute('alt') || '').trim();
    const src = (image.getAttribute('src') || '').trim();
    const href = image.closest('a[href]')?.getAttribute('href') || '';
    const host = getStoreHost(href);
    if (!alt || !normalizeAltText(alt) || !/^(https:)?\/\//i.test(src) || !host) {
      skipped++;
      return;
    }
    entries.push({ host, alt, src });
  });
  return { entries, skipped };
}

/**
 * Adds entries without duplicates: an entry for the same store and alt text
 * replaces the saved one. `added` counts new entries and `updated` the saved
 * ones that changed (a newer upload); the rest were already saved.
 */
export function mergeImageLibrary(saved: ImageLibraryEntry[], incoming: ImageLibraryEntry[]): { library: ImageLibraryEntry[]; added: number; updated: number } {
  const byKey = new Map(saved.map(entry => [entryKey(entry.host, entry.alt), entry]));
  let added = 0;
  let updated = 0;
  incoming.forEach(entry => {
    const key = entryKey(entry.host, entry.alt);
    const existing = byKey.get(key);
    if (!existing) added++;
    else if (existing.src !== entry.src || existing.alt !== entry.alt) updated++;
    byKey.set(key, entry);
  });
  return { library: Array.from(byKey.values()), added, updated };
}

/** Keeps only well-formed entries from stored or imported JSON. */
export function parseImageLibraryJson(json: string): ImageLibraryEntry[] {
  let data: unknown;
  try {
    data = JSON.parse(json);
  } catch {
    return [];
  }
  if (!Array.isArray(data)) return [];
  return data.filter((entry): entry is ImageLibraryEntry =>
    !!entry && typeof entry === 'object'
      && typeof entry.host === 'string' && !!entry.host
      && typeof entry.alt === 'string' && !!normalizeAltText(entry.alt)
      && typeof entry.src === 'string' && /^(https:)?\/\//i.test(entry.src)
  ).map(({ host, alt, src }) => ({ host, alt, src }));
}

/** Alt text paragraphs directly followed by a link paragraph. */
export function findImageCtas(doc: Document): ImageCta[] {
  const ctas: ImageCta[] = [];
  doc.body.querySelectorAll('p').forEach(altParagraph => {
    const altText = paragraphText(altParagraph);
    if (!ALT_LABEL.test(altText)) return;
    const linkParagraph = altParagraph.nextElementSibling;
    if (!linkParagraph || linkParagraph.tagName.toLowerCase() !== 'p') return;
    const linkText = paragraphText(linkParagraph);
    if (!LINK_LABEL.test(linkText)) return;
    const href = linkParagraph.querySelector('a[href]')?.getAttribute('href')
      || linkText.replace(LINK_LABEL, '').trim();
    const alt = altText.replace(ALT_LABEL, '').trim();
    if (!alt || !href) return;
    ctas.push({ altParagraph, linkParagraph, alt, href });
  });
  return ctas;
}

function findEntry(cta: ImageCta, library: ImageLibraryEntry[]): ImageLibraryEntry | undefined {
  const host = getStoreHost(cta.href);
  if (!host) return undefined;
  const key = entryKey(host, cta.alt);
  return library.find(entry => entryKey(entry.host, entry.alt) === key);
}

/**
 * Replaces each matched image CTA with the Shopify image markup. With
 * `linkAttributes` the image link gets the same attributes as every other
 * link; otherwise it keeps the Shopify editor's target and rel.
 */
export function applyImageLibrary(html: string, library: ImageLibraryEntry[], linkAttributes: boolean): string {
  if (!html || library.length === 0) return html;
  const doc = new DOMParser().parseFromString(html, 'text/html');
  findImageCtas(doc).forEach(cta => {
    const entry = findEntry(cta, library);
    if (!entry) return;
    const block = doc.createElement('div');
    block.setAttribute('style', BLOCK_STYLE);
    const link = doc.createElement('a');
    // The draft link wins over the link the image had in the earlier article
    link.setAttribute('href', cta.href);
    link.setAttribute('target', '_blank');
    link.setAttribute('rel', 'noopener');
    if (linkAttributes) setLinkAttributes(link);
    const image = doc.createElement('img');
    image.setAttribute('src', entry.src);
    image.setAttribute('alt', cta.alt);
    image.setAttribute('style', IMAGE_STYLE);
    link.appendChild(image);
    block.appendChild(link);
    cta.altParagraph.replaceWith(block);
    cta.linkParagraph.remove();
  });
  return doc.body.innerHTML;
}

/** Image CTAs left in the output because no saved image matches them. */
export function getUnmatchedImageCtas(doc: Document, library: ImageLibraryEntry[]): { element: Element; message: string }[] {
  return findImageCtas(doc)
    .filter(cta => !findEntry(cta, library))
    .map(cta => {
      const host = getStoreHost(cta.href);
      return {
        element: cta.altParagraph,
        message: host
          ? `No saved image for "${cta.alt}" on ${host}`
          : `Link for "${cta.alt}" has no store domain`,
      };
    });
}

function hasStyle(element: Element, style: string): boolean {
  const normalize = (value: string) => value.toLowerCase().replace(/\s+/g, '').replace(/;$/, '');
  return normalize(element.getAttribute('style') || '') === normalize(style);
}

/**
 * The Shopify image markup this module inserts: a centered <div> holding an
 * <img style="float: none;">, optionally inside one <a>. The sanitizer
 * allowlist has no <div> and no style attribute, so the validator exempts
 * exactly this shape.
 */
export function isShopifyImageBlock(element: Element): boolean {
  if (element.tagName.toLowerCase() !== 'div' || !hasStyle(element, BLOCK_STYLE)) return false;
  if (Array.from(element.childNodes).some(node => node.nodeType === Node.TEXT_NODE && node.textContent?.trim())) return false;
  const [child, ...rest] = Array.from(element.children);
  if (!child || rest.length > 0) return false;
  const image = child.tagName.toLowerCase() === 'a' && child.children.length === 1 && !child.textContent?.trim()
    ? child.children[0]
    : child;
  return image.tagName.toLowerCase() === 'img' && hasStyle(image, IMAGE_STYLE);
}

/**
 * The <div> or <img> of a Shopify image block: the only elements whose style
 * attribute the validator allows here.
 */
export function isShopifyImageBlockStyled(element: Element): boolean {
  const block = element.tagName.toLowerCase() === 'img' ? element.closest('div') : element;
  return !!block && isShopifyImageBlock(block);
}
