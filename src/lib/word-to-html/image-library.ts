/**
 * Mode Utility: Image Library (Blogs)
 *
 * Each actual draft image is matched by its picture fingerprint. A link
 * scopes candidates to its store; linkless images match by picture alone.
 * Alt text is output metadata only: it never identifies or selects a picture.
 * Optional adjacent "Alt Image Text:" and "Link to:" paragraphs supply
 * output metadata and are consumed only when their image is replaced.
 */

import { setLinkAttributes } from './mode-link-attributes';
import { decodeFingerprint, fingerprintDistance, matchConfidence, type MatchConfidence } from './image-fingerprint';
import { nextNonSpacingElement } from './html-spacing';

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
 * One record per actual draft image. Source URLs identify the pixels to load;
 * null records an image whose pixels could not be read. Labels are not keys.
 */
export type DraftFingerprints = { src: string; href: string | null; fp: string | null }[];

export interface ImageCta {
  image: Element;
  src: string;
  altParagraph: Element | null;
  /** The "Link to:" paragraph; null when the link is anchored on the alt text */
  linkParagraph: Element | null;
  alt: string;
  /** null for a linkless image (the hero): matched by picture only */
  href: string | null;
}

/*
 * Drafts word the alt text label many ways: "Alt Image Text:", "Alt Text
 * Image:", "Image Alt Text -", "ALT-TEXT:", "**Alt Tag:**". A label is a
 * short run of known words that names alt text, then a colon or a dash.
 * Known words only, so a body sentence such as "Why Alt Text Matters:" or
 * "Alternatively: ..." is never read as a label.
 */
const ALT_LABEL = /^[\s*_]*([\p{L}\p{N}][\p{L}\p{N}\s_/()#-]{0,80}?)[\s*_]*(?:[:\uff1a\u2013\u2014]|-(?=\s|$))[\s*_]*/u;
const ALT_LABEL_WORDS = new Set([
  'alt', 'alttext', 'alttag', 'alternative', 'alternate',
  'image', 'images', 'img', 'picture', 'photo', 'graphic', 'banner', 'hero', 'featured', 'cta',
  'product', 'main', 'header', 'blog', 'text', 'tag', 'attribute', 'description',
  'suggested', 'recommended', 'seo', 'for', 'the',
]);
const ALT_LABEL_MAX_WORDS = 8;
const LINK_LABEL = /^link(?: to)?:\s*/i;

const BLOCK_STYLE = 'text-align: center;';
const IMAGE_STYLE = 'float: none;';

function paragraphText(element: Element): string {
  return (element.textContent || '').replace(/\u00a0/g, ' ').trim();
}

/**
 * The alt text after an alt text label at the start of `text`, or null when
 * `text` does not start with one; a label alone gives ''. The one label
 * check for spacing, link wrapping, the image library, validation, and the
 * Blocks view, so they always agree on which paragraphs are alt text.
 */
export function readAltLabel(text: string): string | null {
  const clean = text.replace(/[\u200b-\u200d\u2060]/g, '');
  const match = ALT_LABEL.exec(clean);
  if (!match) return null;
  const words = match[1].toLowerCase().split(/[\s_/()#-]+/).filter(Boolean);
  const namesAlt = words.some(word => /^alt(?:text|tag)?$/.test(word))
    || (words.includes('text') && words.some(word => word === 'alternative' || word === 'alternate'));
  const known = words.every(word => ALT_LABEL_WORDS.has(word) || /^\d+$/.test(word));
  if (!namesAlt || !known || words.length > ALT_LABEL_MAX_WORDS) return null;
  return clean.slice(match[0].length).replace(/[\s*_]+$/, '');
}

/** A paragraph that starts with an alt text label (see readAltLabel). */
export function isAltLabelParagraph(element: Element | null): boolean {
  return element?.tagName.toLowerCase() === 'p' && readAltLabel(element.textContent || '') !== null;
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

function entryKey(host: string, src: string): string {
  return JSON.stringify([host, src]);
}

/**
 * Reads the uploaded images from Shopify editor HTML. An image is kept when
 * its URL and store are usable. Alt text is optional descriptive metadata.
 */
export function parseShopifyImages(html: string): { entries: ImageLibraryEntry[]; skipped: number } {
  const doc = new DOMParser().parseFromString(html, 'text/html');
  const entries: ImageLibraryEntry[] = [];
  let skipped = 0;
  // A linkless image (the hero) belongs to the paste's store, known only
  // when every link in the paste names the same one.
  const pasteHosts = new Set(
    Array.from(doc.querySelectorAll('a[href]'))
      .map(anchor => getStoreHost(anchor.getAttribute('href') || ''))
      .filter((host): host is string => !!host)
  );
  const pasteHost = pasteHosts.size === 1 ? Array.from(pasteHosts)[0] : null;
  doc.querySelectorAll('img').forEach(image => {
    const alt = (image.getAttribute('alt') || '').trim();
    const src = (image.getAttribute('src') || '').trim();
    const href = image.closest('a[href]')?.getAttribute('href') || '';
    const host = getStoreHost(href) || (!href ? pasteHost : null);
    if (!/^(https:)?\/\//i.test(src) || !host) {
      skipped++;
      return;
    }
    entries.push({ host, alt, src });
  });
  return { entries, skipped };
}

/**
 * All actual draft images, including images without labels or alt attributes.
 * Optional labels describe output only; discovery never requires them.
 */
export function findDraftImages(html: string): { src: string; href: string | null }[] {
  const doc = new DOMParser().parseFromString(html, 'text/html');
  return findImageCtas(doc).map(({ src, href }) => ({ src, href }));
}

/**
 * Deduplicates by store and source URL. Different pictures with identical
 * alt text coexist; re-saving a source updates only its descriptive metadata.
 */
export function mergeImageLibrary(saved: ImageLibraryEntry[], incoming: ImageLibraryEntry[]): { library: ImageLibraryEntry[]; added: number; updated: number } {
  const byKey = new Map(saved.map(entry => [entryKey(entry.host, entry.src), entry]));
  let added = 0;
  let updated = 0;
  incoming.forEach(entry => {
    const key = entryKey(entry.host, entry.src);
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

/** Apply only this tab's edits to the latest stored library, not its stale snapshot. */
export function reconcileImageLibrary(before: ImageLibraryEntry[], after: ImageLibraryEntry[], latest: ImageLibraryEntry[]): ImageLibraryEntry[] {
  const oldEntries = new Map(before.map(entry => [entryKey(entry.host, entry.src), entry]));
  const newEntries = new Map(after.map(entry => [entryKey(entry.host, entry.src), entry]));
  const retained = latest.filter(entry => {
    const key = entryKey(entry.host, entry.src);
    return !oldEntries.has(key) || newEntries.has(key);
  });
  const latestEntries = new Map(retained.map(entry => [entryKey(entry.host, entry.src), entry]));
  const changes: ImageLibraryEntry[] = [];
  for (const [key, entry] of newEntries) {
    const old = oldEntries.get(key);
    if (!old) changes.push(entry);
    else {
      const current = latestEntries.get(key);
      // Backfill or an old tab's metadata edit must never resurrect a removed image.
      if (!current) continue;
      const alt = old.alt !== entry.alt ? entry.alt : current.alt;
      const fp = old.fp !== entry.fp ? entry.fp : current.fp;
      if (alt !== current.alt || fp !== current.fp) changes.push({ ...current, alt, fp });
    }
  }
  return mergeImageLibrary(retained, changes).library;
}

/** Keeps only well-formed entries from stored or imported JSON. */
export function parseImageLibraryJson(json: string, strict = false): ImageLibraryEntry[] {
  let data: unknown;
  try {
    data = JSON.parse(json);
  } catch {
    if (strict) throw new Error('The file is not valid JSON.');
    return [];
  }
  if (!Array.isArray(data)) {
    if (strict) throw new Error('An image library must be a JSON array.');
    return [];
  }
  const entries = data.filter((entry): entry is ImageLibraryEntry =>
    !!entry && typeof entry === 'object'
      && typeof entry.host === 'string' && !!entry.host
      && (entry.alt === undefined || typeof entry.alt === 'string')
      && typeof entry.src === 'string' && /^(https:)?\/\//i.test(entry.src)
  );
  if (strict && data.length > 0 && entries.length === 0) throw new Error('The file contains no valid image entries.');
  return entries.map(({ host, alt = '', src, fp }) => decodeFingerprint(fp) ? { host, alt, src, fp } : { host, alt, src });
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
 * Image occurrences and optional output metadata. A label may describe an
 * isolated image in its paragraph or the next paragraph, but never creates
 * an image occurrence by itself. Mixed body text and neighbouring images
 * are not consumed as metadata.
 */
export function findImageCtas(doc: Document): ImageCta[] {
  const ctas: ImageCta[] = [];
  doc.body.querySelectorAll('img').forEach(image => {
    const paragraph = image.closest('p');
    const isolated = !paragraph || (paragraph.querySelectorAll('img').length === 1 &&
      (!paragraphText(paragraph) || isAltLabelParagraph(paragraph)));
    const following = isolated ? nextNonSpacingElement(paragraph || image) : null;
    const altParagraph = isolated && isAltLabelParagraph(paragraph) ? paragraph
      : isAltLabelParagraph(following) && !following?.querySelector('img') ? following : null;
    const alt = (altParagraph ? readAltLabel(paragraphText(altParagraph)) : null)
      || image.getAttribute('alt') || '';
    let href = image.closest('a[href]')?.getAttribute('href') || null;
    let linkParagraph: Element | null = null;
    const next = altParagraph ? nextNonSpacingElement(altParagraph) : following;
    if (next?.tagName.toLowerCase() === 'p' && !next.querySelector('img')) {
      if (LINK_LABEL.test(paragraphText(next))) {
        href = next.querySelector('a[href]')?.getAttribute('href')
          || paragraphText(next).replace(LINK_LABEL, '').trim() || href;
        if (href) linkParagraph = next;
      } else {
        const bareHref = pureLinkHref(next);
        if (bareHref) {
          href = bareHref;
          linkParagraph = next;
        }
      }
    }
    href ||= altParagraph?.querySelector('a[href]')?.getAttribute('href') || null;
    ctas.push({ image, src: (image.getAttribute('src') || '').trim(), altParagraph, linkParagraph, alt, href });
  });
  return ctas;
}

export interface ImageCtaResolution {
  /**
   * Only a high-confidence picture match is inserted. Missing pixels and
   * near matches are held without consulting any alt text.
   */
  status: 'matched' | 'unverified' | 'below-confidence' | 'unmatched' | 'no-host';
  entry?: ImageLibraryEntry;
  /** Confidence in the picture comparison. */
  confidence?: MatchConfidence;
}

type FingerprintedImage = ImageLibraryEntry | DraftFingerprints[number];
// Share the expensive picture work between conversion and validation. Weak
// keys release removed images; checking fp also handles in-place backfills.
const decodedImages = new WeakMap<FingerprintedImage, { encoded: string | null | undefined; pixels: Uint8Array | null }>();
const pictureDistances = new WeakMap<Uint8Array, WeakMap<Uint8Array, number>>();

function decodedImage(image: FingerprintedImage | undefined): Uint8Array | null {
  if (!image) return null;
  const cached = decodedImages.get(image);
  if (cached && cached.encoded === image.fp) return cached.pixels;
  const pixels = decodeFingerprint(image.fp);
  decodedImages.set(image, { encoded: image.fp, pixels });
  return pixels;
}

/**
 * Decides which saved image a CTA uses. Within the store of the draft link,
 * the picture decides: the closest fingerprint match is taken whatever its
 * alt text says, and only a high-confidence match (inside the calibrated
 * same-image range) is applied. Missing or different pixels never fall back
 * to descriptive text.
 */
export function resolveImageCta(
  cta: Pick<ImageCta, 'src' | 'href'>,
  library: ImageLibraryEntry[],
  draftFingerprints?: DraftFingerprints
): ImageCtaResolution {
  const host = cta.href === null ? null : getStoreHost(cta.href);
  if (cta.href !== null && !host) return { status: 'no-host' };
  const storeEntries = host ? library.filter(entry => entry.host === host) : library;
  if (!storeEntries.length) return { status: 'unmatched' };
  const draftFp = decodedImage(draftFingerprints?.find(image => image.src === cta.src));
  if (!draftFp) return { status: 'unverified' };
  let distances = pictureDistances.get(draftFp);
  if (!distances) {
    distances = new WeakMap();
    pictureDistances.set(draftFp, distances);
  }
  const byPicture = storeEntries
    .map(entry => {
      const pixels = decodedImage(entry);
      if (!pixels) return { entry, distance: Infinity };
      let distance = distances.get(pixels);
      if (distance === undefined) {
        distance = fingerprintDistance(draftFp, pixels);
        distances.set(pixels, distance);
      }
      return { entry, distance };
    })
    .sort((a, b) => a.distance - b.distance)[0];
  if (!Number.isFinite(byPicture.distance)) return { status: 'unverified' };
  const confidence = matchConfidence(byPicture.distance);
  if (!confidence) return { status: 'unmatched' };
  return { status: confidence === 'high' ? 'matched' : 'below-confidence', entry: byPicture.entry, confidence };
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
    const paragraph = cta.image.closest('p');
    if (status !== 'matched' || !entry) {
      cta.image.remove();
      if (paragraph && !paragraphText(paragraph) && !paragraph.querySelector('img, hr')) paragraph.remove();
      return;
    }
    const block = doc.createElement('div');
    block.setAttribute('style', BLOCK_STYLE);
    const image = doc.createElement('img');
    image.setAttribute('src', entry.src);
    image.setAttribute('alt', cta.alt || entry.alt);
    image.setAttribute('style', IMAGE_STYLE);
    if (cta.href === null) {
      // Linkless (the hero): the image stands alone in the block
      block.appendChild(image);
    } else {
      const link = doc.createElement('a');
      // The draft link wins over the link the image had in the earlier article
      link.setAttribute('href', cta.href);
      link.setAttribute('target', '_blank');
      link.setAttribute('rel', 'noopener');
      if (linkAttributes) setLinkAttributes(link);
      link.appendChild(image);
      block.appendChild(link);
    }
    const isolated = paragraph && paragraph.querySelectorAll('img').length === 1 &&
      (!paragraphText(paragraph) || paragraph === cta.altParagraph);
    if (isolated) {
      // Keep the existing label's spacer when it follows an image-only paragraph.
      if (cta.altParagraph && cta.altParagraph !== paragraph) {
        cta.altParagraph.replaceWith(block);
        paragraph.remove();
      } else {
        paragraph.replaceWith(block);
      }
    } else if (cta.image.parentElement === doc.body) {
      cta.image.replaceWith(block);
      cta.altParagraph?.remove();
    } else {
      // Inline, list and table images stay in their original content position.
      image.removeAttribute('style');
      // Keep existing anchors; otherwise retain the generated link without its block wrapper.
      cta.image.replaceWith(cta.image.closest('a[href]') ? image : block.firstElementChild!);
      cta.altParagraph?.remove();
    }
    cta.linkParagraph?.remove();
  });
  return doc.body.innerHTML;
}

/** Explain holds from actual draft images, including images without labels. */
export function getImageCtaIssues(library: ImageLibraryEntry[], draftFingerprints: DraftFingerprints = []): string[] {
  const issues: string[] = [];
  draftFingerprints.forEach((image, index) => {
    const { status } = resolveImageCta(image, library, draftFingerprints);
    if (status === 'matched') return;
    const host = image.href === null ? null : getStoreHost(image.href);
    const name = `Image ${index + 1}${host ? ` on ${host}` : ''}`;
    issues.push(status === 'unverified' ? `${name}: picture could not be verified; image not applied`
      : status === 'below-confidence' ? `${name}: picture match is not exact; image not applied`
      : status === 'no-host' ? `${name}: link has no store domain; image not applied`
      : `${name}: no saved picture matches; image not applied`);
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
