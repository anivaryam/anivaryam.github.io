import DOMPurify from 'dompurify';
import { LIST_STYLE_TYPES } from './html-sanitizer';
import { SPACER_MARKER_ATTRIBUTE, stripSpacerMarkers } from './spacer';

export const PREVIEW_SANITIZE_CONFIG = { ADD_ATTR: ['target'], FORBID_TAGS: ['script', 'style', 'iframe', 'object', 'embed'] };
export const PREVIEW_LIST_TYPE_ATTRIBUTE = 'data-w2h-list-type';

// HTML's `type` selector is case-insensitive in Chromium, while A/a and I/i
// have different meanings. A preview-only data attribute preserves that case.
const listStyles = Object.entries(LIST_STYLE_TYPES).filter(([, type], index, entries) =>
  entries.findIndex(([, candidate]) => candidate === type) === index
);
export const ORDERED_LIST_PREVIEW_CSS = listStyles.map(([style, type]) =>
  `.output-preview ol[${PREVIEW_LIST_TYPE_ATTRIBUTE}="${type}"] { list-style-type: ${style}; }`
).join('\n');

/** Decorate presentation only; exported conversion HTML is never changed. */
export function preparePreviewHtml(html: string): string {
  const doc = new DOMParser().parseFromString(html, 'text/html');
  // Ordinary output was already sanitized by conversion. Sanitize only the
  // inserted, opt-in-raw spacers so harmless source nodes/comments stay intact.
  doc.querySelectorAll(`[${SPACER_MARKER_ATTRIBUTE}]`).forEach(spacer => {
    const safe = DOMPurify.sanitize(spacer.outerHTML, PREVIEW_SANITIZE_CONFIG);
    const range = doc.createRange();
    range.selectNode(spacer);
    spacer.replaceWith(range.createContextualFragment(safe));
  });
  doc.querySelectorAll('ol[type]').forEach(list => {
    list.setAttribute(PREVIEW_LIST_TYPE_ATTRIBUTE, list.getAttribute('type')!);
  });
  return stripSpacerMarkers(doc.body.innerHTML);
}

/** Preview-only attributes must never escape through native selection copy. */
export function removePreviewAttributes(root: ParentNode): void {
  root.querySelectorAll(`[data-warning], [${PREVIEW_LIST_TYPE_ATTRIBUTE}]`).forEach(element => {
    element.removeAttribute('data-warning');
    element.removeAttribute(PREVIEW_LIST_TYPE_ATTRIBUTE);
  });
}
