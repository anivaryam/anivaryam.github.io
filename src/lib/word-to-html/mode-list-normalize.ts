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
  let hasChanges = true;
  
  while (hasChanges) {
    hasChanges = false;
    const uls = Array.from(doc.querySelectorAll('ul'));

    for (let i = 0; i < uls.length - 1; i++) {
      const currentUl = uls[i];
      const nextUl = uls[i + 1];

      let sibling: Node | null = currentUl.nextSibling;
      while (
        sibling &&
        sibling.nodeType === Node.TEXT_NODE &&
        !sibling.textContent?.trim()
      ) {
        sibling = sibling.nextSibling;
      }

      if (sibling === nextUl) {
        const lis = Array.from(nextUl.children).filter(
          el => el.tagName === 'LI'
        );

        lis.forEach(li => currentUl.appendChild(li));
        nextUl.remove();
        hasChanges = true;
      }
    }
  }
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
    
    // List item normalization: just clean up spacing, don't wrap with EM
    // (style attribute will be removed elsewhere in the pipeline)
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

