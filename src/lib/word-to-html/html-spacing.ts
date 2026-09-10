/** Recognize blank Word paragraphs even when whitespace is wrapped in formatting. */
export function isSpacingParagraph(element: Element | null): boolean {
  return !!element && element.tagName.toLowerCase() === 'p' &&
    !(element.textContent || '').trim() && !element.querySelector('img, hr');
}

export function isBrSpacingParagraph(element: Element | null): boolean {
  return isSpacingParagraph(element) && !!element?.querySelector('br');
}

/** Input spacing is discarded before mode-specific spacing is generated. */
export function removeSpacingParagraphs(element: Element): void {
  element.querySelectorAll('p').forEach(p => {
    if (isSpacingParagraph(p)) p.remove();
  });
}
