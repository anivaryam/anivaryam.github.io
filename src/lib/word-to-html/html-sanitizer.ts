/**
 * HTML Sanitizer
 * 
 * Removes all styling and unsafe attributes while preserving HTML semantic structure.
 * Note: This preserves HTML element semantics (h1, p, table, etc.) but removes
 * accessibility attributes (ARIA, role) as they are considered presentational metadata.
 * 
 * Behavior:
 * - Allowed elements (p, h1, etc.) are preserved; formatting styles become inner wrappers
 * - Layout blocks retain paragraph boundaries; unsupported inline wrappers are unwrapped
 * - Formatting is normalized: i→em, b→strong, underline/bold/italic styles→semantic tags
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
  'ol': ['start', 'reversed', 'type'],
  'th': ['colspan', 'rowspan'],
  'td': ['colspan', 'rowspan'],
  '*': []
};

// Non-default <ol type> values; the value is case-sensitive. type="1" is the
// default decimal numbering and is dropped, like start="1".
const OL_TYPES = ['a', 'A', 'i', 'I'];
// CSS list numbering with an <ol type> equivalent.
const LIST_STYLE_TYPES: Record<string, string> = {
  'decimal': '1',
  'lower-alpha': 'a', 'lower-latin': 'a',
  'upper-alpha': 'A', 'upper-latin': 'A',
  'lower-roman': 'i',
  'upper-roman': 'I',
};

const SAFE_PROTOCOLS = ['http:', 'https:', 'mailto:'];
// rel is a space-separated token list; "noopener,noreferrer" is one unknown token
export const SAFE_REL_VALUES = ['nofollow', 'noopener', 'noreferrer'];
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
  isUnderline: boolean;
}

function parseStyle(style: string): Record<string, string> {
  const styleObj: Record<string, string> = {};
  style.split(';').forEach(rule => {
    const parts = rule.split(':').map(s => s.trim());
    if (parts.length === 2) {
      styleObj[parts[0].toLowerCase()] = parts[1];
    }
  });
  return styleObj;
}

function extractFormatting(style: string): FormattingInfo | null {
  if (!style) return null;

  const styleObj = parseStyle(style);
  
  const isItalic = styleObj['font-style']?.toLowerCase().includes('italic') || false;
  const isBold = styleObj['font-weight'] && (
    styleObj['font-weight'].toLowerCase() === 'bold' || 
    parseInt(styleObj['font-weight'], 10) >= 700
  ) || false;
  const verticalAlign = styleObj['vertical-align']?.toLowerCase() || '';
  const offset = parseFloat(verticalAlign);
  const isSuperscript = verticalAlign === 'super' || offset > 0;
  const isSubscript = verticalAlign === 'sub' || offset < 0;
  const isUnderline = (styleObj['text-decoration-line'] ?? styleObj['text-decoration'] ?? '')
    .toLowerCase().split(/\s+/).includes('underline');
  
  if (!isItalic && !isBold && !isSuperscript && !isSubscript && !isUnderline) {
    return null;
  }
  
  return { isItalic, isBold, isSuperscript, isSubscript, isUnderline };
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
  
  const { isItalic, isBold, isSuperscript, isSubscript, isUnderline } = formatting;
  
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
  
  if (isUnderline) {
    const underline = document.createElement('u');
    if (wrapper) underline.appendChild(wrapper);
    else while (element.firstChild) underline.appendChild(element.firstChild);
    wrapper = underline;
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
 * blocks or optional feature-specific boundaries. Used by Sources formatting,
 * underline cleanup, and block-copy paragraph grouping. Returns the wrappers.
 */
export function wrapInlineContent(element: Element, tagName: string, isBoundary?: (child: Element) => boolean): Element[] {
  const wrappers: Element[] = [];
  let wrapper: Element | null = null;
  for (const child of Array.from(element.childNodes)) {
    if (child.nodeType === Node.ELEMENT_NODE) {
      const childTag = (child as Element).tagName.toLowerCase();
      if (BLOCK_ELEMENT_SET.has(childTag) || ['img', 'hr', 'br'].includes(childTag) || isBoundary?.(child as Element)) {
        wrapper = null;
        continue;
      }
    }
    if (child.nodeType !== Node.TEXT_NODE && child.nodeType !== Node.ELEMENT_NODE) continue;
    if (!wrapper) {
      if (child.nodeType === Node.TEXT_NODE && !child.textContent?.trim()) continue;
      wrapper = element.ownerDocument.createElement(tagName);
      element.insertBefore(wrapper, child);
      wrappers.push(wrapper);
    }
    wrapper.appendChild(child);
  }
  return wrappers;
}

/**
 * Wraps the inline runs of an element and of its block descendants, so no
 * wrapper encloses a block. Excluded elements stay outside every wrapper: runs
 * are split around them, and elements containing them are wrapped inside.
 * Returns the wrappers.
 */
function wrapInlineRuns(element: Element, tagName: string, isExcluded: (child: Element) => boolean = () => false): Element[] {
  const containsExcluded = (child: Element) => isExcluded(child) || Array.from(child.querySelectorAll('*')).some(isExcluded);
  const wrappers: Element[] = [];
  for (const child of Array.from(element.children)) {
    if (!isExcluded(child) && (containsExcluded(child) || BLOCK_ELEMENT_SET.has(child.tagName.toLowerCase()))) {
      wrappers.push(...wrapInlineRuns(child, tagName, isExcluded));
    }
  }
  return [...wrappers, ...wrapInlineContent(element, tagName, containsExcluded)];
}

/** Preserve non-link underlining when a source <u> also surrounds links. */
function underlineNonLinkContent(element: Element): void {
  wrapInlineRuns(element, 'u', child => child.matches('a[href]'));
}

// Bold and italic are inherited; a descendant's explicit normal weight or
// style cancels them. Semibold (500/600) is not treated as a cancellation.
const EMPHASES = [
  {
    tags: ['b', 'strong'],
    property: 'font-weight',
    isSet: (formatting: FormattingInfo) => formatting.isBold,
    isCancelledBy: (value: string) => value.toLowerCase() === 'normal' || parseInt(value, 10) <= 400,
  },
  {
    tags: ['i', 'em'],
    property: 'font-style',
    isSet: (formatting: FormattingInfo) => formatting.isItalic,
    isCancelledBy: (value: string) => value.toLowerCase() === 'normal',
  },
];

/**
 * Keep source emphasis exact where a descendant cancels inherited bold or
 * italic. An emphasis tag whose own style cancels it becomes a <span>. Each
 * emphasized ancestor of a cancelling element passes its emphasis to its
 * inline runs as <b>/<i> instead, and the runs skip the cancelling element.
 * Word cleanup runs this before it drops `font-style: normal` as a default.
 */
export function splitEmphasisOverrides(root: Element): void {
  for (const { tags, property, isSet, isCancelledBy } of EMPHASES) {
    const cancels = (element: Element) => {
      const value = parseStyle(element.getAttribute('style') || '')[property];
      return value !== undefined && isCancelledBy(value);
    };
    // The sanitizer ignores formatting on list items and table/list containers.
    const provides = (element: Element) => {
      const tag = element.tagName.toLowerCase();
      if (cancels(element)) return false;
      if (tags.includes(tag)) return true;
      const formatting = extractFormatting(element.getAttribute('style') || '');
      return !!formatting && isSet(formatting) && tag !== 'li' && !STRUCTURAL_CHILDREN.has(tag);
    };
    const toSpan = (element: Element) => {
      const span = element.ownerDocument.createElement('span');
      Array.from(element.attributes).forEach(attr => span.setAttribute(attr.name, attr.value));
      span.append(...Array.from(element.childNodes));
      element.replaceWith(span);
      return span;
    };

    root.querySelectorAll(tags.join(', ')).forEach(element => {
      if (cancels(element)) toSpan(element);
    });

    for (const override of Array.from(root.querySelectorAll('[style]')).filter(cancels)) {
      let ancestor = override.parentElement;
      while (ancestor && ancestor !== root) {
        const parent = ancestor.parentElement;
        if (provides(ancestor)) {
          const plain = tags.includes(ancestor.tagName.toLowerCase()) ? toSpan(ancestor) : ancestor;
          const style = (plain.getAttribute('style') || '').split(';')
            .filter(rule => rule.split(':')[0].trim().toLowerCase() !== property).join(';').trim();
          if (style) plain.setAttribute('style', style);
          else plain.removeAttribute('style');
          wrapInlineRuns(plain, tags[0], element => cancels(element) || provides(element));
        }
        ancestor = parent;
      }
    }
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

  splitEmphasisOverrides(tempDiv);

  // <caption> is not allowed, and its unwrapped text would be moved out of the
  // table when the HTML is parsed again. Keep it as a layout block directly
  // before its table, where browsers render a caption by default.
  tempDiv.querySelectorAll('table > caption').forEach(caption => {
    const block = document.createElement('div');
    const style = caption.getAttribute('style');
    if (style) block.setAttribute('style', style);
    block.append(...Array.from(caption.childNodes));
    caption.parentElement!.before(block);
    caption.remove();
  });

  // Word Online can mark a heading with ARIA on a paragraph instead of an
  // <h1>-<h6>. Keep its level before attribute cleanup drops role and
  // aria-level. A block holding other blocks is a layout wrapper, not a heading.
  tempDiv.querySelectorAll('p[role][aria-level], div[role][aria-level]').forEach(block => {
    const level = block.getAttribute('aria-level')!.trim();
    if (block.getAttribute('role')!.trim().toLowerCase() !== 'heading' || !/^[1-6]$/.test(level)) return;
    if (Array.from(block.querySelectorAll('*')).some(child => BLOCK_ELEMENT_SET.has(child.tagName.toLowerCase()))) return;
    const heading = document.createElement(`h${level}`);
    Array.from(block.attributes).forEach(attr => heading.setAttribute(attr.name, attr.value));
    heading.append(...Array.from(block.childNodes));
    block.replaceWith(heading);
  });

  // Lettered and roman numbering is CSS in Google Docs paste, and styles are
  // discarded: keep it as the <ol> type. An item's own style overrides the
  // list's, and Google Docs repeats the style on every item.
  const listStyleType = (element: Element): string | undefined => {
    const value = parseStyle(element.getAttribute('style') || '')['list-style-type'];
    return value ? LIST_STYLE_TYPES[value.toLowerCase()] : undefined;
  };
  tempDiv.querySelectorAll('ol').forEach(list => {
    const itemTypes = new Set(Array.from(list.children).filter(child => child.matches('li')).map(listStyleType));
    const type = (itemTypes.size === 1 ? [...itemTypes][0] : undefined) ?? listStyleType(list);
    if (type) list.setAttribute('type', type);
  });

  sanitizeElement(tempDiv);

  // Source appearance has already determined link boundaries in Word cleanup.
  // Links use their own CSS underline; the explicit strong/underline feature
  // runs later and can add its requested wrapper back exactly once.
  Array.from(tempDiv.querySelectorAll('a[href] u')).reverse().forEach(unwrapElement);
  for (const underline of Array.from(tempDiv.querySelectorAll('u')).reverse()) {
    if (underline.querySelector('a[href]')) {
      underlineNonLinkContent(underline);
      unwrapElement(underline);
    }
  }

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

  // Typed or plain-text input has no block structure. Treat the top level like
  // a layout block, so its inline runs become paragraphs.
  wrapInlineContent(tempDiv, 'p');

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
      if (BLOCK_ELEMENT_SET.has(tagName)) {
        // Replace layout blocks with paragraphs for their inline runs, keeping
        // existing block children and the boundaries between adjacent divs.
        wrapInlineContent(node, 'p');
        for (const child of Array.from(node.children)) {
          if (child.matches('p, h1, h2, h3, h4, h5, h6') && node.hasAttribute('style')) {
            child.setAttribute('style', `${node.getAttribute('style')};${child.getAttribute('style') || ''}`);
          }
        }
        sanitizeElement(node);
        unwrapElement(node);
        continue;
      }
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
      if (tagName === 'u' && formatting) formatting.isUnderline = false;
      
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
      if (formatting && !STRUCTURAL_CHILDREN.has(tagName)) {
        // Format each inline run, including those in child blocks: a single
        // wrapper would enclose blocks such as the paragraphs of a cell or quote.
        for (const run of wrapInlineRuns(node, 'span')) {
          const wrapper = convertFormattingToSemanticTags(run, formatting);
          if (wrapper) run.replaceWith(wrapper);
          else unwrapElement(run);
        }
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

    if (tagName === 'ol' && attrName === 'start') {
      // Keep the number browsers render: the integer prefix of the value, which
      // DOMPurify has already trimmed. NaN and values outside the signed 32-bit
      // range fail the `| 0` round-trip and fall back to the default, as in
      // browsers. start="1" is the default for a non-reversed list, so dropping
      // it leaves unchanged numbering byte-identical.
      const start = parseInt(attr.value, 10);
      if (start !== (start | 0) || (start === 1 && !element.hasAttribute('reversed'))) {
        attrsToRemove.push(attr.name);
      } else if (String(start) !== attr.value) {
        element.setAttribute(attr.name, String(start));
      }
    }

    if (tagName === 'ol' && attrName === 'reversed' && attr.value !== '') {
      element.setAttribute(attr.name, '');
    }

    if (tagName === 'ol' && attrName === 'type' && !OL_TYPES.includes(attr.value)) {
      attrsToRemove.push(attr.name);
    }

    if ((tagName === 'td' || tagName === 'th') && (attrName === 'colspan' || attrName === 'rowspan')) {
      // Keep the span browsers render: the integer prefix, clamped to the HTML
      // maximum. NaN, negative values and colspan="0" fall back to the default
      // 1, which is dropped so unmerged cells stay byte-identical. rowspan="0"
      // is valid: the cell spans the rest of its row group.
      const span = Math.min(parseInt(attr.value, 10), attrName === 'colspan' ? 1000 : 65534);
      if (!(span >= (attrName === 'colspan' ? 1 : 0)) || span === 1) {
        attrsToRemove.push(attr.name);
      } else if (String(span) !== attr.value) {
        element.setAttribute(attr.name, String(span));
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
