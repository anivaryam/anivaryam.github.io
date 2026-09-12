/** Article-title detection shared by source normalization, removal, and validation. */
import { BLOCK_ELEMENT_SET } from './html-cleaner';
import { nextNonSpacingElement } from './html-spacing';
import { findKeyTakeawaysSection } from './mode-key-takeaways';

type SourceStyleReader = (element: Element) => Pick<CSSStyleDeclaration, 'fontSize'>;

export function getArticleTitleCandidate(root: ParentNode): Element | null {
  const section = findKeyTakeawaysSection(root);
  return section ? nextNonSpacingElement(section.list) : null;
}

function hasTitleStyle(element: Element): boolean {
  return Array.from(element.classList).some(name => /^(title|msotitle)$/i.test(name)) ||
    /(?:^|;)\s*mso-style-name\s*:\s*["']?title["']?\s*(?:;|$)/i.test(element.getAttribute('style') || '');
}

/** Browser computed sizes are px; jsdom also returns absolute pt declarations. */
function sizeInPixels(size: string): number {
  if (size.endsWith('pt')) return parseFloat(size) * 4 / 3;
  return size.endsWith('px') ? parseFloat(size) : NaN;
}

function textSizes(element: Element, styleOf: SourceStyleReader): { size: number; weight: number }[] {
  const sizes: { size: number; weight: number }[] = [];
  const walker = element.ownerDocument.createTreeWalker(element, NodeFilter.SHOW_TEXT);
  let node: Node | null;
  while ((node = walker.nextNode())) {
    const weight = node.textContent?.trim().length || 0;
    if (weight && node.parentElement) {
      sizes.push({ size: sizeInPixels(styleOf(node.parentElement).fontSize), weight });
    }
  }
  return sizes;
}

export function findArticleTitleAfterKeyTakeaways(root: ParentNode, styleOf?: SourceStyleReader): Element | null {
  const candidate = getArticleTitleCandidate(root);
  if (!candidate) return null;
  if (candidate.tagName.toLowerCase() === 'h1') return candidate;
  if (!candidate.matches('p, div') || !candidate.textContent?.trim()) return null;
  // A layout wrapper containing several blocks is not one article title.
  if (Array.from(candidate.querySelectorAll('*')).some(el => BLOCK_ELEMENT_SET.has(el.tagName.toLowerCase()))) return null;
  if (hasTitleStyle(candidate)) return candidate;
  if (!styleOf) return null;

  // Compare the whole candidate with up to three introductory paragraphs. Do
  // not infer a body size from headings, captions elsewhere, or a fixed default.
  const bodySizes: { size: number; weight: number }[] = [];
  let next = nextNonSpacingElement(candidate);
  let paragraphs = 0;
  while (next?.matches('p') && paragraphs < 3) {
    bodySizes.push(...textSizes(next, styleOf).filter(run => Number.isFinite(run.size)));
    paragraphs++;
    next = nextNonSpacingElement(next);
  }
  if (!bodySizes.length) return null;
  bodySizes.sort((a, b) => a.size - b.size);
  let remainingWeight = bodySizes.reduce((sum, run) => sum + run.weight, 0) / 2;
  const bodySize = bodySizes.find(run => (remainingWeight -= run.weight) <= 0)!.size;
  const titleSizes = textSizes(candidate, styleOf);
  // 18pt = 24px. Every meaningful run must qualify, not just one enlarged word.
  return titleSizes.length && titleSizes.every(run => run.size >= 24 && run.size >= bodySize * 1.5)
    ? candidate : null;
}

/** Source Title styles become semantic H1s before the sanitizer discards CSS. */
export function normalizeArticleTitle(title: Element): void {
  if (title.tagName.toLowerCase() === 'h1') return;
  const heading = title.ownerDocument.createElement('h1');
  for (const attr of Array.from(title.attributes)) heading.setAttribute(attr.name, attr.value);
  heading.append(...Array.from(title.childNodes));
  title.replaceWith(heading);
}

// Keep the existing function name and feature key for callers of the pipeline.
export function removeH1AfterKeyTakeaways(html: string): string {
  if (!html || typeof html !== 'string') return '';
  try {
    const doc = new DOMParser().parseFromString(html, 'text/html');
    findArticleTitleAfterKeyTakeaways(doc)?.remove();
    return doc.body.innerHTML;
  } catch (error) {
    console.warn('Article title removal failed:', error);
    return html;
  }
}
