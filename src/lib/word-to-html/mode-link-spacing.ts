/**
 * Mode Utility: Link Spacing
 * Ensures proper spacing before and after links, especially in list items
 *
 * Idempotent: safe to run multiple times without adding extra spaces
 */

// Regex pattern for checking if text ends with whitespace (space, newline, or non-breaking space)
const WHITESPACE_END_RE = /[\s\u00A0]$/;

// Regex pattern for checking if text starts with whitespace
const WHITESPACE_START_RE = /^[\s\u00A0]/;

// Regex pattern for checking if text ends with opening punctuation (including smart quotes)
const OPENING_PUNCTUATION_RE = /[\("'\[\{\u201C\u2018]$/;

// Regex pattern for checking if text starts with closing punctuation that doesn't need a space before it
const CLOSING_PUNCTUATION_RE = /^[.,;:!?)}\]'"'\u201D\u2019]/;

export function addLinkSpacing(html: string): string {
  if (!html || typeof html !== 'string') {
    return '';
  }

  try {
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');
    
    // Helper function to check if text ends with whitespace
    const endsWithWhitespace = (text: string): boolean => {
      return WHITESPACE_END_RE.test(text);
    };
    
    // Helper function to check if text ends with opening punctuation
    const endsWithOpeningPunctuation = (text: string): boolean => {
      return OPENING_PUNCTUATION_RE.test(text);
    };
    
    // Helper function to get the last text node from an element
    const getLastTextNodeFromElement = (element: Element): Text | null => {
      const walker = doc.createTreeWalker(
        element,
        NodeFilter.SHOW_TEXT
      );
      let lastTextNode: Text | null = null;
      let node;
      while ((node = walker.nextNode())) {
        lastTextNode = node as Text;
      }
      return lastTextNode;
    };

    // Helper function to get the first text node from an element
    const getFirstTextNodeFromElement = (element: Element): Text | null => {
      const walker = doc.createTreeWalker(
        element,
        NodeFilter.SHOW_TEXT
      );
      const node = walker.nextNode();
      return node ? (node as Text) : null;
    };

    // Helper function to find the previous meaningful sibling (skips empty text nodes)
    const findPreviousMeaningfulSibling = (node: Node | null): Node | null => {
      let current = node;
      while (
        current &&
        current.nodeType === Node.TEXT_NODE &&
        !(current as Text).textContent?.trim()
      ) {
        current = current.previousSibling;
      }
      return current;
    };

    // Helper function to find the next meaningful sibling (skips empty text nodes)
    const findNextMeaningfulSibling = (node: Node | null): Node | null => {
      let current = node;
      while (
        current &&
        current.nodeType === Node.TEXT_NODE &&
        !(current as Text).textContent?.trim()
      ) {
        current = current.nextSibling;
      }
      return current;
    };
    
    const allAnchors = doc.querySelectorAll('a');

    allAnchors.forEach(anchor => {
      // Guard against missing parentNode (defensive safety check)
      if (!anchor.parentNode) {
        return;
      }

      const prevSibling = anchor.previousSibling;

      // Find the last meaningful text node before the anchor
      let textNodeToModify: Text | null = null;
      let textContent = '';

      if (prevSibling) {
        if (prevSibling.nodeType === Node.TEXT_NODE) {
          const text = (prevSibling as Text).textContent || '';
          if (text.trim()) {
            // Found a text node with content
            textNodeToModify = prevSibling as Text;
            textContent = text;
          } else {
            // Empty text node - look for previous element's last text
            const prevElement = findPreviousMeaningfulSibling(prevSibling.previousSibling);
            if (prevElement && prevElement.nodeType === Node.ELEMENT_NODE) {
              const lastText = getLastTextNodeFromElement(prevElement as Element);
              if (lastText) {
                textNodeToModify = lastText;
                textContent = lastText.textContent || '';
              }
            }
          }
        } else if (prevSibling.nodeType === Node.ELEMENT_NODE) {
          // Previous sibling is an element - get its last text node
          const lastText = getLastTextNodeFromElement(prevSibling as Element);
          if (lastText) {
            textNodeToModify = lastText;
            textContent = lastText.textContent || '';
          }
        }

        // ALWAYS normalize multiple spaces to single space first (before any other logic)
        if (textNodeToModify) {
          textNodeToModify.textContent = textContent.replace(/\s+/g, ' ');
          textContent = textNodeToModify.textContent || '';
        }

        // Add space before if needed (after normalization)
        if (textNodeToModify && textContent.trim() && !endsWithWhitespace(textContent) && !endsWithOpeningPunctuation(textContent)) {
          textNodeToModify.textContent = textContent + ' ';
        } else if (!textNodeToModify) {
          // No text node found - insert a space node before the anchor
          const spaceNode = doc.createTextNode(' ');
          anchor.parentNode.insertBefore(spaceNode, anchor);
        }
        // If text ends with whitespace or opening punctuation, we don't need to do anything
      }

      // --- Space AFTER the link ---
      const nextSibling = anchor.nextSibling;

      if (nextSibling) {
        let nextTextNode: Text | null = null;
        let nextText = '';

        if (nextSibling.nodeType === Node.TEXT_NODE) {
          const text = (nextSibling as Text).textContent || '';
          if (text.trim()) {
            nextTextNode = nextSibling as Text;
            nextText = text;
          } else {
            // Empty text node - look for next element's first text
            const nextElement = findNextMeaningfulSibling(nextSibling.nextSibling);
            if (nextElement && nextElement.nodeType === Node.ELEMENT_NODE) {
              const firstText = getFirstTextNodeFromElement(nextElement as Element);
              if (firstText) {
                nextTextNode = firstText;
                nextText = firstText.textContent || '';
              }
            }
          }
        } else if (nextSibling.nodeType === Node.ELEMENT_NODE) {
          // Next sibling is an element - get its first text node
          const firstText = getFirstTextNodeFromElement(nextSibling as Element);
          if (firstText) {
            nextTextNode = firstText;
            nextText = firstText.textContent || '';
          }
        }

        // Normalize multiple spaces
        if (nextTextNode) {
          nextTextNode.textContent = nextText.replace(/\s+/g, ' ');
          nextText = nextTextNode.textContent || '';
        }

        // Add space after if needed
        if (nextTextNode && nextText.trim() && !WHITESPACE_START_RE.test(nextText) && !CLOSING_PUNCTUATION_RE.test(nextText)) {
          nextTextNode.textContent = ' ' + nextText;
        } else if (!nextTextNode) {
          // No text node found - insert a space node after the anchor
          const spaceNode = doc.createTextNode(' ');
          anchor.parentNode.insertBefore(spaceNode, anchor.nextSibling);
        }
      }
    });
    
    return doc.body.innerHTML;
  } catch (e) {
    console.warn('Link spacing addition failed:', e);
    return html;
  }
}

