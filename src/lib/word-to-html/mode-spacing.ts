/**
 * Mode Utility: Spacing Rules
 * Adds <p>&nbsp;</p> spacing elements in specific locations
 */

import { isSpacingParagraph as isSpacingElement } from './html-spacing';

function addSpacingAfterKeyTakeaways(doc: Document): void {
  const headings = Array.from(doc.querySelectorAll('h2'));
  let keyTakeawaysHeading: Element | null = null;
  
  for (const heading of headings) {
    const text = heading.textContent?.trim() || '';
    if (text.toLowerCase().includes('key takeaways')) {
      keyTakeawaysHeading = heading;
      break;
    }
  }
  
  if (keyTakeawaysHeading) {
    let nextSibling = keyTakeawaysHeading.nextElementSibling;
    while (nextSibling && nextSibling.tagName.toLowerCase() !== 'ul') {
      nextSibling = nextSibling.nextElementSibling;
    }
    
    if (nextSibling && nextSibling.tagName.toLowerCase() === 'ul') {
      const elementAfterUl = nextSibling.nextElementSibling;
      const hasExistingSpacing = elementAfterUl && isSpacingElement(elementAfterUl);
      if (hasExistingSpacing) {
        return;
      }
      
      const spacing = doc.createElement('p');
      spacing.textContent = '\u00A0';
      const parentNode = nextSibling.parentNode;
      if (parentNode) {
        if (elementAfterUl) {
          parentNode.insertBefore(spacing, elementAfterUl);
        } else {
          parentNode.appendChild(spacing);
        }
      }
    }
  }
}

/** One rule source for conversion, validation, and preview highlighting. */
export function getHeadingSpacingIssues(doc: Document): {
  element: Element;
  kind: 'missing' | 'unexpected';
  message: string;
}[] {
  const issues: ReturnType<typeof getHeadingSpacingIssues> = [];
  let awaitingFirstFaqQuestion = false;
  for (const heading of Array.from(doc.querySelectorAll('h1, h2, h3, h4, h5, h6'))) {
    const text = heading.textContent?.trim() || '';
    const lowerText = text.toLowerCase();
    const tag = heading.tagName.toLowerCase();
    if (tag === 'h1' || tag === 'h2') {
      awaitingFirstFaqQuestion = lowerText.includes('faq') || lowerText.includes('frequently asked questions');
    }
    const previous = heading.previousElementSibling;
    if (awaitingFirstFaqQuestion && tag === 'h3') {
      awaitingFirstFaqQuestion = false;
      if (isSpacingElement(previous) || previous?.tagName === 'BR') {
        issues.push({ element: heading, kind: 'unexpected', message: `Unexpected spacing before first FAQ question: "${text.substring(0, 30)}..."` });
      }
      continue;
    }
    if (lowerText.includes('key takeaways') || !previous) continue;
    if (!isSpacingElement(previous)) {
      issues.push({ element: heading, kind: 'missing', message: `Missing spacing before heading: "${text.substring(0, 30)}..."` });
    }
  }
  return issues;
}

function addSpacingBeforeHeadings(doc: Document): void {
  for (const issue of getHeadingSpacingIssues(doc)) {
    if (issue.kind === 'unexpected') {
      let previous = issue.element.previousElementSibling;
      while (previous && (isSpacingElement(previous) || previous.tagName === 'BR')) {
        const nextPrevious = previous.previousElementSibling;
        previous.remove();
        previous = nextPrevious;
      }
    } else {
      const spacing = doc.createElement('p');
      spacing.innerHTML = '&nbsp;';
      issue.element.before(spacing);
    }
  }
}

function addSpacingBeforeReadSection(doc: Document): void {
  const paragraphs = doc.querySelectorAll('p');
  
  paragraphs.forEach(p => {
    const text = p.textContent?.trim().toLowerCase() || '';
    if (text.includes('read also') || 
        text.includes('read more') || 
        text.includes('see more')) {
      
      const prevSibling = p.previousElementSibling;
      if (prevSibling && isSpacingElement(prevSibling)) {
        return;
      }
      
      let node = p.previousSibling;
      while (node && node.nodeType === Node.TEXT_NODE && !(node as Text).textContent?.trim()) {
        node = node.previousSibling;
      }
      if (node && node.nodeType === Node.ELEMENT_NODE && isSpacingElement(node as Element)) {
        return;
      }
      
      const spacing = doc.createElement('p');
      spacing.innerHTML = '&nbsp;';
      const pParent = p.parentNode;
      if (pParent) {
        pParent.insertBefore(spacing, p);
      }
    }
  });
}

function addSpacingBeforeSources(doc: Document): void {
  const paragraphs = doc.querySelectorAll('p');
  
  paragraphs.forEach(p => {
    const text = p.textContent?.trim().toLowerCase() || '';
    if (text === 'sources' || text === 'sources:' || text.startsWith('sources:')) {
      
      const prevSibling = p.previousElementSibling;
      const hasExistingSpacing = prevSibling && isSpacingElement(prevSibling);
      if (hasExistingSpacing) {
        return;
      }
      
      let node = p.previousSibling;
      while (node && node.nodeType === Node.TEXT_NODE && !(node as Text).textContent?.trim()) {
        node = node.previousSibling;
      }
      if (node && node.nodeType === Node.ELEMENT_NODE && isSpacingElement(node as Element)) {
        return;
      }
      
      const spacing = doc.createElement('p');
      spacing.innerHTML = '&nbsp;';
      const pParent = p.parentNode;
      if (pParent) {
        pParent.insertBefore(spacing, p);
      }
    }
  });
}

function addSpacingBeforeDisclaimer(doc: Document): void {
  const paragraphs = doc.querySelectorAll('p');
  
  paragraphs.forEach(p => {
    const text = p.textContent?.trim().toLowerCase() || '';
    if (text.startsWith('disclaimer')) {
      
      const prevSibling = p.previousElementSibling;
      const hasExistingSpacing = prevSibling && isSpacingElement(prevSibling);
      if (hasExistingSpacing) {
        return;
      }
      
      let node = p.previousSibling;
      while (node && node.nodeType === Node.TEXT_NODE && !(node as Text).textContent?.trim()) {
        node = node.previousSibling;
      }
      if (node && node.nodeType === Node.ELEMENT_NODE && isSpacingElement(node as Element)) {
        return;
      }
      
      const spacing = doc.createElement('p');
      spacing.innerHTML = '&nbsp;';
      const pParent = p.parentNode;
      if (pParent) {
        pParent.insertBefore(spacing, p);
      }
    }
  });
}

function addSpacingBeforeAltImageText(doc: Document): void {
  const paragraphs = doc.querySelectorAll('p');

  paragraphs.forEach(p => {
    const text = p.textContent?.trim().toLowerCase() || '';
    if (text.includes('alt image text:')) {

      const prevSibling = p.previousElementSibling;
      const hasExistingSpacing = prevSibling && isSpacingElement(prevSibling);
      if (hasExistingSpacing) {
        return;
      }

      let node = p.previousSibling;
      while (node && node.nodeType === Node.TEXT_NODE && !(node as Text).textContent?.trim()) {
        node = node.previousSibling;
      }
      if (node && node.nodeType === Node.ELEMENT_NODE && isSpacingElement(node as Element)) {
        return;
      }

      const spacing = doc.createElement('p');
      spacing.innerHTML = '&nbsp;';
      const pParent = p.parentNode;
      if (pParent) {
        pParent.insertBefore(spacing, p);
      }
    }
  });
}

/**
 * Adds spacing between consecutive paragraphs (p + p).
 * Inserts <p>&nbsp;</p> between two paragraphs that are direct siblings.
 */
export function addSpacingBetweenParagraphs(doc: Document): void {
  const paragraphs = doc.querySelectorAll('p');

  // Process in reverse order to avoid index shifting issues when inserting
  const pArray = Array.from(paragraphs);

  for (let i = pArray.length - 1; i >= 0; i--) {
    const p = pArray[i];

    // Skip empty/spacing paragraphs
    if (isSpacingElement(p)) {
      continue;
    }

    const parent = p.parentNode;
    if (!parent) continue;

    const pIndex = Array.from(parent.children).indexOf(p);

    // Check if next sibling is also a paragraph
    if (pIndex < parent.children.length - 1) {
      const nextSibling = parent.children[pIndex + 1];

      if (nextSibling && (nextSibling as Element).tagName?.toLowerCase() === 'p') {
        const nextP = nextSibling as Element;

        // Skip if next paragraph is already a spacing element
        if (isSpacingElement(nextP)) {
          continue;
        }

        // Insert spacing paragraph before the next paragraph
        const spacing = doc.createElement('p');
        spacing.innerHTML = '&nbsp;';
        parent.insertBefore(spacing, nextSibling);
      }
    }
  }
}

export function addSpacing(html: string): string {
  if (!html || typeof html !== 'string') {
    return '';
  }

  try {
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');
    
    addSpacingBeforeAltImageText(doc);
    addSpacingBeforeDisclaimer(doc);
    addSpacingBeforeSources(doc);
    addSpacingBeforeReadSection(doc);
    addSpacingBeforeHeadings(doc);
    addSpacingAfterKeyTakeaways(doc);

    return doc.body.innerHTML;
  } catch (e) {
    console.warn('Spacing addition failed:', e);
    return html;
  }
}
