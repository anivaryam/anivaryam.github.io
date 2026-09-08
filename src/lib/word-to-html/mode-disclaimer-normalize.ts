/**
 * Mode Utility: Disclaimer Normalization
 * Wraps the Disclaimer label in <strong><em>Disclaimer:</em></strong>,
 * mirroring the Sources normalization format.
 *
 * Handles three input shapes:
 *   1. <p>Disclaimer: body...</p>
 *   2. <p><em>Disclaimer: body...</em></p>
 *   3. <p><em>Disclaimer:</em> body...</p>
 *
 * In all cases the output is:
 *   <p><strong><em>Disclaimer:</em></strong>[body]</p>
 */

const LABEL_PATTERN = /^\s*Disclaimer\s*:\s*/i;
const LABEL_TEXT = 'Disclaimer:';

function findDisclaimerParagraphs(doc: Document): Element[] {
  const paragraphs = Array.from(doc.querySelectorAll('p'));
  return paragraphs.filter((p) => {
    const text = p.textContent?.trim() || '';
    return text.toLowerCase().startsWith('disclaimer');
  });
}

function isAlreadyNormalized(paragraph: Element): boolean {
  const strong = paragraph.querySelector(':scope > strong');
  if (!strong) return false;
  const em = strong.querySelector(':scope > em');
  if (!em) return false;
  return em.textContent?.trim().toLowerCase() === 'disclaimer:';
}

function normalizeDisclaimerParagraph(paragraph: Element, doc: Document): void {
  if (isAlreadyNormalized(paragraph)) return;

  const fullText = paragraph.textContent || '';
  if (!LABEL_PATTERN.test(fullText)) return;

  const bodyText = fullText.replace(LABEL_PATTERN, '');

  paragraph.innerHTML = '';

  const strong = doc.createElement('strong');
  const em = doc.createElement('em');
  em.textContent = LABEL_TEXT;
  strong.appendChild(em);
  paragraph.appendChild(strong);

  if (bodyText) {
    paragraph.appendChild(doc.createTextNode(bodyText));
  }
}

export function normalizeDisclaimer(html: string): string {
  if (!html || typeof html !== 'string') {
    return '';
  }

  try {
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');

    const paragraphs = findDisclaimerParagraphs(doc);
    paragraphs.forEach((p) => normalizeDisclaimerParagraph(p, doc));

    return doc.body.innerHTML;
  } catch (e) {
    console.warn('Disclaimer normalization failed:', e);
    return html;
  }
}
