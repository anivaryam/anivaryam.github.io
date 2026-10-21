/**
 * HTML Cleaner
 * 
 * Cleans HTML structure by removing unnecessary tags and unwrapping elements.
 * This is a structural simplifier, not a sanitizer - it focuses on layout noise
 * removal and DOM normalization.
 * 
 * Responsibilities:
 * - Removes unnecessary wrapper elements
 * - Normalizes list content (unwraps <p> inside <li>, removes <br> noise)
 * - Eliminates layout <br> elements (inside blocks, after blocks)
 * - Cleans inline formatting inside list items (normalizes strong/em nesting)
 * - Trims whitespace from anchor text
 * - Trims whitespace at the end of block elements (trimTrailingBlockWhitespace,
 *   run after mode processing; see its docs)
 * 
 * Note: This runs after sanitization and focuses on structural cleanup,
 * not security or semantic normalization.
 */

import { removeSpacingParagraphs, removeLayoutBreaks } from './html-spacing';

// Block-level elements (including HTML5 semantic elements treated as layout blocks)
// Note: Semantic HTML5 elements (section, article, etc.) are treated as layout blocks
// for <br> removal purposes - this is an opinionated choice for Word-exported HTML
export const BLOCK_ELEMENTS = [
  'div', 'p', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'ul', 'ol', 'li',
  'blockquote', 'pre', 'table', 'thead', 'tbody', 'tr', 'th', 'td',
  'dl', 'dt', 'dd', 'section', 'article', 'aside', 'header', 'footer',
  'nav', 'main', 'figure', 'figcaption'
];

// Set for O(1) lookups in hot loops
export const BLOCK_ELEMENT_SET = new Set(BLOCK_ELEMENTS);

// Void elements have no content or end tag; each renders as content of its own
export const VOID_ELEMENTS = ['br', 'hr', 'img', 'input', 'meta', 'link', 'area', 'base', 'col', 'embed', 'source', 'track', 'wbr'];

/**
 * IMPORTANT: This cleaner is order-dependent.
 * The passes must run in this specific order:
 * 1. cleanElement - local, context-aware normalization
 * 2. removeBrAtStartOfBlockElements - remove br tags at start of blocks
 * 3. removeBrAfterBlockElements - global layout cleanup
 * 4. removeConsecutiveBr - remove consecutive br tags
 * 5. removeParagraphsFromListItems - ensure all <p> tags are removed from <li> elements
 * 6. trimAnchorWhitespace - text-level polish
 * 
 * Do not reorder passes without updating tests.
 * 
 * Contract: This cleaner assumes sanitized, well-formed HTML.
 * Behavior is undefined for malformed DOM trees.
 */
export function cleanHtml(html: string): string {
  if (!html || typeof html !== 'string') {
    return '';
  }

  try {
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');

    // Also covers direct convertToHtml callers and wrappers unwrapped by sanitization.
    removeSpacingParagraphs(doc.body);
    removeLayoutBreaks(doc.body);
    cleanElement(doc.body, false);
    removeBrAtStartOfBlockElements(doc.body);
    removeBrAfterBlockElements(doc.body);
    removeConsecutiveBr(doc.body);

    removeParagraphsFromListItems(doc.body);
    trimAnchorWhitespace(doc.body);
    
    return doc.body.innerHTML;
  } catch (e) {
    console.warn('HTML cleaning failed:', e);
    return html;
  }
}

/**
 * Performs context-aware normalization during DOM traversal.
 * 
 * This function handles multiple conceptual phases:
 * 1. cleanChildren - Recursively processes child nodes, removing contextual <br> tags
 * 2. cleanupTrailingBrs - Removes <br> tags immediately after block elements (as siblings)
 * 3. normalizeListFormatting - Applies list-specific normalization (strong/em nesting, em merging)
 * 
 * NOTE: BR removal here is contextual (lists / blocks during traversal).
 * Global BR cleanup happens in later passes (removeBrAtStartOfBlockElements, removeBrAfterBlockElements).
 */
function cleanElement(element: Element, insideLi = false): void {
  if (!element || element.nodeType !== Node.ELEMENT_NODE) {
    return;
  }

  const tagName = element.tagName.toLowerCase();
  const isLi = tagName === 'li';
  const isBlock = BLOCK_ELEMENT_SET.has(tagName);
  const insideListContext = isLi || insideLi;

  // Phase 1: cleanChildren - Recursively process children, removing contextual <br> tags
  let node = element.firstChild;
  
  while (node) {
    const nextSibling = node.nextSibling;
    
    if (node.nodeType === Node.ELEMENT_NODE) {
      const childTag = (node as Element).tagName.toLowerCase();
      
      // Remove <br> tags
      // NOTE: This is contextual removal during traversal. Global BR cleanup happens in later passes.
      if (childTag === 'br') {
        element.removeChild(node);
        node = nextSibling;
        continue;
      }
      
      // Unwrap paragraphs inside list items
      if (childTag === 'p' && insideListContext) {
        unwrapParagraph(node as Element, element);
        node = nextSibling;
        continue;
      }
      
      cleanElement(node as Element, insideListContext);
    } else if (node.nodeType === Node.TEXT_NODE) {
      // Remove <br> tags immediately after text nodes in block elements
      if (isBlock && nextSibling && nextSibling.nodeType === Node.ELEMENT_NODE) {
        const nextTag = (nextSibling as Element).tagName.toLowerCase();
        if (nextTag === 'br') {
          element.removeChild(nextSibling);
        }
      }
    }
    
    node = nextSibling;
  }
  
  // Phase 2: cleanupTrailingBrs - Remove <br> tags immediately after this block element (as siblings)
  if (isBlock && element.parentNode) {
    let sibling = element.nextSibling;
    while (sibling) {
      const nextSibling = sibling.nextSibling;
      if (sibling.nodeType === Node.ELEMENT_NODE && 
          (sibling as Element).tagName.toLowerCase() === 'br') {
        element.parentNode.removeChild(sibling);
      } else {
        break;
      }
      sibling = nextSibling as Element | null;
    }
  }
  
  // Phase 3: normalizeListFormatting - Apply list-specific normalization
  if (insideListContext) {
    normalizeStrongEmNesting(element);
    mergeAdjacentEmTags(element);
  }
}

/**
 * Normalizes strong/em nesting inside list items
 * 
 * Converts: <strong><em>content</em></strong> → <em><strong>content</strong></em>
 * 
 * Note: This is asymmetric - only handles <strong><em> pattern, not <em><strong>.
 * This is intentional for Word/Google Docs output patterns, not general normalization.
 * 
 * Only swap wrappers when <em> is the sole child. Mixed inline content must
 * remain in its original order and retain its original emphasis.
 * 
 * Moves nodes (not clones) to preserve references, consistent with sanitizer behavior.
 */
function normalizeStrongEmNesting(element: Element): void {
  if (!element || element.nodeType !== Node.ELEMENT_NODE) {
    return;
  }
  
  const children = Array.from(element.childNodes);
  
  for (let i = 0; i < children.length; i++) {
    const child = children[i];
    
    if (child.nodeType === Node.ELEMENT_NODE) {
      const childTag = (child as Element).tagName.toLowerCase();
      
      if (childTag === 'strong') {
        const strongElement = child as Element;
        // Only finds the first direct <em> child - this is intentional
        const directEm = Array.from(strongElement.childNodes).find(
          node => node.nodeType === Node.ELEMENT_NODE && 
                  (node as Element).tagName.toLowerCase() === 'em' &&
                  node.parentNode === strongElement
        ) as Element | undefined;
        
        if (directEm && strongElement.childNodes.length === 1) {
          // Restructure: <strong><em>content</em></strong> → <em><strong>content</strong></em>
          const newEm = document.createElement('em');
          const newStrong = document.createElement('strong');
          
          // Move ALL content from em to newStrong (preserves references)
          // This ensures the strong tag is properly created with the em's content
          while (directEm.firstChild) {
            newStrong.appendChild(directEm.firstChild);
          }
          
          newEm.appendChild(newStrong);
          
          if (strongElement.parentNode) {
            // Insert the new structure BEFORE the original strong element
            strongElement.parentNode.insertBefore(newEm, strongElement);
            
            // Remove original strong element (the empty em inside will be removed too)
            strongElement.parentNode.removeChild(strongElement);
            
            // Recurse into new structure to catch nested patterns (e.g., <em><em>text</em></em>)
            normalizeStrongEmNesting(newEm);
          }
        } else {
          normalizeStrongEmNesting(child as Element);
        }
      } else {
        normalizeStrongEmNesting(child as Element);
      }
    }
  }
}

function unwrapParagraph(pElement: Element, parent: Element): void {
  if (!pElement || !parent) {
    return;
  }

  const canJoin = (node: Node | null): boolean => !!node &&
    (node.nodeType === Node.TEXT_NODE || (node.nodeType === Node.ELEMENT_NODE &&
      ((node as Element).tagName === 'P' || !BLOCK_ELEMENT_SET.has((node as Element).tagName.toLowerCase()))));
  const previous = pElement.previousSibling;
  const next = pElement.nextSibling;
  const text = pElement.textContent || '';
  if (canJoin(previous) && /\S$/.test(previous.textContent || '') && /^\S/.test(text)) {
    pElement.before(pElement.ownerDocument.createTextNode(' '));
  }
  while (pElement.firstChild) parent.insertBefore(pElement.firstChild, pElement);
  if (canJoin(next) && /\S$/.test(text) && /^\S/.test(next.textContent || '')) {
    pElement.before(pElement.ownerDocument.createTextNode(' '));
  }
  parent.removeChild(pElement);
}

/**
 * Merges adjacent <em> tags into a single <em> element.
 * 
 * Uses an iterative approach (rather than recursion) for better performance
 * and clarity when processing large inline content. Continues until no more
 * adjacent <em> tags are found.
 */
function mergeAdjacentEmTags(element: Element): void {
  if (!element || element.nodeType !== Node.ELEMENT_NODE) {
    return;
  }
  
  // Iterative approach: continue until no more merges are found
  let merged = true;
  while (merged) {
    merged = false;
    const children = Array.from(element.childNodes);
    
    for (let i = 0; i < children.length - 1; i++) {
      const current = children[i];
      const next = children[i + 1];
      
      if (current.nodeType === Node.ELEMENT_NODE && 
          next.nodeType === Node.ELEMENT_NODE) {
        
        const currentTag = (current as Element).tagName.toLowerCase();
        const nextTag = (next as Element).tagName.toLowerCase();
        
        if (currentTag === 'em' && nextTag === 'em') {
          // Merge next into current
          const nextChildren = Array.from((next as Element).childNodes);
          for (let j = 0; j < nextChildren.length; j++) {
            (current as Element).appendChild(nextChildren[j]);
          }
          if ((next as Element).parentNode) {
            (next as Element).parentNode.removeChild(next);
          }
          merged = true;
          break; // Restart scan after modification
        }
      }
    }
  }
}

/**
 * Trims whitespace at the outer edges of an anchor.
 * 
 * Only direct text nodes at those boundaries are trimmed. Spaces separating
 * plain text from nested formatting (e.g. "our <strong>How It Works</strong>")
 * belong to the link text and must remain intact. Trimmed padding that
 * separates the link from adjacent content moves outside the link, so
 * "<a>our article </a>today" keeps its word boundary.
 */
function trimAnchorWhitespace(element: Element): void {
  if (!element || element.nodeType !== Node.ELEMENT_NODE) {
    return;
  }
  
  const children = Array.from(element.childNodes);
  for (let i = 0; i < children.length; i++) {
    if (children[i].nodeType === Node.ELEMENT_NODE) {
      trimAnchorWhitespace(children[i] as Element);
    }
  }
  
  const tagName = element.tagName.toLowerCase();
  if (tagName !== 'a') {
    return;
  }
  
  const first = element.firstChild;
  const last = element.lastChild;
  if (first?.nodeType === Node.TEXT_NODE) {
    const text = first.textContent || '';
    first.textContent = text.replace(/^\s+/, '');
    keepSeparatorOutsideAnchor(element, text.slice(0, text.length - first.textContent.length), 'before');
    if (!first.textContent) element.removeChild(first);
  }

  // If the only text node was empty, the leading trim already removed it.
  if (last?.nodeType === Node.TEXT_NODE && last.parentNode === element) {
    const text = last.textContent || '';
    last.textContent = text.replace(/\s+$/, '');
    keepSeparatorOutsideAnchor(element, text.slice(last.textContent.length), 'after');
    if (!last.textContent) element.removeChild(last);
  }
}

/**
 * Re-inserts trimmed anchor padding next to the anchor when a sibling on that
 * side has no separator of its own. At the parent's edge it is dropped.
 */
function keepSeparatorOutsideAnchor(anchor: Element, padding: string, side: 'before' | 'after'): void {
  const sibling = side === 'before' ? anchor.previousSibling : anchor.nextSibling;
  if (!padding || !sibling) return;
  if (sibling.nodeType === Node.TEXT_NODE) {
    const text = sibling.textContent || '';
    if (side === 'before' ? /\s$/.test(text) : /^\s/.test(text)) return;
  }
  const separator = anchor.ownerDocument.createTextNode(padding);
  anchor.parentNode?.insertBefore(separator, side === 'before' ? anchor : anchor.nextSibling);
}

/**
 * Whitespace that HTML collapses: space, tab, line feed, form feed, carriage
 * return. It excludes U+00A0 (&nbsp;), which keeps a blank spacer block such
 * as <p>&nbsp;</p> open.
 */
const TRAILING_HTML_WHITESPACE = /[\t\n\r\f\v ]+$/;

/**
 * Collapsible whitespace plus the invisible spaces Word and Google Docs emit
 * for a space typed at the end of a paragraph: U+00A0 (&nbsp;), U+2000–U+200A,
 * U+200B, U+3000 and U+FEFF.
 */
const BLOCK_END_SPACES = '\\t\\n\\r\\f\\v \\u00A0\\u2000-\\u200B\\u3000\\uFEFF';
const TRAILING_BLOCK_END_SPACES = new RegExp(`[${BLOCK_END_SPACES}]+$`);
const VISIBLE_CHARACTER = new RegExp(`[^${BLOCK_END_SPACES}]`);

/** Elements whose interior whitespace is data, not layout. */
const WHITESPACE_PRESERVING_TAGS = new Set(['pre', 'code']);

/**
 * Trims whitespace at the rendered end of every block element in a subtree.
 *
 * Trailing whitespace at the end of a block is discarded by HTML whitespace
 * collapsing, so removing it does not change rendering. The walk descends
 * through trailing inline wrappers (e.g. <p>Hello <strong>World   </strong></p>)
 * and continues past whitespace-only text and empty wrappers until it reaches
 * content, but stops at nested block boundaries, since each block is handled
 * by its own pass. Wrappers the trim leaves empty are removed. Inline
 * whitespace that separates words is never touched, and neither are the
 * contents of <pre>/<code>.
 *
 * Trailing &nbsp; and invisible Unicode spaces are trimmed too when the block
 * has visible text; a block holding only such spaces (the <p>&nbsp;</p>
 * spacer, a blank custom spacer, an empty table cell) keeps them.
 */
export function trimTrailingWhitespaceInBlocks(root: Element): void {
  if (!root || root.nodeType !== Node.ELEMENT_NODE) {
    return;
  }

  const tagName = root.tagName.toLowerCase();
  if (BLOCK_ELEMENT_SET.has(tagName) && !WHITESPACE_PRESERVING_TAGS.has(tagName)) {
    trimBlockEnd(root);
  }

  const children = Array.from(root.children);
  for (let i = 0; i < children.length; i++) {
    trimTrailingWhitespaceInBlocks(children[i]);
  }
}

/**
 * The list-label convention intentionally keeps one space after a bold colon
 * label, and the list validator enforces it. Preserve that single separator so
 * trimming never turns valid pipeline output into a validation failure.
 */
function isListLabelSeparator(block: Element, node: Node): boolean {
  if (block.tagName.toLowerCase() !== 'li') {
    return false;
  }
  const previous = node.previousSibling;
  if (!previous || previous.nodeType !== Node.ELEMENT_NODE) {
    return false;
  }
  const element = previous as Element;
  return element.tagName.toLowerCase() === 'strong' &&
    (element.textContent || '').trim().endsWith(':');
}

function trimBlockEnd(block: Element): void {
  const trailing = VISIBLE_CHARACTER.test(block.textContent || '') ? TRAILING_BLOCK_END_SPACES : TRAILING_HTML_WHITESPACE;
  trimContainerEnd(block, block, trailing);
}

/**
 * Trims the end of `container`, walking back from its last child. Returns
 * true once content ends the walk: text that keeps characters, a void element,
 * a nested block, <pre>/<code>, or the list-label separator.
 */
function trimContainerEnd(block: Element, container: Node, trailing: RegExp): boolean {
  let node: Node | null = container.lastChild;
  while (node) {
    const previous: Node | null = node.previousSibling;
    if (node.nodeType === Node.TEXT_NODE) {
      const text = node.textContent || '';
      const trimmed = text.replace(trailing, '');
      if (trimmed) {
        if (trimmed !== text) node.textContent = trimmed;
        return true;
      }
      if (isListLabelSeparator(block, node)) {
        node.textContent = ' ';
        return true;
      }
      node.parentNode?.removeChild(node);
    } else if (node.nodeType === Node.ELEMENT_NODE) {
      const element = node as Element;
      const childTag = element.tagName.toLowerCase();
      if (BLOCK_ELEMENT_SET.has(childTag) || WHITESPACE_PRESERVING_TAGS.has(childTag) || VOID_ELEMENTS.includes(childTag)) {
        return true;
      }
      const hadChildren = element.hasChildNodes();
      if (trimContainerEnd(block, element, trailing)) {
        return true;
      }
      // A wrapper that held only whitespace renders nothing once trimmed.
      // Links keep their element, as the anchor trim does.
      if (hadChildren && childTag !== 'a') {
        element.parentNode?.removeChild(element);
      }
    } else {
      return true;
    }
    node = previous;
  }
  return false;
}

/**
 * String-level entry point for trimming block-end whitespace. Runs after all
 * mode processing so both formatted and unformatted output share the result.
 */
export function trimTrailingBlockWhitespace(html: string): string {
  if (!html || typeof html !== 'string') {
    return '';
  }

  try {
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');
    trimTrailingWhitespaceInBlocks(doc.body);
    return doc.body.innerHTML;
  } catch (e) {
    console.warn('Trailing whitespace trimming failed:', e);
    return html;
  }
}

/**
 * Removes all <br> tags at the start of block elements.
 * Handles cases like <p><br><strong>...</strong></p>
 */
function removeBrAtStartOfBlockElements(element: Element): void {
  if (!element || element.nodeType !== Node.ELEMENT_NODE) {
    return;
  }
  
  const tagName = element.tagName.toLowerCase();
  
  // If this is a block element, remove br tags at the start
  if (BLOCK_ELEMENT_SET.has(tagName)) {
    let firstChild = element.firstChild;
    while (firstChild) {
      const nextSibling = firstChild.nextSibling;
      if (firstChild.nodeType === Node.ELEMENT_NODE && 
          (firstChild as Element).tagName.toLowerCase() === 'br') {
        element.removeChild(firstChild);
      } else {
        break;
      }
      firstChild = nextSibling as Element | null;
    }
  }
  
  // Recursively process children
  const children = Array.from(element.childNodes);
  for (let i = 0; i < children.length; i++) {
    if (children[i].nodeType === Node.ELEMENT_NODE) {
      removeBrAtStartOfBlockElements(children[i] as Element);
    }
  }
}

/**
 * Removes all <p> tags from inside <li> elements, regardless of nesting depth.
 * This ensures that even if <p> tags are added after initial cleaning or are nested
 * deeper than direct children, they will be unwrapped.
 * 
 * This is a safety pass to catch any <p> tags that might have been missed during
 * the initial cleanElement traversal or added by later processing steps.
 */
function removeParagraphsFromListItems(element: Element): void {
  if (!element || element.nodeType !== Node.ELEMENT_NODE) {
    return;
  }
  
  const tagName = element.tagName.toLowerCase();
  
  // If this is a list item, find and unwrap all <p> tags (direct or nested)
  if (tagName === 'li') {
    const paragraphs = element.querySelectorAll(':scope p');
    // Process in reverse order to avoid index issues when removing
    for (let i = paragraphs.length - 1; i >= 0; i--) {
      const p = paragraphs[i];
      if (p.parentNode) {
        unwrapParagraph(p, p.parentNode as Element);
      }
    }
  }
  
  // Recursively process children
  const children = Array.from(element.childNodes);
  for (let i = 0; i < children.length; i++) {
    if (children[i].nodeType === Node.ELEMENT_NODE) {
      removeParagraphsFromListItems(children[i] as Element);
    }
  }
}

/**
 * Removes all <br> tags immediately after block elements.
 * Handles cases like <p>...</p><br> and multiple consecutive <br> tags.
 */
function removeBrAfterBlockElements(element: Element): void {
  if (!element || element.nodeType !== Node.ELEMENT_NODE) {
    return;
  }
  
  // First, recursively process children
  const children = Array.from(element.childNodes);
  for (let i = 0; i < children.length; i++) {
    if (children[i].nodeType === Node.ELEMENT_NODE) {
      removeBrAfterBlockElements(children[i] as Element);
    }
  }
  
  // Then, remove br tags after block elements in this element's children
  const childNodes = Array.from(element.childNodes);
  for (let i = 0; i < childNodes.length; i++) {
    const node = childNodes[i];
    
    if (node.nodeType === Node.ELEMENT_NODE) {
      const tagName = (node as Element).tagName.toLowerCase();
      
      if (BLOCK_ELEMENT_SET.has(tagName)) {
        // Remove ALL consecutive br tags after this block element
        let nextSibling = node.nextSibling;
        while (nextSibling) {
          const nextNextSibling = nextSibling.nextSibling;
          if (nextSibling.nodeType === Node.ELEMENT_NODE && 
              (nextSibling as Element).tagName.toLowerCase() === 'br') {
            element.removeChild(nextSibling);
          } else {
            break;
          }
          nextSibling = nextNextSibling;
        }
      }
    }
  }
}

/**
 * Removes consecutive <br> tags throughout the document.
 * Collapses multiple <br> tags into a single <br> tag.
 */
function removeConsecutiveBr(element: Element): void {
  if (!element || element.nodeType !== Node.ELEMENT_NODE) {
    return;
  }
  
  // First, recursively process children
  const children = Array.from(element.childNodes);
  for (let i = 0; i < children.length; i++) {
    if (children[i].nodeType === Node.ELEMENT_NODE) {
      removeConsecutiveBr(children[i] as Element);
    }
  }
  
  // Then, remove consecutive br tags in this element's children
  const childNodes = Array.from(element.childNodes);
  for (let i = 0; i < childNodes.length; i++) {
    const node = childNodes[i];
    
    if (node.nodeType === Node.ELEMENT_NODE && 
        (node as Element).tagName.toLowerCase() === 'br') {
      // Remove all consecutive br tags after this one
      let nextSibling = node.nextSibling;
      while (nextSibling) {
        const nextNextSibling = nextSibling.nextSibling;
        if (nextSibling.nodeType === Node.ELEMENT_NODE && 
            (nextSibling as Element).tagName.toLowerCase() === 'br') {
          element.removeChild(nextSibling);
        } else {
          break;
        }
        nextSibling = nextNextSibling;
      }
    }
  }
}
