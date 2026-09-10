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
 * - URL destinations are preserved; only surrounding whitespace is trimmed
 */

import DOMPurify from 'dompurify';
import { BLOCK_ELEMENT_SET } from './html-cleaner';

// Note: 'i' and 'b' are normalized to 'em' and 'strong' during processing
export const ALLOWED_ELEMENTS = [
  'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
  'p', 'br', 'hr',
  'ul', 'ol', 'li',
  'em', 'strong',
  'u',
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

// These containers cannot accept an inline formatting wrapper around their children.
const STRUCTURAL_CHILDREN = new Map<string, readonly string[]>([
  ['ol', ['li']],
  ['ul', ['li']],
  ['table', ['thead', 'tbody', 'tr']],
  ['thead', ['tr']],
  ['tbody', ['tr']],
  ['tr', ['th', 'td']],
]);

/** Shared by validation and preview highlights to catch structural cleanup failures. */
export function getStructuralIssues(root: Element): { element: Element; message: string }[] {
  const issues: { element: Element; message: string }[] = [];
  for (const element of [root, ...Array.from(root.querySelectorAll('*'))]) {
    const tag = element.tagName.toLowerCase();
    const allowedChildren = STRUCTURAL_CHILDREN.get(tag);
    if (allowedChildren && Array.from(element.childNodes).some(node =>
      node.nodeType === Node.ELEMENT_NODE
        ? !allowedChildren.includes((node as Element).tagName.toLowerCase())
        : node.nodeType === Node.TEXT_NODE && !!node.textContent?.trim()
    )) {
      issues.push({ element, message: `Invalid child structure in <${tag}>; expected ${allowedChildren.map(child => `<${child}>`).join(', ')}` });
    }
    if (tag === 'li' && !element.parentElement?.matches('ol, ul')) {
      issues.push({ element, message: 'List item must be a direct child of <ol> or <ul>' });
    }
    if (tag === 'li' && element.querySelector('p')) {
      issues.push({ element, message: 'Uncleaned paragraph wrapper inside <li>' });
    }
  }
  return issues;
}

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
  const verticalAlign = styleObj['vertical-align']?.toLowerCase() || '';
  const offset = parseFloat(verticalAlign);
  const isSuperscript = verticalAlign === 'super' || offset > 0;
  const isSubscript = verticalAlign === 'sub' || offset < 0;
  
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
function convertFormattingToSemanticTags(
  element: Element,
  formatting = extractFormatting(element.getAttribute('style') || '')
): Element | null {
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

/**
 * Wraps consecutive inline nodes without reordering text or enclosing structural
 * blocks. Used by Sources formatting and block-copy paragraph grouping.
 */
export function wrapInlineContent(element: Element, tagName: string): void {
  let wrapper: Element | null = null;
  for (const child of Array.from(element.childNodes)) {
    if (child.nodeType === Node.ELEMENT_NODE) {
      const childTag = (child as Element).tagName.toLowerCase();
      if (BLOCK_ELEMENT_SET.has(childTag) || ['img', 'hr', 'br'].includes(childTag)) {
        wrapper = null;
        continue;
      }
    }
    if (child.nodeType !== Node.TEXT_NODE && child.nodeType !== Node.ELEMENT_NODE) continue;
    if (!wrapper) {
      if (child.nodeType === Node.TEXT_NODE && !child.textContent?.trim()) continue;
      wrapper = element.ownerDocument.createElement(tagName);
      element.insertBefore(wrapper, child);
    }
    wrapper.appendChild(child);
  }
}

export function sanitizeHtml(html: string): string {
  if (!html || typeof html !== 'string') {
    return '';
  }


  const tempDiv = document.createElement('div');
  // Reuse DOMPurify before semantic cleanup. Keep inline styles
  // long enough to extract formatting, but discard script/stylesheet contents.
  tempDiv.innerHTML = DOMPurify.sanitize(html, {
    FORBID_TAGS: ['style'],
    ADD_ATTR: ['target'],
  });

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
    if (tagName === 'i' || tagName === 'b') {
      sanitizeElement(node);
      const semantic = document.createElement(tagName === 'b' ? 'strong' : 'em');
      while (node.firstChild) {
        semantic.appendChild(node.firstChild);
      }
      node.appendChild(semantic);
      // Preserve styles on b/i before discarding the original element. The
      // semantic tag already supplies bold/italic, so avoid duplicate wrappers.
      const formatting = extractFormatting(node.getAttribute('style') || '');
      if (formatting) {
        if (tagName === 'b') formatting.isBold = false;
        else formatting.isItalic = false;
      }
      const replacement = convertFormattingToSemanticTags(node, formatting);
      node.replaceWith(replacement || semantic);
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
      
      // === LIFT AND SCRUB FOR LI ELEMENTS ===
      // Inside-Out Rule:
      // 1. First sanitize children: convert span styles to semantic tags (strong/em)
      // 2. Then strip all attributes from LI
      // 3. IGNORE LI's own styling - don't propagate to children
      //    (child spans' formatting is preserved; LI's formatting is discarded)
      
      const isListItem = tagName === 'li';
      
      if (isListItem) {
        // Step 1: First sanitize children to convert span styles to semantic tags
        sanitizeElement(node);
        
        // Step 2: Strip all attributes from LI (including style)
        // LI's own font-weight/font-style is IGNORED - not propagated to children
        sanitizeAttributes(node, tagName);
        
        continue;
      }
      
      // Always clean descendants, including beneath styled semantic elements.
      sanitizeElement(node);
      if (formatting && !STRUCTURAL_CHILDREN.has(tagName) && tagName !== 'blockquote') {
        const wrapper = convertFormattingToSemanticTags(node, formatting);
        if (wrapper) node.appendChild(wrapper);
      }

      // Extract formatting before removing style/class/unsafe attributes.
      sanitizeAttributes(node, tagName);
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
  });

  attrsToRemove.forEach(attrName => {
    element.removeAttribute(attrName);
  });

  // Apply this after rel filtering so a rejected rel cannot remove noopener.
  if (tagName === 'a' && element.getAttribute('target')?.toLowerCase() === '_blank') {
    const rel = (element.getAttribute('rel') || '').toLowerCase();
    if (!NOOPENER_REGEX.test(rel)) {
      element.setAttribute('rel', rel ? `${rel} noopener` : 'noopener');
    }
  }
}

/**
 * Trim clipboard padding without rewriting destinations. Hyphens, Unicode,
 * encoding, query values, and relative paths are part of the URL contract.
 */
function cleanUrl(url: string): string {
  return url.trim();
}

export function isSafeUrl(url: string, baseUrl: string = ''): boolean {
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
