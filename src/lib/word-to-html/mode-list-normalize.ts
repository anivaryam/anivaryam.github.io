/**
 * Mode Utility: List Label Spacing
 * 
 * Normalizes spacing after <strong> tags ending with colons in list items.
 * Assumes <strong> ending with ':' represents a label that should have a space
 * before the following content.
 * 
 * IMPORTANT: This function ONLY processes existing <strong> tags.
 * It does NOT create new <strong> tags for list items with colons.
 * List items with colons that are not originally bold will NOT be wrapped in <strong>.
 * 
 * If you see list items with colons being wrapped in <strong> tags when they weren't
 * originally bold, the wrapping is happening elsewhere in the pipeline (likely in
 * word-html-cleaner.ts normalizeFormattingTags or html-sanitizer.ts).
 * 
 * This is inline text normalization, not structural list normalization.
 */

function mergeAdjacentUl(doc: Document): void {
  const uls = Array.from(doc.querySelectorAll('ul'));

  for (let i = 0; i < uls.length - 1; i++) {
    const currentUl = uls[i];
    const nextUl = uls[i + 1];

    // Check for adjacency, skipping whitespace-only text nodes
    let sibling: Node | null = currentUl.nextSibling;
    while (
      sibling &&
      sibling.nodeType === Node.TEXT_NODE &&
      !sibling.textContent?.trim()
    ) {
      sibling = sibling.nextSibling;
    }

    if (sibling === nextUl) {
      // Move only direct child <li> elements to avoid corrupting nested lists
      const lis = Array.from(nextUl.children).filter(
        el => el.tagName === 'LI'
      );

      lis.forEach(li => currentUl.appendChild(li));
      nextUl.remove();

      uls.splice(i + 1, 1);
      i--;
    }
  }
}

/**
 * Wraps text before colon in ordered list items with <strong>
 * This handles cases where Google Docs/Word exports bold labels in ordered lists
 * but the bold gets lost during sanitization
 * EXCLUDES: Sources section lists (uses same logic as normalizeSources)
 */
function wrapOlLabelsInStrong(doc: Document): void {
  // First, identify Sources ol lists (same logic as normalizeSources)
  const sourcesOlSelectors = new Set<Element>();
  
  const paragraphs = doc.querySelectorAll('p');
  paragraphs.forEach(p => {
    const text = p.textContent?.trim() || '';
    const lowerText = text.toLowerCase();
    
    // Check if this is a Sources paragraph
    if (lowerText === 'sources' || lowerText === 'sources:' || lowerText.startsWith('sources:')) {
      // Find the next ol after this paragraph
      let nextSibling = p.nextElementSibling;
      while (nextSibling && nextSibling.tagName.toLowerCase() !== 'ol') {
        nextSibling = nextSibling.nextElementSibling;
      }
      if (nextSibling) {
        sourcesOlSelectors.add(nextSibling);
      }
    }
  });
  
  // Now process all ol items, skipping Sources
  const olItems = doc.querySelectorAll('ol > li');
  
  olItems.forEach(li => {
    // Skip if this ol is a Sources list
    if (sourcesOlSelectors.has(li.parentElement!)) return;
    
    // Get all text nodes directly in the li (not in children)
    const textNodes: Text[] = [];
    li.childNodes.forEach(node => {
      if (node.nodeType === Node.TEXT_NODE && node.textContent?.trim()) {
        textNodes.push(node as Text);
      }
    });
    
    // Check if first text node contains text before a colon
    if (textNodes.length > 0) {
      const firstText = textNodes[0];
      const text = firstText.textContent || '';
      const colonIndex = text.indexOf(':');
      
      if (colonIndex > 0) {
        // Split text: before colon and after colon
        const beforeColon = text.substring(0, colonIndex + 1);
        const afterColon = text.substring(colonIndex + 1);
        
        // Wrap before colon in <strong>
        const strong = doc.createElement('strong');
        strong.textContent = beforeColon;
        
        // Replace the text node with strong + remaining text
        firstText.textContent = afterColon;
        li.insertBefore(strong, firstText);
      }
    }
  });
}

export function normalizeLists(html: string): string {
  if (!html || typeof html !== 'string') {
    return '';
  }

  try {
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');
    
    // Merge adjacent ul elements first
    mergeAdjacentUl(doc);
    
    // Apply bold to text before colon in ordered lists
    wrapOlLabelsInStrong(doc);
    
    // Additional fix: Wrap <li> elements with <em> if they have font-style: italic in style
    // This handles formats that html-sanitizer might miss
    const listItems = doc.querySelectorAll('li');
    listItems.forEach(li => {
      const style = li.getAttribute('style') || '';
      if (style.includes('font-style') && style.includes('italic')) {
        // Check if content is already wrapped in em
        const hasEm = li.querySelector('em');
        if (!hasEm) {
          const em = document.createElement('em');
          // Move all children to em
          while (li.firstChild) {
            em.appendChild(li.firstChild);
          }
          li.appendChild(em);
        }
      }
    });
    
    const normalizedListItems = doc.querySelectorAll('li');
    
    normalizedListItems.forEach(li => {
      // SAFEGUARD: Only query for existing <strong> tags - NEVER create new ones
      // This ensures list items with colons that weren't originally bold remain unbolded
      const strongTags = li.querySelectorAll('strong');
      
      strongTags.forEach(strong => {
        const strongText = strong.textContent || '';
        
        // Only process <strong> tags that end with ':' (assumes label format)
        // This ensures we only normalize spacing for originally-bold labels
        if (strongText.trim().endsWith(':')) {
          // Normalize colon spacing: remove trailing spaces before colon
          // Use node-level operations instead of innerHTML for consistency
          const lastChild = strong.lastChild;
          if (lastChild?.nodeType === Node.TEXT_NODE) {
            const text = lastChild.textContent || '';
            const normalized = text.replace(/:\s+$/, ':');
            if (normalized !== text) {
              lastChild.textContent = normalized;
            }
          }
          
          // Ensure space after strong tag (idempotent)
          const nextSibling = strong.nextSibling;
          if (nextSibling?.nodeType === Node.TEXT_NODE) {
            const text = (nextSibling as Text).textContent || '';
            const trimmed = text.trim();
            
            if (trimmed) {
              // Text node contains actual content
              // Check for leading whitespace (spaces or tabs)
              const leadingWhitespaceMatch = text.match(/^(\s+)/);
              const leadingWhitespace = leadingWhitespaceMatch ? leadingWhitespaceMatch[1] : '';
              
              if (!leadingWhitespace) {
                // No leading space - add one
                (nextSibling as Text).textContent = ' ' + trimmed;
              } else if (leadingWhitespace.length > 1 || leadingWhitespace !== ' ') {
                // Multiple leading spaces or non-space whitespace - normalize to single space
                (nextSibling as Text).textContent = ' ' + trimmed;
              }
              // If exactly one leading space, content is already correct - no mutation needed
            } else {
              // Text node is empty/whitespace-only
              if (text !== ' ') {
                (nextSibling as Text).textContent = ' ';
              }
              // If text === ' ', it's already correct - no mutation needed
            }
          } else {
            // No text node after strong - insert space node
            strong.after(doc.createTextNode(' '));
          }
        }
      });
    });
    
    return doc.body.innerHTML;
  } catch (e) {
    console.warn('List label spacing normalization failed:', e);
    return html;
  }
}

