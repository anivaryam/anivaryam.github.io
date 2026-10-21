import { createSpacerElement, isCustomSpacerElement, markSpacerElement, parseCustomSpacer, type CustomSpacer } from './spacer';

/** Recognize blank Word paragraphs even when whitespace is wrapped in formatting. */
export function isSpacingParagraph(element: Element | null): boolean {
  return !!element && element.tagName.toLowerCase() === 'p' &&
    !(element.textContent || '').trim() && !element.querySelector('img, hr');
}

export function isBrSpacingParagraph(element: Element | null): boolean {
  return isSpacingParagraph(element) && !!element?.querySelector('br');
}

/**
 * True for the default `<p>&nbsp;</p>` spacer and for a configured custom
 * spacer. Conversion still emits the default spacer; validation and
 * formatting meet the custom markup in the finished output.
 */
export function isSpacerElement(element: Element | null, spacer: CustomSpacer): boolean {
  if (isSpacingParagraph(element)) return true;
  return isCustomSpacerElement(element, spacer);
}

/** The default spacer paragraph, excluding the opt-in BR spacer. */
function isDefaultSpacerParagraph(element: Element): boolean {
  return isSpacingParagraph(element) && !isBrSpacingParagraph(element);
}

/**
 * Replace the default spacer markup with the configured custom spacer.
 *
 * Only the blank paragraphs produced by the spacing rules are swapped; BR
 * spacers (`<p><br></p>`) are an explicit opt in and stay untouched. Markup
 * that is not a single element leaves the default spacer in place.
 */
export function applyCustomSpacer(html: string, customSpacer?: string | null): string {
  const spacer = parseCustomSpacer(customSpacer);
  if (!spacer.root || !html) return html;

  try {
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');
    const template = createSpacerElement(doc, spacer);
    if (!template) return html;

    // The marker identifies the spacer instances this tool inserted, so the
    // sanitizer exemption can be scoped to them instead of to every element
    // that matches the configured markup.
    markSpacerElement(template);

    doc.querySelectorAll('p').forEach(p => {
      if (!isDefaultSpacerParagraph(p)) return;
      if (p.closest('pre, code')) return;
      p.replaceWith(template.cloneNode(true));
    });

    return doc.body.innerHTML;
  } catch (e) {
    console.warn('Custom spacer replacement failed:', e);
    return html;
  }
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
