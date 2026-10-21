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

// Text that continues the link's word: a suffix ("FDAs") or a hyphen/dash
// compound ("FDA-approved"). No space is added before it.
const WORD_CONTINUATION_RE = /^[\p{L}\p{N}\u2010-\u2015-]/u;

/**
 * Text that the following link continues: a hyphen, dash or slash compound
 * ("non-<a>toxic</a>", "and/<a>or</a>") or a currency amount
 * ("$<a>29.99</a>"). No space is added before the link. A letter or digit
 * does not count: Word often drops the space in "word<a>link</a>".
 * Shared with the validator's link-spacing rule.
 */
export const LINK_CONTINUES_TEXT_RE = /[\p{Sc}\u2010-\u2015/-]$/u;

// Whitespace that HTML collapses (the set html-cleaner trims). U+00A0 (&nbsp;)
// is intentional spacing and must survive normalization.
const COLLAPSIBLE_WHITESPACE_RE = /[\t\n\r\f\v ]+/g;

/**
 * A link whose visible text is all superscript/subscript is a footnote marker
 * that attaches to the preceding word ("drug<sup>1</sup>"). Shared with the
 * validator's link-spacing rule.
 */
export function isFootnoteLink(anchor: Element): boolean {
  const walker = anchor.ownerDocument.createTreeWalker(anchor, NodeFilter.SHOW_TEXT);
  let hasText = false;
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    if (!node.textContent?.trim()) continue;
    if (!node.parentElement?.closest('sup, sub')) return false;
    hasText = true;
  }
  return hasText;
}

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

    // Text inside <pre>/<code> is data, not prose: never rewrite it
    const isCodeText = (node: Text): boolean => {
      return !!node.parentElement?.closest('pre, code');
    };

    // A whitespace-only text node beside a link is already its separator; the
    // neighboring link, label, or formatting must not absorb another space
    const isWhitespaceText = (node: Node): boolean => {
      return node.nodeType === Node.TEXT_NODE && !node.textContent?.trim();
    };
    
    const allAnchors = doc.querySelectorAll('a');

    allAnchors.forEach(anchor => {
      // Guard against missing parentNode (defensive safety check)
      if (!anchor.parentNode) {
        return;
      }

      // Links inside code keep the code's exact whitespace
      if (anchor.closest('pre, code')) {
        return;
      }

      const prevSibling = anchor.previousSibling;

      // Find the last meaningful text node before the anchor
      let textNodeToModify: Text | null = null;
      let textContent = '';

      if (prevSibling && !isWhitespaceText(prevSibling) && !isFootnoteLink(anchor)) {
        if (prevSibling.nodeType === Node.TEXT_NODE) {
          // Found a text node with content
          textNodeToModify = prevSibling as Text;
          textContent = (prevSibling as Text).textContent || '';
        } else if (prevSibling.nodeType === Node.ELEMENT_NODE) {
          // Previous sibling is an element - get its last text node
          const lastText = getLastTextNodeFromElement(prevSibling as Element);
          if (lastText) {
            textNodeToModify = lastText;
            textContent = lastText.textContent || '';
          }
        }

        // Code text next to the link stays exactly as written
        const isCodeNeighbor = textNodeToModify !== null && isCodeText(textNodeToModify);

        // ALWAYS normalize multiple spaces to single space first (before any other logic)
        if (textNodeToModify && !isCodeNeighbor) {
          textNodeToModify.textContent = textContent.replace(COLLAPSIBLE_WHITESPACE_RE, ' ');
          textContent = textNodeToModify.textContent || '';
        }

        // Add space before if needed (after normalization); a link that
        // continues the preceding word or token stays attached to it
        if (textNodeToModify && !isCodeNeighbor && textContent.trim() && !endsWithWhitespace(textContent) && !endsWithOpeningPunctuation(textContent) &&
            !LINK_CONTINUES_TEXT_RE.test(textContent)) {
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

      if (nextSibling && !isWhitespaceText(nextSibling)) {
        let nextTextNode: Text | null = null;
        let nextText = '';

        if (nextSibling.nodeType === Node.TEXT_NODE) {
          nextTextNode = nextSibling as Text;
          nextText = nextSibling.textContent || '';
        } else if (nextSibling.nodeType === Node.ELEMENT_NODE) {
          // Next sibling is an element - get its first text node
          const firstText = getFirstTextNodeFromElement(nextSibling as Element);
          if (firstText) {
            nextTextNode = firstText;
            nextText = firstText.textContent || '';
          }
        }

        const isCodeNeighbor = nextTextNode !== null && isCodeText(nextTextNode);

        // Normalize multiple spaces
        if (nextTextNode && !isCodeNeighbor) {
          nextTextNode.textContent = nextText.replace(COLLAPSIBLE_WHITESPACE_RE, ' ');
          nextText = nextTextNode.textContent || '';
        }

        // Add space after if needed; a word continuation or a footnote marker
        // in <sup>/<sub> stays attached to the link
        if (nextTextNode && !isCodeNeighbor && nextText.trim() && !WHITESPACE_START_RE.test(nextText) && !CLOSING_PUNCTUATION_RE.test(nextText) &&
            !WORD_CONTINUATION_RE.test(nextText) && !nextTextNode.parentElement?.closest('sup, sub')) {
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

