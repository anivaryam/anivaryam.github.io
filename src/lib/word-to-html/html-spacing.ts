/** Recognize blank Word paragraphs even when whitespace is wrapped in formatting. */
export function isSpacingParagraph(element: Element | null): boolean {
  return !!element && element.tagName.toLowerCase() === 'p' &&
    !(element.textContent || '').trim() && !element.querySelector('img, hr');
}

export function isBrSpacingParagraph(element: Element | null): boolean {
  return isSpacingParagraph(element) && !!element?.querySelector('br');
}

/** Skip Word's blank paragraphs and standalone line-break spacers. */
export function nextNonSpacingElement(from: Element): Element | null {
  let next = from.nextSibling;
  while (next) {
    if (next.nodeType === Node.TEXT_NODE && next.textContent?.trim()) return null;
    if (next.nodeType === Node.ELEMENT_NODE) {
      const element = next as Element;
      if (!isSpacingParagraph(element) && element.tagName.toLowerCase() !== 'br') return element;
    }
    next = next.nextSibling;
  }
  return null;
}

/** Input spacing is discarded before mode-specific spacing is generated. */
export function removeSpacingParagraphs(element: Element): void {
  element.querySelectorAll('p').forEach(p => {
    if (isSpacingParagraph(p)) p.remove();
  });
}

/** Discard layout breaks without joining the text on their two sides. */
export function removeLayoutBreaks(element: Element): void {
  element.querySelectorAll('br').forEach(br => {
    br.replaceWith(element.ownerDocument.createTextNode(br.closest('pre') ? '\n' : ' '));
  });
}
