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
 * 
 * Note: This runs after sanitization and focuses on structural cleanup,
 * not security or semantic normalization.
 */

// Block-level elements (including HTML5 semantic elements treated as layout blocks)
// Note: Semantic HTML5 elements (section, article, etc.) are treated as layout blocks
// for <br> removal purposes - this is an opinionated choice for Word-exported HTML
const BLOCK_ELEMENTS = [
  'div', 'p', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'ul', 'ol', 'li',
  'blockquote', 'pre', 'table', 'thead', 'tbody', 'tr', 'th', 'td',
  'dl', 'dt', 'dd', 'section', 'article', 'aside', 'header', 'footer',
  'nav', 'main', 'figure', 'figcaption'
];

// Set for O(1) lookups in hot loops
const BLOCK_ELEMENT_SET = new Set(BLOCK_ELEMENTS);

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
    // DEBUG: Log input
    console.log('=== cleanHtml: INPUT ===');
    console.log(html.substring(0, 500));
    
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');
    
    cleanElement(doc.body, false);
    removeBrAtStartOfBlockElements(doc.body);
    removeBrAfterBlockElements(doc.body);
    removeConsecutiveBr(doc.body);

    // DEBUG: Log output
    console.log('=== cleanHtml: OUTPUT ===');
    console.log(doc.body.innerHTML.substring(0, 500));
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
 * IMPORTANT: Only the first direct <em> child is normalized per <strong> element.
 * For example, <strong>text <em>em</em> more <em>em2</em></strong> will only normalize
 * the first <em>, not subsequent ones. This is intentional for Word output patterns.
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
        
        if (directEm) {
          // Restructure: <strong><em>content</em>other</strong> → <em><strong>content</strong></em>other
          const newEm = document.createElement('em');
          const newStrong = document.createElement('strong');
          
          // Move ALL content from em to newStrong (preserves references)
          // This ensures the strong tag is properly created with the em's content
          while (directEm.firstChild) {
            newStrong.appendChild(directEm.firstChild);
          }
          
          newEm.appendChild(newStrong);
          
          // Collect content after em (to be moved after newEm)
          const otherContent: Node[] = [];
          let foundEm = false;
          for (let j = 0; j < strongElement.childNodes.length; j++) {
            const strongChild = strongElement.childNodes[j];
            if (strongChild === directEm) {
              foundEm = true;
            } else if (foundEm) {
              otherContent.push(strongChild);
            }
          }
          
          if (strongElement.parentNode) {
            const insertPosition = strongElement.nextSibling;
            
            // Insert the new structure BEFORE the original strong element
            strongElement.parentNode.insertBefore(newEm, strongElement);
            
            // Move any content that was after the em
            for (let j = 0; j < otherContent.length; j++) {
              strongElement.parentNode.insertBefore(otherContent[j], insertPosition);
            }
            
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

  const children = Array.from(pElement.childNodes);
  
  for (let i = 0; i < children.length; i++) {
    const child = children[i];
    
    if (child.nodeType === Node.ELEMENT_NODE) {
      const childTag = (child as Element).tagName.toLowerCase();
      
      if (childTag === 'br') {
        continue;
      }
      
      parent.insertBefore(child, pElement);
    } else if (child.nodeType === Node.TEXT_NODE) {
      const text = child.textContent;
      if (text?.trim()) {
        // Intentionally recreates text nodes to normalize whitespace
        // (moves nodes would preserve original whitespace, which we don't want here)
        const textNode = document.createTextNode(text);
        parent.insertBefore(textNode, pElement);
      }
    }
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
 * Trims leading and trailing whitespace from anchor text nodes.
 * 
 * IMPORTANT: Only trims whitespace in text nodes directly under <a> elements.
 * Does not alter whitespace inside nested inline elements (e.g., <a><span>Link</span></a>).
 * This conservative approach is intentional to avoid unintended formatting changes.
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
  
  let firstTextNode: Text | null = null;
  let lastTextNode: Text | null = null;
  
  const childNodes = Array.from(element.childNodes);
  for (let i = 0; i < childNodes.length; i++) {
    const node = childNodes[i];
    if (node.nodeType === Node.TEXT_NODE) {
      if (firstTextNode === null) {
        firstTextNode = node as Text;
      }
      lastTextNode = node as Text;
    }
  }
  
  if (firstTextNode === null && lastTextNode === null) {
    return;
  }
  
  if (firstTextNode) {
    const originalText = firstTextNode.textContent || '';
    const trimmedText = originalText.replace(/^\s+/, '');
    
    if (trimmedText.length === 0) {
      element.removeChild(firstTextNode);
    } else {
      firstTextNode.textContent = trimmedText;
    }
  }
  
  if (lastTextNode && lastTextNode !== firstTextNode) {
    const originalText = lastTextNode.textContent || '';
    const trimmedText = originalText.replace(/\s+$/, '');
    
    if (trimmedText.length === 0) {
      element.removeChild(lastTextNode);
    } else {
      lastTextNode.textContent = trimmedText;
    }
  } else if (lastTextNode && lastTextNode === firstTextNode && firstTextNode) {
    const originalText = firstTextNode.textContent || '';
    const trimmedText = originalText.trim();
    
    if (trimmedText.length === 0) {
      element.removeChild(firstTextNode);
    } else {
      firstTextNode.textContent = trimmedText;
    }
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

