/**
 * Mode Utility: Disclaimer Normalization
 * Wraps the Disclaimer label in <strong><em>Disclaimer:</em></strong>,
 * mirroring the Sources normalization format.
 *
 * Preserves surrounding child structure (e.g. <em> wrapping the body)
 * and ensures a single space between the label and the body.
 */

const LABEL_PATTERN = /^\s*Disclaimer\s*:/i;
const LABEL_TEXT = 'Disclaimer:';
// A label on its own line may omit the colon; it still opens the section.
const SECTION_START_PATTERN = /^\s*Disclaimer\s*(?::|$)/i;

/**
 * The paragraph this normalizer rewrites: it starts with the "Disclaimer:"
 * label. Shared with validation and preview highlighting, so a body sentence
 * such as "Disclaimers vary by state." is never treated as the label.
 */
export function isDisclaimerParagraph(element: Element | null): boolean {
  return element?.tagName.toLowerCase() === 'p' && LABEL_PATTERN.test(element.textContent || '');
}

/** The paragraph that opens a Disclaimer section, which spacing separates. */
export function isDisclaimerSectionStart(element: Element | null): boolean {
  return element?.tagName.toLowerCase() === 'p' && SECTION_START_PATTERN.test(element.textContent || '');
}

function findDisclaimerParagraphs(doc: Document): Element[] {
  return Array.from(doc.querySelectorAll('p')).filter(isDisclaimerParagraph);
}

function isAlreadyNormalized(paragraph: Element, labelText: string): boolean {
  const strong = paragraph.querySelector(':scope > strong');
  if (!strong) return false;
  const em = strong.querySelector(':scope > em');
  if (!em) return false;
  return em.textContent?.trim().toLowerCase() === labelText.toLowerCase();
}

function bodyStartsWithWhitespace(node: Node | undefined): boolean {
  if (!node) return false;
  const text = node.textContent || '';
  return text.length > 0 && /^\s/.test(text);
}

/**
 * Walk `el`'s children and return a clone of `el` containing only
 * the content that comes after `labelEndInEl` chars of text.
 * If the resulting clone is empty, returns null.
 */
function splitElementAfterLabel(
  el: Element,
  labelEndInEl: number,
  doc: Document
): Element | null {
  const newContainer = doc.createElement(el.tagName);
  for (const attr of Array.from(el.attributes)) {
    newContainer.setAttribute(attr.name, attr.value);
  }

  let charsSeen = 0;
  let splitDone = false;
  let hasContent = false;

  for (const child of Array.from(el.childNodes)) {
    if (splitDone) {
      newContainer.appendChild(child.cloneNode(true));
      if ((child.textContent || '').trim()) hasContent = true;
      continue;
    }

    if (child.nodeType === Node.TEXT_NODE) {
      const text = child.textContent || '';
      const childLen = text.length;

      if (charsSeen + childLen <= labelEndInEl) {
        charsSeen += childLen;
        continue;
      }

      if (charsSeen >= labelEndInEl) {
        newContainer.appendChild(doc.createTextNode(text));
        if (text.trim()) hasContent = true;
        splitDone = true;
        continue;
      }

      const splitOffset = labelEndInEl - charsSeen;
      const afterLabel = text.slice(splitOffset);
      if (afterLabel) {
        newContainer.appendChild(doc.createTextNode(afterLabel));
        if (afterLabel.trim()) hasContent = true;
      }
      charsSeen += childLen;
      splitDone = true;
    } else if (child.nodeType === Node.ELEMENT_NODE) {
      const childEl = child as Element;
      const childText = childEl.textContent || '';
      const childLen = childText.length;

      if (!childText.trim()) {
        charsSeen += childLen;
        continue;
      }

      if (charsSeen + childLen <= labelEndInEl) {
        charsSeen += childLen;
        continue;
      }

      if (charsSeen >= labelEndInEl) {
        newContainer.appendChild(childEl.cloneNode(true));
        hasContent = true;
        splitDone = true;
        continue;
      }

      const after = splitElementAfterLabel(childEl, labelEndInEl - charsSeen, doc);
      if (after) {
        newContainer.appendChild(after);
        hasContent = true;
      }
      charsSeen += childLen;
      splitDone = true;
    }
  }

  return hasContent ? newContainer : null;
}

// Sources uses the same label/body splitting to preserve inline citations.
export function normalizeSectionLabel(
  paragraph: Element,
  doc: Document,
  labelText: string,
  labelPattern: RegExp
): void {
  if (isAlreadyNormalized(paragraph, labelText)) return;

  const fullText = paragraph.textContent || '';
  const match = fullText.match(labelPattern);
  if (!match) return;
  const labelEndIdx = match[0].length;

  const remainingNodes: Node[] = [];
  let charsSeen = 0;
  let splitDone = false;

  for (const child of Array.from(paragraph.childNodes)) {
    if (splitDone) {
      remainingNodes.push(child.cloneNode(true));
      continue;
    }

    if (child.nodeType === Node.TEXT_NODE) {
      const text = child.textContent || '';
      const childLen = text.length;

      if (charsSeen + childLen <= labelEndIdx) {
        charsSeen += childLen;
        continue;
      }

      if (charsSeen >= labelEndIdx) {
        remainingNodes.push(doc.createTextNode(text));
        splitDone = true;
        continue;
      }

      const splitOffset = labelEndIdx - charsSeen;
      const afterLabel = text.slice(splitOffset);
      if (afterLabel) {
        remainingNodes.push(doc.createTextNode(afterLabel));
      }
      charsSeen += childLen;
      splitDone = true;
    } else if (child.nodeType === Node.ELEMENT_NODE) {
      const el = child as Element;
      const elText = el.textContent || '';
      const elLen = elText.length;

      if (!elText.trim()) {
        charsSeen += elLen;
        continue;
      }

      if (charsSeen + elLen <= labelEndIdx) {
        charsSeen += elLen;
        continue;
      }

      if (charsSeen >= labelEndIdx) {
        remainingNodes.push(el.cloneNode(true));
        splitDone = true;
        continue;
      }

      const after = splitElementAfterLabel(el, labelEndIdx - charsSeen, doc);
      if (after) {
        remainingNodes.push(after);
      }
      charsSeen += elLen;
      splitDone = true;
    }
  }

  paragraph.innerHTML = '';

  const strong = doc.createElement('strong');
  const em = doc.createElement('em');
  em.textContent = labelText;
  strong.appendChild(em);
  paragraph.appendChild(strong);

  if (remainingNodes.length > 0 && !bodyStartsWithWhitespace(remainingNodes[0])) {
    paragraph.appendChild(doc.createTextNode(' '));
  }

  for (const node of remainingNodes) {
    paragraph.appendChild(node);
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
    paragraphs.forEach((p) => normalizeSectionLabel(p, doc, LABEL_TEXT, LABEL_PATTERN));

    return doc.body.innerHTML;
  } catch (e) {
    console.warn('Disclaimer normalization failed:', e);
    return html;
  }
}
