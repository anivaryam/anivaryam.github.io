/**
 * Wrap Links Strong & Underline
 *
 * Wraps the text content of every non-alt-text <a> in <strong><u>...</u></strong>.
 *
 * Skipped anchors:
 *  - Anchors that wrap an <img> element (image links).
 *  - Anchors inside a <p> whose trimmed lowercased text starts with
 *    "alt image text:" — mirrors the existing reliable detection used by
 *    validator.ts (validateSpecialParagraphSpacing).
 */

export function wrapLinksStrongUnderline(html: string): string {
  if (!html || typeof html !== 'string') {
    return '';
  }

  try {
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');

    const anchors = Array.from(doc.querySelectorAll('a[href]'));

    anchors.forEach((anchor) => {
      if (isImageLink(anchor)) return;
      if (isInsideAltImageTextParagraph(anchor)) return;
      wrapAnchorContents(anchor, doc);
    });

    return doc.body.innerHTML;
  } catch (e) {
    console.warn('wrapLinksStrongUnderline failed:', e);
    return html;
  }
}

function isImageLink(anchor: Element): boolean {
  return anchor.querySelector('img') !== null;
}

/**
 * Mirrors the prefix check used by validator.ts's
 * validateSpecialParagraphSpacing (the same reliable detection pinned by the
 * D11 test cases — exact prefix only, not substring).
 */
function isInsideAltImageTextParagraph(anchor: Element): boolean {
  let parent = anchor.parentElement;
  while (parent) {
    if (parent.tagName.toLowerCase() === 'p') {
      const text = (parent.textContent || '').trim().toLowerCase();
      return text.startsWith('alt image text:');
    }
    parent = parent.parentElement;
  }
  return false;
}

function wrapAnchorContents(anchor: Element, doc: Document): void {
  if (anchor.childNodes.length === 0) return;

  /* Idempotency guard: if every text node is already inside a <strong><u>,
   * skip. Mirrors the validator's expectations. */
  if (anchor.querySelector(':scope > strong > u') && hasOnlyWrappedContent(anchor)) {
    return;
  }

  // The option makes the entire link bold and underlined. Existing copies of
  // those wrappers are redundant, but other emphasis and all text must remain.
  for (const wrapper of Array.from(anchor.querySelectorAll('strong, u')).reverse()) {
    wrapper.replaceWith(...Array.from(wrapper.childNodes));
  }
  const children = Array.from(anchor.childNodes);

  const strong = doc.createElement('strong');
  const u = doc.createElement('u');

  /* appendChild MOVES nodes (works for both Text and Element). Do not clone
   * text nodes here — earlier versions created new text nodes via
   * createTextNode, which left the originals in the anchor and produced
   * duplicated / partially-wrapped link text. */
  children.forEach((node) => {
    u.appendChild(node);
  });

  strong.appendChild(u);
  anchor.appendChild(strong);
}

function hasOnlyWrappedContent(anchor: Element): boolean {
  const strong = anchor.firstElementChild;
  return anchor.childNodes.length === 1 && strong?.tagName.toLowerCase() === 'strong' &&
    strong.childNodes.length === 1 && strong.firstElementChild?.tagName.toLowerCase() === 'u' &&
    anchor.querySelectorAll('strong, u').length === 2;
}
