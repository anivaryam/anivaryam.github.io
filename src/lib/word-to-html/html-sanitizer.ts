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
    parseInt(styleObj['font-weight']) >= 700
  ) || false;
  const isSuperscript = styleObj['vertical-align'] && (
    styleObj['vertical-align'].toLowerCase() === 'super' ||
    styleObj['vertical-align'].includes('super') ||
    styleObj['vertical-align'].includes('35%') ||
    styleObj['vertical-align'].includes('0.6')
  ) || false;
  const isSubscript = styleObj['vertical-align'] && (
    styleObj['vertical-align'].toLowerCase() === 'sub' ||
    styleObj['vertical-align'].includes('sub') ||
    styleObj['vertical-align'].includes('-35%') ||
    styleObj['vertical-align'].includes('-0.6')
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

  const tempDiv = document.createElement('div');
  tempDiv.innerHTML = html;

  sanitizeElement(tempDiv);

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
      // For <li> elements, skip wrapping at the li level - let children handle their own formatting
      
      const isListItem = tagName === 'li';
      
      if (formatting) {
        // Sanitize children first
        sanitizeElement(node);
        
        // For <li> elements, wrap children with <em>/<strong> if they have font-style formatting
        // This preserves the <li> element while adding italic/bold to content
        if (isListItem) {
          const { isItalic, isBold } = formatting;
          
          // Only wrap if there's italic or bold formatting
          if (isItalic || isBold) {
            const wrapper: Element[] = [];
            
            if (isItalic && isBold) {
              const strong = document.createElement('strong');
              const em = document.createElement('em');
              while (node.firstChild) {
                em.appendChild(node.firstChild);
              }
              strong.appendChild(em);
              wrapper.push(strong);
            } else if (isItalic) {
              const em = document.createElement('em');
              while (node.firstChild) {
                em.appendChild(node.firstChild);
              }
              wrapper.push(em);
            } else if (isBold) {
              const strong = document.createElement('strong');
              while (node.firstChild) {
                strong.appendChild(node.firstChild);
              }
              wrapper.push(strong);
            }
            
            // Append wrappers to li
            wrapper.forEach(w => node.appendChild(w));
          }
        } else {
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

    // Remove presentational and unsafe attributes
    // Note: ARIA attributes are removed as they're considered accessibility metadata,
    // not core HTML semantics (which are preserved via element types)
    if (attrName === 'style' || 
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
function cleanUrl(url: string): string {
  if (!url || typeof url !== 'string') {
    return url;
  }

  try {
    let cleaned = decodeURIComponent(url);
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
    
    if (cleaned !== decodeURIComponent(url)) {
      try {
        const urlObj = new URL(cleaned, window.location.href);
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

function isSafeUrl(url: string): boolean {
  if (!url || typeof url !== 'string') {
    return false;
  }

  try {
    if (url.startsWith('/') || url.startsWith('#')) {
      return true;
    }

    const urlObj = new URL(url, window.location.href);
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

