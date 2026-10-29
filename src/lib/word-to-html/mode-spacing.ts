/**
 * Mode Utility: Spacing Rules
 * Adds <p>&nbsp;</p> spacing elements in specific locations
 */

import { isSpacingParagraph as isSpacingElement, isSpacerElement } from './html-spacing';
import { createSpacerElement, markSpacerElement, parseCustomSpacer } from './spacer';
import { isFullyBoldElement } from './html-sanitizer';
import { isBlankBlockText } from './html-cleaner';
import { findKeyTakeawaysSection } from './mode-key-takeaways';
import { findSourcesSections, isSourcesLabel } from './mode-sources-section';
import { isReadMoreParagraph } from './mode-br-spacing';
import { isDisclaimerSectionStart } from './mode-disclaimer-normalize';
import { isAltLabelParagraph } from './image-library';

function addSpacingAfterKeyTakeaways(doc: Document): void {
  const section = findKeyTakeawaysSection(doc);
  if (!section || isSpacingElement(section.list.nextElementSibling)) return;
  const spacing = doc.createElement('p');
  spacing.textContent = '\u00A0';
  section.list.after(spacing);
}

/** One rule source for conversion, validation, and preview highlighting. */
export function getHeadingSpacingIssues(doc: Document, customSpacer?: string): {
  element: Element;
  kind: 'missing' | 'unexpected';
  message: string;
}[] {
  const issues: ReturnType<typeof getHeadingSpacingIssues> = [];
  const spacer = parseCustomSpacer(customSpacer);
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
      if (isSpacerElement(previous, spacer) || previous?.tagName === 'BR') {
        issues.push({ element: heading, kind: 'unexpected', message: `Unexpected spacing before first FAQ question: "${text.substring(0, 30)}..."` });
      }
      continue;
    }
    if (lowerText.includes('key takeaways') || !previous) continue;
    // Only whitespace/comments may separate adjacent headings, never body text or elements.
    let node = heading.previousSibling;
    while (node && (node.nodeType === Node.COMMENT_NODE ||
      (node.nodeType === Node.TEXT_NODE && !node.textContent?.trim()))) {
      node = node.previousSibling;
    }
    if (node?.nodeType === Node.ELEMENT_NODE && /^h[1-6]$/i.test((node as Element).tagName)) continue;
    if (!isSpacerElement(previous, spacer)) {
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

/** Shared missing-gap decision on the final, semantically normalized paragraphs. */
export function getBoldParagraphSpacingIssues(doc: Document, customSpacer?: string): { element: Element; message: string }[] {
  const spacer = parseCustomSpacer(customSpacer);
  // Text-bearing settings keep legacy spacing, without generic bold-P gaps or
  // an input-cleaning exemption to recover their identity after normalization.
  if (spacer.root && !isBlankBlockText(spacer.root.textContent || '')) return [];
  const issues: ReturnType<typeof getBoldParagraphSpacingIssues> = [];
  for (const p of Array.from(doc.querySelectorAll('p'))) {
    if (p.closest('td, th, pre, code') || isBlankBlockText(p.textContent || '') || !isFullyBoldElement(p)) continue;
    // Spacer roots and their descendants are layout content, even if fully bold.
    let ancestor: Element | null = p;
    while (ancestor && !isSpacerElement(ancestor, spacer)) ancestor = ancestor.parentElement;
    if (ancestor) continue;
    let node = p.previousSibling;
    while (node && (node.nodeType === Node.COMMENT_NODE ||
      (node.nodeType === Node.TEXT_NODE && !node.textContent?.trim()))) {
      node = node.previousSibling;
    }
    if (node?.nodeType === Node.ELEMENT_NODE &&
      (isSpacerElement(node as Element, spacer) || isSpacingElement(node as Element, isBlankBlockText))) continue;
    issues.push({ element: p, message: `Missing spacing before fully bold paragraph: "${p.textContent?.trim().substring(0, 30)}..."` });
  }
  return issues;
}

/** Runs after late bolding/trimming, so it must create custom spacers directly. */
export function addBoldParagraphSpacing(html: string, customSpacer?: string): string {
  if (!html || typeof html !== 'string') return '';
  try {
    const doc = new DOMParser().parseFromString(html, 'text/html');
    const spacer = parseCustomSpacer(customSpacer);
    const template = createSpacerElement(doc, spacer) || doc.createElement('p');
    if (spacer.root) markSpacerElement(template);
    else template.innerHTML = '&nbsp;';
    for (const issue of getBoldParagraphSpacingIssues(doc, customSpacer)) {
      issue.element.before(template.cloneNode(true));
    }
    return doc.body.innerHTML;
  } catch (e) {
    console.warn('Bold paragraph spacing failed:', e);
    return html;
  }
}

function addSpacingBeforeReadSection(doc: Document): void {
  const paragraphs = doc.querySelectorAll('p');
  
  paragraphs.forEach(p => {
    // Only the labeled paragraph ("Read more:"), not body text such as
    // "bacteria spread more quickly".
    if (isReadMoreParagraph(p)) {
      
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
  const paragraphs = findSourcesSections(doc).map(section => section.label);
  
  paragraphs.forEach(p => {
    if (isSourcesLabel(p)) {
      
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
    if (isDisclaimerSectionStart(p)) {
      
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
    // Every label wording, and every paragraph that always got the spacer
    if (isAltLabelParagraph(p) || text.includes('alt image text:')) {

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
