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
 * An entry is matched within the store domain of the draft link; the domain
 * keeps one store's images out of another store's articles. Inside a store,
 * the picture decides: a fingerprint of the draft image is compared to the
 * saved images (see image-fingerprint.ts), so the same banner matches under
 * a reworded alt text, and a different banner under the same alt text is
 * refused. Alt text is the fallback when a picture cannot be read; drafts
 * vary its punctuation ("... Lawn: Shop ..." and "... Lawn. Shop ..."), so
 * it is compared without case, punctuation, or extra whitespace.
 */

import { setLinkAttributes } from './mode-link-attributes';
import { decodeFingerprint, fingerprintDistance, fingerprintsMatch, matchConfidence, type MatchConfidence } from './image-fingerprint';

export interface ImageLibraryEntry {
  /** Store domain, lowercased and without "www." */
  host: string;
  /** Alt text as it was saved */
  alt: string;
  /** Uploaded image URL (the Shopify CDN file) */
  src: string;
  /** Base64 fingerprint of the uploaded picture (see image-fingerprint.ts) */
  fp?: string;
}

/**
 * Fingerprints of the draft's own images, keyed by normalized alt text.
 * null records an image whose pixels could not be read.
 */
export type DraftFingerprints = Record<string, string | null>;

export interface ImageCta {
  altParagraph: Element;
  /** The "Link to:" paragraph; null when the link is anchored on the alt text */
  linkParagraph: Element | null;
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
 * The draft's own images with the alt text of their CTA, read from the raw
 * input before the cleaner strips them. The label is in the image's own
 * paragraph or the next one; an image without a label (the hero) is skipped.
 */
export function findDraftImages(html: string): { alt: string; src: string }[] {
  const doc = new DOMParser().parseFromString(html, 'text/html');
  const images: { alt: string; src: string }[] = [];
  doc.querySelectorAll('img[src]').forEach(image => {
    const src = image.getAttribute('src') || '';
    if (!/^(data:image\/|(https:)?\/\/)/i.test(src)) return;
    const paragraph = image.closest('p');
    if (!paragraph) return;
    const label = [paragraph, paragraph.nextElementSibling]
      .map(el => el ? paragraphText(el) : '')
      .find(text => ALT_LABEL.test(text));
    if (!label) return;
    const alt = label.replace(ALT_LABEL, '').trim();
    if (alt) images.push({ alt, src });
  });
  return images;
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
    // A saved fingerprint of the same picture survives a merge without one
    if (!entry.fp && existing && existing.fp && existing.src === entry.src) {
      entry = { ...entry, fp: existing.fp };
    }
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
  ).map(({ host, alt, src, fp }) => decodeFingerprint(fp) ? { host, alt, src, fp } : { host, alt, src });
}

/**
 * The CTA link of a paragraph that is nothing but a link: a lone anchor
 * whose text is the whole paragraph, or a bare URL with no other words.
 * A body sentence that merely contains a link is not one.
 */
function pureLinkHref(paragraph: Element): string | null {
  const text = paragraphText(paragraph);
  const anchors = paragraph.querySelectorAll('a[href]');
  if (anchors.length === 1 && text === paragraphText(anchors[0])) {
    return anchors[0].getAttribute('href');
  }
  if (anchors.length === 0 && /^https?:\/\/\S+$/i.test(text)) return text;
  return null;
}

/**
 * Alt text paragraphs with their CTA link. Drafts write the link three
 * ways: a "Link to:" paragraph directly after the alt text, a paragraph
 * holding nothing but the link, or the link anchored on the alt text
 * itself; the first found in that order wins. Alt text without any of them
 * (the hero image) is not a CTA.
 */
export function findImageCtas(doc: Document): ImageCta[] {
  const ctas: ImageCta[] = [];
  doc.body.querySelectorAll('p').forEach(altParagraph => {
    const altText = paragraphText(altParagraph);
    if (!ALT_LABEL.test(altText)) return;
    const alt = altText.replace(ALT_LABEL, '').trim();
    if (!alt) return;
    const next = altParagraph.nextElementSibling;
    if (next && next.tagName.toLowerCase() === 'p') {
      if (LINK_LABEL.test(paragraphText(next))) {
        const href = next.querySelector('a[href]')?.getAttribute('href')
          || paragraphText(next).replace(LINK_LABEL, '').trim();
        if (href) ctas.push({ altParagraph, linkParagraph: next, alt, href });
        return;
      }
      const bareHref = pureLinkHref(next);
      if (bareHref) {
        ctas.push({ altParagraph, linkParagraph: next, alt, href: bareHref });
        return;
      }
    }
    const anchoredHref = altParagraph.querySelector('a[href]')?.getAttribute('href');
    if (anchoredHref) ctas.push({ altParagraph, linkParagraph: null, alt, href: anchoredHref });
  });
  return ctas;
}

export interface ImageCtaResolution {
  /**
   * matched: insert the entry's image. conflict: the alt text matches but
   * the pictures differ, so nothing is inserted. below-confidence: a match
   * exists but under the required confidence, so nothing is inserted.
   * unmatched / no-host: no saved image to use.
   */
  status: 'matched' | 'conflict' | 'below-confidence' | 'unmatched' | 'no-host';
  entry?: ImageLibraryEntry;
  /** high/medium: picture match at that distance; low: alt text only. */
  confidence?: MatchConfidence;
}

/**
 * Decides which saved image a CTA uses. Within the store of the draft link,
 * the picture decides: the closest fingerprint match is taken whatever its
 * alt text says, and only a high-confidence match (inside the calibrated
 * same-image range) is applied. A medium match (up to the threshold) and an
 * alt-text-only match are held and reported, never applied; alt text whose
 * pictures are readable but differ is a conflict.
 */
export function resolveImageCta(
  cta: ImageCta,
  library: ImageLibraryEntry[],
  draftFingerprints?: DraftFingerprints
): ImageCtaResolution {
  const host = getStoreHost(cta.href);
  if (!host) return { status: 'no-host' };
  const storeEntries = library.filter(entry => entry.host === host);
  const draftFp = decodeFingerprint(draftFingerprints?.[normalizeAltText(cta.alt)]);
  if (draftFp) {
    const byPicture = storeEntries
      .map(entry => ({ entry, distance: fingerprintDistance(draftFp, decodeFingerprint(entry.fp)) }))
      .filter(candidate => fingerprintsMatch(draftFp, decodeFingerprint(candidate.entry.fp)))
      .sort((a, b) => a.distance - b.distance)[0];
    if (byPicture) {
      const confidence = matchConfidence(byPicture.distance) as MatchConfidence;
      return confidence === 'high'
        ? { status: 'matched', entry: byPicture.entry, confidence }
        : { status: 'below-confidence', entry: byPicture.entry, confidence };
    }
  }
  const key = entryKey(host, cta.alt);
  const byAlt = storeEntries.find(entry => entryKey(entry.host, entry.alt) === key);
  if (!byAlt) return { status: 'unmatched' };
  if (draftFp && decodeFingerprint(byAlt.fp)) {
    // Both pictures were readable and did not match above
    return { status: 'conflict', entry: byAlt };
  }
  return { status: 'below-confidence', entry: byAlt, confidence: 'low' };
}

/**
 * Replaces each matched image CTA with the Shopify image markup. With
 * `linkAttributes` the image link gets the same attributes as every other
 * link; otherwise it keeps the Shopify editor's target and rel.
 */
export function applyImageLibrary(html: string, library: ImageLibraryEntry[], linkAttributes: boolean, draftFingerprints?: DraftFingerprints): string {
  if (!html || library.length === 0) return html;
  const doc = new DOMParser().parseFromString(html, 'text/html');
  findImageCtas(doc).forEach(cta => {
    const { status, entry } = resolveImageCta(cta, library, draftFingerprints);
    if (status !== 'matched' || !entry) return;
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
    cta.linkParagraph?.remove();
  });
  return doc.body.innerHTML;
}

/** Image CTAs left in the output, with why no saved image was inserted. */
export function getImageCtaIssues(doc: Document, library: ImageLibraryEntry[], draftFingerprints?: DraftFingerprints): { element: Element; message: string }[] {
  const issues: { element: Element; message: string }[] = [];
  findImageCtas(doc).forEach(cta => {
    const { status, confidence } = resolveImageCta(cta, library, draftFingerprints);
    if (status === 'matched') return;
    const host = getStoreHost(cta.href);
    issues.push({
      element: cta.altParagraph,
      message: status === 'conflict'
        ? `The draft picture differs from the saved image for "${cta.alt}" on ${host}`
        : status === 'below-confidence'
          ? confidence === 'medium'
            ? `Picture match for "${cta.alt}" on ${host} is not exact; image not applied`
            : `Picture for "${cta.alt}" on ${host} not verified; image not applied`
          : status === 'no-host'
            ? `Link for "${cta.alt}" has no store domain`
            : `No saved image for "${cta.alt}" on ${host}`,
    });
  });
  return issues;
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
