/**
 * Custom Spacer
 *
 * Spacing rules emit `<p>&nbsp;</p>` by default. A custom spacer replaces that
 * markup with user supplied HTML, for example `<div style="height:10px;"></div>`.
 *
 * The conversion pipeline still builds the default spacer and swaps it at the
 * end of the mode run, so spacing rules keep working on a single shape. The
 * helpers below let validation and formatting recognize the configured markup
 * wherever the default spacer is recognized.
 */

import DOMPurify from 'dompurify';

/** Markup used when no custom spacer is configured. */
export const DEFAULT_SPACER_HTML = '<p>&nbsp;</p>';

/**
 * Attribute that marks the spacer instances the converter inserted.
 *
 * The marker is the single source of truth for "the tool inserted this
 * spacer". It scopes the sanitizer exemption to the inserted spacer instead
 * of to every element that happens to match the configured markup, and it
 * keeps the spacer recognizable after the markup has been serialized.
 */
export const SPACER_MARKER_ATTRIBUTE = 'data-w2h-spacer';

/** Value of the spacer marker attribute. */
export const SPACER_MARKER_VALUE = '1';

/** Elements that run or load code when the output is rendered. */
const DANGEROUS_SPACER_TAGS = new Set(['script', 'style', 'iframe', 'object', 'embed']);

/** URL schemes that can run code when the markup is rendered. */
const DANGEROUS_URL_SCHEMES = ['javascript:', 'data:'];

/** Parsed custom spacer markup shared by the detection helpers. */
export interface CustomSpacer {
  /** Configured markup, trimmed. Empty means the default spacer applies. */
  html: string;
  /** Parsed spacer root, or null when no usable custom spacer is configured. */
  root: Element | null;
}

/**
 * Parse the configured spacer markup.
 *
 * Only a single element root is accepted; markup with extra siblings is
 * rejected so a spacer stays one replaceable element.
 */
export function parseCustomSpacer(customSpacer?: string | null): CustomSpacer {
  const html = typeof customSpacer === 'string' ? customSpacer.trim() : '';
  if (!html) return { html: '', root: null };

  const parsed = new DOMParser().parseFromString(html, 'text/html');
  const root = parsed.body.firstElementChild;
  if (!root || root.nextElementSibling) return { html, root: null };
  return { html, root };
}

/** Mark an element as the spacer the converter inserted. */
export function markSpacerElement(element: Element): void {
  element.setAttribute(SPACER_MARKER_ATTRIBUTE, SPACER_MARKER_VALUE);
}

/** True when the element carries the converter's spacer marker. */
export function isMarkedSpacerElement(element: Element | null): boolean {
  return !!element && element.getAttribute(SPACER_MARKER_ATTRIBUTE) === SPACER_MARKER_VALUE;
}

/**
 * True when the element is a custom spacer.
 *
 * The marker recognizes the spacers the converter inserted. The markup
 * comparison keeps the recognition working for markup that carries no
 * marker, so the spacing rules keep their current verdicts.
 */
export function isCustomSpacerElement(element: Element | null, spacer: CustomSpacer): boolean {
  if (!element) return false;
  if (isMarkedSpacerElement(element)) return true;
  if (!spacer.root) return false;
  return element.outerHTML === spacer.root.outerHTML;
}

/**
 * True when the element is a spacer the converter inserted, or lives inside
 * one.
 *
 * Only the marker counts here. The sanitizer exemption must cover the spacer
 * the tool inserted, not every element that happens to match the configured
 * markup, so a hand written element stays subject to the allowlist.
 */
export function isWithinInsertedSpacer(element: Element): boolean {
  let current: Element | null = element;
  while (current) {
    if (isMarkedSpacerElement(current)) return true;
    current = current.parentElement;
  }
  return false;
}

/** Build a spacer element owned by `doc` from the configured markup. */
export function createSpacerElement(doc: Document, spacer: CustomSpacer): Element | null {
  if (!spacer.root) return null;
  return doc.importNode(spacer.root, true) as Element;
}

/**
 * Describe the dangerous constructs in the configured spacer markup.
 *
 * Only genuinely dangerous constructs are reported. A tag or attribute that
 * is outside the tool's sanitizer allowlist is not dangerous by itself, so
 * ordinary spacer markup such as `<div style="height:10px;"></div>` stays
 * warning free.
 */
export function getCustomSpacerWarnings(markup?: string | null): string[] {
  const html = typeof markup === 'string' ? markup.trim() : '';
  if (!html) return [];

  let doc: Document;
  try {
    doc = new DOMParser().parseFromString(html, 'text/html');
  } catch (e) {
    console.warn('Custom spacer inspection failed:', e);
    return [];
  }

  const warnings: string[] = [];
  for (const element of [doc.body, ...Array.from(doc.body.querySelectorAll('*'))]) {
    const tag = element.tagName.toLowerCase();
    if (DANGEROUS_SPACER_TAGS.has(tag)) {
      warnings.push(`<${tag}> can run code when the output is rendered`);
    }
    for (const attribute of Array.from(element.attributes)) {
      const name = attribute.name.toLowerCase();
      if (name.startsWith('on')) {
        warnings.push(`the ${name} event handler runs code when the output is rendered`);
        continue;
      }
      if ((name === 'href' || name === 'src') && hasDangerousScheme(attribute.value)) {
        warnings.push(`the ${name} URL uses a scheme that can run code`);
      }
    }
  }
  return warnings;
}

/**
 * Run the configured markup through DOMPurify.
 *
 * The opt-in control uses this before the markup reaches the pipeline. The
 * markup is only changed when the user asks for it, so the default behaviour
 * stays verbatim.
 */
export function sanitizeCustomSpacerMarkup(markup?: string | null): string {
  const html = typeof markup === 'string' ? markup.trim() : '';
  if (!html) return '';

  try {
    return DOMPurify.sanitize(html);
  } catch (e) {
    console.warn('Custom spacer sanitizing failed:', e);
    return html;
  }
}

/** True when the URL uses a scheme that can run code. */
function hasDangerousScheme(url: string): boolean {
  // Browsers ignore control characters inside a URL and trim its whitespace.
  const normalized = Array.from(url)
    .filter(character => character.charCodeAt(0) > 0x20)
    .join('')
    .toLowerCase();
  return DANGEROUS_URL_SCHEMES.some(scheme => normalized.startsWith(scheme));
}
