/**
 * HTML Sanitizer
 * 
 * Removes all styling and unsafe attributes while preserving HTML semantic structure.
 * Note: This preserves HTML element semantics (h1, p, table, etc.) but removes
 * accessibility attributes (ARIA, role) as they are considered presentational metadata.
 * 
 * Behavior:
 * - Allowed elements (p, h1, etc.) are preserved; formatting styles become inner wrappers
 * - Disallowed elements (span, div, etc.) are unwrapped; formatting styles replace the element
 * - Formatting is normalized: i→em, b→strong, style attributes→semantic tags
 * - Superscript/subscript wrap italic/bold (outer tags)
 * - URLs are normalized (not just validated) to handle Word-exported HTML encoding issues
 */

// Note: 'i' and 'b' are normalized to 'em' and 'strong' during processing
const ALLOWED_ELEMENTS = [
  'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
  'p', 'br', 'hr',
  'ul', 'ol', 'li',
  'em', 'strong',
  'sup', 'sub',
  'a',
  'img',
  'blockquote', 'pre', 'code',
  'table', 'thead', 'tbody', 'tr', 'th', 'td'
];

const ALLOWED_ATTRIBUTES: Record<string, string[]> = {
  'a': ['href', 'target', 'rel'],
  'img': ['src', 'alt'],
  '*': []
};

const SAFE_PROTOCOLS = ['http:', 'https:', 'mailto:'];
const SAFE_REL_VALUES = ['nofollow', 'noopener', 'noreferrer', 'noopener,noreferrer'];
const NOOPENER_REGEX = /\bnoopener\b/i;

/**
 * Extracts formatting information from an element's style attribute
 * Returns null if no formatting is detected
 */
interface FormattingInfo {
  isItalic: boolean;
  isBold: boolean;
  isSuperscript: boolean;
  isSubscript: boolean;
}

function extractFormatting(style: string): FormattingInfo | null {
  if (!style) return null;
  
  const styleObj: Record<string, string> = {};
  style.split(';').forEach(rule => {
    const parts = rule.split(':').map(s => s.trim());
    if (parts.length === 2) {
      styleObj[parts[0].toLowerCase()] = parts[1];
    }
  });
  
  const isItalic = styleObj['font-style']?.toLowerCase().includes('italic') || false;
  const isBold = styleObj['font-weight'] && (
    styleObj['font-weight'].toLowerCase() === 'bold' || 
    parseInt(styleObj['font-weight'], 10) >= 700
  ) || false;
  const isSuperscript = styleObj['vertical-align'] && (
    styleObj['vertical-align'].toLowerCase() === 'super' ||
    styleObj['vertical-align'].includes('super') ||
    /^[\d.]+%?$/.test(styleObj['vertical-align']) ||
    !isNaN(parseFloat(styleObj['vertical-align']))
  ) || false;
  const isSubscript = styleObj['vertical-align'] && (
    styleObj['vertical-align'].toLowerCase() === 'sub' ||
    styleObj['vertical-align'].includes('sub') ||
    styleObj['vertical-align'].startsWith('-')
  ) || false;
  
  if (!isItalic && !isBold && !isSuperscript && !isSubscript) {
    return null;
  }
  
  return { isItalic, isBold, isSuperscript, isSubscript };
}

/**
 * Converts formatting styles to semantic HTML tags
 * Moves (not clones) child nodes to preserve references
 * 
 * Note: For disallowed elements, this replaces the element entirely.
 * For allowed elements, formatting is applied as inner wrappers (see sanitizeElement).
 * 
 * Tag nesting order: sup/sub (outer) wraps em/strong (inner)
 * This is an opinionated choice - sup/sub are treated as structural modifiers.
 */
function convertFormattingToSemanticTags(element: Element): Element | null {
  const style = element.getAttribute('style') || '';
  const formatting = extractFormatting(style);
  
  if (!formatting) return null;
  
  const { isItalic, isBold, isSuperscript, isSubscript } = formatting;
  
  // Build nested semantic tags: sup/sub wraps em/strong (opinionated order)
  let wrapper: Element | null = null;
  
  // Handle italic and bold (inner tags)
  if (isItalic && isBold) {
    wrapper = document.createElement('strong');
    const em = document.createElement('em');
    // Move children (not clone) to preserve references
    while (element.firstChild) {
      em.appendChild(element.firstChild);
    }
    wrapper.appendChild(em);
  } else if (isItalic) {
    wrapper = document.createElement('em');
    while (element.firstChild) {
      wrapper.appendChild(element.firstChild);
    }
  } else if (isBold) {
    wrapper = document.createElement('strong');
    while (element.firstChild) {
      wrapper.appendChild(element.firstChild);
    }
  }
  
  // Handle superscript/subscript (outer tags)
  if (isSuperscript) {
    const sup = document.createElement('sup');
    if (wrapper) {
      sup.appendChild(wrapper);
    } else {
      // If no italic/bold, move children directly
      while (element.firstChild) {
        sup.appendChild(element.firstChild);
      }
    }
    wrapper = sup;
  } else if (isSubscript) {
    const sub = document.createElement('sub');
    if (wrapper) {
      sub.appendChild(wrapper);
    } else {
      // If no italic/bold, move children directly
      while (element.firstChild) {
        sub.appendChild(element.firstChild);
      }
    }
    wrapper = sub;
  }
  
  return wrapper;
}

export function sanitizeHtml(html: string): string {
  if (!html || typeof html !== 'string') {
    return '';
  }

  // DEBUG: Log input
  console.log('=== sanitizeHtml: INPUT ===');
  console.log(html.substring(0, 500));

  const tempDiv = document.createElement('div');
  tempDiv.innerHTML = html;

  sanitizeElement(tempDiv);

  // DEBUG: Log output
  console.log('=== sanitizeHtml: OUTPUT ===');
  console.log(tempDiv.innerHTML.substring(0, 500));

  // Unwrap single disallowed wrapper elements
  if (tempDiv.children.length === 1) {
    const onlyChild = tempDiv.children[0];
    const tagName = onlyChild.tagName.toLowerCase();
    if (!ALLOWED_ELEMENTS.includes(tagName)) {
      const fragment = document.createDocumentFragment();
      while (onlyChild.firstChild) {
        fragment.appendChild(onlyChild.firstChild);
      }
      tempDiv.innerHTML = '';
      tempDiv.appendChild(fragment);
    }
  }

  return tempDiv.innerHTML;
}


function sanitizeElement(element: Element): void {
  const nodesToProcess = Array.from(element.childNodes).filter(
    node => node.nodeType === Node.ELEMENT_NODE
  );
  
  for (let i = 0; i < nodesToProcess.length; i++) {
    const node = nodesToProcess[i] as Element;
    const tagName = node.tagName.toLowerCase();

    // Normalize i/b tags to em/strong (these are not in ALLOWED_ELEMENTS)
    if (tagName === 'i') {
      // Sanitize children first, then replace element
      sanitizeElement(node);
      const em = document.createElement('em');
      while (node.firstChild) {
        em.appendChild(node.firstChild);
      }
      if (node.parentNode) {
        node.parentNode.replaceChild(em, node);
        // No need to sanitize em - it's already an allowed element with sanitized children
      }
      continue;
    } else if (tagName === 'b') {
      // Sanitize children first, then replace element
      sanitizeElement(node);
      const strong = document.createElement('strong');
      while (node.firstChild) {
        strong.appendChild(node.firstChild);
      }
      if (node.parentNode) {
        node.parentNode.replaceChild(strong, node);
        // No need to sanitize strong - it's already an allowed element with sanitized children
      }
      continue;
    }

    if (!ALLOWED_ELEMENTS.includes(tagName)) {
      // For disallowed elements: sanitize children, then either replace with formatting
      // or unwrap entirely
      sanitizeElement(node);
      
      const semanticReplacement = convertFormattingToSemanticTags(node);
      
      if (semanticReplacement) {
        // Replace disallowed element with formatting tags
        if (node.parentNode) {
          node.parentNode.replaceChild(semanticReplacement, node);
          // Sanitize the replacement to handle any nested formatting
          sanitizeElement(semanticReplacement);
        }
      } else {
        // No formatting found, just unwrap
        unwrapElement(node);
      }
    } else {
      // For allowed elements: preserve the element, apply formatting as inner wrappers
      // Extract formatting BEFORE sanitizing attributes (which removes style)
      const style = node.getAttribute('style') || '';
      const formatting = extractFormatting(style);
      
      // Handle formatting styles on allowed elements (becomes inner wrappers)
      // For <li> elements: remove style attribute, don't add em/strong tags
      
      const isListItem = tagName === 'li';
      
      // For LI elements with formatting: remove style attribute, don't wrap children
      if (isListItem && formatting) {
        // Just sanitize children, preserve style attribute (handled in sanitizeAttributes)
        sanitizeElement(node);
        sanitizeAttributes(node, tagName);
        continue;
      }
      
      // DEBUG
      if (isListItem) {
        const style = node.getAttribute('style') || '';
        console.log('=== html-sanitizer: Processing LI ===');
        console.log('LI outerHTML:', node.outerHTML.substring(0, 300));
        console.log('style:', style);
        const formatting = extractFormatting(style);
        console.log('formatting:', formatting);
        const hasChildElements = Array.from(node.childNodes).some(c => c.nodeType === Node.ELEMENT_NODE);
        console.log('hasChildElements:', hasChildElements);
        if (hasChildElements) {
          const children = Array.from(node.children);
          console.log('children:', children.map(c => c.tagName));
        }
      }
      
      // Check if li has child elements (not just text)
      let hasChildElements = false;
      if (isListItem) {
        const childNodes = Array.from(node.childNodes);
        hasChildElements = childNodes.some(
          child => child.nodeType === Node.ELEMENT_NODE
        );
      }
      
      // Check if LI already has em/strong children - if so, just sanitize, don't modify
      let hasExistingEmphasis = false;
      if (isListItem && hasChildElements) {
        const childElements = Array.from(node.children);
        hasExistingEmphasis = childElements.some(
          child => child.tagName.toLowerCase() === 'em' || child.tagName.toLowerCase() === 'strong'
        );
      }
      
      // If LI already has em/strong, just remove style and sanitize children - don't modify tags
      if (isListItem && hasExistingEmphasis) {
        sanitizeElement(node);
        sanitizeAttributes(node, tagName);
        continue;
      }
      
      if (formatting) {
        // Sanitize children first
        sanitizeElement(node);
        
        // For <li> elements, only skip wrapping if they have child elements that can handle formatting
        // If li has only text content, we need to wrap it to preserve formatting
        // (wrapping entire li was causing issues when it has nested lists or other elements)
        if (!isListItem || (isListItem && !hasChildElements)) {
          // Original logic for non-li elements
          const { isItalic, isBold, isSuperscript, isSubscript } = formatting;
          let wrapper: Element | null = null;
          
          // Build nested semantic tags
          if (isItalic && isBold) {
            wrapper = document.createElement('strong');
            const em = document.createElement('em');
            while (node.firstChild) {
              em.appendChild(node.firstChild);
            }
            wrapper.appendChild(em);
          } else if (isItalic) {
            wrapper = document.createElement('em');
            while (node.firstChild) {
              wrapper.appendChild(node.firstChild);
            }
          } else if (isBold) {
            wrapper = document.createElement('strong');
            while (node.firstChild) {
              wrapper.appendChild(node.firstChild);
            }
          }
          
          // Handle superscript/subscript (outer tags - opinionated nesting order)
          if (isSuperscript) {
            const sup = document.createElement('sup');
            if (wrapper) {
              sup.appendChild(wrapper);
            } else {
              while (node.firstChild) {
                sup.appendChild(node.firstChild);
              }
            }
            wrapper = sup;
          } else if (isSubscript) {
            const sub = document.createElement('sub');
            if (wrapper) {
              sub.appendChild(wrapper);
            } else {
              while (node.firstChild) {
                sub.appendChild(node.firstChild);
              }
            }
            wrapper = sub;
          }
          
          if (wrapper) {
            node.innerHTML = '';
            node.appendChild(wrapper);
          }
        } else if (isListItem && hasChildElements) {
          // LI has child elements (like nested lists) - wrap only text nodes, preserve elements
          // This ensures italic/bold formatting is preserved for the text content
          const { isItalic, isBold, isSuperscript, isSubscript } = formatting;
          
          // Collect all direct child nodes that are text or inline elements (not block elements)
          const directChildren = Array.from(node.childNodes);
          const textAndInlineNodes: Node[] = [];
          const blockElements: Element[] = [];
          
          directChildren.forEach(child => {
            if (child.nodeType === Node.TEXT_NODE) {
              if (child.textContent?.trim()) {
                textAndInlineNodes.push(child);
              }
            } else if (child.nodeType === Node.ELEMENT_NODE) {
              const childTag = (child as Element).tagName.toLowerCase();
              // Skip if already formatted - preserve as-is outside the wrapper
              const skipTags = ['strong', 'em', 'a', 'sup', 'sub'];
              if (skipTags.includes(childTag)) {
                // Preserve this element as-is outside the wrapper
                blockElements.push(child as Element);
                return;
              }
              // Check if it's an inline element that should be wrapped
              const inlineTags = ['span', 'code'];
              if (inlineTags.includes(childTag)) {
                textAndInlineNodes.push(child);
              } else {
                // It's a block element (like ul, ol) - preserve it outside the wrapper
                blockElements.push(child as Element);
              }
            }
          });
          
          if (textAndInlineNodes.length > 0) {
            // Build wrapper for inline content
            let wrapper: Element | null = null;
            
            if (isItalic && isBold) {
              wrapper = document.createElement('strong');
              const em = document.createElement('em');
              textAndInlineNodes.forEach(child => em.appendChild(child));
              wrapper.appendChild(em);
            } else if (isItalic) {
              wrapper = document.createElement('em');
              textAndInlineNodes.forEach(child => wrapper!.appendChild(child));
            } else if (isBold) {
              wrapper = document.createElement('strong');
              textAndInlineNodes.forEach(child => wrapper!.appendChild(child));
            }
            
            // Handle superscript/subscript (outer tags)
            if (isSuperscript) {
              const sup = document.createElement('sup');
              if (wrapper) {
                sup.appendChild(wrapper);
              }
              wrapper = sup;
            } else if (isSubscript) {
              const sub = document.createElement('sub');
              if (wrapper) {
                sub.appendChild(wrapper);
              }
              wrapper = sub;
            }
            
            if (wrapper) {
              // Rebuild LI: wrapper for inline content + block elements
              node.innerHTML = '';
              node.appendChild(wrapper);
              blockElements.forEach(el => node.appendChild(el));
            }
          }
        }
      }
      
      // Sanitize attributes (removes style, class, ARIA, etc.)
      sanitizeAttributes(node, tagName);
      
      // Recursively sanitize children if no formatting was applied
      if (!formatting) {
        sanitizeElement(node);
      }
    }
  }
}

function sanitizeAttributes(element: Element, tagName: string): void {
  const allowedAttrs = ALLOWED_ATTRIBUTES[tagName] || ALLOWED_ATTRIBUTES['*'] || [];
  const attrsToRemove: string[] = [];

  Array.from(element.attributes).forEach(attr => {
    const attrName = attr.name.toLowerCase();

    // Always remove style attributes (including on LI elements)
    const isStyleAttr = attrName === 'style';
    
    if (isStyleAttr || 
        attrName === 'class' || 
        attrName.startsWith('data-') ||
        attrName.startsWith('on') ||
        attrName === 'id' ||
        attrName === 'dir' ||
        attrName === 'role' ||
        attrName === 'aria-level') {
      attrsToRemove.push(attr.name);
      return;
    }

    if (!allowedAttrs.includes(attrName)) {
      attrsToRemove.push(attr.name);
      return;
    }

    if (attrName === 'href' || attrName === 'src') {
      const cleanedUrl = cleanUrl(attr.value);
      if (cleanedUrl !== attr.value) {
        element.setAttribute(attr.name, cleanedUrl);
      }
      
      if (!isSafeUrl(cleanedUrl)) {
        attrsToRemove.push(attr.name);
      }
    }

    if (tagName === 'a' && attrName === 'rel') {
      const relValue = attr.value.toLowerCase();
      const relParts = relValue.split(/\s+/).filter(p => p);
      const isValidRel = relParts.every(part => SAFE_REL_VALUES.includes(part));
      if (!isValidRel) {
        attrsToRemove.push(attr.name);
      }
    }

    if (tagName === 'a' && attrName === 'target' && attr.value.toLowerCase() === '_blank') {
      const relAttr = element.getAttribute('rel');
      const relValue = relAttr ? relAttr.toLowerCase() : '';
      if (!NOOPENER_REGEX.test(relValue)) {
        const newRel = relValue ? relValue + ' noopener' : 'noopener';
        element.setAttribute('rel', newRel);
      }
    }
  });

  attrsToRemove.forEach(attrName => {
    element.removeAttribute(attrName);
  });
}

/**
 * Normalizes URLs by cleaning up encoding issues and normalizing whitespace
 * Note: This function normalizes URLs (changes their form) before validation.
 * This is intentional for handling Word-exported HTML with encoding issues.
 */
function cleanUrl(url: string, baseUrl: string = ''): string {
  if (!url || typeof url !== 'string') {
    return url;
  }

  try {
    let cleaned = url;
    // Normalize various dash types to standard hyphen
    cleaned = cleaned.replace(/[\u2011\u2012\u2013\u2014\u2015]/g, '-');
    // Normalize non-breaking spaces
    cleaned = cleaned.replace(/\u00A0/g, ' ');
    // Normalize whitespace sequences to single hyphens
    cleaned = cleaned.replace(/\s+/g, '-');
    // Collapse multiple hyphens
    cleaned = cleaned.replace(/-+/g, '-');
    // Remove hyphens adjacent to slashes
    cleaned = cleaned.replace(/\/-+/g, '/').replace(/-+\//g, '/');
    
    if (cleaned !== url) {
      try {
        const urlObj = new URL(cleaned, baseUrl || window.location.href);
        const cleanPath = urlObj.pathname
          .split('/')
          .map(segment => encodeURIComponent(decodeURIComponent(segment)))
          .join('/');
        return urlObj.origin + cleanPath + urlObj.search + urlObj.hash;
      } catch (e) {
        return cleaned;
      }
    }
    
    return url;
  } catch (e) {
    // Fallback: handle URL-encoded dash variants
    let cleaned = url.replace(/%E2%80%91/g, '-')
                    .replace(/%E2%80%93/g, '-')
                    .replace(/%E2%80%94/g, '-')
                    .replace(/%E2%80%95/g, '-')
                    .replace(/%C2%A0/g, '-');
    cleaned = cleaned.replace(/-+/g, '-');
    return cleaned;
  }
}

function isSafeUrl(url: string, baseUrl: string = ''): boolean {
  if (!url || typeof url !== 'string') {
    return false;
  }

  try {
    if (url.startsWith('/') || url.startsWith('#')) {
      return true;
    }

    const urlObj = new URL(url, baseUrl || window.location.href);
    return SAFE_PROTOCOLS.includes(urlObj.protocol);
  } catch (e) {
    return url.startsWith('/') || url.startsWith('#');
  }
}

function unwrapElement(element: Element): void {
  const fragment = document.createDocumentFragment();
  while (element.firstChild) {
    fragment.appendChild(element.firstChild);
  }
  
  if (element.parentNode) {
    element.parentNode.insertBefore(fragment, element);
    element.remove();
  }
}

